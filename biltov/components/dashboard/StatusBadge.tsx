"use client";

import { useI18n } from "@/lib/i18n";
import { STATUS_STYLE, type JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const { t } = useI18n();
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 whitespace-nowrap", STATUS_STYLE[status], className)}>{t.dashboard.statuses[status]}</span>;
}
