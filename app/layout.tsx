import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const title = "PLANARDO — Juntarse es más fácil";
const description = "La app social para organizar planes con amigos.";

export const metadata: Metadata = {
  metadataBase: new URL("https://planardo.vercel.app"),
  title,
  description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/planardo-mark-64.png", sizes: "64x64", type: "image/png" },
      { url: "/planardo-mark-192.png", sizes: "192x192", type: "image/png" },
      { url: "/planardo-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/planardo-mark-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Planardo" },
  openGraph: {
    title,
    description,
    url: "https://planardo.vercel.app",
    siteName: "PLANARDO",
    images: [{ url: "/og-image.png", width: 1200, height: 1200 }],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
