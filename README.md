# VICE GRID — GTA-style cover art studio

Turn any photo into cover art in the style of a GTA poster — a collage of photo panels over a Vice City sunset, heavy poster lettering for your caption, badges and film grain — and export it as a PNG in **1080 × 1080**, **1080 × 1350** or **1920 × 1080**.

It runs entirely in your browser from its own files: no server, no upload, no network request. Your photos never leave your machine.

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

## What it does

- **Any photo.** Drop one photo or several. Each panel keeps its own photo, its own crop, its own zoom; drag a panel to reposition it, scroll to zoom. Panels fill cover-style, so nothing is stretched.
- **Five layouts.** Collage (the dense poster grid), Triptych, Hero, Solo (one photo, lettering straight on the art) and Nine.
- **Five colour grades.** Sunset, Neon, Midnight, Gold and Chrome — a teal-and-orange split tone, bloom, vignette and film grain over the whole collage, with sliders for grade strength, grain and bloom.
- **Lettering.** Your caption is set in Anton, fitted to the poster, with a gradient fill, a hard drop shadow and a neon underglow; a subtitle and three editable badges above and below it. All of it is drawn on the canvas, so it exports with the image.
- **Three post sizes** and one click from a photo to a PNG.

## Run it

```bash
node serve.ts        # serves app/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. No install, no build step: `app/` is plain static files (an `index.html`, ES modules, CSS, two open-licence fonts under `app/fonts/` and four sample photos under `app/samples/`).

The entry program is `main.ts` (Node 22, standard library only): it copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json`.

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
