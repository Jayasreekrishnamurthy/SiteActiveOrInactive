import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import "../Style/SslMonitoring.css";

function SslMonitoring() {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // ✅ Deduplicate function
  const deduplicateRecords = (arr) => {
    const map = new Map();
    arr.forEach((rec) => {
      const url = rec.url.startsWith("http") ? rec.url : `https://${rec.url}`;
      if (!map.has(url)) map.set(url, rec);
    });
    return Array.from(map.values());
  };

  // Fetch & sync SSL records with deduplication
  useEffect(() => {
    const fetchAndSync = async () => {
      try {
        const recordsRes = await axios.get("http://localhost:5000/api/records");
        const sslRes = await axios.get("http://localhost:5000/api/ssl-records");

        const sslUrls = new Set(sslRes.data.map((r) => r.url));

        for (let rec of recordsRes.data) {
          let url = rec.url.startsWith("http") ? rec.url : `https://${rec.url}`;
          if (!sslUrls.has(url)) {
            await axios.post("http://localhost:5000/api/add-record", { url });
          }
        }

        const updatedSsl = await axios.get("http://localhost:5000/api/ssl-records");
        const uniqueRecords = deduplicateRecords(updatedSsl.data);

        setRecords(uniqueRecords);
        setFilteredRecords(uniqueRecords);
      } catch (err) {
        console.error("Error fetching SSL records:", err);
        setMessage("❌ Failed to fetch/sync records");
      } finally {
        setPageLoading(false);
      }
    };

    fetchAndSync();
  }, []);

  // Filter records
  useEffect(() => {
    let filtered = [...records];

    if (search.trim()) {
      filtered = filtered.filter((r) =>
        r.url.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(
        (r) => new Date(r.validFrom) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(
        (r) => new Date(r.validTo) <= new Date(dateTo)
      );
    }

    setFilteredRecords(filtered);
  }, [search, dateFrom, dateTo, records]);

  // Recheck SSL
  const checkSSL = async (url) => {
    setLoading((prev) => ({ ...prev, [url]: true }));
    setMessage(`Checking SSL for ${url}...`);

    try {
      const res = await axios.get("http://localhost:5000/api/check-ssl", {
        params: { url },
      });

      const updated = res.data;
      setRecords((prev) =>
        deduplicateRecords(prev.map((r) => (r.url === url ? updated : r)))
      );

      setMessage(`✅ SSL check completed for ${url}`);
    } catch (err) {
      console.error("Recheck failed:", err);
      setMessage(`❌ SSL check failed for ${url}`);
    } finally {
      setLoading((prev) => ({ ...prev, [url]: false }));
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Delete record
  const deleteRecord = async (url) => {
    if (!window.confirm(`Are you sure you want to delete ${url}?`)) return;

    try {
      await axios.delete("http://localhost:5000/api/delete-record", {
        data: { url },
      });

      setRecords((prev) => prev.filter((r) => r.url !== url));
      setMessage(`🗑️ Deleted ${url} successfully`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Delete failed:", err);
      setMessage(`❌ Failed to delete ${url}`);
    }
  };

  // Add manual record
  const addRecord = async () => {
    if (!newUrl.trim()) return;

    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const exists = records.some((r) => r.url === formattedUrl);
    if (exists) setMessage(`⚠️ URL already exists, updating SSL info...`);

    setLoading((prev) => ({ ...prev, [formattedUrl]: true }));
    setNewUrl("");

    try {
      const res = await axios.post("http://localhost:5000/api/add-record", {
        url: formattedUrl,
      });
      const newRecord = res.data;

      setRecords((prev) =>
        deduplicateRecords(
          prev.some((r) => r.url === newRecord.url)
            ? prev.map((r) => (r.url === newRecord.url ? newRecord : r))
            : [newRecord, ...prev]
        )
      );

      await checkSSL(formattedUrl);
    } catch (err) {
      console.error("Add record failed:", err);
      setMessage("❌ Failed to add/check record");
      setLoading((prev) => ({ ...prev, [formattedUrl]: false }));
    }
  };

  if (pageLoading) return <div>⏳ Loading SSL records...</div>;
  if (!records.length) return <div>⚠️ No records found in DB.</div>;

  const getRowClass = (record) => {
    if (!record.valid) return { backgroundColor: "#ffd6d6" };
    const expireDate = new Date(record.validTo);
    const now = new Date();
    const diffDays = (expireDate - now) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return { backgroundColor: "#fff4cc" };
    return {};
  };

  // Export Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SSL Records");
    XLSX.writeFile(workbook, "ssl_records.xlsx");
  };

  // Export PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("SSL Monitoring Records", 14, 10);

    const tableColumn = ["Website", "Issuer", "Valid From", "Valid To", "Valid"];
    const tableRows = [];

    filteredRecords.forEach((rec) => {
      tableRows.push([
        rec.url,
        rec.issuerO || "-",
        rec.validFrom || "-",
        rec.validTo || "-",
        rec.valid ? "Yes" : "No",
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save("ssl_records.pdf");
  };

  // Pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(
    indexOfFirstRecord,
    indexOfLastRecord
  );
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  return (
    <div className="containerssl">
      <h1>SSL Monitoring</h1>
      {message && <div className="message">{message}</div>}

      <div className="top-section">
        <div className="manual-entry">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter website URL"
          />
          <button className="add-btn" onClick={addRecord}>
            Add & Check
          </button>
          <button onClick={exportToExcel} className="exportssl-btn">
            Export Excel
          </button>
          <button onClick={exportToPDF} className="exportssl-btn">
            Export PDF
          </button>
        </div>

        <div className="filters">
          <input
            type="text"
            placeholder="Search website..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <button
            className="ticketssl-btn"
            onClick={() => navigate("/dashboard/ticketraise")}
          >
            Ticket Raise
          </button>
        </div>
      </div>

      <table className="ssl-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Website</th>
            <th>Common Name</th>
            <th>Issuer</th>
            <th>Valid From</th>
            <th>Valid To</th>
            <th>Currently Valid</th>
            <th>Last Checked</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {currentRecords.map((rec, index) => (
            <tr key={rec.id} style={getRowClass(rec)}>
              <td>{indexOfFirstRecord + index + 1}</td>
              <td>{rec.url}</td>
              <td>{rec.subjectCN || "-"}</td>
              <td>{rec.issuerO || "-"}</td>
              <td>{rec.validFrom || "-"}</td>
              <td>{rec.validTo || "-"}</td>
              <td>{rec.valid ? "✅ Yes" : "❌ No"}</td>
              <td>
                {rec.updated_at
                  ? new Date(rec.updated_at).toLocaleString()
                  : "-"}
              </td>
              <td>
                <button
                  className="recheck-btn"
                  onClick={() => checkSSL(rec.url)}
                  disabled={loading[rec.url]}
                >
                  {loading[rec.url] ? "Checking..." : "Recheck"}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => deleteRecord(rec.url)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
        >
          Prev
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() =>
            setCurrentPage((p) => Math.min(p + 1, totalPages))
          }
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default SslMonitoring;
