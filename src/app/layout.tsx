import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WikiCredCon Editing Experiment",
  description: "A platform for studying credibility-aware Wikipedia editing with Arbiter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
