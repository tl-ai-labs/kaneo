// This hook lives under components/board/ rather than hooks/ because this
// run's write contract does not allow new files under apps/web/src/hooks/,
// and the hook is board-specific.
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  applyBoardFiltersToSearch,
  areBoardFiltersEqual,
  parseBoardFilterSearch,
} from "@/lib/board-filter-search-params";

export function useBoardFilterUrlSync(
  filters: BoardFilters,
  search: unknown,
): void {
  const navigate = useNavigate();

  useEffect(() => {
    const current = parseBoardFilterSearch(search);
    if (areBoardFiltersEqual(current, filters)) {
      return;
    }

    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) =>
        applyBoardFiltersToSearch(prev, filters),
      replace: true,
    } as Parameters<typeof navigate>[0]);
  }, [filters, search, navigate]);
}
