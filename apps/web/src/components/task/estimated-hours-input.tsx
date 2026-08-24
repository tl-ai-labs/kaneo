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

  // Invalid input does not commit, and an unchanged value does not mutate.
  const handleCommit = () => {
    const parsed = parseEstimatedHours(raw);
    if (parsed === undefined) return;
    if (parsed === value) return;
    onCommit(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="flex items-center gap-1 p-2">
      {/*
        type="text", not "number": input[type=number] sanitizes unparseable
        typing ("abc", "8e", "8,5") to the EMPTY STRING, which parses as null
        ("not estimated") and would be committed on blur — silently wiping an
        existing estimate. With type="text" the parser sees the real characters
        and returns undefined, which does not commit. The API remains the
        authority on the 0..1000 range.
      */}
      <Input
        type="text"
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
          // Keep the input from blurring: its blur-commit would otherwise run
          // first, close the popover, and swallow this click.
          onMouseDown={(e) => e.preventDefault()}
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
