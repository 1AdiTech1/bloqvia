import { createFileRoute } from "@tanstack/react-router";
import { RevealPage } from "@/pages/RevealPage";

export const Route = createFileRoute("/reveal")({
  head: () => ({
    meta: [
      { title: "The reveal — Bloqvia" },
      { name: "description", content: "Everything you earned is yours." },
      { property: "og:title", content: "The reveal — Bloqvia" },
      { property: "og:description", content: "Everything you earned is yours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevealPage,
});
