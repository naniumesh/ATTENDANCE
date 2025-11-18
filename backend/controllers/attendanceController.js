const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const ClassSchedule = require("../models/ClassSchedule");
const ClassHistory = require("../models/ClassHistory");
const mongoose = require("mongoose");

/* ---------------------------------------------------------
   CLEANUP EXPIRED SCHEDULES
--------------------------------------------------------- */
async function cleanupExpiredSchedules() {
  const now = new Date();
  const schedules = await ClassSchedule.find().lean();

  for (const sch of schedules) {
    const endDateTime = new Date(`${sch.date}T${sch.endTime}`);
    if (now <= endDateTime) continue;

    const allStaff = await Staff.find({}, "_id").lean();
    const allStudents = await Student.find({}, "_id").lean();
    const allStudentIds = allStudents.map((s) => String(s._id));

    for (const staff of allStaff) {
      const exists = await ClassHistory.findOne({
        scheduleId: sch._id,
        staffId: staff._id,
      });

      if (!exists) {
        // mark all students absent for that staff
        const records = allStudentIds.map((sid) => ({
          studentId: sid,
          staffId: staff._id,
          classDate: sch.date,
          status: "Absent",
        }));

        await Attendance.insertMany(records, { ordered: false }).catch((err) => {
          if (err.code !== 11000) throw err;
        });

        await ClassHistory.create({
          scheduleId: sch._id,
          classDate: sch.date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          attendanceTaken: false,
          totalPresent: 0,
          staffId: staff._id,
        });
      }
    }

    await ClassSchedule.deleteOne({ _id: sch._id });
  }
}

/* ---------------------------------------------------------
   TIMEZONE FIX
--------------------------------------------------------- */
function localToUTC(dateStr, timeStr) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [H, M] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, H, M) - IST_OFFSET_MS);
}

/* ---------------------------------------------------------
   VALIDATE ATTENDANCE TIME
--------------------------------------------------------- */
async function validateAttendanceTime({ scheduleId, classDate }) {
  let schedule = await ClassSchedule.findById(scheduleId).lean();
  if (!schedule) throw new Error("Invalid or expired class schedule.");

  const now = new Date();
  const start = localToUTC(schedule.date, schedule.startTime);
  const end = localToUTC(schedule.date, schedule.endTime);

  if (now < start) throw new Error("Attendance can only be taken after the start time.");
  if (now > end) throw new Error("Attendance time has expired.");

  return schedule;
}

/* ---------------------------------------------------------
   GET ATTENDANCE RECORDS
--------------------------------------------------------- */
exports.getAttendanceRecords = async (req, res) => {
  const filterClass = req.query.classSection;
  const studentQuery =
    filterClass && filterClass !== "all"
      ? { classSection: new RegExp(`^${filterClass}$`, "i") }
      : {};

  try {
    const students = await Student.find(studentQuery).sort({ name: 1 });
    const attendance = await Attendance.find().lean();

    const allDates = [...new Set(attendance.map((a) => a.classDate))];
    const schedDates = await ClassSchedule.find().sort({ date: 1 }).lean();
    const histDates = await ClassHistory.find().sort({ classDate: 1 }).lean();

    const scheduleList = [
      ...new Set([
        ...schedDates.map((s) => s.date),
        ...histDates.map((h) => h.classDate),
        ...allDates,
      ]),
    ].sort();

    const records = await Promise.all(
      students.map(async (student) => {
        const history = scheduleList.map((date) => {
          const recs = attendance.filter(
            (a) =>
              a.studentId?.toString() === student._id.toString() &&
              a.classDate === date
          );
          const isPresent = recs.some((r) => r.status === "Present");

          return {
            classDate: date,
            status: recs.length ? (isPresent ? "Present" : "Absent") : "N/A",
          };
        });

        const present = history.filter((h) => h.status === "Present").length;
        const total = history.filter((h) => h.status !== "N/A").length;

        return {
          student,
          history,
          percentage: total ? ((present / total) * 100).toFixed(1) : "0.0",
        };
      })
    );

    res.json({ records, allDates, scheduleDates: scheduleList });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance records", error: err.message });
  }
};

/* ---------------------------------------------------------
   UPDATE ATTENDANCE (STAFF + ADMIN)
--------------------------------------------------------- */
exports.updateAttendance = async (req, res) => {
  const { studentId, classDate, status, pin, scheduleId, staffId } = req.body;

  try {
    /* VALIDATION */
    if (staffId) {
      if (!studentId || !classDate || !status || !scheduleId)
        return res.status(400).json({ message: "Missing required fields for staff submission." });
    } else {
      if (!studentId || !classDate || !status)
        return res.status(400).json({ message: "Missing required fields." });
    }

    /* SCHEDULE VALIDATION */
    let schedule = null;
    if (staffId) schedule = await validateAttendanceTime({ scheduleId, classDate });
    else if (scheduleId) schedule = await validateAttendanceTime({ scheduleId, classDate });

    const finalClassDate = schedule
      ? schedule.date
      : new Date(classDate).toISOString().split("T")[0];

    /* STAFF UPDATE */
    if (staffId) {
      const staff = await Staff.findById(staffId);
      if (!staff) return res.status(404).json({ message: "Staff not found." });

      if (String(staff.pin).trim() !== String(pin).trim())
        return res.status(401).json({ message: "Invalid PIN." });

      let record = await Attendance.findOne({ studentId, staffId, classDate: finalClassDate });

      if (record) record.status = status;
      else record = await Attendance.create({ studentId, staffId, classDate: finalClassDate, status });

      await record.save();

      // CLASS HISTORY UPDATE
      let history = await ClassHistory.findOne({ scheduleId: schedule._id, staffId });
      const presentCount = await Attendance.countDocuments({
        staffId,
        classDate: finalClassDate,
        status: "Present",
      });

      if (!history) {
        history = await ClassHistory.create({
          scheduleId: schedule._id,
          classDate: finalClassDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          attendanceTaken: true,
          totalPresent: presentCount,
          staffId,
        });
      } else {
        history.attendanceTaken = true;
        history.totalPresent = presentCount;
        await history.save();
      }

      // Delete schedule if all staff submitted
      const totalStaff = await Staff.countDocuments();
      const submittedStaff = await ClassHistory.find({ scheduleId: schedule._id }).distinct("staffId");

      if (submittedStaff.length >= totalStaff) {
        await ClassSchedule.deleteOne({ _id: schedule._id });
      }
    }

    /* ADMIN UPDATE */
    else {
      const GLOBAL_PIN = process.env.GLOBAL_PIN || "1945";

      if (String(GLOBAL_PIN).trim() !== String(pin).trim())
        return res.status(401).json({ message: "Invalid admin PIN." });

      let record = await Attendance.findOne({ studentId, classDate: finalClassDate });

      if (record) record.status = status;
      else record = await Attendance.create({ studentId, classDate: finalClassDate, status });

      await record.save();
    }

    res.json({ message: "Attendance updated successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
   BULK SUBMISSION (STAFF)
--------------------------------------------------------- */
exports.bulkAttendance = async (req, res) => {
  const { scheduleId, classDate, presentStudentIds = [], pin, staffId } = req.body;

  try {
    if (!staffId) return res.status(400).json({ message: "staffId is required." });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found." });

    if (String(staff.pin).trim() !== String(pin).trim())
      return res.status(401).json({ message: "Invalid PIN" });

    const schedule = await validateAttendanceTime({ scheduleId, classDate });
    const recordDate = schedule.date;

    const already = await ClassHistory.findOne({ scheduleId, staffId });
    if (already) return res.status(400).json({ message: "You have already submitted." });

    const allStudents = await Student.find({}, "_id").lean();
    const allIDs = allStudents.map((s) => String(s._id));

    const absentIDs = allIDs.filter((id) => !presentStudentIds.includes(id));

    const bulk = [
      ...presentStudentIds.map((id) => ({
        studentId: id,
        staffId,
        classDate: recordDate,
        status: "Present",
      })),
      ...absentIDs.map((id) => ({
        studentId: id,
        staffId,
        classDate: recordDate,
        status: "Absent",
      })),
    ];

    await Attendance.insertMany(bulk, { ordered: false }).catch((err) => {
      if (err.code !== 11000) throw err;
    });

    await ClassHistory.create({
      scheduleId,
      classDate: recordDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      attendanceTaken: true,
      totalPresent: presentStudentIds.length,
      staffId,
    });

    const totalStaff = await Staff.countDocuments();
    const submitted = await ClassHistory.find({ scheduleId }).distinct("staffId");

    if (submitted.length >= totalStaff) {
      await ClassSchedule.deleteOne({ _id: schedule._id });
    }

    res.json({ message: "Attendance submitted successfully and locked for you." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
   GET STUDENTS PRESENT ON DATE
--------------------------------------------------------- */
exports.getStudentsPresentOnDate = async (req, res) => {
  try {
    const date = req.params.date;
    const ids = await Attendance.distinct("studentId", { classDate: date, status: "Present" });

    const students = await Student.find(
      { _id: { $in: ids } },
      "name rollNo regNo classSection gender year rank"
    ).lean();
    
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch present list" });
  }
};

/* ---------------------------------------------------------
   GET SCHEDULES
--------------------------------------------------------- */
let lastCleanup = 0;
async function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 3600000) {
    await cleanupExpiredSchedules();
    lastCleanup = now;
  }
}

exports.getSchedules = async (req, res) => {
  try {
    await maybeCleanup();

    const staffId = req.query.staffId;

    const schedules = await ClassSchedule.find().sort({ date: 1 }).lean();
    const locked = await ClassHistory.find({ staffId }).distinct("scheduleId");

    const filtered = schedules.filter((s) => !locked.includes(String(s._id)));

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
};

/* ---------------------------------------------------------
   GET ALL ATTENDANCE DATES
--------------------------------------------------------- */
exports.getAllAttendanceDates = async (req, res) => {
  try {
    const all = await Attendance.find({});
    const dates = [...new Set(all.map((a) => a.classDate))];
    res.json(dates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dates" });
  }
};

/* ---------------------------------------------------------
   ADVANCED CLASS HISTORY REPORT
--------------------------------------------------------- */
exports.getClassHistory = async (req, res) => {
  try {
    await maybeCleanup();

    const staffId = req.query.staffId;
    const filter = staffId ? { staffId } : {};

    const records = await Attendance.find(filter)
      .populate("studentId", "name rollNo regNo classSection gender rank year")
      .sort({ classDate: -1 })
      .lean();

    if (!records.length)
      return res.json({ report: "No attendance records found.", structured: {} });

    const structured = {};

    // BUILD STRUCTURE: date → classSection → year → Boys/Girls[]
    for (const rec of records) {
      const stu = rec.studentId;
      if (!stu) continue;

      const date = rec.classDate;
      const className = stu.classSection || "Unknown Class";

      const yearLabel =
        stu.year === 1 ? "1st Year" :
        stu.year === 2 ? "2nd Year" :
        stu.year === 3 ? "3rd Year" : "Unknown Year";

      const gender = stu.gender?.toLowerCase() === "male" ? "Boys" : "Girls";

      structured[date] ??= {};
      structured[date][className] ??= {};
      structured[date][className][yearLabel] ??= { Boys: [], Girls: [] };

      structured[date][className][yearLabel][gender].push({
        name: stu.name,
        rank: stu.rank || ""
      });
    }

    // FINAL REPORT STRING
    let fullReport = "";
    const dateList = Object.keys(structured).sort((a,b)=> new Date(b)-new Date(a));

    for (const date of dateList) {
      fullReport += `Jai Hind Everyone,\nAttendance of today's fallin i.e. ${date}\n\n`;

      const classList = Object.keys(structured[date]).sort();

      let overallBoys = 0;
      let overallGirls = 0;

      for (const cls of classList) {
        fullReport += `${cls}\n`;

        const years = Object.keys(structured[date][cls]).sort((a,b)=>{
          const numA = parseInt(a);
          const numB = parseInt(b);
          return numB - numA; // 3rd → 2nd → 1st
        });

        let classBoys = 0;
        let classGirls = 0;

        for (const year of years) {
          fullReport += `  ${year}\n`;

          const boysList = structured[date][cls][year].Boys;
          const girlsList = structured[date][cls][year].Girls;

          // print boys
          boysList.forEach(b=>{
            fullReport += `    ${b.rank} - ${b.name}\n`;
          });

          // print girls
          girlsList.forEach(g=>{
            fullReport += `    ${g.rank} - ${g.name}\n`;
          });

          classBoys += boysList.length;
          classGirls += girlsList.length;

          fullReport += "\n";
        }

        // class totals
        fullReport += `Final Totals for ${cls}:\n`;
        fullReport += `  Boys: ${classBoys}\n`;
        fullReport += `  Girls: ${classGirls}\n`;
        fullReport += `  Total: ${classBoys + classGirls}\n\n`;

        overallBoys += classBoys;
        overallGirls += classGirls;
      }

      fullReport += `OVERALL BOYS: ${overallBoys}\n`;
      fullReport += `OVERALL GIRLS: ${overallGirls}\n`;
      fullReport += `OVERALL TOTAL: ${overallBoys + overallGirls}\n\n`;
      fullReport += "------------------------------------------------\n\n";
    }

    res.json({ report: fullReport.trim(), structured });

  } catch (err) {
    return res.status(500).json({
      message: "History fetch failed",
      error: err.message
    });
  }
};
