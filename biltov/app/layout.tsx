import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Syne } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { fr } from "@/lib/content/fr";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: fr.meta.title,
  description: fr.meta.description,
  openGraph: { title: fr.meta.title, description: fr.meta.description, type: "website", locale: "fr_FR" },
};

export const viewport: Viewport = { themeColor: "#03060d", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" className={`${jakarta.variable} ${syne.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
