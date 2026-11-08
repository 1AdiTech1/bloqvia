import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const sandbox = vi.hoisted(() => ({
  completed: ["the-vault", "the-fuel-system"] as string[],
  stamped: false,
  reduce: false,
  graduated: true,
  navigate: vi.fn(),
  say: vi.fn(),
  perch: vi.fn(async () => {}),
  cheer: vi.fn(),
  arrived: new Map<string, (level: number) => void>(),
}));
vi.mock("@/bloq", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return { ChainTrail: forwardRef(({ world = "fields", onArrived, onPlay, door }: { world?: string; onArrived: (level: number) => void; onPlay: (level: number) => void; door: ReactNode }, ref) => {
    sandbox.arrived.set(world, onArrived);
    useImperativeHandle(ref, () => ({ perchAt: sandbox.perch, cheer: sandbox.cheer, say: sandbox.say }));
    return <div><button onClick={() => onPlay(2)}>Play {world}</button>{door}</div>;
  }), Bloq: () => null, SpeechBubble: () => null, leap: () => () => {}, talkMs: () => 0, useSay: () => ["", () => {}] };
});
vi.mock("@/near", () => ({
  useFinalBlock: () => 123,
  useChapters: () => ({ chapters: [] }),
  SEASON2_CHAPTERS: ["chapter-ownership", "chapter-transactions", "chapter-defi"],
  season2Done: () => sandbox.stamped,
  useAfterSeasons: () => ({ active: false, ready: false, next: "streak", streak: { available: false, done: false }, daily: { available: false, done: false, lessonId: null }, missions: { available: true, done: false }, tourStarted: false, startTour: () => {} }),
}));
vi.mock("@/components/lab/AfterSeasonsCard", () => ({ AfterSeasonsCard: () => null }));
vi.mock("@/components/lab/useDesktop", () => ({ useIsDesktop: () => false }));
vi.mock("@/near/useChapters", () => ({ SEASON2_CHAPTERS: ["chapter-ownership", "chapter-transactions", "chapter-defi"] }));
vi.mock("@/game/useGame", () => ({ IS_MOCK: false, useGame: () => ({
  accountId: "sandbox.testnet", learner: { completed: sandbox.completed, graduated: sandbox.graduated, level: 2, gold: "100", items: [] },
  passport: null, refresh: async () => {},
}) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => sandbox.navigate, Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => <a className={className} href={to}>{children}</a> }));
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
  sandbox.graduated = true; sandbox.navigate.mockClear(); sandbox.say.mockClear();
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

  it.each([false, true])("cheers after 2600ms then reveals after the specified delay (reduced: %s)", async (reduce) => {
    sandbox.reduce = reduce;
    sandbox.completed.push("smart-agreements", "chapter-ownership", "chapter-transactions");
    const view = render(<MapPage />);
    fireEvent.click(screen.getByText("Play city"));
    sandbox.completed.push("chapter-defi"); sandbox.stamped = true;
    view.rerender(<MapPage />);
    await advance(3000);
    expect(sandbox.cheer).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "See your Passport" })).toBeNull();
    fireEvent.click(screen.getByText("Close quiz")); await advance(450);
    if (!reduce) act(() => sandbox.arrived.get("city")?.(3));
    await advance(2599); expect(sandbox.cheer).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "See your Passport" })).toBeNull();
    await advance(1); expect(sandbox.cheer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "See your Passport" })).toBeInTheDocument();
    expect(sandbox.navigate).not.toHaveBeenCalled();
    await advance((reduce ? 900 : 2600) - 1);
    expect(sandbox.navigate).not.toHaveBeenCalled();
    await advance(1);
    expect(sandbox.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/season-2" });
  });

  it("does not replay the stamp moment on an already-stamped page", async () => {
    sandbox.completed.push("smart-agreements", "chapter-ownership", "chapter-transactions", "chapter-defi"); sandbox.stamped = true;
    render(<MapPage />);
    expect(screen.getByRole("link", { name: "See your Passport" })).toBeInTheDocument();
    act(() => sandbox.arrived.get("city")?.(3));
    await advance(8000);
    expect(sandbox.cheer).not.toHaveBeenCalled();
    expect(sandbox.navigate).not.toHaveBeenCalled();
  });

  it("does not perch or play Season 2 before graduation, even with older chapters and stored Start", async () => {
    sandbox.graduated = false;
    sandbox.completed.push("smart-agreements", "chapter-ownership");
    localStorage.setItem("bloqvia:s2:sandbox.testnet", "1");
    render(<MapPage />);
    await advance(1000);
    expect(sandbox.perch).not.toHaveBeenCalled();
    act(() => sandbox.arrived.get("fields")?.(3));
    expect(sandbox.say).toHaveBeenLastCalledWith("Graduate in my shop first. Your sealed Passport opens Season 2.");
    fireEvent.click(screen.getByText("Play city"));
    expect(screen.queryByText("Close quiz")).toBeNull();
    expect(sandbox.say).toHaveBeenCalledTimes(2);
  });

  it("preserves access for an existing Season 2 stamp even without graduation", async () => {
    sandbox.graduated = false; sandbox.stamped = true;
    sandbox.completed.push("smart-agreements", "chapter-ownership");
    render(<MapPage />);
    fireEvent.click(screen.getByText("Play city"));
    expect(screen.getByText("Close quiz")).toBeInTheDocument();
  });
});