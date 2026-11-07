import { createFileRoute } from "@tanstack/react-router";
import { Season2RevealPage } from "@/pages/RevealPage";

export const Route = createFileRoute("/season-2")({
  head: () => ({
    meta: [
      { title: "Season 2, stamped on NEAR — Bloqvia" },
      { name: "description", content: "Three chapters, one permanent Passport stamp. See your Season 2 journey on NEAR." },
      { property: "og:title", content: "Season 2, stamped on NEAR — Bloqvia" },
      { property: "og:description", content: "Three chapters, one permanent Passport stamp. See your Season 2 journey on NEAR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Season2RevealPage,
});