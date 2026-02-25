const express = require("express");
const router = express.Router();

const {
  getAttendanceRecords,
  updateAttendance,
  getStudentsPresentOnDate,
  bulkAttendance,
  getSchedules,
  getAllAttendanceDates,
  getClassHistory
} = require("../controllers/attendanceController");

router.get("/", getAttendanceRecords);
router.patch("/update", updateAttendance);
router.get("/present/:date", getStudentsPresentOnDate);
router.post("/bulk", bulkAttendance);
router.get("/schedule", getSchedules);
router.get("/schedule/history", getClassHistory);
router.get("/all", getAllAttendanceDates);

module.exports = router;
