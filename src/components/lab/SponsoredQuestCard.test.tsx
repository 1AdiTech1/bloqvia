import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SponsoredQuest } from "@/near";

const state = vi.hoisted(() => ({ quest: null as SponsoredQuest | null, done: false, loading: false, error: null, mock: false }));
vi.mock("@/near", () => ({ useSponsoredQuest: () => state, explorer: { tx: (hash: string) => `https://testnet.nearblocks.io/txns/${hash}` } }));
vi.mock("@/game/useGame", () => ({ get IS_MOCK() { return state.mock; }, useGame: () => ({ learner: { completed: [] } }) }));

import { SponsoredQuestCard } from "./SponsoredQuestCard";

const quest: SponsoredQuest = {
  lesson_id: "daily-2026-11-13-sponsored", title: "A paid slot", topic: "x402", concept: "A payment buys a slot, not a reward.",
  question: "Who pays the reward?", options: ["The contract", "The sponsor"], success: "Correct", near_reveal: "Checked on chain", explanation: "Contract rules apply",
  reward_gold: "50", reward_item: "fuel-cell", reward_item_amount: "1", sponsor: { name: "Bloqvia", url: null, house: true },
  slot: { paid_by: null, amount: "0.5", asset: "wNEAR", tx_hash: "payment", bought_at: "2026-11-13", price: "0.5 wNEAR", route: "/sponsor" }, written_by: "house", checked_by: "validator",
};
beforeEach(() => { state.quest = quest; state.done = false; state.loading = false; state.mock = false; });
afterEach(cleanup);

it("plays the sponsored lesson through the provided quiz action", () => {
  const play = vi.fn(); render(<SponsoredQuestCard onPlay={play} />);
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(play).toHaveBeenCalledExactlyOnceWith("daily-2026-11-13-sponsored");
});
it("does not offer another play after completion", () => {
  state.done = true; render(<SponsoredQuestCard onPlay={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
});
it.each(["no slot", "loading", "mock"])("does not offer a quest when %s", (kind) => {
  if (kind === "no slot") state.quest = null;
  if (kind === "loading") state.loading = true;
  if (kind === "mock") state.mock = true;
  const view = render(<SponsoredQuestCard onPlay={vi.fn()} />);
  expect(view.container.childElementCount).toBe(0);
});
it("links the sponsor payment to the testnet explorer", () => {
  render(<SponsoredQuestCard onPlay={vi.fn()} />);
  expect(screen.getByRole("link", { name: "explorer ↗" })).toHaveAttribute("href", "https://testnet.nearblocks.io/txns/payment");
});