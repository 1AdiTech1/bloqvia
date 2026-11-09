import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const sandbox = vi.hoisted(() => ({ stamped: true, navigate: vi.fn(), signOut: vi.fn() }));
vi.mock("@/game/useGame", () => ({ useGame: () => ({
  accountId: "sandbox.testnet",
  learner: { graduated: true, completed: ["chapter-ownership", "chapter-transactions", "chapter-defi"] },
  passport: { owner_id: "sandbox.testnet", level: 3, graduated: true, stamps: sandbox.stamped ? ["season-2"] : [] },
  explorer: { account: () => "https://example.test/account", passport: () => "https://example.test/passport" },
  exportSecretKey: () => null, signOut: sandbox.signOut,
}) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => sandbox.navigate }));
vi.mock("@/near", () => ({
  useChapters: () => ({ chapters: [] }),
  SEASON2_CHAPTERS: ["chapter-ownership", "chapter-transactions", "chapter-defi"],
  season2Done: () => sandbox.stamped,
  useBloqvia: () => ({ txLog: [
    { kind: "buy", ref: "chapter-ownership", url: "https://example.test/wrong-kind" },
    { kind: "quest", ref: "chapter-ownership", url: "https://example.test/ownership" },
    { kind: "quest", ref: "chapter-defi", url: "https://example.test/stamp" },
  ] }),
}));
vi.mock("@/components/PhoneShell", () => ({ PhoneShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/RequireAccount", () => ({ RequireAccount: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/bloq", () => ({ Bloq: () => null, SpeechBubble: () => null, useSay: () => [null, () => {}], talkMs: () => 0, useMotionOff: () => false }));
vi.mock("@/components/lab/Web3Passport", () => ({ Web3Passport: () => null, SeasonStamp: () => null }));

import { Season2RevealPage } from "./RevealPage";
beforeEach(() => { vi.useFakeTimers(); sandbox.stamped = true; sandbox.navigate.mockClear(); sandbox.signOut.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("redirects an unstamped Passport to the map", () => {
  sandbox.stamped = false;
  render(<Season2RevealPage />);
  expect(sandbox.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/map", replace: true });
});
it("links each completed chapter to its quest transaction, or the account when absent", () => {
  render(<Season2RevealPage />);
  expect(screen.getAllByRole("link", { name: "View transaction" }).map((link) => link.getAttribute("href"))).toEqual([
    "https://example.test/ownership", "https://example.test/account", "https://example.test/stamp",
  ]);
});
it("offers no reset button, only Back to the map", () => {
  render(<Season2RevealPage />);
  expect(screen.queryByRole("button", { name: /Start again|Play again/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Back to the map/ }));
  expect(sandbox.signOut).not.toHaveBeenCalled();
  expect(sandbox.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/map", hash: "keep-going" });
});