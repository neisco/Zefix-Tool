import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zefix Excel Enrichment Tool",
  description: "Firmen per Excel hochladen und automatisch mit Zefix-Daten anreichern",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#F8F9FA] text-slate-800 overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-900">{children}</body>
    </html>
  );
}
