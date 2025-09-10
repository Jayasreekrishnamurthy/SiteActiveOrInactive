import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Components/Dashboard/HomeDasboard.jsx";
import CheckStatus from "./Components/Dashboard/CheackStatus.jsx";
import Home from "./Components/Dashboard/HomePage.jsx";
import Login from "./Components/Auth/Login.jsx";
import Register from "./Components/Auth/Register.jsx";
import Ticket from "./Components/TicketRaise/TicketRaise.jsx"
import DataComponent from "./Components/Dashboard/Formcomponent.jsx";

const History = () => <h2>History Page (future data)</h2>;
const Settings = () => <h2>Settings Page</h2>;
const Profile =() => <h2>PROFILE</h2>
// const DataComponent = () => <h2>Data Component Page</h2>;

// 🔹 Auth wrapper
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="check-status" element={<CheckStatus />} />
          <Route path="ticketraise" element={<Ticket />} />
          <Route path="history" element={<History />} />
          <Route path="datacomponent" element={<DataComponent />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
