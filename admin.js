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
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase config
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

// Admin emails
const adminEmails = [
  "jasperace.lapitan@lorma.edu",
  "jsoriano@lorma.edu"
];

const UNIT_PRICE = 700;
let entries = [];
let deletedEntries = [];
let currentUser = null;
let deleteId = null;
let restoreId = null;
let onlineUsers = [];

// Helper functions
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
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Try to use the dashboard toast if available (unlikely in admin but good practice)
  const toastRoot = document.getElementById("appToast");
  if (toastRoot) {
    const body = toastRoot.querySelector(".toast-body");
    if (body) body.textContent = message;
    const bsToast = bootstrap.Toast.getOrCreateInstance(toastRoot);
    bsToast.show();
  }
}

// Expose functions to window for inline HTML events
window.filterByUser = function (user) {
  const select = document.getElementById("activityUser");
  if (select) {
    select.value = user;
    renderActivityTable();
    // Scroll to activity section
    document.getElementById("activityTableBody")?.scrollIntoView({ behavior: 'smooth' });
  }
};

window.openDeleteModal = openDeleteModal;
window.openRestoreModal = openRestoreModal;
window.openAdminViewTicketsModal = openAdminViewTicketsModal;
window.showOnlineUsers = function () {
  if (onlineUsersModal) onlineUsersModal.show();
};

// DOM elements
const logoutBtn = document.getElementById("logoutBtn");
const userNameEl = document.getElementById("userName");
const userPhotoEl = document.getElementById("userPhoto");
const deleteModalEl = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const restoreModalEl = document.getElementById("restoreModal");
const confirmRestoreBtn = document.getElementById("confirmRestoreBtn");
const clearAllModalEl = document.getElementById("clearAllModal");
const confirmClearAllBtn = document.getElementById("confirmClearAllBtn");
const clearDeletedBtn = document.getElementById("clearDeletedBtn");
const adminViewTicketsModalEl = document.getElementById("adminViewTicketsModal");

const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
const restoreModal = restoreModalEl ? new bootstrap.Modal(restoreModalEl) : null;
const clearAllModal = clearAllModalEl ? new bootstrap.Modal(clearAllModalEl) : null;
const adminViewTicketsModal = adminViewTicketsModalEl ? new bootstrap.Modal(adminViewTicketsModalEl) : null;

// Online Users Modal
const onlineUsersModalEl = document.getElementById("onlineUsersModal");
const onlineUsersModal = onlineUsersModalEl ? new bootstrap.Modal(onlineUsersModalEl) : null;

// Auth check
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!adminEmails.includes(user.email)) {
        showToast("Access Denied: Admin privileges required");
        setTimeout(() => window.location.href = "dashboard.html", 1000);
        return;
      }

      currentUser = user;
      if (userNameEl) userNameEl.textContent = user.displayName || user.email;
      if (userPhotoEl && user.photoURL) userPhotoEl.src = user.photoURL;

      loadData();
      listenToOnlineUsers();
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
        showToast("Logout failed: " + err.message);
      }
    });
  }

  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDelete);
  if (confirmRestoreBtn) confirmRestoreBtn.addEventListener("click", confirmRestore);
  if (confirmClearAllBtn) confirmClearAllBtn.addEventListener("click", confirmClearAll);
  if (clearDeletedBtn) clearDeletedBtn.addEventListener("click", openClearAllModal);
});

// Chart instance and date offset
let salesChart = null;
let chartDateOffset = 0; // 0 = current week, -7 = previous week, etc.

// Load all data
function loadData() {
  const entriesRef = collection(db, "entries");

  onSnapshot(entriesRef, (snapshot) => {
    entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats();
    renderUserTable();
    renderDeptTable();
    renderActivityTable();
    populateUserFilter();
    renderActivityTable();
    populateUserFilter();
    renderSalesChart();
  }, (error) => {
  }, (error) => {
    console.error("Error loading data:", error);
    showToast("Failed to load data: " + error.message);
  });

  // Load deleted entries
  const deletedRef = collection(db, "deletedEntries");

  onSnapshot(deletedRef, (snapshot) => {
    deletedEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDeletedTable();
  }, (error) => {
    console.error("Error loading deleted entries:", error);
  });
}

// Listen to online users
function listenToOnlineUsers() {
  const onlineUsersRef = collection(db, "onlineUsers");

  onSnapshot(onlineUsersRef, (snapshot) => {
    const now = Date.now();
    onlineUsers = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(user => {
        // Consider user online if last seen within 2 minutes
        if (!user.lastSeen) return false;
        const lastSeen = user.lastSeen.toMillis ? user.lastSeen.toMillis() : user.lastSeen;
        return (now - lastSeen) < 120000; // 2 minutes
      });

    updateOnlineUsersCount();
  }, (error) => {
    console.error("Error listening to online users:", error);
  });
}

// Update online users count
function updateOnlineUsersCount() {
  const totalUsersEl = document.getElementById("totalUsers");
  if (totalUsersEl) {
    totalUsersEl.textContent = onlineUsers.length;
  }
}

// Update statistics
function updateStats() {
  const totalEntriesEl = document.getElementById("totalEntries");
  const totalRevenueEl = document.getElementById("totalRevenue");
  const totalUsersEl = document.getElementById("totalUsers");
  const todayEntriesEl = document.getElementById("todayEntries");

  const totalEntries = entries.length;
  const totalRevenue = entries.reduce((sum, e) => {
    const qty = toNumberSafe(e.quantity, 0);
    const price = toNumberSafe(e.unitPrice, UNIT_PRICE);
    return sum + (qty * price);
  }, 0);

  const uniqueUsers = new Set(entries.map(e => e.soldBy)).size;

  const today = new Date().toISOString().split('T')[0];
  const todayQuantity = entries.filter(e => {
    if (!e.createdAt) return false;
    const entryDate = new Date(e.createdAt).toISOString().split('T')[0];
    return entryDate === today;
  }).reduce((sum, e) => {
    const qty = toNumberSafe(e.quantity, 0);
    return sum + qty;
  }, 0);

  if (totalEntriesEl) totalEntriesEl.textContent = totalEntries;
  if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(totalRevenue);
  if (totalUsersEl) totalUsersEl.textContent = uniqueUsers;
  if (todayEntriesEl) todayEntriesEl.textContent = todayQuantity;
}

// Render user table
function renderUserTable() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;

  const searchVal = safeStr(document.getElementById("userSearch")?.value).toLowerCase();

  // Group by user and track last activity
  const userStats = {};
  entries.forEach(e => {
    const user = safeStr(e.soldBy || "Unknown");
    if (!userStats[user]) {
      userStats[user] = {
        entries: 0,
        totalSales: 0,
        lastActivity: null
      };
    }
    userStats[user].entries++;
    const qty = toNumberSafe(e.quantity, 0);
    const price = toNumberSafe(e.unitPrice, UNIT_PRICE);
    userStats[user].totalSales += qty * price;

    // Track last activity
    if (e.createdAt) {
      const activityDate = new Date(e.createdAt);
      if (!userStats[user].lastActivity || activityDate > userStats[user].lastActivity) {
        userStats[user].lastActivity = activityDate;
      }
    }
  });

  tbody.innerHTML = "";

  Object.entries(userStats)
    .filter(([user]) => {
      // Include all users (including current user)
      return user.toLowerCase().includes(searchVal);
    })
    .sort((a, b) => {
      // Sort by last activity (most recent first)
      const dateA = a[1].lastActivity || new Date(0);
      const dateB = b[1].lastActivity || new Date(0);
      return dateB - dateA;
    })
    .forEach(([user, stats]) => {
      // Check if this is the current user
      const isCurrentUser = currentUser && user === currentUser.email;
      // Extract name from email (part before @)
      const displayName = user.includes('@')
        ? user.split('@')[0].replace(/\./g, ' ').split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
        : user;

      // Determine role
      const role = adminEmails.includes(user) ? "Admin" : "Seller";
      const roleClass = role === "Admin" ? "bg-danger" : "bg-primary";

      // Format last activity
      let lastActivityText = "—";
      if (stats.lastActivity) {
        const now = new Date();
        const diffMs = now - stats.lastActivity;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
          lastActivityText = "Just now";
        } else if (diffMins < 60) {
          lastActivityText = `${diffMins}m ago`;
        } else if (diffHours < 24) {
          lastActivityText = `${diffHours}h ago`;
        } else if (diffDays < 7) {
          lastActivityText = `${diffDays}d ago`;
        } else {
          lastActivityText = stats.lastActivity.toLocaleDateString();
        }
      }

      const row = document.createElement("tr");
      // Add highlight class for current user
      if (isCurrentUser) {
        row.style.backgroundColor = "rgba(124, 58, 237, 0.08)";
      }

      row.innerHTML = `
        <td><small>${user}${isCurrentUser ? ' <span class="badge bg-success" style="font-size: 0.65rem;">You</span>' : ''}</small></td>
        <td><strong>${displayName}</strong></td>
        <td class="text-center">
          <span class="badge ${roleClass}">${role}</span>
        </td>
        <td class="text-center">
          <small class="text-muted">${lastActivityText}</small>
        </td>
        <td class="text-center">${stats.entries}</td>
        <td class="text-center">${formatCurrency(stats.totalSales)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-info" onclick="filterByUser('${user}')">📊 View</button>
        </td>
      `;
      tbody.appendChild(row);
    });

  // Show message if no users found
  if (tbody.children.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">No users found</td>
      </tr>
    `;
  }
}

// Render department table
function renderDeptTable() {
  const tbody = document.getElementById("deptTableBody");
  if (!tbody) return;

  const deptStats = {};
  entries.forEach(e => {
    const dept = safeStr(e.department || "Unknown");
    if (!deptStats[dept]) {
      deptStats[dept] = { entries: 0, quantity: 0, revenue: 0 };
    }
    deptStats[dept].entries++;
    const qty = toNumberSafe(e.quantity, 0);
    const price = toNumberSafe(e.unitPrice, UNIT_PRICE);
    deptStats[dept].quantity += qty;
    deptStats[dept].revenue += qty * price;
  });

  tbody.innerHTML = "";

  Object.entries(deptStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .forEach(([dept, stats]) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${dept}</strong></td>
        <td class="text-center">${stats.entries}</td>
        <td class="text-center">${stats.quantity}</td>
        <td class="text-center">${formatCurrency(stats.revenue)}</td>
      `;
      tbody.appendChild(row);
    });
}

// Render activity table
function renderActivityTable() {
  const tbody = document.getElementById("activityTableBody");
  if (!tbody) return;

  const filterVal = document.getElementById("activityFilter")?.value || "all";
  const userVal = document.getElementById("activityUser")?.value || "";
  const searchVal = safeStr(document.getElementById("activitySearch")?.value).toLowerCase();

  let filtered = [...entries];

  // Filter by search (ID, Ticket Number, or Name)
  if (searchVal) {
    filtered = filtered.filter(e => {
      const schoolId = safeStr(e.schoolId).toLowerCase();
      const ticketNumber = safeStr(e.ticketNumber).toLowerCase();
      const name = safeStr(e.name).toLowerCase();
      const lastname = safeStr(e.lastname).toLowerCase();
      const fullName = `${name} ${lastname}`;
      return schoolId.includes(searchVal) || ticketNumber.includes(searchVal) || fullName.includes(searchVal) || name.includes(searchVal) || lastname.includes(searchVal);
    });
  }

  // Filter by time
  if (filterVal !== "all") {
    const now = new Date();
    filtered = filtered.filter(e => {
      if (!e.createdAt) return false;
      const entryDate = new Date(e.createdAt);

      if (filterVal === "today") {
        return entryDate.toDateString() === now.toDateString();
      } else if (filterVal === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return entryDate >= weekAgo;
      } else if (filterVal === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return entryDate >= monthAgo;
      }
      return true;
    });
  }

  // Filter by user
  if (userVal) {
    filtered = filtered.filter(e => safeStr(e.soldBy) === userVal);
  }

  // Group entries by batchId or by schoolId + timestamp for entries bought together
  const groupedEntries = {};
  filtered.forEach(entry => {
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

  // Sort grouped entries by time (first come first serve - oldest first)
  const sortedBatches = Object.values(groupedEntries).sort((a, b) => {
    const dateA = a[0].createdAt ? new Date(a[0].createdAt) : new Date(0);
    const dateB = b[0].createdAt ? new Date(b[0].createdAt) : new Date(0);
    return dateA - dateB; // Ascending order (oldest first - first come first serve)
  });

  tbody.innerHTML = "";

  if (sortedBatches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted">No activities found</td>
      </tr>
    `;
    return;
  }

  sortedBatches.forEach((batch, index) => {
    // Sort batch by ticket number
    batch.sort((a, b) => safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber)));

    const firstEntry = batch[0];
    const totalQuantity = batch.length;
    const totalPrice = batch.reduce((sum, e) => {
      const qty = toNumberSafe(e.quantity, 0);
      const price = toNumberSafe(e.unitPrice, UNIT_PRICE);
      return sum + (qty * price);
    }, 0);

    const timestamp = firstEntry.createdAt ? new Date(firstEntry.createdAt).toLocaleString() : "—";
    const soldByDisplay = firstEntry.soldByName || safeStr(firstEntry.soldBy || "—");

    // Create ticket number display
    let ticketNumberDisplay;
    if (batch.length === 1) {
      // Single ticket
      const ticketNum = safeStr(firstEntry.ticketNumber);
      ticketNumberDisplay = ticketNum || "—";
    } else {
      // Multiple tickets - show "View Tickets" button
      ticketNumberDisplay = `
        <button class="btn btn-sm btn-primary view-admin-tickets-btn" 
                data-school-id="${safeStr(firstEntry.schoolId)}" 
                data-timestamp="${firstEntry.createdAt}"
                style="background: #7c3aed; border: none; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">
          View ${batch.length} tickets
        </button>
      `;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="text-center">${index + 1}</td>
      <td>${safeStr(firstEntry.schoolId)}</td>
      <td>${ticketNumberDisplay}</td>
      <td>${safeStr(firstEntry.name)} ${safeStr(firstEntry.lastname)}</td>
      <td>${safeStr(firstEntry.department)}</td>
      <td class="text-center">${totalQuantity}</td>
      <td class="text-center">${formatCurrency(totalPrice)}</td>
      <td>${soldByDisplay}</td>
      <td>${timestamp}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger" data-id="${firstEntry.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach delete handlers
  tbody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => openDeleteModal(btn.getAttribute("data-id"));
  });

  // Attach view tickets modal handlers
  tbody.querySelectorAll(".view-admin-tickets-btn").forEach(btn => {
    const schoolId = btn.getAttribute("data-school-id");
    const timestamp = btn.getAttribute("data-timestamp");
    btn.onclick = () => openAdminViewTicketsModal(schoolId, timestamp);
  });
}

// Populate user filter dropdown
function populateUserFilter() {
  const select = document.getElementById("activityUser");
  if (!select) return;

  const users = [...new Set(entries.map(e => e.soldBy).filter(Boolean))];

  select.innerHTML = '<option value="">All Users</option>';
  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    select.appendChild(option);
  });
}

// Delete functions
function openDeleteModal(id) {
  deleteId = id;
  if (deleteModal) deleteModal.show();
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    // Get the entry data before deleting
    const entryToDelete = entries.find(e => e.id === deleteId);
    if (!entryToDelete) {
      showToast("Entry not found");
      return;
    }

    // Add deletion metadata
    const deletedEntry = {
      ...entryToDelete,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser ? currentUser.email : "Unknown",
      deletedByName: currentUser ? currentUser.displayName || currentUser.email : "Unknown",
      originalId: deleteId
    };

    // Move to deletedEntries collection
    await setDoc(doc(db, "deletedEntries", deleteId), deletedEntry);

    // Delete from entries collection
    await deleteDoc(doc(db, "entries", deleteId));

    if (deleteModal) deleteModal.hide();
    showToast("Entry moved to Recently Deleted");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Failed to delete entry: " + err.message);
  } finally {
    deleteId = null;
  }
}

// Restore functions
function openRestoreModal(id) {
  restoreId = id;
  if (restoreModal) restoreModal.show();
}

async function confirmRestore() {
  if (!restoreId) return;

  try {
    // Get the deleted entry
    const entryToRestore = deletedEntries.find(e => e.id === restoreId);
    if (!entryToRestore) {
      showToast("Entry not found");
      return;
    }

    // Check if this is a grouped entry (new format) or individual entry (old format)
    if (entryToRestore.ticketDetails && entryToRestore.ticketDetails.length > 0) {
      // New grouped format - restore individual tickets
      const restorePromises = [];

      for (const ticketDetail of entryToRestore.ticketDetails) {
        const restoredTicket = {
          schoolId: entryToRestore.schoolId,
          ticketNumber: ticketDetail.ticketNumber,
          name: entryToRestore.name,
          lastname: entryToRestore.lastname,
          yrlvl: entryToRestore.yrlvl,
          department: entryToRestore.department,
          quantity: 1, // Each entry represents 1 ticket
          unitPrice: ticketDetail.unitPrice,
          isEarlyBird: ticketDetail.isEarlyBird,
          ticketIndex: ticketDetail.ticketIndex,
          soldStatus: "available", // Reset to available on restore
          soldAt: null,
          createdAt: entryToRestore.createdAt,
          soldBy: entryToRestore.soldBy,
          soldByName: entryToRestore.soldByName,
          batchId: entryToRestore.batchId,
          totalTicketsInBatch: entryToRestore.quantity
        };

        // Use original ID if available, otherwise generate new one
        if (ticketDetail.id) {
          restorePromises.push(setDoc(doc(db, "entries", ticketDetail.id), restoredTicket));
        } else {
          restorePromises.push(addDoc(collection(db, "entries"), restoredTicket));
        }
      }

      // Execute all restore operations
      await Promise.all(restorePromises);

      showToast(`${entryToRestore.quantity} tickets restored successfully`);
    } else {
      // Old individual format - restore as single entry
      const { deletedAt, deletedBy, deletedByName, originalId, ticketNumbers, ticketDetails, totalPrice, ...restoredEntry } = entryToRestore;

      // Move back to entries collection using original ID if available
      const restoreDocId = originalId || restoreId;
      await setDoc(doc(db, "entries", restoreDocId), restoredEntry);

      showToast("Entry restored successfully");
    }

    // Delete from deletedEntries collection
    await deleteDoc(doc(db, "deletedEntries", restoreId));

    if (restoreModal) restoreModal.hide();
  } catch (err) {
    console.error("Restore failed:", err);
    showToast("Failed to restore entry: " + err.message);
  } finally {
    restoreId = null;
  }
}

// Permanently delete a single entry
async function permanentlyDelete(id) {
  try {
    await deleteDoc(doc(db, "deletedEntries", id));
    showToast("Entry permanently deleted");
  } catch (err) {
    console.error("Permanent delete failed:", err);
    showToast("Failed to permanently delete entry: " + err.message);
  }
}

// Clear all deleted entries
function openClearAllModal() {
  if (deletedEntries.length === 0) {
    showToast("No deleted entries to clear");
    return;
  }
  if (clearAllModal) clearAllModal.show();
}

async function confirmClearAll() {
  try {
    const deletePromises = deletedEntries.map(entry =>
      deleteDoc(doc(db, "deletedEntries", entry.id))
    );

    await Promise.all(deletePromises);

    if (clearAllModal) clearAllModal.hide();
    showToast(`Cleared ${deletePromises.length} deleted entries permanently`);
  } catch (err) {
    console.error("Clear all failed:", err);
    showToast("Failed to clear deleted entries: " + err.message);
  }
}

// Render deleted entries table
function renderDeletedTable() {
  const tbody = document.getElementById("deletedTableBody");
  if (!tbody) return;

  const searchVal = safeStr(document.getElementById("deletedSearch")?.value).toLowerCase();

  tbody.innerHTML = "";

  if (deletedEntries.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted py-4">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✨</div>
          <div>No deleted Sales</div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by deletion date (newest first)
  let sorted = [...deletedEntries].sort((a, b) => {
    const dateA = a.deletedAt ? new Date(a.deletedAt) : new Date(0);
    const dateB = b.deletedAt ? new Date(b.deletedAt) : new Date(0);
    return dateB - dateA;
  });

  // Filter by search (ID, Ticket Number, or Name)
  if (searchVal) {
    sorted = sorted.filter(e => {
      const schoolId = safeStr(e.schoolId).toLowerCase();
      const ticketNumber = safeStr(e.ticketNumber).toLowerCase();
      const ticketNumbers = safeStr(e.ticketNumbers).toLowerCase(); // New grouped format
      const name = safeStr(e.name).toLowerCase();
      const lastname = safeStr(e.lastname).toLowerCase();
      const fullName = `${name} ${lastname}`;
      return schoolId.includes(searchVal) ||
        ticketNumber.includes(searchVal) ||
        ticketNumbers.includes(searchVal) ||
        fullName.includes(searchVal) ||
        name.includes(searchVal) ||
        lastname.includes(searchVal);
    });
  }

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted py-4">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div>No matching entries found</div>
        </td>
      </tr>
    `;
    return;
  }

  sorted.forEach((e, index) => {
    const qty = toNumberSafe(e.quantity, 0);

    // Handle both old individual entries and new grouped entries
    let price, total, ticketNumberDisplay;

    if (e.totalPrice) {
      // New grouped entry format
      total = toNumberSafe(e.totalPrice, 0);
      price = e.unitPrice === "Mixed" ? "Mixed" : toNumberSafe(e.unitPrice, UNIT_PRICE);

      // Create ticket number display
      if (qty === 1) {
        // Single ticket - show ticket number directly
        const ticketNumbers = safeStr(e.ticketNumbers);
        ticketNumberDisplay = ticketNumbers || "—";
      } else {
        // Multiple tickets - show "View Tickets" button
        ticketNumberDisplay = `
          <button class="btn btn-sm btn-primary view-deleted-tickets-btn" 
                  data-entry-index="${index}"
                  style="background: #7c3aed; border: none; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">
            View ${qty} tickets
          </button>
        `;
      }
    } else {
      // Old individual entry format
      price = toNumberSafe(e.unitPrice, UNIT_PRICE);
      total = qty * price;
      ticketNumberDisplay = safeStr(e.ticketNumber);
    }

    const deletedAt = e.deletedAt ? new Date(e.deletedAt).toLocaleString() : "—";
    const deletedBy = e.deletedByName || e.deletedBy || "—";

    const row = document.createElement("tr");
    row.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
    row.innerHTML = `
      <td class="text-center">${index + 1}</td>
      <td>${safeStr(e.schoolId)}</td>
      <td>${ticketNumberDisplay}</td>
      <td>${safeStr(e.name)} ${safeStr(e.lastname)}</td>
      <td>${safeStr(e.department)}</td>
      <td class="text-center">${qty}</td>
      <td class="text-center">${formatCurrency(total)}</td>
      <td><small>${deletedBy}</small></td>
      <td><small>${deletedAt}</small></td>
      <td class="text-center">
        <button class="btn btn-sm btn-success me-1" onclick="openRestoreModal('${e.id}')" title="Restore">
          ♻️
        </button>
        <button class="btn btn-sm btn-danger" onclick="permanentlyDelete('${e.id}')" title="Delete Permanently">
          🔥
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach view deleted tickets modal handlers
  tbody.querySelectorAll(".view-deleted-tickets-btn").forEach(btn => {
    const entryIndex = parseInt(btn.getAttribute("data-entry-index"));
    const deletedEntry = sorted[entryIndex];
    btn.onclick = () => openAdminDeletedViewTicketsModal(deletedEntry);
  });
}

function openAdminDeletedViewTicketsModal(deletedEntry) {
  // Create modal content for deleted entries
  const modalContent = document.getElementById("adminViewTicketsContent");
  if (!modalContent) return;

  // Handle both old individual entries and new grouped entries
  let ticketDetails = [];
  let entryInfo = {};

  if (deletedEntry.ticketDetails && deletedEntry.ticketDetails.length > 0) {
    // New grouped format
    ticketDetails = deletedEntry.ticketDetails;
    entryInfo = {
      name: deletedEntry.name,
      lastname: deletedEntry.lastname,
      schoolId: deletedEntry.schoolId,
      department: deletedEntry.department,
      yrlvl: deletedEntry.yrlvl,
      quantity: deletedEntry.quantity,
      totalPrice: deletedEntry.totalPrice
    };
  } else {
    // Old individual format or grouped format with ticketNumbers string
    if (deletedEntry.ticketNumbers) {
      // New grouped format but without ticketDetails array
      const ticketNumbersArray = deletedEntry.ticketNumbers.split(", ");
      ticketDetails = ticketNumbersArray.map(ticketNum => ({
        ticketNumber: ticketNum,
        unitPrice: deletedEntry.unitPrice === "Mixed" ? UNIT_PRICE : deletedEntry.unitPrice,
        isEarlyBird: false // Default since we don't have this info
      }));
      entryInfo = {
        name: deletedEntry.name,
        lastname: deletedEntry.lastname,
        schoolId: deletedEntry.schoolId,
        department: deletedEntry.department,
        yrlvl: deletedEntry.yrlvl,
        quantity: deletedEntry.quantity,
        totalPrice: deletedEntry.totalPrice
      };
    } else {
      // Old individual format
      ticketDetails = [{
        ticketNumber: deletedEntry.ticketNumber,
        unitPrice: deletedEntry.unitPrice,
        isEarlyBird: deletedEntry.isEarlyBird || false
      }];
      entryInfo = {
        name: deletedEntry.name,
        lastname: deletedEntry.lastname,
        schoolId: deletedEntry.schoolId,
        department: deletedEntry.department,
        yrlvl: deletedEntry.yrlvl,
        quantity: deletedEntry.quantity || 1,
        totalPrice: deletedEntry.unitPrice || 680
      };
    }
  }

  modalContent.innerHTML = `
    <div class="mb-4">
      <h6 class="fw-bold mb-3">Deleted Purchase Details</h6>
      <div class="alert alert-warning">
        <strong>⚠️ This purchase has been deleted</strong><br>
        <small>Deleted on: ${deletedEntry.deletedAt ? new Date(deletedEntry.deletedAt).toLocaleString() : '—'}</small><br>
        <small>Deleted by: ${deletedEntry.deletedByName || deletedEntry.deletedBy || '—'}</small>
      </div>
      <div class="row">
        <div class="col-md-6">
          <p><strong>Student:</strong> ${safeStr(entryInfo.name)} ${safeStr(entryInfo.lastname)}</p>
          <p><strong>ID Number:</strong> ${safeStr(entryInfo.schoolId)}</p>
          <p><strong>Department:</strong> ${safeStr(entryInfo.department)}</p>
        </div>
        <div class="col-md-6">
          <p><strong>Year Level:</strong> ${safeStr(entryInfo.yrlvl)}</p>
          <p><strong>Total Tickets:</strong> ${entryInfo.quantity}</p>
          <p><strong>Total Price:</strong> ${formatCurrency(entryInfo.totalPrice)}</p>
        </div>
      </div>
    </div>
    
    <h6 class="fw-bold mb-3">Deleted Ticket Numbers</h6>
    <div class="row g-2">
      ${ticketDetails.map(ticketDetail => {
    const earlyBirdBadge = ticketDetail.isEarlyBird
      ? '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Early Bird</span>'
      : '<span class="badge bg-secondary ms-2" style="font-size: 0.7rem;">Regular</span>';

    return `
          <div class="col-md-6 col-lg-4">
            <div class="card border-0 shadow-sm" style="background-color: #fee2e2;">
              <div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-bold text-danger" style="font-size: 0.9rem;">Ticket ${safeStr(ticketDetail.ticketNumber)}</span>
                  ${earlyBirdBadge}
                </div>
                <small class="text-muted">${formatCurrency(ticketDetail.unitPrice)}</small>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  if (adminViewTicketsModal) adminViewTicketsModal.show();
}

// Make functions global
window.openRestoreModal = openRestoreModal;
window.permanentlyDelete = permanentlyDelete;
window.openAdminViewTicketsModal = openAdminViewTicketsModal;
window.openAdminDeletedViewTicketsModal = openAdminDeletedViewTicketsModal;

function openAdminViewTicketsModal(schoolId, timestamp) {
  // Find all tickets in the same batch by schoolId and timestamp
  const targetTime = new Date(timestamp).getTime();
  const roundedTimestamp = Math.floor(targetTime / 60000) * 60000;

  let batchEntries = [];

  // First try to find by batchId
  const entryWithBatchId = entries.find(e =>
    safeStr(e.schoolId) === schoolId &&
    e.createdAt &&
    Math.abs(new Date(e.createdAt).getTime() - targetTime) < 60000
  );

  if (entryWithBatchId && entryWithBatchId.batchId) {
    batchEntries = entries.filter(e => e.batchId === entryWithBatchId.batchId);
  } else {
    // Fallback to grouping by schoolId + timestamp
    batchEntries = entries.filter(e => {
      if (safeStr(e.schoolId) !== schoolId) return false;
      if (!e.createdAt) return false;
      const eTimestamp = new Date(e.createdAt).getTime();
      const eRoundedTimestamp = Math.floor(eTimestamp / 60000) * 60000;
      return eRoundedTimestamp === roundedTimestamp;
    });
  }

  if (batchEntries.length === 0) {
    showToast("No tickets found for this entry");
    return;
  }

  // Sort batch entries by ticket number
  batchEntries.sort((a, b) => safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber)));

  // Create modal content
  const modalContent = document.getElementById("adminViewTicketsContent");
  if (modalContent) {
    const firstEntry = batchEntries[0];
    const totalPrice = batchEntries.reduce((sum, e) => sum + toNumberSafe(e.unitPrice, UNIT_PRICE), 0);

    modalContent.innerHTML = `
      <div class="mb-4">
        <h6 class="fw-bold mb-3">Purchase Details</h6>
        <div class="row">
          <div class="col-md-6">
            <p><strong>Student:</strong> ${safeStr(firstEntry.name)} ${safeStr(firstEntry.lastname)}</p>
            <p><strong>ID Number:</strong> ${safeStr(firstEntry.schoolId)}</p>
            <p><strong>Department:</strong> ${safeStr(firstEntry.department)}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Year Level:</strong> ${safeStr(firstEntry.yrlvl)}</p>
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

  if (adminViewTicketsModal) adminViewTicketsModal.show();
}

// Global filter function
window.filterByUser = function (user) {
  const select = document.getElementById("activityUser");
  if (select) {
    select.value = user;
    renderActivityTable();
  }
};

// Show online users modal
function showOnlineUsers() {
  const modalBody = document.getElementById("onlineUsersBody");
  if (!modalBody) return;

  modalBody.innerHTML = "";

  if (onlineUsers.length === 0) {
    modalBody.innerHTML = '<p class="text-center text-muted">No users currently online</p>';
  } else {
    const list = document.createElement("div");
    list.className = "list-group";

    onlineUsers.forEach(user => {
      const lastSeen = user.lastSeen?.toMillis ? user.lastSeen.toMillis() : user.lastSeen;
      const timeAgo = lastSeen ? Math.floor((Date.now() - lastSeen) / 1000) : 0;
      const timeText = timeAgo < 60 ? "Just now" : `${Math.floor(timeAgo / 60)}m ago`;

      const item = document.createElement("div");
      item.className = "list-group-item d-flex justify-content-between align-items-center";
      item.innerHTML = `
        <div>
          <div class="fw-bold">${safeStr(user.displayName || user.email)}</div>
          <small class="text-muted">${safeStr(user.email)}</small>
        </div>
        <div class="text-end">
          <span class="badge bg-success">🟢 Online</span>
          <br>
          <small class="text-muted">${timeText}</small>
        </div>
      `;
      list.appendChild(item);
    });

    modalBody.appendChild(list);
  }

  if (onlineUsersModal) onlineUsersModal.show();
}

// Make function global
window.showOnlineUsers = showOnlineUsers;

// Render sales chart
function renderSalesChart() {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  // Get 7 days based on offset
  const days = [];
  const salesData = [];
  const revenueData = [];

  const startDate = new Date();
  const endDate = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i + chartDateOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (i === 6) startDate.setTime(date.getTime());
    if (i === 0) endDate.setTime(date.getTime());

    days.push(dayName);

    // Count entries and revenue for this day
    const dayEntries = entries.filter(e => {
      if (!e.createdAt) return false;
      const entryDate = new Date(e.createdAt).toISOString().split('T')[0];
      return entryDate === dateStr;
    });

    salesData.push(dayEntries.length);

    const dayRevenue = dayEntries.reduce((sum, e) => {
      const qty = toNumberSafe(e.quantity, 0);
      const price = toNumberSafe(e.unitPrice, UNIT_PRICE);
      return sum + (qty * price);
    }, 0);

    revenueData.push(dayRevenue);
  }

  // Update date range display
  const dateRangeEl = document.getElementById("chartDateRange");
  if (dateRangeEl) {
    if (chartDateOffset === 0) {
      dateRangeEl.textContent = "Last 7 Days";
    } else {
      const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateRangeEl.textContent = `${startStr} - ${endStr}`;
    }
  }

  // Enable/disable next button if viewing future dates
  const nextBtn = document.getElementById("chartNextWeek");
  const todayBtn = document.getElementById("chartToday");
  if (nextBtn) {
    nextBtn.disabled = chartDateOffset >= 0;
    nextBtn.style.opacity = chartDateOffset >= 0 ? "0.5" : "1";
  }
  if (todayBtn) {
    todayBtn.disabled = chartDateOffset === 0;
    todayBtn.style.opacity = chartDateOffset === 0 ? "0.5" : "1";
  }

  // Destroy existing chart if it exists
  if (salesChart) {
    salesChart.destroy();
  }

  // Create new chart
  const ctx = canvas.getContext('2d');
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Number of Sales',
          data: salesData,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Revenue (₱)',
          data: revenueData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.dataset.yAxisID === 'y1') {
                label += '₱' + context.parsed.y.toLocaleString();
              } else {
                label += context.parsed.y;
              }
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Number of Sales',
            font: {
              size: 12,
              weight: '600'
            },
            color: '#7c3aed'
          },
          grid: {
            color: 'rgba(124, 58, 237, 0.1)'
          },
          ticks: {
            color: '#7c3aed',
            font: {
              weight: '600'
            },
            stepSize: 1,
            callback: function (value) {
              if (Number.isInteger(value)) {
                return value;
              }
            }
          },
          beginAtZero: true
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Revenue (₱)',
            font: {
              size: 12,
              weight: '600'
            },
            color: '#10b981'
          },
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: '#10b981',
            font: {
              weight: '600'
            },
            callback: function (value) {
              return '₱' + value.toLocaleString();
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              weight: '600'
            }
          }
        }
      }
    }
  });
}

// Chart navigation event listeners
document.getElementById("chartPrevWeek")?.addEventListener("click", () => {
  chartDateOffset -= 7;
  renderSalesChart();
});

document.getElementById("chartNextWeek")?.addEventListener("click", () => {
  if (chartDateOffset < 0) {
    chartDateOffset += 7;
    if (chartDateOffset > 0) chartDateOffset = 0;
    renderSalesChart();
  }
});

document.getElementById("chartToday")?.addEventListener("click", () => {
  chartDateOffset = 0;
  renderSalesChart();
});

// Event listeners
document.getElementById("userSearch")?.addEventListener("input", renderUserTable);
document.getElementById("activityFilter")?.addEventListener("change", renderActivityTable);
document.getElementById("activityUser")?.addEventListener("change", renderActivityTable);
document.getElementById("activitySearch")?.addEventListener("input", renderActivityTable);
document.getElementById("deletedSearch")?.addEventListener("input", renderDeletedTable);
