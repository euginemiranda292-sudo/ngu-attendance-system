document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    const successModal = document.getElementById('successModal');
    const modalOkBtn = document.getElementById('modalOkBtn');
    
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        unit: document.getElementById('unit').value,
        address: document.getElementById('address').value
    };

    submitBtn.innerHTML = 'Processing...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            // 1. Show the modal
            const successModal = document.getElementById('successModal');
            successModal.style.display = 'flex';

            // 2. Clear the form fields immediately so it's fresh
            document.getElementById('registrationForm').reset();
            
            // 3. Reset the Submit Button state
            submitBtn.innerHTML = "Register";
            submitBtn.disabled = false;

            // 4. Handle OK button: Just close the modal, stay on page
            document.getElementById('modalOkBtn').onclick = () => {
                successModal.style.display = 'none';
                // Optional: clear any error messages that were there before
                document.getElementById('message').innerText = ""; 
            };
        }
        
    } catch (err) {
        submitBtn.innerHTML = "Register";
        submitBtn.disabled = false;
        messageDiv.innerText = "Error: " + err.message;
        messageDiv.style.color = "red";
    }
});

// Close modal if user clicks the dark background area
window.onclick = function(event) {
    const modal = document.getElementById('successModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}