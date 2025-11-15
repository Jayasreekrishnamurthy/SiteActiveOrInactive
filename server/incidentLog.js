import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "incidentLog.json");

// create file if not exists
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

// append new log
app.post("/api/file-log", (req, res) => {
  try {
    const logs = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const newLog = {
      id: Date.now(),
      url: req.body.url,
      status: req.body.status,
      message: req.body.message,
      code: req.body.code,
      time: req.body.time,
    };

    logs.push(newLog);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));

    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: "Error writing JSON log" });
  }
});
