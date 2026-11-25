import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav, Sidebar } from "@/components/nav";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "CY Planner", template: "%s · CY Planner" },
  description: "Emploi du temps Celcat, cours, partiels et révisions — CY Tech",
  manifest: "/manifest.json",
  applicationName: "CY Planner",
  appleWebApp: { capable: true, title: "CY Planner", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh overflow-x-hidden font-sans">
        <ToastProvider>
          <Sidebar />
          <main className="mobile-content-pad mx-auto w-full min-w-0 max-w-6xl px-4 md:pl-[calc(15rem+2rem)] md:pr-8">
            {children}
          </main>
          <BottomNav />
        </ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
