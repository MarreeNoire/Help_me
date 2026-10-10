import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Help_me — Alerte SOS",
  description: "Un bouton pour alerter tes proches en cas de danger.",
  applicationName: "Help_me",
  icons: { icon: "/icons/192", apple: "/icons/192" },
  appleWebApp: { capable: true, title: "Help_me", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
