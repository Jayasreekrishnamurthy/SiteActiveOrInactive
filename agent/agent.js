// =====================
// REQUIRED PACKAGES
// =====================
const si = require("systeminformation");
const axios = require("axios");
const IP = require("ip").address();
const os = require("os");

// IMPORTANT: Use node-powershell v4
const PowerShell = require("node-powershell");

// =====================
// GET ANTIVIRUS STATUS
// =====================
async function getAntivirus() {
  const ps = new PowerShell({
    executionPolicy: "Bypass",
    noProfile: true
  });

  ps.addCommand(`
    Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct |
    Select-Object displayName, productState, timestamp
  `);

  try {
    const output = await ps.invoke();

    const result = JSON.parse(output.replace(/'/g, '"'))[0];

    const psState = parseInt(result.productState, 16);

    const realtime = (psState & 0x10) ? "ON" : "OFF";
    const definitions = (psState & 0x100000) ? "Updated" : "Outdated";

    return {
      antivirus_name: result.displayName,
      antivirus_realtime: realtime,
      antivirus_definitions: definitions,
      antivirus_lastupdate: result.timestamp
    };
  } catch (err) {
    console.log("Antivirus Error:", err.message);

    return {
      antivirus_name: "Unknown",
      antivirus_realtime: "Error",
      antivirus_definitions: "Error",
      antivirus_lastupdate: "Error"
    };
  }
}

// =====================
// MAIN MONITOR FUNCTION
// =====================
async function sendData() {
  try {
    // System Information
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();
    const osInfo = await si.osInfo();
    const av = await getAntivirus();

    const data = {
      system_name: os.hostname(),
      ip: IP,

      cpu_usage: cpu.currentLoad,
      ram_usage: ((mem.used / mem.total) * 100).toFixed(2),
      disk_usage: disk[0].use,

      antivirus_name: av.antivirus_name,
      antivirus_realtime: av.antivirus_realtime,
      antivirus_definitions: av.antivirus_definitions,
      antivirus_lastupdate: av.antivirus_lastupdate,

      network_status: net[0].operstate === "up" ? "Connected" : "Disconnected",

      os_version: `${osInfo.distro} ${osInfo.release}`,
      boot_time: osInfo.bootTime,

      agent_status: "Online"
    };

    console.log("Sending:", data);

    await axios.post("http://localhost:5000/infraupdate", data);

    console.log("✔ Data sent successfully");
  } catch (err) {
    console.log("❌ Send Error:", err.message);
  }
}

// =====================
// LOOP EVERY 5 SECONDS
// =====================
setInterval(sendData, 5000);

console.log("Agent Started... Monitoring active.");
