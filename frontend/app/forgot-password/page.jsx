"use client";
import { useRouter } from "next/navigation";

export default function ForgotPassword() {
  const router = useRouter();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <h2>Forgot Password</h2>
        <p>Password reset functionality coming soon.</p>
        <button onClick={() => router.push("/login")} style={{ marginTop: 16, padding: "10px 24px", background: "#4a6cf7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
