const bcrypt = require('bcrypt');
const Staff = require("../models/Staff");

exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select("name username regNo");
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching staff" });
  }
};

exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).select("name username regNo pin");
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json(staff);
  } catch (err) {
    console.error("Error fetching staff by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addStaff = async (req, res) => {
  const { name, username, password, regNo, pin } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const newStaff = new Staff({ name, username, password: hashed, regNo, pin });
    await newStaff.save();
    res.status(201).json({ message: "Staff added" });
  } catch (err) {
    console.error("Error adding staff:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const updated = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff updated", updated });
  } catch (err) {
    console.error("Error updating staff:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deleted" });
  } catch (err) {
    console.error("Error deleting staff:", err);
    res.status(500).json({ message: "Server error" });
  }
};
