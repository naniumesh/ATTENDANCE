const mongoose = require("mongoose");

const classScheduleSchema = new mongoose.Schema({
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true }
});

// ✅ Prevent same date & startTime duplicates, but allow multiple times per day
classScheduleSchema.index({ date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model("ClassSchedule", classScheduleSchema);
