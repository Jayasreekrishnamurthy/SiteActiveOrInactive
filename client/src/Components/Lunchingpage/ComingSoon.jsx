import React, { useEffect, useState, useCallback } from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useNavigate } from "react-router-dom"; // ✅ navigation hook
import "./ComingSoonMMT.css";

const ComingSoon = () => {
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const target = 100;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) {
          clearInterval(interval);
          return target;
        }
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  // ✅ handle login button click
  const handleLoginClick = () => {
    navigate("/");
  };

  return (
    <div className="coming-soon-container">
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: { enable: true, zIndex: 0 },
          background: { color: { value: "#010b19" } },
          particles: {
            number: { value: 90, density: { enable: true, area: 800 } },
            color: { value: "#00e0ff" },
            links: {
              enable: true,
              color: "#00e0ff",
              distance: 150,
              opacity: 0.3,
              width: 1,
            },
            move: { enable: true, speed: 1.2, outModes: "out" },
            opacity: { value: 0.5 },
            size: { value: { min: 1, max: 3 } },
          },
          interactivity: {
            events: { onHover: { enable: true, mode: "grab" }, resize: true },
            modes: { grab: { distance: 140, links: { opacity: 0.5 } } },
          },
          retina_detect: true,
        }}
      />

      <div className="overlay">
        <h3 className="subtitle">MMT (Monitoring And Maintenance Tool)</h3>
        <h1 className="title">MMT TOOL LAUNCHING SOON</h1>

        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="progress-text">{progress}% Completed</p>
        </div>

        {/* ✅ Button to go to Login page */}
        <button className="login-button" onClick={handleLoginClick}>
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;
