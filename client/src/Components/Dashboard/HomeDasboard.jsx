import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faGlobe, faPaperPlane, faHistory, faGear } from "@fortawesome/free-solid-svg-icons";
import "../Style/Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/"); // go back to login
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Dashboard</h2>
        <nav>
          <Link to="."><FontAwesomeIcon icon={faHome} className="sidebar-icon" /> Home</Link>
          <Link to="check-status"><FontAwesomeIcon icon={faGlobe} className="sidebar-icon" /> Check Status</Link>
          <Link to="ticketraise"><FontAwesomeIcon icon={faPaperPlane} className="sidebar-icon" /> Ticket Raised</Link>
          <Link to="history"><FontAwesomeIcon icon={faHistory} className="sidebar-icon history" /> History</Link>
          <Link to="settings"><FontAwesomeIcon icon={faGear} className="sidebar-icon settings" /> Settings</Link>
        </nav>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="header">
          <h1>Website Status Checker</h1>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </header>

        {/* Child routes render here */}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
