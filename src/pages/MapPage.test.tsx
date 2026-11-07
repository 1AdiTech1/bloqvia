import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const sandbox = vi.hoisted(() => ({
  completed: ["the-vault", "the-fuel-system"] as string[],
  stamped: false,
  reduce: false,
  perch: vi.fn(async () => {}),
  cheer: vi.fn(),
  arrived: new Map<string, (level: number) => void>(),
}));
vi.mock("@/bloq", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return { ChainTrail: forwardRef(({ world = "fields", onArrived, onPlay, door }: { world?: string; onArrived: (level: number) => void; onPlay: (level: number) => void; door: ReactNode }, ref) => {
    sandbox.arrived.set(world, onArrived);
    useImperativeHandle(ref, () => ({ perchAt: sandbox.perch, cheer: sandbox.cheer }));
    return <div><button onClick={() => onPlay(2)}>Play {world}</button>{door}</div>;
  }) };
});
vi.mock("@/near", () => ({
  useFinalBlock: () => 123,
  useChapters: () => ({ chapters: [] }),
  SEASON2_CHAPTERS: ["chapter-ownership", "chapter-transactions", "chapter-defi"],
  season2Done: () => sandbox.stamped,
}));
vi.mock("@/near/useChapters", () => ({ SEASON2_CHAPTERS: ["chapter-ownership", "chapter-transactions", "chapter-defi"] }));
vi.mock("@/game/useGame", () => ({ IS_MOCK: false, useGame: () => ({
  accountId: "sandbox.testnet", learner: { completed: sandbox.completed, level: 2, gold: "100", items: [] },
  passport: null, refresh: async () => {},
}) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => sandbox.reduce, AnimatePresence: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/PhoneShell", () => ({ PhoneShell: ({ children }: { children: ReactNode }) => children, GameHeader: () => null }));
vi.mock("@/components/RequireAccount", () => ({ RequireAccount: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/QuizSheet", () => ({ QuizSheet: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close quiz</button> }));
vi.mock("@/components/GameBits", () => ({ ItemIcon: () => null }));
vi.mock("@/components/lab/InventoryBar", () => ({ InventoryBar: () => null }));
vi.mock("@/components/lab/StreakCard", () => ({ StreakCard: () => null }));
vi.mock("@/components/lab/DailyQuestCard", () => ({ DailyQuestCard: () => null }));
vi.mock("@/components/lab/Web3Passport", () => ({ Web3Passport: () => null }));
vi.mock("@/components/lab/motion", () => ({ buzz: () => {}, Press: () => null }));

import { MapPage } from "./MapPage";

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => {
  vi.useFakeTimers(); sandbox.completed = ["the-vault", "the-fuel-system"];
  sandbox.stamped = false; sandbox.reduce = false;
  sandbox.perch.mockClear(); sandbox.cheer.mockClear(); sandbox.arrived.clear(); localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("map celebration timing in a sandbox", () => {
  it.each([false, true])("never perches behind the final founding quiz (reduced motion: %s)", async (reduce) => {
    sandbox.reduce = reduce;
    const view = render(<MapPage />);
    fireEvent.click(screen.getByText("Play fields"));
    sandbox.completed = [...sandbox.completed, "smart-agreements"];
    view.rerender(<MapPage />);
    await advance(1000);
    expect(sandbox.perch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Close quiz"));
    await advance(450);
    if (!reduce) {
      expect(sandbox.perch).not.toHaveBeenCalled();
      act(() => sandbox.arrived.get("fields")?.(3));
    }
    await advance(50);
    expect(sandbox.perch).toHaveBeenCalledTimes(1);
    expect(sandbox.perch).toHaveBeenLastCalledWith(expect.any(Object), expect.any(String), false, true);
    fireEvent(window, new Event("resize"));
    await advance(200);
    expect(sandbox.perch).toHaveBeenLastCalledWith(expect.any(Object), expect.any(String), true, true);
  });

  it("perches instantly on a page opened with Season 1 complete", async () => {
    sandbox.completed.push("smart-agreements");
    render(<MapPage />);
    await advance(450);
    expect(sandbox.perch).toHaveBeenCalledExactlyOnceWith(expect.any(Object), expect.any(String), true, true);
  });

  it("cheers only after arrival and the full 2600ms stamp moment", async () => {
    sandbox.completed.push("smart-agreements", "chapter-ownership", "chapter-transactions");
    const view = render(<MapPage />);
    fireEvent.click(screen.getByText("Play city"));
    sandbox.completed.push("chapter-defi"); sandbox.stamped = true;
    view.rerender(<MapPage />);
    await advance(3000);
    expect(sandbox.cheer).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "See your Passport" })).toBeNull();
    fireEvent.click(screen.getByText("Close quiz")); await advance(450);
    act(() => sandbox.arrived.get("city")?.(3));
    await advance(2599); expect(sandbox.cheer).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "See your Passport" })).toBeNull();
    await advance(1); expect(sandbox.cheer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "See your Passport" })).toBeInTheDocument();
  });

  it("does not replay the stamp moment on an already-stamped page", async () => {
    sandbox.completed.push("smart-agreements", "chapter-ownership", "chapter-transactions", "chapter-defi"); sandbox.stamped = true;
    render(<MapPage />);
    expect(screen.getByRole("link", { name: "See your Passport" })).toBeInTheDocument();
    act(() => sandbox.arrived.get("city")?.(3));
    await advance(4000);
    expect(sandbox.cheer).not.toHaveBeenCalled();
  });
});