import { describe, expect, it } from "vitest";
import { seasonProgress } from "./seasonProgress";
import { passportMrz } from "./Web3Passport";

describe("season presentation rules", () => {
  it("counts only the three founding quests for Season 1", () => {
    const progress = seasonProgress(["the-vault", "the-fuel-system", "daily-2026-11-07", "chapter-ownership"]);
    expect(progress.foundingDone).toEqual(["the-vault", "the-fuel-system"]);
    expect(progress.s1Done).toBe(false);
  });
  it("opens Season 2 only after all three founding quests", () => {
    expect(seasonProgress(["the-vault", "the-fuel-system", "smart-agreements"]).s1Done).toBe(true);
  });
  it("counts the three specified chapters independently of daily quests", () => {
    expect(seasonProgress(["chapter-ownership", "chapter-transactions", "chapter-defi", "daily-2026-11-07"]).chaptersDone).toBe(3);
  });
  it("adds the Season 2 MRZ suffix without replacing the level or graduation seal", () => {
    const [first, second] = passportMrz("learner.testnet", 3, true, ["season-2"]);
    expect(first).toBe("P<BLQ<LEARNER<TESTNET".padEnd(44, "<"));
    expect(second).toBe("NEP171<SOULBOUND<<LVL3<<".padEnd(34, "<") + "SEALED<<S2");
    expect(passportMrz("learner.testnet", 3, false, ["season-2"])[1]).toBe("NEP171<SOULBOUND<<LVL3<<".padEnd(34, "<") + "<<<<<<<<S2");
  });
  it("preserves the unstamped MRZ", () => {
    expect(passportMrz("learner.testnet", 2, false)[1]).toBe("NEP171<SOULBOUND<<LVL2<<".padEnd(44, "<"));
  });
});