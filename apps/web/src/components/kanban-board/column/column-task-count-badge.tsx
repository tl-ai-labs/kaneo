import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type ColumnTaskCountBadgeProps = {
  count: number;
  wipLimit?: number | null;
};

export function ColumnTaskCountBadge({
  count,
  wipLimit,
}: ColumnTaskCountBadgeProps) {
  const { t } = useTranslation();

  // No limit: render byte-identically to the pre-WIP-limit badge.
  if (wipLimit == null) {
    return (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {count}
      </span>
    );
  }

  const isOverCap = count > wipLimit;
  const label = isOverCap
    ? t("tasks:kanban.wipLimit.overLabel", { current: count, limit: wipLimit })
    : t("tasks:kanban.wipLimit.withinLabel", {
        current: count,
        limit: wipLimit,
      });

  return (
    <span
      role="img"
      data-over-limit={isOverCap ? "true" : "false"}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        isOverCap
          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isOverCap ? (
        <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      ) : null}
      {`${count}/${wipLimit}`}
    </span>
  );
}
