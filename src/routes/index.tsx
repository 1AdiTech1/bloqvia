import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bloqvia — Learn Web3 by playing it" },
      { name: "description", content: "No wallet, no jargon, real rewards. Three short quests, one merchant, a Passport that's yours." },
      { property: "og:title", content: "Bloqvia — Learn Web3 by playing it" },
      { property: "og:description", content: "No wallet, no jargon, real rewards. Three short quests, one merchant, a Passport that's yours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
