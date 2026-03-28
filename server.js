const express = require("express");
const path = require("path");
const db = require("./db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session"); 
const MySQLStore = require('express-mysql-session')(session);
const saltRounds = 10;
const app = express();
const server = http.createServer(app); 
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const Telerivet = require("telerivet");

// --- Telerivet setup ---
const tr = new Telerivet.API(process.env.TELERIVET_API_KEY);
const project = tr.initProjectById(process.env.TELERIVET_PROJECT_ID);

// --- Helper function to send SMS via Telerivet ---
async function sendTelerivetSMS(phone, message) {
  return new Promise((resolve, reject) => {
    project.sendMessage(
      {
        to_number: phone,
        content: message
      },
      (err, res) => {
        // Ignore delivery receipt error 124 (common in PH networks)
        if (err && err.code !== 124) {
          console.error("❌ Telerivet SMS error:", err);
          return reject(err);
        }

        console.log("📩 Telerivet SMS sent:", res?.id || "NO_ID_RETURNED");
        resolve(res);
      }
    );
  });
}




//========================================================||
  //== This code enables your backend to send real-time ==|| 
  //== notifications to your frontend, and allows your ===|| 
  //== frontend website to safely connect to it. =========||
//========================================================||
const io = new Server(server, {
  cors: {
    origin: ["https://ngu-attendance-system.onrender.com", "http://localhost:3000"], 
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set("io", io);
global.io = io;

// Keep this variable at the top level so it doesn't reset when a user connects/disconnects
let activeSession = null; // Store current event { eventType, eventDate }

// When admin starts a new attendance
app.post('/api/admin/open-session', (req, res) => {
    const { eventType, eventDate } = req.body;
    const sql = `
        INSERT INTO current_session (id, event_type, event_date) 
        VALUES (1, ?, ?) 
        ON DUPLICATE KEY UPDATE event_type = VALUES(event_type), event_date = VALUES(event_date)
    `;
    db.query(sql, [eventType, eventDate], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.get('/api/admin/active-session', (req, res) => {
    db.query("SELECT event_type as eventType, event_date as eventDate FROM current_session WHERE id = 1", (err, results) => {
        if (err || results.length === 0) return res.json({ success: true, activeSession: null });
        
        // Format the date to YYYY-MM-DD for the frontend
        const session = results[0];
        const d = new Date(session.eventDate);
        session.eventDate = d.toISOString().split('T')[0];
        
        res.json({ success: true, activeSession: session });
    });
});

// When admin resets/clears
app.post('/api/admin/clear-session', (req, res) => {
    db.query("DELETE FROM current_session WHERE id = 1", (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // --- NEW: When a user/admin connects, immediately send them the current session if it exists ---
  if (activeSession) {
    socket.emit('session-opened', activeSession);
  }

  // When admin opens a session
  socket.on('admin-open-session', (data) => {
    activeSession = data; // Save the session globally on the server
    io.emit('session-opened', data); // Tell everyone
  });

  // When admin closes/resets session
  socket.on('admin-close-session', () => {
    activeSession = null; // Clear the global session
    io.emit('session-closed'); // Tell everyone
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

//=====================================||
  //== This is the port number where ==|| 
  //== our server will run. ===========||
//=====================================||
const PORT = process.env.PORT || 3000;


//=============================================================||
  //== These lines let your server open your HTML pages, ======||
  //== images, and scripts, accept data from forms, accept ====||
  //== JSON from fetch(), and keep cookies working properly. ==||
//=============================================================||
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static("registration"));
app.use(express.static("login"));
app.use(express.static("adminregister"));
app.use(express.static("adminlogin"));
app.use(express.static("admindashboard"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());   
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1); 


//==============================================================================||
  //== This code allows the frontend website (de-tunnel link) to talk to the ===||
  //== Node.js backend securely, using cookies and login sessions. =============||
//==============================================================================||
app.use(cors({
    origin: "https://ngu-attendance-system.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));


//====================================================================================||
  //== The reCAPTCHA lets the backend verify captcha responses, while the MySQL ======|| 
  //== session saves login sessions in your MySQL database so users stay logged in. ==||
//====================================================================================||
const RECAPTCHA_SECRET = "6Ld4-dorAAAAAB4Ls6Krrl8L67gfCBLHRwJdrT8l";

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});


//======================================================================================================||
//== Automatically switches cookie security based on environment and it prevents common issues like:    ||
//== Session not saving on localhost; Cookie blocking in Chrome; CORS “unknown address space” errors;   ||
//== Secure cookie errors without HTTPS                                                                 ||
//======================================================================================================||
const isProduction = process.env.NODE_ENV === "production";

app.use(session({
    secret: "240ebeb23a1d8160ba45102f705fa7c07d3cfb3732a9bea57930cf059cf6f09fd6171bb68d4cf98dd85c9af35b6630b4ccc93c11b1d1be08c9268b8d8a448e95",
    saveUninitialized: false,
    resave: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        secure: isProduction,     // true only when deployed with HTTPS
        sameSite: isProduction ? "none" : "lax" // avoids CORS issues in development
    }
}));


//==============================================================||
//== Use the Nodemailer package so the server can send emails ==||
//==============================================================||
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "euginemiranda292@gmail.com",
        pass: "rngh ixfn azyi lzva" 
    },
    tls: {
        // This tells Node.js to ignore the self-signed certificate error
        rejectUnauthorized: false
    }
});

// Verify connection configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.log("❌ Mail Server Error:", error);
    } else {
        console.log("✅ Mail Server is ready to take messages");
    }
});


//=========================================================================================================||
  //== THIS ROUTE IS WHEN A USER VISIT THE MAIN WEBSITE URL ("https://sx01rkvb-3000.asse.devtunnels.ms") ==||
//=========================================================================================================||
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "adminregister", "adminregister.html"));
});










app.post("/api/admin/register", async (req, res) => {
    const { email, unit, password } = req.body;

    if (!email || !unit || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = "INSERT INTO admins (email, unit, password_hash) VALUES (?, ?, ?)";
        
        db.query(sql, [email, unit, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ success: false, message: "Email already registered" });
                }
                return res.status(500).json({ success: false, message: "Internal server error" });
            }

            // --- EMAIL NOTIFICATION LOGIC ---
            const mailOptions = {
                from: '"Admin System" <euginemiranda292@gmail.com>',
                to: email, // The email the admin just registered with
                subject: "Registration Successful",
                text: `Hello! You have successfully registered your admin account for unit: ${unit}.`,
                html: `
                    <div style="font-family: 'Courier New', Courier, monospace; border: 1px solid #ccc; padding: 20px; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Registration Successful</h2>
                        <p>Hello,</p>
                        <p>Successfully registered your account as an administrator.</p>
                        <p><strong>Assigned Unit:</strong> ${unit}</p>
                        <p>You can now log in to the admin dashboard.</p>
                        <br>
                        <small>This is an automated message, please do not reply.</small>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("❌ Email failed to send:", error);
                    // We still return success: true because the account WAS created in the DB
                    return res.status(201).json({ 
                        success: true, 
                        message: "Account created, but email notification failed." 
                    });
                }
                console.log("✅ Confirmation email sent: " + info.response);
                res.status(201).json({ 
                    success: true, 
                    message: "Admin account created and notification email sent!" 
                });
            });
            // --------------------------------
        });
    } catch (err) {
        console.error("Hashing error:", err);
        res.status(500).json({ success: false, message: "Error processing registration" });
    }
});






app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM admins WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ success: false });
        }

        const admin = results[0];
        // Compare input password with the hashed password in database
        const match = await bcrypt.compare(password, admin.password_hash);

        if (match) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }
    });
});






app.post("/api/register", async (req, res) => {
    // 1. Remove contact from body
    const { firstName, lastName, address, unit } = req.body;

    // 2. Remove contact validation (Regex and null check)
    if (!firstName || !lastName || !address || !unit) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        // 3. Update query to only include 4 columns and 4 placeholders (?)
        const query = "INSERT INTO users (first_name, last_name, address, unit) VALUES (?, ?, ?, ?)";
        
        // 4. Update the parameter array
        await db.promise().query(query, [firstName.trim(), lastName.trim(), address, unit]);
        
        res.status(201).json({ success: true, message: "Registration successful!" });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ success: false, message: "Database error occurred." });
    }
});




app.post("/api/login", async (req, res) => {
    const { name } = req.body;
    const searchTerm = name.trim();
    
    // Check if a session is active, otherwise use defaults
    const attendanceDate = activeSession ? activeSession.eventDate : new Date().toISOString().slice(0, 10);
    const eventName = activeSession ? activeSession.eventType : "General Check-in";

    try {
        const promiseDb = db.promise();

        // 1. FIRST, find the user in the 'users' table
        const query = `
            SELECT CONCAT(first_name, ' ', last_name) AS name, address, unit, created_at 
            FROM users 
            WHERE first_name = ? 
               OR last_name = ?
               OR CONCAT(first_name, ' ', last_name) = ?
        `;
        
        let [results] = await promiseDb.query(query, [searchTerm, searchTerm, searchTerm]);

        // 1.5 If no exact match, try matching the beginning of the name (Partial Match)
        if (results.length === 0) {
            const partialQuery = `SELECT CONCAT(first_name, ' ', last_name) AS name, address, unit, created_at 
                                  FROM users WHERE first_name LIKE ? LIMIT 1`;
            [results] = await promiseDb.query(partialQuery, [`${searchTerm}%`]);
        }

        // 2. If we found a user, check if they already attended TODAY
        if (results.length > 0) {
            const user = results[0];

            const checkHistorySql = `
                SELECT * FROM attendance_history 
                WHERE name = ? AND attendance_date = ?
            `;
            const [historyResults] = await promiseDb.query(checkHistorySql, [user.name, attendanceDate]);

            if (historyResults.length > 0) {
                return res.json({ 
                    success: false, 
                    alreadyAttended: true, 
                    message: "Nakapag attendance ka na IYOOOOO!!! Ulit Ulit YARN?" 
                });
            }

            // 3. AUTO-SAVE to history immediately
            const saveSql = "INSERT INTO attendance_history (name, address, unit, attendance_date, event_name) VALUES (?, ?, ?, ?, ?)";
            await promiseDb.query(saveSql, [user.name, user.address, user.unit, attendanceDate, eventName]);

            // Notify Admin via Socket.io
            io.emit('new-user-login', { ...user, attendance_date: attendanceDate });
            
            return res.json({ success: true, user: user });

        } else {
            // No user found at all
            return res.json({ success: false, message: "Unknown Member" });
        }

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    }
});



app.get('/api/admin/users', (req, res) => {
    // Combine names so the frontend 'userData.name' logic doesn't break
    const sql = `
        SELECT 
            CONCAT(first_name, ' ', last_name) AS name, 
            address, 
            unit, 
            created_at 
        FROM users 
        ORDER BY created_at DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, data: results });
    });
});








app.post('/api/admin/log-attendance', async (req, res) => {
    const { eventType, eventDate } = req.body; // Receive date from frontend
    const promiseDb = db.promise();

    try {
        await promiseDb.query("START TRANSACTION");

        const [users] = await promiseDb.query("SELECT * FROM users");
        if (users.length === 0) {
            await promiseDb.query("ROLLBACK");
            return res.json({ success: false, message: "No members to log." });
        }

        // Use eventDate here instead of the old 'today' variable
        const values = users.map(u => [u.first_name + ' ' + u.last_name, u.address, u.unit, eventDate, eventType]);
        const sql = "INSERT INTO attendance_history (name, address, unit, attendance_date, event_name) VALUES ?";
        await promiseDb.query(sql, [values]);

        await promiseDb.query("DELETE FROM users");
        await promiseDb.query("COMMIT");
        
        res.json({ success: true, message: `Logged ${users.length} members for ${eventDate}!` });
    } catch (err) {
        await promiseDb.query("ROLLBACK");
        res.status(500).json({ success: false, message: "Server Error" });
    }
});




// Route to fetch grouped history for the "Dates Attended" section
app.get('/api/admin/attendance-history', (req, res) => {
    // Explicitly selecting columns is better practice
    const sql = `
        SELECT 
            name, 
            address, 
            unit, 
            attendance_date, 
            event_name 
        FROM attendance_history 
        ORDER BY attendance_date DESC, name ASC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        
        // Return the results to the frontend
        res.json({ success: true, data: results });
    });
});


// Route to delete attendance for a specific date
app.delete('/api/admin/delete-attendance/:date', (req, res) => {
    const attendanceDate = req.params.date;

    const sql = "DELETE FROM attendance_history WHERE attendance_date = ?";

    db.query(sql, [attendanceDate], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, message: `Deleted ${result.affectedRows} records.` });
    });
});




app.post('/api/admin/save-single-attendance', async (req, res) => {
    const { userData, eventType, eventDate } = req.body;
    const sql = "INSERT INTO attendance_history (name, address, unit, attendance_date, event_name) VALUES (?, ?, ?, ?, ?)";
    
    db.query(sql, [userData.name, userData.address, userData.unit, eventDate, eventType], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});



app.put('/api/admin/update-member', async (req, res) => {
    const { originalName, firstName, lastName, address, unit } = req.body;
    const newFullName = `${firstName} ${lastName}`.trim();
    const promiseDb = db.promise();

    try {
        await promiseDb.query("START TRANSACTION");

        // 1. Update the main Directory
        const updateUsersSql = `
            UPDATE users 
            SET first_name = ?, last_name = ?, address = ?, unit = ? 
            WHERE CONCAT(first_name, ' ', last_name) = ?
        `;
        await promiseDb.query(updateUsersSql, [firstName, lastName, address, unit, originalName]);

        // 2. Update all historical records in Attendance History
        // We match by the old full name and update to the new details
        const updateHistorySql = `
            UPDATE attendance_history 
            SET name = ?, address = ?, unit = ? 
            WHERE name = ?
        `;
        await promiseDb.query(updateHistorySql, [newFullName, address, unit, originalName]);

        await promiseDb.query("COMMIT");
        res.json({ success: true, message: "Member and History updated!" });

    } catch (err) {
        await promiseDb.query("ROLLBACK");
        console.error("Global Update Error:", err);
        res.status(500).json({ success: false, message: "Database error during sync." });
    }
});



//===================================||
  //== THIS ROUTE START THE SERVER ==||
//===================================||
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});