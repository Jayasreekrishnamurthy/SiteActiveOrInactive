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
  const [searchTerm, setSearchTerm] = useState("");   // ✅ search
  const [statusFilter, setStatusFilter] = useState("all"); // ✅ filter
  const rowsPerPage = 10;

  // Fetch history on load
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/history")
      .then((res) => setHistory(res.data))
      .catch((err) => console.error("Error fetching history:", err));
  }, []);
  // ✅ Auto recheck every 5 mins
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Loop through all history records and refresh them
        for (let item of history) {
          await checkRowStatus(item);
        }
      } catch (err) {
        console.error("Error auto rechecking websites:", err);
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [history]);

  // Manual check single website (Insert into DB)
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
        code: result.code,
        time: new Date().toLocaleString(),
      };

      const res = await axios.post("http://localhost:5000/api/history", newEntry);
      setHistory((prev) => [...prev, res.data]); // DB returns new record with id
    } catch {
      const errorEntry = {
        url,
        status: "inactive",
        message: "Error checking website",
        code: "N/A",
        time: new Date().toLocaleString(),
      };
      const res = await axios.post("http://localhost:5000/api/history", errorEntry);
      setHistory((prev) => [...prev, res.data]);
    }

    setUrl("");
    setLoading(false);
  };

  // Re-check row (Update in DB)
  const checkRowStatus = async (item) => {
    try {
      const response = await axios.post("http://localhost:5000/api/check", { url: item.url });
      const result = response.data;

      const updatedEntry = {
        url: item.url,
        status: result.status,
        message: result.message,
        code: result.code,
        time: new Date().toLocaleString(),
      };

      const res = await axios.put(
        `http://localhost:5000/api/history/${item.id}`,
        updatedEntry
      );

      setHistory((prev) =>
        prev.map((h) => (h.id === item.id ? res.data : h))
      );
    } catch {
      const errorEntry = {
        url: item.url,
        status: "inactive",
        message: "Error checking website",
        code: "N/A",
        time: new Date().toLocaleString(),
      };

      const res = await axios.put(
        `http://localhost:5000/api/history/${item.id}`,
        errorEntry
      );

      setHistory((prev) =>
        prev.map((h) => (h.id === item.id ? res.data : h))
      );
    }
  };

  // Delete row (Delete from DB)
  const deleteRow = async (id) => {
    await axios.delete(`http://localhost:5000/api/history/${id}`);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  // Import Excel/CSV (Insert all into DB)
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

      for (let link of urls) {
        if (link && typeof link === "string") {
          const entry = {
            url: link,
            status: "Not Checked",
            message: "-",
            code: "-",
            time: "-",
          };

          const res = await axios.post("http://localhost:5000/api/history", entry);
          setHistory((prev) => [...prev, res.data]);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ✅ Filter + Search Logic
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toString().includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredHistory.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage);

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
      {/* ✅ Search + Filter Controls */}
      <div className="filter-bar" style={{ margin: "20px 0", display: "flex", gap: "15px" }}>
        <input
          type="text"
          placeholder="Search by URL / Message / Code"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1); // reset page on search
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* History Table */}
      <div className="history-table">
        <h2>History</h2>
        {filteredHistory.length === 0 ? (
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
                  <tr key={item.id} className={item.status}>
                    <td>{indexOfFirstRow + index + 1}</td>
                    <td>{item.url}</td>
                    <td>{item.status}</td>
                    <td>{item.message}</td>
                    <td>{item.code}</td>
                    <td>{item.time}</td>
                    <td>
                      <select
                        className="status-dropdown"
                        value={item.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          let newMessage = "-";
                          let newCode = "-";

                          if (newStatus === "active") {
                            newMessage = "Website is reachable";
                            newCode = "200";
                          } else if (newStatus === "inactive") {
                            newMessage = "Set to Inactive";
                            newCode = "503";
                          }

                          const updatedEntry = {
                            ...item,
                            status: newStatus,
                            message: newMessage,
                            code: newCode,
                            time: new Date().toLocaleString(),
                          };

                          try {
                            const res = await axios.put(
                              `http://localhost:5000/api/history/${item.id}`,
                              updatedEntry
                            );
                            setHistory((prev) =>
                              prev.map((h) => (h.id === item.id ? res.data : h))
                            );
                          } catch (err) {
                            console.error("Error updating status manually:", err);
                          }
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <button
                        className="recheck-btn"
                        onClick={() => checkRowStatus(item)}
                      >
                        Check
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => deleteRow(item.id)}
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
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, page) => setCurrentPage(page)}
                  color="primary"
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
