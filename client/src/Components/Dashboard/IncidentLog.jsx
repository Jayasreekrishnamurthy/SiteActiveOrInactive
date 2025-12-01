import React, { useEffect, useState } from "react";
import axios from "axios";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../Style/IncidentLog.css";


const formatIndianTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
    });
};


const IncidentLog = () => {
    const [logs, setLogs] = useState([]);
    const [backupLogs, setBackupLogs] = useState([]);
    const [showBackup, setShowBackup] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;


    useEffect(() => {
        const fetchIncidentLogs = async () => {
            try {
                const res = await axios.get("http://localhost:5000/api/incident-log");
                const sorted = res.data.sort(
                    (a, b) => new Date(b.time) - new Date(a.time)
                );
                setLogs(sorted);
            } catch (err) {
                console.error("Error loading incident logs:", err);
            }
        };

        fetchIncidentLogs();
        const interval = setInterval(fetchIncidentLogs, 5000);
        return () => clearInterval(interval);
    }, []);


    const loadBackupLogs = async () => {
        try {
            const res = await axios.get("http://localhost:5000/api/incident-log/backup");
            setBackupLogs(res.data);
            setShowBackup(true);
        } catch (err) {
            console.error("Error loading backup logs:", err);
        }
    };

    const filteredLogs = (showBackup ? backupLogs : logs).filter((item) => {
        const logDate = new Date(item.time);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dateMatch = true;

        if (dateFilter === "today") {
            const itemDate = new Date(item.time);
            itemDate.setHours(0, 0, 0, 0);
            dateMatch = itemDate.getTime() === today.getTime();
        }

        if (dateFilter === "yesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const itemDate = new Date(item.time);
            itemDate.setHours(0, 0, 0, 0);
            dateMatch = itemDate.getTime() === yesterday.getTime();
        }

        if (dateFilter === "last7") {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            dateMatch = logDate >= sevenDaysAgo && logDate <= today;
        }

        if (dateFilter === "custom" && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59);
            dateMatch = logDate >= start && logDate <= end;
        }

        const matchesSearch =
            item.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code.toString().includes(searchTerm);

        const matchesStatus =
            statusFilter === "all" ? true : item.status === statusFilter;

        return matchesSearch && matchesStatus && dateMatch;
    });

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredLogs.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);


    const exportToExcel = () => {
        const excelData = filteredLogs.map(item => ({
            ...item,
            time: formatIndianTime(item.time),
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Incident Logs");
        XLSX.writeFile(workbook, "Incident_Logs.xlsx");
    };


    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Incident Log Report", 14, 10);

        autoTable(doc, {
            head: [["SNO", "URL", "Status", "Message", "Code", "Time"]],
            body: filteredLogs.map((item, index) => [
                index + 1,
                item.url,
                item.status,
                item.message,
                item.code,
                formatIndianTime(item.time),
            ]),
        });

        doc.save("Incident_Logs.pdf");
    };

    return (
        <div className="incident-log-page">
            <h2 className="incidentheading">Incident Log</h2>

            {/* Search + Filter + Export */}
            <div className="filter-bar"
                style={{
                    margin: "20px 0",
                    display: "flex",
                    gap: "15px",
                    flexWrap: "wrap",
                }}
            >
                <input
                    type="text"
                    placeholder="Search by URL / Code / Message"
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
                </select>

                <select
                    value={dateFilter}
                    onChange={(e) => {
                        setDateFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7">Last 7 Days</option>
                    <option value="custom">Custom Range</option>
                </select>

                {dateFilter === "custom" && (
                    <>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </>
                )}


                <button onClick={exportToExcel}>Export Excel</button>
                <button onClick={exportToPDF}>Export PDF</button>

                {/* LOAD BACKUP LOGS */}
                <button onClick={loadBackupLogs}>Load Backup Logs</button>

                {/* SWITCH BACK */}
                {showBackup && (
                    <button
                        style={{ backgroundColor: "#444" }}
                        onClick={() => setShowBackup(false)}
                    >
                        Back to Live Logs
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="incident-table">
                {filteredLogs.length === 0 ? (
                    <p>No incident logs found.</p>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr>
                                    <th>SNO</th>
                                    <th>URL</th>
                                    <th>Status</th>
                                    <th>Message</th>
                                    <th>Code</th>
                                    <th>Time</th>
                                </tr>
                            </thead>

                            <tbody>
                                {currentRows.map((item, index) => (
                                    <tr key={item.id}>
                                        <td>{indexOfFirstRow + index + 1}</td>
                                        <td>{item.url}</td>

                                        {/* Status Color */}
                                        <td
                                            className={
                                                item.status === "active"
                                                    ? "status-active"
                                                    : "status-inactive"
                                            }
                                        >
                                            {item.status}
                                        </td>

                                        <td>{item.message}</td>
                                        <td>{item.code}</td>
                                        <td>{formatIndianTime(item.time)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="pagination-area" style={{ marginTop: "20px" }}>
                            <Stack spacing={2} alignItems="center">
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

export default IncidentLog;
