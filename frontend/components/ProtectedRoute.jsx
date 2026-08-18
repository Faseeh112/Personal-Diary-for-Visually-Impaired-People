"use client";

/**
 * ProtectedRoute — wraps a component so unauthenticated users are redirected
 * to /login. Uses Next.js router instead of react-router-dom.
 *
 * Usage:
 *   export default function SomePage() {
 *     return <ProtectedRoute><YourPageContent /></ProtectedRoute>;
 *   }
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return children;
}
