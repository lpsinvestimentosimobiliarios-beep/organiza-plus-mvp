import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Organiza+ | Mapa inteligente para sair das dívidas",
  description:
    "MVP PWA mobile-first para organizar dívidas, criar plano de quitação e acompanhar progresso financeiro.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Organiza+",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0A1835",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
