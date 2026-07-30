import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });

const title = "PLANARDO — Juntarse es más fácil";
const description = "La app social para organizar planes con amigos.";

export const metadata: Metadata = {
  metadataBase: new URL("https://planardo.vercel.app"),
  title,
  description,
  manifest: "/manifest.webmanifest",
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
      <body className={`${inter.variable} ${display.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
