"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import "./Login.css";
import { useAuth } from "../../contexts/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError("Email and password are required"); return; }
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace("/home");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/assets/i.png" alt="Smart Diary Logo" className="login-logo" />
          <h2>Welcome Back</h2>
          <p>Access your Smart Diary - Login now!</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input type="email" id="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={submitting} />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={submitting} />
          </div>
          {error && (
            <div className="error-banner" role="alert" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}
          <div className="options">
            <label><input type="checkbox" /> Remember me</label>
            <button type="button" className="forgot-link" onClick={() => router.push("/forgot-password")} disabled={submitting}>Forgot password?</button>
          </div>
          <button type="submit" className="login-btn" disabled={submitting}>{submitting ? "Signing in..." : "Login"}</button>
        </form>
        <div className="signup-link">
          <p>Don't have an account? <a href="/signup">Sign up</a></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
