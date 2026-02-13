import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Header } from "@/components/header";
import { AuftragProvider } from "@/context/auftrag-context";
import { BenutzerProvider } from "@/context/benutzer-context";
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
  title: "MES Blechbearbeitung",
  description:
    "Einfache MES-Oberfläche für Blechbearbeitung mit Planung und Werkstattansicht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <Header />
        <AuftragProvider>
          <BenutzerProvider>{children}</BenutzerProvider>
        </AuftragProvider>
      </body>
    </html>
  );
}
