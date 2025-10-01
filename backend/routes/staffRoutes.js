const express = require("express");
const router = express.Router();
const {
  getAllStaff,
  getStaffById,
  addStaff,
  updateStaff,
  deleteStaff
} = require("../controllers/staffController");

router.get("/", getAllStaff);          // GET all staff
router.get("/:id", getStaffById);      // GET staff by ID
router.post("/", addStaff);           // POST add new staff
router.patch("/:id", updateStaff);    // PATCH update staff details
router.delete("/:id", deleteStaff);   // DELETE staff by ID

module.exports = router;
