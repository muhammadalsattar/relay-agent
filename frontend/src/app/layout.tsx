import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelayAgent — Omnichannel AI Agent & Memory Ops Console",
  description:
    "Enterprise ops console for WhatsApp, Web Widget, and SMS AI agents with persistent customer memory, MCP tool-execution traces, and live human handoff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#070b14] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
