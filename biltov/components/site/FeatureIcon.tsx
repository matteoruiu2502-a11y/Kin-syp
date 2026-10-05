import { Boxes, Calculator, CalendarDays, Camera, Clock, CreditCard, FileText, HandCoins, Handshake, HardDriveDownload, HardHat, Landmark, Languages, LifeBuoy, Mic, Package, PackageSearch, PlayCircle, Receipt, Repeat, Send, Settings, ShieldCheck, ShoppingCart, Smartphone, Sparkles, TrendingUp, UserPlus, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Boxes, Calculator, CalendarDays, Camera, Clock, CreditCard, FileText, HandCoins, Handshake, HardDriveDownload, HardHat, Landmark, Languages, LifeBuoy, Mic, Package, PackageSearch, PlayCircle, Receipt, Repeat, Send, Settings, ShieldCheck, ShoppingCart, Smartphone, TrendingUp, UserPlus, Users };

/** Icône d'une fonctionnalité (nom lucide déclaré dans la base de connaissances). */
export function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
