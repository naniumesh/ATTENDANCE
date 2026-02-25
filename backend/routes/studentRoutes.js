const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  createStudent,
  getAllStudents,
  updateStudent,
  deleteStudent,
  uploadExcel,
  deleteStudentsByYear,
  deleteStudentsByFile,  
  promoteStudents,        
  downloadExcelTemplate
} = require("../controllers/studentController");

// ===============================
// MULTER CONFIG
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".xls", ".xlsx"].includes(ext)) {
      return cb(new Error("Only Excel files are allowed"));
    }
    cb(null, true);
  }
});

// ===============================
// ROUTES
// ===============================
router.post("/", createStudent);
router.get("/", getAllStudents);
router.patch("/:id", updateStudent);
router.delete("/:id", deleteStudent);

router.post("/upload-excel", upload.single("file"), uploadExcel);

router.get("/download-template", downloadExcelTemplate);

router.post("/delete-by-file", deleteStudentsByFile); 
router.post("/delete-by-year", deleteStudentsByYear);
router.post("/promote", promoteStudents);            

module.exports = router;