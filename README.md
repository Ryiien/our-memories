# Our Memories ♥

A cosy little pixel-art game: walk around a map of our places and find the
memories hidden in it.

Built with [Phaser 4](https://phaser.io) and [Vite](https://vite.dev). No
backend; the whole game is a static website.

---

## 1. Run it

You need **Node.js 24 LTS** (or newer). On Windows you can install it with:

```
winget install OpenJS.NodeJS.LTS
```

Then, in this folder:

```
npm install        # once
npm run dev        # starts the game at http://localhost:5173
```

**On your phone:** while `npm run dev` is running, it also prints a
`Network:` address (like `http://192.168.1.20:5173`). Open that on your phone
(same Wi-Fi) and turn the phone sideways.

Other commands:

| command | what it does |
|---|---|
| `npm run build` | makes the finished website in `dist/` |
| `npm run preview` | serves `dist/` locally so you can check the build |
| `npm run placeholders` | regenerates any **missing** placeholder art/map |
| `npm run pixelate -- photo.jpg out.png` | turns a photo into pixel art (see §5) |
| `npm run scene:formal` | redraws the school formal scene + ballroom building (see §6) |
| `npm run scene:pub` | redraws the Oxford Scholar scene + the pub and RMIT buildings (see §6) |

### Controls
- **Move:** WASD or arrow keys · phone: put your thumb anywhere on the left half
- **Interact / Continue:** Space, Enter or E · phone: the ♥ button (or tap the cutscene)

### Handy for testing
- **Wipe progress:** on the title screen, hold **R** for 3 seconds (on a phone:
  press and hold her name for 3 seconds).
- Problems in the data files show as **"! N data warnings"** at the top of the
  title screen during `npm run dev`. Press F12 → Console to read them.

---

## 2. Change the text

- **Her name, title-screen text:** `data/game.json`
- **The finale message:** `data/finale.json` (`lines` type out one after another)
- **A memory's title/date/caption:** `data/memories.json`

Save the file and the dev server reloads the game by itself.

---

## 3. Add a memory

Adding a memory never needs code. You need three things:

**a) Images.** Make a folder `public/assets/memories/<id>/` (e.g. `first-kiss`)
and put the layers in it. Each layer is a **320×180 PNG** with transparency.
They're stacked in order, back to front: sky, then sea, then people, and so on.
Keep faces/important bits between about **y = 35 and y = 130**. The caption box
covers the bottom and the title covers the top for a few seconds.

**b) A JSON entry** in `data/memories.json`:

```json
{
  "id": "first-kiss",
  "title": "Under the bridge",
  "date": "May 2024",
  "caption": "It was raining and neither of us cared.",
  "hidden": false,
  "requiresAction": false,
  "unlockAfter": 0,
  "music": "audio/rain.mp3",
  "layers": [
    { "src": "memories/first-kiss/sky.png" },
    { "src": "memories/first-kiss/rain.png", "anim": "frames", "fps": 8 },
    { "src": "memories/first-kiss/us.png", "anim": "sway", "amount": 1, "speed": 0.4 }
  ]
}
```

(Remember the comma between memories, and no comma after the last one.)

- `hidden: true`: no sparkle marks the spot until it's found.
- `requiresAction: true`: only opens when she presses **E** / taps **♥** there
  (great for a bench or a sign).
- `unlockAfter: N`: stays switched off until she's found N other memories.
- `music`: optional, any `.mp3`, `.ogg` or `.wav` in `public/assets/audio/`.

**c) A trigger in the map:** see §4. Draw a rectangle on the `Triggers` layer
and give it a custom property `memoryId` = `first-kiss`.

That's it. The heart counter's total updates automatically.

### Animation presets

Every layer can have `"anim"`, plus optional `"amount"` and `"speed"`
(`speed` 1 = normal, 0.5 = half as fast, 2 = twice as fast).

| anim | looks like | `amount` (default) | good for |
|---|---|---|---|
| `none` | doesn't move | | sky, buildings |
| `slide` | gentle side-to-side | pixels each way (4) | waves, water |
| `drift` | slowly scrolls forever, wrapping round | (use `speed`; negative goes right) | clouds, fog |
| `bob` | up and down | pixels (1) | people breathing, boats |
| `sway` | leans from the bottom, like wind | pixels the top moves (2) | trees, grass, people |
| `flicker` | quick random flicker, each light separately | how much it dims, 0–1 (0.6) | distant lights, candles, fairy lights |
| `twinkle` | slow soft twinkle, each star separately | how faint, 0–1 (0.75) | stars |
| `pulse` | slow breathing glow | how much it fades, 0–1 (0.3); also `"scale"` (0.03) | moon, lamp glow, sun |
| `frames` | flip-book animation | `"fps"` (6), `"frameWidth"`/`"frameHeight"` (320/180) | anything hand-animated |

For `frames`, put the frames side by side in one PNG: 3 frames = 960×180.
For `drift`, make the left and right edges of the image match so the loop is seamless.

---

## 4. Edit the map in Tiled

1. Install [Tiled](https://www.mapeditor.org/) (free).
2. Open `maps/world.json`.
3. Paint on the layers:

| layer | what goes there |
|---|---|
| `Ground` | grass, sand, water, paths |
| `Decor` | things on the ground: buildings, fences, tree trunks, benches |
| `Above` | things drawn **over** her: treetops, lamp tops |
| `Collision` | the red ✕ tile, wherever she shouldn't walk (invisible in the game) |
| `Triggers` | rectangles (Insert Rectangle, `R`) with a custom property `memoryId` |
| `Spawn` | one point (Insert Point) named `player`: where a new game starts |

Water, walls, tree trunks, fences, rocks etc. already block her: their tiles
have a `collides = true` property in the tileset. To make another tile solid:
select it in the Tilesets panel and add a custom bool property `collides` = ✓.
Use the `Collision` layer for invisible walls.

**Adding a trigger:** select the `Triggers` layer → Insert Rectangle → drag over
the spot → in Properties, click **+**, add a `string` property named `memoryId`
with the memory's `id`.

4. Save (Ctrl+S). Keep it as **JSON**.

Important Tiled settings (already right in `world.json`):
- Map → Map Properties → **Tile Layer Format: CSV**, and **Infinite** unchecked.
- The tileset must be **embedded** in the map. If you start a new map using
  `maps/cosy.tsx`, select it in the Tilesets panel and click the **Embed
  Tileset** button.
- Tileset images live in `public/assets/tiles/`. The game finds them by file
  name.

---

## 5. Turn a photo into pixel art

```
npm run pixelate -- "C:\Photos\beach.jpg" public/assets/memories/apollo-bay/sky.png
```

It auto-rotates phone photos, crops to 16:9, shrinks to 320×180 and reduces to
24 colours. Options:

| option | what it does |
|---|---|
| `--colors 16` | fewer colours = more "pixel art" (default 24) |
| `--palette tools/palettes/cosy.hex` | snap to a fixed palette, so photos match the game (also `.gpl`, `.json`, or a `.png` of swatches; Lospec palettes work) |
| `--crop top` | which part to keep: `centre` (default), `top`, `bottom`, `left`, `right`, `attention` (automatic) |
| `--resample smooth` | softer, less noisy result for busy photos (default `nearest`, crunchier) |
| `--dither ordered` | classic pixel-art checker shading (`floyd` = more photographic) |

Tips: use the photo as the **background layer**, then draw the two of you (and
lights, stars, etc.) as separate transparent layers on top so they can animate.
iPhone HEIC photos need exporting as JPEG first.

---

## 6. Replace the placeholder art

All placeholders were made by `tools/make-placeholders.js`. Just overwrite the
files with your own (same name and size). The generator **never overwrites
existing files** unless you run it with `--force`, so re-running it is safe.

| file | size / layout |
|---|---|
| `public/assets/sprites/player.png` | 64×96: 4×4 frames of 16×24. Rows: down, left, right, up. Columns: 4 walk frames; the first is also "standing" |
| `public/assets/tiles/tileset.png` | 128×96: 8×6 tiles of 16×16. Keep tiles in the same positions, or repaint the map in Tiled |
| `public/assets/memories/<id>/*.png` | 320×180 each (frames sheets: N×320 wide) |
| `public/assets/memories/finale/*.png` | 320×180 each, used by `data/finale.json` |
| `public/assets/ui/heart.png` | 9×9 HUD heart |
| `public/assets/ui/continue-heart.png` | 15×13 Continue button heart |
| `public/assets/ui/panel.png` | 16×16 box, stretched as a nine-slice with 4 px corners |
| `public/assets/ui/sparkle.png` | 64×16: 4 frames of 16×16, the "memory here!" marker |
| `public/assets/ui/joystick-base.png`, `joystick-knob.png`, `action-button.png` | 40×40, 18×18, 30×30 (phone controls) |
| `public/assets/ui/font.png` + `font.xml` | a BMFont (XML) bitmap font, white glyphs |
| `public/assets/audio/*` | music: `.mp3`/`.ogg`/`.wav` |
| `public/assets/audio/formal.mp3` | **expected, not included yet:** the school formal's slow-dance song. Until it exists, that scene plays silently |
| `public/assets/tiles/hall.png` | 160×112: the ballroom building, 10×7 tiles (its own tileset in the map) |
| `public/assets/tiles/oxford-scholar.png` | 128×96: the pub, 8×6 tiles (its own tileset in the map) |
| `public/assets/tiles/rmit.png` | 80×96: RMIT's Building 80 next door, 5×6 tiles |

If the player sprite size changes, update `PLAYER` in `src/config.js`.

### The school formal scene

The formal is drawn by its own script, `tools/scenes/school-formal.js`. Change
the colours in `PAL` at the top, then run:

```
npm run scene:formal                     # redraws all its layers + the building
npm run scene:formal -- --keep us,bg     # keep layers you've redrawn yourself
```

It also writes a flattened preview to `tools/previews/school-formal.png` (and
the building to `tools/previews/school-hall.png`). The first run added the
ballroom and its trigger to the map; later runs leave the map alone.

Layers in `public/assets/memories/school-formal/` (back to front):

| file | size | contents | anim |
|---|---|---|---|
| `bg.png` | 320×180 (opaque) | ceiling, walls, drapes, floor, tables | none |
| `chandeliers.png` | 320×180 | chandeliers + glow | pulse (very subtle) |
| `sparkles.png` | 320×180 | crystal glints + fairy-light bulbs | twinkle |
| `dancers-back.png` | 320×180 | far couples, feet on y = 120 | sway |
| `dancers-mid.png` | 320×180 | nearer couples, feet on y ≈ 132 | sway (different speed) |
| `spotlight.png` | 320×180 | warm light cone + floor pool | pulse (very subtle) |
| `us.png` | **1280×180**: 4 frames of 320×180 side by side | the two of you slow dancing | frames, 3 fps |
| `vignette.png` | 320×180 | dark edges, clear centre | none |

Keep the two of you between about y = 92 and y = 142, around x = 160. The
caption box covers the bottom of the frame.

### The Oxford Scholar scene

The pub (the one next to RMIT) is drawn by `tools/scenes/oxford-scholar.js`,
the same way: change `PAL` at the top, then

```
npm run scene:pub                        # redraws all its layers + both buildings
npm run scene:pub -- --keep us,table     # keep layers you've redrawn yourself
```

Previews: `tools/previews/oxford-scholar.png` and
`tools/previews/oxford-scholar-street.png`. The first run turned the café on
the map into the pub (same spot, same trigger) and put RMIT next door; later
runs leave the map alone.

Layers in `public/assets/memories/oxford-scholar/` (back to front):

| file | size | contents | anim |
|---|---|---|---|
| `street.png` | 320×180 (opaque) | Swanston St at dusk: towers, plane tree, Building 80 + RMIT sign | none |
| `street-lights.png` | 320×180 | lit office windows, shopfronts, street lamp | flicker |
| `tram.png` | **960×180** | one tram, in a wide strip so it only comes past now and then | drift, speed 4 |
| `interior.png` | 320×180, window glass see-through | brick walls, timber window, RMIT banner, pub sign, tote bag + books, lamp shades | none |
| `lamps.png` | 320×180 | glow under the pendant lamps | pulse (subtle) |
| `table.png` | 320×180 | high table, stools, fries, tomato sauce | none |
| `us.png` | **2560×180**: 8 frames | the two of you clinking glasses (breathing + blinks) | frames, 3 fps |
| `steam.png` | **3840×180**: 12 frames | steam off the fries, bubbles in the pint, the clink sparkle | frames, 4 fps |
| `vignette.png` | 320×180 | soft dark edges | none |

The glasses and hands sit in the same place in every frame of `us.png`, so the
beer bubbles and the clink in `steam.png` line up with them.

---

## 7. Put it online (GitHub Pages)

1. Create a GitHub repository and push this folder to its `main` branch.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` now builds and publishes the game automatically
   (see the **Actions** tab). It will be at
   `https://<your-username>.github.io/<repo-name>/`.

The game uses relative paths, so it works under any repository name or domain.

Tip: a private repo can still publish Pages on paid plans; on a free plan the
repo needs to be public (the URL itself isn't listed anywhere).

---

## Troubleshooting

- **A memory never triggers:** check the browser console for `[memories.json]`
  warnings. The trigger's `memoryId` must exactly match the memory's `id`. If
  it has `unlockAfter`, she needs to find that many others first.
- **A layer is missing in a cutscene:** the console says which file it looked
  for. Paths in JSON start *inside* `public/assets/`, e.g.
  `memories/beach/sky.png`.
- **Text has gaps:** the pixel font lacks that character (the console lists
  which ones). Rephrase, or add the glyph to `tools/lib/font.js` and run
  `npm run placeholders -- --force` (careful: `--force` also overwrites the
  other placeholder files).
- **Map won't load after editing:** make sure the tileset is embedded, the layer
  format is CSV, and the map isn't infinite.
