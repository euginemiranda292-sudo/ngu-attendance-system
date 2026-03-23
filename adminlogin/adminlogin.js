document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgDiv = document.getElementById('loginMessage');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            msgDiv.style.color = "green";
            msgDiv.innerText = "Login Successful! Redirecting...";
            setTimeout(() => window.location.href = "admindashboard.html", 1500);
        } else {
            msgDiv.style.color = "red";
            msgDiv.innerText = "Invalid email or password.";
        }
    } catch (err) {
        msgDiv.innerText = "Server error. Please try again.";
    }
});

document.getElementById('togglePassword').addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Optional: Toggle the icon text
    this.innerText = type === 'password' ? '👁️' : '🙈';
});


// Add this at the bottom of login.js
document.getElementById('signupRedirectBtn').addEventListener('click', () => {
    window.location.href = "adminregister.html";
});

// Updated Redirect Logic with 3-second blur effect
document.getElementById('signupRedirectBtn').addEventListener('click', () => {
    const overlay = document.getElementById('loadingOverlay');
    
    // 1. Show the blur overlay and spinner
    overlay.style.display = 'flex';

    // 2. Wait exactly 3 seconds (3000ms) then change page
    setTimeout(() => {
        window.location.href = "adminregister.html";
    }, 3000);
});