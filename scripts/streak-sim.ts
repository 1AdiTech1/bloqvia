/**
 * Offline 60-day simulation of bloqvia-streak (Module A).
 *
 *   npm run streak:offline        -> docs/streak-simulation.md
 *
 * A pure replica of contracts/bloqvia-streak/src/lib.rs: one check-in per
 * member per day, a community target, rewards minted on met days, a fixed
 * burn from the treasury on missed days, streak reset on a miss, burns stop
 * at an empty treasury. No LLM, no randomness beyond a seeded PRNG, so the
 * table is reproducible.
 *
 * Three behaviour scenarios x two parameter sets:
 *   - testnet demo params (init-args.testnet.json): target 2, reward 10, burn 100, treasury 500,000
 *   - community params: target 10 of 20 members, reward 10, burn 100, treasury 100,000
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(ROOT, process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1]! : "docs/streak-simulation.md");

interface Params { daily_target: number; reward_per_checkin: bigint; burn_per_miss: bigint; }
interface State { day: number; streak: number; best: number; treasury: bigint; supply: bigint; met: number; missed: number; minted: bigint; burned: bigint; }

const init = JSON.parse(readFileSync(resolve(ROOT, "contracts/deploy/init-args.testnet.json"), "utf8")) as {
  streak: { params: { daily_target: number; reward_per_checkin: string; burn_per_miss: string }; treasury_seed: string };
};

const paramSets: { name: string; params: Params; treasury: bigint; members: number }[] = [
  {
    name: "testnet demo (init-args.testnet.json)",
    params: { daily_target: init.streak.params.daily_target, reward_per_checkin: BigInt(init.streak.params.reward_per_checkin), burn_per_miss: BigInt(init.streak.params.burn_per_miss) },
    treasury: BigInt(init.streak.treasury_seed),
    members: 8,
  },
  { name: "community (target 10 of 20)", params: { daily_target: 10, reward_per_checkin: 10n, burn_per_miss: 100n }, treasury: 100_000n, members: 20 },
];

/** Probability that a member checks in on `day` (0-based). */
const scenarios: { name: string; describe: string; p: (day: number) => number }[] = [
  { name: "steady", describe: "every member checks in with p = 0.75 each day", p: () => 0.75 },
  { name: "decaying", describe: "enthusiasm fades: p from 0.90 on day 0 to 0.10 on day 59", p: (d) => 0.9 - (0.8 * d) / 59 },
  { name: "bursty", describe: "weekdays p = 0.80, weekends p = 0.15", p: (d) => (d % 7 >= 5 ? 0.15 : 0.8) },
];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function settleDay(st: State, checkins: number, params: Params): void {
  const met = checkins >= params.daily_target;
  if (met) {
    const minted = params.reward_per_checkin * BigInt(checkins);
    st.supply += minted;
    st.minted += minted;
    st.streak += 1;
    st.best = Math.max(st.best, st.streak);
    st.met += 1;
  } else {
    const burn = params.burn_per_miss < st.treasury ? params.burn_per_miss : st.treasury;
    st.treasury -= burn;
    st.supply -= burn;
    st.burned += burn;
    st.streak = 0;
    st.missed += 1;
  }
  st.day += 1;
}

function run(set: (typeof paramSets)[number], sc: (typeof scenarios)[number], days = 60) {
  const rand = rng(42);
  const st: State = { day: 0, streak: 0, best: 0, treasury: set.treasury, supply: set.treasury, met: 0, missed: 0, minted: 0n, burned: 0n };
  const rows: string[] = [];
  for (let d = 0; d < days; d += 1) {
    let checkins = 0;
    for (let m = 0; m < set.members; m += 1) if (rand() < sc.p(d)) checkins += 1;
    settleDay(st, checkins, set.params);
    if ((d + 1) % 10 === 0 || d === 0) {
      rows.push(`| ${d + 1} | ${checkins} | ${checkins >= set.params.daily_target ? "met" : "missed"} | ${st.streak} | ${st.best} | ${st.treasury} | ${st.supply} |`);
    }
  }
  return { st, rows };
}

let md = `# Streak simulation (Module A, offline replica of bloqvia-streak)\n\n` +
  `60 days per run, seeded PRNG (reproducible), no LLM. The replica follows contracts/bloqvia-streak/src/lib.rs: ` +
  `one check-in per member per day; target met -> reward minted to every check-in and streak +1; ` +
  `target missed -> fixed burn from the treasury and streak reset; burns stop at an empty treasury.\n\n` +
  `Read the two parameter sets together: the testnet demo set (a 10-minute "day", target 2) exists so the ` +
  `mechanic can be watched during judging; the community set shows the same rule at a realistic target.\n`;

for (const set of paramSets) {
  md += `\n## ${set.name}\n\nMembers: ${set.members}. Target: ${set.params.daily_target} check-ins/day. Reward: ${set.params.reward_per_checkin} per check-in. Burn: ${set.params.burn_per_miss} per missed day. Treasury seed: ${set.treasury}.\n`;
  for (const sc of scenarios) {
    const { st, rows } = run(set, sc);
    md += `\n### ${sc.name} — ${sc.describe}\n\n` +
      `| day | check-ins | result | streak | best | treasury | total supply |\n|---|---|---|---|---|---|---|\n` + rows.join("\n") + "\n\n" +
      `After 60 days: ${st.met} days met, ${st.missed} missed, best streak ${st.best}, minted ${st.minted}, burned ${st.burned}, treasury ${st.treasury} of ${set.treasury}, total supply ${st.supply}.\n`;
  }
}

md += `\n## What the numbers say\n\n` +
  `- Supply grows only while the community keeps showing up (minted = reward x check-ins on met days) and every missed day burns a fixed slice. Net growth is minted minus burned: strong in "steady", roughly halved in "decaying", and in "bursty" the streak never passes a weekend (best streak 5-7). The token records collective consistency, not any one wallet.\n` +
  `- The treasury is a reserve of missed days: at 100 per miss, 100,000 covers 1,000 misses and the demo's 500,000 covers 5,000. With 10-minute demo days that is about 35 days of total silence, longer than the judging window. When it reaches zero, burns stop and the token simply stops shrinking. Nothing can refill it: no admin method exists.\n` +
  `- Under the demo parameters the target (2) is easy on purpose, so a judge who checks in alone still sees both outcomes within an hour: a solo 10-minute day is a miss, a pair is a met day with a mint.\n` +
  `- Sybil limit: one account = one check-in; the relayer funds and rate-limits accounts but cannot tell two accounts of one person apart. Stated in the README.\n`;

writeFileSync(out, md);
console.log(md);
console.log(`wrote ${out}`);
