require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const connectDB = require("./config");

const studentRoutes = require("./routes/studentRoutes");
const staffRoutes = require("./routes/staffRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ---------------------
// Middleware
// ---------------------
app.use(cors());
app.use(bodyParser.json());

// ---------------------
// Connect DB
// ---------------------
connectDB();

// ---------------------
// Serve Front-End
// ---------------------
app.use(express.static(path.join(__dirname, "../frontend")));

// Root route → opens front page (choose the default page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/staff-login.html"));
  // 👆 You can change this to staff-login.html or a new index.html
});

// ---------------------
// API Routes
// ---------------------
app.use("/api/students", studentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// ---------------------
// Start Server
// ---------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
