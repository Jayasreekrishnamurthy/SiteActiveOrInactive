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

// API endpoint to insert data
app.get("/api/records", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM records");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch records" });
  }
});

// POST new record
app.post("/api/records", async (req, res) => {
  try {
    let { url, public_ip, private_ip, contact, department } = req.body;

    // Normalize again on backend (security & consistency)
    url = url.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "").toLowerCase();

    // Check duplicate
    const [existing] = await db.query("SELECT * FROM records WHERE url = ?", [url]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "❌ Duplicate site already exists!" });
    }

    const [result] = await db.query(
      "INSERT INTO records (url, public_ip, private_ip, contact, department) VALUES (?, ?, ?, ?, ?)",
      [url, public_ip, private_ip, contact, department]
    );

    res.json({
      message: "✅ Record added successfully!",
      record: { id: result.insertId, url, public_ip, private_ip, contact, department },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});


// DELETE record
app.delete("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM records WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "❌ Record not found" });
    }
    res.json({ message: "✅ Record deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to delete record" });
  }
});
app.put("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  const { url, public_ip, private_ip, contact, department } = req.body;

  try {
    // Check duplicate URL (exclude current record)
    const [existing] = await db.query("SELECT id FROM records WHERE url = ? AND id != ?", [url, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "❌ URL already exists!" });
    }

    const [result] = await db.query(
      "UPDATE records SET url = ?, public_ip = ?, private_ip = ?, contact = ?, department = ? WHERE id = ?",
      [url, public_ip, private_ip, contact, department, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "❌ Record not found" });
    }

    res.json({
      message: "✅ Record updated successfully!",
      record: { id: parseInt(id), url, public_ip, private_ip, contact, department }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to update record" });
  }
});

app.post("/api/records/batch", async (req, res) => {
  const records = req.body.records; // array of records
  try {
    const placeholders = records.map(() => "(?, ?, ?, ?, ?)").join(",");
    const values = records.flatMap(r => [r.url, r.public_ip, r.private_ip, r.contact, r.department]);
    const sql = `INSERT INTO records (url, public_ip, private_ip, contact, department) VALUES ${placeholders}`;
    await db.query(sql, values);
    res.json({ message: "Batch records added successfully", records });
  } catch (err) {
    res.status(500).json({ message: "Error saving records", error: err });
  }
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


function getSSLCertificate(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      port,
      method: "GET",
      rejectUnauthorized: false,
      servername: hostname,
      agent: false,
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate(true);
      if (!cert || Object.keys(cert).length === 0) {
        return reject("No certificate found");
      }

      resolve({
        hostname,
        subjectCN: cert.subject?.CN || "",
        issuerO: cert.issuer?.O || "",
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        valid: new Date(cert.valid_to) > new Date(),
      });
    });

    req.on("error", (err) => reject(err.message));
    req.end();
  });
}

// --- API Endpoints ---

// Fetch all records
app.get("/api/ssl-records", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM ssl_records ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch SSL records" });
  }
});

// Add new record
app.post("/api/add-record", async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const hostname = new URL(url).hostname;
    let certInfo;
    try {
      certInfo = await getSSLCertificate(hostname);
    } catch {
      certInfo = {
        hostname,
        subjectCN: "",
        issuerO: "",
        validFrom: null,
        validTo: null,
        valid: false,
      };
    }

    await db.query(
      `INSERT INTO ssl_records (url, subjectCN, issuerO, validFrom, validTo, valid)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         subjectCN = VALUES(subjectCN),
         issuerO = VALUES(issuerO),
         validFrom = VALUES(validFrom),
         validTo = VALUES(validTo),
         valid = VALUES(valid),
         updated_at = CURRENT_TIMESTAMP`,
      [url, certInfo.subjectCN, certInfo.issuerO, certInfo.validFrom, certInfo.validTo, certInfo.valid ? 1 : 0]
    );

    const [rows] = await db.query("SELECT * FROM ssl_records WHERE url = ?", [url]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Add record error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Recheck SSL
app.get("/api/check-ssl", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const hostname = new URL(url).hostname;
    const certInfo = await getSSLCertificate(hostname);

    await db.query(
      `UPDATE ssl_records
       SET subjectCN=?, issuerO=?, validFrom=?, validTo=?, valid=?, updated_at=CURRENT_TIMESTAMP
       WHERE url=?`,
      [
        certInfo.subjectCN,
        certInfo.issuerO,
        certInfo.validFrom,
        certInfo.validTo,
        certInfo.valid ? 1 : 0,
        url,
      ]
    );

    // ✅ Return updated row including updated_at
    const [rows] = await db.query(
      "SELECT * FROM ssl_records WHERE url = ?",
      [url]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Recheck error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE SSL record
app.delete("/api/delete-record", async (req, res) => {
  const { url } = req.body; // URL of the record to delete
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const [result] = await db.query("DELETE FROM ssl_records WHERE url = ?", [url]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({ message: `Deleted ${url} successfully` });
  } catch (err) {
    console.error("Delete record error:", err);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

// --- Serve frontend ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// ----------------- SERVER START -----------------
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
