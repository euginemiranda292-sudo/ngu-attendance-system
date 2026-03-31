// Connect to your specific dev tunnel URL
// This tells Socket.io to connect to the same server that is hosting the page
const socket = io();

socket.on('new-user-login', async (userData) => {
    const userTableBody = document.getElementById('userTableBody');
    
    // Update the UI as usual
    const newRow = document.createElement('tr');
    newRow.style.backgroundColor = "rgba(37, 99, 235, 0.3)"; 
    newRow.style.transition = "background-color 1s ease";
    newRow.innerHTML = `
        <td>${userData.name}</td>
        <td>${userData.address}</td>
        <td>${userData.unit}</td>
    `;
    userTableBody.prepend(newRow); 

    setTimeout(() => {
        newRow.style.backgroundColor = "transparent";
    }, 3000);

    loadAttendanceHistory();
});


// --- 2. Navigation Logic ---
document.getElementById('navHome').addEventListener('click', () => showSection('homeSection', 'navHome'));
document.getElementById('navDates').addEventListener('click', () => {
    showSection('datesSection', 'navDates');
    loadAttendanceHistory(); // Fetch fresh history when tab is clicked
});

// --- Navigation Extension ---
document.getElementById('navNguMembers').addEventListener('click', () => {
    showSection('nguSection', 'navNguMembers');
    loadNguDirectory();
});
document.getElementById('navOfficial').addEventListener('click', () => {
    showSection('officialSection', 'navOfficial');
    updateOfficialTable();
});

function showSection(id, navId) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    document.getElementById(navId).classList.add('active');
}

// --- 3. Database Fetching (Home Section) ---
async function loadUsers() {
    const userTableBody = document.getElementById('userTableBody');
    try {
        const response = await fetch('/api/admin/users');
        const result = await response.json();

        if (result.success) {
            userTableBody.innerHTML = ''; 
            result.data.forEach(user => {
                // Removed the Date & Time TD
                const row = `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.address}</td>
                        <td>${user.unit}</td>
                    </tr>`;
                userTableBody.innerHTML += row;
            });
        }
    } catch (err) {
        userTableBody.innerHTML = '<tr><td colspan="3">Error loading data.</td></tr>';
    }
}



// --- 4. New Attendance Modal Logic ---
const attendanceModal = document.getElementById('attendanceModal');
const confirmLogBtn = document.getElementById('confirmLogBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// Open Modal & Set Default Date
document.getElementById('newAttendanceBtn').addEventListener('click', () => {
    // Set the date input to today's date automatically
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
    
    attendanceModal.style.display = 'flex';
});

// Close Modal
cancelModalBtn.addEventListener('click', () => {
    attendanceModal.style.display = 'none';
});


confirmLogBtn.addEventListener('click', async () => {
    const eventType = document.getElementById('eventCategory').value;
    const eventDate = document.getElementById('eventDate').value; 

    if (!eventDate) {
        alert("Please select a date.");
        return;
    }

    try {
        // 1. Save the session to the server
        await fetch('/api/admin/open-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType, eventDate })
        });

        // 2. Update the Title immediately
        document.getElementById('currentEventTitle').innerText = `${eventType} - ${eventDate}`;

        // 3. IMMEDIATELY load the users who already match this category/date
        // This makes the list appear the moment you click OK
        await loadCurrentSessionUsers(eventType, eventDate);

        // 4. Tell the server to broadcast to other connected admins/users
        socket.emit('admin-open-session', { eventType, eventDate });

        attendanceModal.style.display = 'none';
        
        // Optional: Small notification instead of an annoying alert
        console.log(`Session started for ${eventType}`);
        
    } catch (err) {
        console.error("Failed to start session:", err);
        alert("Failed to start session on server.");
    }
});


// Function to show/hide the tables
function toggleDateTable(id) {
    const tableDiv = document.getElementById(id);
    if (tableDiv.style.display === "none") {
        tableDiv.style.display = "block";
    } else {
        tableDiv.style.display = "none";
    }
}

// --- 6. Init and Logout ---
loadUsers(); // Load initial member list



// --- Logic to get Official Member Names ---
function getOfficialMemberNames() {
    const counts = {};
    processedHistory.forEach(record => {
        if (!counts[record.name]) counts[record.name] = { eb: 0, ride: 0 };
        if (record.event_name === 'Eye Ball (EB)') counts[record.name].eb++;
        if (record.event_name.includes('Ride')) counts[record.name].ride++;
    });

    // Return names of those who meet 3 EB + 1 Ride
    return Object.keys(counts).filter(name => counts[name].eb >= 3 && counts[name].ride >= 1);
}

// --- Modified Filter (To exclude Official Members) ---
function filterByCategory(type, occurrence) {
    const officialNames = getOfficialMemberNames();
    const userAttendanceCount = {};
    const sortedHistory = [...processedHistory].sort((a, b) => new Date(a.attendance_date) - new Date(b.attendance_date));
    const results = [];

    sortedHistory.forEach(record => {
        // SKIP if this person is already an Official Member
        if (officialNames.includes(record.name)) return;

        const isRide = record.event_name.includes("Ride");
        if (type === 'Ride' && isRide) {
            results.push(record);
        } else if (type === 'Eye Ball (EB)' && record.event_name === 'Eye Ball (EB)') {
            userAttendanceCount[record.name] = (userAttendanceCount[record.name] || 0) + 1;
            if (userAttendanceCount[record.name] === occurrence) {
                results.push(record);
            }
        }
    });
    return results;
}


let allNguMembers = [];

// --- NGU Members Directory ---
async function loadNguDirectory() {
    try {
        // 1. Fetch from the actual users table
        const response = await fetch('/api/admin/users'); 
        const result = await response.json();
        
        if (result.success) {
            allNguMembers = result.data; // Save to global variable for searching
            
            // 2. Use the render function that contains the EDIT button logic
            renderMemberCards(allNguMembers);
        }
    } catch (err) { 
        console.error("Error loading NGU Directory:", err); 
        document.getElementById('nguMemberGrid').innerHTML = '<p>Error loading members.</p>';
    }
}

// Updated render function
function renderMemberCards(members) {
    const grid = document.getElementById('nguMemberGrid');
    grid.innerHTML = '';
    
    if (members.length === 0) {
        grid.innerHTML = '<p style="color: gray; padding: 20px;">No members found.</p>';
        return;
    }

    members.forEach(m => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <h4>${m.name}</h4>
            <p style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 10px;">${m.unit}</p>
            <div class="card-actions" style="display: flex; gap: 8px;">
                <button class="primary-btn view-btn" style="flex: 1;" onclick="openStatsModal('${m.name}')">STATS</button>
                <button class="primary-btn edit-btn" style="flex: 1;" onclick="openEditModal('${m.name}', '${m.address}', '${m.unit}')">EDIT</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Logic to Open Edit Modal
function openEditModal(fullName, address, unit) {
    // Split name (assuming "First Last" format)
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' '); // Handles multi-word last names

    document.getElementById('editOriginalName').value = fullName;
    document.getElementById('editFirstName').value = firstName;
    document.getElementById('editLastName').value = lastName;
    document.getElementById('editAddress').value = address;
    document.getElementById('editUnit').value = unit;

    document.getElementById('editMemberModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editMemberModal').style.display = 'none';
}

// Save logic
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const originalName = document.getElementById('editOriginalName').value;
    const updatedData = {
        originalName: originalName,
        firstName: document.getElementById('editFirstName').value,
        lastName: document.getElementById('editLastName').value,
        address: document.getElementById('editAddress').value,
        unit: document.getElementById('editUnit').value
    };

    try {
        const response = await fetch('/api/admin/update-member', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();
        if (result.success) {
            alert("Member details and all history logs updated!");
            closeEditModal();
            
            // REFRESH EVERYTHING
            await loadNguDirectory();       // Refresh NGU Grid
            await loadUsers();              // Refresh Home Table
            await loadAttendanceHistory();  // Refresh History/Stats/Official list
            
        }
    } catch (err) {
        alert("Error updating member records.");
    }
});


// Search Logic
document.getElementById('memberSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    
    const filtered = allNguMembers.filter(m => 
        m.name.toLowerCase().includes(term) || 
        m.unit.toLowerCase().includes(term)
    );
    
    renderMemberCards(filtered);
});

// --- User Stats Modal ---
function openStatsModal(name) {
    const stats = processedHistory.reduce((acc, curr) => {
        if (curr.name === name) {
            if (curr.event_name === 'Eye Ball (EB)') acc.eb++;
            if (curr.event_name.includes('Ride')) acc.ride++;
        }
        return acc;
    }, { eb: 0, ride: 0 });

    document.getElementById('statsMemberName').innerText = name;
    document.getElementById('statsEbCount').innerText = stats.eb;
    document.getElementById('statsRideCount').innerText = stats.ride;
    document.getElementById('userStatsModal').style.display = 'flex';
}

function closeStatsModal() {
    document.getElementById('userStatsModal').style.display = 'none';
}

// --- Official Members Table ---
function updateOfficialTable() {
    const officialNames = getOfficialMemberNames();
    const tableBody = document.getElementById('officialTableBody');
    tableBody.innerHTML = '';

    // Filter processedHistory to get address/unit for these names
    const displayed = new Set();
    processedHistory.forEach(record => {
        if (officialNames.includes(record.name) && !displayed.has(record.name)) {
            const tr = `<tr><td>${record.name}</td><td>${record.address}</td><td>${record.unit}</td></tr>`;
            tableBody.innerHTML += tr;
            displayed.add(record.name);
        }
    });
}


// --- Reset Attendance Logic ---
document.getElementById('resetAttendanceBtn').addEventListener('click', async () => {
    if (!confirm("This will end the current session. Users can no longer login for this event. Proceed?")) return;

    try {
        // 1. Tell server to clear the active session in memory
        await fetch('/api/admin/clear-session', { method: 'POST' });

        // 2. Broadcast to users that session is closed
        socket.emit('admin-close-session');

        // 3. Reset Admin UI
        document.getElementById('currentEventTitle').innerText = "Member List";
        document.getElementById('userTableBody').innerHTML = '';
        
        // 4. Refresh history to show the newly archived data
        await loadAttendanceHistory();
        
        alert("Session ended. List cleared.");
    } catch (err) {
        alert("Error resetting attendance.");
    }
});

// Global variable to store processed history
let processedHistory = [];

async function loadAttendanceHistory() {
    try {
        const response = await fetch('/api/admin/attendance-history');
        const result = await response.json();

        if (result.success) {
            // 1. Completely refresh the global variable
            processedHistory = result.data || [];
            
            // 2. Clear dependent UI containers before re-rendering
            document.getElementById('sessionButtonsContainer').innerHTML = '';
            document.getElementById('officialTableBody').innerHTML = '';
            
            // 3. Re-run UI logic with the NEW data
            updateCategoryCounts();
            renderSessionButtons();
            
            // Only update if the section is actually visible
            if (document.getElementById('officialSection').style.display === 'block') {
                updateOfficialTable();
            }
        }
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}


function renderSessionButtons() {
    const container = document.getElementById('sessionButtonsContainer');
    container.innerHTML = '';

    const sessions = {};
    processedHistory.forEach(record => {
        const dateFormatted = new Date(record.attendance_date).toLocaleDateString();
        const key = `${record.event_name} - ${dateFormatted}`;
        if (!sessions[key]) sessions[key] = { rawDate: record.attendance_date, name: record.event_name, data: [] };
        sessions[key].data.push(record);
    });

    Object.keys(sessions).forEach(sessionKey => {
        const session = sessions[sessionKey];
        const card = document.createElement('div');
        card.className = 'category-card';
        
        // Removed the <button class="delete-session-btn"> element here
        card.innerHTML = `
            <h3>${sessionKey}</h3>
            <p>${session.data.length} Attended</p>
            <button class="primary-btn view-btn">VIEW LIST</button>
        `;

        // View List Click remains active
        card.querySelector('.view-btn').onclick = () => openSpecificSessionModal(sessionKey, session.data);
        
        container.appendChild(card);
    });
}

// Shared function to render the history table with a delete button
function renderHistoryRows(data) {
    const tableBody = document.getElementById('historyModalTableBody');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No records found.</td></tr>';
        return;
    }

    data.forEach(row => {
        const date = new Date(row.attendance_date).toLocaleDateString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.name}</td>
            <td>${row.unit}</td>
            <td>${date}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// Update your existing open functions to use the new renderer:
function openSpecificSessionModal(title, data) {
    document.getElementById('historyModalTitle').innerText = title;
    renderHistoryRows(data);
    document.getElementById('historyViewModal').style.display = 'flex';
}

function openHistoryModal(type, occurrence) {
    const data = filterByCategory(type, occurrence);
    document.getElementById('historyModalTitle').innerText = occurrence > 0 ? `${occurrence}${getOrdinal(occurrence)} EB` : "Rides";
    renderHistoryRows(data);
    document.getElementById('historyViewModal').style.display = 'flex';
}



function updateCategoryCounts() {
    // We filter unique users to see how many "milestones" are reached
    const eb1 = filterByCategory('Eye Ball (EB)', 1).length;
    const eb2 = filterByCategory('Eye Ball (EB)', 2).length;
    const eb3 = filterByCategory('Eye Ball (EB)', 3).length;
    const rides = filterByCategory('Ride', 0).length;

    document.getElementById('count-1st-eb').innerText = `${eb1} Members`;
    document.getElementById('count-2nd-eb').innerText = `${eb2} Members`;
    document.getElementById('count-3rd-eb').innerText = `${eb3} Members`;
    document.getElementById('count-rides').innerText = `${rides} Members`;
}

/**
 * Logic: 
 * For EB: Count how many times the user appeared in EB events.
 * If they appeared once, they are in "1st EB". 
 * If they appeared twice, they show in "2nd EB", etc.
 */
function filterByCategory(type, occurrence) {
    const userAttendanceCount = {};
    
    // Sort history by date ascending to count occurrences properly
    const sortedHistory = [...processedHistory].sort((a, b) => new Date(a.attendance_date) - new Date(b.attendance_date));

    const results = [];

    sortedHistory.forEach(record => {
        const isRide = record.event_name.includes("Ride");
        
        if (type === 'Ride' && isRide) {
            results.push(record);
        } else if (type === 'Eye Ball (EB)' && record.event_name === 'Eye Ball (EB)') {
            userAttendanceCount[record.name] = (userAttendanceCount[record.name] || 0) + 1;
            
            if (userAttendanceCount[record.name] === occurrence) {
                results.push(record);
            }
        }
    });
    return results;
}

function closeHistoryModal() {
    document.getElementById('historyViewModal').style.display = 'none';
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}


document.getElementById('logoutBtn').addEventListener('click', () => {
    window.location.href = "adminlogin.html";
});

async function checkActiveSession() {
    try {
        const response = await fetch('/api/admin/active-session');
        const result = await response.json();

        // result.activeSession contains { eventType, eventDate } from your server.js global variable
        if (result.success && result.activeSession) {
            const { eventType, eventDate } = result.activeSession;
            
            // 1. Restore the persistent Title
            document.getElementById('currentEventTitle').innerText = `${eventType} - ${eventDate}`;
            
            // 2. Fetch the users who have already logged in for this specific session
            // We pass the session details so the loader knows what to filter for
            loadCurrentSessionUsers(eventType, eventDate); 
            
            console.log("Restored active session:", eventType, eventDate);
        } else {
            // No session active? Show the full registered member list as default
            document.getElementById('currentEventTitle').innerText = "Member List";
            loadUsers(); 
        }
    } catch (err) {
        console.error("Error checking active session:", err);
    }
}


async function loadCurrentSessionUsers(eventType, eventDate) {
    const userTableBody = document.getElementById('userTableBody');
    userTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Searching for attendees...</td></tr>';

    try {
        const response = await fetch('/api/admin/attendance-history');
        const result = await response.json();

        if (result.success) {
            // Filter history for only this session's records
            const sessionUsers = result.data.filter(record => {
                // 1. Create the date object FIRST
                const d = new Date(record.attendance_date);
                if (isNaN(d)) return false;
                
                // 2. Format to YYYY-MM-DD
                const recordDateFormatted = d.toISOString().split('T')[0];

                // 3. Compare with the active session details
                // .trim() handles any accidental spaces in the database string
                return record.event_name.trim() === eventType.trim() && 
                       recordDateFormatted === eventDate;
            });

            userTableBody.innerHTML = ''; 

            if (sessionUsers.length === 0) {
                userTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; opacity:0.5;">No members found for this date yet.</td></tr>';
                return;
            }

            // Render the matched users
            sessionUsers.forEach(user => {
                const row = `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.address}</td>
                        <td>${user.unit}</td>
                    </tr>`;
                userTableBody.innerHTML += row;
            });
        }
    } catch (err) {
        console.error("Error reloading session users:", err);
        userTableBody.innerHTML = '<tr><td colspan="3">Error loading session data.</td></tr>';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkActiveSession(); 
    loadAttendanceHistory();
});