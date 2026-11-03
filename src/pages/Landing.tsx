import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Mail, Sprout } from "lucide-react";
import { useGame } from "@/game/useGame";
import { Wordmark } from "@/components/Logo";
import { LeafDivider, VineLoader } from "@/components/VineLoader";

const features = [
  { icon: Mail, title: "Start with just an email", body: "No seed phrase, no app to install." },
  { icon: Sprout, title: "Play three quests, earn real items", body: "Every reward is really yours, not points in a database." },
  { icon: BadgeCheck, title: "Graduate with a Passport nobody can buy", body: "Your progress becomes a credential that can't be sold or faked." },
];

export function LandingPage() {
  const game = useGame();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const begin = async (e?: FormEvent) => {
    e?.preventDefault();
    if (game.accountId) return navigate({ to: "/map" });
    try {
      await game.start();
      navigate({ to: "/map" });
    } catch {
      /* error toast shows game.error */
    }
  };

  const scrollToForm = () => document.getElementById("email")?.focus();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-10">
          <Link to="/" aria-label="Bloqvia home"><Wordmark /></Link>
          {game.accountId ? (
            <Link
              to="/map"
              aria-label="Your profile"
              className="tap flex h-11 w-11 items-center justify-center rounded-full bg-leaf-gradient font-display text-lg font-bold text-primary-foreground shadow-soft"
            >
              {game.accountId[0].toUpperCase()}
            </Link>
          ) : (
            <button
              onClick={scrollToForm}
              className="tap rounded-full bg-sun-gradient px-5 font-semibold text-accent-foreground shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Start Learning
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-16 pt-16 text-center md:pt-28">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-moss">
            <Sprout className="h-4 w-4" /> A garden of a lesson
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.05] text-moss md:text-7xl">
            Learn Web3 by <span className="relative whitespace-nowrap">playing it.<svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M2 8 Q 50 0 100 6 T 198 4" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-sun" /></svg></span>
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground md:text-xl">
            No wallet, no jargon, real rewards. Three short quests, one merchant, a Passport that's yours.
          </p>

          <div className="mt-10 w-full max-w-md">
            {game.busy ? (
              <div className="card-organic p-6"><VineLoader label="Setting up your account…" /></div>
            ) : game.accountId ? (
              <Link to="/map" className="tap flex w-full items-center justify-center rounded-full bg-moss px-6 py-3 text-lg font-semibold text-primary-foreground shadow-lift">
                Continue your journey
              </Link>
            ) : (
              <form onSubmit={begin} className="card-organic flex flex-col gap-3 p-3 sm:flex-row">
                <label htmlFor="email" className="sr-only">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="tap flex-1 rounded-full bg-muted px-5 text-base outline-none ring-ring focus:ring-2"
                />
                <button type="submit" className="tap rounded-full bg-moss px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5">
                  Start Learning
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20 md:px-10">
          <div className="mb-12"><LeafDivider /></div>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card-organic p-7 md:p-8">
                <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.25rem_0.75rem] bg-sun-soft text-moss">
                  <Icon className="h-7 w-7" />
                </span>
                <h2 className="text-xl font-bold text-moss">{title}</h2>
                <p className="mt-2 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Built on NEAR · NEAR Hackathon 2026 ·{" "}
        <a href="https://github.com/your-org/bloqvia" target="_blank" rel="noreferrer" className="font-semibold text-moss underline-offset-4 hover:underline">
          Source code
        </a>
      </footer>
    </div>
  );
}
