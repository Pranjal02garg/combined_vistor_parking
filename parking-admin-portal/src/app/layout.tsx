import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parking Security Lab",
  description: "Secure Next.js authentication with MongoDB-backed sessions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="app-body" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
        <footer style={{ textAlign: "center", padding: "16px", fontSize: "14px", color: "#64748b", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontWeight: 500 }}>
          Developers: Bhumit Gupta(bgupta1_be23@thapar.edu), Siddharth Sharma(ssharma16_be23@thapar.edu),Manraj Singh
        </footer>
      </body>
    </html>
  );
}
