const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rank: String,
  rollNo: String,
  regNo: { type: String, default: "NA" },
  dob: Date,
  contactNo: String,
  gender: String,
  year: { type: String, required: true },
  classSection: String,

  // 🔐 Track Excel file name
  uploadedFile: { type: String }
}, { timestamps: true });

/* ===============================
   DUPLICATE PROTECTION
   =============================== */

// Same student (name + regNo)
studentSchema.index(
  { name: 1, regNo: 1 },
  { unique: true }
);

module.exports = mongoose.model("Student", studentSchema);
