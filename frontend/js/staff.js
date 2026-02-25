const API_BASE = "http://localhost:5000/api";
let logoutInProgress = false;

// -----------------------------
// Staff login/session check
// -----------------------------
const staffId = localStorage.getItem("staffId");
const staffName = localStorage.getItem("staffName");
const staffUsername = localStorage.getItem("staffUsername");
if (!staffId) {
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

let completedScheduleIds = new Set();

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
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/staff/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId })
  });

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

  const presentIds = new Set(presentStudents.map(s => s._id));

  const presentRows = filtered.filter(s => presentIds.has(s._id));
  const absentRows = filtered.filter(s => !presentIds.has(s._id));

  studentTableBody.innerHTML = "";

  const now = new Date();
  const withinSchedule = isWithinSchedule(
    now,
    selectedClassDate,
    currentStartTime,
    currentEndTime
  );

  // 🔵 PRESENT SECTION
  if (presentRows.length > 0) {
    const header = document.createElement("tr");
    header.innerHTML = `<td colspan="5" style="background:#e6ffe6;font-weight:bold">PRESENT</td>`;
    studentTableBody.appendChild(header);
  }

  presentRows.forEach(s => appendRow(s, true, withinSchedule));

  // 🔴 ABSENT SECTION
  if (absentRows.length > 0) {
    const header = document.createElement("tr");
    header.innerHTML = `<td colspan="5" style="background:#ffe6e6;font-weight:bold">ABSENT</td>`;
    studentTableBody.appendChild(header);
  }

  absentRows.forEach(s => appendRow(s, false, withinSchedule));

  renderAttendanceCounts();
}

// -----------------------------
//HELPER FUNCTION
// -----------------------------
function appendRow(student, isPresent, withinSchedule) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${student.rank || "-"}</td>
    <td>${student.name}</td>
    <td>${student.regNo || "-"}</td>
    <td>${student.rollNo || "-"}</td>
    <td>
      <label class="switch">
        <input type="checkbox"
          data-id="${student._id}"
          ${isPresent ? "checked" : ""}
          ${withinSchedule ? "" : "disabled"}>
        <span class="slider"></span>
      </label>
    </td>
  `;

  row.querySelector("input").addEventListener("change", e => {
    const id = e.target.dataset.id;

    if (e.target.checked) {
      addToPresent(id);
    } else {
      const student = students.find(s => s._id === id);
      if (!confirm(`Mark ${student.name} as ABSENT?`)) {
        e.target.checked = true;
        return;
      }
      removeFromPresent(id);
    }

    saveDraft();
  });

  studentTableBody.appendChild(row);
}

// -----------------------------
// Add / Remove Present
// -----------------------------
function addToPresent(id) {
  const student = students.find(s => s._id === id);
  if (!student) return;

  if (!presentStudents.find(s => s._id === id)) {
    presentStudents.push(student);
  }

  renderStudentTable();
}

function removeFromPresent(id) {
  const student = students.find(s => s._id === id);
  if (!student) return;

  presentStudents = presentStudents.filter(s => s._id !== id);
  renderStudentTable();
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
  renderStudentTable();
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
  const pinEl = document.getElementById("confirmPin");
  const dateEl = document.getElementById("currentDate");

  if (!pinEl || !dateEl) return;

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

    // clear draft
    const draftKey = `attendanceDraft_${staffId}_${selectedClassDate}`;
    localStorage.removeItem(draftKey);

    presentStudents = [];
    document.getElementById("attendanceSection").style.display = "none";
    closeModal();
    renderStudentTable();

    await loadSchedules(); // ✅ reload with GOLD

  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to submit attendance.");
  }
});

// -----------------------------
// Load Schedules
// -----------------------------
async function loadSchedules() {
  try {
    const container = document.getElementById("scheduleContainer");
    container.innerHTML = "";

    const pendingRes = await fetch(`${API_BASE}/attendance/schedule?staffId=${staffId}`);
    const pending = await pendingRes.json();

    const historyRes = await fetch(`${API_BASE}/attendance/all?staffId=${staffId}`);
    const history = await historyRes.json();

    // ✅ BUILD COMPLETED SET
    completedScheduleIds = new Set(
      Array.isArray(history)
        ? history.map(h => String(h.scheduleId)).filter(Boolean)
        : []
    );

    // ACTIVE (GREEN / BLUE)
    if (Array.isArray(pending)) {
      pending.forEach(s => {
        if (completedScheduleIds.has(String(s._id))) return;

        const btn = document.createElement("button");
        btn.className = "schedule-btn";

        const status = getScheduleStatus(new Date(), s.date, s.startTime, s.endTime);
        btn.style.backgroundColor =
          status === "active" ? "green" :
          status === "upcoming" ? "blue" : "gray";

        btn.innerHTML = `
          <div>${s.date}</div>
          <div>${s.startTime} - ${s.endTime}</div>
        `;

        btn.onclick = () =>
          handleScheduleClick(s._id, s.date, s.startTime, s.endTime);

        container.appendChild(btn);
      });
    }

    // COMPLETED (GOLD)
    if (Array.isArray(history)) {
      history.forEach(h => {
        if (!h.scheduleId) return;

        const btn = document.createElement("button");
        btn.className = "schedule-btn";
        btn.style.backgroundColor = "gold";

        btn.innerHTML = `
          <div>${h.date}</div>
          <div>COMPLETED</div>
        `;

        btn.onclick = () => showSummary(h.date, h.scheduleId);
        container.appendChild(btn);
      });
    }

    if (
      (!pending || pending.length === 0) &&
      (!history || history.length === 0)
    ) {
      container.innerHTML = "<p>No classes scheduled.</p>";
    }

  } catch (err) {
    console.error("Failed to load schedules:", err);
  }
}


function handleScheduleClick(scheduleId, date, startTime, endTime) {
  if (document.getElementById("attendanceSection").style.display === "block") {
    return;
  }

  fetch(`${API_BASE}/attendance/schedule?staffId=${staffId}`)
    .then(res => res.json())
    .then(list => {
      const stillExists = Array.isArray(list)
        ? list.find(s => s._id === scheduleId)
        : null;

      if (!stillExists) {
        alert("Attendance already completed. Viewing history only.");
        showSummary(date, scheduleId);
        return;
      }

      const status = getScheduleStatus(new Date(), date, startTime, endTime);
      if (status !== "active") {
        alert("Attendance not available.");
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
    });
}
  
// -----------------------------
// Attendance History
// -----------------------------
function loadHistory() {
  fetch(`${API_BASE}/attendance/all?staffId=${staffId}`)
    .then(res => res.json())
    .then(list => {
      const container = document.getElementById("historyContent");
      container.innerHTML = "";

      if (list.length === 0) {
        container.innerHTML = "<p>No attendance history.</p>";
        return;
      }

      list.forEach(item => {
        const div = document.createElement("div");
        const dateLabel =
        item.date && item.date !== "Unknown Date"
        ? item.date
        : (item.scheduleId?.date || "Unknown Date");
        
        const st = item.startTime || item.scheduleId?.startTime || "N/A";
        const et = item.endTime || item.scheduleId?.endTime || "N/A";

        div.innerHTML = `
        <strong>${dateLabel}</strong>
        (${st} - ${et})
        `;

        div.style.cursor = "pointer";

        div.onclick = () => {
          const sid = item.scheduleId || null;
          showSummary(item.date, sid);
        };

        container.appendChild(div);
      });
    })
    .catch(err => console.error(err));
}


// ⭐ RANK ORDER ADDED
const RANK_ORDER = ["SUO", "UO", "CSM", "CQMS", "SGT", "CPL", "L/CPL", "CDT"];

// ⭐ NEW — FULL GROUPING (CLASS → YEAR → SD/SW)
function groupByClassFull(students) {
  if (!Array.isArray(students)) return {};
  
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
function showSummary(date, scheduleId) {
  fetch(`${API_BASE}/attendance/present/${date}?staffId=${staffId}&scheduleId=${scheduleId}`)
    .then(res => res.json())
    .then(list => {
      if (!Array.isArray(list)) {
        alert("No attendance data available for this date.");
        return;
      }
      
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

loadSchedules();