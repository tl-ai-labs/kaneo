import { useTranslation } from "react-i18next";
import { sumEstimatedHours } from "@/lib/estimated-hours";
import { formatEstimatedHours } from "@/lib/format";

type ColumnEstimatedHoursBadgeProps = {
  tasks: Array<{ estimatedHours?: number | null }>;
};

export function ColumnEstimatedHoursBadge({
  tasks,
}: ColumnEstimatedHoursBadgeProps) {
  const { t } = useTranslation();
  const total = sumEstimatedHours(tasks);

  if (total === 0) {
    return null;
  }

  return (
    <span
      className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      title={t("tasks:kanban.estimatedHoursTooltip")}
    >
      {t("tasks:kanban.estimatedHoursBadge", {
        hours: formatEstimatedHours(total),
      })}
    </span>
  );
}
