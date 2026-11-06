import { createFileRoute } from "@tanstack/react-router";
import { CohortPage } from "@/pages/CohortPage";

export const Route = createFileRoute("/cohort")({
  head: () => ({
    meta: [
      { title: "Missions — Bloqvia" },
      { name: "description", content: "Graduate bounties paid by the Bloqvia DAO on NEAR testnet." },
      { property: "og:title", content: "Missions — Bloqvia" },
      { property: "og:description", content: "Graduate bounties paid by the Bloqvia DAO on NEAR testnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CohortPage,
});
