// ================== FIREBASE AUTH SETUP ================== //
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAFSdfPdf9URpjH-SgfX5xccgTIpXWIjj4",
  authDomain: "glowrun-sales.firebaseapp.com",
  projectId: "glowrun-sales",
  storageBucket: "glowrun-sales.appspot.com",
  messagingSenderId: "295519366546",
  appId: "1:295519366546:web:592af0e701eed3e828e54b",
  measurementId: "G-YER90NZLVD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Allowed emails
const allowedEmails = [
  "azroekiel.julaton@lorma.edu",
  "francinemyra.altis@lorma.edu",
  "voke.oghenekaro@lorma.edu",
  "kier-voncarlo.garcia@lorma.edu",
  "princecyrusjhoriel.tadina@lorma.edu",
  "fredrichyvan.jacla@lorma.edu",
  "jasperace.lapitan@lorma.edu",
  "jeanneariel.garcia@lorma.edu"
];

// ✅ Handle login state + profile
document.addEventListener("DOMContentLoaded", () => {
  const userNameEl = document.getElementById("userName");
  const userPhotoEl = document.getElementById("userPhoto");
  const logoutBtn = document.getElementById("logoutBtn");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!allowedEmails.includes(user.email)) {
        alert("Unauthorized account. Only specific emails can log in.");
        signOut(auth);
        return;
      }
      if (userNameEl) userNameEl.textContent = user.displayName || user.email;
      if (user.photoURL && userPhotoEl) userPhotoEl.src = user.photoURL;
      loadEntries(); // ⬅ load from Firestore once logged in
    } else {
      window.location.href = "index.html";
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "index.html";
      } catch (err) {
        console.error("Logout error:", err.message);
      }
    });
  }
});

// ================== DASHBOARD ================== //
const UNIT_PRICE = 800;
const studentForm = document.getElementById("studentForm");
const studentTable = document.getElementById("studentTable").getElementsByTagName("tbody")[0];
const grandTotalEl = document.getElementById("grandTotal");
const searchInput = document.getElementById("searchInput");
const filterDepartment = document.getElementById("filterDepartment");
const noDataMessage = document.getElementById("noDataMessage");

let entries = []; // synced with Firestore
let editingId = null;
const editModal = new bootstrap.Modal(document.getElementById("editModal"));
const editForm = document.getElementById("editForm");

// Duplicate modal
const duplicateModal = new bootstrap.Modal(document.getElementById("duplicateModal"));

// 🔹 Load all entries from Firestore
async function loadEntries() {
  const querySnapshot = await getDocs(collection(db, "entries"));
  entries = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTable();
}

// 🔹 Add Entry
studentForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const schoolIdVal = document.getElementById("schoolId").value.trim();

  // ✅ Check for duplicates before saving
  const dup = entries.find((e) => e.schoolId === schoolIdVal);
  if (dup) {
    duplicateModal.show();
    return;
  }

  const entry = {
    schoolId: schoolIdVal,
    name: document.getElementById("name").value,
    lastname: document.getElementById("lastname").value,
    yrlvl: document.getElementById("yrlvl").value,
    department: document.getElementById("department").value,
    quantity: parseInt(document.getElementById("quantity").value),
  };

  await addDoc(collection(db, "entries"), entry);
  await loadEntries();
  studentForm.reset();
});

// 🔹 Render Table
function renderTable() {
  studentTable.innerHTML = "";
  const searchVal = searchInput.value.toLowerCase();
  const deptVal = filterDepartment.value;

  let filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.schoolId.toLowerCase().includes(searchVal) ||
      entry.name.toLowerCase().includes(searchVal) ||
      entry.lastname.toLowerCase().includes(searchVal);

    const matchesDept = deptVal === "" || entry.department === deptVal;
    return matchesSearch && matchesDept;
  });

  let grandTotal = 0;

  if (filteredEntries.length === 0 && searchVal !== "") {
    studentTable.innerHTML = `
      <tr>
        <td colspan="9" class="text-danger fw-bold text-center">
          ${searchVal} not found
        </td>
      </tr>
    `;
    grandTotalEl.closest("tr").style.display = "table-row";
    grandTotalEl.textContent = "0";
    noDataMessage.classList.add("d-none");
    return;
  }

  filteredEntries.forEach((entry) => {
    const totalPrice = entry.quantity * UNIT_PRICE;
    grandTotal += totalPrice;

    const row = studentTable.insertRow();
    row.innerHTML = `
      <td>${entry.schoolId}</td>
      <td>${entry.name}</td>
      <td>${entry.lastname}</td>
      <td>${entry.yrlvl}</td>
      <td>${entry.department}</td>
      <td>${entry.quantity}</td>
      <td>${UNIT_PRICE}</td>
      <td>${totalPrice}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-warning me-1" onclick="editEntry('${entry.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteEntry('${entry.id}')">🗑️</button>
      </td>
    `;
  });

  if (searchVal !== "" && filteredEntries.length > 0) {
    grandTotalEl.closest("tr").style.display = "none";
  } else {
    grandTotalEl.closest("tr").style.display = "table-row";
    grandTotalEl.textContent = grandTotal;
  }

  noDataMessage.classList.toggle("d-none", !(filteredEntries.length === 0 && searchVal === ""));
}

// 🔹 Edit Entry
window.editEntry = function (id) {
  editingId = id;
  const entry = entries.find((e) => e.id === id);

  document.getElementById("editSchoolId").value = entry.schoolId;
  document.getElementById("editName").value = entry.name;
  document.getElementById("editLastname").value = entry.lastname;
  document.getElementById("editYrlvl").value = entry.yrlvl;
  document.getElementById("editDepartment").value = entry.department;
  document.getElementById("editQuantity").value = entry.quantity;

  editModal.show();
};

// 🔹 Save Edited Entry
editForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const updated = {
    schoolId: document.getElementById("editSchoolId").value,
    name: document.getElementById("editName").value,
    lastname: document.getElementById("editLastname").value,
    yrlvl: document.getElementById("editYrlvl").value,
    department: document.getElementById("editDepartment").value,
    quantity: parseInt(document.getElementById("editQuantity").value),
  };

  await updateDoc(doc(db, "entries", editingId), updated);
  await loadEntries();
  editModal.hide();
});

let deleteId = null; // store the entry id to delete
const deleteModal = new bootstrap.Modal(document.getElementById("deleteModal"));
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

// Open delete modal
window.deleteEntry = function (id) {
  deleteId = id;
  deleteModal.show();
};

// Confirm delete
confirmDeleteBtn.addEventListener("click", async () => {
  if (deleteId) {
    await deleteDoc(doc(db, "entries", deleteId));
    await loadEntries();
    deleteId = null;
    deleteModal.hide();
  }
});

// 🔹 Search & Filter
searchInput.addEventListener("input", renderTable);
filterDepartment.addEventListener("change", renderTable);
