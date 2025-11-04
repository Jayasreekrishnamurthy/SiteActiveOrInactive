import express from "express";
import axios from "axios";
import cors from "cors";
import https from "https";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import tls from "tls";
import nodemailer from "nodemailer";
import multer from "multer";
import puppeteer from 'puppeteer';
import dns from "dns/promises";
// import tls from "tls";
import { parse as parseUrl } from "url";
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
// app.post("/api/check", async (req, res) => {
//   let { url } = req.body;

//   if (!/^https?:\/\//i.test(url)) {
//     url = `https://${url}`;
//   }

//   try {
//     const response = await axios.get(url, {
//       timeout: 30000,
//       maxRedirects: 5,
//       httpsAgent: new https.Agent({ rejectUnauthorized: false }), // 🚨 skip cert validation
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
//         "Accept":
//           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
//         "Accept-Language": "en-US,en;q=0.5",
//         "Cache-Control": "no-cache",
//       },
//       validateStatus: (status) => status < 500,
//     });

//     res.json({
//       status: response.status < 400 ? "active" : "inactive",
//       code: response.status,
//       message:
//         response.status < 400
//           ? "Website is reachable"
//           : `Request failed with status code ${response.status}`,
//     });
//   } catch (error) {
//     res.json({
//       status: "inactive",
//       code: error.response ? error.response.status : 500,
//       message: error.message,
//     });
//   }
// });


app.post("/api/check", async (req, res) => {
  let { url } = req.body;

  if (!url || !url.trim()) {
    return res
      .status(400)
      .json({ status: "error", message: "URL is required" });
  }

  // Ensure URL has http/https prefix
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // ⏱ Dynamic timeout based on domain type
  // Government and .org domains are often slower
  let timeout = 30000; // default 30s
  if (url.includes(".gov") || url.includes(".edu") || url.includes(".org")) {
    timeout = 60000; // 60 seconds for slow sites
  }

  try {
    const response = await axios.get(url, {
      timeout, // ⏱ dynamic
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }), // allow SSL issues
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
      validateStatus: () => true, // ✅ accept all statuses (even 500)
    });

    // ✅ If we got any response, it means the site is active
    return res.json({
      status: "active",
      code: response.status,
      message: `Website responded with status code ${response.status}`,
      timeoutUsed: `${timeout / 1000}s`,
    });
  } catch (error) {
    // ❌ Only true network errors mean inactive
    let reason = "Unknown error";
    if (error.code === "ENOTFOUND") reason = "Domain not found";
    else if (error.code === "ECONNREFUSED") reason = "Connection refused";
    else if (error.code === "ETIMEDOUT" || error.message.includes("timeout"))
      reason = "Connection timed out";

    return res.json({
      status: "inactive",
      code: error.response ? error.response.status : 500,
      message: reason,
      timeoutUsed: `${timeout / 1000}s`,
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


// Get IP address
async function getIPAddress(hostname) {
  try {
    const addresses = await dns.lookup(hostname);
    return addresses.address;
  } catch (err) {
    return null;
  }
}

// Get TLS certificate info
async function getCertificateInfo(hostname) {
  return new Promise((resolve) => {
    const options = {
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false, // allow self-signed certs
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert);
    });

    socket.on("error", () => resolve(null));
  });
}

// -------------------- Scan Endpoint --------------------
app.get("/scan", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
const hostname = parseUrl(normalizedUrl).hostname;


  let browser;
  try {
    // Get IP and certificate info
    const ipAddress = await getIPAddress(hostname);
    const certificate = await getCertificateInfo(hostname);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Page settings
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Block images/fonts/styles
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font"].includes(resourceType)) req.abort();
      else req.continue();
    });

    page.setDefaultNavigationTimeout(120000); // 2 minutes

    async function safeGoto(targetUrl, options = {}) {
      try {
        return await page.goto(targetUrl, options);
      } catch (firstErr) {
        console.warn("First navigation attempt failed, retrying...", firstErr.message);
        try {
          return await page.goto(targetUrl, options);
        } catch (secondErr) {
          throw secondErr;
        }
      }
    }

    const response = await safeGoto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    let headers = {};
    if (response && typeof response.headers === "function") headers = response.headers();

    const html = await page.content();

    // -------------------- Tech Detection --------------------
    let frontend = [];
    let backend = [];
    let cms = [];

    // CMS Detection
    if (/wp-content|wordpress/i.test(html) || /wp-admin/i.test(html)) cms.push("WordPress");
    if (/Drupal/i.test(html) || /drupal/i.test(html)) cms.push("Drupal");
    if (/Joomla/i.test(html) || /option=com_/i.test(html)) cms.push("Joomla");

    // Frontend Detection
    try {
      const isReact = await page.evaluate(() => !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
      const isVue = await page.evaluate(() => !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__);
      if (isReact) frontend.push("React");
      if (isVue) frontend.push("Vue.js");
    } catch (e) {}

    if (/React(\s|<)/i.test(html)) frontend.push("React");
    if (/Vue(\s|<)/i.test(html)) frontend.push("Vue.js");
    if (/__NEXT_DATA__/.test(html) || /_next\/static\//i.test(html)) frontend.push("Next.js");
    if (/__NUXT__/.test(html) || /_nuxt\//i.test(html)) frontend.push("Nuxt.js");
    if (/ng-version/.test(html) || /Angular/i.test(html)) frontend.push("Angular");
    if (/Svelte/i.test(html)) frontend.push("Svelte");
    if (/jQuery/i.test(html)) frontend.push("jQuery");
    if (/Ember/i.test(html)) frontend.push("Ember.js");
    if (/Backbone/i.test(html)) frontend.push("Backbone.js");
    if (/Alpine.js/i.test(html)) frontend.push("Alpine.js");
    if (/webpackJsonp|__webpack_require__/.test(html)) frontend.push("Webpack");
    if (/parcelRequire/.test(html)) frontend.push("Parcel");
    if (/vite\/client/.test(html)) frontend.push("Vite");

    // Backend Detection
    const serverHeader = headers["server"] || null;
    const poweredBy = headers["x-powered-by"] || null;

    if (poweredBy && /PHP/i.test(poweredBy)) backend.push("PHP");
    if (serverHeader && /nginx|apache/i.test(serverHeader)) {}
    if (/index\.php/i.test(html) || /php\?/i.test(html)) backend.push("PHP");
    if (poweredBy && /Express/i.test(poweredBy)) backend.push("Node.js/Express");
    if (poweredBy && /ASP.NET/i.test(poweredBy)) backend.push("ASP.NET");
    if (/csrftoken/i.test(html) || /csrfmiddlewaretoken/i.test(html)) backend.push("Python/Django");
    const setCookie = headers["set-cookie"] || "";
    if (/laravel_session/i.test(setCookie)) backend.push("Laravel/PHP");
    if (/connect.sid/i.test(setCookie)) backend.push("Node.js/Express (connect.sid)");

    // Meta generator
    let metaGenerator = null;
    try {
      metaGenerator = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="generator"]');
        return meta ? meta.content : null;
      });
      if (metaGenerator) cms.push(metaGenerator);
    } catch (e) {}

    // -------------------- XSS / Script Analysis --------------------
    const scriptMatches = [...html.matchAll(/<script[\s\S]*?>[\s\S]*?<\/script>/gi)];
    const xssVulnerabilities = scriptMatches.map((m) => m[0]);

    // -------------------- Hacked / Compromised Check --------------------
    let hackedMessage = null;
    const hackPatterns = [
      /hacked by/i,
      /defaced/i,
      /malware/i,
      /shell/i,
      /<iframe[\s\S]*?src=['"]?http/i,
    ];
    if (hackPatterns.some((pattern) => pattern.test(html))) hackedMessage = "Website might be hacked or compromised";

    // -------------------- Response --------------------
    res.json({
      url: normalizedUrl,
      ipAddress,
      certificate,
      frontend: frontend.length ? Array.from(new Set(frontend)) : ["Unknown"],
      backend: backend.length ? Array.from(new Set(backend)) : ["Unknown"],
      cms: cms.length ? Array.from(new Set(cms)) : ["Unknown"],
      totalScripts: xssVulnerabilities.length,
      xssVulnerabilities,
      serverHeader,
      poweredBy,
      metaGenerator,
      hackedMessage,
    });

  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Error scanning the website", details: err.message });
  } finally {
    try { if (browser) await browser.close(); } catch (e) {}
  }
});




// 🔹 Helper: check TLS certificate
function getCertInfo(siteUrl) {
  return new Promise((resolve) => {
    try {
      if (!/^https?:\/\//i.test(siteUrl)) siteUrl = "https://" + siteUrl.trim();
      const { hostname, port } = new URL(siteUrl);

      const options = {
        host: hostname,
        port: port || 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 15000,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          resolve({ url: siteUrl, status: "Pending" });
        } else {
          const validTo = new Date(cert.valid_to);
          const daysLeft = Math.ceil(
            (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          resolve({
            url: siteUrl,
            validTo,
            daysLeft,
            subject: cert.subject,
            issuer: cert.issuer,
            status: daysLeft > 0 ? "OK" : "Expired",
          });
        }
        socket.end();
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ url: siteUrl, status: "Pending" });
      });

      socket.on("error", () => {
        resolve({ url: siteUrl, status: "Pending" });
      });
    } catch (err) {
      resolve({ url: siteUrl, status: "Pending" });
    }
  });
}


// 🔹 API: Add or check certificate
app.post("/check-cert", async (req, res) => {
  const { url, mail } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const certInfo = await getCertInfo(url);

    // Save or update in DB
    await db.query(
      `INSERT INTO tls_monitor (url, mail, subjectCN, issuerCN, validTo, daysLeft, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mail=VALUES(mail),
         subjectCN=VALUES(subjectCN),
         issuerCN=VALUES(issuerCN),
         validTo=VALUES(validTo),
         daysLeft=VALUES(daysLeft),
         status=VALUES(status),
         checkedAt=NOW()`,
      [
        certInfo.url,
        mail || null,
        certInfo.subject?.CN || "",
        certInfo.issuer?.CN || "",
        certInfo.validTo,
        certInfo.daysLeft,
        certInfo.daysLeft > 0 ? "OK" : "Expired",
      ]
    );

    // Send alert if expiring soon
    if (mail && certInfo.daysLeft < 10) {
      await transporter.sendMail({
        from: '"Cert Monitor" <jayasreek2910@gmail.com>',
        to: mail,
        subject: `⚠ TLS Certificate Expiry Alert: ${url}`,
        text: `ALERT: The TLS certificate for ${url} will expire on ${certInfo.validTo} (${certInfo.daysLeft} days left).`,
        html: `<h2>⚠ TLS Certificate Expiry Alert</h2>
               <p><b>Website:</b> ${url}</p>
               <p><b>Expires On:</b> ${certInfo.validTo}</p>
               <p><b>Days Remaining:</b> ${certInfo.daysLeft}</p>`,
      });
    }

    res.json(certInfo);
  } catch (err) {
    console.error("Error checking certificate:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 API: Get all certs
app.get("/certs", async (req, res) => {
  try {
    // 1️⃣ Fetch all certs
    const [certs] = await db.query("SELECT * FROM tls_monitor");

    // 2️⃣ Fetch all records (from RecordForm)
    const [records] = await db.query("SELECT url FROM records"); // adjust table name

    // 3️⃣ Insert missing URLs into tls_monitor
    for (const rec of records) {
      const exists = certs.find((c) => c.url === rec.url);
      if (!exists) {
        await db.query(
          `INSERT INTO tls_monitor (url, status) VALUES (?, ?)`,
          [rec.url, "Pending"]
        );
      }
    }

    // 4️⃣ Return updated certs
    const [updatedCerts] = await db.query("SELECT * FROM tls_monitor");
    res.json(updatedCerts);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});
//update
app.put("/certs/:id", async (req, res) => {
  try {
    const { mail } = req.body;

    const [result] = await db.query(
      "UPDATE tls_monitor SET mail=? WHERE id=?",
      [mail, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 API: Delete a cert
app.delete("/certs/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM tls_monitor WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 API: Re-check (refresh cert info)
// 🔹 API: Re-check (refresh cert info + send mail)
app.put("/certs/:id/recheck", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM tls_monitor WHERE id=?", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const site = rows[0];
    const certInfo = await getCertInfo(site.url);

    // update DB
await db.query(
  `UPDATE tls_monitor
   SET subjectCN=?, issuerCN=?, validTo=?, daysLeft=?, status=?, checkedAt=NOW()
   WHERE id=?`,
  [
    certInfo.subject?.CN || "",
    certInfo.issuer?.CN || "",
    certInfo.validTo || null,
    certInfo.daysLeft || null,
    certInfo.status || "Pending",
    req.params.id
  ]
);


    // 🔹 Send email on recheck (if mail exists)
    if (site.mail) {
      await transporter.sendMail({
        from: '"Cert Monitor" <jayasreek2910@gmail.com>',
        to: site.mail,
        subject: `🔄 TLS Certificate Rechecked: ${site.url}`,
        text: `The TLS certificate for ${site.url} was rechecked.
Expires: ${certInfo.validTo}
Days Remaining: ${certInfo.daysLeft}
Status: ${certInfo.daysLeft > 0 ? "OK" : "Expired"}`,
        html: `<h2>🔄 TLS Certificate Rechecked</h2>
               <p><b>Website:</b> ${site.url}</p>
               <p><b>Expires On:</b> ${certInfo.validTo}</p>
               <p><b>Days Remaining:</b> ${certInfo.daysLeft}</p>
               <p><b>Status:</b> ${certInfo.daysLeft > 0 ? "✅ OK" : "❌ Expired"}</p>`
      });
    }

    res.json({ message: "Recheck successful (mail sent if configured)", ...certInfo });
  } catch (err) {
    console.error("Recheck error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ----------------- SERVER START -----------------
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
