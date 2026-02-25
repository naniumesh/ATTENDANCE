const Student = require("../models/Student");
const XLSX = require("xlsx");
const Pin = require("../models/Pin");

// ✅ Utility function to normalize DOB from Excel
function parseExcelDate(value) {
  if (!value) return null;

  // Case 1: Excel serial number (number)
  if (typeof value === "number") {
    // Convert Excel serial date to JS Date
    const utc_days = Math.floor(value - 25569);
    const utc_value = utc_days * 86400; // seconds
    const date_info = new Date(utc_value * 1000);
    return date_info;
  }

  // Case 2: String (yyyy-mm-dd or dd-mm-yyyy)
  const parsed = new Date(value);
  if (!isNaN(parsed)) return parsed;

  // Case 3: Fallback → return null
  return null;
}

// Create new student (manual entry)
exports.createStudent = async (req, res) => {
  const data = req.body;

  // Required fields
  if (!data.name || !data.rank || !data.rollNo || !data.gender || !data.year || !data.classSection) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  // Default regNo
  if (!data.regNo) {
    data.regNo = "NA";
  }

  try {
    const student = new Student(data);
    await student.save();
    res.json({ message: "Student created successfully", student });
  } catch (err) {
    console.error("Error creating student:", err);
    res.status(500).json({ message: "Failed to create student", error: err.message });
  }
};

// Upload & parse Excel file
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileName = req.file.originalname;

    const alreadyUploaded = await Student.findOne({ uploadedFile: fileName });
    if (alreadyUploaded) {
      return res.status(400).json({
        message: "This Excel file was already uploaded",
        fileName
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const seen = new Set();
    const students = [];

    for (const row of sheetData) {
      // ---------- REQUIRED FIELDS ----------
      const name = row.name || row.Name || row["NAME"] || "";
      const rank = row.rank || row.Rank || "";
      const classSection = row.classSection || row.Battalion || row["Battalion"] || "";
      const rawGender = row.gender || row.Gender || "";
      const year = row.year || row.Year || "";

      // ---------- OPTIONAL FIELDS ----------
      const regNo = row.regNo || row["Reg No"] || row["Registration No"] || "NA";
      const rollNo = row.rollNo || row["Roll No"] || "NA";
      const dob = row.dob || row.DOB || row["Date of Birth"];
      const contactNo = row.contactNo || row["Contact No"] || "NA";

      // ---------- NORMALIZATION ----------
      const cleanName = String(name).trim();
      const cleanRank = String(rank).trim();
      const cleanClass = String(classSection).trim();
      const cleanYear = String(year).trim();

      let gender = String(rawGender).trim().toLowerCase();
      if (gender === "m" || gender === "male") gender = "male";
      else if (gender === "f" || gender === "female") gender = "female";
      else gender = "NA";

      // ---------- ENFORCE REQUIRED RULE ----------
      if (!cleanName || !cleanRank || !cleanClass || !cleanYear || gender === "NA") {
        continue;
      }

      const key = `${cleanName}_${regNo}`;
      if (seen.has(key)) continue;
      seen.add(key);

      students.push({
        name: cleanName,
        rank: cleanRank,
        rollNo: rollNo || "NA",
        regNo: String(regNo).trim() || "NA",
        dob: parseExcelDate(dob),
        contactNo: contactNo || "NA",
        gender,
        year: cleanYear,
        classSection: cleanClass,
        uploadedFile: fileName
      });
    } // ✅ FOR LOOP CLOSED HERE

    // ---------- AFTER LOOP ----------
    if (students.length === 0) {
      return res.status(400).json({
        message: "No valid students found in Excel",
        fileName
      });
    }

    await Student.insertMany(students);

    res.status(200).json({
      message: "Excel uploaded successfully",
      fileName,
      inserted: students.length
    });

  } catch (err) {
    console.error("Excel upload error:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "Duplicate student or file detected",
        error: err.keyValue
      });
    }

    res.status(500).json({
      message: "Excel upload failed",
      error: err.message
    });
  }
};



// Get all students
exports.getAllStudents = async (req, res) => {
  const { search, classSection, year } = req.query;

  let query = {};

  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [
      { name: regex },
      { rollNo: regex },
      { regNo: regex }
    ];
  }

  if (classSection) query.classSection = classSection;
  if (year) query.year = year;

  try {
    const students = await Student.find(query).sort({ name: 1 });

    const counts = {
      year1: { boys: 0, girls: 0, total: 0 },
      year2: { boys: 0, girls: 0, total: 0 },
      year3: { boys: 0, girls: 0, total: 0 },
      total: { boys: 0, girls: 0, total: students.length }
    };

    students.forEach((s) => {
      const yearKey = `year${s.year}`;
      if (counts[yearKey]) {
        counts[yearKey].total++;
        if (s.gender.toLowerCase() === "male") counts[yearKey].boys++;
        if (s.gender.toLowerCase() === "female") counts[yearKey].girls++;
      }

      if (s.gender.toLowerCase() === "male") counts.total.boys++;
      if (s.gender.toLowerCase() === "female") counts.total.girls++;
    });

    res.json({
      students,
      counts
    });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ message: "Failed to fetch students", error: err.message });
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await Student.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json({ message: "Student updated successfully", student: updated });
  } catch (err) {
    console.error("Error updating student:", err);
    res.status(500).json({ message: "Failed to update student", error: err.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await Student.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error("Error deleting student:", err);
    res.status(500).json({ message: "Failed to delete student", error: err.message });
  }
};

// ===============================
// DELETE STUDENTS BY YEAR
// ===============================
exports.deleteStudentsByYear = async (req, res) => {
  try {
    // DELETE body fallback safety
    const year = req.body?.year || req.query?.year;
    const confirm = req.body?.confirm;

    if (!["1", "2", "3"].includes(String(year))) {
      return res.status(400).json({ message: "Invalid year. Use 1, 2 or 3." });
    }

    const students = await Student.find({ year: String(year) });

    let boys = 0;
    let girls = 0;

    students.forEach(s => {
      if ((s.gender || "").toLowerCase() === "male") boys++;
      if ((s.gender || "").toLowerCase() === "female") girls++;
    });

    // 🟡 Only preview counts
    if (!confirm) {
      return res.json({
        year,
        boys,
        girls,
        total: students.length,
        confirmRequired: true
      });
    }

    // 🔴 CONFIRMED DELETE
    await Student.deleteMany({ year: String(year) });

    res.json({
      message: `Deleted ${students.length} students of Year ${year}`,
      year,
      boys,
      girls,
      total: students.length
    });

  } catch (err) {
    console.error("Delete-by-year error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===============================
// DOWNLOAD EXCEL TEMPLATE
// ===============================
exports.downloadExcelTemplate = (req, res) => {
  const headers = [[
    "Name",
    "Rank",
    "Battalion",
    "Gender",
    "Year",
    "Roll No",
    "Reg No",
    "Contact No",
    "DOB"
  ]];

  const exampleRow = [[
    "MALEMKONDU UMESH",
    "CQMS",
    "2 PB",
    "Male",
    "3",
    "PB23SDA",
    "1221",
    "7986909910",
    "2004-04-21"
  ]];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleRow]);

  XLSX.utils.book_append_sheet(wb, ws, "Students");

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=student_upload_template.xlsx"
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);
};

// ===============================
// DELETE STUDENTS BY UPLOADED FILE
// ===============================
exports.deleteStudentsByFile = async (req, res) => {
  try {
    const { fileName, confirm } = req.body;

    if (!fileName) {
      return res.status(400).json({ message: "File name is required" });
    }

    const students = await Student.find({ uploadedFile: fileName });

    if (students.length === 0) {
      return res.status(404).json({ message: "No students found for this file" });
    }

    // Preview only
    if (!confirm) {
      return res.json({
        fileName,
        total: students.length,
        confirmRequired: true
      });
    }

    // Confirmed delete
    await Student.deleteMany({ uploadedFile: fileName });

    res.json({
      message: `Deleted ${students.length} students uploaded from ${fileName}`,
      deleted: students.length
    });

  } catch (err) {
    console.error("Delete-by-file error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===============================
// PROMOTE STUDENTS BY YEAR
// ===============================
exports.promoteStudents = async (req, res) => {
  try {
    const { fromYear, toYear, confirm } = req.body;

    if (!["1", "2"].includes(String(fromYear)) || !["2", "3"].includes(String(toYear))) {
      return res.status(400).json({ message: "Invalid year selection" });
    }

    if (String(fromYear) === String(toYear)) {
      return res.status(400).json({ message: "From and To year cannot be same" });
    }

    const students = await Student.find({ year: String(fromYear) });

    if (students.length === 0) {
      return res.status(404).json({ message: "No students found in selected year" });
    }

    // Preview only
    if (!confirm) {
      return res.json({
        fromYear,
        toYear,
        total: students.length,
        confirmRequired: true
      });
    }

    await Student.updateMany(
      { year: String(fromYear) },
      { $set: { year: String(toYear) } }
    );

    res.json({
      message: `Promoted ${students.length} students from Year ${fromYear} to Year ${toYear}`,
      total: students.length
    });

  } catch (err) {
    console.error("Promotion error:", err);
    res.status(500).json({ message: err.message });
  }
};