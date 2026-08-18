"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import "./SignUp.css";
import { useAuth } from "../../contexts/AuthContext";

function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const router = useRouter();
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!email.trim()) return setError("Email is required");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!agree) return setError("You must agree to the terms");
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      router.replace("/home");
    } catch (err) {
      setError(err.message || "Sign-up failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <img src="/assets/i.png" alt="Smart Diary Logo" className="signup-logo" />
          <h2>Welcome</h2>
          <p>Join now and let the smart diary remember everything for you.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          </div>
          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input type="email" id="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={submitting} />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={submitting} />
          </div>
          <div className="input-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input type="password" id="confirm-password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={submitting} />
          </div>
          {error && (
            <div className="error-banner" role="alert" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}
          <div className="options">
            <label>
              <input type="checkbox" checked={agree} onChange={() => setAgree(!agree)} disabled={submitting} />
              Agree to terms and conditions
            </label>
          </div>
          <button type="submit" className="signup-btn" disabled={submitting}>{submitting ? "Creating account..." : "Sign up"}</button>
        </form>
        <div className="login-link">
          <p>Already have an account? <a href="/login">Login</a></p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
