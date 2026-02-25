const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

// Register admin
exports.registerAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Admin already exists." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const admin = new Admin({
      username,
      password: hashed,
    });

    await admin.save();

    res.json({
      message: "Admin registered successfully.",
      adminId: admin._id,
      username: admin.username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to register admin", error: err.message });
  }
};

// Login admin
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful.",
      adminId: admin._id,
      username: admin.username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};
