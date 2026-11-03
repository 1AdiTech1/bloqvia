import { createFileRoute } from "@tanstack/react-router";
import { PassportPage } from "@/pages/PassportPage";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Your Passport — Bloqvia" },
      { name: "description", content: "Your progress as a credential that can't be sold or faked." },
      { property: "og:title", content: "Your Passport — Bloqvia" },
      { property: "og:description", content: "Your progress as a credential that can't be sold or faked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportPage,
});
