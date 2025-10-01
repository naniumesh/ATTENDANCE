const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: String,
  rank: String,
  rollNo: String,
  regNo: { type: String, default: "" },  
  dob: Date,
  contactNo: String,
  gender: String,
  year: String,
  classSection: String
});

module.exports = mongoose.model("Student", studentSchema);
