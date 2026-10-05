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
| `npm run scene:garden` | redraws the botanic garden scene + the garden on the map (see §6) |
| `npm run scene:picnic` | redraws the picnic scene + the picnic on the map (see §6) |
| `npm run scene:first-date` | redraws the first date scene (street, bus stop, the two of you) (see §6) |
| `npm run scene:laufey` | redraws the Laufey concert scene + the Palais Theatre on the map (see §6) |
| `npm run scene:beach` | redraws the night on the beach scene (see §6) |

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
| `public/assets/tiles/palais.png` | 160×112: the Palais Theatre, 10×7 tiles (its own tileset in the map) |
| `public/assets/tiles/picnic.png` | 64×32: the picnic on the map, 4×2 tiles (bikes on top, solid; blanket below, walkable) |
| `public/assets/tiles/garden.png` | 320×144: the botanic garden, 10×9 tiles, drawn twice side by side (the second copy is the water's shimmer frame) |

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

### The botanic garden scene

The Dandenong Ranges Botanic Garden day (based on the photo of the two of you
at the pond railing) is drawn by `tools/scenes/botanic-garden.js`: change
`PAL` at the top, then

```
npm run scene:garden                     # redraws all its layers + the garden tiles
npm run scene:garden -- --keep us,pond   # keep layers you've redrawn yourself
```

Previews: `tools/previews/botanic-garden.png` and
`tools/previews/botanic-garden-map.png`. The first run put the garden in the
bottom-right corner of the map (a pond with a boardwalk out to a lookout deck,
tiles x 50–59, y 29–37), a path running straight down to it from the main
path, and the trigger on the deck. It also moved the picnic off that path, to
the open grass further west (tiles x 29–32, y 25–27). Later runs leave the map
alone.

Layers in `public/assets/memories/botanic-garden/` (back to front):

| file | size | contents | anim |
|---|---|---|---|
| `sky.png` | 320×180 (opaque) | bright hazy sky, brightest top right | none |
| `trees-back.png` | 320×180 | misty forest + the tall gums | sway (slow) |
| `trees-autumn.png` | 320×180 | golden / orange / green trees, shrubs on the far bank | sway |
| `pond.png` | 320×180 | still water mirroring the trees | none |
| `glints.png` | 320×180 | sun sparkling on the water | twinkle |
| `reeds.png` | 320×180 | rushes and cattails | sway |
| `deck.png` | 320×180 | the boardwalk you're standing on | none |
| `us.png` | **2560×180**: 8 frames | the two of you at the railing, her head on his shoulder (breathing + blinks) | frames, 3 fps |
| `railing.png` | 320×180 | weathered timber railing in front | none |
| `leaves.png` | **7680×180**: 24 frames | a few autumn leaves drifting down | frames, 6 fps |
| `haze.png` | 320×180 | warm sunlight from the top right | pulse (subtle) |

Her hands rest on top of the railing (y = 125), so they line up in every frame.

### The picnic scene

The two of you lying on a blanket in the park facing each other, reading with a
drink each, your bikes standing in the grass behind (drawn from photos: his
yellow road bike with a white fork and front rack, her plum-purple mountain bike).
Drawn by `tools/scenes/park-picnic.js`: change `PAL` at the top, then

```
npm run scene:picnic                     # redraws all its layers + the map picnic
npm run scene:picnic -- --keep us,bikes  # keep layers you've redrawn yourself
```

Previews: `tools/previews/park-picnic.png` and
`tools/previews/park-picnic-map.png`. The first run swapped the plain blanket
on the map for your picnic (bikes + blanket with books and drinks) at the
picnic trigger's top-left; later runs leave the map alone.

Layers in `public/assets/memories/park-picnic/` (back to front):

| file | size | contents | anim |
|---|---|---|---|
| `sky.png` | 320×180 (opaque) | clear sky + soft hills | none |
| `sun.png` | 320×180 | the sun, top left | pulse |
| `clouds.png` | 320×180 | clouds (wrap left↔right) | drift |
| `ground.png` | 320×180 | grass, wildflowers, the gingham blanket | none |
| `trees.png` | 320×180 | a shady tree each side, bushes | sway |
| `bikes.png` | 320×180 | his yellow road bike, her purple mountain bike (shapes + colours in `HIS_BIKE` / `HER_BIKE`) | none |
| `us.png` | **2560×180**: 8 frames | the two of you reading, feet kicking slowly (+ blinks) | frames, 3 fps |
| `butterflies.png` | **1280×180**: 4 frames | two butterflies | frames, 5 fps |

This scene used to be a generated placeholder; `npm run placeholders` no longer
touches it.

### The first date scene

The lamp-lit street at dusk with the two of you under the lamp, and the bus stop
beside you: a glass shelter (orange roof edge, yellow strip, bench) and a PT
sign for the routes in `BUS_ROUTES` (513, 514, 903). Drawn by
`tools/scenes/first-date.js`: change `PAL` / `BUS_ROUTES` at the top, then

```
npm run scene:first-date                       # redraws all its layers
npm run scene:first-date -- --keep us,street   # keep layers you've redrawn yourself
```

Preview: `tools/previews/first-date.png`. Layers in
`public/assets/memories/first-date/` (back to front): `sky.png`, `stars.png`
(twinkle), `street.png`, `windows.png` (flicker), `bus-stop.png`, `glow.png`
(pulse), `us.png` (sway). Like the picnic, it's no longer touched by
`npm run placeholders`.

### The beach scene

The night on the beach at Apollo Bay: moon, stars, the town's lights on the
headland, the moon's path on the sea, foam creeping up the sand, and the two of
you sitting cross-legged on a blanket, seen from behind (you stay still; the
world around you moves). Drawn by `tools/scenes/apollo-bay.js`: change `PAL`
at the top, then

```
npm run scene:beach                      # redraws all its layers
npm run scene:beach -- --keep us,sand    # keep layers you've redrawn yourself
```

Preview: `tools/previews/apollo-bay.png`. Layers in
`public/assets/memories/apollo-bay/` (back to front): `sky.png`, `stars.png`
(twinkle), `glow.png` (pulse), `lights.png` (flicker), `sea.png` (slide),
`sand.png`, `foam.png` (3 frames), `us.png` (still). No longer touched by
`npm run placeholders`.

### The Laufey concert scene

Laufey at the Palais Theatre, seen from your balcony seats: the gilded arch,
red velvet curtain, lighting truss and speakers, Laufey at the mic beside a
grand piano, and the two of you from behind in your paper crowns (hers pink,
his blue). Drawn by `tools/scenes/laufey-concert.js`: change `PAL` at the top,
then

```
npm run scene:laufey                     # redraws all its layers + the building
npm run scene:laufey -- --keep us,hall   # keep layers you've redrawn yourself
```

Previews: `tools/previews/laufey-concert.png` and `tools/previews/palais.png`.
The first run put the Palais on the map (tiles x 19–28, y 12–18, across the pub
path from San Remo, doors facing the main path) with its trigger at the doors;
later runs leave the map alone.

Layers in `public/assets/memories/laufey-concert/` (back to front):

| file | size | contents | anim |
|---|---|---|---|
| `hall.png` | 320×180 (opaque) | auditorium, gilded arch, curtain, stage, truss, speakers, piano | none |
| `lights.png` | 320×180 | lamp glows, soft beams, the spotlight on Laufey | pulse |
| `laufey.png` | 320×180 | Laufey at the mic | sway |
| `notes.png` | **5120×180**: 16 frames | music notes floating up | frames, 4 fps |
| `crowd.png` | 320×180 | heads in the stalls | none |
| `phones.png` | 320×180 | a few phone screens | twinkle |
| `balcony.png` | 320×180 | the red velvet balcony ledge + brass rail | none |
| `us.png` | **2560×180**: 8 frames | the two of you from behind, crowns on, swaying a little | frames, 3 fps |
| `seats.png` | 320×180 | the backs of your row of red velvet seats, right behind you | none |
| `vignette.png` | 320×180 | dark edges | none |

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
