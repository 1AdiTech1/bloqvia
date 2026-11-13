import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { AfterSeasons } from "@/near";
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("./PlayAgainSheet", () => ({ PlayAgainSheet: () => null }));
import { AfterSeasonsCard } from "./AfterSeasonsCard";
afterEach(cleanup);

it.each([false, true])("only offers sponsored play when available and unfinished (available: %s)", (available) => {
  const after: AfterSeasons = { active: true, ready: true, next: "sponsored", streak: { available: false, done: false }, daily: { available: false, done: false, lessonId: null }, sponsored: { available, done: false, lessonId: null }, missions: { available: true, done: true }, tourStarted: true, startTour: vi.fn() };
  const play = vi.fn();
  const view = render(<AfterSeasonsCard after={after} onCheckIn={vi.fn()} onPlay={vi.fn()} onPlaySponsored={play} />);
  if (available) {
    fireEvent.click(screen.getByRole("button", { name: "Play ↑" }));
    expect(play).toHaveBeenCalledTimes(1);
    view.rerender(<AfterSeasonsCard after={{ ...after, sponsored: { ...after.sponsored, done: true } }} onCheckIn={vi.fn()} onPlay={vi.fn()} onPlaySponsored={play} />);
  }
  expect(screen.queryByRole("button", { name: "Play ↑" })).toBeNull();
});