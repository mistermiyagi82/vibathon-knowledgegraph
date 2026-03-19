import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persistent Memory Chat",
  description: "Chat with Claude — with memory that spans every conversation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
