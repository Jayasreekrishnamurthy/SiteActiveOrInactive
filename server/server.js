import express from "express";
import axios from "axios";
import cors from "cors";
import https from "https";
import mysql from "mysql2/promise";

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
  const { url } = req.body;

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

// ----------------- SERVER START -----------------
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
