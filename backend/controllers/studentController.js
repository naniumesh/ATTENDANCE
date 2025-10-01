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
    if (!req.file) return res.status(400).send("No file uploaded");

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const students = sheetData.map(row => ({
      name: row.name || "",
      rank: row.rank || "",
      rollNo: row.rollNo || "",
      regNo: row.regNo || "NA",
      dob: parseExcelDate(row.dob),
      contactNo: row.contactNo || "",
      gender: row.gender || "",
      year: row.year || "",
      classSection: row.classSection || ""
    }));

    await Student.insertMany(students);

    const displayStudents = students.map(s => ({
      ...s,
      regNo: s.regNo || "NA"
    }));

    res.status(200).json({ message: "Students uploaded successfully", students: displayStudents });
  } catch (error) {
    console.error("Error uploading students from Excel:", error);
    res.status(500).json({ error: error.message });
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
