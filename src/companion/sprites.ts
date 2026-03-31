import type { Species, Stage, Accessory, Eye } from "./types.js";

// BODIES[species][stage] = string[][] (3 frames, each 5 lines)
// Each line is 12 characters wide. {E} marks eye positions.
// Line 0 = hat/accessory slot (blank in frames 0–1, effects in frame 2).

const BODIES: Record<Species, Record<Stage, string[][]>> = {
  // ── Clicklaw: hermit crab with antenna shell ──────────────────────
  clicklaw: {
    spark: [
      [
        "            ",
        "    /~\\     ",
        "   ({E}_{E})   ",
        "   _/| |\\_  ",
        "  (_/ \\_)   ",
      ],
      [
        "            ",
        "    /~\\     ",
        "   ({E}_{E})   ",
        "  _/|  |\\_  ",
        "  (_/ \\_)   ",
      ],
      [
        "     '      ",
        "    /~\\     ",
        "   ({E}_{E})   ",
        "   _/| |\\_ *",
        "  (_/ \\_)   ",
      ],
    ],
    powered: [
      [
        "            ",
        "   ¥/=~\\    ",
        "   ({E}={E})   ",
        "  =/|≡|\\=   ",
        "  (_/ \\_)   ",
      ],
      [
        "            ",
        "   ¥/=~\\    ",
        "   ({E}={E})   ",
        "  =/| ≡|\\=  ",
        "  (_/ \\_)   ",
      ],
      [
        "    *  *    ",
        "   ¥/=~\\    ",
        "   ({E}={E})   ",
        "  =/|≡|\\=   ",
        "  (_/ \\_)   ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  ¥¥/≡=~\\   ",
        "  ({E}≡={E})   ",
        " *=/|≡≡|\\=* ",
        "  (≈/ \\≈)   ",
      ],
      [
        "            ",
        "  ¥¥/≡=~\\   ",
        "  ({E}≡={E})   ",
        " *=/| ≡|\\=* ",
        "  (≈/ \\≈)   ",
      ],
      [
        "   * ** *   ",
        "  ¥¥/≡=~\\   ",
        "  ({E}≡={E})   ",
        " *=/|≡≡|\\=* ",
        " *(≈/ \\≈)*  ",
      ],
    ],
  },

  // ── Synthray: manta ray of translucent PCB ────────────────────────
  synthray: {
    spark: [
      [
        "            ",
        "   /----\\   ",
        " <-{E}    {E}-> ",
        "   \\----/   ",
        "     \\/     ",
      ],
      [
        "            ",
        "    /---\\   ",
        "  <-{E}   {E}->",
        "    \\---/   ",
        "     \\/     ",
      ],
      [
        "      ~     ",
        "   /----\\   ",
        " <-{E}    {E}-> ",
        "   \\----/   ",
        "     \\/     ",
      ],
    ],
    powered: [
      [
        "            ",
        "   /==-=\\   ",
        " <=={E}  {E}==> ",
        "   \\=≡-=/   ",
        "     \\/     ",
      ],
      [
        "            ",
        "    /=-=\\   ",
        "  <=={E} {E}==>",
        "    \\≡-=/   ",
        "     \\/     ",
      ],
      [
        "     *  *   ",
        "   /==-=\\   ",
        " <=={E}  {E}==> ",
        "   \\=≡-=/   ",
        "     \\/     ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  */≡=≡=\\*  ",
        "<=≡={E}  {E}=≡=>",
        "  *\\≡=≡=/   ",
        "    ≈\\/≈    ",
      ],
      [
        "            ",
        "   */≡=≡\\*  ",
        " <=≡={E} {E}≡=>",
        "   *\\≡=≡/*  ",
        "    ≈\\/≈    ",
      ],
      [
        "  *  ≈≈  *  ",
        "  */≡=≡=\\*  ",
        "<=≡={E}  {E}=≡=>",
        "  *\\≡=≡=/   ",
        "   *≈\\/≈*   ",
      ],
    ],
  },

  // ── Drifter: jellyfish trailing fiber optic tendrils ──────────────
  drifter: {
    spark: [
      [
        "            ",
        "    .---.   ",
        "   ( {E} {E} )  ",
        "    '---'   ",
        "    | | |   ",
      ],
      [
        "            ",
        "    .---.   ",
        "   ( {E} {E} )  ",
        "    '---'   ",
        "     | | |  ",
      ],
      [
        "      .     ",
        "    .---.   ",
        "   ( {E} {E} )  ",
        "    '---'   ",
        "    | | |   ",
      ],
    ],
    powered: [
      [
        "            ",
        "    .=≡=.   ",
        "   ({E}={E})    ",
        "    '=≡='   ",
        "    |~|~|   ",
      ],
      [
        "            ",
        "    .=≡=.   ",
        "   ({E}={E})    ",
        "    '=≡='   ",
        "     |~|~|  ",
      ],
      [
        "     * *    ",
        "    .=≡=.   ",
        "   ({E}={E})    ",
        "    '=≡='   ",
        "    |~|~|   ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "   *≡=≡=≡*  ",
        "  ≈({E}≡{E})≈  ",
        "   *≡=≡=*   ",
        "   |~|~|~|  ",
      ],
      [
        "            ",
        "   *≡=≡=≡*  ",
        "  ≈({E}≡{E})≈  ",
        "   *≡=≡=*   ",
        "    |~|~|~| ",
      ],
      [
        "    ≈  ≈    ",
        "   *≡=≡=≡*  ",
        "  ≈({E}≡{E})≈  ",
        "   *≡=≡=*   ",
        "  *|~|~|~|* ",
      ],
    ],
  },

  // ── Shellbyte: sea turtle with circuit-board carapace ─────────────
  shellbyte: {
    spark: [
      [
        "            ",
        "    ____    ",
        "  /{E}    {E}\\  ",
        "  |'----'|  ",
        "  ~^    ^~  ",
      ],
      [
        "            ",
        "    ____    ",
        "  /{E}    {E}\\  ",
        "  |'----'|  ",
        "   ~^  ^~   ",
      ],
      [
        "       .    ",
        "    ____    ",
        "  /{E}    {E}\\  ",
        "  |'----'|  ",
        "  ~^    ^~  ",
      ],
    ],
    powered: [
      [
        "            ",
        "   _=≡≡=_   ",
        "  /{E} ≡≡ {E}\\  ",
        "  |'=≡≡='|  ",
        "  ~^    ^~  ",
      ],
      [
        "            ",
        "   _=≡≡=_   ",
        "  /{E} ≡≡ {E}\\  ",
        "  |'=≡≡='|  ",
        "   ~^  ^~   ",
      ],
      [
        "    *  *    ",
        "   _=≡≡=_   ",
        "  /{E} ≡≡ {E}\\  ",
        "  |'=≡≡='|  ",
        "  ~^    ^~  ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  *=≡≡≡≡=*  ",
        " /{E}≡=≡≡={E}\\ ",
        " |'≡=≡≡='|  ",
        " ≈~^    ^~≈ ",
      ],
      [
        "            ",
        "  *=≡≡≡≡=*  ",
        " /{E}≡=≡≡={E}\\ ",
        " |'≡=≡≡='|  ",
        "  ≈~^  ^~≈  ",
      ],
      [
        "   *≈  ≈*   ",
        "  *=≡≡≡≡=*  ",
        " /{E}≡=≡≡={E}\\ ",
        " |'≡=≡≡='|  ",
        " ≈~^*  *^~≈ ",
      ],
    ],
  },

  // ── Flickbug: firefly with blinking LED abdomen ───────────────────
  flickbug: {
    spark: [
      [
        "            ",
        "    \\  /    ",
        "    ({E}{E})    ",
        "    /|\\     ",
        "    (*)     ",
      ],
      [
        "            ",
        "     \\ /    ",
        "    ({E}{E})    ",
        "     /|\\    ",
        "    (*)     ",
      ],
      [
        "      '     ",
        "    \\  /    ",
        "    ({E}{E})    ",
        "    /|\\     ",
        "    (*) *   ",
      ],
    ],
    powered: [
      [
        "            ",
        "   ¥\\  /¥   ",
        "   =({E}{E})=  ",
        "    /≡\\     ",
        "    (=*)    ",
      ],
      [
        "            ",
        "    ¥\\ /¥   ",
        "   =({E}{E})=  ",
        "     /≡\\    ",
        "    (=*)    ",
      ],
      [
        "     *  *   ",
        "   ¥\\  /¥   ",
        "   =({E}{E})=  ",
        "    /≡\\     ",
        "   *(=*)*   ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  ¥¥\\  /¥¥  ",
        "  =≡({E}{E})≡= ",
        "   ≡/≡≡\\≡   ",
        "   *(≡=*)*  ",
      ],
      [
        "            ",
        "   ¥¥\\ /¥¥  ",
        "  =≡({E}{E})≡= ",
        "    ≡/≡≡\\≡  ",
        "   *(≡=*)*  ",
      ],
      [
        "    *  * *  ",
        "  ¥¥\\  /¥¥  ",
        "  =≡({E}{E})≡= ",
        "   ≡/≡≡\\≡   ",
        "  **(≡=*)**≈",
      ],
    ],
  },

  // ── Reefnode: coral polyp cluster as server rack ──────────────────
  reefnode: {
    spark: [
      [
        "            ",
        "   {E}^ ^{E}   ",
        "   |^|^|    ",
        "   |_|_|    ",
        "   /___\\    ",
      ],
      [
        "            ",
        "    {E}^ ^{E}  ",
        "   |^|^|    ",
        "   |_|_|    ",
        "   /___\\    ",
      ],
      [
        "      .     ",
        "   {E}^ ^{E}   ",
        "   |^|^|    ",
        "   |_|_|    ",
        "   /___\\    ",
      ],
    ],
    powered: [
      [
        "            ",
        "  {E}=^ ^={E}  ",
        "  |=^|^=|   ",
        "  |≡_|_≡|   ",
        "  /=___=\\   ",
      ],
      [
        "            ",
        "   {E}=^ ^={E} ",
        "  |=^|^=|   ",
        "  |≡_|_≡|   ",
        "  /=___=\\   ",
      ],
      [
        "    *   *   ",
        "  {E}=^ ^={E}  ",
        "  |=^|^=|   ",
        "  |≡_|_≡|   ",
        "  /=___=\\   ",
      ],
    ],
    overclocked: [
      [
        "            ",
        " {E}≡=^ ^≡={E} ",
        " |≡=^|^=≡|  ",
        " |≡≡_|_≡≡|  ",
        " /≡=≡≡≡=≡\\ ",
      ],
      [
        "            ",
        "  {E}≡=^ ^≡{E} ",
        " |≡=^|^=≡|  ",
        " |≡≡_|_≡≡|  ",
        " /≡=≡≡≡=≡\\ ",
      ],
      [
        "   *≈  ≈*   ",
        " {E}≡=^ ^≡={E} ",
        " |≡=^|^=≡|  ",
        " |≡≡_|_≡≡|  ",
        " /≡=≡≡≡=≡\\*",
      ],
    ],
  },

  // ── Zapgecko: gecko with glowing circuit-trace stripes ────────────
  zapgecko: {
    spark: [
      [
        "            ",
        "    _~_     ",
        "   ({E} {E})   ",
        "   /|-|\\    ",
        "  ~/ _ \\~   ",
      ],
      [
        "            ",
        "     _~_    ",
        "   ({E} {E})   ",
        "    /|-|\\   ",
        "  ~/ _ \\~   ",
      ],
      [
        "       *    ",
        "    _~_     ",
        "   ({E} {E})   ",
        "   /|-|\\    ",
        "  ~/ _ \\~   ",
      ],
    ],
    powered: [
      [
        "            ",
        "   ¥_=~_    ",
        "  =({E}={E})   ",
        "  =/|≡|\\=   ",
        "  ~/ ≡ \\~   ",
      ],
      [
        "            ",
        "    ¥_=~_   ",
        "  =({E}={E})   ",
        "   =/|≡|\\=  ",
        "  ~/ ≡ \\~   ",
      ],
      [
        "     *  *   ",
        "   ¥_=~_    ",
        "  =({E}={E})   ",
        "  =/|≡|\\=   ",
        " *~/ ≡ \\~*  ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  ¥¥_≡=~_   ",
        " =≡({E}≡{E})≡  ",
        " =≡/|≡≡|\\≡  ",
        " ≈~/ ≡≡ \\~≈ ",
      ],
      [
        "            ",
        "   ¥¥_≡=~_  ",
        " =≡({E}≡{E})≡  ",
        "  =≡/|≡≡|\\≡ ",
        " ≈~/ ≡≡ \\~≈ ",
      ],
      [
        "   * ≈≈  *  ",
        "  ¥¥_≡=~_   ",
        " =≡({E}≡{E})≡  ",
        " =≡/|≡≡|\\≡  ",
        "*≈~/ ≡≡ \\~≈*",
      ],
    ],
  },

  // ── Coilpod: coconut octopus with copper-wire tentacles ───────────
  coilpod: {
    spark: [
      [
        "            ",
        "    .~~.    ",
        "   ({E}  {E})  ",
        "   /||||\\   ",
        "  ~ ~~ ~ ~  ",
      ],
      [
        "            ",
        "    .~~.    ",
        "   ({E}  {E})  ",
        "   /||||\\   ",
        "  ~~ ~~ ~~  ",
      ],
      [
        "      .     ",
        "    .~~.    ",
        "   ({E}  {E})  ",
        "   /||||\\   ",
        " *~ ~~ ~ ~* ",
      ],
    ],
    powered: [
      [
        "            ",
        "   .=~~=.   ",
        "  =({E}=={E})  ",
        "  =/|≡≡|\\=  ",
        "  ~=~~=~~=  ",
      ],
      [
        "            ",
        "   .=~~=.   ",
        "  =({E}=={E})  ",
        "  =/|≡≡|\\=  ",
        "  =~~=~~=~  ",
      ],
      [
        "    *  *    ",
        "   .=~~=.   ",
        "  =({E}=={E})  ",
        "  =/|≡≡|\\=  ",
        " *~=~~=~~=* ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "  *≡=~~=≡*  ",
        " ≡=({E}≡≡{E})= ",
        " ≡=/|≡≡|\\≡= ",
        " ≈~≡~~≡~~≡≈ ",
      ],
      [
        "            ",
        "  *≡=~~=≡*  ",
        " ≡=({E}≡≡{E})= ",
        " ≡=/|≡≡|\\≡= ",
        " ≡≈~~≡~~≈≡~ ",
      ],
      [
        "   *≈  ≈*   ",
        "  *≡=~~=≡*  ",
        " ≡=({E}≡≡{E})= ",
        " ≡=/|≡≡|\\≡= ",
        "*≈~≡~~≡~~≡≈*",
      ],
    ],
  },

  // ── Wattpalm: palm tree sprite with LED fronds ────────────────────
  wattpalm: {
    spark: [
      [
        "            ",
        "  \\ {E}|{E} /  ",
        "   \\|V|/    ",
        "    |:|     ",
        "   _|:|_    ",
      ],
      [
        "            ",
        "   \\ {E}|{E}/  ",
        "   \\|V|/    ",
        "    |:|     ",
        "   _|:|_    ",
      ],
      [
        "      .     ",
        "  \\ {E}|{E} /  ",
        "   \\|V|/    ",
        "    |:|     ",
        "   _|:|_    ",
      ],
    ],
    powered: [
      [
        "            ",
        " =\\ {E}|{E} /= ",
        "  =\\|V|/=   ",
        "   =|≡|=    ",
        "  _=|≡|=_   ",
      ],
      [
        "            ",
        "  =\\ {E}|{E}/= ",
        "  =\\|V|/=   ",
        "   =|≡|=    ",
        "  _=|≡|=_   ",
      ],
      [
        "    *  *    ",
        " =\\ {E}|{E} /= ",
        "  =\\|V|/=   ",
        "   =|≡|=    ",
        "  _=|≡|=_   ",
      ],
    ],
    overclocked: [
      [
        "            ",
        "*≡\\ {E}|{E} /≡*",
        " ≡=\\|V|/=≡  ",
        "  ≡=|≡≡|=≡  ",
        " _≡=|≡≡|=≡_ ",
      ],
      [
        "            ",
        " *≡\\ {E}|{E}/≡*",
        " ≡=\\|V|/=≡  ",
        "  ≡=|≡≡|=≡  ",
        " _≡=|≡≡|=≡_ ",
      ],
      [
        "   *≈  ≈*   ",
        "*≡\\ {E}|{E} /≡*",
        " ≡=\\|V|/=≡  ",
        "  ≡=|≡≡|=≡  ",
        "*_≡=|≡≡|=≡_*",
      ],
    ],
  },

  // ── Neoncoil: electric eel wrapped in copper ──────────────────────
  neoncoil: {
    spark: [
      [
        "            ",
        "   ~~~~~>   ",
        "  ({E}  {E})   ",
        "   ~~~~~    ",
        "  <~~~~~    ",
      ],
      [
        "            ",
        "    ~~~~~>  ",
        "  ({E}  {E})   ",
        "    ~~~~~   ",
        "  <~~~~~    ",
      ],
      [
        "       *    ",
        "   ~~~~~>   ",
        "  ({E}  {E})   ",
        "   ~~~~~    ",
        "  <~~~~~  * ",
      ],
    ],
    powered: [
      [
        "            ",
        "  =~≡~~~=>  ",
        "  ({E}=={E})   ",
        "  =~≡~~~=   ",
        "  <=~≡~~=   ",
      ],
      [
        "            ",
        "   =~≡~~~=> ",
        "  ({E}=={E})   ",
        "   =~≡~~~=  ",
        "  <=~≡~~=   ",
      ],
      [
        "    *   *   ",
        "  =~≡~~~=>  ",
        "  ({E}=={E})   ",
        "  =~≡~~~=   ",
        " *<=~≡~~=*  ",
      ],
    ],
    overclocked: [
      [
        "            ",
        " ≡=~≡≡~~=≡> ",
        " ≡({E}≡≡{E})≡  ",
        " ≡=~≡≡~~=≡  ",
        " <≡=~≡≡~=≡  ",
      ],
      [
        "            ",
        "  ≡=~≡≡~~≡> ",
        " ≡({E}≡≡{E})≡  ",
        "  ≡=~≡≡~~≡  ",
        " <≡=~≡≡~=≡  ",
      ],
      [
        "   *≈ ≈ *   ",
        " ≡=~≡≡~~=≡> ",
        " ≡({E}≡≡{E})≡  ",
        " ≡=~≡≡~~=≡  ",
        "*<≡=~≡≡~=≡≈*",
      ],
    ],
  },
};

// Accessory overlays — replace hat line (line 0) or add trail (line 4 suffix)
const ACCESSORY_LINES: Record<Accessory, string> = {
  "signal-spark": "     *      ",
  "coral-crown": "    ^^^     ",
  "tide-trail": "", // appended to line 4 as "~" suffix
  "solar-shell": "    [=]     ",
  "copper-coil": "    ~@~     ",
  "biolume-glow": "", // handled by color, not line replacement
  "storm-aura": "   *  *  *  ",
};

// Compact face patterns for narrow terminals
const FACES: Record<Species, string> = {
  clicklaw: "({E}_{E})>",
  synthray: "<={E} {E}=>",
  drifter: "~({E} {E})~",
  shellbyte: "[{E}=={E}]",
  flickbug: "({E}{E})*",
  reefnode: "^{E}^{E}^",
  zapgecko: "~({E}={E})",
  coilpod: "~({E} {E})~",
  wattpalm: "/{E}|{E}\\",
  neoncoil: "~{E}≡{E}~>",
};

/**
 * Render a full 5-line sprite for a species at a given stage and frame.
 * Replaces `{E}` placeholders with the chosen eye character and applies
 * any accessory overlays to the hat slot (line 0) or trail (line 4).
 */
export function renderSprite(
  species: Species,
  stage: Stage,
  eye: Eye,
  frame?: number,
  accessories?: Accessory[],
): string[] {
  const frames = BODIES[species][stage];
  const idx = frame != null ? Math.min(frame, frames.length - 1) : 0;
  const lines = frames[idx].map((line) => line.replaceAll("{E}", eye));

  if (accessories && accessories.length > 0) {
    for (const acc of accessories) {
      const overlay = ACCESSORY_LINES[acc];

      if (acc === "tide-trail") {
        // Append a "~" to the end of line 4
        lines[4] = lines[4].replace(/\s*$/, "~");
      } else if (acc === "biolume-glow") {
        // Handled at color layer, no line replacement
        continue;
      } else if (overlay && lines[0].trim() === "") {
        // Only replace hat slot if it is currently blank
        lines[0] = overlay;
      }
    }
  }

  return lines;
}

/**
 * Return the number of animation frames for a species + stage combo.
 */
export function spriteFrameCount(species: Species, stage: Stage): number {
  return BODIES[species][stage].length;
}

/**
 * Return a compact 1-line face for narrow terminals or inline display.
 * Each species gets a unique pattern with eye placeholders replaced.
 */
export function renderFace(species: Species, eye: Eye): string {
  return FACES[species].replaceAll("{E}", eye);
}
