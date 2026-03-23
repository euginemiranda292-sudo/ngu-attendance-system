// Connect to your dev tunnel
const socket = io('https://sx01rkvb-3000.asse.devtunnels.ms/');

const loginBtn = document.querySelector('#loginForm button');
const eventStatus = document.getElementById('eventStatus');

// --- 1. Listen for Admin opening a session ---
socket.on('session-opened', (data) => {
    eventStatus.innerText = `Active: ${data.eventType}`;
    eventStatus.style.backgroundColor = "rgba(16, 185, 129, 0.2)"; // Greenish background
    eventStatus.style.color = "#fff"; // Bright Green text
    eventStatus.style.borderColor = "rgba(16, 185, 129, 0.4)";
    loginBtn.disabled = false; 
});

// --- 2. Listen for Admin closing a session ---
socket.on('session-closed', () => {
    eventStatus.innerText = "Waiting for Admin to open session...";
    eventStatus.style.backgroundColor = "rgba(239, 68, 68, 0.1)"; // Reddish background
    eventStatus.style.color = "#fff"; // Soft Red text
    eventStatus.style.borderColor = "rgba(239, 68, 68, 0.3)";
    loginBtn.disabled = true; 
});

// Initial state: Disable button until a session is confirmed
loginBtn.disabled = true;





document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('loginName').value.trim();
    const msgDiv = document.getElementById('loginMessage');
    const loginBtn = e.target.querySelector('button'); // Get the submit button

    // 1. Basic validation
    if (!name) {
        msgDiv.innerText = "Please enter your name.";
        msgDiv.style.color = "red";
        return;
    }

    // 2. Visual feedback
    msgDiv.innerText = "Verifying...";
    msgDiv.style.color = "#666";
    loginBtn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const result = await response.json();

        if (result.success) {
            // Standard success modal logic
            showModal("✔️", "Success!", "Successfully Attendanced");
        } else if (result.alreadyAttended) {
            // THE NEW LOGIC: Duplicate attendance message
            showModal("⚠️", "Oooops!", result.message);
        } else {
            // Unknown member or other errors
            msgDiv.style.color = "red";
            msgDiv.innerText = `⚠️ ${result.message}`;
            loginBtn.disabled = false;
        }
    } catch (err) {
        msgDiv.style.color = "red";
        msgDiv.innerText = "Error connecting to server.";
        loginBtn.disabled = false;
    }
});



function showModal(icon, title, message) {
    const modal = document.getElementById('successModal');
    const modalContent = modal.querySelector('.modal-content');
    const loginBtn = document.querySelector('#loginForm button');

    // Update content dynamically
    modalContent.querySelector('.success-icon').innerText = icon;
    modalContent.querySelector('h2').innerText = title;
    modalContent.querySelector('p').innerText = message;

    modal.style.display = 'flex';

    document.getElementById('modalOkBtn').onclick = () => {
        modal.style.display = 'none';
        document.getElementById('loginForm').reset();
        loginBtn.disabled = false;
        // Optional: window.location.reload(); 
    };
}
