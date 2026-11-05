import { createFileRoute } from "@tanstack/react-router";
import { CohortPage } from "@/pages/CohortPage";

export const Route = createFileRoute("/cohort")({
  head: () => ({
    meta: [
      { title: "Cohort board — Bloqvia" },
      { name: "description", content: "Graduate bounties paid by the Bloqvia cohort DAO on NEAR testnet." },
      { property: "og:title", content: "Cohort board — Bloqvia" },
      { property: "og:description", content: "Graduate bounties paid by the Bloqvia cohort DAO on NEAR testnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CohortPage,
});
