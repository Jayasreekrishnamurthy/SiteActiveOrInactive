import React, { useState, useEffect } from "react";
import axios from "axios";
import "../Style/SslMonitoring.css"

const CertCheck = () => {
  const [url, setUrl] = useState("");
  const [mail, setMail] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");


  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Checkbox selection
  const [selected, setSelected] = useState([]);

  // 🔹 Fetch and sync certs
  const fetchCerts = async () => {
    try {
      const certRes = await axios.get("http://localhost:5000/certs");
      let certs = Array.isArray(certRes.data) ? certRes.data : [];

      const recordRes = await axios.get("http://localhost:5000/api/records");
      const recordUrls = recordRes.data.map((rec) => rec.url);

      for (const url of recordUrls) {
        const exists = certs.some((c) => c.url === url);
        if (!exists) {
          try {
            await axios.post("http://localhost:5000/check-cert", { url });
          } catch (err) {
            console.error("Error syncing URL:", url, err.message);
          }
        }
      }

      const updatedCerts = await axios.get("http://localhost:5000/certs");
      setRows(updatedCerts.data);
    } catch (err) {
      console.error(err);
      setRows([]);
    }
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  // 🔹 Auto re-check every 18 hrs
  useEffect(() => {
    const interval = setInterval(() => {
      rows.forEach((row) => {
        if (row.id) recheckCert(row.id);
      });
    }, 18 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [rows]);

  const addCert = async () => {
    if (!url.trim()) {
      alert("Please enter website URL");
      return;
    }
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/check-cert", { url, mail });
      setUrl("");
      setMail("");
      fetchCerts();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error adding site");
    }
    setLoading(false);
  };

  const deleteCert = async (id) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await axios.delete(`http://localhost:5000/certs/${id}`);
      fetchCerts();
    } catch (err) {
      console.error(err);
    }
  };

  const recheckCert = async (id) => {
    try {
      await axios.put(`http://localhost:5000/certs/${id}/recheck`);
      fetchCerts();
    } catch (err) {
      console.error(err);
    }
  };

  const editCert = async (id) => {
    const newMail = prompt("Enter new email:");
    if (!newMail) return;
    try {
      await axios.put(`http://localhost:5000/certs/${id}`, { mail: newMail });
      fetchCerts();
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  // 🔹 Search filter
  const filteredRows = rows.filter(
    (row) =>
      row.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.mail && row.mail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 🔹 Pagination logic (after filtering)
  const lastIndex = currentPage * recordsPerPage;
  const firstIndex = lastIndex - recordsPerPage;
  const currentRecords = filteredRows.slice(firstIndex, lastIndex);
  const totalPages = Math.ceil(filteredRows.length / recordsPerPage);


  // 🔹 Checkbox logic
  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === currentRecords.length) {
      setSelected([]); // unselect all
    } else {
      setSelected(currentRecords.map((row) => row.id));
    }
  };

  return (
    <div style={{ padding: "20px", background: "#fff"}}>
      <h2 className="tlscertificate">TLS Certificate Monitor</h2>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter website URL"
          style={{ width: "40%", padding: "5px", marginRight: "10px" }}
        />
        <input
          type="email"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          placeholder="Optional email for alert"
          style={{ width: "25%", padding: "5px", marginRight: "10px" }}
        />
        <button onClick={addCert} disabled={loading}>
          {loading ? "Adding..." : "Add / Check"}
        </button>

        {/* 🔹 Search Box */}
        <div className="searchtls-container">
          <input
            type="text"
            className="searchtls-input"
            placeholder="🔍 Search by URL or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

      </div>
      {/* 🔹 Bulk Actions */}
      {selected.length > 0 && (
        <div className="bulk-delete-btn">
          <button
            style={{ backgroundColor: "red", color: "white", padding: "6px 12px", borderRadius: "5px" }}
            onClick={async () => {
              if (!window.confirm(`Delete ${selected.length} selected record(s)?`)) return;
              try {
                await Promise.all(selected.map((id) => axios.delete(`http://localhost:5000/certs/${id}`)));
                setSelected([]); // clear selection
                fetchCerts();    // refresh table
              } catch (err) {
                console.error(err);
                alert("Error deleting selected records");
              }
            }}
          >
            🗑️ Delete Selected ({selected.length})
          </button>
        </div>
      )}


      {rows.length > 0 ? (
        <>
          <table className="tlscertificatetable" border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selected.length === currentRecords.length && currentRecords.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th></th>
                <th>Website</th>
                <th>Email</th>
                <th>Subject CN</th>
                <th>Issuer CN</th>
                <th>Valid Until</th>
                <th>Days Left</th>
                <th>Status</th>
                <th>Last Checked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                  </td>
                  <td>{firstIndex + idx + 1}</td>
                  <td>{row.url}</td>
                  <td>{row.mail || "-"}</td>
                  <td>{row.subjectCN || "-"}</td>
                  <td>{row.issuerCN || "-"}</td>
                  <td>{row.validTo ? new Date(row.validTo).toLocaleString() : "-"}</td>
                  <td>{row.daysLeft ?? "-"}</td>
                  <td style={{ color: row.status === "OK" ? "green" : row.status === "Expired" ? "red" : "orange" }}>
                    {row.status}
                  </td>
                  <td>{row.checkedAt ? new Date(row.checkedAt).toLocaleString() : "-"}</td>
                  <td>
                    <button onClick={() => recheckCert(row.id)} style={{ marginRight: "8px" }}>
                      🔄 Re-check
                    </button>
                    <button onClick={() => editCert(row.id)} style={{ color: "white", marginRight: "8px" }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteCert(row.id)} style={{ color: "white" }}>
                      ❌ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 🔹 Pagination Controls */}
          <div className="pagination-containertls" >
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ⬅ Prev
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next ➡
            </button>
          </div>

        </>
      ) : (
        <p>No records found.</p>
      )}
    </div>
  );
};

export default CertCheck;
