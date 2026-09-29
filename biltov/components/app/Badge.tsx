import { cn } from "@/lib/utils";

export function Badge({ label, style, className }: { label: string; style: string; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", style, className)}>{label}</span>;
}
