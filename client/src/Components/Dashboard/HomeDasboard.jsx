import React, { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faGlobe,
  faPaperPlane,
  faHistory,
  faGear,
  faBars,
  faSignOutAlt,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import "../Style/Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

   // ✅ Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize(); // Run on mount
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/"); // go back to login
  };

  const menuItems = [
    { path: ".", label: "Home", icon: faHome },
    { path: "check-status", label: "Check Status", icon: faGlobe },
    { path: "ticketraise", label: "Ticket Raised", icon: faPaperPlane },
    { path: "datacomponent", label: "Data Component", icon: faHistory },
    { path: "history", label: "History", icon: faHistory },
    { path: "settings", label: "Settings", icon: faGear },
    { path: "profile", label: "Profile", icon: faUser },
  ];

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
  {/* Logo (always clickable to toggle) */}
  <div className="logo" onClick={() => setIsCollapsed(!isCollapsed)}>
    {isCollapsed ? "D" : "Dashboard"}
  </div>

  {/* Collapse/Expand button → show ONLY when expanded */}
  {!isCollapsed && (
    <button
      className="collapse-btn"
      onClick={() => setIsCollapsed(!isCollapsed)}
    >
      <FontAwesomeIcon icon={faBars} />
    </button>
  )}
</div>


        <nav>
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              to={item.path}
              className={`nav-link ${
                location.pathname === "/" + item.path ? "active" : ""
              }`}
              title={isCollapsed ? item.label : ""}
            >
              <FontAwesomeIcon icon={item.icon} className="sidebar-icon" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-link logout-btn"
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : ""}
          >
            <FontAwesomeIcon icon={faSignOutAlt} className="sidebar-icon" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="header">
          <h1>Website Status Checker</h1>
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
