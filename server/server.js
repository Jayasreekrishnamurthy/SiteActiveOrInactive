import express from "express";
import axios from "axios";
import cors from "cors";
import https from "https";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 MySQL connection
const db = await mysql.createPool({
  host: "localhost",
  user: "root",      // change if needed
  password: "",      // change if needed
  database: "website_checker", // make sure this DB exists
});

// Allow self-signed/old SSL certs
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // ignore SSL errors
});

// ----------------- WEBSITE STATUS CHECK -----------------
app.post("/api/check", async (req, res) => {
  let { url } = req.body;

  // ✅ Normalize & validate URL
  try {
    // If user forgets "http://" → prepend it
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }
    new URL(url); // throws if invalid
  } catch (err) {
    return res.status(400).json({
      status: "inactive",
      code: 400,
      message: "Invalid URL format",
    });
  }

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      httpsAgent,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    res.json({
      status: "active",
      code: response.status,
      message: "Website is reachable",
    });
  } catch (error) {
    res.json({
      status: "inactive",
      code: error.response ? error.response.status : 500,
      message: error.message,
    });
  }
});


// ----------------- HISTORY CRUD -----------------

// ➤ Get all history (map DB `code` -> API `statusCode`)
app.get("/api/history", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM history ORDER BY id DESC");

    // Fix column mapping here
    const formatted = rows.map((r) => ({
      id: r.id,
      url: r.url,
      status: r.status,
      message: r.message,
      code: r.code, 
      time: r.time,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➤ Insert new record
app.post("/api/history", async (req, res) => {
  const { url, status, message, code, time } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO history (url, status, message, code, time) VALUES (?, ?, ?, ?, ?)",
      [url, status, message, code, time]
    );
    res.json({ id: result.insertId, url, status, message, code, time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➤ Update record
app.put("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  const { url, status, message, code, time } = req.body;
  try {
    await db.query(
      "UPDATE history SET url=?, status=?, message=?, code=?, time=? WHERE id=?",
      [url, status, message, code, time, id]
    );
    res.json({ id, url, status, message, code, time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➤ Delete record
app.delete("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM history WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ----------------- AUTH (REGISTER & LOGIN) -----------------
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    res.json({ message: "User registered successfully!", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Registration failed", details: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      "jwtSecretKey", // ⚠️ use process.env.JWT_SECRET in production
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});




// Multer setup (store files in uploads/ folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')  // make sure "uploads" folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)) // unique file name
  }
})
const upload = multer({ storage: storage })

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// 📌 API route with file upload
app.post('/api/contact', upload.single('image'), (req, res) => {
  const { name, email, phone, subject, message } = req.body
  const imageFile = req.file

  if (!name || !email || !phone || !subject || !message) {
    return res.status(400).json({ error: "All fields are required." })
  }

  // Admin Email Template
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Ticket Raise Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    </div>
  `

  // User Acknowledgment Email Template
  const userHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Ticket Raise Form Received</h2>
      <p>Dear ${name},</p>
      <p>Thank you for contacting us. We will get back to you soon!</p>
    </div>
  `

  // Admin Mail (with attachment if uploaded)
  const adminMailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: subject,
    html: adminHtml,
    attachments: imageFile
      ? [{ filename: imageFile.originalname, path: imageFile.path }]
      : [],
  }

  // User Mail
  const userMailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Thank you for contacting us!',
    html: userHtml,
  }

  // Send admin email
  transporter.sendMail(adminMailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email to admin:', error)
      return res.status(500).json({ error: 'Failed to send email to admin.' })
    }

    console.log('Admin email sent:', info.response)

    // Send user acknowledgment email
    transporter.sendMail(userMailOptions, (error, info) => {
      if (error) {
        console.error('Error sending acknowledgment email:', error)
        return res.status(500).json({ error: 'Failed to send acknowledgment email.' })
      }

      console.log('Acknowledgment email sent:', info.response)
      res.status(200).json({ success: true, message: 'Emails sent successfully!' })
    })
  })
})


// ----------------- SERVER START -----------------
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
