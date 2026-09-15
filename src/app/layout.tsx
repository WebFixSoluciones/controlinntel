import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/state";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "INNTEL CORP - Sistema de Control IPS",
  description: "Plataforma de gestión integral ISP, técnica, regulatoria ARCOTEL y financiera",
  icons: {
    icon: "/logo-inntel.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
