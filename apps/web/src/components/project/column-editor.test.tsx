import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ColumnEditor from "./column-editor";

const LIMITED_COLUMN_ID = "cm0limitedcolumnid00001";

const mocks = vi.hoisted(() => ({
  updateColumn: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  canManageProjects: vi.fn(() => true),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.canManageProjects.mockReturnValue(true);
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
  }),
}));

// Raw column rows, exactly as the columns query returns them.
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      {
        id: "cm0limitedcolumnid00001",
        projectId: "project-1",
        slug: "in-progress",
        name: "In Progress",
        icon: "circle",
        isFinal: false,
        wipLimit: 3,
      },
      {
        id: "cm0limitlesscolumnid001",
        projectId: "project-1",
        slug: "todo",
        name: "To Do",
        icon: "circle",
        isFinal: false,
        wipLimit: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/mutations/column/use-create-column", () => ({
  useCreateColumn: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({ mutateAsync: mocks.updateColumn }),
}));

vi.mock("@/hooks/mutations/column/use-delete-column", () => ({
  useDeleteColumn: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/column/use-reorder-columns", () => ({
  useReorderColumns: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageProjects: mocks.canManageProjects,
  }),
}));

vi.mock("@/lib/column", () => ({ getColumnIcon: () => null }));

vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function wipInputs() {
  return screen.getAllByRole("spinbutton");
}

describe("ColumnEditor WIP limit control", () => {
  it("seeds each row from its stored limit", () => {
    render(<ColumnEditor projectId="project-1" />);

    const [limited, limitless] = wipInputs();
    expect(limited).toHaveValue(3);
    expect(limitless).toHaveValue(null);
  });

  it("does not mutate when the value is committed unchanged", () => {
    render(<ColumnEditor projectId="project-1" />);

    fireEvent.blur(wipInputs()[0]);

    expect(mocks.updateColumn).not.toHaveBeenCalled();
  });

  // Mutations key on the real cuid, not the slug.
  it("mutates with the parsed number on blur", async () => {
    render(<ColumnEditor projectId="project-1" />);

    const [limited] = wipInputs();
    fireEvent.change(limited, { target: { value: "5" } });
    fireEvent.blur(limited);

    await waitFor(() =>
      expect(mocks.updateColumn).toHaveBeenCalledWith({
        id: LIMITED_COLUMN_ID,
        projectId: "project-1",
        data: { wipLimit: 5 },
      }),
    );
  });

  it("clears the limit with null when the field is emptied", async () => {
    render(<ColumnEditor projectId="project-1" />);

    const [limited] = wipInputs();
    fireEvent.change(limited, { target: { value: "" } });
    fireEvent.blur(limited);

    await waitFor(() =>
      expect(mocks.updateColumn).toHaveBeenCalledWith({
        id: LIMITED_COLUMN_ID,
        projectId: "project-1",
        data: { wipLimit: null },
      }),
    );
  });

  it("does not mutate when emptying an already-limitless column", () => {
    render(<ColumnEditor projectId="project-1" />);

    fireEvent.blur(wipInputs()[1]);

    expect(mocks.updateColumn).not.toHaveBeenCalled();
  });

  it("rejects a decimal locally without calling the API", () => {
    render(<ColumnEditor projectId="project-1" />);

    const [limited] = wipInputs();
    fireEvent.change(limited, { target: { value: "2.5" } });
    fireEvent.blur(limited);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "settings:columnEditor.toastWipLimitInvalid",
    );
    expect(mocks.updateColumn).not.toHaveBeenCalled();
  });

  it("rejects zero locally without calling the API", () => {
    render(<ColumnEditor projectId="project-1" />);

    const [limited] = wipInputs();
    fireEvent.change(limited, { target: { value: "0" } });
    fireEvent.blur(limited);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "settings:columnEditor.toastWipLimitInvalid",
    );
    expect(mocks.updateColumn).not.toHaveBeenCalled();
  });

  it("disables the control without the manage-projects permission", () => {
    mocks.canManageProjects.mockReturnValue(false);
    render(<ColumnEditor projectId="project-1" />);

    expect(wipInputs()[0]).toBeDisabled();
  });
});
