import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "../Style/FormComponent.css";

const RecordForm = () => {
    const [formData, setFormData] = useState({
        url: "",
        public_ip: "",
        private_ip: "",
        contact: "",
        department: "",
    });

    const [records, setRecords] = useState([]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    
    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            const res = await axios.get("http://localhost:5000/api/records");
            setRecords(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAdd = () => {
        setFormData({ url: "", public_ip: "", private_ip: "", contact: "", department: "" });
        setEditingId(null);
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setFormData({
            url: record.url,
            public_ip: record.public_ip,
            private_ip: record.private_ip,
            contact: record.contact,
            department: record.department,
        });
        setEditingId(record.id);
        setIsModalOpen(true);
    };

    const normalizeUrl = (url) => {
        return url.trim()
            .replace(/^(https?:\/\/)?(www\.)?/, "")
            .replace(/\/$/, "")
            .toLowerCase();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("Submitting...");
        setError(false);

        const normalizedUrl = normalizeUrl(formData.url);

        try {
            if (editingId) {
                const res = await axios.put(`http://localhost:5000/api/records/${editingId}`, {
                    ...formData,
                    url: normalizedUrl,
                });
                setRecords(records.map((rec) => (rec.id === editingId ? res.data.record : rec)));
                setMessage("✅ Record updated successfully!");
            } else {
                const res = await axios.post("http://localhost:5000/api/records", {
                    ...formData,
                    url: normalizedUrl,
                });
                setRecords([...records, res.data.record]);
                setMessage(res.data.message);
            }

            setFormData({ url: "", public_ip: "", private_ip: "", contact: "", department: "" });
            setEditingId(null);
            setIsModalOpen(false);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "❌ Error saving record";
            setMessage(errorMsg);
            setError(true);
        }

        setTimeout(() => {
            setMessage("");
            setError(false);
        }, 3000);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;

        try {
            await axios.delete(`http://localhost:5000/api/records/${id}`);
            setRecords(records.filter((rec) => rec.id !== id));
            setMessage("✅ Record deleted successfully!");
            setError(false);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "❌ Failed to delete record";
            setMessage(errorMsg);
            setError(true);
        }

        setTimeout(() => {
            setMessage("");
            setError(false);
        }, 3000);
    };

    // Excel Upload
   const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        try {
            // Normalize Excel data
            const newRecords = jsonData.map((row) => ({
                url: normalizeUrl(row.URL || ""),
                public_ip: row.PublicIP || "",
                private_ip: row.PrivateIP || "",
                contact: row.Contact || "",
                department: row.Department || "",
            }));

            // Filter out duplicates by checking URL (you can also check combination of fields)
            const existingUrls = records.map((rec) => rec.url);
            const uniqueRecords = newRecords.filter(
                (rec) => !existingUrls.includes(rec.url)
            );

            if (uniqueRecords.length === 0) {
                setMessage("⚠️ All Excel records already exist in DB!");
                setError(false);
                setTimeout(() => setMessage(""), 3000);
                return;
            }

            // Save only unique records
            const savedRecords = [];
            for (const record of uniqueRecords) {
                const res = await axios.post("http://localhost:5000/api/records", record);
                savedRecords.push(res.data.record);
            }

            // Update UI
            setRecords((prevRecords) => [...prevRecords, ...savedRecords]);
            setMessage("✅ Excel data uploaded (duplicates skipped)!");
            setError(false);

            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            console.error(err);
            setMessage("❌ Failed to save Excel data to DB");
            setError(true);
            setTimeout(() => {
                setMessage("");
                setError(false);
            }, 3000);
        }
    };

    reader.readAsArrayBuffer(file);
};

    // Pagination logic
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
    const totalPages = Math.ceil(records.length / recordsPerPage);

    return (
        <div className="record-form-wrapper">
            <h2 className="record-form-header">Records</h2>
            <div style={{ marginBottom: "10px" }}>
                <button className="record-form-add-btn" onClick={handleAdd}>Add Record</button>
                <label className="record-form-excel-btn">
                    Upload Excel
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleExcelUpload}
                        style={{ display: "none" }}
                    />
                </label>
            </div>

            {isModalOpen && (
                <div className="record-form-modal">
                    <div className="record-form-modal-content">
                        <span className="record-form-modal-close" onClick={() => setIsModalOpen(false)}>&times;</span>
                        <h2 className="record-form-title">{editingId ? "Update Record" : "Add Record"}</h2>
                        <form className="record-form" onSubmit={handleSubmit}>
                            <input className="record-form-input" type="text" name="url" placeholder="URL" value={formData.url} onChange={handleChange} required />
                            <input className="record-form-input" type="text" name="public_ip" placeholder="Public IP" value={formData.public_ip} onChange={handleChange} />
                            <input className="record-form-input" type="text" name="private_ip" placeholder="Private IP" value={formData.private_ip} onChange={handleChange} />
                            <input className="record-form-input" type="text" name="contact" placeholder="Contact" value={formData.contact} onChange={handleChange} />
                            <input className="record-form-input" type="text" name="department" placeholder="Department" value={formData.department} onChange={handleChange} />
                            <button className="record-form-submit-btn" type="submit">{editingId ? "Update" : "Submit"}</button>
                        </form>
                    </div>
                </div>
            )}

            {message && (
                <p className={`record-form-message ${error ? "error" : "success"}`}>{message}</p>
            )}

            <table className="record-table">
                <thead>
                    <tr>
                        <th>S.No</th> 
                        <th>URL</th>
                        <th>Public IP</th>
                        <th>Private IP</th>
                        <th>Contact</th>
                        <th>Department</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {currentRecords.map((rec, index) => (
                        <tr key={rec.id}>
                            <td>{indexOfFirstRecord + index + 1}</td>
                            <td>{rec.url}</td>
                            <td>{rec.public_ip}</td>
                            <td>{rec.private_ip}</td>
                            <td>{rec.contact}</td>
                            <td>{rec.department}</td>
                            <td>
                                <button className="record-table-update-btn" onClick={() => handleEdit(rec)}>Update</button>
                                <button className="record-table-delete-btn" onClick={() => handleDelete(rec.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination">
                <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    ◀ Prev
                </button>
                <span> Page {currentPage} of {totalPages} </span>
                <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                >
                    Next ▶
                </button>
            </div>
        </div>
    );
};

export default RecordForm;
