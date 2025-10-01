const ClassSchedule = require("../models/ClassSchedule");
const ClassHistory = require("../models/ClassHistory");
const Staff = require("../models/Staff");
const Attendance = require("../models/Attendance"); // needed for checking submissions

// -----------------------------------------------------
// Create new class schedule (multiple per day allowed)
// -----------------------------------------------------
exports.setSchedule = async (req, res) => {
  try {
    const { date, startTime, endTime, staffIds } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        message: "All fields (date, startTime, endTime) are required"
      });
    }

    const schedule = new ClassSchedule({
      date,
      startTime,
      endTime,
      staffIds: Array.isArray(staffIds) ? staffIds : [] // store which staff are expected
    });

    await schedule.save();

    res.json({
      message: "Schedule created successfully",
      schedule,
      serverTime: new Date()
    });
  } catch (err) {
    console.error("Error saving schedule:", err);
    res.status(500).json({
      message: "Failed to save schedule",
      error: err.message
    });
  }
};

// -----------------------------------------------------
// Get all upcoming schedules (today & future)
// -----------------------------------------------------
exports.getAllSchedules = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const schedules = await ClassSchedule.find({ date: { $gte: today } })
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json({
      serverTime: new Date(),
      schedules
    });
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({
      message: "Failed to fetch schedules",
      error: err.message
    });
  }
};

// -----------------------------------------------------
// Get schedule by date
// -----------------------------------------------------
exports.getScheduleByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const schedules = await ClassSchedule.find({ date }).lean();
    if (!schedules || schedules.length === 0) {
      return res.status(404).json({
        message: "No class scheduled for this date",
        serverTime: new Date()
      });
    }

    res.json({
      serverTime: new Date(),
      schedules
    });
  } catch (err) {
    console.error("Error fetching schedule for date:", err);
    res.status(500).json({
      message: "Error fetching schedule",
      error: err.message
    });
  }
};

// -----------------------------------------------------
// Delete schedule by ID (manual)
// -----------------------------------------------------
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ClassSchedule.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json({
      message: "Class cancelled successfully",
      serverTime: new Date()
    });
  } catch (err) {
    console.error("Error deleting schedule:", err);
    res.status(500).json({
      message: "Error cancelling class",
      error: err.message
    });
  }
};

// -----------------------------------------------------
// Auto-delete schedule after all staff submit
// -----------------------------------------------------
exports.checkAndDeleteScheduleIfAllSubmitted = async (scheduleId) => {
  try {
    const schedule = await ClassSchedule.findById(scheduleId).lean();
    if (!schedule) return;

    const assignedStaffIds = schedule.staffIds || [];
    if (assignedStaffIds.length === 0) return; // no assigned staff? skip

    const submittedStaffIds = await ClassHistory.find({
      scheduleId,
      attendanceTaken: true
    }).distinct("staffId");

    const allSubmitted = assignedStaffIds.every(staffId =>
      submittedStaffIds.map(id => id.toString()).includes(staffId.toString())
    );

    if (allSubmitted) {
      await ClassSchedule.deleteOne({ _id: scheduleId });
      console.log(`✅ Schedule ${scheduleId} deleted after all staff submitted`);
    }
  } catch (err) {
    console.error("Error in auto-delete check:", err);
  }
};

// -----------------------------------------------------
// Get class history
// -----------------------------------------------------
exports.getClassHistory = async (req, res) => {
  try {
    const history = await ClassHistory.find()
      .populate("staffId", "name")
      .sort({ classDate: -1 })
      .lean();

    res.json({
      serverTime: new Date(),
      history: Array.isArray(history) ? history : []
    });
  } catch (err) {
    console.error("Error fetching class history:", err);
    res.status(500).json({
      message: "Failed to fetch history",
      error: err.message
    });
  }
};
