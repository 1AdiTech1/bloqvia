// @ts-nocheck — drawing engine ported 1:1 from the approved preview; the typed surface is Bloq.tsx.
/*
 * Bloq rig — the puppet engine behind <Bloq/>. Do not edit by hand; change the preview and port again.
 *
 * Browser-only: nothing here touches window/document until a BloqRig is constructed (SSR-safe import).
 * One shared requestAnimationFrame loop drives every rig on the page; rigs off screen are skipped and the
 * loop stops when no rig is mounted.
 */
const engine = (function () {
  const C = { ink: "#1b1622", p: "#8b45d9", pd: "#6630b3", pl: "#b47ff0", l: "#d4f033", ld: "#a6c21a", w: "#ffffff", sh: "#ebe5f6" };
  const { ink: INK, p: P, pd: PD, pl: PL, l: L, ld: LD, w: W, sh: SH } = C;
  const o = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
  const o5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const RAD = Math.PI / 180;
  let uid = 0;

  /* Block head: a soft rounded cube. The back face is offset up-right by 14 so the top and
     the right side show; two short edges join the corners. Round head kept as an option. */
  const HEAD_BLOCK = `
      <rect x="90" y="40" width="150" height="148" rx="38" fill="url(#bq-side)" ${o}/>
      <path d="M87.1 65.1 L101.1 51.1 L228.9 176.9 L214.9 190.9 Z" fill="url(#bq-side)"/>
      <path d="M87.1 65.1 L101.1 51.1 M214.9 190.9 L228.9 176.9" fill="none" ${o}/>
      <rect x="76" y="54" width="150" height="148" rx="38" fill="url(#bq-face)" ${o}/>
      <path d="M90 104 C89 80 98 68 118 66" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".95"/>
      <path d="M120 45 C150 42 190 42 214 47" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  const HEAD_BLOCK_SIDE = `
      <rect x="62" y="40" width="150" height="148" rx="38" fill="url(#bq-side)" ${o}/>
      <path d="M214.9 65.1 L200.9 51.1 L73.1 176.9 L87.1 190.9 Z" fill="url(#bq-side)"/>
      <path d="M214.9 65.1 L200.9 51.1 M87.1 190.9 L73.1 176.9" fill="none" ${o}/>
      <rect x="76" y="54" width="150" height="148" rx="38" fill="url(#bq-face)" ${o}/>
      <path d="M90 104 C89 80 98 68 118 66" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".95"/>
      <path d="M86 45 C112 42 152 42 184 47" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  const HEAD_ROUND = `
      <path d="M150 40 C198 38 234 72 233 118 C232 166 198 203 154 202 C108 201 72 170 72 126 C72 80 104 42 150 40 Z" fill="url(#bq-face)" ${o}/>
      <path d="M88 108 C88 82 100 64 122 56" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".95"/>`;

  /* Hats are drawn on the head's top and scaled up around the brow line (152,100). */
  const HAT_SCALE = { moto: 1.04, astro: 1.0, tophat: 1.32, aviator: 1.42, agent: 1.12, cap2: 1.3, captain: 1.5, grad: 1.56, bucket: 1.42, surf: 1.42, beanie: 1.32, hardhat: 1.32, detective: 1.32, beret: 1.3, cap: 1.3 };
  const HATS = {
    cap: `<path d="M82 98 C58 99 32 113 25 136 C47 144 82 132 106 110 Z" fill="${PD}" ${o}/>
          <path d="M74 106 C68 60 102 31 150 28 C202 27 233 58 231 101 C196 89 112 92 74 106 Z" fill="${P}" ${o}/>
          <path d="M84 100 C114 90 186 86 228 96" fill="none" stroke="${PD}" stroke-width="5" opacity=".7"/>
          <path d="M100 54 C111 41 128 35 145 33" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M176 40 C191 39 207 50 211 64 C199 71 183 68 172 58 Z" fill="${L}" ${o5}/>
          <ellipse cx="150" cy="30" rx="7" ry="5.5" fill="${P}" ${o5}/>`,
    bucket: `<path d="M93 88 C91 44 118 26 151 25 C186 25 212 42 211 88 Z" fill="${P}" ${o}/>
          <path d="M104 46 C112 36 124 31 136 29" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M56 94 C58 80 108 76 152 76 C200 76 246 81 248 95 C249 108 204 111 152 111 C102 111 55 107 56 94 Z" fill="${PD}" ${o}/>
          <path d="M98 82 C132 75 176 75 208 82" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 6" opacity=".5"/>
          <path d="M114 44 a9 9 0 1 1 10 0 l3 16 h-16 Z" fill="${L}" ${o5}/>`,
    beanie: `<path d="M73 98 C70 48 106 22 152 21 C199 21 234 47 231 98 Z" fill="${P}" ${o}/>
          <path d="M96 44 C108 32 124 26 140 24" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M66 86 C110 73 196 73 238 86 L237 106 C194 94 110 95 67 107 Z" fill="${L}" ${o}/>
          <path d="M70 97 C112 85 192 84 234 96" fill="none" stroke="${PD}" stroke-width="5"/>
          <path d="M139 18 C138 8 148 3 155 5 C164 7 168 16 164 24 C160 31 146 32 141 26 Z" fill="${L}" ${o}/>`,
    captain: `<path d="M92 78 C130 86 176 87 212 78 L210 98 C176 104 130 105 94 98 Z" fill="${L}" ${o}/>
          <path d="M98 97 C126 112 184 112 212 96 C186 104 126 105 98 97 Z" fill="${INK}" ${o5}/>
          <path d="M66 69 C64 46 120 40 154 40 C196 40 240 45 238 68 C237 87 66 88 66 69 Z" fill="${P}" ${o}/>
          <path d="M92 56 C120 48 170 46 210 52" fill="none" stroke="${PL}" stroke-width="5" stroke-linecap="round"/>
          <path d="M72 76 C120 84 190 84 232 74" fill="none" stroke="${PD}" stroke-width="4" opacity=".7"/>
          <circle cx="152" cy="64" r="9" fill="${L}" ${o5}/>`,
    hardhat: `<path d="M80 98 C78 46 111 26 152 26 C193 26 226 46 224 98 Z" fill="${P}" ${o}/>
          <path d="M145 28 L158 28 L161 96 L143 96 Z" fill="${L}" ${o5}/>
          <path d="M100 52 C110 41 121 35 133 32" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M59 101 C58 90 108 88 152 88 C198 88 246 90 245 100 C245 112 198 112 152 112 C106 112 60 112 59 101 Z" fill="${PD}" ${o}/>`,
    beret: `<path d="M62 92 C47 61 111 23 176 29 C240 36 251 78 228 94 C186 105 108 104 62 92 Z" fill="${P}" ${o}/>
          <path d="M92 56 C112 42 140 36 166 36" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M80 92 C120 99 190 99 226 90" fill="none" stroke="${PD}" stroke-width="5" opacity=".7"/>
          <path d="M172 30 C171 20 179 13 188 15" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
          <circle cx="190" cy="15" r="5" fill="${L}" ${o5}/>`,
    detective: `<path d="M80 100 C78 47 113 28 152 28 C191 28 226 47 224 100 Z" fill="${P}" ${o}/>
          <path d="M152 31 C151 52 152 76 152 98 M116 42 C108 62 106 82 108 100 M190 42 C198 62 200 82 198 100" fill="none" stroke="${PD}" stroke-width="3.5"/>
          <path d="M104 52 C110 42 118 36 128 33" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M150 96 C196 89 241 94 250 108 C228 119 188 114 150 104 Z" fill="${PD}" ${o}/>
          <ellipse cx="138" cy="26" rx="12" ry="7" fill="${L}" ${o5} transform="rotate(-24 138 26)"/>
          <ellipse cx="166" cy="26" rx="12" ry="7" fill="${L}" ${o5} transform="rotate(24 166 26)"/>`,
    cap2: `<g class="v-front">
          <path d="M78 98 C74 56 106 30 152 28 C198 27 230 56 226 98 C190 90 114 90 78 98 Z" fill="${P}" ${o}/>
          <path d="M98 52 C110 40 126 34 142 32" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <rect x="142" y="48" width="20" height="8" rx="4" fill="${L}" ${o5}/><rect x="140" y="59" width="24" height="8" rx="4" fill="${LD}" ${o5}/><rect x="138" y="70" width="28" height="8" rx="4" fill="${L}" ${o5}/>
          <path d="M80 94 C110 104 194 104 224 94 C218 104 190 111 152 111 C116 111 88 104 80 94 Z" fill="${L}" ${o}/>
          <path d="M98 101 C124 106 180 106 206 101" fill="none" stroke="${LD}" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="152" cy="30" rx="7" ry="5.5" fill="${L}" ${o5}/>
        </g><g class="v-side"><path d="M76 104 C72 58 104 30 152 28 C200 27 230 56 228 100 C190 90 112 92 76 104 Z" fill="${P}" ${o}/>
          <path d="M98 52 C110 40 126 34 142 32" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M152 30 C150 50 150 74 152 94" fill="none" stroke="${PD}" stroke-width="3.5" opacity=".8"/>
          <rect x="166" y="52" width="20" height="8" rx="4" fill="${L}" ${o5}/><rect x="166" y="63" width="24" height="8" rx="4" fill="${LD}" ${o5}/><rect x="166" y="74" width="28" height="8" rx="4" fill="${L}" ${o5}/>
          <path d="M200 90 C228 86 258 92 270 106 C252 116 222 115 198 107 Z" fill="${L}" ${o}/>
          <path d="M206 96 C228 94 248 98 258 104" fill="none" stroke="${LD}" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="152" cy="30" rx="7" ry="5.5" fill="${L}" ${o5}/></g>`,
    agent: `<path d="M152 4 L152 24" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
          <circle class="bq-led" cx="152" cy="2" r="8" fill="${L}" ${o5}/>
          <path d="M70 112 C64 48 104 22 152 22 C200 22 240 48 234 112" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
          <path d="M70 112 C64 48 104 22 152 22 C200 22 240 48 234 112" fill="none" stroke="${P}" stroke-width="10" stroke-linecap="round"/>
          <path d="M96 40 C112 30 128 26 146 25" fill="none" stroke="${PL}" stroke-width="4" stroke-linecap="round"/>
          <rect x="52" y="96" width="30" height="46" rx="12" fill="${P}" ${o}/><rect x="58" y="104" width="14" height="30" rx="6" fill="${L}"/>
          <rect x="222" y="96" width="30" height="46" rx="12" fill="${P}" ${o}/><rect x="232" y="104" width="14" height="30" rx="6" fill="${L}"/>
          <path d="M238 138 C238 166 220 176 196 174" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
          <circle cx="192" cy="174" r="7" fill="${L}" ${o5}/>`,
    moto: `<g class="v-front">
          <path d="M60 162 C50 82 94 20 152 20 C210 20 256 82 246 162 L246 174 C246 184 232 186 226 178 L222 122 C220 102 206 92 186 90 L118 90 C98 92 86 102 84 122 L80 178 C74 186 60 184 60 174 Z" fill="${P}" ${o}/>
          <path d="M152 24 C152 44 152 64 152 88" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
          <path d="M152 24 C152 44 152 64 152 88" fill="none" stroke="${L}" stroke-width="12" stroke-linecap="round"/>
          <path d="M88 104 C108 86 196 86 218 104" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/>
          <path d="M84 70 C94 48 112 34 132 28" fill="none" stroke="${PL}" stroke-width="7" stroke-linecap="round"/>
          <circle cx="70" cy="150" r="7" fill="${L}" ${o5}/><circle cx="236" cy="150" r="7" fill="${L}" ${o5}/>
        </g><g class="v-side">
          <path d="M64 166 C54 82 98 20 160 20 C208 20 240 50 246 94 L202 98 C190 100 184 112 184 126 L186 182 C176 190 72 190 64 166 Z" fill="${P}" ${o}/>
          <path d="M80 60 C110 30 170 24 214 44" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/>
          <path d="M80 60 C110 30 170 24 214 44" fill="none" stroke="${L}" stroke-width="10" stroke-linecap="round"/>
          <path d="M190 104 C198 98 222 96 244 100" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/>
          <circle cx="120" cy="136" r="9" fill="${L}" ${o5}/>
        </g>`,
    // tech space helmet: smooth shell with circuit traces, a HUD visor pushed up, sensor pods with
    // ring lights at the ears and a glowing sensor fin along the top
    // tech space helmet: smooth shell to the cheeks, a HUD visor with a charging bar, sensor pods with
    // ring lights at the ears and a glowing sensor fin on top
    astro: `<path d="M134 18 C140 4 164 4 170 18 L166 30 L138 30 Z" fill="url(#bq-pdg)" ${o5}/>
          <rect class="bq-scan" x="144" y="10" width="16" height="5" rx="2.5" fill="${L}"/>
          <path d="M54 168 C42 80 92 20 152 20 C212 20 262 80 250 168 C248 184 236 190 222 186 L208 124 C208 104 194 92 174 90 L130 90 C110 92 96 104 96 124 L82 186 C68 190 56 184 54 168 Z" fill="url(#bq-wg)" ${o}/>
          <path d="M84 178 L96 124 C96 104 110 92 130 92 L174 92 C194 92 208 104 208 124 L220 178" fill="none" stroke="url(#bq-pdg)" stroke-width="9" stroke-linecap="round"/>
          <path d="M64 112 L64 96 L80 84 M240 112 L240 96 L224 84" fill="none" stroke="${P}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
          <circle cx="80" cy="84" r="3" fill="${P}"/><circle cx="224" cy="84" r="3" fill="${P}"/>
          <path d="M80 66 C96 44 120 35 146 33" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".85"/>
          <path d="M80 72 C100 40 204 40 224 72 L218 84 C190 70 114 70 86 84 Z" fill="#1b1622" fill-opacity=".88" ${o5}/>
          <circle class="bq-charge" style="animation-delay:0.00s" cx="108.0" cy="66.5" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.16s" cx="122.6" cy="64.3" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.32s" cx="137.2" cy="62.9" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.48s" cx="151.8" cy="62.5" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.64s" cx="166.4" cy="62.9" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.80s" cx="181.0" cy="64.3" r="3.6" fill="${L}"/><circle class="bq-charge" style="animation-delay:0.96s" cx="195.6" cy="66.5" r="3.6" fill="${L}"/>
          <path d="M96 56 C120 46 150 44 172 46" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
          <rect x="40" y="100" width="24" height="44" rx="10" fill="url(#bq-pdg)" ${o}/><rect x="240" y="100" width="24" height="44" rx="10" fill="url(#bq-pdg)" ${o}/>
          <circle class="bq-ring" cx="52" cy="122" r="6.5" fill="none" stroke="${L}" stroke-width="3"/><circle class="bq-ring" cx="252" cy="122" r="6.5" fill="none" stroke="${L}" stroke-width="3"/>
          <circle cx="52" cy="122" r="2.5" fill="${L}"/><circle cx="252" cy="122" r="2.5" fill="${L}"/>`,
    // the merchant's top hat (Bloq runs the shop)
    tophat: `<path d="M100 96 L107 14 C130 7 176 7 199 14 L206 96 Z" fill="${P}" ${o}/>
          <ellipse cx="153" cy="14" rx="46" ry="9" fill="${PL}" ${o5}/>
          <path d="M103 70 C134 76 172 76 203 70 L205 88 C172 94 134 94 102 88 Z" fill="${L}" ${o5}/>
          <rect x="182" y="72" width="13" height="16" rx="3" fill="${PD}" ${o5}/>
          <path d="M118 28 C120 46 120 60 118 66" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M58 100 C60 86 108 84 152 84 C198 84 246 86 248 100 C247 112 198 114 152 114 C106 114 58 112 58 100 Z" fill="${PD}" ${o}/>`,
    // the explorer's aviator cap: ear flaps and lime goggles up on the forehead
    aviator: `<path d="M76 108 C70 52 108 24 152 24 C196 24 234 52 228 108 Z" fill="${P}" ${o}/>
          <path d="M78 98 C76 124 72 150 76 172 C86 178 96 172 98 160 L98 104 Z" fill="${P}" ${o}/>
          <path d="M226 98 C228 124 232 150 228 172 C218 178 208 172 206 160 L206 104 Z" fill="${P}" ${o}/>
          <path d="M98 46 C112 34 128 28 144 27" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M152 26 C151 46 151 70 152 100" fill="none" stroke="${PD}" stroke-width="3.5" opacity=".8"/>
          <path d="M80 70 C110 62 194 62 224 70" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
          <circle cx="126" cy="68" r="17" fill="${L}" fill-opacity=".92" ${o}/><circle cx="180" cy="68" r="17" fill="${L}" fill-opacity=".92" ${o}/>
          <path d="M118 62 l7 -6 M172 62 l7 -6" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          <circle cx="87" cy="168" r="4" fill="${L}"/><circle cx="217" cy="168" r="4" fill="${L}"/>`,
    surf: `<path d="M93 88 C91 44 118 26 151 25 C186 25 212 42 211 88 Z" fill="${P}" ${o}/>
          <path d="M94 70 C130 62 176 62 210 70 L211 86 C176 80 130 80 93 86 Z" fill="${L}" ${o5}/>
          <path d="M104 46 C112 36 124 31 136 29" fill="none" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>
          <path d="M56 94 C58 80 108 76 152 76 C200 76 246 81 248 95 C249 108 204 111 152 111 C102 111 55 107 56 94 Z" fill="${PD}" ${o}/>`,
    grad: `<path d="M100 70 L101 100 C134 112 170 112 204 100 L204 70 Z" fill="${PD}" ${o}/>
          <path d="M54 64 L152 33 L250 63 L152 95 Z" fill="${P}" ${o}/>
          <path d="M80 62 L150 41" fill="none" stroke="${PL}" stroke-width="5" stroke-linecap="round"/>
          <path d="M152 64 L86 78 C85 88 86 100 86 110" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
          <path d="M152 64 L86 78 C85 88 86 100 86 110" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>
          <path d="M80 106 h13 l2 20 h-17 Z" fill="${L}" ${o5}/>
          <circle cx="152" cy="64" r="6" fill="${L}" ${o5}/>`,
  };

  /* Props sit upright at the front wrist; the object is above the hand. */
  const PROPS = {
    star: `<path d="M0 -70 L8 -52 L28 -50 L13 -37 L18 -17 L0 -28 L-18 -17 L-13 -37 L-28 -50 L-8 -52 Z" fill="${L}" ${o5}/>
          <path d="M0 -70 L0 -40 L28 -50 M0 -40 L18 -17 M0 -40 L-18 -17 M0 -40 L-28 -50" fill="none" stroke="${LD}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M0 -40 L8 -52 L28 -50 Z M0 -40 L-18 -17 L0 -28 Z" fill="${P}" opacity=".55"/>`,
    chip: `<rect x="-20" y="-66" width="40" height="40" rx="8" fill="${P}" ${o5}/>
          <rect x="-11" y="-57" width="22" height="22" rx="4" fill="${L}" ${o5}/>
          <path d="M-14 -70 v-6 M-4 -70 v-6 M6 -70 v-6 M16 -70 v-6 M-14 -22 v6 M-4 -22 v6 M6 -22 v6 M16 -22 v6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
          <text x="0" y="-41" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="12" fill="${INK}">AI</text>`,
    thumb: `<path d="M-1 -4 C-3 -12 -1 -24 5 -25 C11 -26 12 -16 10 -6" fill="${W}" ${o5}/>`,
    key: `<rect x="-4" y="-34" width="8" height="30" rx="3" fill="${L}" ${o5}/><path d="M4 -16 h8 M4 -24 h6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
          <circle cx="0" cy="-46" r="13" fill="${L}" ${o5}/><circle cx="0" cy="-46" r="4.5" fill="${INK}"/>`,
    fuel: `<rect x="-6" y="-70" width="12" height="8" rx="2" fill="${INK}"/><rect x="-15" y="-64" width="30" height="46" rx="7" fill="${L}" ${o5}/>
          <path d="M8 -58 v34" stroke="${LD}" stroke-width="5" stroke-linecap="round"/><path d="M3 -56 L-6 -40 H2 L-3 -26 L8 -44 H0 Z" fill="${INK}"/>`,
    scroll: `<path d="M-19 -62 C-19 -66 -15 -67 -12 -67 L15 -66 C18 -66 20 -63 19 -60 L18 -21 C18 -18 15 -17 12 -17 L-14 -18 C-17 -18 -19 -20 -19 -23 Z" fill="${W}" ${o5}/>
          <path d="M-10 -54 h20 M-10 -45 h14" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
          <path d="M-9 -34 l6 6 l12 -14" fill="none" stroke="${PD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    bulb: `<rect x="-8" y="-28" width="16" height="13" rx="3" fill="#cfd3da" ${o5}/>
          <circle cx="0" cy="-45" r="17" fill="${L}" ${o5}/><path d="M-6 -40 l3 -8 l3 6 l3 -6 l3 8" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    cube: `<path d="M0 -66 L22 -54 L0 -42 L-22 -54 Z" fill="${PL}" ${o5}/>
          <path d="M-22 -54 L0 -42 L0 -16 L-22 -28 Z" fill="${P}" ${o5}/>
          <path d="M22 -54 L0 -42 L0 -16 L22 -28 Z" fill="${PD}" ${o5}/>`,
    magnifier: `<path d="M2 -6 L12 -30" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
          <circle cx="18" cy="-46" r="17" fill="${W}" fill-opacity=".35" stroke="${INK}" stroke-width="13"/>
          <circle cx="18" cy="-46" r="17" fill="none" stroke="${L}" stroke-width="6"/>`,
    passport: `<rect x="-19" y="-72" width="38" height="52" rx="5" fill="${P}" ${o5}/>
          <circle cx="0" cy="-48" r="10" fill="none" stroke="${L}" stroke-width="3"/><path d="M-10 -48 h20 M0 -58 c-6 6 -6 14 0 20 c6 -6 6 -14 0 -20" fill="none" stroke="${L}" stroke-width="2"/>
          <path d="M-10 -64 h20" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
    badge: `<path d="M-8 -34 L-15 -10 L-7 -14 L-3 -6 L2 -30 Z M8 -34 L15 -10 L7 -14 L3 -6 L-2 -30 Z" fill="${P}" ${o5}/>
          <circle cx="0" cy="-46" r="17" fill="${L}" ${o5}/><path d="M0 -56 l3 7 h7 l-5.5 4.5 l2 7 l-6.5 -4 l-6.5 4 l2 -7 l-5.5 -4.5 h7 Z" fill="${INK}"/>`,
    coin: `<circle cx="0" cy="-44" r="18" fill="${L}" ${o5}/><circle cx="0" cy="-44" r="11" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".55"/>
          <path d="M-3 -51 h5 a4 3.5 0 0 1 0 7 h-5 Z M-3 -44 h6 a4 3.5 0 0 1 0 7 h-6 Z" fill="none" stroke="${INK}" stroke-width="2.5"/>`,
  };
  const GLOWS = new Set(["star", "chip", "key", "fuel", "scroll", "bulb", "cube", "magnifier", "passport", "badge", "coin"]);

  /* Pose targets in degrees. 0 = limb hanging down; negative swings forward (toward +x). */
  const POSES = {
    idle:    { s: -14, e: 16, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    thumbs:  { s: -124, e: -36, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    wave:    { s: -125, e: -25, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    point:   { s: -90, e: 2, bs: 14, be: -116, hl: 10, hr: -6, kl: 0, kr: 4 },
    hold:    { s: -96, e: -50, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    present: { s: -58, e: -20, bs: 14, be: -116, hl: 9, hr: -7, kl: 0, kr: 3 },
    cheer:   { s: -132, e: -12, bs: 116, be: 34, hl: 4, hr: -4, kl: 0, kr: 0 },
    walk:    { s: -6, e: 14, bs: 6, be: 14, hl: 0, hr: 0, kl: 0, kr: 0 },
    // sitting on a ledge, facing you: thighs come toward you (drawn short), shins hang down
    sit:     { s: -24, e: 2, bs: 21, be: -6, hl: 58, hr: -58, kl: -52, kr: 52, tl: 0.55 },
    // riding: knees bent, arms out for balance (the loop adds the wobbles)
    ride:    { s: -86, e: -8, bs: 86, be: 8, hl: 22, hr: -22, kl: -30, kr: 30, tl: 0.85 },
    // on the motorbike (side view): thighs forward to the seat, shins back to the pegs, hands on the bars
    bike:    { s: -70, e: 30, bs: -64, be: 28, hl: -70, hr: -66, kl: 80, kr: 74, tl: 1 },
    // zero gravity: reaching forward for the star, legs trailing
    space:   { s: -122, e: -8, bs: 64, be: -30, hl: 26, hr: -8, kl: 34, kr: 44, tl: 1 },
    board:   { s: -42, e: 8, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    boardwave: { s: -42, e: 8, bs: 116, be: 34, hl: 8, hr: -8, kl: 0, kr: 0 },
  };
  const KEYS = ["s", "e", "bs", "be", "hl", "hr", "kl", "kr", "tl"];
  Object.values(POSES).forEach((p) => { if (p.tl == null) p.tl = 1; });

  /* Joint positions for each view. Side view: hips and shoulders close together, back arm behind the body. */
  const RIG = {
    front: { hipL: [141, 286], hipR: [163, 286], shF: [176, 216], shB: [131, 216] },
    side:  { hipL: [147, 286], hipR: [158, 286], shF: [160, 217], shB: [150, 214] },
  };

  const dir = (deg) => [-Math.sin(deg * RAD), Math.cos(deg * RAD)];
  const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
  const f = (n) => n.toFixed(1);
  /* A limb as one curve through the joint: no corner at elbow or knee. */
  function limb(a, j, b) {
    const c = [2 * j[0] - (a[0] + b[0]) / 2, 2 * j[1] - (a[1] + b[1]) / 2];
    return `M${f(a[0])} ${f(a[1])} Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
  }

  const shoe = `<path d="M-38 19 C-41 3 -24 -9 -6 -8 C9 -7 16 4 14 18 C5 26 -29 27 -38 19 Z" fill="${L}" ${o}/>
      <path d="M-35 16 C-22 21 -2 21 11 16" fill="none" stroke="${LD}" stroke-width="5" stroke-linecap="round"/>
      <path d="M-24 3 C-18 -1 -10 -2 -4 -1" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" opacity=".9"/>`;
  const shoeOut = `<g class="v-front">${shoe}</g><g class="v-side"><g transform="scale(-1 1)">${shoe}</g></g>`;
  const hand = `<path d="M-11 -5 C-15 5 -9 16 0 17 C10 17 15 8 13 -2 C11 -10 -8 -12 -11 -5 Z" fill="${W}" ${o5}/>
      <path d="M11 1 C18 0 19 8 12 10" fill="${W}" ${o5}/>`;

  /* Faces. Smile: corners lifted above the middle of the upper lip, a hint of teeth, a dimple at each corner.
     Laugh: wider and deeper, cheeks push the eyes into happy arcs. */
  const faceFront = `
    <ellipse cx="121" cy="153" rx="11" ry="6.5" fill="#e9b8e6" opacity=".55"/><ellipse cx="191" cy="151" rx="11" ry="6.5" fill="#e9b8e6" opacity=".55"/>
    <g data-r="brows"><path d="M124 101 q10 -6 21 0 M162 99 q11 -7 22 1" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/></g>
    <g data-r="eyes">
      <g class="bq-open">
        <g data-r="eyeL"><ellipse cx="136" cy="126" rx="7.3" ry="11.3" fill="${INK}" transform="rotate(-4 136 126)"/><circle cx="138.5" cy="121" r="2.6" fill="${W}"/></g>
        <g data-r="eyeR"><ellipse cx="172.5" cy="126" rx="7.9" ry="12.2" fill="${INK}" transform="rotate(5 172 126)"/><circle cx="175" cy="120.5" r="2.8" fill="${W}"/></g>
      </g>
      <g class="bq-squint"><path d="M127 130 C131 119 142 119 146 129 M163 129 C167 117 180 117 184 128" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
    </g>
    <g class="bq-m bq-m-smile">
      <path d="M129 146 C141 154 168 154 181 144 C182 165 169 180 155 180 C140 180 128 165 129 146 Z" fill="${INK}"/>
      <path d="M135 150 C147 157 165 157 176 149 C175 153 174 155 172 156 C161 162 147 162 137 156 C136 154 135 152 135 150 Z" fill="${W}"/>
      <path d="M142 173 C148 165 162 165 167 172 C161 178 148 179 142 173 Z" fill="${L}"/>
      <path d="M125 141 C124 145 125 149 128 151 M185 139 C186 143 185 147 182 149" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g class="bq-m bq-m-laugh">
      <path d="M122 140 C138 153 172 153 189 137 C191 168 175 193 156 193 C136 193 119 170 122 140 Z" fill="${INK}"/>
      <path d="M130 146 C146 157 168 157 183 144 C182 149 180 152 177 154 C164 163 146 163 134 155 C132 152 131 149 130 146 Z" fill="${W}"/>
      <path d="M139 183 C147 171 166 171 173 181 C164 190 147 190 139 183 Z" fill="${L}"/>
      <path d="M117 136 C115 141 117 147 121 149 M193 132 C195 137 194 143 190 145" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g class="bq-m bq-m-o"><path d="M147 156 C146 148 163 147 164 156 C165 167 159 174 155 174 C150 174 147 166 147 156 Z" fill="${INK}"/></g>
    <g class="bq-m bq-m-talk"><path d="M135 151 C146 157 165 157 176 149 C175 163 166 171 155 171 C144 171 136 163 135 151 Z" fill="${INK}"/><path d="M145 166 C150 161 160 161 164 166 C159 170 150 170 145 166 Z" fill="${L}"/></g>`;
  const faceSide = `
    <ellipse cx="196" cy="152" rx="10" ry="6" fill="#e9b8e6" opacity=".55"/>
    <g data-r="browS"><path d="M187 100 q10 -6 20 2" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/></g>
    <g data-r="eyeS">
      <g class="bq-open"><ellipse cx="198" cy="125" rx="7.2" ry="11.6" fill="${INK}" transform="rotate(4 198 125)"/><circle cx="200.5" cy="119.5" r="2.7" fill="${W}"/></g>
      <g class="bq-squint"><path d="M189 129 C193 118 204 118 207 128" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
    </g>
    <g class="bq-m bq-m-smile">
      <path d="M186 148 C198 155 214 153 227 142 C227 161 215 175 202 175 C192 174 186 163 186 148 Z" fill="${INK}"/>
      <path d="M190 151 C201 157 214 155 224 147 C223 151 221 153 219 154 C210 160 199 160 192 156 Z" fill="${W}"/>
      <path d="M195 169 C200 163 210 163 214 168 C209 173 200 174 195 169 Z" fill="${L}"/>
      <path d="M182 143 C181 147 182 151 185 153" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g class="bq-m bq-m-laugh">
      <path d="M182 144 C197 155 218 151 231 136 C233 162 219 186 203 186 C190 186 181 169 182 144 Z" fill="${INK}"/>
      <path d="M187 148 C200 157 216 154 228 142 C227 147 225 150 222 152 C211 160 198 161 190 156 Z" fill="${W}"/>
      <path d="M193 178 C199 169 212 169 217 176 C211 183 199 184 193 178 Z" fill="${L}"/>
    </g>
    <g class="bq-m bq-m-o"><path d="M207 156 C207 149 219 149 219 157 C219 166 214 171 212 171 C208 171 206 164 207 156 Z" fill="${INK}"/></g>
    <g class="bq-m bq-m-talk"><path d="M190 150 C200 155 214 153 224 145 C224 159 214 168 203 168 C195 168 190 160 190 150 Z" fill="${INK}"/></g>`;

  function svg(id) {
    const hats = Object.entries(HATS).map(([k, d]) => `<g class="bq-hat" data-hat="${k}"><g transform="translate(152 100) scale(${HAT_SCALE[k] || 1.3}) translate(-152 -100)">${d}</g></g>`).join("");
    const props = Object.entries(PROPS).map(([k, d]) => `<g class="bq-prop" data-prop="${k}">${d}</g>`).join("");
    return premium(`<svg viewBox="0 0 300 400" class="bq" aria-hidden="true" focusable="false">
  <defs><clipPath id="bd${id}"><path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z"/></clipPath></defs>
  <ellipse class="bq-shadow" cx="152" cy="385" rx="70" ry="10" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" cx="154" cy="300" rx="52" ry="7" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" data-r="footShL" rx="20" ry="7" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" data-r="footShR" rx="20" ry="7" filter="url(#bq-soft)"/>
  <g class="bq-speed"><path d="M128 392 l-4 14 M152 394 l0 16 M176 392 l4 14" stroke="${L}" stroke-width="6" stroke-linecap="round"/></g>
  <g data-r="rideboard" class="bq-rideboard">
    <path d="M70 400 L58 416 L86 402 Z" fill="${INK}"/>
    <path d="M34 392 C38 382 110 381 156 381 C214 381 264 385 278 392 C264 400 214 403 156 403 C110 403 38 402 34 392 Z" fill="url(#bq-pg)" ${o}/>
    <path d="M96 383 L116 383 L104 402 L84 402 Z M196 383 L216 383 L204 402 L184 402 Z" fill="url(#bq-lg)"/>
    <path d="M60 387 C110 384 200 384 250 387" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <path d="M34 392 C38 382 110 381 156 381 C214 381 264 385 278 392 C264 400 214 403 156 403 C110 403 38 402 34 392 Z" fill="none" ${o}/>
  </g>
  <g class="bq-all">
    <g class="bq-bike">
      <g class="puffs"><circle cx="46" cy="330" r="7"/><circle cx="34" cy="322" r="9"/><circle cx="20" cy="312" r="11"/></g>
      <path d="M70 334 L150 330" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M70 334 L150 330" stroke="#cfd3da" stroke-width="6" stroke-linecap="round"/>
      <g class="wheel" style="transform-origin:88px 352px"><circle cx="88" cy="352" r="32" fill="#2a2338" ${o}/><circle cx="88" cy="352" r="17" fill="url(#bq-lg)" ${o5}/><path d="M88 335 V369 M71 352 H105 M76 340 L100 364 M100 340 L76 364" stroke="${INK}" stroke-width="3"/></g>
      <g class="wheel" style="transform-origin:238px 352px"><circle cx="238" cy="352" r="32" fill="#2a2338" ${o}/><circle cx="238" cy="352" r="17" fill="url(#bq-lg)" ${o5}/><path d="M238 335 V369 M221 352 H255 M226 340 L250 364 M250 340 L226 364" stroke="${INK}" stroke-width="3"/></g>
      <path d="M56 336 C60 312 84 304 110 312" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M56 336 C60 312 84 304 110 312" fill="none" stroke="${PD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M88 352 L132 304 L206 292 M206 292 L238 352" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M88 352 L132 304 L206 292 M206 292 L238 352" fill="none" stroke="${P}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="128" y="306" width="52" height="34" rx="8" fill="#cfd3da" ${o5}/><path d="M138 316 h32 M138 324 h32 M138 332 h32" stroke="${INK}" stroke-width="2.5" opacity=".5"/>
      <path d="M118 300 C128 276 196 268 216 282 L208 308 C182 316 140 316 120 308 Z" fill="${P}" ${o}/>
      <path d="M140 286 C160 278 186 276 202 280" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 292 C106 282 150 282 160 290 L156 300 L104 300 Z" fill="${INK}"/>
      <path d="M214 298 L226 250" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M216 246 L238 254" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="244" cy="276" r="11" fill="url(#bq-lg)" ${o5}/>
      <path d="M210 316 C222 306 252 306 266 320" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M210 316 C222 306 252 306 266 320" fill="none" stroke="${PD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M160 336 L184 338" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g class="v-side"><path data-r="armBS" fill="none" ${o}/><g data-r="handBS">${hand}</g></g>
    <path data-r="legL" fill="none" ${o}/><g data-r="shoeL">${shoeOut}</g>
    <path data-r="legR" fill="none" ${o}/><g data-r="shoeR"><g class="v-front"><g transform="scale(-1 1)">${shoe}</g></g><g class="v-side"><g transform="scale(-1 1)">${shoe}</g></g></g>
    <g data-r="torso">
      <g data-r="pack">
        <path d="M100 212 C91 193 121 185 138 197 C147 233 147 266 136 285 C114 295 91 283 89 262 C87 246 93 228 100 212 Z" fill="${P}" ${o}/>
        <path d="M93 245 C103 253 122 255 137 247" fill="none" stroke="${PD}" stroke-width="4"/>
        <path d="M92 258 C96 276 112 286 132 282" fill="none" stroke="${PD}" stroke-width="8" stroke-linecap="round" opacity=".55"/>
        <path d="M104 214 C108 206 116 202 124 202" fill="none" stroke="${PL}" stroke-width="5" stroke-linecap="round"/>
        <path d="M108 252 C108 262 112 268 117 270" fill="none" stroke="${L}" stroke-width="5" stroke-linecap="round"/>
        <g class="bq-agentwear"><rect x="98" y="222" width="30" height="20" rx="5" fill="${INK}"/>
          <circle class="bq-led" cx="106" cy="232" r="3.5" fill="${L}"/><circle class="bq-led l2" cx="113" cy="232" r="3.5" fill="${L}"/><circle class="bq-led l3" cx="120" cy="232" r="3.5" fill="${L}"/></g>
      </g>
      <g class="v-front">
        <path d="M134 197 C125 230 125 270 136 291 C147 303 170 302 178 290 C187 262 183 222 174 197 Z" fill="${W}" ${o}/>
        <path d="M168 206 C178 232 180 262 172 287 C166 293 158 295 150 295 C163 278 169 246 168 206 Z" fill="${SH}"/>
        <path d="M138 200 C150 214 166 214 176 200" fill="none" stroke="#3a2a5c" stroke-width="10" stroke-linecap="round" opacity=".12"/>
        <path d="M118 204 C138 200 156 218 158 247" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
        <path d="M118 204 C138 200 156 218 158 247" fill="none" stroke="${P}" stroke-width="7" stroke-linecap="round"/>
      </g>
      <g class="v-side">
        <path d="M139 197 C130 230 132 270 141 291 C151 302 170 300 174 288 C180 262 178 222 168 197 Z" fill="${W}" ${o}/>
        <path d="M163 206 C173 232 175 262 168 286 C163 292 157 294 151 294 C162 278 165 246 163 206 Z" fill="${SH}"/>
        <path d="M126 203 C146 197 160 210 163 236" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
        <path d="M126 203 C146 197 160 210 163 236" fill="none" stroke="${P}" stroke-width="7" stroke-linecap="round"/>
      </g>
    </g>
    <g class="bq-board">
      <path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z" fill="${P}" ${o}/>
      <g clip-path="url(#bd${id})"><path d="M214 214 L292 168 L292 200 L214 246 Z M214 298 L292 252 L292 280 L214 326 Z" fill="${L}"/></g>
      <path d="M250 160 C252 220 252 300 250 376" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".45"/>
      <path d="M241 186 C235 224 235 262 238 300" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z" fill="none" ${o}/>
    </g>
    <g data-r="head">
      <g class="head-block"><g class="v-front">${HEAD_BLOCK}</g><g class="v-side">${HEAD_BLOCK_SIDE}</g></g><g class="head-round">${HEAD_ROUND}</g>
      <g class="v-front">${faceFront}</g>
      <g class="v-side">${faceSide}</g>
      <g data-r="hats">${hats}</g>
    </g>
    <g class="v-front"><path data-r="armB" fill="none" ${o}/><g data-r="handB">${hand}</g></g>
    <g data-r="up">
      <circle class="bq-glow" cx="0" cy="-44" r="40" fill="url(#bq-glow)"/>
      <g class="bq-props">${props}</g>
      <g class="bq-shine"><path d="M22 -74 l5 -9"/><path d="M32 -60 l9 -4"/><path d="M8 -82 l1 -10"/></g>
    </g>
    <path data-r="armF" fill="none" ${o}/>
    <g data-r="handF"><g class="bq-finger"><path d="M-4 12 C-6 22 -3 31 1 31 C5 31 7 22 4 12" fill="${W}" ${o5}/></g>${hand}</g>
  </g>
</svg>`);
  }
  /* The premium layer: soft vertical gradients on every purple, lime and white surface (vinyl-toy look). */
  function premium(m) {
    return m.split(`fill="${P}"`).join('fill="url(#bq-pg)"')
      .split(`fill="${PD}"`).join('fill="url(#bq-pdg)"')
      .split(`fill="${L}"`).join('fill="url(#bq-lg)"')
      .split(`fill="${W}" ${o}`).join(`fill="url(#bq-wg)" ${o}`)
      .split(`fill="${W}" ${o5}`).join(`fill="url(#bq-wg)" ${o5}`);
  }

  function defs() {
    if (document.getElementById("bq-defs")) return;
    const d = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    d.id = "bq-defs"; d.setAttribute("width", "0"); d.setAttribute("height", "0"); d.style.position = "absolute";
    d.innerHTML = `<defs>
      <radialGradient id="bq-glow"><stop offset="0" stop-color="${L}" stop-opacity=".85"/><stop offset=".45" stop-color="${L}" stop-opacity=".35"/><stop offset="1" stop-color="${L}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bq-pg" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#a86df0"/><stop offset=".55" stop-color="#8b45d9"/><stop offset="1" stop-color="#6d33c2"/></linearGradient>
      <linearGradient id="bq-pdg" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#7d42cc"/><stop offset="1" stop-color="#4e2392"/></linearGradient>
      <linearGradient id="bq-lg" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#ebfb7a"/><stop offset=".55" stop-color="#d4f033"/><stop offset="1" stop-color="#b3cd1c"/></linearGradient>
      <linearGradient id="bq-wg" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece6f7"/></linearGradient>
      <linearGradient id="bq-face" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#faf8fe"/><stop offset="1" stop-color="#e3d9f4"/></linearGradient>
      <linearGradient id="bq-side" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f3fe"/><stop offset=".5" stop-color="#ddd2f1"/><stop offset="1" stop-color="#b3a3d8"/></linearGradient>
      <filter id="bq-soft" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3.5"/></filter>
    </defs>`;
    document.body.prepend(d);
  }

  const rigs = new Set();
  const still = () => document.body.classList.contains("still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  let headShape = "block";

  class Bloq {
    constructor(host, opts = {}) {
      defs();
      this.id = ++uid;
      this.host = host;
      host.classList.add("bq-host");
      host.innerHTML = `<div class="bq-flip">${svg(this.id)}</div>`;
      this.flip = host.firstElementChild;
      this.el = this.flip.firstElementChild;
      this.r = {};
      this.el.querySelectorAll("[data-r]").forEach((n) => (this.r[n.dataset.r] = n));
      this.all = this.el.querySelector(".bq-all");
      this.cur = {}; this.vel = {};
      KEYS.forEach((k) => { this.cur[k] = POSES.idle[k]; this.vel[k] = 0; });
      this.look_ = { x: 0, y: 0, tx: 0, ty: 0 };
      this.hatLag = { a: 0, v: 0, y: 0, vy: 0 };
      this.brow = { y: 0, ty: 0 };
      this.t = Math.random() * 10; this.walkPhase = 0; this.blinkAt = 1 + Math.random() * 3; this.blink = 0;
      this.jumpT = -1; this.turnT = -1; this.sitT = -1; this.view = "front";
      this.hat = null; this.prop = null;
      this.setHat(opts.hat || "cap", false);
      this.setProp(opts.prop || null, false);
      this.setPose(opts.pose || "idle", true);
      this.setMood("smile");
      this.setHead(opts.head || headShape);
      this.setOutfit(opts.outfit || null);
      this.talkLeft = 0;
      this.face(opts.face || "right");
      this.visible = true;
      if ("IntersectionObserver" in window) { this._io = new IntersectionObserver((es) => (this.visible = es[0].isIntersecting), { rootMargin: "120px" }); this._io.observe(host); }
      rigs.add(this);
      ensureLoop();
      this._draw(0);
    }
    setPose(p, snap = false) {
      if (!POSES[p]) p = "idle";
      this.pose = p; this.target = POSES[p];
      this.el.classList.toggle("pointing", p === "point");
      if (p === "sit" && !this.el.classList.contains("sitting") && !still()) this.sitT = 0;
      this.el.classList.toggle("sitting", p === "sit");
      this.el.classList.toggle("riding", p === "ride");
      this.el.classList.toggle("biking", p === "bike");
      this.el.classList.toggle("spacing", p === "space");
      if (p === "bike") this.setView("side");
      else if (!this.isWalking && this.view === "side") this.setView("front");
      if (snap || still()) KEYS.forEach((k) => { this.cur[k] = this.target[k]; this.vel[k] = 0; });
      return this;
    }
    setMood(m, ms) {
      clearTimeout(this._moodT);
      this.el.dataset.mood = m;
      this.brow.ty = m === "o" ? -7 : m === "laugh" ? -4 : 0;
      if (ms) this._moodT = setTimeout(() => this.setMood("smile"), ms);
      return this;
    }
    setHat(h, animate = true) {
      if (h === this.hat) return this;
      const q = (k) => this.el.querySelector(`.bq-hat[data-hat="${k}"]`);
      const old = this.hat && q(this.hat), nu = q(h);
      this.hat = h;
      this.el.querySelectorAll(".bq-hat").forEach((g) => g.classList.toggle("on", g === nu));
      if (animate && !still()) {
        this.setMood("o", 560);
        if (old) {
          old.classList.add("leaving");
          old.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: "translate(-44px,-130px) rotate(-40deg)", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.8,.4)" })
            .onfinish = () => old.classList.remove("leaving");
        }
        nu.animate([{ transform: "translate(0,-150px) rotate(16deg)", opacity: 0 }, { transform: "translate(0,-150px) rotate(16deg)", opacity: 1, offset: 0.3 }, { transform: "translate(0,7px) rotate(-4deg)", offset: 0.78 }, { transform: "translate(0,0) rotate(0)" }],
          { duration: 680, easing: "cubic-bezier(.3,.7,.4,1)" });
        this.hatLag.vy -= 3;
      }
      return this;
    }
    setProp(p, animate = true) {
      if (p === this.prop) return this;
      this.prop = p;
      this.el.querySelectorAll(".bq-prop").forEach((g) => g.classList.toggle("on", g.dataset.prop === p));
      this.el.classList.toggle("has-glow", GLOWS.has(p));
      const nu = p && this.el.querySelector(`.bq-prop[data-prop="${p}"]`);
      if (nu && animate && !still()) nu.animate([{ transform: "scale(0) rotate(-30deg)" }, { transform: "scale(1.22) rotate(8deg)", offset: 0.6 }, { transform: "scale(1) rotate(0)" }], { duration: 480, easing: "ease-out" });
      return this;
    }
    /** Front view or side view (head, body and backpack turn together). */
    setView(v) {
      if (v === this.view) return this;
      this.view = v;
      this.el.classList.toggle("side", v === "side");
      if (!still()) this.turnT = 0;
      return this;
    }
    face(d) { this.facing = d; this.flip.classList.toggle("left", d === "left"); return this; }
    look(dx, dy) { this.look_.tx = dx * (this.facing === "left" ? -1 : 1); this.look_.ty = dy; return this; }
    walking(on) {
      this.isWalking = on;
      this.setView(on ? "side" : "front");
      if (on) this.setPose("walk");
      return this;
    }
    jump() {
      if (still()) return this;
      this._before = this.pose === "cheer" ? "idle" : this.pose;
      this.setPose(this.outfit === "surf" ? "boardwave" : "cheer").setMood("laugh", 1100);
      this.jumpT = 0;
      return this;
    }
    /** Unmount: stop drawing, drop timers and observers, empty the host. */
    destroy() {
      rigs.delete(this); this._io?.disconnect();
      clearTimeout(this._moodT); clearTimeout(this._jumpT);
      this.host.innerHTML = ""; this.host.classList.remove("bq-host");
    }
    setHead(shape) { this.headShape = shape; this.el.classList.toggle("h-round", shape === "round"); return this; }
    /** "surf": board shorts and a surfboard at his side. */
    setOutfit(o) { this.outfit = o; this.el.classList.toggle("outfit-surf", o === "surf"); this.el.classList.toggle("outfit-agent", o === "agent"); this.el.classList.toggle("outfit-astro", o === "astro"); return this; }
    /** Point the front arm at an element and keep aiming while it moves (layout changes, scroll). null stops. */
    aimAt(el) { this.aimEl = el; if (el) this.setPose("point"); return this; }
    _aim() {
      const el = this.aimEl; if (!el || !el.isConnected) return;
      const m = this.el.getScreenCTM(); if (!m) return;
      const r = el.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const me = this.el.getBoundingClientRect();
      const want = tx < me.left + me.width / 2 ? "left" : "right";
      if (want !== this.facing) { this.face(want); return; } // turn first, aim next frame
      const pt = new DOMPoint(tx, ty).matrixTransform(m.inverse());
      const sh = [176, 216], vx = pt.x - sh[0], vy = pt.y - sh[1];
      const ang = Math.atan2(-vx, vy) / RAD;   // dir(ang) points from the shoulder at the target
      this.target = { ...POSES.point, s: Math.max(-170, Math.min(-10, ang)), e: 0 };
      this.look_.tx = 0.6; this.look_.ty = Math.max(-1, Math.min(1, vy / 200));
    }
    /** While riding: start losing balance now. */
    wobble() { if (this.ride && this.ride.ev < 0) this.ride.next = 0; return this; }
    /** While riding: wave with the front arm (true/false). */
    rideWave(on) { this.rideWaving = on; return this; }
    /** Lip-flap for ms milliseconds, then back to a smile. */
    talk(ms = 2400) { this.talkLeft = ms / 1000; return this; }

    _step(dt) {
      if (this.aimEl) this._aim();
      const k = 150, c = 15; // a little underdamped: moves overshoot and settle
      KEYS.forEach((key) => {
        const a = k * (this.target[key] - this.cur[key]) - c * this.vel[key];
        this.vel[key] += a * dt; this.cur[key] += this.vel[key] * dt;
      });
      const L_ = this.look_;
      L_.x += (L_.tx - L_.x) * Math.min(1, dt * 8); L_.y += (L_.ty - L_.y) * Math.min(1, dt * 8);
      this.brow.y += (this.brow.ty - this.brow.y) * Math.min(1, dt * 12);
      this.blinkAt -= dt;
      if (this.blinkAt <= 0) { this.blink = 0.14; this.blinkAt = 2.2 + Math.random() * 3.4; if (Math.random() < 0.22) this.blinkAt = 0.32; }
      this.blink = Math.max(0, this.blink - dt);
      if (this.jumpT >= 0) { this.jumpT += dt / 0.78; if (this.jumpT >= 1) { this.jumpT = -1; this.setPose(this._before || "idle"); } }
      if (this.turnT >= 0) { this.turnT += dt / 0.22; if (this.turnT >= 1) this.turnT = -1; }
      if (this.sitT >= 0) { this.sitT += dt / 0.45; if (this.sitT >= 1) this.sitT = -1; }
      if (this.talkLeft > 0) {
        this.talkLeft -= dt;
        const m = this.talkLeft > 0 && Math.sin(this.t * 26) > -0.2 ? "talk" : "smile";
        if (this.el.dataset.mood !== m && this.el.dataset.mood !== "laugh") this.el.dataset.mood = m;
      }
    }

    _draw(dt) {
      const live = !still();
      if (live) this._step(dt); else { KEYS.forEach((key) => (this.cur[key] = this.target[key])); this.blink = 0; this.jumpT = -1; this.turnT = -1; }
      this.t += dt;
      const t = this.t, a = { ...this.cur }, r = this.r, side = this.view === "side", J = RIG[this.view];
      const floaty = this.el.classList.contains("floaty");

      let bodyY = 0, lean = 0, breath = live ? Math.sin(t * 1.8) * 0.018 : 0, headTilt = live ? Math.sin(t * 1.15) * 2.4 : 0;
      if (this.isWalking && live) {
        this.walkPhase += dt * (Math.PI * 2 / 0.62);
        const ph = this.walkPhase, s = Math.sin(ph), cph = Math.cos(ph);
        a.hl += -26 * s; a.hr += 26 * s;
        a.kl += 36 * Math.max(0, cph); a.kr += 36 * Math.max(0, -cph);
        a.s += 26 * s; a.e += 12 * Math.max(0, s);
        a.bs += -26 * s; a.be += 12 * Math.max(0, -s);
        bodyY = -6 * Math.abs(cph); lean = -5; headTilt += 2 * Math.sin(ph * 2);
      }
      if (this.pose === "wave" && live) { a.e += 26 * Math.sin(t * 7.5); headTilt += 4; }
      if (this.pose === "cheer" && live) { a.s += 8 * Math.sin(t * 9); a.bs -= 8 * Math.sin(t * 9); }
      if (this.pose === "boardwave" && live) { a.be += 24 * Math.sin(t * 7.5); headTilt -= 3; }
      this._rideTilt = 0;
      if (this.pose === "ride" && live) {
        const Rd = this.ride || (this.ride = { next: 2.5 + Math.random() * 2, ev: -1, dir: 1 });
        let tilt = 4 * Math.sin(t * 1.1) + 1.8 * Math.sin(t * 2.7);          // the wave rocks the board
        let extraLean = 0, arms = 0, hop = 0;
        a.s += 9 * Math.sin(t * 2.2); a.bs -= 9 * Math.sin(t * 2.2 + 0.7);     // small balancing flutters
        a.kl += 6 * Math.sin(t * 2.2); a.kr -= 6 * Math.sin(t * 2.2 + 0.4);
        Rd.next -= dt;
        if (Rd.next <= 0 && Rd.ev < 0) { Rd.ev = 0; Rd.dir = Math.random() < 0.5 ? -1 : 1; Rd.splashed = false; this.setMood("o"); }
        if (Rd.ev >= 0) {
          Rd.ev += dt / 1.7;
          const e = Rd.ev, ease = (x) => x * x * (3 - 2 * x);
          if (e < 0.55) {                                      // losing it: board tips, he leans too far, arms windmill
            const q = ease(e / 0.55);
            tilt += Rd.dir * 13 * q; extraLean = Rd.dir * 16 * q; arms = 46 * q;
            a.kl += 14 * q; a.kr -= 14 * q;
          } else if (e < 0.82) {                               // the save: a hop that recentres him on the board
            const q = (e - 0.55) / 0.27;
            tilt += Rd.dir * 13 * (1 - ease(q)); extraLean = Rd.dir * 16 * (1 - ease(q)); arms = 46 * (1 - q);
            hop = -30 * Math.sin(Math.PI * q);
            a.kl -= 20 * Math.sin(Math.PI * q); a.kr += 20 * Math.sin(Math.PI * q);
            if (!Rd.splashed) { Rd.splashed = true; this.host.dispatchEvent(new CustomEvent("bloq:splash", { detail: { dir: Rd.dir } })); }
          } else {                                             // landed: knees soak it up, he grins
            const q = (e - 0.82) / 0.18;
            a.kl += 18 * Math.sin(Math.PI * q); a.kr -= 18 * Math.sin(Math.PI * q);
            if (this.el.dataset.mood === "o") this.setMood("laugh", 900);
          }
          if (Rd.ev >= 1) { Rd.ev = -1; Rd.next = 3.5 + Math.random() * 4; }
        }
        a.s += arms * Math.sin(t * 13); a.bs += arms * Math.sin(t * 13 + Math.PI);
        if (this.rideWaving) { a.s = -140; a.e = -20 + 26 * Math.sin(t * 7.5); }
        lean = -0.55 * tilt + extraLean;
        headTilt += -0.4 * tilt;
        bodyY += hop;
        this._rideTilt = tilt;
      }
      if (this.pose === "bike" && live) {
        bodyY += 1.1 * Math.sin(t * 38);                       // engine rumble
        lean = 9 + 1.5 * Math.sin(t * 1.4); headTilt += 1.5 * Math.sin(t * 2.1);
        a.s += 3 * Math.sin(t * 1.4); a.bs += 3 * Math.sin(t * 1.4);
      }
      if (this.pose === "space" && live) {
        bodyY += -14 - 12 * Math.sin(t * 0.9);                 // weightless drift
        this._spaceRot = -8 + 7 * Math.sin(t * 0.55);
        a.s += 7 * Math.sin(t * 1.1); a.bs -= 9 * Math.sin(t * 0.8 + 1);
        a.kl += 10 * Math.sin(t * 0.9); a.kr += 10 * Math.sin(t * 0.9 + 1.4); a.hl += 6 * Math.sin(t * 0.7);
        headTilt += 3 * Math.sin(t * 0.6);
      } else this._spaceRot = 0;
      if (this.pose === "sit" && live) {
        a.kl += 12 * Math.sin(t * 3.1); a.kr += 12 * Math.sin(t * 3.1 + 1.7);   // happy kicking
        lean = 2.5 + Math.sin(t * 1.3) * 1.5;                                    // sways while he sits
        if (this.talkLeft > 0) { a.s = -78 + 12 * Math.sin(t * 5.2); a.e = -40 + 9 * Math.sin(t * 4.1); lean = -3; headTilt += 3 * Math.sin(t * 2.6); }
        if (this.sitT >= 0) {                                                      // land: bottom squashes, settles
          const q = this.sitT; bodyY += 7 * Math.sin(Math.PI * Math.min(1, q * 1.6)) * (1 - q);
          a.kl -= 20 * (1 - q); a.kr += 20 * (1 - q);
        }
      }
      if (floaty && live) { bodyY = -10 - 9 * Math.sin(t * 2.1); a.kl += 14 + 6 * Math.sin(t * 2.1 + 1); a.kr += 22 + 6 * Math.sin(t * 2.1); a.hl += -6; a.hr += 2; }
      else if (live && !this.isWalking) bodyY += Math.sin(t * 1.8) * -2;

      let sx = 1, sy = 1;
      if (this.jumpT >= 0) {
        const j = this.jumpT;
        if (j < 0.16) { const q = j / 0.16; bodyY += 8 * q; sx = 1 + 0.08 * q; sy = 1 - 0.09 * q; a.kl += 30 * q; a.kr += 30 * q; }
        else if (j < 0.82) { const q = (j - 0.16) / 0.66; bodyY += 8 - 92 * Math.sin(Math.PI * q) - 8 * q; sx = 0.95; sy = 1.06; a.kl += 40 * Math.sin(Math.PI * q); a.kr += 46 * Math.sin(Math.PI * q); a.hl -= 14 * Math.sin(Math.PI * q); a.hr -= 10 * Math.sin(Math.PI * q); }
        else { const q = (j - 0.82) / 0.18; bodyY += 6 * (1 - q); sx = 1 + 0.07 * (1 - q); sy = 1 - 0.08 * (1 - q); a.kl += 24 * (1 - q); a.kr += 24 * (1 - q); }
      }
      // turning between views: a quick squash, like a head turn in a cartoon
      if (this.turnT >= 0) sx *= 1 - 0.16 * Math.sin(Math.PI * this.turnT);
      if (this.pose === "sit" && this.sitT >= 0) { const q = this.sitT; sy *= 1 - 0.07 * Math.sin(Math.PI * q) ; sx *= 1 + 0.05 * Math.sin(Math.PI * q); }
      let rideRot = this.pose === "space" ? (this._spaceRot || 0) : 0;
      if (this.pose === "ride") {
        // keep the shoes on the board whatever the knees do, and rock both with the wave
        const ank = (H, ha, ka) => add(add(H, dir(ha), 34 * a.tl), dir(ha + ka), 33)[1];
        const A = (ank(RIG.front.hipL, a.hl, a.kl) + ank(RIG.front.hipR, a.hr, a.kr)) / 2;
        const bob = live ? 3 * Math.sin(t * 1.8) : 0;
        bodyY += 383 - (A + 24) + bob;
        rideRot = this._rideTilt || 0;
        r.rideboard.setAttribute("transform", `rotate(${f(rideRot)} 156 392) translate(0 ${f(bob)})`);
      }
      this.all.setAttribute("transform", `rotate(${f(rideRot)} 156 392) translate(152 384) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-152 ${f(-384 + bodyY)})`);

      const hip = [152, 288];
      const T = (p) => { const x = p[0] - hip[0], y = (p[1] - hip[1]) * (1 + breath), c_ = Math.cos(lean * RAD), s_ = Math.sin(lean * RAD); return [hip[0] + x * c_ - y * s_, hip[1] + x * s_ + y * c_]; };
      r.torso.setAttribute("transform", `rotate(${f(lean)} ${hip[0]} ${hip[1]}) translate(0 ${f(hip[1])}) scale(1 ${(1 + breath).toFixed(3)}) translate(0 ${-hip[1]})`);
      // in the side view the backpack bounces a little behind the step
      r.pack.setAttribute("transform", side && live ? `translate(${f(-2 + Math.sin(this.walkPhase * 2 + 0.6) * 1.5)} ${f(Math.sin(this.walkPhase * 2 + 0.9) * 2.5)})` : "");

      [["legL", "shoeL", J.hipL, a.hl, a.kl], ["legR", "shoeR", J.hipR, a.hr, a.kr]].forEach(([ln, sn, H, ha, ka]) => {
        const K = add(H, dir(ha), 34 * a.tl), A = add(K, dir(ha + ka), 33);
        r[ln].setAttribute("d", limb(H, K, A));
        r[sn].setAttribute("transform", `translate(${f(A[0])} ${f(A[1])}) rotate(${f((ha + ka) * 0.55)})`);
        // sitting: each dangling shoe casts a soft shadow on the card face behind it
        const sh = r[ln === "legL" ? "footShL" : "footShR"];
        sh.setAttribute("cx", f(A[0] + (ln === "legL" ? -6 : 8))); sh.setAttribute("cy", f(A[1] + 30));
      });

      const SB = T(J.shB), EB = add(SB, dir(a.bs), 44), WB = add(EB, dir(a.bs + a.be), 42);
      const bArm = side ? "armBS" : "armB", bHand = side ? "handBS" : "handB";
      r[bArm].setAttribute("d", limb(SB, EB, WB));
      r[bHand].setAttribute("transform", `translate(${f(WB[0])} ${f(WB[1])}) rotate(${f(a.bs + a.be)})`);

      const neck = T([154, 200]);
      const hRot = headTilt + this.look_.x * 6 + lean;
      r.head.setAttribute("transform", `translate(${f(neck[0] - 154)} ${f(neck[1] - 200)}) rotate(${f(hRot)} 154 200)`);
      r.eyes.setAttribute("transform", `translate(${f(this.look_.x * 5)} ${f(this.look_.y * 4)})`);
      const bs = this.blink > 0 ? 0.1 : 1;
      r.eyeL.setAttribute("transform", `translate(0 126) scale(1 ${bs}) translate(0 -126)`);
      r.eyeR.setAttribute("transform", `translate(0 126) scale(1 ${bs}) translate(0 -126)`);
      r.eyeS.setAttribute("transform", `translate(${f(this.look_.x * 2)} ${f(this.look_.y * 3 + 125)}) scale(1 ${bs}) translate(0 -125)`);
      r.brows.setAttribute("transform", `translate(${f(this.look_.x * 3)} ${f(this.brow.y + this.look_.y * 2)})`);
      r.browS.setAttribute("transform", `translate(0 ${f(this.brow.y)})`);

      const hl_ = this.hatLag;
      if (live) {
        hl_.v += (150 * (hRot - hl_.a) - 7 * hl_.v) * dt; hl_.a += hl_.v * dt;
        hl_.vy += (-90 * hl_.y - 6 * hl_.vy) * dt; hl_.y += hl_.vy * dt * 10;
      } else { hl_.a = hRot; hl_.y = 0; }
      // the cube's top sits up-right in the front view, up-left in the side view
      const [hx, hy] = this.headShape === "round" ? [0, 0] : side ? [-6, -3] : [6, -3];
      r.hats.setAttribute("transform", `translate(${hx} ${f(hy + Math.min(4, hl_.y))}) rotate(${f(hl_.a - hRot)} 152 96)`);

      const SF = T(J.shF), EF = add(SF, dir(a.s), 46), WF = add(EF, dir(a.s + a.e), 44);
      r.armF.setAttribute("d", limb(SF, EF, WF));
      r.handF.setAttribute("transform", `translate(${f(WF[0])} ${f(WF[1])}) rotate(${f(a.s + a.e)})`);
      const sway = live ? Math.sin(t * 2.3) * 4 : 0;
      r.up.setAttribute("transform", `translate(${f(WF[0])} ${f(WF[1])}) rotate(${f(sway)}) scale(1.55)`);
    }
  }

  let last = 0, loopOn = false;
  function frame(now) {
    if (!rigs.size) { loopOn = false; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    rigs.forEach((b) => { if (b.visible && b.host.isConnected) b._draw(dt); });
    requestAnimationFrame(frame);
  }
  function ensureLoop() { if (loopOn) return; loopOn = true; last = 0; requestAnimationFrame(frame); }

  return {
    BloqRig: Bloq,
    ensureLoop,
    colors: C,
    setHeadAll: (shape) => { headShape = shape; rigs.forEach((b) => b.setHead(shape)); },
    HATS: Object.keys(HATS),
    PROPS: Object.keys(PROPS),
    POSES: Object.keys(POSES),
    OUTFITS: [null, "surf", "agent", "astro"],
  };
})();

export const { BloqRig, colors, setHeadAll, HATS, PROPS, POSES, OUTFITS } = engine;
