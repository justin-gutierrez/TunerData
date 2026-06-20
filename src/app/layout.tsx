import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TunerData — Automotive Datalog Validation",
  description:
    "Browser-based CSV datalog validation for remote automotive tuning workflows. Detect pull windows, enforce tuner rules, generate compliance reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
        <body className="min-h-full flex flex-col bg-[#0a0a0a] text-slate-100">
        <Navbar />
        <div className="flex-1 flex flex-col bg-[#0a0a0a]">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
