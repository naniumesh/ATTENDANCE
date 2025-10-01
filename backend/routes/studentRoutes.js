const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  createStudent,
  getAllStudents,
  updateStudent,
  deleteStudent,
  uploadExcel
} = require("../controllers/studentController");

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// CRUD routes
router.post("/", createStudent);
router.get("/", getAllStudents);
router.patch("/:id", updateStudent);
router.delete("/:id", deleteStudent);

// Excel upload route
router.post("/upload-excel", upload.single("file"), uploadExcel);

module.exports = router;
