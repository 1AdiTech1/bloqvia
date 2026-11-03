import { createFileRoute } from "@tanstack/react-router";
import { BloqMark, BloqMarkAltA, BloqMarkAltB, Wordmark } from "@/components/Logo";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "Bloqvia — Brand marks" },
      { name: "description", content: "Internal review of Bloqvia logo marks." },
      { property: "og:title", content: "Bloqvia — Brand marks" },
      { property: "og:description", content: "Internal review of Bloqvia logo marks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrandPage,
});

const marks = [
  { name: "Primary — stacked blocks", M: BloqMark },
  { name: "Alternate A — spine", M: BloqMarkAltA },
  { name: "Alternate B — lifted middle", M: BloqMarkAltB },
];

function BrandPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <h1 className="font-display text-4xl font-medium uppercase">Brand marks</h1>
      <div className="mt-8 flex flex-wrap gap-6">
        <div className="rounded-3xl bg-ivory p-6 ring-1 ring-border"><Wordmark size={40} /></div>
        <div className="rounded-3xl bg-navy p-6"><Wordmark size={40} tone="lime" /></div>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {marks.map(({ name, M }) => (
          <section key={name} className="overflow-hidden rounded-3xl ring-1 ring-border">
            <div className="flex items-center justify-center gap-6 bg-ivory p-8"><M size={24} /><M size={40} /></div>
            <div className="flex items-center justify-center gap-6 bg-navy p-8"><M size={24} tone="lime" /><M size={40} tone="lime" /></div>
            <p className="p-4 text-sm font-medium">{name}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
