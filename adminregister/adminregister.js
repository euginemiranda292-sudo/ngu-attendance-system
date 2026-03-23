document.getElementById('adminRegisterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    // 1. Password Match Validation
    if (password !== confirmPassword) {
        messageDiv.innerText = "❌ Passwords do not match!";
        messageDiv.style.color = "red";
        return;
    }

    const formData = {
        email: document.getElementById('email').value,
        unit: document.getElementById('unit').value,
        password: password
    };

    // 2. Visual Feedback
    submitBtn.innerHTML = '<span class="spinner"></span> Creating Admin...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/admin/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            messageDiv.innerText = "Admin Account Created Successfully!";
            messageDiv.style.color = "green";
            setTimeout(() => window.location.href = "adminlogin.html", 2000);
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        submitBtn.innerHTML = "Create Admin Account";
        submitBtn.disabled = false;
        messageDiv.innerText = "Error: " + err.message;
        messageDiv.style.color = "red";
    }
});





document.getElementById('togglePassword').addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Optional: Toggle the icon text
    this.innerText = type === 'password' ? '👁️' : '🙈';
});


// At the bottom of registration.js
document.getElementById('loginRedirectBtn').addEventListener('click', () => {
    window.location.href = "adminlogin.html";
});

// Handle the Login Redirect with Loading Effect
document.getElementById('loginRedirectBtn').addEventListener('click', () => {
    const overlay = document.getElementById('loadingOverlay');
    
    // 1. Show the blur overlay
    overlay.style.display = 'flex';

    // 2. Wait 3 seconds then redirect
    setTimeout(() => {
        window.location.href = "adminlogin.html";
    }, 3000);
});