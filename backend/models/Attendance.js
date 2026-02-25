const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true
  },

  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassSchedule",
    required: false,
    default: null
  },

  classDate: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["Present", "Absent"],
    required: true
  }
});

// Unique per schedule, per staff, per student
attendanceSchema.index(
  { studentId: 1, staffId: 1, classDate: 1, scheduleId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
