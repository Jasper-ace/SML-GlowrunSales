import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs
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
const db = getFirestore(app);

// DOM Elements
const form = document.getElementById("receiptForm");
const searchBtn = document.getElementById("searchBtn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const resultCard = document.getElementById("receiptResult");
const errorAlert = document.getElementById("errorAlert");

// Helper to format currency
const formatCurrency = (n) => "₱" + Number(n).toLocaleString();

// Helper to safe string and normalize spaces (e.g. "  Jasper   Ace " -> "Jasper Ace")
const safeStr = (v) => {
    if (v === undefined || v === null) return "";
    return String(v).trim().replace(/\s+/g, ' ');
};

const normalizeStr = (str) => safeStr(str).toLowerCase();

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Reset UI
    errorAlert.style.display = "none";
    resultCard.style.display = "none";

    // Show loading
    searchBtn.disabled = true;
    btnText.textContent = "Searching...";
    btnSpinner.classList.remove("d-none");

    // Get inputs
    const idInput = safeStr(document.getElementById("schoolId").value);
    const fnameInput = normalizeStr(document.getElementById("firstName").value);
    const lnameInput = normalizeStr(document.getElementById("lastName").value);

    console.log("Searching for:", { id: idInput, fname: fnameInput, lname: lnameInput });

    try {
        // 1. Query by ID first (most efficient)
        const entriesRef = collection(db, "entries");
        // Try querying as string (standard)
        const q = query(entriesRef, where("schoolId", "==", idInput));
        const querySnapshot = await getDocs(q);

        console.log(`Found ${querySnapshot.size} documents with ID ${idInput}`);

        // 2. Filter matches client-side for Name/Lastname (case-insensitive & normalized)
        const matches = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dbFname = normalizeStr(data.name);
            const dbLname = normalizeStr(data.lastname);

            console.log("Checking Entry:", {
                id: doc.id,
                dbFname,
                dbLname,
                matchF: dbFname === fnameInput,
                matchL: dbLname === lnameInput
            });

            if (dbFname === fnameInput && dbLname === lnameInput) {
                matches.push(data);
            }
        });

        if (matches.length > 0) {
            displayReceipt(matches);
        } else {
            // Logic: If we found docs by ID but names didn't match, it's a mismatch.
            // If we found NO docs by ID, it's ID not found.
            console.warn("No matches found after name filtering.");
            showError("No records found matching these details. Please check your spelling.");
        }

    } catch (error) {
        console.error("Error searching:", error);
        let msg = "An error occurred while searching. Please try again.";
        if (error.code === 'permission-denied') {
            msg = "Access Denied: The status of this database does not allow public searches. Please contact an admin.";
        } else if (error.message) {
            msg = `Error: ${error.message}`;
        }
        showError(msg);
    } finally {
        // Reset loading state
        searchBtn.disabled = false;
        btnText.textContent = "Find My Receipt";
        btnSpinner.classList.add("d-none");
    }
});

function displayReceipt(entries) {
    // Assuming all entries belong to the same person/transaction context
    // Use the first entry for static details
    const first = entries[0];

    // Aggregate data
    let totalAmount = 0;
    const ticketNumbers = [];

    // Sort entries by ticket number
    entries.sort((a, b) => safeStr(a.ticketNumber).localeCompare(safeStr(b.ticketNumber)));

    entries.forEach(entry => {
        totalAmount += Number(entry.unitPrice) || 0;
        ticketNumbers.push({
            number: safeStr(entry.ticketNumber),
            isEarlyBird: entry.isEarlyBird === true
        });
    });

    // Populate UI
    document.getElementById("rName").textContent = `${safeStr(first.name)} ${safeStr(first.lastname)}`;
    document.getElementById("rId").textContent = safeStr(first.schoolId);
    document.getElementById("rDept").textContent = safeStr(first.department);

    // Handle Year Level display (— if empty/Faculty)
    const yrlvl = (safeStr(first.department) === "Faculty & Staff" || !safeStr(first.yrlvl)) ? "—" : safeStr(first.yrlvl);
    document.getElementById("rYrlvl").textContent = yrlvl;

    // Date (Use the most recent one if multiple)
    // Sort by date desc to get latest
    const sortedByDate = [...entries].sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return db - da;
    });

    const latestDate = sortedByDate[0].createdAt ? new Date(sortedByDate[0].createdAt) : new Date();
    document.getElementById("rDate").textContent = latestDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric'
    });

    // Render tickets
    const ticketsContainer = document.getElementById("rTickets");
    ticketsContainer.innerHTML = ticketNumbers.map(t => {
        const ebBadge = t.isEarlyBird ? ' <span style="font-size:0.6em">⚡</span>' : '';
        return `<span class="ticket-badge">${t.number}${ebBadge}</span>`;
    }).join("");

    document.getElementById("rTotal").textContent = formatCurrency(totalAmount);

    // Show result with animation
    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(msg) {
    errorAlert.textContent = msg || "❌ No records found matching these details. Please check your spelling and try again.";
    errorAlert.style.display = "block";
    resultCard.style.display = "none";
}
