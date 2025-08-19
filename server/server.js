// backend/server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const https = require("https");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const HISTORY_FILE = "history.json";

// Allow self-signed/old SSL certs
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // ignore SSL errors
});

// Website status check API
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
      statusCode: response.status,
      message: "Website is reachable",
    });
  } catch (error) {
    res.json({
      status: "inactive",
      statusCode: error.response ? error.response.status : 500,
      message: error.message,
    });
  }
});

// ----------------- NEW: HISTORY APIs -----------------

// Get all history
app.get("/api/history", (req, res) => {
  fs.readFile(HISTORY_FILE, "utf8", (err, data) => {
    if (err) return res.json([]); // no file yet
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

// Save new entry to history
app.post("/api/history", (req, res) => {
  const newEntry = req.body;

  fs.readFile(HISTORY_FILE, "utf8", (err, data) => {
    let history = [];
    if (!err && data) {
      try {
        history = JSON.parse(data);
      } catch {}
    }

    history.push(newEntry);

    fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Failed to save" });
      res.json({ success: true });
    });
  });
});

// Delete entry by index
app.delete("/api/history/:index", (req, res) => {
  const index = parseInt(req.params.index, 10);

  fs.readFile(HISTORY_FILE, "utf8", (err, data) => {
    let history = [];
    if (!err && data) {
      try {
        history = JSON.parse(data);
      } catch {}
    }

    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
    }

    fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete" });
      res.json({ success: true });
    });
  });
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
