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
  doc
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
  "jeanneariel.garcia@lorma.edu",
  "almiravictoria.rendon@lorma.edu",
  "princessangel.gacayan@lorma.edu",
  "finariki.soriano@lorma.edu",
  "myca.oribio@lorma.edu"
];

// --------------------- Helpers ---------------------
const UNIT_PRICE = 800;

function safeStr(v) {
  return (v === undefined || v === null) ? "" : String(v);
}
function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function formatCurrency(n) {
  return "₱" + Number(n).toLocaleString();
}
function showToast(message, type = "info") {
  const toastRoot = document.getElementById("appToast");
  if (!toastRoot) {
    console.log("Toast fallback:", message);
    return;
  }
  const body = toastRoot.querySelector(".toast-body");
  if (body) body.textContent = message;

  toastRoot.classList.remove("text-bg-success", "text-bg-danger", "text-bg-warning", "text-bg-info");
  if (type === "success") toastRoot.classList.add("text-bg-success");
  if (type === "danger") toastRoot.classList.add("text-bg-danger");
  if (type === "warning") toastRoot.classList.add("text-bg-warning");
  if (type === "info") toastRoot.classList.add("text-bg-info");

  try {
    const bsToast = bootstrap.Toast.getOrCreateInstance(toastRoot);
    bsToast.show();
  } catch (err) {
    console.log("Toast error:", err);
  }
}

// --------------------- DOM references ---------------------
const studentForm = document.getElementById("studentForm");
const studentTableEl = document.getElementById("studentTable");
const studentTable = studentTableEl ? studentTableEl.querySelector("tbody") : null;
const grandTotalEl = document.getElementById("grandTotal");
const searchInput = document.getElementById("searchInput");
const filterDepartment = document.getElementById("filterDepartment");
const noDataMessage = document.getElementById("noDataMessage");
const loadingSpinner = document.getElementById("loadingSpinner");
const duplicateModalEl = document.getElementById("duplicateModal");
const deleteModalEl = document.getElementById("deleteModal");
const editModalEl = document.getElementById("editModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const editForm = document.getElementById("editForm");
const logoutBtn = document.getElementById("logoutBtn");
const userNameEl = document.getElementById("userName");
const userPhotoEl = document.getElementById("userPhoto");

let entries = [];
let currentUser = null;
let editingId = null;
let deleteId = null;

const duplicateModal = duplicateModalEl ? new bootstrap.Modal(duplicateModalEl) : null;
const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;

// --------------------- Auth & UI setup ---------------------
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!allowedEmails.includes(user.email)) {
        showToast("Unauthorized account. Only specific emails can log in.", "danger");
        setTimeout(() => signOut(auth), 900);
        return;
      }

      currentUser = user; // ✅ store user globally

      if (userNameEl) userNameEl.textContent = user.displayName || user.email;
      if (userPhotoEl && user.photoURL) userPhotoEl.src = user.photoURL;

      loadEntries();
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
        console.error("Logout error:", err);
        showToast("Logout failed: " + err.message, "danger");
      }
    });
  }

  if (studentForm) studentForm.addEventListener("submit", handleAddEntry);
  if (searchInput) searchInput.addEventListener("input", renderTable);
  if (filterDepartment) filterDepartment.addEventListener("change", renderTable);
  if (editForm) editForm.addEventListener("submit", handleSaveEdit);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDeleteHandler);
});

// --------------------- Firestore operations ---------------------
async function loadEntries() {
  try {
    if (loadingSpinner) loadingSpinner.classList.remove("d-none");
    const qSnap = await getDocs(collection(db, "entries"));
    entries = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable();
  } catch (err) {
    console.error("Failed to load entries:", err);
    showToast("Failed to load entries: " + err.message, "danger");
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("d-none");
  }
}

async function handleAddEntry(e) {
  e.preventDefault();
  if (!studentForm) return;

  const schoolIdVal = safeStr(document.getElementById("schoolId")?.value).trim();
  if (!schoolIdVal) {
    showToast("School ID is required", "warning");
    return;
  }

  const dup = entries.find(en => safeStr(en.schoolId).trim().toLowerCase() === schoolIdVal.toLowerCase());
  if (dup) {
    if (duplicateModal) duplicateModal.show();
    else showToast("Duplicate School ID", "warning");
    return;
  }

  const name = safeStr(document.getElementById("name")?.value).trim();
  const lastname = safeStr(document.getElementById("lastname")?.value).trim();
  const yrlvl = safeStr(document.getElementById("yrlvl")?.value).trim();
  const department = safeStr(document.getElementById("department")?.value).trim();
  const quantityRaw = document.getElementById("quantity")?.value;
  const quantity = toNumberSafe(quantityRaw, NaN);

  if (Number.isNaN(quantity) || quantity < 0) {
    showToast("Quantity must be a valid non-negative number", "warning");
    return;
  }
  const entry = {
    schoolId: schoolIdVal,
    name,
    lastname,
    yrlvl,
    department,
    quantity,
    unitPrice: UNIT_PRICE,
    createdAt: new Date().toISOString(),
    soldBy: currentUser?.displayName || currentUser?.email || "Unknown" // ✅ Add this
  };


  try {
    await addDoc(collection(db, "entries"), entry);
    await loadEntries();
    studentForm.reset();
    showToast("Entry added", "success");
  } catch (err) {
    console.error("Add entry failed:", err);
    showToast("Failed to add entry: " + err.message, "danger");
  }
}

async function handleSaveEdit(e) {
  e.preventDefault();
  if (!editingId) return showToast("No entry selected for editing", "warning");

  const updatedSchoolId = safeStr(document.getElementById("editSchoolId")?.value).trim();
  if (!updatedSchoolId) return showToast("School ID is required", "warning");

  const dup = entries.find(en => en.id !== editingId && safeStr(en.schoolId).trim().toLowerCase() === updatedSchoolId.toLowerCase());
  if (dup) {
    showToast("Another entry already uses that School ID", "warning");
    return;
  }

  const updatedName = safeStr(document.getElementById("editName")?.value).trim();
  const updatedLastname = safeStr(document.getElementById("editLastname")?.value).trim();
  const updatedYrlvl = safeStr(document.getElementById("editYrlvl")?.value).trim();
  const updatedDepartment = safeStr(document.getElementById("editDepartment")?.value).trim();
  const updatedQuantityRaw = document.getElementById("editQuantity")?.value;
  const updatedQuantity = toNumberSafe(updatedQuantityRaw, NaN);

  if (Number.isNaN(updatedQuantity) || updatedQuantity < 0) {
    showToast("Quantity must be a valid non-negative number", "warning");
    return;
  }

  const updated = {
    schoolId: updatedSchoolId,
    name: updatedName,
    lastname: updatedLastname,
    yrlvl: updatedYrlvl,
    department: updatedDepartment,
    quantity: updatedQuantity,
    unitPrice: UNIT_PRICE,
    updatedAt: new Date().toISOString()
  };

  try {
    await updateDoc(doc(db, "entries", editingId), updated);
    await loadEntries();
    if (editModal) editModal.hide();
    showToast("Entry updated", "success");
  } catch (err) {
    console.error("Update failed:", err);
    showToast("Failed to update entry: " + err.message, "danger");
  } finally {
    editingId = null;
  }
}

async function confirmDeleteHandler() {
  if (!deleteId) return;
  try {
    await deleteDoc(doc(db, "entries", deleteId));
    await loadEntries();
    if (deleteModal) deleteModal.hide();
    showToast("Entry deleted", "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Failed to delete entry: " + err.message, "danger");
  } finally {
    deleteId = null;
  }
}

function openEditModal(id) {
  editingId = id;
  const entry = entries.find(e => e.id === id);
  if (!entry) return showToast("Entry not found", "warning");

  document.getElementById("editSchoolId").value = safeStr(entry.schoolId);
  document.getElementById("editName").value = safeStr(entry.name);
  document.getElementById("editLastname").value = safeStr(entry.lastname);
  document.getElementById("editYrlvl").value = safeStr(entry.yrlvl);
  document.getElementById("editDepartment").value = safeStr(entry.department);
  document.getElementById("editQuantity").value = safeStr(entry.quantity);

  if (editModal) editModal.show();
}

function openDeleteModal(id) {
  deleteId = id;
  if (deleteModal) deleteModal.show();
}

// --------------------- Render ---------------------
function renderTable() {
  if (!studentTable) return;
  studentTable.innerHTML = "";

  const searchVal = safeStr(searchInput?.value).toLowerCase();
  const deptVal = safeStr(filterDepartment?.value);
  const dateVal = document.getElementById("filterDate")?.value || ""; // YYYY-MM-DD

  const filteredEntries = entries.filter(entry => {
    const sid = safeStr(entry.schoolId).toLowerCase();
    const name = safeStr(entry.name).toLowerCase();
    const lastname = safeStr(entry.lastname).toLowerCase();
    const matchesSearch = sid.includes(searchVal) || name.includes(searchVal) || lastname.includes(searchVal);
    const matchesDept = deptVal === "" || safeStr(entry.department) === deptVal;

    // ✅ Date filter
    let matchesDate = true;
    if (dateVal !== "" && entry.createdAt) {
      const entryDate = new Date(entry.createdAt);
      const formattedDate =
        entryDate.getFullYear() + "-" +
        String(entryDate.getMonth() + 1).padStart(2, '0') + "-" +
        String(entryDate.getDate()).padStart(2, '0');
      matchesDate = (formattedDate === dateVal);
    }

    return matchesSearch && matchesDept && matchesDate;
  });

  if (filteredEntries.length === 0) {
    studentTable.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted fw-bold">
          ${dateVal ? "📅 No data for this day" : "No records found."}
        </td>
      </tr>
    `;
    if (grandTotalEl) grandTotalEl.textContent = "0";
    return;
  }

  let grandTotal = 0;
  filteredEntries.forEach(entry => {
    const quantity = toNumberSafe(entry.quantity, 0);
    const unitPrice = toNumberSafe(entry.unitPrice, UNIT_PRICE);
    const totalPrice = quantity * unitPrice;
    grandTotal += totalPrice;

    const createdAt = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—";

    const row = document.createElement("tr");
    row.innerHTML = `
  <td>${safeStr(entry.schoolId)}</td>
  <td>${safeStr(entry.name)}</td>
  <td>${safeStr(entry.lastname)}</td>
  <td>${safeStr(entry.yrlvl)}</td>
  <td>${safeStr(entry.department)}</td>
  <td>${quantity}</td>
  <td>${formatCurrency(unitPrice)}</td>
  <td>${formatCurrency(totalPrice)}</td>
  <td>${safeStr(entry.soldBy || "—")}</td>
  <td>${createdAt}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-warning me-1" data-id="${entry.id}" data-action="edit">✏️</button>
    <button class="btn btn-sm btn-danger" data-id="${entry.id}" data-action="delete">🗑️</button>
  </td>
`;
    studentTable.appendChild(row);
  });

  // Attach actions
  studentTable.querySelectorAll("button[data-action]").forEach(btn => {
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    btn.onclick = () => {
      if (action === "edit") openEditModal(id);
      if (action === "delete") openDeleteModal(id);
    };
  });

  // ✅ Grand total now respects date filter
  if (grandTotalEl) grandTotalEl.textContent = formatCurrency(grandTotal);
}

// --------------------- Event Listeners ---------------------
searchInput?.addEventListener("input", renderTable);
filterDepartment?.addEventListener("change", renderTable);
document.getElementById("filterDate")?.addEventListener("change", renderTable);

// Initial render
renderTable();
