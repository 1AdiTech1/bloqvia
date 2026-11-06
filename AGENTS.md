<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Brand primitives (Section, Eyebrow, Display, Illustration, CTA, Reveal) live in src/components/brand/ and colours come from tokens in src/styles.css; legacy token names (moss, sun, etc.) alias the new palette so un-restyled screens keep working.
- Landing v2 styles are plain `lv-*` classes in src/styles.css (@layer components), ported from docs/design/landing-v2; the landing drives Bloq only through the `@/bloq` public API.
- The Lab reuses the landing `lv-pass` styles through `src/components/lab/Web3Passport.tsx` (Shop ceremony, Passport page); keep one card implementation so both stay in sync.
