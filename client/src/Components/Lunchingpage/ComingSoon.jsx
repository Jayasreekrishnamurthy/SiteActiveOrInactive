import React, { useEffect, useState, useCallback } from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim"; // ✅ use slim version
import "./ComingSoonMMT.css";

const ComingSoon = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = 70;
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
    await loadSlim(engine); // ✅ loadSlim instead of loadFull
  }, []);

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
        <h3 className="subtitle">Something great is on the way</h3>
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

        {/* <p className="scroll-text">Stay Tuned ↓</p> */}
      </div>
    </div>
  );
};

export default ComingSoon;
