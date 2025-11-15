import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CheckStatus = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const rowsPerPage = 10;

  // ✅ Utility to normalize URLs (lowercase + trim + remove trailing slash)
  const normalizeUrl = (link) =>
    link.trim().toLowerCase().replace(/\/$/, "");

  // ✅ Fetch history + records (DB is the source of truth)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const recordsRes = await axios.get("http://localhost:5000/api/records");
        const historyRes = await axios.get("http://localhost:5000/api/history");

        const records = recordsRes.data || [];
        const histories = historyRes.data || [];

        // merge unique by normalized url
        const merged = [
          ...histories,
          ...records
            .filter(
              (rec) =>
                !histories.find(
                  (h) => normalizeUrl(h.url) === normalizeUrl(rec.url)
                )
            )
            .map((rec) => ({
              id: `rec-${rec.id}`,
              url: rec.url,
              status: "Not Checked",
              message: "-",
              code: "-",
              time: "-",
            })),
        ];

        // remove duplicates (case-insensitive)
        const unique = Array.from(
          new Map(merged.map((item) => [normalizeUrl(item.url), item])).values()
        );

        setHistory(unique);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, []);

  
  // ✅ Auto recheck every 5 minutes (only when history has entries)
 useEffect(() => {
  if (history.length === 0) return;

  // Run immediately once on load
  console.log("🚀 Initial check started...");
  recheckAllSites();

  // Set interval for every 5 minutes
  const interval = setInterval(() => {
    console.log("⏰ Auto recheck triggered...");
    recheckAllSites();
  }, 5 * 60 * 1000); // 5 minutes

  // Clean up interval on unmount
  return () => clearInterval(interval);
}, [history.length]); // Run when history is first loaded


const recheckAllSites = async () => {
  console.log("🔁 Auto rechecking all websites...");

  for (const item of history) {
    try {
      const response = await axios.post("http://localhost:5000/api/check", { url: item.url });
      const result = response.data;

      const updatedEntry = {
        ...item,
        status: result.status,
        message: result.message,
        code: result.code,
        time: new Date().toLocaleString(),
      };

      // ✅ Update DB (either add or update)
      if (item.id.toString().startsWith("rec-")) {
        await axios.post("http://localhost:5000/api/history", updatedEntry);
      } else {
        await axios.put(`http://localhost:5000/api/history/${item.id}`, updatedEntry);
      }

      // ✅ Update UI state
      setHistory((prev) =>
        prev.map((h) =>
          h.url.toLowerCase() === item.url.toLowerCase() ? updatedEntry : h
        )
      );
    } catch (err) {
      console.error(`❌ Error rechecking ${item.url}:`, err.message);
    }
  }

  console.log("✅ Auto recheck complete at", new Date().toLocaleTimeString());
};




  // ✅ Manual check website
  const checkWebsite = async () => {
    if (!url) return;

    const isValidUrl = (str) => {
      try {
        new URL(str.startsWith("http") ? str : `http://${str}`);
        return true;
      } catch {
        return false;
      }
    };

    if (!isValidUrl(url)) {
      alert("❌ Invalid URL! Please enter a valid website (e.g., https://example.com)");
      return;
    }

    const normalized = normalizeUrl(url);

    // 🚫 Prevent duplicate
    if (history.some((h) => normalizeUrl(h.url) === normalized)) {
      alert("⚠️ This website already exists in history!");
      return;
    }

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
      setHistory((prev) => [...prev, res.data]);
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

  // ✅ Re-check row
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

      let res;
      if (item.id.toString().startsWith("rec-")) {
        res = await axios.post("http://localhost:5000/api/history", updatedEntry);
      } else {
        res = await axios.put(`http://localhost:5000/api/history/${item.id}`, updatedEntry);
      }

      setHistory((prev) =>
        prev.map((h) => (normalizeUrl(h.url) === normalizeUrl(item.url) ? res.data : h))
      );
    } catch (err) {
      console.error("Error checking website:", err);
    }
  };

  // ✅ Delete row
  const deleteRow = async (id) => {
    await axios.delete(`http://localhost:5000/api/history/${id}`);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  // ✅ Import Excel/CSV
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
          const normalized = normalizeUrl(link);

          // 🚫 Skip duplicates
          if (history.some((h) => normalizeUrl(h.url) === normalized)) {
            continue;
          }

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

  // ✅ Filter + Search
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

  // ✅ Export Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredHistory);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "WebsiteHistory");
    XLSX.writeFile(workbook, "Website_History.xlsx");
  };

  // ✅ Export PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Website Status History", 14, 10);

    autoTable(doc, {
      head: [["SNO", "Website URL", "Status", "Message", "HTTP Code", "Checked At"]],
      body: filteredHistory.map((item, index) => [
        index + 1,
        item.url,
        item.status,
        item.message,
        item.code,
        item.time,
      ]),
    });

    doc.save("Website_History.pdf");
  };

  return (
    <div className="checkpage">
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

      {/* Search + Filter */}
      <div className="filter-bar" style={{ margin: "20px 0", display: "flex", gap: "15px" }}>
        <input
          type="text"
          placeholder="Search by URL / Message / Code"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
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
          <option value="Not Checked">Not Checked</option>
        </select>

        <button className="export-btn excel-btn" onClick={exportToExcel}>Export Excel</button>
        <button className="export-btn pdf-btn" onClick={exportToPDF}>Export PDF</button>
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
                        <option value="Not Checked">Not Checked</option>
                      </select>

                      <button className="recheck-btn" onClick={() => checkRowStatus(item)}>
                        Check
                      </button>
                      <button className="delete-btn" onClick={() => deleteRow(item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
