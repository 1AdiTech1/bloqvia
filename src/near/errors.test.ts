import { describe, expect, it } from "vitest";
import { humanError, isWrongAnswer } from "./errors";

describe("isWrongAnswer", () => {
  it("knows the contract's refusal of a wrong quiz option, as the player sees it", () => {
    expect(isWrongAnswer("Wrong answer")).toBe(true);
    expect(isWrongAnswer("Wrong answer.")).toBe(true);
    expect(isWrongAnswer(humanError(new Error('{"ExecutionError":"Smart contract panicked: Wrong answer"}')))).toBe(true);
  });
  it("leaves every other message alone", () => {
    expect(isWrongAnswer(null)).toBe(false);
    expect(isWrongAnswer("")).toBe(false);
    expect(isWrongAnswer("Couldn't reach NEAR just now. Check your connection and try again.")).toBe(false);
    expect(isWrongAnswer("Unknown lesson.")).toBe(false);
  });
});

describe("old keys and over-selling", () => {
  it("read as plain sentences", () => {
    expect(humanError(new Error("Access key does not allow method claim_bounty"))).toMatch(/created before this feature existed/);
    expect(humanError(new Error("transfer: Balance of the sender is insufficient. The account learner-x.bloqvia.testnet does not have enough balance of contract-seal to withdraw 4 (has 3)"))).toBe("You don't have 4 Contract Seals to sell.");
  });
});
