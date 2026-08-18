"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Edit Task page — task editing is handled inline via modals on the /task page.
 * This route redirects to /task to prevent a broken empty page.
 */
export default function EditTask() {
  const router = useRouter();
  useEffect(() => { router.replace("/task"); }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#64748b', fontSize: 14 }}>
      Redirecting to Tasks…
    </div>
  );
}