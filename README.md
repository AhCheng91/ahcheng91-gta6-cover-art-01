[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# SOLARIS VICE — 1986 cover studio

Drop in your own photographs and the studio composes a 1986 Florida crime-poster cover
in the browser. Each photo is clipped to a comic-book panel — one cut corner, a crisp
cream keyline, even gutters over a magenta-indigo backdrop — and graded bright and
sunlit rather than dimmed: warm highlights, lifted shadows, faces left readable.

Over the panels sit the pieces that make it read as a video-box cover: an outrun-striped
3D title (cream to gold to orange to hot pink bands, keyline, plum extrusion, star glint),
a neon script subtitle, a tagline ribbon, the star strip with its pull quote and volume
chip, a gold serrated seal, a crisp barcode and a `COMING SOON` footer.

- **Three export sizes** — 1080 × 1080, 1080 × 1350 and 1920 × 1080, each rendered at
  its true resolution, not upscaled from the preview.
- **Five grade palettes** — Sunset, Neon, Midnight, Gold and Chrome.
- **Six layouts** — Poster, Collage, Triptych, Hero, Solo and Nine, each re-gridded for
  the canvas ratio: the 16:9 Poster carries seven panels, the 4:5 cover four and the
  square six.
- **Per-panel framing** — click a panel, drag to pan, scroll or slide to zoom; keys
  `1`–`6` switch layouts and `E` exports.
- **Offline** — no build step, no network, no upload: photos are read with object URLs
  and never leave the machine.

## How it works

- `state.js` — sizes, palettes, layouts, roles, the default caption and the store.
- `util.js` — seeded PRNG, colour and canvas helpers.
- `photos.js` — sample manifest, image loading, font loading.
- `panels.js` — panel geometry per layout and size, cover-fit, cut corners.
- `backdrop.js` — sunset ramp, sun disc, skyline, palms, stars.
- `grade.js` — the sunlit per-panel treatment and the film/grain pass.
- `lettering.js` — title fitting and drawing, script, ribbon, chips, quote strip.
- `furniture.js` — seal, barcode, footer, volume chip.
- `render.js` — draws backdrop, panels, lettering and furniture in order.
- `exporter.js` — PNG encode and filename.
- `main.js` — the editor: inspector, pointer interaction, keyboard.
- `shots.js` — the `?shot=` scenes used for the screenshots.

## Screenshots

- `screenshots/1-cover-1920x1080.jpg` — the widescreen Poster cover with the striped title.
- `screenshots/2-editor-1080x1350.jpg` — the editor at 4:5: stage, inspector and export card.
- `screenshots/3-cover-1080x1350.jpg` — a 4:5 cover with its four-panel layout.
- `screenshots/4-cover-1080x1080.jpg` — a square cover with its six-panel grid.

## Run it

From the repository root:

```sh
python3 -m http.server
```

Then open <http://localhost:8000/app/>. No build, nothing to install. `main.ts` stages
the entry instead: `app/` and `screenshots/` copied into `MAKEFUN_OUTPUT_DIR` (default
`/output`), then `dossier.json` written with `buildDossier` from `vendor/makefun-app.ts`.

## Licences

- The code, `main.ts` included, is MIT licensed; see `LICENSE`.
- The four fonts are under the SIL Open Font License, with their texts in `app/fonts/`:
  Anton (`OFL-Anton.txt`), Archivo Black (`OFL-ArchivoBlack.txt`), Barlow Condensed
  (`OFL-BarlowCondensed.txt`) and Pacifico (`LICENSE-Pacifico-OFL.txt`).
- The sample photographs in `app/samples/` were made with an image model for this project.

This repository is an entry in make.fun's [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) bounty.
