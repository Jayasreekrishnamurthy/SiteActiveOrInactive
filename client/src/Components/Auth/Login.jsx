import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../Style/Login.css";



const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); 
    try {
      const res = await axios.post("http://localhost:5000/login", { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
  <div className="login-card">
    <div className="login-left">
      <img
        src="/Assets/Images/image.png"
        alt="Login Illustration"
        className="login-image"
      />
    </div>

    <div className="login-right">
      <h2>Login to Dashboard</h2>
        <form onSubmit={handleLogin} className="login-form">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="•••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="form-options">
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="login-btn">LOGIN</button>
          {error && <p className="error">{error}</p>}
        </form>

        <p className="signup-text">
          Don’t have an account? <Link to="/register">Sign up.</Link>
        </p>
    </div>
  </div>
</div>
  );
};

export default Login;
