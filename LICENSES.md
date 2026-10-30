# Licenses and third-party material

## Project code and artwork
All source code in this repository and the card artwork in `public/media/cards/` and
`public/favicon.svg` were written for this project. No stock images or third-party
illustrations are included.

## Runtime libraries (bundled into the site)
| Package | Version | License |
|---|---|---|
| react, react-dom | 19.3 | MIT |
| react-router-dom | 7.18 | MIT |
| cytoscape | 3.34 | MIT |
| @tiptap/react, @tiptap/starter-kit, @tiptap/pm (incl. ProseMirror) | 3.32 | MIT |
| leaflet | 1.9.4 | BSD-2-Clause |
| topojson-client | 3.1 | ISC |
| hono (API, runs in Pages Functions) | 4.13 | MIT |

## Fonts (self-hosted via @fontsource, no external font CDN)
| Font | License |
|---|---|
| Playfair Display | SIL Open Font License 1.1 |
| IBM Plex Sans, IBM Plex Mono | SIL Open Font License 1.1 |
| Special Elite | Apache License 2.0 |

## Map data
Country outlines come from the `world-atlas` package (ISC), which is derived from
**Natural Earth** 1:110m data (public domain, https://www.naturalearthdata.com/).
The map is rendered entirely from this bundled file. No tile server or map API is used.

## Archive content
Texts in the seed archive (`data/seed.mjs`) are original summaries. Cited works remain the
property of their authors and publishers; the archive only links to them and quotes titles.
