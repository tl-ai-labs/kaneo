import { Clock } from "lucide-react";
import { formatEstimateHours } from "@/components/task/estimate";

type TaskEstimateBadgeProps = {
  minutes: number | null | undefined;
};

// Presentational only: no useTranslation, because the badge text is the
// formatted value itself and the component is unit-tested without providers.
export function TaskEstimateBadge({ minutes }: TaskEstimateBadgeProps) {
  const label = formatEstimateHours(minutes);

  // An unset estimate must render no DOM at all, so a card without an estimate
  // stays identical to today.
  if (label === null) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{label}</span>
    </span>
  );
}
