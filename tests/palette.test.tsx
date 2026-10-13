// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installChrome } from "./helpers/chrome";

vi.mock("../src/background/api", () => ({
  api: { cli: vi.fn() },
  ApiError: class extends Error {},
}));
import { Palette } from "../src/sidepanel/Palette";
import type { WhoAmI } from "../src/shared/types";

const who = { caps: ["read", "write"] } as unknown as WhoAmI;
const ctrlK = () => fireEvent.keyDown(window, { key: "k", ctrlKey: true });
const dialogs = () => screen.queryAllByRole("dialog");

beforeEach(() => {
  installChrome();
  vi.clearAllMocks();
});
afterEach(cleanup);

/** Pick "Add a task" from the palette, fill it in and submit, leaving the confirm dialog open. */
function openConfirm() {
  ctrlK();
  fireEvent.click(screen.getByText("Add a task"));
  const [team, title] = screen.getAllByRole("textbox");
  fireEvent.change(team, { target: { value: "core" } });
  fireEvent.change(title, { target: { value: "ship it" } });
  fireEvent.click(screen.getByRole("button", { name: "Review & run…" }));
  expect(screen.getByText("Confirm: Add a task")).toBeTruthy();
}

describe("Palette shortcut", () => {
  it("opens the search dialog on Ctrl+K", () => {
    render(<Palette who={who} openSignal={0} />);
    expect(dialogs()).toHaveLength(0);
    ctrlK();
    expect(screen.getByText("Command palette")).toBeTruthy();
  });

  it("does not stack the search dialog on top of a pending confirmation", () => {
    render(<Palette who={who} openSignal={0} />);
    openConfirm();
    expect(dialogs()).toHaveLength(1);
    ctrlK();
    expect(dialogs()).toHaveLength(1);
    expect(screen.queryByText("Command palette")).toBeNull();
  });

  it("ignores the App-level open signal while confirming, and works again afterwards", () => {
    const { rerender } = render(<Palette who={who} openSignal={0} />);
    openConfirm();
    rerender(<Palette who={who} openSignal={1} />);
    expect(screen.queryByText("Command palette")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialogs()).toHaveLength(0);
    ctrlK();
    expect(screen.getByText("Command palette")).toBeTruthy();
  });
});
