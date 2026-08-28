import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { PublicColumnHeader } from "./public-column-header";

afterEach(() => {
  cleanup();
});

const column = {
  id: "in-progress",
  name: "In Progress",
  isFinal: false,
  icon: null,
  tasks: [{ id: "task-1" }, { id: "task-2" }],
} as ProjectWithTasks["columns"][number];

describe("PublicColumnHeader", () => {
  it("renders the column name, task count, and icon", () => {
    const { container } = render(<PublicColumnHeader column={column} />);
    expect(screen.getByText("In Progress")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(container.querySelector("svg")).toBeVisible();
  });
});
