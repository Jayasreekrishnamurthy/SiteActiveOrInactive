import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";


const CheckStatus = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Fetch history on load
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/history")
      .then((res) => setHistory(res.data))
      .catch((err) => console.error("Error fetching history:", err));
  }, []);

  // Auto re-check every 5 mins
  useEffect(() => {
    if (history.length === 0) return;
    const interval = setInterval(() => {
      history.forEach((item, index) => {
        checkRowStatus(index, item.url, true);
      });
    }, 300000);
    return () => clearInterval(interval);
  }, [history]);

  // Manual check single website
  const checkWebsite = async () => {
    if (!url) return;
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/check", { url });
      const result = response.data;

      const newEntry = {
        url,
        status: result.status,
        message: result.message,
        code: result.statusCode,
        time: new Date().toLocaleString(),
      };

      await axios.post("http://localhost:5000/api/history", newEntry);
      setHistory((prev) => [...prev, newEntry]);
    } catch {
      const errorEntry = {
        url,
        status: "inactive",
        message: "Error checking website",
        code: "N/A",
        time: new Date().toLocaleString(),
      };
      await axios.post("http://localhost:5000/api/history", errorEntry);
      setHistory((prev) => [...prev, errorEntry]);
    }

    setUrl("");
    setLoading(false);
  };

  // Re-check row (manual/auto)
  const checkRowStatus = async (index, url, isAuto = false) => {
    try {
      const response = await axios.post("http://localhost:5000/api/check", { url });
      const result = response.data;

      const updatedEntry = {
        url,
        status: result.status,
        message: result.message,
        code: result.statusCode,
        time: new Date().toLocaleString(),
      };

      setHistory((prev) => {
        const newHistory = [...prev];
        newHistory[index] = updatedEntry;
        return newHistory;
      });

      if (!isAuto) {
        await axios.post("http://localhost:5000/api/history", updatedEntry);
      }
    } catch {
      const errorEntry = {
        url,
        status: "inactive",
        message: "Error checking website",
        code: "N/A",
        time: new Date().toLocaleString(),
      };

      setHistory((prev) => {
        const newHistory = [...prev];
        newHistory[index] = errorEntry;
        return newHistory;
      });

      if (!isAuto) {
        await axios.post("http://localhost:5000/api/history", errorEntry);
      }
    }
  };

  // Delete row
  const deleteRow = async (index) => {
    await axios.delete(`http://localhost:5000/api/history/${index}`);
    setHistory((prev) => prev.filter((_, i) => i !== index));
  };

  // Import Excel/CSV
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const urls = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).flat();

      const entries = urls
        .filter((link) => link && typeof link === "string")
        .map((link) => ({
          url: link,
          status: "Not Checked",
          message: "-",
          code: "-",
          time: "-",
        }));

      setHistory((prev) => [...prev, ...entries]);
    };
    reader.readAsArrayBuffer(file);
  };

  // Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = history.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(history.length / rowsPerPage);

  return (
    <div>
      <div className="checker-box">
        <h2>Check Website</h2>
        <div className="input-group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL"
          />
          <button onClick={checkWebsite}>Check</button>
        </div>
        {loading && <p>Checking...</p>}

        {/* Excel Upload */}
        <div className="upload-group">
          <h3>Import from Excel/CSV</h3>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
        </div>
      </div>

      {/* History Table */}
      <div className="history-table">
        <h2>History</h2>
        {history.length === 0 ? (
          <p>No websites checked yet.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>SNO</th>
                  <th>Website URL</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>HTTP Code</th>
                  <th>Checked At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((item, index) => (
                  <tr key={index} className={item.status}>
                    <td>{indexOfFirstRow + index + 1}</td>
                    <td>{item.url}</td>
                    <td>{item.status}</td>
                    <td>{item.message}</td>
                    <td>{item.code}</td>
                    <td>{item.time}</td>
                    <td>
                      <button
                        className="recheck-btn"
                        onClick={() =>
                          checkRowStatus(indexOfFirstRow + index, item.url)
                        }
                      >
                        Check
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => deleteRow(indexOfFirstRow + index)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

         {/* Pagination */}
<div className="pagination-container">
  <Stack spacing={2} alignItems="center" sx={{ marginTop: 2 }}>
    <Pagination
      count={totalPages} // total pages
      page={currentPage} // current active page
      onChange={(e, page) => setCurrentPage(page)} // handle page change
      color="primary" // style (you can use "secondary" too)
    />
  </Stack>
</div>

          </>
        )}
      </div>
    </div>
  );
};

export default CheckStatus;
