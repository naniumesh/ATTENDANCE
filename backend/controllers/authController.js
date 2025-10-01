const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");

// -----------------------------------------
// Staff Login
// -----------------------------------------
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const staff = await Staff.findOne({ username });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      message: "Login successful",
      staffId: staff._id,
      name: staff.name,
      username: staff.username
    });

  
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------------------
// Admin Creates New Staff
// -----------------------------------------
exports.createStaff = async (req, res) => {
  try {
    const { name, username, password, regNo, pin } = req.body;

    if (!name || !username || !password || !regNo || !pin) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await Staff.findOne({ username });
    if (existing) return res.status(400).json({ message: "Staff user already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const staff = await Staff.create({
      name,
      username,
      password: hashedPassword,
      regNo,
      pin,
      hasAccess: true
    });

    res.status(201).json({
      message: "Staff created successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        username: staff.username,
        regNo: staff.regNo,
        hasAccess: staff.hasAccess
      }
    });
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(500).json({ message: "Server error creating staff" });
  }
};

// -----------------------------------------
// Admin Creates User (Login Admins)
// -----------------------------------------
exports.createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      password: hashed,
      role: role || "admin"
    });

    res.status(201).json({ message: "User created", user });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Failed to create user", error: err.message });
  }
};

exports.staffLogin = async (req, res) => {
  const { username, password } = req.body;

  const staff = await Staff.findOne({ username });
  if (!staff) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  if (!staff.hasAccess) {
    return res.status(403).json({ message: "Access disabled by admin." });
  }

  const isMatch = await bcrypt.compare(password, staff.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // generate token, etc...
};