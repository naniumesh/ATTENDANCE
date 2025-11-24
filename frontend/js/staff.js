const API_BASE = "https://attendance-jmxr.onrender.com/api";

// -----------------------------
// Staff login/session check
// -----------------------------
window.addEventListener("load", () => {
  const isLoggedIn = localStorage.getItem("loggedIn");
  const id = localStorage.getItem("staffId");
  const name = localStorage.getItem("staffName");
  const username = localStorage.getItem("staffUsername");

  if (!isLoggedIn || !id || !name || !username) {
    localStorage.clear();
    alert("Session expired. Please log in again.");
    window.location.href = "staff-login.html";
  }
});

const staffId = localStorage.getItem("staffId");
const staffName = localStorage.getItem("staffName");
const staffUsername = localStorage.getItem("staffUsername");

if (!staffId) {
  alert("Staff ID missing. Please log in again.");
  localStorage.clear();
  window.location.href = "staff-login.html";
}

// -----------------------------
// Globals
// -----------------------------
let selectedClass = "";
let selectedYear = "";
let students = [];
let presentStudents = [];

let selectedClassDate = "";
let selectedScheduleId = "";
let currentStartTime = "";
let currentEndTime = "";

const completedDatesKey = `completedDates_${staffId}`;
let completedDates = JSON.parse(localStorage.getItem(completedDatesKey) || "[]");

// DOM Elements
const staffInfoEl = document.getElementById("staffInfo");
const studentSearchEl = document.getElementById("staffStudentSearch");
const studentTableBody = document.querySelector("#staffAttendanceTable tbody");
const attendanceCountsEl = document.getElementById("staffAttendanceCounts");
const yearContainerEl = document.getElementById("staffYearContainer");

// -----------------------------
// Staff Info
// -----------------------------
if (staffInfoEl) {
  staffInfoEl.innerText = `Logged in as: ${staffName} (${staffUsername})`;
}

// -----------------------------
// Logout & History
// -----------------------------
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "staff-login.html";
});

document.getElementById("historyToggleBtn")?.addEventListener("click", () => {
  document.getElementById("historyContainer").style.display = "block";
  document.getElementById("mainContent").style.display = "none";
  loadHistory();
});

document.getElementById("closeHistoryBtn")?.addEventListener("click", () => {
  document.getElementById("historyContainer").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
});

// -----------------------------
// Class Buttons & Year Filter
// -----------------------------
document.querySelectorAll(".staff-class-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedClass = btn.getAttribute("data-class");
    selectedYear = "";

    yearContainerEl.innerHTML = `
      <label>Filter Year:</label>
      <select id="staffYearFilter">
        <option value="">All Years</option>
        <option value="1">1st Year</option>
        <option value="2">2nd Year</option>
        <option value="3">3rd Year</option>
      </select>
    `;

    document.getElementById("staffYearFilter").addEventListener("change", e => {
      selectedYear = e.target.value;
      renderStudentTable();
    });

    renderStudentTable();
  });
});

document.getElementById("staffResetFilter")?.addEventListener("click", () => {
  selectedClass = "";
  selectedYear = "";
  yearContainerEl.innerHTML = "";
  renderStudentTable();
});

// -----------------------------
// Fetch students
// -----------------------------
async function loadStudents() {
  try {
    const res = await fetch(`${API_BASE}/students`);
    const data = await res.json();
    students = data.students || [];
    renderStudentTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load students.");
  }
}

// -----------------------------
// Render student table
// -----------------------------
function renderStudentTable() {
  const keyword = studentSearchEl?.value.toLowerCase() || "";
  let filtered = students;

  if (selectedClass) {
    filtered = filtered.filter(
      s => String(s.classSection).trim().toLowerCase() === selectedClass.trim().toLowerCase()
    );
  }

  if (selectedYear) {
    filtered = filtered.filter(s => String(s.year) === selectedYear);
  }

  if (keyword) {
    filtered = filtered.filter(s =>
      s.name?.toLowerCase().includes(keyword) ||
      s.rollNo?.toLowerCase().includes(keyword) ||
      s.regNo?.toLowerCase().includes(keyword)
    );
  }

  studentTableBody.innerHTML = "";
  if (filtered.length === 0) {
    studentTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No students found</td></tr>`;
  } else {
    const now = new Date();
    const withinSchedule = isWithinSchedule(now, selectedClassDate, currentStartTime, currentEndTime);

    filtered.forEach(s => {
      const present = presentStudents.find(p => p._id === s._id) ? "checked" : "";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${s.rank || "-"}</td>
        <td>${s.name}</td>
        <td>${s.regNo || "-"}</td>
        <td>${s.rollNo || "-"}</td>
        <td>
          <input type="checkbox" style="transform:scale(1.5);" data-id="${s._id}" ${present} ${withinSchedule ? "" : "disabled"} />
        </td>
      `;
      studentTableBody.appendChild(row);

      row.querySelector("input[type=checkbox]")?.addEventListener("change", e => {
        const id = e.target.dataset.id;
        if (e.target.checked) addToPresent(id);
        else removeFromPresent(id);
        saveDraft();
      });
    });
  }

  renderAttendanceCounts();
}

// -----------------------------
// Add / Remove Present
// -----------------------------
function addToPresent(id) {
  const student = students.find(s => s._id === id);
  if (!student) return;
  if (!presentStudents.find(s => s._id === id)) presentStudents.push(student);
  renderStudentTable();
}

function removeFromPresent(id) {
  const student = presentStudents.find(s => s._id === id);
  if (!student) return;

  if (confirm(`Are you sure to remove ${student.name} from present list?`)) {
    presentStudents = presentStudents.filter(s => s._id !== id);
    renderStudentTable();
  } else {
    renderStudentTable();
  }
}

// -----------------------------
// Save Draft
// -----------------------------
function saveDraft() {
  if (!selectedClassDate) return;
  const draftKey = `attendanceDraft_${staffId}_${selectedClassDate}`;
  localStorage.setItem(draftKey, JSON.stringify(presentStudents.map(s => s._id)));
}

function loadDraft() {
  if (!selectedClassDate) return;
  const draftKey = `attendanceDraft_${staffId}_${selectedClassDate}`;
  const draft = JSON.parse(localStorage.getItem(draftKey) || "[]");
  presentStudents = students.filter(s => draft.includes(s._id));
}

// -----------------------------
// Render Counts
// -----------------------------
function renderAttendanceCounts() {
  const totalPresent = presentStudents.length;
  const totalStudents = students.length;
  attendanceCountsEl.innerHTML = `<h3>Present: ${totalPresent} / ${totalStudents}</h3>`;

  const counts = { "1": { boys: 0, girls: 0 }, "2": { boys: 0, girls: 0 }, "3": { boys: 0, girls: 0 } };
  presentStudents.forEach(s => {
    if (!s.year) return;
    const year = String(s.year);
    if ((s.gender || "").toLowerCase() === "male") counts[year].boys++;
    else counts[year].girls++;
  });

  ["1","2","3"].forEach(y => {
    const boys = counts[y].boys;
    const girls = counts[y].girls;
    const total = boys + girls;
    attendanceCountsEl.innerHTML += `<div>Year ${y}: Boys: ${boys}, Girls: ${girls}, Total: ${total}</div>`;
  });
}

studentSearchEl?.addEventListener("input", renderStudentTable);

// -----------------------------
// Submit Attendance Modal
// -----------------------------
document.getElementById("submitAttendance")?.addEventListener("click", () => {
  if (presentStudents.length === 0) {
    alert("No students selected.");
    return;
  }
  document.getElementById("modalOverlay").style.display = "flex";
});

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

document.getElementById("confirmSubmitBtn")?.addEventListener("click", async () => {
  const countEl = document.getElementById("confirmCount");
  const pinEl = document.getElementById("confirmPin");
  const dateEl = document.getElementById("currentDate");

  if (!countEl || !pinEl || !dateEl) return;

  const enteredPin = pinEl.value;
  const classDate = dateEl.textContent;

  try {
    const staffRes = await fetch(`${API_BASE}/staff/${staffId}`);
    const staffData = await staffRes.json();

    if (String(staffData.pin).trim() !== String(enteredPin).trim()) {
      alert("Invalid PIN.");
      return;
    }

    const res = await fetch(`${API_BASE}/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId,
        scheduleId: selectedScheduleId,
        classDate,
        presentStudentIds: presentStudents.map(s => s._id),
        pin: enteredPin
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to submit");
    }

    const result = await res.json();
    alert(result.message);

    completedDates.push(classDate);
    localStorage.setItem(completedDatesKey, JSON.stringify(completedDates));

    presentStudents = [];
    document.getElementById("attendanceSection").style.display = "none";
    closeModal();
    renderStudentTable();
    loadSchedules();
  } catch (err) {
    console.error(err);
    alert("Failed to submit attendance.");
  }
});

// -----------------------------
// Load Schedules
// -----------------------------
loadSchedules();
async function loadSchedules() {
  try {
    const res = await fetch(`${API_BASE}/attendance/schedule?staffId=${staffId}`);
    const data = await res.json();
    const container = document.getElementById("scheduleContainer");
    container.innerHTML = "";

    const pending = data.filter(s => !completedDates.includes(s.date));
    if (pending.length === 0) { container.innerHTML = "<p>No classes scheduled.</p>"; return; }

    const now = new Date();

    pending.forEach(s => {
      const btn = document.createElement("button");
      btn.className = "schedule-btn";

      const status = getScheduleStatus(now, s.date, s.startTime, s.endTime);
      if (status === "active") btn.style.backgroundColor = "green";
      else if (status === "upcoming") btn.style.backgroundColor = "blue";
      else btn.style.backgroundColor = "gray";

      btn.innerHTML = `<div>${s.date}</div><div>${s.startTime} - ${s.endTime}</div>`;
      btn.addEventListener("click", () => handleScheduleClick(s._id, s.date, s.startTime, s.endTime));
      container.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
  }
}

function handleScheduleClick(scheduleId, date, startTime, endTime) {
  const now = new Date();
  const status = getScheduleStatus(now, date, startTime, endTime);

  if (status === "upcoming") {
    alert("You can only mark attendance once the class has started.");
    return;
  }
  if (status === "expired") {
    alert("This class schedule has expired.");
    return;
  }

  selectedScheduleId = scheduleId;
  selectedClassDate = date;
  currentStartTime = startTime;
  currentEndTime = endTime;

  document.getElementById("currentDate").textContent = date;
  document.getElementById("attendanceSection").style.display = "block";
  loadStudents().then(() => {
    loadDraft();
    renderStudentTable();
  });
}

// -----------------------------
// Attendance History
// -----------------------------
function loadHistory() {
  fetch(`${API_BASE}/attendance/all?staffId=${staffId}`)
    .then(res => res.json())
    .then(dates => {
      const container = document.getElementById("historyContent");
      container.innerHTML = "";

      if (dates.length === 0) {
        container.innerHTML = "<p>No attendance history.</p>";
      } else {
        dates.forEach(date => {
          const div = document.createElement("div");
          div.innerHTML = `<strong>${date}</strong>`;
          div.style.cursor = "pointer";
          div.onclick = () => showSummary(date);
          container.appendChild(div);
        });
      }
    })
    .catch(err => console.error(err));
}

// ⭐ RANK ORDER ADDED
const RANK_ORDER = ["SUO", "UO", "CSM", "CQMS", "SGT", "CPL", "L/CPL", "CDT"];

// ⭐ NEW — FULL GROUPING (CLASS → YEAR → SD/SW)
function groupByClassFull(students) {
  const grouped = {};

  students.forEach(s => {
    const cls = s.classSection || "Unknown";

    let yearValue = parseInt(s.year);
    
    const year =
    yearValue === 3 ? "3rd Year" :
    yearValue === 2 ? "2nd Year" :
    yearValue === 1 ? "1st Year" :
    "Not Assigned";

    const gender = (s.gender || "").toLowerCase() === "male" ? "SD" : "SW";

    if (!grouped[cls]) grouped[cls] = {};
    if (!grouped[cls][year]) grouped[cls][year] = { SD: [], SW: [] };

    grouped[cls][year][gender].push({
      name: s.name,
      rank: s.rank || "CDT"
    });
  });

  return grouped;
}

// ⭐ NEW — FULL FORMATTED SUMMARY
function showSummary(date) {
  fetch(`${API_BASE}/attendance/present/${date}?staffId=${staffId}`)
    .then(res => res.json())
    .then(list => {

      const grouped = groupByClassFull(list);
      const summaryEl = document.getElementById("summarySection");
      summaryEl.innerHTML = `<div><strong>Date:</strong> ${date}</div><br>`;

      let overallBoys = 0;
      let overallGirls = 0;

      for (const cls of Object.keys(grouped)) {
        summaryEl.innerHTML += `<h3>*${cls}*</h3>`;

        const years = Object.keys(grouped[cls]).sort((a,b)=>{
          return parseInt(b) - parseInt(a); // 3rd → 2nd → 1st
        });

        let classSD = 0;
        let classSW = 0;

        for (const year of years) {
          summaryEl.innerHTML += `<strong>${year}</strong><br>`;

          const SD = grouped[cls][year].SD;
          const SW = grouped[cls][year].SW;

          // SORT BY RANK ORDER
          SD.sort((a,b)=> RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
          SW.sort((a,b)=> RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

          if (SD.length > 0) {
            summaryEl.innerHTML += `<u>SD</u><br>`;
            SD.forEach(s=>{
              summaryEl.innerHTML += `${s.rank} ${s.name}<br>`;
            });
          }

          if (SW.length > 0) {
            summaryEl.innerHTML += `<br><u>SW</u><br>`;
            SW.forEach(s=>{
              summaryEl.innerHTML += `${s.rank} ${s.name}<br>`;
            });
          }

          classSD += SD.length;
          classSW += SW.length;

          summaryEl.innerHTML += `<hr>`;
        }

        summaryEl.innerHTML += `
          <strong>${cls} - TOTAL ${classSD+classSW}</strong><br>
          SD: ${classSD}<br>
          SW: ${classSW}<br><br>
        `;

        overallBoys += classSD;
        overallGirls += classSW;
      }

      summaryEl.innerHTML += `
        <br><br>
        <strong>Overall Boys (SD):</strong> ${overallBoys}<br>
        <strong>Overall Girls (SW):</strong> ${overallGirls}<br>
        <strong>Overall Total:</strong> ${overallBoys + overallGirls}<br>
        <button onclick="backToHistory()">Back</button>
      `;

      document.getElementById("historyContent").style.display = "none";
      summaryEl.style.display = "block";
    });
}

function backToHistory() {
  document.getElementById("summarySection").style.display = "none";
  document.getElementById("historyContent").style.display = "block";
}

// -----------------------------
// Helpers
// -----------------------------
function isWithinSchedule(now, dateStr, start, end) {
  if (!dateStr || !start || !end) return false;
  const dateOnly = new Date(dateStr);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startTime = new Date(dateOnly);
  startTime.setHours(sh, sm, 0, 0);

  const endTime = new Date(dateOnly);
  endTime.setHours(eh, em, 0, 0);

  return now >= startTime && now <= endTime;
}

function getScheduleStatus(now, dateStr, start, end) {
  const dateOnly = new Date(dateStr);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startTime = new Date(dateOnly);
  startTime.setHours(sh, sm, 0, 0);

  const endTime = new Date(dateOnly);
  endTime.setHours(eh, em, 0, 0);

  if (now < startTime) return "upcoming";
  if (now >= startTime && now <= endTime) return "active";
  return "expired";
}
