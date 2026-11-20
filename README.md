[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhCheng91/ahcheng91-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# SOLARIS VICE — cover art studio

Turn your own photographs into 1986-Florida crime-poster cover art. Pick a layout, drop in
photos, type a caption, and the studio paints one canvas: hard-sunset duotone, halftone dots,
blooming neon and a film-grain finish, with a hand-set title sunk into the lower half of the
frame. Then export a PNG at 1080×1080, 1080×1350 or 1920×1080.

Everything happens in the browser. There is no server behind it, no account, no upload and no
network call after the page loads: your photos are read with `FileReader`/object URLs and never
leave the machine. The page loads its own fonts, scripts and sample photos from `app/`, so it
works from `file://` as well as from a local server.

## What is in the studio

**Six layouts.** Poster (three portraits over three wide panels, the title across the lower
band), Collage (six unequal panels, a poster wall), Triptych (three full-height columns), Hero
(one large hero shot with three stacked panels beside it), Solo (a single full-bleed frame) and
Nine (a 3×3 contact sheet). Each layout reshuffles its panel grid for portrait and landscape
canvases, so a 4:5 cover is not a stretched 16:9 one.

**Five grades.** Sunset, Neon, Gold, Chrome and Noir. A grade is a gradient map (shadows, mids,
accent, highlights) plus the sky and water colours used by the painted backdrop: the sun, the
palms, the skyline, the causeway and the wet street under the car. Each one is a single duotone
ramp applied to every panel, which is what makes six unrelated photos read as one poster.

**Per-panel framing.** Click any panel to select it, drag to pan the photo inside its frame and
scroll (or use the zoom slider) to push in. `RESET CROP` puts the framing back and `CYCLE PHOTO`
walks that panel through the loaded photos. Framing is per panel and per photo, so one shot can
be tight on a face in panel 3 and loose on a skyline in panel 6.

**The caption.** Five editable fields — title, subtitle (set in the script face), pull quote,
volume and tagline — plus six role chips (`THE DRIVER`, `THE BOSS`, `THE INSIDER`, `THE RIDER`,
`THE COURIER`, `THE LAWYER` by default). The title is measured and re-fitted as you type: it
splits into balanced lines, chooses its own size, and never overflows the safe area. The role
chips are drawn as small dark plates pinned to their panels.

**The print treatment.** After a panel is drawn it goes through one pass: the duotone gradient
map at the chosen grade strength, a halftone dot screen scaled to the panel, a bloom pass over
the bright areas, a vignette, and a grain tile seeded from the title so the same cover always
looks the same. On top of that the studio prints the things a 1986 video box had: the five-star
strip, the volume roundel, the pull quote, the tagline band, a barcode and the "original cover
art" seal.

## Export

Three sizes, from the chips in the top bar or the Export card:

| Size | Use |
| --- | --- |
| 1080 × 1080 | square feed post |
| 1080 × 1350 | 4:5 portrait post |
| 1920 × 1080 | 16:9 widescreen |

The canvas is re-rendered at the export resolution before encoding, so the PNG is a true
1080×1080 / 1080×1350 / 1920×1080 file, not an upscale of the preview. Files are named
`solaris-vice-<width>x<height>.png`. Keyboard: `1`–`6` pick a layout, `E` exports.

## Running it

```sh
node serve.ts
# then open http://localhost:8080
```

`serve.ts` is a small static server (Node 22, standard library only) that serves `app/` with the
right MIME types and refuses any path outside it. There is no build step and nothing to install:
`app/` is plain HTML, CSS, ES modules and fonts, and the page can also be opened directly from
disk.

To stage the entry — copy `app/` and `screenshots/` into an output directory and write the
dossier that describes them:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` resolves every path from its own location (`import.meta.url`), never from the current
working directory, and defaults to `/output` when `MAKEFUN_OUTPUT_DIR` is unset. It copies
`app/` recursively, copies `screenshots/` when present, and writes `dossier.json` with
`buildDossier` from `vendor/makefun-app.ts`.

## Screenshots

- `screenshots/1-cover-1920x1080.jpg` — the widescreen 16:9 cover in the Sunset grade, Poster
  layout: three portraits over three wide panels, `SOLARIS VICE` set across the lower band with
  the script subtitle, six role plates, the star strip, tagline, barcode and seal.
- `screenshots/2-editor-1080x1350.jpg` — the studio itself at 4:5: layout grid, five grade
  swatches, grade/grain/bloom sliders, the caption fields, the six role chips and the photo
  strip, with the live preview in the middle and the export card on the right.
- `screenshots/3-cover-1080x1350.jpg` — a 4:5 export in the Chrome grade: `MOONLIGHT MILE` over
  a cooler blue-grey ramp, showing how the same layout reads at portrait proportions.
- `screenshots/4-cover-1080x1080.jpg` — a square 1080×1080 export in the Gold grade: `GOLDEN
  HOUR`, the title filling the frame under the three portraits, with the coast tagline band.

## Licences

- The code in this repository (including `main.ts`, `serve.ts` and everything under `app/src/`)
  is MIT licensed; see `LICENSE`.
- The four fonts are under the SIL Open Font License 1.1, with their texts in `app/fonts/`:
  Anton (`OFL-Anton.txt`), Archivo Black (`OFL-ArchivoBlack.txt`), Barlow Condensed
  (`OFL-BarlowCondensed.txt`) and Pacifico (`LICENSE-Pacifico-OFL.txt`).
- The sample photographs in `app/samples/` were made with an image model for this project, so
  the studio has something to show on first load without asking for your photos.
