import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INNTEL CORP — Sistema Integral ISP, ARCOTEL & SRI",
  description: "Plataforma de gestión técnica, regulatoria y financiera para INNTEL CORP",
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
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
