import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import labelColors from "@/constants/label-colors";
import {
  type BoardFilters,
  DUE_DATE_FILTER_VALUES,
} from "@/hooks/use-task-filters";
import { getColumnIcon } from "@/lib/column";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import type { ProjectWithTasks } from "@/types/project";

type WorkspaceLabel = {
  id: string;
  name: string;
  color: string;
};

type ActiveUsers = {
  members?: Array<{
    userId: string;
    user?: {
      image?: string | null;
      name?: string | null;
    } | null;
  }>;
};

type BoardFilterChipsProps = {
  project?: ProjectWithTasks | null;
  filters: BoardFilters;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  users?: ActiveUsers;
  workspaceLabels: WorkspaceLabel[];
};

type ActiveFilterChipProps = {
  subject: string;
  operator: string;
  value: ReactNode;
  removeLabel: string;
  onClear: () => void;
};

function ActiveFilterChip({
  subject,
  operator,
  value,
  removeLabel,
  onClear,
}: ActiveFilterChipProps) {
  return (
    <div className="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs shadow-xs">
      <span className="px-2 font-medium text-foreground">{subject}</span>
      <span className="h-full w-px bg-border" />
      <span className="px-2 text-foreground/80">{operator}</span>
      <span className="h-full w-px bg-border" />
      <span className="flex px-2 text-foreground">{value}</span>
      <span className="h-full w-px bg-border" />
      <button
        aria-label={removeLabel}
        className="inline-flex h-full w-7 items-center justify-center rounded-r-md text-foreground/70 hover:bg-accent/70 hover:text-foreground"
        onClick={onClear}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StackedIcons({
  items,
  itemClassName,
}: {
  items: Array<{ id: string; node: ReactNode }>;
  itemClassName?: string;
}) {
  if (items.length === 0) return null;

  return (
    <span className="inline-flex items-center -space-x-1.5">
      {items.slice(0, 3).map((item) => (
        <span
          key={item.id}
          className={`inline-flex size-4 items-center justify-center rounded-full bg-background ${itemClassName ?? ""}`}
        >
          {item.node}
        </span>
      ))}
    </span>
  );
}

type LabelGroup = { key: string; name: string; color: string; ids: string[] };

/**
 * A "label" as the user sees it is a (name, color) pair; the database holds one row per
 * instance, so one visible label maps to N ids. The Filter dropdown already groups this
 * way, and the chips have to match or the two controls disagree about what is selected.
 *
 * The separator is an escaped U+0000, which cannot occur in a label name, so ("a b", "c")
 * and ("a", "b c") cannot collide. It must stay written as the `\u0000` ESCAPE, never as a
 * raw byte: a literal NUL makes git classify this file as binary (no diff in review) and
 * makes grep skip it entirely (no secret scanning, no grep-based CI lint).
 */
const groupKey = (name: string, color: string) => `${name}\u0000${color}`;

function buildLabelGroups(workspaceLabels: WorkspaceLabel[]): LabelGroup[] {
  const byKey = new Map<string, LabelGroup>();
  for (const label of workspaceLabels) {
    const key = groupKey(label.name, label.color);
    const existing = byKey.get(key);
    if (existing) existing.ids.push(label.id);
    else
      byKey.set(key, {
        key,
        name: label.name,
        color: label.color,
        ids: [label.id],
      });
  }
  return Array.from(byKey.values());
}

const dueDateLabelKey = (dueDate: string) =>
  dueDate === DUE_DATE_FILTER_VALUES.dueThisWeek
    ? "dueThisWeek"
    : dueDate === DUE_DATE_FILTER_VALUES.dueNextWeek
      ? "dueNextWeek"
      : "noDueDate";

export default function BoardFilterChips({
  project,
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  users,
  workspaceLabels,
}: BoardFilterChipsProps) {
  const { t } = useTranslation();

  if (!hasActiveFilters) return null;

  const selectedStatusIds = filters.status ?? [];
  const selectedPriorityIds = filters.priority ?? [];
  const selectedAssigneeIds = filters.assignee ?? [];
  const selectedDueDateFilters = filters.dueDate ?? [];
  const selectedLabelIds = new Set(filters.labels ?? []);

  const getStatusDisplayName = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return column?.name || statusId;
  };
  const getStatusIcon = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return getColumnIcon(statusId, column?.isFinal, column?.icon);
  };

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || t("common:people.unknown");
  };
  const getAssigneeAvatar = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return (
      <Avatar className="h-4 w-4">
        <AvatarImage
          src={member?.user?.image ?? ""}
          alt={member?.user?.name || ""}
        />
        <AvatarFallback className="border border-border/30 text-[9px] font-medium">
          {getInitials(member?.user?.name)}
        </AvatarFallback>
      </Avatar>
    );
  };

  const removeLabelFor = (subject: string, value: string) =>
    t("tasks:boardFilters.removeFilter", { subject, value });

  // Each remover issues exactly ONE updateFilter call — see the commit invariant in
  // use-task-filters-with-labels-support.ts. Clearing the last value of a subject yields
  // null, never [], so the search param disappears rather than lingering as `?assignee=`.
  const removeAssignee = (userId: string) => {
    const next = selectedAssigneeIds.filter((id) => id !== userId);
    updateFilter("assignee", next.length > 0 ? next : null);
  };

  const removeLabelGroup = (group: LabelGroup) => {
    const next = (filters.labels ?? []).filter((id) => !group.ids.includes(id));
    updateFilter("labels", next.length > 0 ? next : null);
  };

  const activeLabelGroups = buildLabelGroups(workspaceLabels).filter((group) =>
    group.ids.some((id) => selectedLabelIds.has(id)),
  );

  const statusSubject = t("tasks:boardFilters.subjects.status");
  const prioritySubject = t("tasks:boardFilters.subjects.priority");
  const assigneeSubject = t("tasks:boardFilters.subjects.assignee");
  const dueDateSubject = t("tasks:boardFilters.subjects.dueDate");
  const labelsSubject = t("tasks:boardFilters.subjects.labels");

  return (
    <>
      {selectedStatusIds.length > 0 && (
        <ActiveFilterChip
          subject={statusSubject}
          operator={t("tasks:boardFilters.operators.isAnyOf")}
          value={
            <span className="inline-flex items-center gap-1.5">
              <StackedIcons
                items={selectedStatusIds.map((statusId) => ({
                  id: statusId,
                  node: getStatusIcon(statusId),
                }))}
                itemClassName="[&>svg]:h-3.5 [&>svg]:w-3.5"
              />
              <span>
                {selectedStatusIds.length === 1
                  ? getStatusDisplayName(selectedStatusIds[0])
                  : t("tasks:boardFilters.selectedCount", {
                      count: selectedStatusIds.length,
                    })}
              </span>
            </span>
          }
          removeLabel={removeLabelFor(
            statusSubject,
            selectedStatusIds.length === 1
              ? getStatusDisplayName(selectedStatusIds[0])
              : String(selectedStatusIds.length),
          )}
          onClear={() => updateFilter("status", null)}
        />
      )}

      {selectedPriorityIds.length > 0 && (
        <ActiveFilterChip
          subject={prioritySubject}
          operator={t("tasks:boardFilters.operators.isAnyOf")}
          value={
            <span className="inline-flex items-center gap-1.5">
              <StackedIcons
                items={selectedPriorityIds.map((priority) => ({
                  id: priority,
                  node: getPriorityIcon(priority),
                }))}
              />
              <span>
                {selectedPriorityIds.length === 1
                  ? getPriorityLabel(selectedPriorityIds[0])
                  : t("tasks:boardFilters.selectedCount", {
                      count: selectedPriorityIds.length,
                    })}
              </span>
            </span>
          }
          removeLabel={removeLabelFor(
            prioritySubject,
            selectedPriorityIds.length === 1
              ? getPriorityLabel(selectedPriorityIds[0])
              : String(selectedPriorityIds.length),
          )}
          onClear={() => updateFilter("priority", null)}
        />
      )}

      {selectedDueDateFilters.length > 0 && (
        <ActiveFilterChip
          subject={dueDateSubject}
          operator={t("tasks:boardFilters.operators.isAnyOf")}
          value={
            selectedDueDateFilters.length === 1
              ? t(
                  `tasks:backlog.filters.${dueDateLabelKey(selectedDueDateFilters[0])}`,
                )
              : t("tasks:boardFilters.selectedCount", {
                  count: selectedDueDateFilters.length,
                })
          }
          removeLabel={removeLabelFor(
            dueDateSubject,
            selectedDueDateFilters.length === 1
              ? t(
                  `tasks:backlog.filters.${dueDateLabelKey(selectedDueDateFilters[0])}`,
                )
              : String(selectedDueDateFilters.length),
          )}
          onClear={() => updateFilter("dueDate", null)}
        />
      )}

      {selectedAssigneeIds.map((userId) => (
        <ActiveFilterChip
          key={userId}
          subject={assigneeSubject}
          operator={t("tasks:boardFilters.operators.is")}
          value={
            <span className="inline-flex items-center gap-1.5">
              {getAssigneeAvatar(userId)}
              <span>{getAssigneeDisplayName(userId)}</span>
            </span>
          }
          removeLabel={removeLabelFor(
            assigneeSubject,
            getAssigneeDisplayName(userId),
          )}
          onClear={() => removeAssignee(userId)}
        />
      ))}

      {activeLabelGroups.map((group) => (
        <ActiveFilterChip
          key={group.key}
          subject={labelsSubject}
          operator={t("tasks:boardFilters.operators.includes")}
          value={
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    labelColors.find((c) => c.value === group.color)?.color ||
                    "var(--color-neutral-400)",
                }}
              />
              <span className="max-w-20 truncate">{group.name}</span>
            </span>
          }
          removeLabel={removeLabelFor(labelsSubject, group.name)}
          onClear={() => removeLabelGroup(group)}
        />
      ))}

      <button
        className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        onClick={clearFilters}
        type="button"
      >
        {t("common:actions.clearAllFilters")}
      </button>
    </>
  );
}
