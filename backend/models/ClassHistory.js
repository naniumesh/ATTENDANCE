const mongoose = require("mongoose");

const classHistorySchema = new mongoose.Schema({
  scheduleId: {   // ✅ ADD THIS
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassSchedule",
    required: false,
    default: null
  },
  classDate: {
    type: String,
    required: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: false, // changed from true to allow cleanup without staff
    default: null
  },
  startTime: String,
  endTime: String,
  attendanceTaken: {
    type: Boolean,
    default: false
  },
  totalPresent: {
    type: Number,
    default: 0
  }
});

// Lock is per staff, per date (if staffId exists)
classHistorySchema.index(
  { classDate: 1, staffId: 1 },
  { unique: true, partialFilterExpression: { staffId: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model("ClassHistory", classHistorySchema);
