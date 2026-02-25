const express = require("express");
const router = express.Router();

const {
  setSchedule,
  getAllSchedules,
  getScheduleByDate,
  deleteSchedule,
  getClassHistory
} = require("../controllers/scheduleController");

// ✅ Get all class history (must come before :date route to avoid conflicts)
router.get("/history", getClassHistory);

// ✅ Create a new class schedule
router.post("/", setSchedule);

// ✅ Get all upcoming schedules
router.get("/", getAllSchedules);

// ✅ Get schedule by specific date
router.get("/:date", getScheduleByDate);

// ✅ Delete a schedule by ID
router.delete("/:id", deleteSchedule);

module.exports = router;
