# Our Memories — project brief for Claude

A small web game made as a **3-year anniversary gift**. She plays a pixel-art
version of herself, walking around a cosy top-down map made of places from the
relationship. Walking onto a memory spot plays a short looping pixel-art
cutscene (layered images, gently animated) with a title, date and caption, until
she presses Continue. Some memories are hidden. Finding them all plays a finale.
Ten little glowing momos (Nepali dumplings) are scattered around the map to
collect; the secret first-date memory only appears once she has all ten and
every other memory. At the end of the pier she can go fishing for 20 love
letters (a small minigame; seaweed means try again).

**Tone:** cosy, soft, charming — Stardew Valley / Animal Crossing. Gentle motion,
warm palette, no fail states, nothing stressful. The person who maintains this
is not a game developer: keep code readable, commented, and simple.

## The golden rule: new content is data, not code

Adding a memory = **images + a JSON entry + a trigger rectangle in the map**.
Never hard-code memory ids, text, or art paths in `src/`. If a request seems to
need a code change for one specific memory, add a general, data-driven option
instead (and document it here and in the README).

Do not add features that weren't asked for (no combat, inventory, NPC dialogue,
quests, etc.). Obvious extension points are marked with `// TODO` comments.

## Tech

- **Phaser 4.2.1** + **Vite 8**, plain JavaScript ES modules, no TypeScript, no backend.
- Static build → GitHub Pages (`.github/workflows/deploy.yml`, Vite `base: './'`).
- Tools (Node): `pngjs` (placeholder art), `sharp` (photo pixelation).
- Commands: `npm run dev`, `npm run build`, `npm run preview`,
  `npm run placeholders [-- --force]`, `npm run pixelate -- <photo> [out] [opts]`,
  `npm run momos` (writes the map's `Momos` layer from the spot list in `tools/place-momos.js`),
  `npm run sfx [-- --force]` (placeholder sound effects),
  `npm run scene:fishing` (fishing art + the map's `Fishing` spot),
  `npm run scene:<name>` for each hand-drawn memory (see the README table).
- In dev, `window.game` is the Phaser game (e.g. `game.scene.getScene('World')`).
- Data problems are `console.warn`ed with friendly messages; in dev the title
  screen shows "! N data warnings".

### Phaser 4 gotchas (things that differ from Phaser 3 examples online)
- `Key.onUp` clears `_justDown`, so `Phaser.Input.Keyboard.JustDown` misses quick
  taps. Use `keyboard.on('keydown')` events for one-shot actions (World does this).
- `roundPixels` defaults to false (we set it true). `setTintFill` is gone
  (use `setTint().setTintMode(Phaser.TintModes.FILL)`). `Geom.Point` → `Vector2`.
- `Scale.FIT` ignores `zoom`; we use `Scale.NONE` + our own integer zoom in `main.js`.
- Tiled tile animations play automatically. Tilesets must be **embedded** in the map.
- Phaser reuses Scene instances: reset per-visit state in `init()`/`create()`.
- `node_modules/phaser/skills/` has official Phaser 4 notes (v3-to-v4-migration etc.).

## Folder structure

```
our-memories/
├── CLAUDE.md / README.md
├── index.html                 # full-window container, dark letterbox
├── vite.config.js             # base './', host true (phone testing), assetsDir 'bundle'
├── .github/workflows/deploy.yml
├── public/assets/             # served as-is; every data path is relative to here
│   ├── tiles/tileset.png      # 16x16 tiles, 8 columns
│   ├── sprites/player.png     # 4x4 frames of 16x24
│   ├── memories/<id>/*.png    # one folder per memory (+ memories/finale/)
│   ├── fishing/               # the fishing minigame's layers + sprites (bobber, ripple, bubble, envelope, seaweed, paper)
│   ├── ui/                    # font.png+font.xml, heart, panel, sparkle, touch controls, momo, momo-hud (+ dish of achar), momo-glow
│   └── audio/                 # music (wav/mp3/ogg) + sfx/ (sound effects)
├── maps/world.json            # the Tiled map (JSON, embedded tileset)
├── maps/cosy.tsx              # same tileset as a Tiled file, for starting new maps
├── data/memories.json         # every memory
├── data/finale.json           # finale text + layers
├── data/game.json             # her name, title text, optional world music
├── data/fishing.json          # the love letters + fishing settings and background layers
├── data/sounds.json           # sound effect name -> file (or null)
├── tools/
│   ├── make-placeholders.js   # generates all placeholder art/audio/map (never overwrites without --force)
│   ├── make-sfx.js            # placeholder sound effects -> audio/sfx/ (never overwrites without --force)
│   ├── pixelate-photo.js      # photo -> 320x180 limited-palette PNG
│   ├── place-momos.js         # writes the map's "Momos" layer (spot list at the top)
│   ├── lib/                   # generator pieces: canvas, palette, font, tileset, test-map, sprites, cutscenes, audio
│   ├── scenes/<id>.js         # one script per hand-crafted memory scene (named PAL palette at the top),
│   │                          #   writes its layers, any map building, and tools/previews/<id>.png
│   ├── previews/              # flattened 3x previews written by scene scripts
│   └── palettes/cosy.hex      # the placeholder palette (Lospec .hex format)
└── src/
    ├── main.js                # Phaser config + integer zoom fitting
    ├── config.js              # ALL tunable constants (sizes, speeds, timings, colours, depths)
    ├── scenes/  Boot, Title, World, HUD, Memory, Finale, Fishing
    ├── objects/ Player, TouchControls, Typewriter (pixel text + typing), ContinueHeart
    └── systems/ MemoryRegistry, SaveManager, LayerAnimator, Music (crossfades), Momos (reads the Momos layer),
                 LoveLetters (reads data/fishing.json + the map's Fishing layer), Sfx (data/sounds.json)
```

Additions beyond the original brief, and why: `data/game.json` (title text and
her name are content, so they live in data), `systems/Music.js` (crossfades
must survive scene changes), `objects/Typewriter.js` + `ContinueHeart.js`
(shared by Memory and Finale), `tools/lib/` (keeps the generator readable),
`maps/cosy.tsx` (reusable tileset with collision properties for new maps).

## Scene flow

`Boot` (loads shared assets, validates data) → `Title` (Start / Continue; hold R
3 s or press-and-hold her name to wipe the save) → `World` (+ `HUD` on top) →
walking into a trigger pauses World and launches `Memory` → Continue stops
Memory and resumes World (`events.on('resume', …, data)`) → after the last
memory's toast, World launches `Finale` the same way (once; `finaleSeen`).
Standing in a `Fishing` spot shows "Press E to fish"; that launches `Fishing`
the same way, and the < arrow (top-left) / Esc resumes World.

Memory/Finale load their own layer images and music on open (lazy), so adding
memories never slows startup.

## data/memories.json schema

```json
{
  "memories": [
    {
      "id": "apollo-bay",              // required, unique; must match a trigger's memoryId
      "title": "Night on the beach",   // shown briefly at the top
      "date": "March 2026",            // shown under the title (optional)
      "caption": "Apollo Bay — ...",   // typed out in the bottom box; wraps automatically
      "hidden": false,                 // true = no sparkle marker in the world until found
      "requiresAction": false,         // true = only opens when she presses E / taps ♥ in the zone
      "unlockAfter": 0,                // stays inactive until N other memories are found ("all" = every other one)
      "momosNeeded": 0,                // ...and until she's collected this many momos
      "revealOnUnlock": false,         // hidden + this = its sparkle appears (with a toast) once it unlocks
      "music": "audio/waves.wav",      // optional; crossfades in, back out on Continue.
                                       // A list ["a.wav", "b.mp3"] layers several, looping together
      "layers": [ { "src": "memories/apollo-bay/sky.png" }, ... ]   // back to front
    }
  ]
}
```
Defaults: `hidden`/`requiresAction`/`revealOnUnlock` false, `unlockAfter`/`momosNeeded` 0, no music. All paths
are relative to `public/assets/`. Unknown keys produce "typo?" warnings.
Hidden memories count toward the HUD total but nothing reveals which are hidden.
Behaviour: unseen + no action → starts on entering the zone; seen → "Press E to
revisit" prompt (touch: "Tap ♥ to revisit"); unseen + requiresAction → "Press E
to look closer".

### Layer options and animation presets (src/systems/LayerAnimator.js)

Every layer: `{ "src": "...", "anim": "<preset>", "amount": n, "speed": n }`.
`speed` is always a multiplier (1 = default, 0.5 = half). `anim` defaults to `none`.

| preset    | what it does                                              | `amount` means (default)        | extra options |
|-----------|-----------------------------------------------------------|---------------------------------|---------------|
| `none`    | static image                                              | —                               | — |
| `slide`   | gentle horizontal back-and-forth, wraps at edges (4 s cycle) | pixels each way (4)          | — |
| `drift`   | continuous horizontal scroll, seamless wrap (6 px/s)      | — (use `speed`; negative = right) | — |
| `bob`     | vertical up-and-down (3 s cycle)                          | pixels (1)                      | — |
| `sway`    | leans around the bottom of the drawing; pixel-perfect shear via 1-px strips (4 s cycle) | pixels the top moves (2) | — |
| `flicker` | quick random dimming; each separate light flickers on its own | how much it dims 0–1 (0.6)  | `groups` (3) |
| `twinkle` | slow soft fade per star                                   | how faint 0–1 (0.75)            | `groups` (5) |
| `pulse`   | slow breathing fade + slight grow around the drawing's centre (4 s) | fade 0–1 (0.3)        | `scale` (0.03) |
| `frames`  | spritesheet flip-book loop                                | —                               | `frameWidth` (320), `frameHeight` (180), `fps` (6) |

`flicker`/`twinkle` split the image into separate blobs (flood fill) and assign
each to one of `groups` independent patterns; big blobs (>24 px) are split by
12 px cells. `sway`/`pulse` measure the opaque bounding box. Results are cached.
To add a preset: add an entry to `PRESETS` (`defaults` + `create(scene, key, opts, src)`
returning `{ objects, update(t) }`), add its options to `LAYER_FIELDS` in
MemoryRegistry.js, and document it here + README. Missing images / unknown
presets warn and are skipped / shown static — never crash.

## data/fishing.json (the love-letter minigame)

```json
{
  "title": "Fishing for love letters",  // fades in at the top for a moment
  "music": "audio/waves.wav",           // optional
  "seaweedChance": 0.3,                 // 0..1 chance a catch is seaweed (try again)
  "maxSeaweedInARow": 2,                // pity rule: never more seaweed than this in a row
  "signature": "Love, Ryan ♥",          // right-aligned under every letter
  "scene": { "hand": [97, 104], "rodLength": 44, "waterY": 133, "castX": [165, 212] },
  "layers": [ ... ],                    // background, same format as memory layers
  "letters": [ { "id": "letter-01", "title": "...", "text": "..." } ]
}
```
`scene` = where things are in the art (her hand holding the rod, the rod's length,
the sea surface the bobber floats on, the cast's min/max x) — keep it in sync with
`tools/scenes/fishing.js`. Feel (timings, rod angles, colours) is `FISHING` in
config.js. Flow (scenes/Fishing.js): ready → cast (rod swings, bobber arcs out) →
waiting (random `waitMs`, maybe a fake nibble or two) → bite (bubbles for `biteMs`;
pressing early does nothing, missing it just waits again — no fail state, and no
instruction text on screen)
→ hook → reel → seaweed (dangles, dropped back) or a letter (envelope → letter
paper, typed out, Continue). Letters: a random unread one; once all are read,
any except the last one. Letters are not part of the memory count or finale.
The marker in the world is `bobber.png` (loaded by Boot), floating in the
water just left of each spot.

## data/sounds.json (sound effects) and music

`{ "<name>": "audio/sfx/<file>" | null }`. The names are fixed by `SFX_NAMES`
in `src/systems/Sfx.js` (momo, found, cast, splash, letter, continue; unknown
names warn). Boot loads them all; `Sfx.play(scene, name)` plays one once at
`AUDIO.sfxVolume`, silently doing nothing if it's null or failed to load.
Every `music` value (memories, fishing, finale, worldMusic) may be a path or a
list of paths played together (`musicTracks()` / `Music.load` / `Music.play` in
Music.js); MemoryRegistry and LoveLetters normalise it to an array.
Hooks: World.checkMomos (momo), HUD.showNextToast (found, every toast),
Fishing.cast / splash / caughtLetter / closeLetter (cast, splash, letter,
continue), Memory.advance + Finale.close (continue). New effect = a name in
`SFX_NAMES` + a `Sfx.play` call + an entry in sounds.json (+ a synth in
`tools/lib/audio.js` / `make-sfx.js` for a placeholder).
Music tracks are chosen by the user in the data files (worldMusic is null for now).

## data/finale.json / data/game.json

- finale: `title`, `lines` (array, typed one after another, centred), `signature`,
  `music` (optional), `layers` (same format as memory layers).
- game: `herName`, `titleLine` ("Happy 3 years,"), `subtitle`, `worldMusic` (path or null).

## Map conventions (Tiled, maps/world.json)

- Orthogonal, **16×16 tiles**, not infinite, tile layer format **CSV** (or
  uncompressed Base64 — Phaser can't read compressed layers). Saved as JSON.
- Tilesets must be **embedded** (Tileset → "Embed Tileset"). The game finds the
  image by *file name* in `public/assets/tiles/` (the path inside the JSON only
  matters to Tiled). Tileset texture key: `tileset:<name in Tiled>`.
- Layers (names are case-sensitive):
  - `Ground`, `Decor` — tile layers under her.
  - `Above` — tile layer drawn over her (treetops, lamp tops). Tiles near her
    fade to 40% when she's underneath so she's never lost.
  - `Collision` — tile layer, hidden in game. Paint the red-X blocker tile (id 44).
  - **Collision rule:** any tile whose tileset property `collides` (bool) is true
    blocks her on `Ground`, `Decor` or `Collision`. Water, walls, trunks etc.
    already have it, so most collision comes for free.
  - `Triggers` — object layer of rectangles, each with custom string property
    `memoryId`. A trigger fires when her **feet** (centre of her 10×6 collision
    box) are inside the rectangle.
  - `Spawn` — object layer with a point named `player` (her feet position).
  - `Fishing` — object layer (optional) of rectangles where she can fish
    (`npm run scene:fishing` writes one at the end of the pier, tiles x 2–3, y 13–14;
    momo-1 also sits there). Hidden if `fishing.json` has no letters.
  - `Momos` — object layer (optional) of points, one per momo, named `momo-1`…
    (the name is the save id). Point = her feet position to collect it (within
    `MOMO.pickupRadius` in config.js). `npm run momos` rewrites this layer from
    `SPOTS` in `tools/place-momos.js`; re-run it after `placeholders --force`.
    The HUD's top-right counter shows found/total; it's hidden if there are none.
    Once she has every momo she walks `MOMO.allFoundSpeed` (2) times faster
    (World.updateMomoSpeed → Player.setSpeedMultiplier, walk animation too).
- Boot cross-checks: every memory needs a trigger and every trigger a memory.
- **Buildings as their own tileset:** a one-off building can be a separate
  embedded tileset whose image is the whole facade cut into 16×16 tiles (e.g.
  `hall` → `tiles/hall.png`, 10×7 tiles, every tile `collides`), stamped into
  `Decor`. Boot/World load every tileset in the map, so no code is needed.
  The ballroom ("SAN REMO", for the school formal) sits at tiles x 33–42,
  y 12–18, doors facing the main path, trigger at x 37–38, y 19.
  The Oxford Scholar pub (`oxford-scholar`, 8×6) replaced the placeholder café
  at tiles x 27–34, y 0–5 (doors at x 30–31, trigger `pub doors` at x 30–31,
  y 6); RMIT's Building 80 (`rmit`, 7×6) sits right against the pub at x 35–41
  (it replaced the house at x 37–41, which the script clears first), so the
  row Collins–pub–RMIT spans x 19–41 and the pavement (x 18–42) sticks out one
  tile past each end.
  The botanic garden (`garden`, 10×9, for `botanic-garden`) fills the bottom-right
  corner at x 50–59, y 29–37 (top row = treetop headroom): pond + boardwalk
  (walkable) out to a lookout deck (trigger `garden lookout` = the deck, x 53–56,
  y 34–35). The branch path runs straight down from the main path at x 48–49
  (y 22–39), then along y 38–39 to the boardwalk. The picnic (trigger x 29–32,
  y 25–27) was moved there off that path. Its blanket is now the `picnic` tileset
  (4×2: bikes on top, solid; blanket below, walkable) at x 29–32, y 25–26.
  The Palais Theatre (`palais`, 10×7, for `laufey-concert`) sits across the pub
  path from San Remo at x 19–28, y 12–18 (doors facing the main path, trigger
  `palais doors` at x 23–24, y 19).
  The campsite (`campsite`, 5×3, for `camping`) is at x 25–29, y 34–36, just
  right of the momo beside the tree (x 21, y 35): tent (x 25–26, y 34–35), her
  chair / firepit / his chair along y 35 (solid), the rest walkable; its fire
  tiles flicker (3 frames). Trigger `campfire` = x 27–29, y 36 (in front of the fire).
  Collins Coffee House (`collins`, 8×6, for `collins-coffee-house`) — the sandstone
  Gothic building with the corner spire — replaced the house left of the Oxford
  Scholar (and the hedge behind it) at x 19–26, y 0–5; doors at x 22–23, trigger
  `collins doors` at x 22–23, y 6.
  The hilltop bench (`all-nations`, 4×2, for `all-nations-park`) sits at the
  top of the clearing east of RMIT, centred between the bushes (x 42–43) and
  the trees (x 50+) at x 45–48, y 1–2, with a row of bushes (cosy HEDGE) behind
  it along the top edge at x 44–49, y 0: basalt boulders either side of a
  bench on the top row (solid), tan gravel below (walkable); trigger
  `hilltop bench` at x 46–47, y 2.
  Street props along that strip (`street-props`, one row of 16×16 props, all
  solid, placed tile by tile by `tools/scenes/collins-street.js`): on the
  pavement (y 6) a chalkboard (x 19), bay trees (x 21, 24), a bistro table
  (x 25–26), a barrel table (x 27), a pub chalkboard (x 32), bikes (x 35–36) and
  a bin (x 41) — door tiles x 22–23, 30–31, 38 kept clear; across the road two
  plane trees (cosy tree tiles, canopy x 24–25 / 37–38, y 9–10, trunks y 11)
  plus one right of RMIT under the bushes (canopy x 42–43, y 2–3, trunk y 4; momo-4
  sits just right of its trunk at x 44, y 4) and
  benches at x 22–23 and 39–40, y 9, just inside the outer lamps (x 21, x 41).
  The fronts of the Palais and San Remo (`venue-props`, placed tile by tile by
  `tools/scenes/venue-fronts.js`, all on y 19): flower urns (x 19, 28) and pink /
  blue poster easels (x 20, 27) outside the Palais's lamps; a red carpet on San
  Remo's trigger tiles (x 37–38, walkable), rope posts either side (x 36, 39) and
  spiral topiaries (x 34, 41).
- `stampBuilding` options: `walkable` (tile ids that don't collide; default all
  solid) and `frames`/`animated`/`frameMs` (the image holds N copies side by
  side; listed tiles cycle through them as a Tiled tile animation).
- `npm run placeholders -- --force` regenerates `world.json` *without* such
  additions; re-run the scene scripts (`npm run scene:formal`, `npm run
  scene:pub`, `npm run scene:garden`, `npm run scene:picnic`, `npm run scene:laufey`,
  `npm run scene:camping`, `npm run scene:collins`, `npm run scene:street`,
  `npm run scene:venues`, `npm run scene:fishing`, `npm run scene:all-nations`, then `npm run momos`) to re-add them
  (`npm run scene:first-date` only draws its cutscene; it doesn't touch the map).
- Scene scripts live in `tools/scenes/` and share helpers from
  `tools/lib/scene-kit.js` (saving with `--keep`, glow/rim-light/text helpers,
  `foliage`/`blobsIn` for leafy trees, a 3×5 sign font, previews, `stampBuilding`,
  `addTileset` (a tileset you place tile by tile, e.g. scattered props),
  `placeLamp` for a cosy street lamp — San Remo and the Palais each have one either
  side of their door path).
  Each has a named `PAL` at the top. Hand-drawn memories (school-formal,
  oxford-scholar, botanic-garden, park-picnic, first-date, laufey-concert, apollo-bay,
  camping, collins-coffee-house, all-nations-park)
  are not in
  `make-placeholders.js`. The sign font (`miniText`) has the capitals A–I, L–P,
  R–Y (no J, K, Q, Z yet), digits 0–9 and `>`.

Placeholder tile ids (tools/lib/tileset.js `T`): row 0 grass/flowers/path/cobble/
plaza/hedge, row 1 sand/shore/water(animated)/pier, row 2 walls/door/awning/roof
tops/café window, row 3 roof bottoms/fence/bench/lamp, row 4 tree (2×3: canopy
32–35 go in Above, trunks 36–37 in Decor)/rock/sign, row 5 blanket/pot/towel/
blocker(44)/grass edge.

## Sprite sheet layout (sprites/player.png)

- Frame **16×24**; sheet **64×96** = 4 columns × 4 rows.
- **Rows = directions**, top to bottom: `down`, `left`, `right`, `up`
  (`PLAYER_ROWS` in config.js). **Columns = walk frames** 0–3; column 0 is also
  the standing pose. Animations: `walk-<dir>` (8 fps), `idle-<dir>`.
- Feet sit around y = 20–23 of the frame; the collision box is
  `PLAYER.body` = 10×6 at offset (3, 17). Change config if the art changes size.
- `sprites/` also has room for a partner sheet — not used yet (TODO: follower).

## The characters (keep art consistent with these)

- **Her:** Nepali, olive to light-brown skin. Deep-pink **bob** (ends at the
  jaw; a little neck shows from behind), grown out so the black roots show;
  side-swept fringe that's dark at the root and pink at the ends. Eyebrow
  piercing (one silver pixel). No nose ring. Short **light-pink** dress, white
  shoes. The dress (walking sprite + fishing scene): puff sleeves (lighter, with
  a darker crease under them), a cream lace scoop neckline, a berry/rose sash at
  the waist tied in a **bow at the back** (tails down the skirt), soft pleats, and
  a cream **lace hem**. Colours: `herDress`/`herDressShade`/`herDressHi`/
  `herDressDeep`, sash `berry` + `roseDark`/`rose`, lace `cream`/`creamShade`.
  In side views the back of her hair sticks out 1 px past the dress so
  head and body don't merge. The chibi `figure()` draws the same dress
  (`PARTY_DRESS` in `tools/lib/cutscenes.js`, on via `partyDress` in the `HER`
  preset) for standing front/back views; side views (fishing) draw it in the scene script.
- **Him (the partner):** tall, white with a warm (not pale) skin tone, **short**
  black hair with a fringe (neck visible from back and side), open **brown
  jacket** (shoulder highlights, lapels, pockets, cuffs) over a white shirt, jeans.
- **Looks change with the date of the memory.** In October 2024
  (`all-nations-park`) she was **blonde** (long, past her shoulders) in a black
  jacket and a pink-and-white floral scarf, and he had a **buzzcut** and an
  olive-brown jacket over a purple checked shirt. In September 2024
  (`laufey-concert`, seen from behind) she had **strawberry-blonde**
  shoulder-length wavy hair, half up with a big black bow, a white ribbed
  jumper (he wears his usual brown jacket over a white shirt). Those colours live
  in each script's `PAL`; don't "fix" them to match the looks above.
- Colours live in `tools/lib/palette.js` (`her*`, `him*`, `jeans`, `silver`).
  Walking sprite: `tools/lib/sprites.js`. Cutscene figures: `HER` / `HIM` presets
  plus `figure()` in `tools/lib/cutscenes.js` (`dim` darkens them for night scenes).

## Art specs

- Everything is crisp pixel art: no anti-aliasing, no blur, PNG with alpha.
- Cutscene layers: **320×180** each, transparent where nothing is drawn,
  stacked in list order. `frames` sheets: frames left-to-right (e.g. 3 frames =
  960×180). `drift` layers should wrap seamlessly left↔right.
- **Safe areas:** the caption box covers roughly the bottom 30–50 px (taller for
  longer captions); the title band covers the top ~32 px for the first few
  seconds. Keep faces and key details between y ≈ 35 and y ≈ 130.
- Palette: soft and warm (see `tools/palettes/cosy.hex`): plums and navies for
  night, roses/peach/butter accents, sage greens, cream highlights. Avoid pure
  black outlines on big shapes; use dark plum `#2a1f2a`.
- UI: `ui/font.png` + `font.xml` (BMFont XML, white glyphs, size 9, line height
  10). Any BMFont works; add `♥`, `—`, `é` etc. if captions use them (Boot warns
  about unsupported characters). `ui/panel.png` is a 16×16 nine-slice (4 px corners).

## Saves

localStorage key `our-memories-save-v1` (`SAVE_KEY`):
`{ found: [ids], momos: [ids], letters: [ids], position: {x, y, facing}, finaleSeen }`. All access is
try/catch'd; the game runs without storage. Unknown ids in a save are ignored
in counts. A saved position inside a wall (map edited) falls back to Spawn.

## Testing checklist for changes

`npm run dev` → title → Start → walk (keys + touch) → each memory triggers →
Continue returns to the same spot → revisit prompt works → momos collect and
the top-right counter ticks up → all 10 momos + every other memory reveals the
first date ("A hidden memory appeared...") → refresh keeps progress → all found
plays finale → end of the pier: fish (cast, early press does nothing, hook on
bubbles, letter + seaweed, missed bite, the < arrow / Esc) and the letter counter persists. Test phone landscape (dev server prints a
Network URL). Check the browser console for `[memories.json]` warnings.
