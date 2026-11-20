# SOLARIS VICE — GTA-style cover art studio

Turns your own photos and a caption into multi-panel cover art in the style of a 1986 Florida
crime poster, and exports a PNG in 1080x1080, 1080x1350 and 1920x1080. Everything runs offline in
the browser: no upload, no network, no build step. The photos you drop in never leave the tab —
they are decoded, graded, composed and encoded on the canvas you see.

## Features

- Six layouts: poster, collage, triptych, hero, solo, nine.
- Five grades: sunset, neon, gold, chrome, noir.
- Per-panel pan/zoom crop with drag and wheel.
- Editable title, script subtitle, pull quote, volume, tagline and six role chips.
- Duotone gradient map, halftone, bloom, grain and vignette.
- Three export sizes with one-click PNG.

## Run it

`node serve.ts` then open http://localhost:8080

## Entry program

`MAKEFUN_OUTPUT_DIR=out node main.ts`

## Screenshots

- `screenshots/1-cover-1920x1080.jpg` — landscape cover, sunset palette, six-photo poster layout.
- `screenshots/2-editor-1080x1350.jpg` — the whole studio: controls, six-photo filmstrip, live preview.
- `screenshots/3-cover-1080x1350.jpg` — portrait cover, neon palette, "Moonlight Mile".
- `screenshots/4-cover-1080x1080.jpg` — square collage, gold palette, "Golden Hour".

## Credits and licences

The code is MIT licensed — see `LICENSE`. The fonts Anton, Archivo Black, Barlow Condensed and
Pacifico each ship under the SIL Open Font License 1.1, with the licence texts in `app/fonts/`.
The sample photos were generated with an image model for this project.

Not affiliated with Rockstar Games or Take-Two Interactive. No game artwork, logo or font is used.
