import type { Metadata } from "next";
import { App } from "@/components/app/AppShell";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Biltov — Mon espace",
  robots: { index: false },
  manifest: `${base}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Biltov", statusBarStyle: "black-translucent" },
  icons: { apple: `${base}/brand/icon-192.png` },
};

export default function DashboardPage() {
  return <App />;
}
