# VICE GRID — GTA-style cover art studio

Turn any photo into cover art in the style of a GTA poster — a collage of photo panels over a Vice City sunset, heavy poster lettering for your caption, badges and film grain — and export it as a PNG in **1080 × 1080**, **1080 × 1350** or **1920 × 1080**.

It runs entirely in your browser from its own files: no server, no upload, no network request. Your photos never leave your machine.

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

## What it does

VICE GRID is one page, three zones: a top bar with the brand, the size chips and **Export PNG**; a stage holding the live cover canvas; and a scrollable inspector where everything is edited. A thin `1 Photo · 2 Caption · 3 Export` stepper under the bar shows where you are in the flow. The cover itself is drawn on a single `<canvas>` at the export resolution — the preview is that same canvas scaled down, so what you see is exactly the PNG you get.

- **Photos.** Drag a photo or several onto the stage, use **Add photos**, or click one of the four bundled sample thumbnails to start immediately. Loaded photos are dealt out across the panels in order and cycle when there are fewer photos than panels; any panel can be pointed at any loaded photo from the **Selected panel** card. Panels fill cover-style, so no photo is ever stretched.
- **Editing a panel.** Click a panel to select it (an accent outline and a `Panel N / 6` tag make it obvious), drag on it to pan its photo, scroll over the stage to zoom it, or use the zoom slider and **Reset focus**. Each panel keeps its own crop and zoom.
- **Lettering.** Your caption is set in Anton and fitted to the poster by binary search, wrapped to at most two balanced lines, with a vertical gradient fill, a dark outline, a hard drop shadow and a neon underglow. A wide-tracked subtitle sits above it and three editable badges below it. Everything is drawn on the canvas, so it exports with the image.
- **Look.** Five colour-grade presets with independent sliders for grade strength, grain and bloom. The grade adds a warm-to-cool split, a teal-orange duotone lift, bloom, a vignette and deterministic film grain, so rendering the same state twice gives the same pixels.
- **Export.** One click encodes the canvas to a PNG, downloads it as `vice-grid-<w>x<h>.png` and shows a toast. Nothing is uploaded.

Keyboard: `1`–`5` switch layouts, `E` exports.

## The five layouts

| Layout | Panels | Idea |
| --- | --- | --- |
| **Collage** | 6 | The dense, irregular poster grid; the default. |
| **Triptych** | 3 | Three equal vertical panels above the title band. |
| **Hero** | 4 | One large panel with three stacked thumbnails down the side. |
| **Solo** | 1 | One full-bleed photo with the lettering straight on the art. |
| **Nine** | 9 | A 3 × 3 grid. |

Every layout works in all three aspect ratios; panel geometry is computed from the cover's width and height, with a thin gutter of the sunset background between panels.

## The five grades

| Preset | Warms | Cools |
| --- | --- | --- |
| **Sunset** | `#ff7a3c` | `#00c8b4` |
| **Neon** | `#ff2d95` | `#22e0ff` |
| **Midnight** | `#ff8a3d` | `#2a2a8f` (darker exposure) |
| **Gold** | `#ffc24a` | `#7a4a12` |
| **Chrome** | `#e8e8ff` | `#3b5bff` (lower saturation) |

## The three post sizes

- **1080 × 1080** — square, for the feed.
- **1080 × 1350** — 4:5 portrait.
- **1920 × 1080** — 16:9 wide.

The size chips live in the top bar and again in the Export card, so they are always one click away.

## Run it

```bash
node serve.ts        # serves app/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. No install, no build step: `app/` is plain static files (an `index.html`, ES modules, CSS, three open-licence fonts under `app/fonts/` and sample photos under `app/samples/`).

The entry program is `main.ts` (Node 22, standard library only): it checks that `app/index.html` exists and `screenshots/` holds at least three images, then copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json`.

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

`screenshots/` holds the app at work: an exported 1920 × 1080 cover, the editor with a photo loaded, a 1080 × 1350 cover, and the export result.

## Credits and licences

- Code: MIT (see `LICENSE`).
- Fonts: Anton, Archivo Black and Barlow Condensed, each under the SIL Open Font License 1.1 (licence texts under `app/fonts/`).
- Sample photos: made with an image model for this project, free to use.
- Not affiliated with Rockstar Games or Take-Two Interactive. No game artwork, logo or font is used; every layout, mark and lettering treatment here is original.
