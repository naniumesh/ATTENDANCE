const API_BASE = "https://attendance-jmxr.onrender.com/api";

// Show/hide sections
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach((sec) => {
    sec.style.display = "none";
  });
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = "block";
  }
}

/* ------------------------------------------
    STAFF SECTION
------------------------------------------ */

document.querySelector("button[onclick=\"showSection('staffSection')\"]")?.addEventListener("click", fetchStaff);

// Handle Add Staff form submit
document.getElementById("staffForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert("Staff added successfully!");
      e.target.reset();
      fetchStaff();
    } else {
      const result = await res.json();
      alert(result.message || "Failed to add staff.");
    }
  } catch (err) {
    console.error("Add staff error:", err);
    alert("Error adding staff.");
  }
});

// Fetch and display staff list
async function fetchStaff() {
  try {
    const res = await fetch(`${API_BASE}/staff`);
    const staffList = await res.json();
    const tbody = document.querySelector("#staffTable tbody");
    tbody.innerHTML = "";

    staffList.forEach(staff => {
      const row = document.createElement("tr");
      row.setAttribute("data-id", staff._id);
      row.setAttribute("data-access", staff.hasAccess);
      row.setAttribute("data-pin", staff.pin || "");

      row.innerHTML = `
        <td>${staff.name}</td>
        <td>${staff.username}</td>
        <td>${staff.regNo}</td>
        <td>${staff.pin ? "****" : ""}</td>
        <td>
          <button onclick="editStaff('${staff._id}')">Edit</button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to fetch staff:", err);
    alert("Could not load staff list.");
  }
}

// Enable editing of a staff row
async function editStaff(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const cells = row.querySelectorAll("td");
  const [name, username, regNo] = [...cells].slice(0, 3).map(td => td.textContent);
  const pin = row.getAttribute("data-pin") || "";

  row.innerHTML = `
    <td><input type="text" value="${name}" placeholder="Name"></td>
    <td><input type="text" value="${username}" placeholder="Username"></td>
    <td><input type="text" value="${regNo}" placeholder="Reg No"></td>
    <td>
      <input type="password" value="${pin}" placeholder="PIN" style="width:80px">
      <button onclick="updateStaff('${id}', this)">Update</button>
      <button onclick="deleteStaff('${id}')">Delete</button>
    </td>
  `;
}

// Update a staff record
async function updateStaff(id, btn) {
  const row = btn.closest("tr");
  const inputs = row.querySelectorAll("input");

  const data = {
    name: inputs[0].value,
    username: inputs[1].value,
    regNo: inputs[2].value,
    pin: inputs[3].value,
  };

  try {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert("Staff updated.");
      fetchStaff();
    } else {
      const result = await res.json();
      alert(result.message || "Failed to update staff.");
    }
  } catch (err) {
    alert("Error updating staff.");
    console.error(err);
  }
}

// Delete a staff record
async function deleteStaff(id) {
  if (!confirm("Are you sure you want to delete this staff member?")) return;

  try {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: "DELETE"
    });
    const result = await res.json();
    if (res.ok) {
      alert("Staff deleted.");
      fetchStaff();
    } else {
      alert(result.message || "Failed to delete staff.");
    }
  } catch (err) {
    alert("Error deleting staff.");
    console.error(err);
  }
}


/* ------------------------------------------
    STUDENT SECTION
------------------------------------------ */

let selectedClass = null;
let selectedYear = null;

// Show student section and fetch all students
document.querySelector("button[onclick=\"showSection('studentSection')\"]")?.addEventListener("click", () => fetchStudents());

// Student form submission
document.getElementById("studentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  try {
    const res = await fetch(`${API_BASE}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert("Student added.");
      form.reset();
      fetchStudents(selectedClass, selectedYear);
    } else {
      const result = await res.json();
      alert(result.message || "Failed to add student.");
    }
  } catch (err) {
    alert("Server error.");
    console.error(err);
  }
});

// Excel Upload
async function uploadExcel() {
  const file = document.getElementById("excelFile").files[0];
  if (!file) {
    alert("Please select an Excel file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/students/upload-excel`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      alert("Excel uploaded successfully.");
      fetchStudents(selectedClass, selectedYear);
    } else {
      const result = await res.json();
      alert(result.error || "Failed to upload Excel.");
    }
  } catch (err) {
    alert("Server error.");
    console.error(err);
  }
}

// Search input
document.getElementById("studentSearch")?.addEventListener("input", () => {
  fetchStudents(selectedClass, selectedYear);
});

// ---------------------------
// CLASS BUTTONS & YEAR FILTER
// ---------------------------
document.querySelectorAll(".class-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedClass = btn.getAttribute("data-class");
    selectedYear = null; // reset year when new class selected
    renderYearFilter();
    fetchStudents(selectedClass, selectedYear);
    highlightActiveClass(btn);
  });
});

// Reset filter button
document.getElementById("resetFilter")?.addEventListener("click", () => {
  selectedClass = null;
  selectedYear = null;
  removeYearFilter();
  fetchStudents();
  removeClassHighlight();
});

// Render year dropdown dynamically
function renderYearFilter() {
  removeYearFilter(); // remove old dropdown if exists
  const container = document.querySelector(".student-search-block");
  const yearSelect = document.createElement("select");
  yearSelect.id = "studentYearFilter";
  yearSelect.style.marginLeft = "10px";
  yearSelect.innerHTML = `
    <option value="">All Years</option>
    <option value="1">1st Year</option>
    <option value="2">2nd Year</option>
    <option value="3">3rd Year</option>
  `;
  yearSelect.addEventListener("change", (e) => {
    selectedYear = e.target.value || null;
    fetchStudents(selectedClass, selectedYear);
  });
  container.appendChild(yearSelect);
}

// Remove year filter dropdown
function removeYearFilter() {
  const old = document.getElementById("studentYearFilter");
  if (old) old.remove();
}

// Highlight active class button
function highlightActiveClass(activeBtn) {
  document.querySelectorAll(".class-btn").forEach(btn => btn.classList.remove("active-class"));
  activeBtn.classList.add("active-class");
}

// Remove class highlight
function removeClassHighlight() {
  document.querySelectorAll(".class-btn").forEach(btn => btn.classList.remove("active-class"));
}

// ---------------------------
// FETCH STUDENTS FUNCTION
// ---------------------------
async function fetchStudents(classFilter = null, yearFilter = null) {
  const search = document.getElementById("studentSearch")?.value.trim();
  let url = `${API_BASE}/students`;
  const params = [];

  if (search) params.push(`search=${encodeURIComponent(search)}`);
  if (classFilter) params.push(`classSection=${encodeURIComponent(classFilter)}`);
  if (yearFilter) params.push(`year=${encodeURIComponent(yearFilter)}`);

  if (params.length) url += "?" + params.join("&");

  try {
    const res = await fetch(url);
    const result = await res.json();
    const students = result.students;
    const counts = result.counts;

    // Display counts
    document.getElementById("studentCounts").innerHTML = `
      <strong>Year 1:</strong><br>
      Total Boys: ${counts.year1.boys} | Total Girls: ${counts.year1.girls} | Total: ${counts.year1.total}<br><br>
      <strong>Year 2:</strong><br>
      Total Boys: ${counts.year2.boys} | Total Girls: ${counts.year2.girls} | Total: ${counts.year2.total}<br><br>
      <strong>Year 3:</strong><br>
      Total Boys: ${counts.year3.boys} | Total Girls: ${counts.year3.girls} | Total: ${counts.year3.total}<br><br>
      <strong>Total:</strong><br>
      Boys: ${counts.total.boys} | Girls: ${counts.total.girls} | Total: ${counts.total.total}
    `;

    // Render table
    const tbody = document.querySelector("#studentTable tbody");
    tbody.innerHTML = "";
    students.forEach(stu => {
      const row = document.createElement("tr");
      row.setAttribute("data-id", stu._id);
      row.innerHTML = `
        <td>${stu.name}</td>
        <td>${stu.rank}</td>
        <td>${stu.rollNo}</td>
        <td>${stu.regNo}</td>
        <td>${stu.dob ? new Date(stu.dob).toLocaleDateString() : ""}</td>
        <td>${stu.contactNo || ""}</td>
        <td>${stu.gender}</td>
        <td>${stu.year}</td>
        <td>${stu.classSection?.toUpperCase()}</td>
        <td>
          <button onclick="editStudent('${stu._id}')">Edit</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    alert("Error fetching students.");
    console.error(err);
  }
}

// Edit, Update, Delete functions remain unchanged
async function editStudent(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const cells = row.querySelectorAll("td");
  const [name, rank, rollNo, regNo, dob, contactNo, gender, year, classSection] =
    [...cells].slice(0, 9).map(td => td.textContent.trim());

  row.innerHTML = `
    <td><input value="${name}"></td>
    <td>
      <select>
        <option value="CDT" ${rank === "CDT" ? "selected" : ""}>CDT</option>
        <option value="L/CPL" ${rank === "L/CPL" ? "selected" : ""}>L/CPL</option>
        <option value="CPL" ${rank === "CPL" ? "selected" : ""}>CPL</option>
        <option value="SGT" ${rank === "SGT" ? "selected" : ""}>SGT</option>
        <option value="CQMS" ${rank === "CQMS" ? "selected" : ""}>CQMS</option>
        <option value="CSM" ${rank === "CSM" ? "selected" : ""}>CSM</option>
        <option value="UO" ${rank === "UO" ? "selected" : ""}>UO</option>
        <option value="SUO" ${rank === "SUO" ? "selected" : ""}>SUO</option>
      </select>
    </td>
    <td><input value="${rollNo}"></td>
    <td><input value="${regNo}"></td>
    <td><input type="date" value="${
      dob && !isNaN(Date.parse(dob)) ? new Date(dob).toISOString().split("T")[0] : ""
    }"></td>

    <td><input value="${contactNo}"></td>
    <td>
      <select>
        <option value="male" ${gender === "male" ? "selected" : ""}>Male</option>
        <option value="female" ${gender === "female" ? "selected" : ""}>Female</option>
      </select>
    </td>
    <td>
      <select>
        <option value="1" ${year === "1" ? "selected" : ""}>1st Year</option>
        <option value="2" ${year === "2" ? "selected" : ""}>2nd Year</option>
        <option value="3" ${year === "3" ? "selected" : ""}>3rd Year</option>
      </select>
    </td>
    <td>
      <select>
        <option value="2 PB" ${classSection === "2 PB" ? "selected" : ""}>2 PB</option>
        <option value="2 PB(GIRLS)" ${classSection === "2 PB(GIRLS)" ? "selected" : ""}>2 PB(GIRLS)</option>
        <option value="8 PB(REGULAR)" ${classSection === "8 PB(REGULAR)" ? "selected" : ""}>8 PB(REGULAR)</option>
        <option value="8 PB(FSFS)" ${classSection === "8 PB(FSFS)" ? "selected" : ""}>8 PB(FSFS)</option>
        <option value="1 AIR PB" ${classSection === "1 AIR PB" ? "selected" : ""}>1 AIR PB</option>
      </select>
    </td>
    <td>
      <button onclick="updateStudent('${id}', this)">Update</button>
      <button onclick="deleteStudent('${id}')">Delete</button>
      <button onclick="fetchStudents()">Cancel</button>
    </td>
  `;
}

async function updateStudent(id, btn) {
  const row = btn.closest("tr");
  const inputs = row.querySelectorAll("input, select");

  const data = {
    name: inputs[0].value,
    rank: inputs[1].value,
    rollNo: inputs[2].value,
    regNo: inputs[3].value || "NA",
    dob: inputs[4].value,
    contactNo: inputs[5].value,
    gender: inputs[6].value,
    year: inputs[7].value,
    classSection: inputs[8].value,
  };

  try {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert("Student updated.");
      fetchStudents();
    } else {
      alert("Failed to update student.");
    }
  } catch (err) {
    alert("Error updating student.");
    console.error(err);
  }
}
// Delete student
window.deleteStudent = async function(id) {
  if (!confirm("Delete this student?")) return;

  try {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: "DELETE"
    });

    if (res.ok) {
      alert("Student deleted.");
      fetchStudents();
    } else {
      alert("Failed to delete.");
    }
  } catch (err) {
    alert("Error deleting student.");
    console.error(err);
  }
};



/* ------------------------------------------
    CLASS SCHEDULE SECTION
------------------------------------------ */

// Load schedules when opening schedule section
document.querySelector("button[onclick=\"showSection('scheduleSection')\"]")
  ?.addEventListener("click", fetchSchedules);

// Add schedule form
document.getElementById("scheduleForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (res.ok) {
      alert("Schedule added successfully!");
      e.target.reset();
      fetchSchedules();
    } else {
      alert(result.message || "Failed to add schedule.");
    }
  } catch (err) {
    console.error("Error adding schedule:", err);
    alert("Server error.");
  }
});

// Fetch all schedules (multiple per day allowed)
async function fetchSchedules() {
  try {
    const scheduleRes = await fetch(`${API_BASE}/schedule`);
    const result = await scheduleRes.json(); // { serverTime, schedules: [...] }
    const schedules = result.schedules || [];

    const tbody = document.querySelector("#scheduleTable tbody");
    tbody.innerHTML = "";

    if (!Array.isArray(schedules) || schedules.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No upcoming classes scheduled</td></tr>";
      return;
    }

    // Sort by date & start time
    schedules.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    schedules.forEach(sch => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${sch.date}</td>
        <td>${sch.startTime}</td>
        <td>${sch.endTime}</td>
        <td>
          <button onclick="deleteSchedule('${sch._id}')"
            style="background:red;color:white;padding:4px 8px;border:none;cursor:pointer;">
            Cancel
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("Fetch schedule failed:", err);
    alert("Failed to load schedules.");
  }
}

// Delete schedule
async function deleteSchedule(id) {
  const pin = prompt("Enter admin PIN to cancel this class:");
  if (!pin) return alert("PIN is required to cancel the class.");
  if (pin !== "1948") return alert("Invalid PIN. Cancellation denied.");

  if (!confirm("Are you sure you want to cancel this scheduled class?")) return;

  try {
    const res = await fetch(`${API_BASE}/schedule/${id}`, {
      method: "DELETE"
    });

    const result = await res.json();
    if (res.ok) {
      alert(result.message || "Class cancelled successfully.");
      fetchSchedules();
      fetchClassHistory(); // Refresh history view if open
    } else {
      alert(result.message || "Failed to cancel class.");
    }
  } catch (err) {
    console.error("Delete schedule error:", err);
    alert("Server error while cancelling class.");
  }
}

/* ------------------------------------------
    CLASS HISTORY SECTION
------------------------------------------ */
document.getElementById("viewHistoryBtn")?.addEventListener("click", async () => {
  await fetchClassHistory();
  document.getElementById("historyModal").style.display = "block";
});

document.querySelector(".history-close-btn")?.addEventListener("click", () => {
  document.getElementById("historyModal").style.display = "none";
});

window.onclick = (event) => {
  if (event.target.id === "historyModal") {
    document.getElementById("historyModal").style.display = "none";
  }
};

async function fetchClassHistory() {
  try {
    const res = await fetch(`${API_BASE}/schedule/history`);
    const result = await res.json();
    const history = result.history || result; // support both {history: []} and [] formats

    const container = document.getElementById("historyContainer");
    if (!Array.isArray(history) || history.length === 0) {
      container.innerHTML = "<p>No class history available.</p>";
      return;
    }

    // Sort latest first
    history.sort((a, b) => new Date(b.classDate || b.date) - new Date(a.classDate || a.date));

    container.innerHTML = `
      <table border="1" style="width:100%;margin-top:10px;border-collapse:collapse;">
        <thead style="background:#f0f0f0;">
          <tr>
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th>Present Count</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${history.map(h => {
            const bgColor = h.attendanceTaken ? "#d4edda" : "#f8d7da";
            const statusText = h.attendanceTaken
              ? `Taken (${h.totalPresent || 0} Present)`
              : "Not Taken";

            return `
              <tr style="background-color: ${bgColor};">
                <td>${h.classDate || h.date || "N/A"}</td>
                <td>${h.startTime || "N/A"}</td>
                <td>${h.endTime || "N/A"}</td>
                <td>${h.attendanceTaken ? (h.totalPresent ?? "-") : "-"}</td>
                <td><strong>${statusText}</strong></td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    alert("Failed to load class history.");
    console.error("Class history error:", err);
  }
}


/* -----------------------------------------
    ATTENDANCE SECTION
------------------------------------------ */
document.querySelector("button[onclick=\"showSection('attendanceSection')\"]")?.addEventListener("click", loadAttendance);
document.getElementById("attendanceClassFilter")?.addEventListener("change", loadAttendance);
document.getElementById("presentDateFilter")?.addEventListener("change", filterPresentByDate);

async function loadAttendance() {
  const classSection = document.getElementById("attendanceClassFilter")?.value || "all";

  try {
    const res = await fetch(`${API_BASE}/attendance?classSection=${classSection}`);
    const data = await res.json();

    if (!res.ok || !data) throw new Error(data.message || "Fetch failed");

    const tbody = document.querySelector("#attendanceTable tbody");
    tbody.innerHTML = "";

    const { records, allDates, scheduleDates } = data;
    window.scheduleDates = scheduleDates;

    const presentFilter = document.getElementById("presentDateFilter");
    presentFilter.innerHTML = `<option value="">-- Select Date --</option>` +
      (scheduleDates || []).map(date => `<option value="${date}">${date}</option>`).join("");

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">No records found</td></tr>`;
      return;
    }

    records.forEach(rec => {
      const stu = rec.student;
      let presentCount = 0;
      const totalClasses = allDates.length;

      const historyHtml = allDates.map(date => {
        const record = rec.history.find(h => h.classDate === date);
        const status = record ? record.status : "Absent";
        const color = status === "Present" ? "#28a745" : "#dc3545";
        if (status === "Present") presentCount++;
        return `<div>${date}: <strong style="color:${color}">${status}</strong></div>`;
      }).join("");

      const countSummary = `<div style="margin-top:5px;font-weight:bold;">Present: ${presentCount}/${totalClasses}</div>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${stu.name}</td>
        <td>${stu.rollNo}</td>
        <td>${stu.regNo}</td>
        <td>${(stu.classSection || "").toUpperCase()}</td>
        <td>${rec.percentage}%</td>
        <td>${historyHtml}${countSummary}</td>
        <td><button onclick="updateAttendancePrompt('${stu._id}')">Update</button></td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("Attendance load error:", err);
    alert("Server Error: Failed to load attendance data.");
  }
}

async function updateAttendancePrompt(studentId) {
  if (!window.scheduleDates || window.scheduleDates.length === 0) {
    alert("No scheduled class dates.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;justify-content:center;align-items:center";

  const box = document.createElement("div");
  box.style = "background:white;padding:20px;border-radius:8px;text-align:center;min-width:300px";
  box.innerHTML = `
    <h3>Update Attendance</h3>
    <label>Date:</label>
    <select id="classDateSelect">
      ${window.scheduleDates.map(d => `<option value="${d}">${d}</option>`).join("")}
    </select><br><br>
    <label>Status:</label>
    <select id="statusSelect">
      <option value="">--Select--</option>
      <option value="Present">Present</option>
      <option value="Absent">Absent</option>
    </select><br><br>
    <input type="password" id="pinInput" placeholder="Enter PIN"><br><br>
    <button id="submitBtn">Submit</button>
    <button onclick="document.body.removeChild(this.parentElement.parentElement)">Cancel</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("submitBtn").onclick = async () => {
    const classDate = document.getElementById("classDateSelect").value;
    const status = document.getElementById("statusSelect").value;
    const pin = document.getElementById("pinInput").value;

    if (!status || !pin) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/attendance/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classDate,
          scheduleId,
          status,
          pin
        })
      });

      const result = await res.json();
      alert(result.message);
      document.body.removeChild(overlay);
      loadAttendance();
    } catch (err) {
      alert("Error updating attendance.");
      console.error(err);
    }
  };
}

async function filterPresentByDate() {
  const selectedDate = document.getElementById("presentDateFilter")?.value;
  const presentCountSpan = document.getElementById("presentCount");
  const tbody = document.querySelector("#attendanceTable tbody");

  if (!selectedDate) {
    presentCountSpan.textContent = "";
    return loadAttendance();
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/present/${selectedDate}`);
    const presentList = await res.json();

    tbody.innerHTML = "";

    if (!presentList || presentList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">No students present on ${selectedDate}</td></tr>`;
      presentCountSpan.textContent = "";
    } else {
      presentList.forEach(stu => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stu.name}</td>
          <td>${stu.rollNo}</td>
          <td>${stu.regNo}</td>
          <td>${(stu.classSection || "").toUpperCase()}</td>
          <td>N/A</td>
          <td><div><strong style="color:#28a745">${selectedDate}: Present</strong></div></td>
          <td>-</td>
        `;
        tbody.appendChild(row);
      });

      const totalBoys = presentList.filter(s => s.gender?.toLowerCase() === "male").length;
      const totalGirls = presentList.filter(s => s.gender?.toLowerCase() === "female").length;

      presentCountSpan.innerHTML = `
        Total Boys: <strong>${totalBoys}</strong> | 
        Total Girls: <strong>${totalGirls}</strong> | 
        Overall Total: <strong>${presentList.length}</strong>
      `;
    }
  } catch (err) {
    console.error("Error filtering by date:", err);
    alert("Failed to load present list.");
  }
}



//login data
document.addEventListener("DOMContentLoaded", () => {
  // Check if admin is logged in
  const isLoggedIn = sessionStorage.getItem("isAdminLoggedIn");
  if (!isLoggedIn) {
    window.location.href = "login.html";
    return;
  }

  // Handle logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("isAdminLoggedIn");
      window.location.href = "login.html";
    });
  }
});

// ====== Add near the top of staff.js (globals area) ======
const RANK_ORDER = ["SUO", "UO", "CSM", "CQMS", "SGT", "CPL", "L/CPL", "CDT"];

// normalize helper: uppercase, remove extra dots, trim
function normalizeRankText(txt) {
  if (!txt && txt !== 0) return "";
  return String(txt).toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

// precomputed normalized order for fast lookup
const RANK_ORDER_NORMALIZED = RANK_ORDER.map(r => normalizeRankText(r));

// robust getter for rank value (handles different property names & nested objects)
function getRankValue(student) {
  if (!student || typeof student !== "object") return "";

  // Try common keys
  if (student.rank) {
    if (typeof student.rank === "string") return student.rank;
    if (typeof student.rank === "object") {
      return student.rank.name || student.rank.title || student.rank.label || "";
    }
  }
  if (student.rankName) return student.rankName;
  if (student.designation) {
    if (typeof student.designation === "string") return student.designation;
    if (typeof student.designation === "object") {
      return student.designation.name || student.designation.title || student.designation.label || "";
    }
  }
  if (student.post) return student.post;
  if (student.position) return student.position;

  // Fallback: log missing rank so we can catch it
  console.warn("Rank missing for student:", student);
  return "";
}


// friendly year label helper
function getYearLabel(y) {
  const ys = String(y);
  if (ys === "1") return "1st Year";
  if (ys === "2") return "2nd Year";
  if (ys === "3") return "3rd Year";
  return ys ? `${ys} Year` : "";
}

// ====== Replace your existing showSummary(date) with this function ======
function showSummary(date) {
  fetch(`${API_BASE}/attendance/present/${date}?staffId=${staffId}`)
    .then(res => res.json())
    .then(records => {
      const summaryEl = document.getElementById("summarySection");
      if (!records || records.length === 0) {
        summaryEl.innerHTML = "<p>No records found for this date.</p>";
        return;
      }

      let msg = "";
      // full date friendly string
      const fullDate = new Date(date).toDateString();
      msg += `Jai Hind Everyone,<br>Attendance of today's fallin i.e. ${fullDate}<br><br>`;

      // Group by classSection
      const classes = {};
      records.forEach(r => {
        const cls = r.classSection || "Unknown Class";
        if (!classes[cls]) classes[cls] = [];
        classes[cls].push(r);
      });

      let grandTotalBoys = 0;
      let grandTotalGirls = 0;

      Object.entries(classes).forEach(([className, students]) => {
        msg += `<strong>${className}</strong><br>`;

        // group by year inside this class
        const byYear = {};
        students.forEach(s => {
          const yearKey = s.year !== undefined && s.year !== null ? String(s.year) : "unknown";
          if (!byYear[yearKey]) byYear[yearKey] = [];
          byYear[yearKey].push(s);
        });

        let classBoys = 0;
        let classGirls = 0;

        // Sort years descending (3 -> 2 -> 1 -> unknown last)
        Object.entries(byYear)
          .sort((a, b) => {
            // put "unknown" last
            if (a[0] === "unknown") return 1;
            if (b[0] === "unknown") return -1;
            return Number(b[0]) - Number(a[0]);
          })
          .forEach(([year, studs]) => {
            const yearLabel = getYearLabel(year);
            if (yearLabel) msg += `${yearLabel}<br>`;

            // If 3rd year, sort by RANK_ORDER; else leave as-is
            if (String(year) === "3") {
              studs.sort((A, B) => {
                const ra = normalizeRankText(getRankValue(A));
                const rb = normalizeRankText(getRankValue(B));
                const ia = RANK_ORDER_NORMALIZED.indexOf(ra);
                const ib = RANK_ORDER_NORMALIZED.indexOf(rb);
                const va = ia === -1 ? 999 : ia;
                const vb = ib === -1 ? 999 : ib;
                return va - vb;
              });
            }

            // Print each student with rank (robust)
            studs.forEach(s => {
              const rankRaw = getRankValue(s);
              const rankDisplay = rankRaw ? rankRaw : "-";
              const nameDisplay = s.name || (s.fullName || "") || "-";
              msg += `${rankDisplay} ${nameDisplay}<br>`;
              if ((s.gender || "").toLowerCase() === "male") classBoys++;
              else classGirls++;
            });
          });

        // class totals
        msg += `<br><em>${className} Totals:</em><br>`;
        msg += `Boys: ${classBoys}<br>`;
        msg += `Girls: ${classGirls}<br>`;
        msg += `Overall: ${classBoys + classGirls}<br><br>`;

        grandTotalBoys += classBoys;
        grandTotalGirls += classGirls;
      });

      // final totals
      msg += `<strong>Final Totals:</strong><br>`;
      msg += `Boys: ${grandTotalBoys}<br>`;
      msg += `Girls: ${grandTotalGirls}<br>`;
      msg += `Overall: ${grandTotalBoys + grandTotalGirls}`;

      summaryEl.innerHTML = msg;
      summaryEl.style.display = "block";
    })
    .catch(err => {
      console.error("showSummary error:", err);
    });
}
