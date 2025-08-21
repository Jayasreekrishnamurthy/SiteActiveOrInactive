import React, { useEffect, useState } from "react";
import axios from "axios";
import "../Style/HomePage.css";

const Home = () => {
  const [history, setHistory] = useState([]);

  // Fetch history from backend
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/history")
      .then((res) => setHistory(res.data))
      .catch((err) => console.error("Error fetching history:", err));
  }, []);

  // Counts
  const totalCount = history.length;
  const activeCount = history.filter((item) => item.status === "active").length;
  const inactiveCount = history.filter((item) => item.status === "inactive").length;

  // Unique server count (domain-based)
  const serverCount = new Set(
    history.map((item) => {
      try {
        return new URL(item.url).hostname;
      } catch {
        return null;
      }
    })
  ).size;

  return (
    <div className="home-dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-cards">
        <div className="card total">
          <h3>Total Websites</h3>
          <p>{totalCount}</p>
        </div>
        <div className="card active">
          <h3>Active</h3>
          <p>{activeCount}</p>
        </div>
        <div className="card inactive">
          <h3>Inactive</h3>
          <p>{inactiveCount}</p>
        </div>
        <div className="card server">
          <h3>Unique Servers</h3>
          <p>{serverCount}</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
