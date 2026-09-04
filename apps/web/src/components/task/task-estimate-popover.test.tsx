import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import type Task from "@/types/task";
import TaskEstimatePopover from "./task-estimate-popover";

const mutateAsync = vi.fn().mockResolvedValue({});
const canUpdateTasks = vi.fn().mockReturnValue(true);

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
  canUpdateTasks.mockReturnValue(true);
  mutateAsync.mockResolvedValue({});
});

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseTask: Task = {
  id: "task-1",
  title: "Test Task",
  number: 1,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  position: 1,
  createdAt: "2026-07-17T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  ...baseTask,
  ...overrides,
});

describe("TaskEstimatePopover", () => {
  it("saves hours as minutes when submitting valid input", async () => {
    const task = makeTask({ estimatedMinutes: null });

    render(
      <TaskEstimatePopover task={task}>
        <Button>Estimate</Button>
      </TaskEstimatePopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    const input = screen.getByLabelText("tasks:popover.estimate.label");
    fireEvent.change(input, { target: { value: "1.5" } });

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:popover.estimate.save" }),
    );

    expect(mutateAsync).toHaveBeenCalledWith({
      ...task,
      estimatedMinutes: 90,
    });
  });

  it("prefills from stored minutes", () => {
    const task = makeTask({ estimatedMinutes: 90 });

    render(
      <TaskEstimatePopover task={task}>
        <Button>Estimate</Button>
      </TaskEstimatePopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    const input = screen.getByLabelText("tasks:popover.estimate.label");
    expect(input).toHaveValue("1.5");
  });

  it("submits estimatedMinutes: null on clear action", async () => {
    const task = makeTask({ estimatedMinutes: 90 });

    render(
      <TaskEstimatePopover task={task}>
        <Button>Estimate</Button>
      </TaskEstimatePopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:popover.estimate.clear" }),
    );

    expect(mutateAsync).toHaveBeenCalledWith({
      ...task,
      estimatedMinutes: null,
    });
  });

  it("rejects bad input by disabling save and showing invalid message", () => {
    const task = makeTask({ estimatedMinutes: null });

    render(
      <TaskEstimatePopover task={task}>
        <Button>Estimate</Button>
      </TaskEstimatePopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    const input = screen.getByLabelText("tasks:popover.estimate.label");
    fireEvent.change(input, { target: { value: "-1" } });

    const saveButton = screen.getByRole("button", {
      name: "tasks:popover.estimate.save",
    });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByText("tasks:popover.estimate.invalid"),
    ).toBeInTheDocument();

    fireEvent.click(saveButton);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("renders children plain and opens no popover when read-only", () => {
    canUpdateTasks.mockReturnValue(false);
    const task = makeTask({ estimatedMinutes: null });

    render(
      <TaskEstimatePopover task={task}>
        <Button>Estimate</Button>
      </TaskEstimatePopover>,
    );

    expect(
      screen.getByRole("button", { name: "Estimate" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    expect(screen.queryByLabelText("tasks:popover.estimate.label")).toBeNull();
  });
});
