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
  addDoc,
  query,
  orderBy,
  limit
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

const PRICE_STUDENT = 300;
const PRICE_OUTSIDER = 700;
const UNIT_PRICE = PRICE_STUDENT;
let entries = [];
let deletedEntries = [];
let currentUser = null;
let deleteId = null;
let restoreId = null;
let onlineUsers = [];

// Activity pagination variables
let activityCurrentPage = 1;
const activityEntriesPerPage = 10;
let activityTotalPages = 1;

// Helper functions
function safeStr(v) {
  return (v === undefined || v === null) ? "" : String(v);
}

function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Helper function to update admin entries with recent changes
function updateAdminEntriesWithRecent(recentEntries) {
  // Update existing entries or add new ones
  recentEntries.forEach(recentEntry => {
    const existingIndex = entries.findIndex(e => e.id === recentEntry.id);
    if (existingIndex >= 0) {
      entries[existingIndex] = recentEntry; // Update existing
    } else {
      entries.unshift(recentEntry); // Add new at beginning
    }
  });
  
  // Remove entries that might have been deleted (only check recent ones)
  const recentIds = new Set(recentEntries.map(e => e.id));
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  entries = entries.filter(entry => {
    // Keep entries that are either in recent list or older than 1 day
    const entryTime = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    return recentIds.has(entry.id) || entryTime < oneDayAgo;
  });
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
window.openPermanentDeleteModal = openPermanentDeleteModal;
window.openUserStatsModal = openUserStatsModal; // New function
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
const permanentDeleteModalEl = document.getElementById("permanentDeleteModal");
const confirmPermanentDeleteBtn = document.getElementById("confirmPermanentDeleteBtn");
const userStatsModalEl = document.getElementById("userStatsModal"); // New Element

const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
const restoreModal = restoreModalEl ? new bootstrap.Modal(restoreModalEl) : null;
const clearAllModal = clearAllModalEl ? new bootstrap.Modal(clearAllModalEl) : null;
const adminViewTicketsModal = adminViewTicketsModalEl ? new bootstrap.Modal(adminViewTicketsModalEl) : null;
const permanentDeleteModal = permanentDeleteModalEl ? new bootstrap.Modal(permanentDeleteModalEl) : null;
const userStatsModal = userStatsModalEl ? new bootstrap.Modal(userStatsModalEl) : null; // New Modal

// Online Users Modal
const onlineUsersModalEl = document.getElementById("onlineUsersModal");
const onlineUsersModal = onlineUsersModalEl ? new bootstrap.Modal(onlineUsersModalEl) : null;

// Global state for permanent delete
let permanentDeleteId = null;

// Activity pagination elements
const activityPaginationContainer = document.getElementById("activityPaginationContainer");
const activityPrevPageBtn = document.getElementById("activityPrevPageBtn");
const activityNextPageBtn = document.getElementById("activityNextPageBtn");
const activityPageNumbers = document.getElementById("activityPageNumbers");
const activityShowingStart = document.getElementById("activityShowingStart");
const activityShowingEnd = document.getElementById("activityShowingEnd");
const activityTotalEntriesEl = document.getElementById("activityTotalEntries");

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
  if (confirmPermanentDeleteBtn) confirmPermanentDeleteBtn.addEventListener("click", confirmPermanentDelete); // New listener
  if (clearDeletedBtn) clearDeletedBtn.addEventListener("click", openClearAllModal);

  // Activity pagination event listeners
  if (activityPrevPageBtn) {
    activityPrevPageBtn.addEventListener("click", () => {
      if (activityCurrentPage > 1) {
        activityCurrentPage--;
        renderActivityTable();
      }
    });
  }

  if (activityNextPageBtn) {
    activityNextPageBtn.addEventListener("click", () => {
      if (activityCurrentPage < activityTotalPages) {
        activityCurrentPage++;
        renderActivityTable();
      }
    });
  }
});

// Chart instance and date offset
let salesChart = null;
let chartDateOffset = 0; // 0 = current week, -7 = previous week, etc.

// Load all data
function loadData() {
  const entriesRef = collection(db, "entries");
  
  // For admin, listen to recent entries only (last 100)
  const recentEntriesQuery = query(
    entriesRef, 
    orderBy("createdAt", "desc"), 
    limit(100)
  );

  onSnapshot(recentEntriesQuery, async (snapshot) => {
    const recentEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // If first load, get all entries once
    if (entries.length === 0) {
      try {
        const allSnapshot = await getDocs(entriesRef);
        entries = allSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Admin loaded ${entries.length} entries (one-time read)`);
      } catch (error) {
        console.error("Failed to load all entries:", error);
        entries = recentEntries; // Fallback to recent entries
      }
    } else {
      // Update with recent changes only
      updateAdminEntriesWithRecent(recentEntries);
    }
    
    updateStats();
    renderUserTable();
    renderDeptTable();
    renderActivityTable();
    populateUserFilter();
    renderSalesChart();
  }, (error) => {
    console.error("Error loading data:", error);
    showToast("Failed to load data: " + error.message);
  });

  // Load deleted entries
  const deletedRef = collection(db, "deletedEntries");

  onSnapshot(deletedRef, (snapshot) => {
    console.log("Deleted entries snapshot received:", snapshot.docs.length, "documents");
    deletedEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("Updated deletedEntries array:", deletedEntries.length, "entries");
    renderDeletedTable();
  }, (error) => {
    console.error("Error loading deleted entries:", error);
    showToast("Failed to load deleted entries: " + error.message, "danger");
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

  const today = new Date();
  const todayEntries = entries.filter(e => {
    if (!e.createdAt) return false;
    const entryDate = new Date(e.createdAt);
    return entryDate.toDateString() === today.toDateString();
  });
  const todayQuantity = todayEntries.length;

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
          <button class="btn btn-sm btn-info" onclick="openUserStatsModal('${user}')">📊 View Stats</button>
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

  // Sort grouped entries by time (newest first for recent activity)
  const sortedBatches = Object.values(groupedEntries).sort((a, b) => {
    const dateA = a[0].createdAt ? new Date(a[0].createdAt) : new Date(0);
    const dateB = b[0].createdAt ? new Date(b[0].createdAt) : new Date(0);
    return dateB - dateA; // Descending order (newest first for recent activity)
  });

  tbody.innerHTML = "";

  if (sortedBatches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted">No activities found</td>
      </tr>
    `;
    hideActivityPagination();
    return;
  }

  // Calculate pagination
  const totalBatches = sortedBatches.length;
  activityTotalPages = Math.ceil(totalBatches / activityEntriesPerPage);
  
  // Reset to page 1 if current page is beyond total pages
  if (activityCurrentPage > activityTotalPages && activityTotalPages > 0) {
    activityCurrentPage = 1;
  }
  
  // Get entries for current page
  const startIndex = (activityCurrentPage - 1) * activityEntriesPerPage;
  const endIndex = startIndex + activityEntriesPerPage;
  const currentPageBatches = sortedBatches.slice(startIndex, endIndex);

  let globalRowIndex = startIndex + 1; // Global row numbering

  // Render current page batches
  currentPageBatches.forEach(batch => {
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
      <td class="text-center">${globalRowIndex}</td>
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
    globalRowIndex++;
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

  // Update pagination
  updateActivityPagination(totalBatches);
}

// Activity pagination helper functions
function updateActivityPagination(totalEntries) {
  if (totalEntries <= activityEntriesPerPage) {
    hideActivityPagination();
    return;
  }

  showActivityPagination();

  // Update pagination info
  const start = (activityCurrentPage - 1) * activityEntriesPerPage + 1;
  const end = Math.min(activityCurrentPage * activityEntriesPerPage, totalEntries);
  
  if (activityShowingStart) activityShowingStart.textContent = start;
  if (activityShowingEnd) activityShowingEnd.textContent = end;
  if (activityTotalEntriesEl) activityTotalEntriesEl.textContent = totalEntries;

  // Update button states
  if (activityPrevPageBtn) {
    activityPrevPageBtn.disabled = activityCurrentPage === 1;
  }
  if (activityNextPageBtn) {
    activityNextPageBtn.disabled = activityCurrentPage === activityTotalPages;
  }

  // Update page numbers
  updateActivityPageNumbers();
}

function updateActivityPageNumbers() {
  if (!activityPageNumbers) return;

  activityPageNumbers.innerHTML = "";

  // Show only 3 page numbers at a time
  const maxVisiblePages = 3;
  
  // Calculate the window of pages to show
  let startPage, endPage;
  
  if (activityTotalPages <= maxVisiblePages) {
    // If total pages is 3 or less, show all pages
    startPage = 1;
    endPage = activityTotalPages;
  } else {
    // Calculate sliding window
    if (activityCurrentPage === 1) {
      // At the beginning: show 1, 2, 3
      startPage = 1;
      endPage = maxVisiblePages;
    } else if (activityCurrentPage === activityTotalPages) {
      // At the end: show last 3 pages
      startPage = activityTotalPages - maxVisiblePages + 1;
      endPage = activityTotalPages;
    } else {
      // In the middle: show current page in center
      startPage = activityCurrentPage - 1;
      endPage = activityCurrentPage + 1;
    }
  }

  // Add page number buttons
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = i === activityCurrentPage 
      ? "btn btn-primary btn-sm" 
      : "btn btn-outline-secondary btn-sm";
    pageBtn.textContent = i;
    pageBtn.onclick = () => goToActivityPage(i);
    activityPageNumbers.appendChild(pageBtn);
  }

  // Add ellipsis after the visible pages if there are more pages
  if (endPage < activityTotalPages) {
    const ellipsis = document.createElement("span");
    ellipsis.className = "px-2 text-muted";
    ellipsis.textContent = "...";
    activityPageNumbers.appendChild(ellipsis);
  }
}

function goToActivityPage(page) {
  if (page >= 1 && page <= activityTotalPages) {
    activityCurrentPage = page;
    renderActivityTable();
  }
}

function showActivityPagination() {
  if (activityPaginationContainer) {
    activityPaginationContainer.style.display = "flex";
  }
}

function hideActivityPagination() {
  if (activityPaginationContainer) {
    activityPaginationContainer.style.display = "none";
  }
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

// Open User Stats Modal
function openUserStatsModal(userEmail) {
  if (!userStatsModal) return;

  // Set User Name in Title
  const displayName = userEmail.includes('@')
    ? userEmail.split('@')[0].replace(/\./g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : userEmail;

  const titleEl = document.getElementById("userStatsName");
  if (titleEl) titleEl.textContent = displayName;

  // Filter entries for this user
  const userEntries = entries.filter(e => safeStr(e.soldBy) === userEmail);

  // 1. Calculate Daily Stats
  const dailyStats = {};
  userEntries.forEach(e => {
    if (!e.createdAt) return;
    const dateKey = new Date(e.createdAt).toLocaleDateString(); // e.g., "1/25/2026"

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        date: new Date(e.createdAt),
        quantity: 0,
        revenue: 0
      };
    }

    const qty = toNumberSafe(e.quantity, 0);
    const price = toNumberSafe(e.unitPrice, UNIT_PRICE);

    dailyStats[dateKey].quantity += qty;
    dailyStats[dateKey].revenue += (qty * price);
  });

  // Render Daily Table
  const dailyTbody = document.getElementById("userDailyTableBody");
  const dailyTotalQtyEl = document.getElementById("userDailyTotalQty");
  const dailyTotalRevEl = document.getElementById("userDailyTotalRev");

  if (dailyTbody) {
    dailyTbody.innerHTML = "";

    // Sort by date descending
    const sortedDays = Object.values(dailyStats).sort((a, b) => b.date - a.date);

    let totalQty = 0;
    let totalRev = 0;

    if (sortedDays.length === 0) {
      dailyTbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No sales records found</td></tr>`;
    } else {
      sortedDays.forEach(stat => {
        totalQty += stat.quantity;
        totalRev += stat.revenue;

        const row = document.createElement("tr");
        const formattedDate = stat.date.toLocaleDateString(undefined, {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });

        row.innerHTML = `
          <td class="ps-3 fw-medium">${formattedDate}</td>
          <td class="text-center">${stat.quantity}</td>
          <td class="text-end pe-3 text-success fw-medium">${formatCurrency(stat.revenue)}</td>
        `;
        dailyTbody.appendChild(row);
      });
    }

    if (dailyTotalQtyEl) dailyTotalQtyEl.textContent = totalQty;
    if (dailyTotalRevEl) dailyTotalRevEl.textContent = formatCurrency(totalRev);
  }

  // 2. Render History Table
  const historyTbody = document.getElementById("userHistoryTableBody");
  const historySearch = document.getElementById("userHistorySearch");

  const renderHistory = (records) => {
    if (!historyTbody) return;
    historyTbody.innerHTML = "";

    if (records.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>`;
      return;
    }

    // Sort entries descending
    const sortedEntries = [...records].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });

    sortedEntries.forEach(e => {
      const time = e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
      const ticket = safeStr(e.ticketNumber) || "—";

      // Determine type based on ticketType field first, then fallback to department/price logic
      let typeDisplay = "College Student";
      let typeBadgeClass = "bg-info";
      
      if (e.ticketType) {
        // Use the actual ticketType field
        switch (e.ticketType) {
          case "College Student":
            typeDisplay = "College Student";
            typeBadgeClass = "bg-info";
            break;
          case "Basic Education":
            typeDisplay = "Highschool";
            typeBadgeClass = "bg-success";
            break;
          case "Faculty/Staff":
            typeDisplay = "Faculty&Staff";
            typeBadgeClass = "bg-warning text-dark";
            break;
          case "Outsider":
            typeDisplay = "Outsider";
            typeBadgeClass = "bg-warning text-dark";
            break;
          default:
            typeDisplay = "College Student";
            typeBadgeClass = "bg-info";
        }
      } else {
        // Fallback logic for entries without ticketType field
        const department = safeStr(e.department);
        const yrlvl = safeStr(e.yrlvl);
        
        if (department === "Faculty & Staff" || yrlvl === "Faculty" || yrlvl === "Staff") {
          typeDisplay = "Faculty&Staff";
          typeBadgeClass = "bg-warning text-dark";
        } else if (department === "BES" || yrlvl.startsWith("Grade")) {
          typeDisplay = "Highschool";
          typeBadgeClass = "bg-success";
        } else if (e.unitPrice == 700) {
          typeDisplay = "Outsider";
          typeBadgeClass = "bg-warning text-dark";
        }
      }

      const typeBadge = `<span class="badge ${typeBadgeClass}" style="font-size:0.75rem">${typeDisplay}</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="ps-3 text-muted small">${time}</td>
        <td>${safeStr(e.schoolId)}</td>
        <td class="text-center fw-bold">${ticket}</td>
        <td>${safeStr(e.name)} ${safeStr(e.lastname)}</td>
        <td>${safeStr(e.department)}</td>
        <td>${typeBadge}</td>
        <td class="text-end pe-3">${formatCurrency(e.unitPrice)}</td>
      `;
      historyTbody.appendChild(row);
    });
  };

  // Initial render
  renderHistory(userEntries);

  // Attach search listener
  if (historySearch) {
    historySearch.value = "";
    historySearch.oninput = (e) => {
      const val = e.target.value.toLowerCase();
      const filtered = userEntries.filter(entry => {
        const sid = safeStr(entry.schoolId).toLowerCase();
        const ticket = safeStr(entry.ticketNumber).toLowerCase();
        const name = safeStr(entry.name).toLowerCase();
        const lastname = safeStr(entry.lastname).toLowerCase();
        const fullname = `${name} ${lastname}`;
        return sid.includes(val) || ticket.includes(val) || name.includes(val) || lastname.includes(val) || fullname.includes(val);
      });
      renderHistory(filtered);
    };
  }

  userStatsModal.show();
}

// Delete functions
function openDeleteModal(id) {
  deleteId = id;
  if (deleteModal) deleteModal.show();
}

async function confirmDelete() {
  if (!deleteId) return;

  const btn = document.getElementById("confirmDeleteBtn");
  if (btn) {
    if (btn.disabled) return; // Prevent double click
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
  }

  try {
    // Get the entry data before deleting
    const entryToDelete = entries.find(e => e.id === deleteId);
    if (!entryToDelete) {
      showToast("Entry not found", "warning");
      return;
    }

    // Identify all entries in this batch
    let batchEntries = [];
    let batchId = entryToDelete.batchId;

    if (batchId) {
      batchEntries = entries.filter(e => e.batchId === batchId);
    } else {
      // Fallback for legacy entries: group by schoolId + timestamp (same minute)
      const targetTime = new Date(entryToDelete.createdAt).getTime();
      const roundedTimestamp = Math.floor(targetTime / 60000) * 60000;

      batchEntries = entries.filter(e => {
        if (safeStr(e.schoolId) !== safeStr(entryToDelete.schoolId)) return false;
        if (!e.createdAt) return false;
        const eTimestamp = new Date(e.createdAt).getTime();
        const eRoundedTimestamp = Math.floor(eTimestamp / 60000) * 60000;
        return eRoundedTimestamp === roundedTimestamp;
      });

      // Generate a new batchId for this group if one doesn't exist
      batchId = `${safeStr(entryToDelete.schoolId)}_${Date.now()}`;
    }

    // Safety fallback
    if (batchEntries.length === 0) batchEntries = [entryToDelete];

    // Create aggregated delete record
    const totalPrice = batchEntries.reduce((sum, e) => sum + toNumberSafe(e.unitPrice, 0), 0);
    const ticketNumbers = batchEntries.map(e => safeStr(e.ticketNumber)).join(", ");

    // Helper function to sanitize data for Firestore (remove undefined values)
    function sanitizeForFirestore(obj) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          if (value === null || typeof value !== 'object') {
            sanitized[key] = value;
          } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item =>
              typeof item === 'object' ? sanitizeForFirestore(item) : item
            );
          } else {
            sanitized[key] = sanitizeForFirestore(value);
          }
        }
      }
      return sanitized;
    }

    const groupedDeletedEntry = sanitizeForFirestore({
      // Base info from first ticket (only include defined values)
      schoolId: safeStr(entryToDelete.schoolId),
      ticketNumber: safeStr(entryToDelete.ticketNumber),
      name: safeStr(entryToDelete.name),
      lastname: safeStr(entryToDelete.lastname),
      yrlvl: safeStr(entryToDelete.yrlvl),
      department: safeStr(entryToDelete.department),

      // Batch information
      quantity: batchEntries.length,
      ticketNumbers: ticketNumbers,
      unitPrice: batchEntries.length === 1 ? toNumberSafe(entryToDelete.unitPrice, UNIT_PRICE) : "Mixed",
      totalPrice: totalPrice,
      batchId: batchId,
      originalIds: batchEntries.map(e => safeStr(e.id)),

      // Deletion metadata
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser ? currentUser.email : "Unknown",
      deletedByName: currentUser ? (currentUser.displayName || currentUser.email) : "Unknown",

      // Original entry metadata (only if defined)
      createdAt: entryToDelete.createdAt || new Date().toISOString(),
      soldBy: entryToDelete.soldBy || "Unknown",
      soldByName: entryToDelete.soldByName || entryToDelete.soldBy || "Unknown",
      soldStatus: entryToDelete.soldStatus || "sold",
      soldAt: entryToDelete.soldAt || entryToDelete.createdAt || new Date().toISOString(),

      // Store individual ticket details for restoration
      ticketDetails: batchEntries.map(entry => sanitizeForFirestore({
        id: safeStr(entry.id),
        ticketNumber: safeStr(entry.ticketNumber),
        unitPrice: toNumberSafe(entry.unitPrice, UNIT_PRICE),
        isEarlyBird: entry.isEarlyBird === true,
        ticketIndex: toNumberSafe(entry.ticketIndex, 1),
        ticketSequenceNumber: entry.ticketSequenceNumber || null,
        soldStatus: entry.soldStatus || "sold",
        soldAt: entry.soldAt || entry.createdAt || new Date().toISOString(),
        soldBy: entry.soldBy || "Unknown",
        soldByName: entry.soldByName || entry.soldBy || "Unknown",
        createdAt: entry.createdAt || new Date().toISOString()
      }))
    });

    // Save to deletedEntries (use batchId as key)
    const deleteDocId = groupedDeletedEntry.batchId;
    await setDoc(doc(db, "deletedEntries", deleteDocId), groupedDeletedEntry);

    // Delete all individual entries
    const deletePromises = batchEntries.map(entry => deleteDoc(doc(db, "entries", entry.id)));
    await Promise.all(deletePromises);

    if (deleteModal) deleteModal.hide();
    const message = batchEntries.length > 1
      ? `${batchEntries.length} entries moved to Recently Deleted`
      : "Entry moved to Recently Deleted";
    showToast(message, "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Failed to delete entry: " + err.message, "danger");
  } finally {
    deleteId = null;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete Entry';
    }
  }
}

// Restore functions
function openRestoreModal(id) {
  restoreId = id;
  if (restoreModal) restoreModal.show();
}

async function confirmRestore() {
  const currentRestoreId = restoreId; // Capture ID locally
  if (!currentRestoreId) return;

  const btn = document.getElementById("confirmRestoreBtn");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Restoring...';
  }

  try {
    console.log("Attempting to restore entry:", currentRestoreId);

    // Get the deleted entry
    const entryToRestore = deletedEntries.find(e => e.id === currentRestoreId);
    if (!entryToRestore) {
      showToast("Entry not found in deleted list", "warning");
      if (restoreModal) restoreModal.hide();
      return;
    }

    let restoreCount = 1;

    // Check if this is a grouped entry (new format) or individual entry (old format)
    if (entryToRestore.ticketDetails && entryToRestore.ticketDetails.length > 0) {
      // New grouped format - restore individual tickets
      const restorePromises = [];
      restoreCount = entryToRestore.quantity;

      for (const ticketDetail of entryToRestore.ticketDetails) {
        // Helper function to sanitize data for Firestore (remove undefined values)
        function sanitizeForFirestore(obj) {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              sanitized[key] = value;
            }
          }
          return sanitized;
        }

        const restoredTicket = sanitizeForFirestore({
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
          soldStatus: ticketDetail.soldStatus || entryToRestore.soldStatus || "sold",
          soldAt: ticketDetail.soldAt || entryToRestore.soldAt || entryToRestore.createdAt || new Date().toISOString(),
          createdAt: ticketDetail.createdAt || entryToRestore.createdAt || new Date().toISOString(),
          soldBy: ticketDetail.soldBy || entryToRestore.soldBy || "Unknown",
          soldByName: ticketDetail.soldByName || entryToRestore.soldByName || "Unknown",
          batchId: entryToRestore.batchId,
          totalTicketsInBatch: entryToRestore.quantity,
          ticketSequenceNumber: ticketDetail.ticketSequenceNumber || null
        });

        // Use original ID if available, otherwise generate new one
        if (ticketDetail.id) {
          restorePromises.push(setDoc(doc(db, "entries", ticketDetail.id), restoredTicket));
        } else {
          restorePromises.push(addDoc(collection(db, "entries"), restoredTicket));
        }
      }

      // Execute all restore operations
      await Promise.all(restorePromises);

    } else {
      // Old individual format - restore as single entry
      const { deletedAt, deletedBy, deletedByName, originalId, ticketNumbers, ticketDetails, totalPrice, ...restoredEntry } = entryToRestore;

      // Helper function to sanitize data for Firestore (remove undefined values)
      function sanitizeForFirestore(obj) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            sanitized[key] = value;
          }
        }
        return sanitized;
      }

      // Ensure required fields are present and sanitize
      const sanitizedEntry = sanitizeForFirestore({
        ...restoredEntry,
        soldStatus: restoredEntry.soldStatus || "sold",
        quantity: restoredEntry.quantity || 1,
        unitPrice: restoredEntry.unitPrice || 680,
        createdAt: restoredEntry.createdAt || new Date().toISOString(),
        soldBy: restoredEntry.soldBy || "Unknown",
        soldByName: restoredEntry.soldByName || "Unknown"
      });

      // Move back to entries collection using original ID if available
      const restoreDocId = originalId || currentRestoreId;
      await setDoc(doc(db, "entries", restoreDocId), sanitizedEntry);
    }

    // Delete from deletedEntries collection (Critical Step)
    console.log("Deleting from deletedEntries:", currentRestoreId);
    const deleteResult = await deleteDoc(doc(db, "deletedEntries", currentRestoreId));
    console.log("Delete operation completed successfully for:", currentRestoreId);

    // Don't manually update local state - let the real-time listener handle it
    // The onSnapshot listener will automatically update deletedEntries and call renderDeletedTable()

    if (restoreModal) restoreModal.hide();

    const msg = restoreCount > 1
      ? `${restoreCount} tickets restored successfully`
      : "Entry restored successfully";
    showToast(msg, "success");

  } catch (err) {
    console.error("Restore failed:", err);
    showToast("Failed to restore entry: " + err.message, "danger");
  } finally {
    if (restoreId === currentRestoreId) {
      restoreId = null;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Restore Entry';
    }
  }
}

// Open Permanent Delete Modal
function openPermanentDeleteModal(id) {
  permanentDeleteId = id;
  if (permanentDeleteModal) permanentDeleteModal.show();
}

// Confirm Permanent Delete
// Confirm Permanent Delete
async function confirmPermanentDelete() {
  if (!permanentDeleteId) return;
  const id = permanentDeleteId;

  const btn = document.getElementById("confirmPermanentDeleteBtn");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
  }

  try {
    console.log("Attempting to permanently delete:", id);
    const deleteResult = await deleteDoc(doc(db, "deletedEntries", id));
    console.log("Permanent delete operation completed successfully for:", id);

    // Don't manually update local state - let the real-time listener handle it
    // The onSnapshot listener will automatically update deletedEntries and call renderDeletedTable()

    if (permanentDeleteModal) permanentDeleteModal.hide();
    showToast("Entry permanently deleted", "success");
  } catch (err) {
    console.error("Permanent delete failed:", err);
    showToast("Failed to permanently delete entry: " + err.message, "danger");
  } finally {
    permanentDeleteId = null;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete Permanently';
    }
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
  const btn = document.getElementById("confirmClearAllBtn");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';
  }

  try {
    console.log("Attempting to clear all deleted entries, count:", deletedEntries.length);
    const deletePromises = deletedEntries.map(entry => {
      console.log("Deleting entry:", entry.id);
      return deleteDoc(doc(db, "deletedEntries", entry.id));
    });

    const results = await Promise.all(deletePromises);
    console.log("Clear all operation completed successfully, deleted:", results.length, "entries");

    // Don't manually update local state - let the real-time listener handle it
    // The onSnapshot listener will automatically update deletedEntries and call renderDeletedTable()

    if (clearAllModal) clearAllModal.hide();
    showToast(`Cleared ${deletePromises.length} deleted entries permanently`, "success");
  } catch (err) {
    console.error("Clear all failed:", err);
    showToast("Failed to clear deleted entries: " + err.message, "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete Permanently';
    }
  }
}

// Render deleted entries table
function renderDeletedTable() {
  console.log("renderDeletedTable called with", deletedEntries.length, "entries");
  const tbody = document.getElementById("deletedTableBody");
  if (!tbody) {
    console.error("deletedTableBody element not found");
    return;
  }

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
    try {
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
          <button class="btn btn-sm btn-danger" onclick="openPermanentDeleteModal('${e.id}')" title="Delete Permanently">
            🔥
          </button>
        </td>
      `;
      tbody.appendChild(row);
    } catch (rowError) {
      console.error("Error rendering deleted row:", rowError, e);
    }
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
    let typeLabel = ticketDetail.ticketType || "Regular";
    let typeClass = "bg-secondary";

    if (ticketDetail.ticketType) {
      typeClass = ticketDetail.ticketType === "College Student" ? "bg-info" : "bg-warning text-dark";
    } else {
      if (ticketDetail.unitPrice == 300) {
        typeLabel = "College Student";
        typeClass = "bg-info";
      } else if (ticketDetail.unitPrice == 700) {
        typeLabel = "Outsider";
        typeClass = "bg-warning text-dark";
      }
    }

    const typeBadge = `<span class="badge ${typeClass} ms-2" style="font-size: 0.7rem;">${typeLabel}</span>`;
    const earlyBirdBadge = ticketDetail.isEarlyBird
      ? '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Early Bird</span>'
      : '';

    return `
          <div class="col-md-6 col-lg-4">
            <div class="card border-0 shadow-sm" style="background-color: #fee2e2;">
              <div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-bold text-danger" style="font-size: 0.9rem;">Ticket ${safeStr(ticketDetail.ticketNumber)}</span>
                  <div>${typeBadge}${earlyBirdBadge}</div>
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
window.openPermanentDeleteModal = openPermanentDeleteModal;
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

  // Apply current search filter to the modal view if active
  const searchVal = safeStr(document.getElementById("activitySearch")?.value).toLowerCase();

  if (searchVal) {
    const filteredBatch = batchEntries.filter(entry => {
      const sid = safeStr(entry.schoolId).toLowerCase();
      const ticketNum = safeStr(entry.ticketNumber).toLowerCase();
      const name = safeStr(entry.name).toLowerCase();
      const lastname = safeStr(entry.lastname).toLowerCase();
      const fullname = `${name} ${lastname}`;

      return sid.includes(searchVal) ||
        ticketNum.includes(searchVal) ||
        fullname.includes(searchVal) ||
        name.includes(searchVal) ||
        lastname.includes(searchVal);
    });

    if (filteredBatch.length > 0) {
      batchEntries = filteredBatch;
    }
  }

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
      let typeLabel = ticketEntry.ticketType || "Regular";
      let typeClass = "bg-secondary";

      if (ticketEntry.ticketType) {
        typeClass = ticketEntry.ticketType === "College Student" ? "bg-info" : "bg-warning text-dark";
      } else {
        if (ticketEntry.unitPrice == 300) {
          typeLabel = "College Student";
          typeClass = "bg-info";
        } else if (ticketEntry.unitPrice == 700) {
          typeLabel = "Outsider";
          typeClass = "bg-warning text-dark";
        }
      }

      const typeBadge = `<span class="badge ${typeClass} ms-2" style="font-size: 0.7rem;">${typeLabel}</span>`;
      const earlyBirdBadge = ticketEntry.isEarlyBird
        ? '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Early Bird</span>'
        : '';

      return `
            <div class="col-md-6 col-lg-4">
              <div class="card border-0 shadow-sm">
                <div class="card-body py-2 px-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold" style="font-size: 0.9rem;">Ticket ${safeStr(ticketEntry.ticketNumber)}</span>
                    <div>${typeBadge}${earlyBirdBadge}</div>
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
    // Use local timezone formatting instead of UTC
    const dateStr = date.getFullYear() + "-" + 
      String(date.getMonth() + 1).padStart(2, '0') + "-" + 
      String(date.getDate()).padStart(2, '0');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (i === 6) startDate.setTime(date.getTime());
    if (i === 0) endDate.setTime(date.getTime());

    days.push(dayName);

    // Count entries and revenue for this day
    const dayEntries = entries.filter(e => {
      if (!e.createdAt) return false;
      // Use local timezone formatting for entry dates too
      const entryDate = new Date(e.createdAt);
      const entryDateStr = entryDate.getFullYear() + "-" + 
        String(entryDate.getMonth() + 1).padStart(2, '0') + "-" + 
        String(entryDate.getDate()).padStart(2, '0');
      return entryDateStr === dateStr;
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
document.getElementById("activityFilter")?.addEventListener("change", () => {
  activityCurrentPage = 1; // Reset to first page when filtering
  renderActivityTable();
});
document.getElementById("activityUser")?.addEventListener("change", () => {
  activityCurrentPage = 1; // Reset to first page when filtering
  renderActivityTable();
});
document.getElementById("activitySearch")?.addEventListener("input", () => {
  activityCurrentPage = 1; // Reset to first page when searching
  renderActivityTable();
});
document.getElementById("deletedSearch")?.addEventListener("input", renderDeletedTable);
