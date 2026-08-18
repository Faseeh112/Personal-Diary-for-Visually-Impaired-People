"use client";

/**
 * ClientProviders — wraps all client-side context providers.
 * Import this in app/layout.jsx so the providers only run on the client
 * while the layout itself stays a Server Component.
 *
 * Usage in app/layout.jsx:
 *   import ClientProviders from "../components/ClientProviders";
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="en">
 *         <body>
 *           <ClientProviders>{children}</ClientProviders>
 *         </body>
 *       </html>
 *     );
 *   }
 */
import { AuthProvider } from "../contexts/AuthContext";

export default function ClientProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
