
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

const MAX_HISTORY = 20;           
const POLL_INTERVAL_MS = 3000;   

const Dashboard = () => {
  const [systems, setSystems] = useState([]);

  // histories
  const [labels, setLabels] = useState([]);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [ramHistory, setRamHistory] = useState([]);
  const [diskHistory, setDiskHistory] = useState([]);

  const [dark, setDark] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // thresholds (internal ops defaults)
  const thresholds = useMemo(
    () => ({
      cpuWarn: 70,
      cpuCritical: 85,
      ramWarn: 70,
      ramCritical: 90,
      diskWarn: 80,
      diskCritical: 95,
    }),
    []
  );

  // load function (polls API)
  const load = async () => {
    try {
      const res = await axios.get("http://localhost:5000/infraall");
      const data = Array.isArray(res.data) ? res.data : [];
      setSystems(data);

      // compute averages
      const avg = (key) =>
        data.length ? data.reduce((a, b) => a + (b[key] || 0), 0) / data.length : 0;

      const avgCPU = Number(avg("cpu_usage").toFixed(2));
      const avgRAM = Number(avg("ram_usage").toFixed(2));
      const avgDisk = Number(avg("disk_usage").toFixed(2));

      const timestamp = new Date().toLocaleTimeString();

      setLabels((p) => [...p.slice(-MAX_HISTORY + 1), timestamp]);
      setCpuHistory((p) => [...p.slice(-MAX_HISTORY + 1), avgCPU]);
      setRamHistory((p) => [...p.slice(-MAX_HISTORY + 1), avgRAM]);
      setDiskHistory((p) => [...p.slice(-MAX_HISTORY + 1), avgDisk]);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch /infraall:", err);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  // summary KPIs (most recent)
  const total = systems.length;
  const online = systems.filter((s) => s.agent_status === "Online").length;
  const offline = total - online;
  const latestCPU = cpuHistory.length ? cpuHistory[cpuHistory.length - 1] : 0;
  const latestRAM = ramHistory.length ? ramHistory[ramHistory.length - 1] : 0;
  const latestDisk = diskHistory.length ? diskHistory[diskHistory.length - 1] : 0;

  // Alert generation
  const alerts = [];
  if (latestCPU >= thresholds.cpuCritical)
    alerts.push({ level: "critical", text: `CPU critical (${latestCPU}%)` });
  else if (latestCPU >= thresholds.cpuWarn)
    alerts.push({ level: "warn", text: `CPU high (${latestCPU}%)` });

  if (latestRAM >= thresholds.ramCritical)
    alerts.push({ level: "critical", text: `RAM critical (${latestRAM}%)` });
  else if (latestRAM >= thresholds.ramWarn)
    alerts.push({ level: "warn", text: `RAM high (${latestRAM}%)` });

  if (latestDisk >= thresholds.diskCritical)
    alerts.push({ level: "critical", text: `Disk critical (${latestDisk}%)` });
  else if (latestDisk >= thresholds.diskWarn)
    alerts.push({ level: "warn", text: `Disk high (${latestDisk}%)` });

  // small util: color by level
  const levelColor = (level) =>
    level === "critical" ? "#ff5c7c" : level === "warn" ? "#ffb86b" : "#14c38e";

  // chart common options (clean, minimal)
  const chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    elements: { point: { radius: 0 } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
  };

  // Sparkline component (mini inline chart used inside KPI)
  const Sparkline = ({ data }) => (
    <div style={{ height: 40, width: "100%" }}>
      <Line
        data={{
          labels: Array.from({ length: data.length }),
          datasets: [
            {
              data: data,
              borderWidth: 1.5,
              tension: 0.3,
              fill: false,
            },
          ],
        }}
        options={{
          ...chartOptions,
          elements: { point: { radius: 0 } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  );

  // styles
  const theme = {
    background: dark ? "#0b1220" : "#f6f8fb",
    card: dark ? "#0f1724" : "#fff",
    muted: dark ? "#9aa4b2" : "#6b7280",
    text: dark ? "#e6eef8" : "#0b1220",
    accent: "#4E9FEE",
    success: "#14c38e",
    warn: "#ffb86b",
    danger: "#ff5c7c",
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.background, color: theme.text, fontFamily: "Inter,Segoe UI,Arial", padding: 18 }}>
      {/* Topbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", marginBottom: 18, background: dark ? "#071022" : "#fff",
        borderRadius: 10, boxShadow: dark ? "0 6px 20px rgba(3,8,18,0.6)" : "0 4px 12px rgba(16,24,40,0.04)"
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* <div style={{ fontWeight: 700, fontSize: 18 }}>🔎 Internal Monitoring</div> */}
          <div style={{ color: theme.muted, fontSize: 13 }}>{total} systems • {online} online • {offline} offline</div>
          {lastUpdated && <div style={{ color: theme.muted, fontSize: 13 }}>• updated {lastUpdated.toLocaleTimeString()}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* <button onClick={load} style={topButtonStyle(theme)}>Refresh</button> */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={dark} onChange={() => setDark(d => !d)} />
            <span style={{ color: theme.muted, fontSize: 13 }}>Dark</span>
          </label>
        </div>
      </div>

      {/* Alerts strip */}
      <div style={{ marginBottom: 16 }}>
        {alerts.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {alerts.map((a, i) => (
              <div key={i} style={{
                background: a.level === "critical" ? "#3a0f12" : "#3a2b0f",
                color: "#fff", padding: "8px 12px", borderRadius: 8, fontWeight: 600,
                borderLeft: `4px solid ${levelColor(a.level)}`
              }}>
                {a.text}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: theme.muted, fontSize: 13 }}>No active alerts</div>
        )}
      </div>

      {/* KPI grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}>
        <KPI
          title="Total Systems"
          value={total}
          subtitle={`${online} online • ${offline} offline`}
          color={theme.accent}
          extra={<div style={{ height: 40 }} />}
          cardColor={theme.card}
        />

        <KPI
          title="Avg CPU"
          value={`${latestCPU.toFixed(1)}%`}
          subtitle={latestCPU >= thresholds.cpuCritical ? "Critical" :
            latestCPU >= thresholds.cpuWarn ? "High" : "Normal"}
          color={latestCPU >= thresholds.cpuCritical ? theme.danger : latestCPU >= thresholds.cpuWarn ? theme.warn : theme.success}
          extra={<Sparkline data={cpuHistory} />}
          cardColor={theme.card}
        />

        <KPI
          title="Avg RAM"
          value={`${latestRAM.toFixed(1)}%`}
          subtitle={latestRAM >= thresholds.ramCritical ? "Critical" :
            latestRAM >= thresholds.ramWarn ? "High" : "Normal"}
          color={latestRAM >= thresholds.ramCritical ? theme.danger : latestRAM >= thresholds.ramWarn ? theme.warn : theme.success}
          extra={<Sparkline data={ramHistory} />}
          cardColor={theme.card}
        />

        <KPI
          title="Avg Disk"
          value={`${latestDisk.toFixed(1)}%`}
          subtitle={latestDisk >= thresholds.diskCritical ? "Critical" :
            latestDisk >= thresholds.diskWarn ? "High" : "Normal"}
          color={latestDisk >= thresholds.diskCritical ? theme.danger : latestDisk >= thresholds.diskWarn ? theme.warn : theme.success}
          extra={<Sparkline data={diskHistory} />}
          cardColor={theme.card}
        />
      </div>

      {/* Large live charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 14 }}>
          <ChartCard title="CPU Usage (%)" color={theme.accent} labels={labels} data={cpuHistory} options={chartOptions} cardColor={theme.card} />
          <ChartCard title="RAM Usage (%)" color="#9be564" labels={labels} data={ramHistory} options={chartOptions} cardColor={theme.card} />
          <ChartCard title="Disk Usage (%)" color="#f6b26b" labels={labels} data={diskHistory} options={chartOptions} cardColor={theme.card} />
        </div>

        {/* Simple table view: top 6 agents by CPU desc */}
        <div style={{ padding: 12, borderRadius: 10, background: theme.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Top agents by CPU</div>
            <div style={{ color: theme.muted, fontSize: 13 }}>{systems.length} agents</div>
          </div>

          <div style={{ maxHeight: 220, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: theme.text }}>
              <thead style={{ color: theme.muted, fontSize: 13 }}>
                <tr>
                  <th style={thStyle}>Agent</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>CPU</th>
                  <th style={thStyle}>RAM</th>
                </tr>
              </thead>
              <tbody>
                {systems
                  .slice()
                  .sort((a, b) => (b.cpu_usage || 0) - (a.cpu_usage || 0))
                  .slice(0, 8)
                  .map((s, i) => (
                    <tr key={i} style={{ borderTop: `1px solid rgba(255,255,255,0.03)` }}>
                      <td style={tdStyle}>{s.hostname || s.name || s.id || `agent-${i + 1}`}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: 8,
                          background: s.agent_status === "Online" ? "rgba(20,195,142,0.12)" : "rgba(255,92,124,0.08)",
                          color: s.agent_status === "Online" ? theme.success : theme.danger,
                          fontWeight: 600,
                          fontSize: 12
                        }}>{s.agent_status}</span>
                      </td>
                      <td style={tdStyle}>{(s.cpu_usage || 0).toFixed(1)}%</td>
                      <td style={tdStyle}>{(s.ram_usage || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Subcomponents & styles ---------- */

const topButtonStyle = (theme) => ({
  background: "transparent",
  border: `1px solid ${theme.muted}`,
  padding: "6px 10px",
  borderRadius: 8,
  color: theme.text,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
});

// KPI small card
const KPI = ({ title, value, subtitle, extra, color, cardColor }) => (
  <div style={{
    background: cardColor,
    padding: 12,
    borderRadius: 10,
    boxShadow: "0 6px 18px rgba(2,6,23,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: 8
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ color: "#9fb0c9", fontSize: 13 }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 18, color }}>{value}</div>
    </div>

    <div style={{ color: "#9fb0c9", fontSize: 12 }}>{subtitle}</div>

    <div>{extra}</div>
  </div>
);

// Chart card for main charts
const ChartCard = ({ title, labels, data, color, options, cardColor }) => (
  <div style={{ background: cardColor, padding: 12, borderRadius: 10, minHeight: 220 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#93a7bf" }}>{/* small place for legend */}</div>
    </div>

    <div style={{ height: 180 }}>
      <Line
        data={{
          labels,
          datasets: [
            {
              data: data,
              borderWidth: 2,
              tension: 0.35,
              borderColor: color,
              backgroundColor: `${color}22`,
              fill: true,
              pointRadius: 0,
            },
          ],
        }}
        options={options}
      />
    </div>
  </div>
);

const thStyle = { textAlign: "left", padding: "8px 6px", fontWeight: 600 };
const tdStyle = { padding: "10px 6px", fontSize: 14 };

/* Export */
export default Dashboard;
