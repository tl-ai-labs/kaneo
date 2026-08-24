import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Returns null for an empty field ("not estimated") and undefined for input
// that is not a whole number in 0..1000 — callers must never write undefined.
// The API is the authority: Valibot rejects out-of-range values with a 400.
export function parseEstimatedHours(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const num = Number.parseInt(trimmed, 10);
  if (num >= 0 && num <= 1000) return num;
  return undefined;
}

export function EstimatedHoursInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (n: number | null) => void;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState(value === null ? "" : String(value));

  const handleCommit = () => {
    const parsed = parseEstimatedHours(raw);
    if (parsed !== undefined) {
      onCommit(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="flex items-center gap-1 p-2">
      <Input
        type="number"
        min={0}
        max={1000}
        step={1}
        inputMode="numeric"
        placeholder={t("tasks:popover.estimatedHours.placeholder")}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="h-8 text-xs"
      />
      {value !== null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setRaw("");
            onCommit(null);
          }}
          title={t("tasks:popover.estimatedHours.clear")}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
