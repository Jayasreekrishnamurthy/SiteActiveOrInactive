import React, { useEffect, useState } from "react";
import axios from "axios";
import GaugeChart from "react-gauge-chart";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { Activity, Server, CheckCircle, XCircle } from "lucide-react";
import "../Style/HomePage.css";

const Home = () => {
  const [history, setHistory] = useState([]);

  // 🔄 Poll API every 5s
  useEffect(() => {
    const fetchData = () => {
      axios
        .get("http://localhost:5000/api/history")
        .then((res) => setHistory(res.data))
        .catch((err) => console.error("Error fetching history:", err));
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalCount = history.length;
  const activeCount = history.filter((item) => item.status === "active").length;
  const inactiveCount = history.filter((item) => item.status === "inactive").length;
  const serverCount = new Set(
    history.map((item) => {
      try {
        return new URL(item.url).hostname;
      } catch {
        return null;
      }
    })
  ).size;

  // Percentage values for gauges
  const activePercent = totalCount ? (activeCount / totalCount) * 100 : 0;
  const inactivePercent = totalCount ? (inactiveCount / totalCount) * 100 : 0;
  const serverPercent = totalCount ? (serverCount / totalCount) * 100 : 0;

  // Dashboard cards
  // const cards = [
  //   { title: "Total Websites", value: `${totalCount}`, icon: <Activity size={22} />, color: "purple" },
  //   { title: "Active", value: `${activeCount}`, icon: <CheckCircle size={22} />, color: "green" },
  //   { title: "Inactive", value: `${inactiveCount}`, icon: <XCircle size={22} />, color: "red" },
  //   { title: "Unique Servers", value: `${serverCount}`, icon: <Server size={22} />, color: "blue" },
  // ];

  // --- TIME BASED ACTIVE/INACTIVE DATA WITH SITE NAMES ---
  const timeGrouped = history.reduce((acc, item) => {
    if (!acc[item.time]) {
      acc[item.time] = { time: item.time, active: 0, inactive: 0, sites: [] };
    }
    if (item.status === "active") acc[item.time].active += 1;
    if (item.status === "inactive") acc[item.time].inactive += 1;

    acc[item.time].sites.push({ url: item.url, status: item.status });
    return acc;
  }, {});

  const timeData = Object.values(timeGrouped).sort(
    (a, b) => new Date(`1970-01-01T${a.time}`) - new Date(`1970-01-01T${b.time}`)
  );

  // --- HTTP ERROR PIE CHART DATA ---
  const httpCodeCounts = history.reduce((acc, item) => {
    if (item.code) acc[item.code] = (acc[item.code] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.keys(httpCodeCounts).map((code) => ({
    name: `HTTP Error ${code}`,
    value: httpCodeCounts[code],
    code,
  }));
  const COLORS = ["#f97316", "#eab308", "#22c55e", "#6366f1", "#14b8a6", "#ef4444"];


  return (
    <div className="home-dashboard">
      <h1 className="dashboard-title">Dashboard</h1>
      {/* <div className="dashboard-cards">
        {cards.map((card, idx) => (
          <div key={idx} className={`stat-card ${card.color}`}>
            <div className="icon-box">{card.icon}</div>
            <h2>{card.value}</h2>
            <p>{card.title}</p>
            <div className="wave"></div>
          </div>
        ))}
      </div> */}

      {/* GAUGE SECTION */}
      <div className="gauge-section">
        <div className="gauge-card">
          <h3>Total Websites</h3>
          <GaugeChart
            id="total-gauge"
            nrOfLevels={10}
            colors={["#FF5F6D", "#FFC371", "#00C49F"]}
            arcWidth={0.3}
            percent={totalCount ? 1 : 0}
            textColor="#29ABE2"
            needleColor="#6366f1"
          />
          <p className="gauge-value">{totalCount}</p>
        </div>

        {/* Active Sites */}
        <div className="gauge-card">
          <h3>Active</h3>
          <GaugeChart
            id="active-gauge"
            nrOfLevels={10}
            colors={["#ef4444", "#facc15", "#22c55e"]}
            arcWidth={0.3}
            percent={activePercent / 100}
            textColor="#29ABE2"
            needleColor="#22c55e"
          />
          <p className="gauge-value">
            {activeCount} Active ({activePercent.toFixed(1)}%)
          </p>
        </div>

        <div className="gauge-card">
          <h3>Inactive</h3>
          <GaugeChart
            id="inactive-gauge"
            nrOfLevels={10}
            colors={["#22c55e", "#FFC371", "#ef4444"]}
            arcWidth={0.3}
            percent={inactivePercent / 100}
            textColor="#29ABE2"
            needleColor="#ef4444"
          />
          <p className="gauge-value">
            {inactiveCount} Inactive ({inactivePercent.toFixed(1)}%)
          </p>
        </div>

        <div className="gauge-card">
          <h3>Unique Servers</h3>
          <GaugeChart
            id="server-gauge"
            nrOfLevels={10}
            colors={["#FF5F6D", "#FFC371", "#00C49F"]}
            arcWidth={0.3}
            percent={serverPercent / 100}
            textColor="#29ABE2"
            needleColor="#3b82f6"
          />
          <p className="gauge-value">{serverCount}</p>
        </div>
      </div>

      {/* 🟢🔴🟡 WEBSITE STATUS GRID */}

      <div className="status-card">
        <div className="status-header">
          <span className="status-count">Total: {history.length}</span>
        </div>

        <div className="status-hex-grid">
          {history.map((item, idx) => (
            <div key={idx} className="hex-wrapper">
              <div className={`hex ${item.status}`}></div>
              <span className="tooltip-text">{item.url}</span>
            </div>
          ))}
        </div>
      </div>



      <div className="charts-container" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        {/* ⏱️ Live Active/Inactive Chart */}
        <div className="time-chart-card">
          <h2 className="chart-title">Website Status (Live)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={timeData.slice(-20)}> {/* show last 20 points */}
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: "#29ABE2" }} // ✅ white date/time labels
                interval="preserveStartEnd"
                stroke="#ffffff33"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#29ABE2" }} // ✅ white Y-axis numbers
                stroke="#ffffff33"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const details = timeGrouped[label]?.sites || [];
                    return (
                      <div className="custom-tooltip">
                        <p><b>Time:</b> {label}</p>
                        <p className="active-text">Active: {payload[0].value}</p>
                        <p className="inactive-text">Inactive: {payload[1]?.value || 0}</p>
                        <hr />
                        <p><b>Sites:</b></p>
                        <ul>
                          {details.map((site, idx) => (
                            <li key={idx}>{site.url} ({site.status})</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ color: "#ffffff" }} // ✅ white legend text
              />
              <Line
                type="monotone"
                dataKey="active"
                stroke="#22c55e"
                name="Active"
                strokeWidth={3}
                dot={false}
                isAnimationActive={true}
                animationDuration={1000}
                fillOpacity={0.3}
              />
              <Line
                type="monotone"
                dataKey="inactive"
                stroke="#ef4444"
                name="Inactive"
                strokeWidth={3}
                dot={false}
                isAnimationActive={true}
                animationDuration={1000}
                fillOpacity={0.3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>


        {/* 🟢 HTTP Error Chart */}
        <div className="http-chart">
          <h2>Active Instances</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                label
                isAnimationActive={true}
                animationDuration={1200}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>



    </div>
  );
};

export default Home;
