import type { Metadata } from "next";
import { App } from "@/components/app/AppShell";

export const metadata: Metadata = { title: "Biltov — Mon espace", robots: { index: false } };

export default function DashboardPage() {
  return <App />;
}
