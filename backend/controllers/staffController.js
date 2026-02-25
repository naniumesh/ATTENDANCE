const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Staff = require("../models/Staff");

/* ---------------------------------------------------------
   GET ALL STAFF
--------------------------------------------------------- */
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select("name username regNo");
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching staff" });
  }
};

/* ---------------------------------------------------------
   GET STAFF BY ID
--------------------------------------------------------- */
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)
      .select("name username regNo pin sessionToken");

    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ---------------------------------------------------------
   ADD STAFF
--------------------------------------------------------- */
exports.addStaff = async (req, res) => {
  const { name, username, password, regNo, pin } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);

    const newStaff = new Staff({
      name,
      username,
      password: hashed,
      regNo,
      pin,
      sessionToken: null
    });

    await newStaff.save();
    res.status(201).json({ message: "Staff added" });
  } catch (err) {
    console.error("Error adding staff:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ---------------------------------------------------------
   UPDATE STAFF
--------------------------------------------------------- */
exports.updateStaff = async (req, res) => {
  try {
    const updated = await Staff.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff updated", updated });
  } catch (err) {
    console.error("Error updating staff:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ---------------------------------------------------------
   DELETE STAFF
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   STAFF LOGIN (SINGLE DEVICE ONLY)
--------------------------------------------------------- */
exports.staffLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const staff = await Staff.findOne({ username });
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const match = await bcrypt.compare(password, staff.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ CREATE SESSION TOKEN
    const token = crypto.randomBytes(24).toString("hex");

    staff.sessionToken = token;
    staff.sessionUpdatedAt = new Date();
    await staff.save();

    res.json({
      staffId: staff._id,
      name: staff.name,
      username: staff.username,
      sessionToken: token
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ---------------------------------------------------------
   STAFF LOGOUT
--------------------------------------------------------- */
exports.logoutStaff = async (req, res) => {
  const { staffId } = req.body;

  try {
    await Staff.findByIdAndUpdate(staffId, {
      sessionToken: null,
      sessionUpdatedAt: null
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed" });
  }
};