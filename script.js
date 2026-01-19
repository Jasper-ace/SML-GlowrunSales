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
  setDoc,
  serverTimestamp
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
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";


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

// Admin emails
const adminEmails = [
  "jasperace.lapitan@lorma.edu"
];

// --------------------- Helpers ---------------------
const UNIT_PRICE = 700;
const EARLY_BIRD_PRICE = 630;
const EARLY_BIRD_LIMIT = 56;

// Function to get the appropriate price based on order
function getTicketPrice() {
  // Count total sold tickets (not entries, since each entry = 1 ticket)
  const soldTicketsCount = entries.length;

  if (soldTicketsCount < EARLY_BIRD_LIMIT) {
    return EARLY_BIRD_PRICE;
  }
  return UNIT_PRICE;
}

// Function to get price for a specific ticket number in sequence
function getPriceForTicketSequence(ticketIndex) {
  if (ticketIndex < EARLY_BIRD_LIMIT) {
    return EARLY_BIRD_PRICE;
  }
  return UNIT_PRICE;
}

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
const viewTicketsModalEl = document.getElementById("viewTicketsModal");
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
const viewTicketsModal = viewTicketsModalEl ? new bootstrap.Modal(viewTicketsModalEl) : null;
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

      // Show admin link if user is admin
      if (adminEmails.includes(user.email)) {
        showAdminLink();
      }

      // Track user as online
      trackUserOnline(user);

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

  // Add real-time validation for School ID in add form
  const schoolIdInput = document.getElementById("schoolId");
  if (schoolIdInput) {
    schoolIdInput.addEventListener("input", validateSchoolIdInput);
  }

  // Add handler for quantity changes to create dynamic ticket fields
  const quantityInput = document.getElementById("quantity");
  if (quantityInput) {
    quantityInput.addEventListener("input", handleQuantityChange);
  }
});

// --------------------- Firestore operations ---------------------
function loadEntries() {
  try {
    if (loadingSpinner) loadingSpinner.classList.remove("d-none");

    // Listen in real-time for any change in the "entries" collection
    const entriesRef = collection(db, "entries");

    // Remove any previous listener before attaching a new one
    if (window.entriesUnsub) window.entriesUnsub();

    window.entriesUnsub = onSnapshot(entriesRef, (snapshot) => {
      entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable(); // automatically re-render whenever Firestore updates
      updatePricingInfo(); // Update pricing information
    }, (error) => {
      console.error("Realtime listener error:", error);
      showToast("Failed to listen for updates: " + error.message, "danger");
    });

  } catch (err) {
    console.error("Failed to load entries:", err);
    showToast("Failed to load entries: " + err.message, "danger");
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("d-none");
  }
}

// Update pricing information display
function updatePricingInfo() {
  const pricingInfoEl = document.getElementById("pricingInfo");
  if (!pricingInfoEl) return;

  const currentTicketCount = entries.length;
  const remainingEarlyBird = Math.max(0, EARLY_BIRD_LIMIT - currentTicketCount);

  let infoHTML = "";

  if (remainingEarlyBird > 0) {
    infoHTML = `
      <div class="alert alert-info py-2 mb-0">
        <strong>🎉 Early Bird Special!</strong><br>
        <span class="text-success">₱${EARLY_BIRD_PRICE}</span> per ticket for the next <strong>${remainingEarlyBird}</strong> tickets<br>
        <small>Regular price: ₱${UNIT_PRICE} (after ${EARLY_BIRD_LIMIT} tickets sold)</small>
      </div>
    `;
  } else {
    infoHTML = `
      <div class="alert alert-secondary py-2 mb-0">
        <strong>Regular Price:</strong> ₱${UNIT_PRICE} per ticket<br>
        <small>Early bird promotion has ended (${EARLY_BIRD_LIMIT} tickets sold)</small>
      </div>
    `;
  }

  pricingInfoEl.innerHTML = infoHTML;
}

// Handle quantity changes to create dynamic ticket number fields
function handleQuantityChange() {
  const quantityInput = document.getElementById("quantity");
  const container = document.getElementById("ticketNumbersContainer");
  const fieldsContainer = document.getElementById("ticketNumberFields");

  if (!quantityInput || !container || !fieldsContainer) return;

  const quantity = parseInt(quantityInput.value) || 0;

  if (quantity > 0) {
    // Show the container
    container.style.display = "block";

    // Clear existing fields
    fieldsContainer.innerHTML = "";

    // Create ticket number inputs
    for (let i = 1; i <= quantity; i++) {
      const ticketDiv = document.createElement("div");
      ticketDiv.className = "mb-2";

      ticketDiv.innerHTML = `
        <div class="input-group">
          <span class="input-group-text">Ticket ${i}</span>
          <input type="text" class="form-control ticket-number-input" 
                 id="ticketNumber${i}" 
                 placeholder="Ticket Number Here!" 
                 maxlength="4" 
                 pattern="[0-9]{1,4}"
                 required>
        </div>
      `;

      fieldsContainer.appendChild(ticketDiv);

      // Add validation to each ticket number input
      const input = ticketDiv.querySelector(`#ticketNumber${i}`);
      input.addEventListener("input", validateAllTicketNumbers);
    }
  } else {
    // Hide the container if quantity is 0 or invalid
    container.style.display = "none";
    fieldsContainer.innerHTML = "";
  }
}

// Validate all ticket number inputs
function validateAllTicketNumbers() {
  const ticketInputs = document.querySelectorAll(".ticket-number-input");
  const submitButton = studentForm?.querySelector('button[type="submit"]');

  let hasError = false;
  let errorMessages = [];
  const ticketNumbers = [];

  // Clear previous error styles
  ticketInputs.forEach(input => {
    input.style.borderColor = "";
    input.style.backgroundColor = "";
    const warningMsg = input.parentElement.parentElement.querySelector(".duplicate-warning");
    if (warningMsg) warningMsg.remove();
  });

  // Validate each ticket number
  ticketInputs.forEach((input, index) => {
    let value = input.value;

    // Remove any non-digit characters
    value = value.replace(/\D/g, '');

    // Limit to exactly 4 digits
    if (value.length > 4) {
      value = value.slice(0, 4);
    }

    // Update the input value immediately
    input.value = value;

    if (!value) return; // Skip empty fields

    // Pad to 4 digits for validation
    const paddedValue = value.padStart(4, '0');
    const numValue = parseInt(paddedValue, 10);

    // Check range (0001-9999)
    if (numValue < 1 || numValue > 9999) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = "⚠️ Invalid range (0001-9999)";
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    // Check for duplicates in existing entries
    const isDuplicateInDB = entries.some(en => safeStr(en.ticketNumber) === paddedValue);
    if (isDuplicateInDB) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = `⚠️ Ticket ${paddedValue} already exists`;
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    // Check for duplicates within current form
    if (ticketNumbers.includes(paddedValue)) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = `⚠️ Duplicate ticket number in form`;
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    ticketNumbers.push(paddedValue);
  });

  // Check if all required fields are filled
  const allFilled = Array.from(ticketInputs).every(input => input.value.trim() !== "");
  if (!allFilled && ticketInputs.length > 0) {
    hasError = true;
  }

  // Enable/disable submit button
  if (submitButton) {
    // Also check if School ID is valid
    const schoolIdInput = document.getElementById("schoolId");
    const schoolIdVal = safeStr(schoolIdInput?.value).trim().toLowerCase();
    const schoolIdDuplicate = entries.some(en =>
      safeStr(en.schoolId).trim().toLowerCase() === schoolIdVal
    );

    if (hasError || schoolIdDuplicate || !allFilled) {
      submitButton.disabled = true;
      submitButton.style.opacity = "0.5";
      submitButton.style.cursor = "not-allowed";
      submitButton.style.background = "#9ca3af";
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";
      submitButton.style.background = "";
    }
  }
}

// Validate Ticket Number input in real-time
// Validate School ID input in real-time
function validateSchoolIdInput() {
  const schoolIdInput = document.getElementById("schoolId");
  if (!schoolIdInput) return;

  const schoolIdVal = safeStr(schoolIdInput.value).trim().toLowerCase();
  const isDuplicate = entries.some(en =>
    safeStr(en.schoolId).trim().toLowerCase() === schoolIdVal
  );

  // Get the submit button
  const submitButton = studentForm?.querySelector('button[type="submit"]');

  if (isDuplicate && schoolIdVal !== "") {
    schoolIdInput.style.borderColor = "#ef4444";
    schoolIdInput.style.borderWidth = "2px";
    schoolIdInput.style.backgroundColor = "#fee2e2";

    // Add or update warning message
    let warningMsg = schoolIdInput.parentElement.querySelector(".duplicate-warning");
    if (!warningMsg) {
      warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      schoolIdInput.parentElement.appendChild(warningMsg);
    }
    warningMsg.textContent = "⚠️ This ID Number already exists!";

    // Disable submit button
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.style.opacity = "0.5";
      submitButton.style.cursor = "not-allowed";
      submitButton.style.background = "#9ca3af";
    }
  } else {
    schoolIdInput.style.borderColor = "";
    schoolIdInput.style.borderWidth = "";
    schoolIdInput.style.backgroundColor = "";
    const warningMsg = schoolIdInput.parentElement.querySelector(".duplicate-warning");
    if (warningMsg) warningMsg.remove();

    // Enable submit button (but check if Ticket Number is also valid)
    const ticketNumberInput = document.getElementById("ticketNumber");
    const ticketVal = ticketNumberInput?.value;
    const ticketNumValue = parseInt(ticketVal, 10);
    const formattedTicketValue = ticketVal ? String(ticketNumValue).padStart(4, '0') : '';
    const ticketDuplicate = ticketVal && entries.some(en =>
      safeStr(en.ticketNumber) === formattedTicketValue
    );

    if (submitButton && !ticketDuplicate) {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";
      submitButton.style.background = "";
    }
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
  const quantity = parseInt(quantityRaw, 10);
  const soldStatus = "sold";

  if (Number.isNaN(quantity) || quantity < 1) {
    showToast("Quantity must be a valid positive number", "warning");
    return;
  }

  // Get all ticket numbers from the dynamic fields
  const ticketInputs = document.querySelectorAll(".ticket-number-input");
  const ticketNumbers = [];

  for (let i = 0; i < ticketInputs.length; i++) {
    const input = ticketInputs[i];
    let value = input.value.trim();

    // Remove any non-digit characters and limit to 4 digits
    value = value.replace(/\D/g, '').slice(0, 4);

    if (!value) {
      showToast(`Please enter ticket number ${i + 1}`, "warning");
      return;
    }

    const numValue = parseInt(value, 10);
    if (Number.isNaN(numValue) || numValue < 1 || numValue > 9999) {
      showToast(`Ticket ${i + 1} must be between 0001 and 9999`, "warning");
      return;
    }

    const formattedTicketNumber = String(numValue).padStart(4, '0');

    // Check for duplicate ticket number in database
    const ticketDup = entries.find(en => safeStr(en.ticketNumber) === formattedTicketNumber);
    if (ticketDup) {
      showToast(`Ticket Number ${formattedTicketNumber} already exists`, "warning");
      return;
    }

    // Check for duplicates within the form
    if (ticketNumbers.includes(formattedTicketNumber)) {
      showToast(`Duplicate ticket number ${formattedTicketNumber} in form`, "warning");
      return;
    }

    ticketNumbers.push(formattedTicketNumber);
  }

  // Verify we have the right number of tickets
  if (ticketNumbers.length !== quantity) {
    showToast(`Please enter exactly ${quantity} ticket numbers`, "warning");
    return;
  }

  // Create entries for each ticket
  const entriesToAdd = [];
  const currentTicketCount = entries.length; // Current number of tickets sold
  const batchId = `${schoolIdVal}_${Date.now()}`; // FIX: Generate ID once for the whole batch

  for (let i = 0; i < quantity; i++) {
    const ticketSequenceNumber = currentTicketCount + i; // Position in the overall sequence
    const ticketPrice = getPriceForTicketSequence(ticketSequenceNumber);

    const entry = {
      schoolId: schoolIdVal,
      ticketNumber: ticketNumbers[i],
      name,
      lastname,
      yrlvl,
      department,
      quantity: 1, // Each entry represents 1 ticket
      unitPrice: ticketPrice,
      isEarlyBird: ticketSequenceNumber < EARLY_BIRD_LIMIT,
      ticketSequenceNumber: ticketSequenceNumber + 1, // 1-based numbering for display
      soldStatus: soldStatus,
      soldAt: new Date().toISOString(), // Always sold per policy
      createdAt: new Date().toISOString(),
      soldBy: currentUser?.email || "Unknown",
      soldByName: currentUser?.displayName || currentUser?.email || "Unknown",
      batchId: batchId, // Group tickets from same purchase
      ticketIndex: i + 1, // Which ticket in the batch (1, 2, 3, etc.)
      totalTicketsInBatch: quantity
    };
    entriesToAdd.push(entry);
  }

  try {
    // Add all entries to Firestore
    const addPromises = entriesToAdd.map(entry => addDoc(collection(db, "entries"), entry));
    await Promise.all(addPromises);

    await loadEntries();
    studentForm.reset();

    // Hide the ticket numbers container
    const container = document.getElementById("ticketNumbersContainer");
    if (container) container.style.display = "none";

    // Clear the red border after successful submission
    const schoolIdInput = document.getElementById("schoolId");
    if (schoolIdInput) {
      schoolIdInput.style.borderColor = "";
      schoolIdInput.style.borderWidth = "";
      schoolIdInput.style.backgroundColor = "";
      const warningMsg = schoolIdInput.parentElement.querySelector(".duplicate-warning");
      if (warningMsg) warningMsg.remove();
    }

    const ticketList = ticketNumbers.join(", ");
    showToast(`${quantity} ticket(s) added successfully! Ticket numbers: ${ticketList}`, "success");
  } catch (err) {
    console.error("Add entry failed:", err);
    showToast("Failed to add entry: " + err.message, "danger");
  }
}

async function handleSaveEdit(e) {
  e.preventDefault();
  if (!editingId) return showToast("No entry selected for editing", "warning");

  const batchEntries = window.editingBatch || [];
  if (batchEntries.length === 0) return showToast("No entries to edit", "warning");

  const newQuantity = parseInt(document.getElementById("editQuantity")?.value) || batchEntries.length;

  // Prevent reducing ticket count
  if (newQuantity < batchEntries.length) {
    showToast(`Cannot reduce tickets below ${batchEntries.length}. You can only add more tickets.`, "warning");
    return;
  }

  const updatedSchoolId = safeStr(document.getElementById("editSchoolId")?.value).trim();
  if (!updatedSchoolId) return showToast("School ID is required", "warning");

  // Check for duplicate school ID (excluding current batch)
  const dup = entries.find(en =>
    !batchEntries.some(be => be.id === en.id) &&
    safeStr(en.schoolId).trim().toLowerCase() === updatedSchoolId.toLowerCase()
  );
  if (dup) {
    showToast("This School ID already exists. Please use a unique ID.", "warning");
    return;
  }

  const updatedName = safeStr(document.getElementById("editName")?.value).trim();
  const updatedLastname = safeStr(document.getElementById("editLastname")?.value).trim();
  const updatedYrlvl = safeStr(document.getElementById("editYrlvl")?.value).trim();
  const updatedDepartment = safeStr(document.getElementById("editDepartment")?.value).trim();
  const updatedSoldStatus = "sold";

  // Get all ticket numbers from the edit form
  const ticketInputs = document.querySelectorAll(".edit-ticket-number-input");
  const updatedTicketNumbers = [];

  for (let i = 0; i < ticketInputs.length; i++) {
    const input = ticketInputs[i];
    const value = input.value.trim();

    if (!value) {
      showToast(`Please enter ticket number ${i + 1}`, "warning");
      return;
    }

    const numValue = parseInt(value, 10);
    if (Number.isNaN(numValue) || numValue < 1 || numValue > 9999) {
      showToast(`Ticket ${i + 1} must be between 1 and 9999`, "warning");
      return;
    }

    const formattedTicketNumber = String(numValue).padStart(4, '0');

    // Check for duplicate ticket number (excluding current batch)
    const ticketDup = entries.find(en =>
      !batchEntries.some(be => be.id === en.id) &&
      safeStr(en.ticketNumber) === formattedTicketNumber
    );
    if (ticketDup) {
      showToast(`Ticket Number ${formattedTicketNumber} already exists`, "warning");
      return;
    }

    // Check for duplicates within the form
    if (updatedTicketNumbers.includes(formattedTicketNumber)) {
      showToast(`Duplicate ticket number ${formattedTicketNumber} in form`, "warning");
      return;
    }

    updatedTicketNumbers.push(formattedTicketNumber);
  }

  // Verify we have the right number of tickets
  if (updatedTicketNumbers.length !== newQuantity) {
    showToast(`Please enter exactly ${newQuantity} ticket numbers`, "warning");
    return;
  }

  try {
    const updatePromises = [];
    const newEntryPromises = [];

    // Update existing entries (keep their original prices and early bird status)
    for (let i = 0; i < batchEntries.length; i++) {
      const updated = {
        schoolId: updatedSchoolId,
        ticketNumber: updatedTicketNumbers[i],
        name: updatedName,
        lastname: updatedLastname,
        yrlvl: updatedYrlvl,
        department: updatedDepartment,
        quantity: 1, // Each entry represents 1 ticket
        // Keep original price and early bird status for existing tickets
        unitPrice: batchEntries[i].unitPrice,
        isEarlyBird: batchEntries[i].isEarlyBird,
        soldStatus: updatedSoldStatus,
        soldAt: batchEntries[i].soldAt || new Date().toISOString(), // Keep original date or set new if missing
        updatedAt: new Date().toISOString()
      };

      updatePromises.push(updateDoc(doc(db, "entries", batchEntries[i].id), updated));
    }

    // Create new entries for additional tickets (use current pricing logic)
    const currentTicketCount = entries.length; // Total tickets in system

    for (let i = batchEntries.length; i < newQuantity; i++) {
      // Calculate the sequence number for this new ticket
      const ticketSequenceNumber = currentTicketCount + (i - batchEntries.length);
      const ticketPrice = getPriceForTicketSequence(ticketSequenceNumber);

      const newEntry = {
        schoolId: updatedSchoolId,
        ticketNumber: updatedTicketNumbers[i],
        name: updatedName,
        lastname: updatedLastname,
        yrlvl: updatedYrlvl,
        department: updatedDepartment,
        quantity: 1, // Each entry represents 1 ticket
        unitPrice: ticketPrice,
        isEarlyBird: ticketSequenceNumber < EARLY_BIRD_LIMIT,
        soldStatus: updatedSoldStatus,
        soldAt: new Date().toISOString(), // Always sold per policy
        createdAt: new Date().toISOString(),
        soldBy: currentUser?.email || "Unknown",
        soldByName: currentUser?.displayName || currentUser?.email || "Unknown",
        batchId: batchEntries[0].batchId || `${updatedSchoolId}_${Date.now()}`,
        ticketIndex: i + 1,
        totalTicketsInBatch: newQuantity,
        ticketSequenceNumber: ticketSequenceNumber + 1 // 1-based numbering for display
      };

      newEntryPromises.push(addDoc(collection(db, "entries"), newEntry));
    }

    // Execute all updates and additions
    await Promise.all([...updatePromises, ...newEntryPromises]);

    await loadEntries();
    if (editModal) editModal.hide();

    const ticketList = updatedTicketNumbers.join(", ");
    const addedCount = newQuantity - batchEntries.length;
    const message = addedCount > 0
      ? `${batchEntries.length} ticket(s) updated and ${addedCount} new ticket(s) added! All ticket numbers: ${ticketList}`
      : `${batchEntries.length} ticket(s) updated successfully! Ticket numbers: ${ticketList}`;

    showToast(message, "success");
  } catch (err) {
    console.error("Update failed:", err);
    showToast("Failed to update entries: " + err.message, "danger");
  } finally {
    editingId = null;
    window.editingBatch = null;
  }
}

async function confirmDeleteHandler() {
  if (!deleteId) return;

  const batchEntries = window.deletingBatch || [];
  if (batchEntries.length === 0) {
    showToast("No entries to delete", "warning");
    return;
  }

  try {
    const deletePromises = [];

    // Create a single grouped deleted entry for the batch
    const firstEntry = batchEntries[0];
    const totalPrice = batchEntries.reduce((sum, e) => sum + toNumberSafe(e.unitPrice, 0), 0);
    const ticketNumbers = batchEntries.map(e => safeStr(e.ticketNumber)).join(", ");

    const groupedDeletedEntry = {
      // Use first entry's basic info
      schoolId: safeStr(firstEntry.schoolId),
      name: safeStr(firstEntry.name),
      lastname: safeStr(firstEntry.lastname),
      yrlvl: safeStr(firstEntry.yrlvl),
      department: safeStr(firstEntry.department),

      // Batch information
      quantity: batchEntries.length,
      ticketNumbers: ticketNumbers, // All ticket numbers as comma-separated string
      unitPrice: batchEntries.length === 1 ? toNumberSafe(firstEntry.unitPrice, UNIT_PRICE) : "Mixed", // Show "Mixed" if different prices
      totalPrice: totalPrice,

      // Metadata
      batchId: safeStr(firstEntry.batchId) || `${safeStr(firstEntry.schoolId)}_${Date.now()}`,
      originalIds: batchEntries.map(e => safeStr(e.id)), // Store all original IDs
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser ? safeStr(currentUser.email) : "Unknown",
      deletedByName: currentUser ? safeStr(currentUser.displayName || currentUser.email) : "Unknown",
      createdAt: safeStr(firstEntry.createdAt) || new Date().toISOString(),
      soldBy: safeStr(firstEntry.soldBy) || "Unknown",
      soldByName: safeStr(firstEntry.soldByName) || safeStr(firstEntry.soldBy) || "Unknown",

      // Individual ticket details (for restore functionality)
      ticketDetails: batchEntries.map(entry => ({
        id: safeStr(entry.id),
        ticketNumber: safeStr(entry.ticketNumber),
        unitPrice: toNumberSafe(entry.unitPrice, UNIT_PRICE),
        isEarlyBird: entry.isEarlyBird === true, // Convert to boolean, default false
        ticketIndex: toNumberSafe(entry.ticketIndex, 1)
      }))
    };

    // Save as single grouped entry in deletedEntries
    const batchDeleteId = firstEntry.batchId || `batch_${Date.now()}`;
    await setDoc(doc(db, "deletedEntries", batchDeleteId), groupedDeletedEntry);

    // Delete all individual entries from main collection
    for (const entry of batchEntries) {
      deletePromises.push(deleteDoc(doc(db, "entries", entry.id)));
    }

    // Execute all deletions
    await Promise.all(deletePromises);

    if (deleteModal) deleteModal.hide();

    const message = batchEntries.length === 1
      ? "Ticket deleted successfully"
      : `${batchEntries.length} tickets deleted successfully`;

    showToast(message, "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Failed to delete entries: " + err.message, "danger");
  } finally {
    deleteId = null;
    window.deletingBatch = null;
  }
}

// Update edit ticket fields based on quantity
function updateEditTicketFields(batchEntries, newQuantity = null) {
  const container = document.getElementById("editTicketNumbersContainer");
  const currentQuantity = newQuantity || batchEntries.length;

  container.innerHTML = "";

  // Create inputs for existing tickets
  batchEntries.forEach((ticketEntry, index) => {
    const ticketDiv = document.createElement("div");
    ticketDiv.className = "mb-2";

    const ticketNumValue = ticketEntry.ticketNumber || "";

    ticketDiv.innerHTML = `
      <div class="input-group">
        <span class="input-group-text">Ticket ${index + 1}</span>
        <input type="text" class="form-control edit-ticket-number-input" 
               id="editTicketNumber${index + 1}" 
               value="${ticketNumValue}"
               data-original-id="${ticketEntry.id}"
               data-is-existing="true"
               placeholder="0001" 
               maxlength="4" 
               pattern="[0-9]{1,4}"
               required>
      </div>
    `;

    container.appendChild(ticketDiv);

    // Add validation to each ticket number input
    const input = ticketDiv.querySelector(`#editTicketNumber${index + 1}`);
    input.addEventListener("input", validateEditTicketNumbers);
  });

  // Create inputs for new tickets (if quantity increased)
  for (let i = batchEntries.length; i < currentQuantity; i++) {
    const ticketDiv = document.createElement("div");
    ticketDiv.className = "mb-2";

    ticketDiv.innerHTML = `
      <div class="input-group">
        <span class="input-group-text">Ticket ${i + 1} <span class="badge bg-success ms-1">NEW</span></span>
        <input type="text" class="form-control edit-ticket-number-input" 
               id="editTicketNumber${i + 1}" 
               value=""
               data-is-existing="false"
               placeholder="0001" 
               maxlength="4" 
               pattern="[0-9]{1,4}"
               required>
      </div>
    `;

    container.appendChild(ticketDiv);

    // Add validation to each ticket number input
    const input = ticketDiv.querySelector(`#editTicketNumber${i + 1}`);
    input.addEventListener("input", validateEditTicketNumbers);
  }
}

// Validate all edit ticket number inputs
function validateEditTicketNumbers() {
  const ticketInputs = document.querySelectorAll(".edit-ticket-number-input");
  const submitButton = document.querySelector("#editForm button[type='submit']");

  let hasError = false;
  const ticketNumbers = [];
  const batchEntries = window.editingBatch || [];

  // Clear previous error styles
  ticketInputs.forEach(input => {
    input.style.borderColor = "";
    input.style.backgroundColor = "";
    const warningMsg = input.parentElement.parentElement.querySelector(".duplicate-warning");
    if (warningMsg) warningMsg.remove();
  });

  // Validate each ticket number
  ticketInputs.forEach((input, index) => {
    let value = input.value;

    // Remove any non-digit characters
    value = value.replace(/\D/g, '');

    // Limit to exactly 4 digits
    if (value.length > 4) {
      value = value.slice(0, 4);
    }

    // Update the input value immediately
    input.value = value;

    if (!value) {
      hasError = true;
      return;
    }

    // Pad to 4 digits for validation
    const paddedValue = value.padStart(4, '0');
    const numValue = parseInt(paddedValue, 10);

    // Check range (0001-9999)
    if (numValue < 1 || numValue > 9999) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = "⚠️ Invalid range (0001-9999)";
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    const originalId = input.getAttribute('data-original-id');

    // Check for duplicates in existing entries (excluding current batch)
    const isDuplicateInDB = entries.some(en =>
      !batchEntries.some(be => be.id === en.id) &&
      safeStr(en.ticketNumber) === paddedValue
    );

    if (isDuplicateInDB) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = `⚠️ Ticket ${paddedValue} already exists`;
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    // Check for duplicates within current form
    if (ticketNumbers.includes(paddedValue)) {
      hasError = true;
      input.style.borderColor = "#ef4444";
      input.style.backgroundColor = "#fee2e2";

      const warningMsg = document.createElement("small");
      warningMsg.className = "duplicate-warning text-danger d-block mt-1";
      warningMsg.style.fontWeight = "600";
      warningMsg.textContent = `⚠️ Duplicate ticket number in form`;
      input.parentElement.parentElement.appendChild(warningMsg);
      return;
    }

    ticketNumbers.push(paddedValue);
  });

  // Enable/disable submit button
  if (submitButton) {
    // Also check if School ID is valid
    const schoolIdInput = document.getElementById("editSchoolId");
    const schoolIdVal = safeStr(schoolIdInput?.value).trim().toLowerCase();
    const schoolIdDuplicate = entries.some(en =>
      !batchEntries.some(be => be.id === en.id) &&
      safeStr(en.schoolId).trim().toLowerCase() === schoolIdVal
    );

    if (hasError || schoolIdDuplicate) {
      submitButton.disabled = true;
      submitButton.style.opacity = "0.5";
      submitButton.style.cursor = "not-allowed";
      submitButton.style.background = "#9ca3af";
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";
      submitButton.style.background = "";
    }
  }
}

function openEditModal(id) {
  editingId = id;
  const entry = entries.find(e => e.id === id);
  if (!entry) return showToast("Entry not found", "warning");

  // Find all tickets in the same batch
  let batchEntries = [];
  if (entry.batchId) {
    // New entries with batchId
    batchEntries = entries.filter(e => e.batchId === entry.batchId);
  } else {
    // Older entries - group by schoolId + timestamp (within same minute)
    const timestamp = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
    batchEntries = entries.filter(e => {
      if (e.schoolId !== entry.schoolId) return false;
      const eTimestamp = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      const eRoundedTimestamp = Math.floor(eTimestamp / 60000) * 60000;
      return eRoundedTimestamp === roundedTimestamp;
    });
  }

  // Sort batch entries by ticket number
  batchEntries.sort((a, b) => safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber)));

  // Store batch entries for editing
  window.editingBatch = batchEntries;

  // Fill in the common information
  const editSchoolIdInput = document.getElementById("editSchoolId");
  editSchoolIdInput.value = safeStr(entry.schoolId);
  document.getElementById("editName").value = safeStr(entry.name);
  document.getElementById("editLastname").value = safeStr(entry.lastname);
  document.getElementById("editYrlvl").value = safeStr(entry.yrlvl);
  document.getElementById("editDepartment").value = safeStr(entry.department);

  const editQuantityInput = document.getElementById("editQuantity");
  editQuantityInput.value = batchEntries.length;
  editQuantityInput.min = batchEntries.length; // Cannot go below current number

  const editSoldStatusInput = document.getElementById("editSoldStatus");
  if (editSoldStatusInput) {
    editSoldStatusInput.value = safeStr(entry.soldStatus) || "available";
  }

  // Create initial ticket number inputs
  updateEditTicketFields(batchEntries);

  // Add event listener for quantity changes
  editQuantityInput.addEventListener("input", () => {
    const newQuantity = parseInt(editQuantityInput.value) || batchEntries.length;
    if (newQuantity < batchEntries.length) {
      editQuantityInput.value = batchEntries.length;
      showToast(`Cannot reduce tickets below ${batchEntries.length}. You can only add more tickets.`, "warning");
      return;
    }
    updateEditTicketFields(batchEntries, newQuantity);
  });

  // Add real-time validation for School ID
  const saveButton = document.querySelector("#editForm button[type='submit']");

  const validateSchoolId = () => {
    const currentValue = safeStr(editSchoolIdInput.value).trim().toLowerCase();
    const isDuplicate = entries.some(en =>
      !batchEntries.some(be => be.id === en.id) &&
      safeStr(en.schoolId).trim().toLowerCase() === currentValue
    );

    if (isDuplicate && currentValue !== "") {
      editSchoolIdInput.style.borderColor = "#ef4444";
      editSchoolIdInput.style.backgroundColor = "#fee2e2";

      // Add or update warning message
      let warningMsg = editSchoolIdInput.parentElement.querySelector(".duplicate-warning");
      if (!warningMsg) {
        warningMsg = document.createElement("small");
        warningMsg.className = "duplicate-warning text-danger d-block mt-1";
        warningMsg.style.fontWeight = "600";
        editSchoolIdInput.parentElement.appendChild(warningMsg);
      }
      warningMsg.textContent = "⚠️ This School ID already exists!";

      // Disable save button
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.5";
        saveButton.style.cursor = "not-allowed";
        saveButton.style.background = "#9ca3af";
      }
    } else {
      editSchoolIdInput.style.borderColor = "";
      editSchoolIdInput.style.backgroundColor = "";
      const warningMsg = editSchoolIdInput.parentElement.querySelector(".duplicate-warning");
      if (warningMsg) warningMsg.remove();

      validateEditTicketNumbers(); // Revalidate tickets
    }
  };

  // Remove previous listener if exists
  editSchoolIdInput.removeEventListener("input", editSchoolIdInput._validateHandler);
  // Add new listener
  editSchoolIdInput._validateHandler = validateSchoolId;
  editSchoolIdInput.addEventListener("input", validateSchoolId);

  if (editModal) editModal.show();
}

function openViewTicketsModal(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  // Find all tickets in the same batch
  let batchEntries = [];
  if (entry.batchId) {
    // New entries with batchId
    batchEntries = entries.filter(e => e.batchId === entry.batchId);
  } else {
    // Older entries - group by schoolId + timestamp (within same minute)
    const timestamp = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
    batchEntries = entries.filter(e => {
      if (e.schoolId !== entry.schoolId) return false;
      const eTimestamp = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      const eRoundedTimestamp = Math.floor(eTimestamp / 60000) * 60000;
      return eRoundedTimestamp === roundedTimestamp;
    });
  }

  // Sort batch entries by ticket number
  batchEntries.sort((a, b) => safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber)));

  // Create modal content
  const modalContent = document.getElementById("viewTicketsContent");
  if (modalContent) {
    const totalPrice = batchEntries.reduce((sum, e) => sum + toNumberSafe(e.unitPrice, 0), 0);

    modalContent.innerHTML = `
      <div class="mb-4">
        <h6 class="fw-bold mb-3">Purchase Details</h6>
        <div class="row">
          <div class="col-md-6">
            <p><strong>Student:</strong> ${safeStr(entry.name)} ${safeStr(entry.lastname)}</p>
            <p><strong>ID Number:</strong> ${safeStr(entry.schoolId)}</p>
            <p><strong>Department:</strong> ${safeStr(entry.department)}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Year Level:</strong> ${safeStr(entry.yrlvl)}</p>
            <p><strong>Total Tickets:</strong> ${batchEntries.length}</p>
            <p><strong>Total Price:</strong> ${formatCurrency(totalPrice)}</p>
          </div>
        </div>
      </div>
      
      <h6 class="fw-bold mb-3">Ticket Numbers</h6>
      <div class="row g-2">
        ${batchEntries.map(ticketEntry => {
      const earlyBirdBadge = ticketEntry.isEarlyBird
        ? '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Early Bird</span>'
        : '<span class="badge bg-secondary ms-2" style="font-size: 0.7rem;">Regular</span>';

      return `
            <div class="col-md-6 col-lg-4">
              <div class="card border-0 shadow-sm">
                <div class="card-body py-2 px-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold" style="font-size: 0.9rem;">Ticket ${safeStr(ticketEntry.ticketNumber)}</span>
                    ${earlyBirdBadge}
                  </div>
                  <small class="text-muted">${formatCurrency(ticketEntry.unitPrice)}</small>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  if (viewTicketsModal) viewTicketsModal.show();
}

function openDeleteModal(id) {
  deleteId = id;

  // Find the entry and its batch
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  // Find all tickets in the same batch
  let batchEntries = [];
  if (entry.batchId) {
    // New entries with batchId
    batchEntries = entries.filter(e => e.batchId === entry.batchId);
  } else {
    // Older entries - group by schoolId + timestamp (within same minute)
    const timestamp = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
    batchEntries = entries.filter(e => {
      if (e.schoolId !== entry.schoolId) return false;
      const eTimestamp = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      const eRoundedTimestamp = Math.floor(eTimestamp / 60000) * 60000;
      return eRoundedTimestamp === roundedTimestamp;
    });
  }

  // Store batch for deletion
  window.deletingBatch = batchEntries;

  // Update modal content
  const modalContent = document.getElementById("deleteModalContent");
  if (modalContent) {
    if (batchEntries.length === 1) {
      modalContent.innerHTML = `
        <p class="fw-bold fs-5 mb-2">Delete Single Ticket?</p>
        <div class="alert alert-info">
          <strong>Student:</strong> ${safeStr(entry.name)} ${safeStr(entry.lastname)}<br>
          <strong>Ticket:</strong> ${safeStr(entry.ticketNumber)}<br>
          <strong>Price:</strong> ${formatCurrency(entry.unitPrice)}
        </div>
        <p class="text-muted mb-0">This action is permanent for your account</p>
        <p class="text-muted mb-0">Only an administrator can restore this item.</p>
      `;
    } else {
      const ticketNumbers = batchEntries.map(e => safeStr(e.ticketNumber)).join(", ");
      const totalPrice = batchEntries.reduce((sum, e) => sum + toNumberSafe(e.unitPrice, 0), 0);

      modalContent.innerHTML = `
        <p class="fw-bold fs-5 mb-2">Delete Entire Purchase?</p>
        <div class="alert alert-warning">
          <strong>⚠️ This will delete ALL ${batchEntries.length} tickets!</strong><br><br>
          <strong>Student:</strong> ${safeStr(entry.name)} ${safeStr(entry.lastname)}<br>
          <strong>Tickets:</strong> ${ticketNumbers}<br>
          <strong>Total Value:</strong> ${formatCurrency(totalPrice)}
        </div>
        <p class="text-muted mb-0">This action is permanent for your account
</p>
        <p class="text-muted mb-0">Only an administrator can restore this item.</p>
      `;
    }
  }

  // Update button text
  const deleteBtn = document.getElementById("confirmDeleteBtn");
  if (deleteBtn) {
    if (batchEntries.length === 1) {
      deleteBtn.textContent = "Delete Ticket";
    } else {
      deleteBtn.textContent = `Delete All ${batchEntries.length} Tickets`;
    }
  }

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
    const ticketNum = safeStr(entry.ticketNumber).toLowerCase();
    const name = safeStr(entry.name).toLowerCase();
    const lastname = safeStr(entry.lastname).toLowerCase();
    const fullname = `${name} ${lastname}`;
    const matchesSearch = sid.includes(searchVal) || ticketNum.includes(searchVal) || name.includes(searchVal) || lastname.includes(searchVal) || fullname.includes(searchVal);
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

  // ✅ Sort by time added (first come first serve - oldest first)
  filteredEntries.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA; // Descending order (newest first)
  });

  if (filteredEntries.length === 0) {
    studentTable.innerHTML = `
      <tr>
        <td colspan="13" class="text-center text-muted fw-bold">
          ${dateVal ? "📅 No data for this day" : "No records found."}
        </td>
      </tr>
    `;
    if (grandTotalEl) grandTotalEl.textContent = "0";
    return;
  }

  // Group entries by batchId or by schoolId + timestamp for entries bought together
  const groupedEntries = {};
  filteredEntries.forEach(entry => {
    let groupKey;

    if (entry.batchId) {
      // New entries with batchId
      groupKey = entry.batchId;
    } else {
      // Older entries or entries without batchId - group by schoolId + createdAt (within same minute)
      const timestamp = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
      const roundedTimestamp = Math.floor(timestamp / 60000) * 60000; // Group within same minute
      groupKey = `${entry.schoolId}_${roundedTimestamp}`;
    }

    if (!groupedEntries[groupKey]) {
      groupedEntries[groupKey] = [];
    }
    groupedEntries[groupKey].push(entry);
  });

  let grandTotal = 0;
  let rowIndex = 1;

  // Render grouped entries
  Object.values(groupedEntries).forEach(batch => {
    // Sort batch by ticketIndex if available, otherwise by ticket number
    batch.sort((a, b) => {
      if (a.ticketIndex && b.ticketIndex) {
        return a.ticketIndex - b.ticketIndex;
      }
      return safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber));
    });

    const firstEntry = batch[0];
    const totalQuantity = batch.length;

    // Calculate total price (may have mixed pricing)
    const totalPrice = batch.reduce((sum, entry) => {
      const unitPrice = toNumberSafe(entry.unitPrice, UNIT_PRICE);
      return sum + unitPrice;
    }, 0);

    grandTotal += totalPrice;

    const createdAt = firstEntry.createdAt ? new Date(firstEntry.createdAt).toLocaleString() : "—";

    // Check if any tickets in batch are early bird
    const hasEarlyBird = batch.some(entry => entry.isEarlyBird);
    const allEarlyBird = batch.every(entry => entry.isEarlyBird);

    // Create ticket number display
    let ticketNumberDisplay;
    if (batch.length === 1) {
      // Single ticket - just show the number with early bird indicator
      const earlyBirdBadge = firstEntry.isEarlyBird
        ? ' <span class="badge bg-info">EARLY BIRD</span>'
        : '';
      ticketNumberDisplay = safeStr(firstEntry.ticketNumber) + earlyBirdBadge;
    } else {
      // Multiple tickets - show "View Tickets" button
      const earlyBirdCount = batch.filter(entry => entry.isEarlyBird).length;

      let earlyBirdText = "";
      if (earlyBirdCount > 0) {
        if (earlyBirdCount === batch.length) {
          earlyBirdText = ' <span class="badge bg-info">ALL EARLY BIRD</span>';
        } else {
          earlyBirdText = ` <span class="badge bg-info">${earlyBirdCount} EARLY BIRD</span>`;
        }
      }

      ticketNumberDisplay = `
        <button class="btn btn-sm btn-primary view-tickets-btn" data-id="${firstEntry.id}" style="background: #7c3aed; border: none; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">
          View ${batch.length} tickets
        </button>
        ${earlyBirdText}
      `;
    }

    // Display unit price (show range if mixed pricing)
    let unitPriceDisplay;
    const prices = [...new Set(batch.map(entry => entry.unitPrice))];
    if (prices.length === 1) {
      unitPriceDisplay = formatCurrency(prices[0]);
    } else {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      unitPriceDisplay = `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="text-center">${rowIndex}</td>
      <td>${safeStr(firstEntry.schoolId)}</td>
      <td class="text-center">${ticketNumberDisplay}</td>
      <td>${safeStr(firstEntry.name)}</td>
      <td>${safeStr(firstEntry.lastname)}</td>
      <td>${safeStr(firstEntry.yrlvl)}</td>
      <td>${safeStr(firstEntry.department)}</td>
      <td class="text-center">${totalQuantity}</td>
      <td>${unitPriceDisplay}</td>
      <td>${formatCurrency(totalPrice)}</td>
      <td>${safeStr(firstEntry.soldBy || "—")}</td>
      <td>${createdAt}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-warning me-1" data-id="${firstEntry.id}" data-action="edit" title="Edit Purchase">✏️</button>
        <button class="btn btn-sm btn-danger" data-id="${firstEntry.id}" data-action="delete" title="Delete Purchase">🗑️</button>
      </td>
    `;
    studentTable.appendChild(row);
    rowIndex++;
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

  // Attach view tickets modal handlers
  studentTable.querySelectorAll(".view-tickets-btn").forEach(btn => {
    const id = btn.getAttribute("data-id");
    btn.onclick = () => openViewTicketsModal(id);
  });

  // ✅ Grand total now respects date filter
  if (grandTotalEl) grandTotalEl.textContent = formatCurrency(grandTotal);
}

// --------------------- Event Listeners ---------------------
searchInput?.addEventListener("input", renderTable);
filterDepartment?.addEventListener("change", renderTable);
document.getElementById("filterDate")?.addEventListener("change", renderTable);

// Clear filters button
const clearFiltersBtn = document.getElementById("clearFilters");
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (filterDepartment) filterDepartment.value = "";
    const filterDate = document.getElementById("filterDate");
    if (filterDate) filterDate.value = "";
    renderTable();
    showToast("Filters cleared", "info");
  });
}

// Track user as online
function trackUserOnline(user) {
  if (!user) return;

  const userDocRef = doc(db, "onlineUsers", user.uid);

  // Update user status every 30 seconds
  const updateStatus = async () => {
    try {
      await setDoc(userDocRef, {
        email: user.email,
        displayName: user.displayName || user.email,
        photoURL: user.photoURL || "",
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update online status:", err);
    }
  };

  // Initial update
  updateStatus();

  // Update every 30 seconds
  const intervalId = setInterval(updateStatus, 30000);

  // Clean up on page unload
  window.addEventListener("beforeunload", async () => {
    clearInterval(intervalId);
    try {
      await setDoc(userDocRef, {
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update status on unload:", err);
    }
  });
}

// Show admin link for admins
function showAdminLink() {
  const userProfile = document.getElementById("userProfile");
  if (userProfile && !document.getElementById("adminLink")) {
    const adminLink = document.createElement("a");
    adminLink.id = "adminLink";
    adminLink.href = "admin.html";
    adminLink.className = "btn btn-outline-primary btn-sm me-2";
    adminLink.innerHTML = "Super Admin";
    adminLink.style.marginRight = "1rem";
    userProfile.parentElement.insertBefore(adminLink, userProfile);
  }
}

// Initial render
renderTable();
