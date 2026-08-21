import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUpdateColumn } = vi.hoisted(() => ({
  mockUpdateColumn: vi.fn(),
}));

type ColumnFixture = {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  position: number;
  icon: string | null;
  color: string | null;
  isFinal: boolean;
  wipLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
};

let columnsFixture: ColumnFixture[] = [];

const makeColumn = (wipLimit: number | null): ColumnFixture => ({
  id: "col-1",
  projectId: "project-1",
  name: "To do",
  slug: "to-do",
  position: 0,
  icon: "Circle",
  color: null,
  isFinal: false,
  wipLimit,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  columnsFixture = [];
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: columnsFixture, isLoading: false }),
}));

vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({ mutateAsync: mockUpdateColumn }),
}));

vi.mock("@/hooks/mutations/column/use-create-column", () => ({
  useCreateColumn: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/column/use-delete-column", () => ({
  useDeleteColumn: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/column/use-reorder-columns", () => ({
  useReorderColumns: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageProjects: () => true }),
}));

vi.mock("@/lib/column", () => ({
  getColumnIcon: () => null,
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/constants/column-icons", () => ({
  default: { Circle: () => null },
  DEFAULT_COLUMN_ICON_NAMES: {},
}));

import ColumnEditor from "./column-editor";

const getWipInput = () =>
  screen.getByLabelText(
    "settings:columnEditor.wipLimitAria",
  ) as HTMLInputElement;

describe("ColumnEditor WIP limit input", () => {
  it("commits a valid positive integer as the new wipLimit", async () => {
    columnsFixture = [makeColumn(null)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpdateColumn).toHaveBeenCalledWith({
        id: "col-1",
        projectId: "project-1",
        data: { wipLimit: 5 },
      });
    });
    expect(mockUpdateColumn).toHaveBeenCalledTimes(1);
  });

  it("commits null when clearing an existing wipLimit", async () => {
    columnsFixture = [makeColumn(5)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpdateColumn).toHaveBeenCalledWith({
        id: "col-1",
        projectId: "project-1",
        data: { wipLimit: null },
      });
    });
    expect(mockUpdateColumn).toHaveBeenCalledTimes(1);
  });

  it("rejects 0 as below the allowed minimum", () => {
    columnsFixture = [makeColumn(null)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });

  it("rejects a value above the 32-bit signed integer maximum", () => {
    columnsFixture = [makeColumn(null)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.change(input, { target: { value: "2147483648" } });
    fireEvent.blur(input);

    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });

  it("rejects a non-integer value", () => {
    columnsFixture = [makeColumn(null)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.blur(input);

    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });

  it("does not fire a mutation when blurring without a change", () => {
    columnsFixture = [makeColumn(5)];
    mockUpdateColumn.mockResolvedValue({});

    render(<ColumnEditor projectId="project-1" />);

    const input = getWipInput();
    fireEvent.blur(input);

    expect(mockUpdateColumn).not.toHaveBeenCalled();
  });
});
