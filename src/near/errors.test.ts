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
