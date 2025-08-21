import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./Components/Dashboard/HomeDasboard.jsx";
import CheckStatus from "./Components/Dashboard/CheackStatus.jsx";
import Home from "./Components/Dashboard/HomePage.jsx"

// const Home = () => <h2>Welcome to Home Page</h2>;
const History = () => <h2>History Page (future data)</h2>;
const Settings = () => <h2>Settings Page</h2>;

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<Home />} />
          <Route path="check-status" element={<CheckStatus />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
