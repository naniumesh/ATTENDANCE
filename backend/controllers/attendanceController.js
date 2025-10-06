const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const ClassSchedule = require("../models/ClassSchedule");
const ClassHistory = require("../models/ClassHistory");
const mongoose = require("mongoose");

// -----------------------------------------------------
// Helper: Move expired schedules to history and ensure
// every staff has a ClassHistory entry (mark absent if not submitted).
// -----------------------------------------------------
async function cleanupExpiredSchedules() {
  const now = new Date();
  // find all schedules (we will check endTime for each)
  const schedules = await ClassSchedule.find().lean();

  for (const sch of schedules) {
    const endDateTime = new Date(`${sch.date}T${sch.endTime}`);
    if (now > endDateTime) {
      // schedule expired -> ensure every staff has a ClassHistory for this schedule
      const allStaff = await Staff.find({}, "_id").lean();
      const allStudents = await Student.find({}, "_id").lean();
      const allStudentIds = allStudents.map((s) => String(s._id));

      for (const staff of allStaff) {
        const exists = await ClassHistory.findOne({
          scheduleId: sch._id,
          staffId: staff._id,
        });

        if (!exists) {
          // staff did not submit -> mark all students absent for this staff for this classDate
          const bulkRecords = allStudentIds.map((sid) => ({
            studentId: sid,
            staffId: staff._id,
            classDate: sch.date,
            status: "Absent",
          }));

          if (bulkRecords.length) {
            // insert but ignore duplicate key errors
            await Attendance.insertMany(bulkRecords, { ordered: false }).catch((err) => {
              if (err.code !== 11000) throw err;
            });
          }

          // create a ClassHistory entry indicating this staff did not take (attendanceTaken: false)
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

      // after ensuring every staff has ClassHistory, delete the schedule
      try {
        await ClassSchedule.deleteOne({ _id: sch._id });
      } catch (err) {
        console.error("Failed to delete expired schedule:", sch._id, err);
      }
    }
  }
}

// -----------------------------------------------------
// Helper: Convert local date+time safely (timezone proof)
// -----------------------------------------------------
function localToUTC(dateStr, timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const local = new Date(dateStr + "T00:00:00"); // fix: prevents UTC date drift
  local.setHours(hour, minute, 0, 0);
  return local;
}

// -----------------------------------------------------
// Helper: Validate class time for attendance (timezone safe)
// -----------------------------------------------------
async function validateAttendanceTime({ scheduleId, classDate }) {
  let schedule = null;

  if (scheduleId) {
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      throw new Error("Invalid or expired class schedule.");
    }
    schedule = await ClassSchedule.findById(scheduleId).lean();
    if (!schedule.date || !schedule.startTime || !schedule.endTime) {
      throw new Error("Invalid or expired class schedule.");
    }
  } else if (classDate) {
    schedule = await ClassSchedule.findOne({ date: classDate }).lean();
    if (!schedule.date || !schedule.startTime || !schedule.endTime) {
      throw new Error("Invalid or expired class schedule.");
    }
  } else {
    throw new Error("Either scheduleId or classDate must be provided.");
  }

  const now = new Date();
  const startDateTime = localToUTC(schedule.date, schedule.startTime);
  const endDateTime = localToUTC(schedule.date, schedule.endTime);

  if (now < startDateTime) {
    throw new Error("Attendance can only be taken after the start time.");
  }
  if (now > endDateTime) {
    throw new Error("Attendance time has expired.");
  }

  return schedule;
}


// -----------------------------------------------------
// GET ALL ATTENDANCE RECORDS
// -----------------------------------------------------
exports.getAttendanceRecords = async (req, res) => {
  const classSection = req.query.classSection;
  const isFilter = classSection && classSection !== "all";

  try {
    const students = await Student.find(
      isFilter ? { classSection: new RegExp(`^${classSection}$`, "i") } : {}
    ).sort({ name: 1 });

    const allAttendance = await Attendance.find().lean();

    const allDates = [...new Set(allAttendance.map((a) => a.classDate))];

    const classScheduleDates = await ClassSchedule.find().sort({ date: 1 }).lean();
    const classHistoryDates = await ClassHistory.find().sort({ classDate: 1 }).lean();

    const scheduleList = [
      ...new Set([
        ...classScheduleDates.map((s) => s.date),
        ...classHistoryDates.map((h) => h.classDate),
        ...allDates,
      ]),
    ].sort();

    const records = await Promise.all(
      students.map(async (student) => {
        const history = scheduleList.map((date) => {
          const recs = allAttendance.filter(
            (a) => a.classDate === date && a.studentId?.toString() === student._id.toString()
          );
          const isPresent = recs.some((r) => r.status === "Present");

          return {
            classDate: date,
            status: recs.length > 0 ? (isPresent ? "Present" : "Absent") : "N/A",
          };
        });

        const presentCount = history.filter((h) => h.status === "Present").length;
        const totalClasses = history.filter((h) => h.status !== "N/A").length;
        const percentage =
          totalClasses > 0 ? ((presentCount / totalClasses) * 100).toFixed(1) : "0.0";

        return {
          student,
          history,
          percentage,
        };
      })
    );

    res.json({
      records,
      allDates,
      scheduleDates: scheduleList,
    });
  } catch (err) {
    console.error("Attendance fetch failed:", err);
    res.status(500).json({
      message: "Failed to fetch attendance records",
      error: err.message,
    });
  }
};

// -----------------------------------------------------
// UPDATE ATTENDANCE (Single record)
// - Accepts staffId optionally; records attendance for that staff.
// - Admin can update without staffId.
// - Schedule deletion occurs only after all staff processed or on expiry.
// -----------------------------------------------------
exports.updateAttendance = async (req, res) => {
  const { studentId, classDate, status, pin, scheduleId, staffId } = req.body;

  try {
    if (!studentId || !classDate || !status || !scheduleId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Validate schedule time
    const schedule = await validateAttendanceTime({ scheduleId, classDate });
    const recordClassDate = new Date(schedule.date).toISOString().split("T")[0];

    // -----------------------------------------------------
    // CASE 1: Staff updating attendance
    // -----------------------------------------------------
    if (staffId) {
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found." });
      }

      // PIN check
      if (String(staff.pin).trim() !== String(pin).trim()) {
        return res.status(401).json({ message: "Invalid PIN." });
      }

      // find existing attendance record for this student/staff/date
      let existing = await Attendance.findOne({
        studentId,
        staffId,
        classDate: recordClassDate,
      });

      if (existing) {
        existing.status = status;
        await existing.save();
      } else {
        await Attendance.create({
          studentId,
          staffId,
          classDate: recordClassDate,
          status,
        });
      }

      // update or create per-staff ClassHistory
      let history = await ClassHistory.findOne({
        scheduleId: schedule._id,
        staffId,
      });

      const staffPresentCount = await Attendance.countDocuments({
        classDate: recordClassDate,
        staffId,
        status: "Present",
      });

      if (!history) {
        history = new ClassHistory({
          scheduleId: schedule._id,
          classDate: recordClassDate,
          startTime: schedule.startTime || null,
          endTime: schedule.endTime || null,
          attendanceTaken: true,
          totalPresent: staffPresentCount,
          staffId,
        });
      } else {
        history.attendanceTaken = true;
        history.totalPresent = staffPresentCount;
      }

      await history.save();

      // After saving staff history, check if all staff have submitted
      const totalStaff = await Staff.countDocuments();
      const historyCount = await ClassHistory.find({ scheduleId: schedule._id }).distinct("staffId");
      if (historyCount.length >= totalStaff) {
        await ClassSchedule.deleteOne({ _id: schedule._id });
      }
    }

    // -----------------------------------------------------
    // CASE 2: Admin updating attendance (no staffId)
    // -----------------------------------------------------
    else {
      console.log("Admin updating attendance – skipping staff checks.");

      let record = await Attendance.findOne({ studentId, classDate: recordClassDate });
      if (record) {
        record.status = status;
        await record.save();
      } else {
        await Attendance.create({
          studentId,
          classDate: recordClassDate,
          status,
        });
      }

      // Admin updates don’t affect per-staff ClassHistory
    }

    res.json({ message: "Attendance updated successfully" });
  } catch (err) {
    console.error("Update attendance error:", err);
    res.status(400).json({
      message: err.message || "Failed to update attendance",
    });
  }
};


// -----------------------------------------------------
// BULK ATTENDANCE SUBMISSION (Multiple staff support)
// - Does NOT delete schedule immediately; deletes only when all staff have submitted (or cleanup does on expiry).
// -----------------------------------------------------
exports.bulkAttendance = async (req, res) => {
  const { scheduleId, classDate, presentStudentIds = [], pin, staffId } = req.body;

  try {
    if (!staffId) return res.status(400).json({ message: "staffId is required." });

    const staff = await Staff.findById(staffId);
    if (!staff || String(staff.pin).trim() !== String(pin).trim()) {
      return res.status(401).json({ message: "Invalid PIN" });
    }

    const schedule = await validateAttendanceTime({ scheduleId, classDate });
    const targetScheduleId = String(schedule._id);
    const recordClassDate = new Date(schedule.date).toISOString().split("T")[0];

    // Prevent duplicate submission by same staff for same schedule
    const historyExists = await ClassHistory.findOne({
      scheduleId: targetScheduleId,
      staffId,
    });
    if (historyExists) {
      return res.status(400).json({ message: "You have already submitted for this class." });
    }

    // Build attendance records for this staff
    const allStudents = await Student.find({}, "_id").lean();
    const allStudentIds = allStudents.map((s) => String(s._id));

    const bulkRecords = [];

    // present
    for (const studentId of presentStudentIds) {
      bulkRecords.push({
        studentId,
        staffId,
        classDate: recordClassDate,
        status: "Present",
      });
    }

    // absent for this staff (those not included in present list)
    const absentIds = allStudentIds.filter((id) => !presentStudentIds.includes(id));
    for (const studentId of absentIds) {
      bulkRecords.push({
        studentId,
        staffId,
        classDate: recordClassDate,
        status: "Absent",
      });
    }

    // Insert attendance records; ignore duplicate key errors (11000) if any
    await Attendance.insertMany(bulkRecords, { ordered: false }).catch((err) => {
      if (err.code !== 11000) throw err;
    });

    // Create per-staff ClassHistory entry
    await ClassHistory.create({
      scheduleId: targetScheduleId,
      classDate: recordClassDate,
      startTime: schedule?.startTime || null,
      endTime: schedule?.endTime || null,
      attendanceTaken: true,
      totalPresent: presentStudentIds.length,
      staffId,
    });

    // After creating this staff history, check if all staff have acted. If yes, finalize (delete schedule)
    const totalStaff = await Staff.countDocuments();
    const distinctStaffIds = await ClassHistory.find({ scheduleId: targetScheduleId }).distinct("staffId");
    if (distinctStaffIds.length >= totalStaff) {
      // finalize: delete the schedule
      try {
        await ClassSchedule.deleteOne({ _id: schedule._id });
      } catch (err) {
        console.error("Error deleting schedule after last staff submitted:", err);
      }
    }

    res.json({
      message: "Attendance submitted successfully and locked for you.",
    });
  } catch (err) {
    console.error("Bulk attendance error:", err);
    res.status(400).json({
      message: err.message || "Failed to submit attendance.",
    });
  }
};

// -----------------------------------------------------
// GET STUDENTS PRESENT ON A SPECIFIC DATE
// (returns unique list of students marked Present by any staff for that date)
// -----------------------------------------------------
exports.getStudentsPresentOnDate = async (req, res) => {
  const date = req.params.date;

  try {
    // find unique studentIds marked Present for this date (across all staff)
    const presentIds = await Attendance.distinct("studentId", {
      classDate: date,
      status: "Present",
    });

    if (!presentIds || presentIds.length === 0) return res.json([]);

    // fetch student details in one query
    const students = await Student.find({ _id: { $in: presentIds } }).lean();

    const presentStudents = students.map((student) => ({
      _id: student._id,
      name: student.name,
      rollNo: student.rollNo,
      regNo: student.regNo,
      classSection: student.classSection,
      gender: student.gender,
    }));

    res.json(presentStudents);
  } catch (err) {
    console.error("Error fetching present students:", err);
    res.status(500).json({
      message: "Failed to fetch present list",
      error: err.message,
    });
  }
};

// -----------------------------------------------------
// Throttled cleanup (runs at most once per hour)
// -----------------------------------------------------
let lastCleanup = 0;
async function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 60 * 60 * 1000) { // once every 60 min
    await cleanupExpiredSchedules();
    lastCleanup = now;
  }
}

// -----------------------------------------------------
// GET ALL SCHEDULED CLASSES (for Staff Page)
// - returns schedules that the calling staff has NOT yet acted on (submitted or been auto-processed)
// -----------------------------------------------------
exports.getSchedules = async (req, res) => {
  const staffId = req.query.staffId;

  try {
    // ensure cleanup for expired schedules first
    await maybeCleanup();

    const schedules = await ClassSchedule.find({}, { date: 1, startTime: 1, endTime: 1 })
      .sort({ date: 1, startTime: 1 })
      .lean();

    // find scheduleIds for which this staff already has a ClassHistory entry (submitted or auto-absent)
    const lockedScheduleIds = await ClassHistory.find({ staffId }).distinct("scheduleId");
    const lockedSet = new Set((lockedScheduleIds || []).map(String));

    const availableSchedules = schedules.filter((s) => {
      const sid = String(s._id);
      return !lockedSet.has(sid);
    });

    res.json(availableSchedules);
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({
      message: "Failed to fetch class schedules.",
      error: err.message,
    });
  }
};

// -----------------------------------------------------
// GET ALL DATES WITH ATTENDANCE
// -----------------------------------------------------
exports.getAllAttendanceDates = async (req, res) => {
  try {
    const allAttendance = await Attendance.find({});
    const uniqueDates = [...new Set(allAttendance.map((a) => a.classDate))];
    res.json(uniqueDates);
  } catch (err) {
    console.error("Error fetching attendance dates:", err);
    res.status(500).json({
      message: "Failed to fetch attendance dates",
      error: err.message,
    });
  }
};

// -----------------------------------------------------
// GET CLASS HISTORY (grouped by schedule, show staff list & statuses)
// -----------------------------------------------------
exports.getClassHistory = async (req, res) => {
  try {
    // ensure expired schedules processed first
    await maybeCleanup();

    const history = await ClassHistory.find().populate("staffId", "name").sort({ classDate: -1 }).lean();

    // Group by scheduleId
    const grouped = history.reduce((acc, item) => {
      const key = String(item.scheduleId);
      if (!acc[key]) {
        acc[key] = {
          scheduleId: key,
          classDate: item.classDate,
          startTime: item.startTime,
          endTime: item.endTime,
          staffList: [],
        };
      }

      acc[key].staffList.push({
        staffId: item.staffId ? item.staffId._id : null,
        staffName: item.staffId ? item.staffId.name : null,
        attendanceTaken: !!item.attendanceTaken,
        totalPresent: item.totalPresent || 0,
      });

      return acc;
    }, {});

    res.json(Object.values(grouped));
  } catch (err) {
    console.error("Error fetching class history:", err);
    res.status(500).json({
      message: "Failed to fetch history",
      error: err.message,
    });
  }
};
