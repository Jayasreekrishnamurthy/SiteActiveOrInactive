import React from "react";
import { Link, Outlet } from "react-router-dom";
import "../Style/Dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Dashboard</h2>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/check-status">Check Status</Link>
          <Link to="/history">History</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Header */}
        <header className="header">
          <h1>Website Status Checker</h1>
          <button className="logout-btn">Logout</button>
        </header>

        {/* Page Content (dynamic via routes) */}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
