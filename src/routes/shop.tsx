import { createFileRoute } from "@tanstack/react-router";
import { ShopPage } from "@/pages/ShopPage";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Bloq's shop — Bloqvia" },
      { name: "description", content: "Trade with Bloq, the merchant whose prices move with every player." },
      { property: "og:title", content: "Bloq's shop — Bloqvia" },
      { property: "og:description", content: "Trade with Bloq, the merchant whose prices move with every player." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});
