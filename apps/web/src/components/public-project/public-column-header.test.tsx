import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { PublicColumnHeader } from "./public-column-header";

afterEach(() => {
  cleanup();
});

describe("PublicColumnHeader", () => {
  it("renders column name, task count, and an icon", () => {
    const column = {
      id: "in-progress",
      name: "In Progress",
      isFinal: false,
      icon: null,
      tasks: [{ id: "task-1" }, { id: "task-2" }, { id: "task-3" }],
    } as ProjectWithTasks["columns"][number];

    const { container } = render(<PublicColumnHeader column={column} />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("In Progress")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
  });
});
