import { createFileRoute } from "@tanstack/react-router";
import { MapPage } from "@/pages/MapPage";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Your journey — Bloqvia" },
      { name: "description", content: "Three quests on a winding garden path." },
      { property: "og:title", content: "Your journey — Bloqvia" },
      { property: "og:description", content: "Three quests on a winding garden path." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});
