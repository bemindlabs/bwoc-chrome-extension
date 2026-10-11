// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { installChrome } from "./helpers/chrome";

vi.mock("../src/background/api", () => ({
  api: { fleet: vi.fn(), agentStatus: vi.fn(), agentInbox: vi.fn() },
  ApiError: class extends Error {},
}));
import { api } from "../src/background/api";
import { Fleet } from "../src/sidepanel/Fleet";
import { AgentDetail } from "../src/sidepanel/AgentDetail";

const m = vi.mocked(api, true);
beforeEach(() => {
  installChrome();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("Fleet", () => {
  it("shows a loading state before data arrives", () => {
    m.fleet.mockReturnValue(new Promise(() => {}));
    render(<Fleet onSelect={() => {}} />);
    expect(screen.getByText("Loading fleet…")).toBeTruthy();
  });

  it("shows the error banner when the call fails", async () => {
    m.fleet.mockRejectedValue(new Error("network error: down"));
    render(<Fleet onSelect={() => {}} />);
    expect(await screen.findByText(/network error: down/)).toBeTruthy();
  });

  it("shows the empty state with null agents/health", async () => {
    m.fleet.mockResolvedValue({ workspace: "/ws", agents: null, health: null });
    render(<Fleet onSelect={() => {}} />);
    expect(await screen.findByText("no agents registered")).toBeTruthy();
    expect(screen.getByText("0 agents")).toBeTruthy();
  });

  it("lists agents, inbox badge and health warnings; selecting calls onSelect", async () => {
    m.fleet.mockResolvedValue({
      workspace: "/ws",
      agents: [
        { id: "agent-erlang", path: "p", backend: "claude", incarnated: "x", status: "active", running: true, inbox_count: 3 },
        { id: "agent-zeus", path: "p", backend: "codex", incarnated: "x", status: "stopped" },
      ],
      health: [
        { condition: 1, name: "Heartbeat", finding: "stale", status: "warn" },
        { condition: 2, name: "Disk", finding: "fine", status: "ok" },
      ],
    });
    const onSelect = vi.fn();
    render(<Fleet onSelect={onSelect} />);
    expect(await screen.findByText("erlang")).toBeTruthy();
    expect(screen.getByText("2 agents")).toBeTruthy();
    expect(screen.getByText("3 inbox")).toBeTruthy();
    expect(screen.getByText("Heartbeat")).toBeTruthy();
    expect(screen.queryByText("Disk")).toBeNull();
    fireEvent.click(screen.getByText("erlang"));
    expect(onSelect).toHaveBeenCalledWith("agent-erlang");
  });

  it("reports all-green when no health warnings", async () => {
    m.fleet.mockResolvedValue({
      workspace: "/ws",
      agents: [],
      health: [{ condition: 1, name: "A", finding: "", status: "ok" }],
    });
    render(<Fleet onSelect={() => {}} />);
    expect(await screen.findByText("all 1 signals green")).toBeTruthy();
  });
});

describe("AgentDetail", () => {
  it("shows placeholders while loading", () => {
    m.agentStatus.mockReturnValue(new Promise(() => {}));
    m.agentInbox.mockReturnValue(new Promise(() => {}));
    render(<AgentDetail id="agent-x" onBack={() => {}} />);
    expect(screen.getByText("agent-x")).toBeTruthy();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("renders status and inbox JSON when loaded", async () => {
    m.agentStatus.mockResolvedValue({ running: true });
    m.agentInbox.mockResolvedValue([{ from: "a" }]);
    render(<AgentDetail id="agent-x" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/"running": true/)).toBeTruthy());
    expect(screen.getByText(/"from": "a"/)).toBeTruthy();
  });

  it("shows an error banner when a call fails", async () => {
    m.agentStatus.mockRejectedValue(new Error("403 forbidden"));
    m.agentInbox.mockResolvedValue([]);
    render(<AgentDetail id="agent-x" onBack={() => {}} />);
    expect(await screen.findByText(/403 forbidden/)).toBeTruthy();
  });

  it("back button calls onBack", () => {
    m.agentStatus.mockReturnValue(new Promise(() => {}));
    m.agentInbox.mockReturnValue(new Promise(() => {}));
    const onBack = vi.fn();
    render(<AgentDetail id="agent-x" onBack={onBack} />);
    fireEvent.click(screen.getByText("← Fleet"));
    expect(onBack).toHaveBeenCalled();
  });
});
