import { useTranslation } from "react-i18next";
import {
  formatEstimateHours,
  sumEstimatedMinutes,
} from "@/components/task/estimate";

type ColumnEstimateTotalProps = {
  tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>;
};

export function ColumnEstimateTotal({ tasks }: ColumnEstimateTotalProps) {
  const { t } = useTranslation();

  const total = sumEstimatedMinutes(tasks);
  const value = total === null ? null : formatEstimateHours(total);

  // null, not 0, is the empty signal: a lane with no estimates renders no
  // element at all, so a board that has never used estimates is unchanged.
  if (value === null) {
    return null;
  }

  // Only the title uses copy; the visible text stays the formatted value so the
  // chip needs no i18n provider to render.
  return (
    <span
      className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      title={t("tasks:kanban.laneEstimate", { value })}
    >
      {value}
    </span>
  );
}
