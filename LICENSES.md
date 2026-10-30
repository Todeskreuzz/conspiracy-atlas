# Licenses and third-party material

## Project code and artwork
All source code in this repository and the card artwork in `public/media/cards/` and
`public/favicon.svg` were written for this project. The only third-party images are the
case file photographs listed below.

## Case file photographs
Freely licensed photographs used as cover images of the seed case files, resized and compressed.
They illustrate the topic only and are not presented as evidence for any claim.

| File | Shows | Author | License | Source |
|---|---|---|---|---|
| `public/media/theories/moon-landing-conspiracy-theory.jpg` | Buzz Aldrin on the Moon, Apollo 11 (AS11-40-5903) | Neil A. Armstrong / NASA | Public domain | https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg |
| `public/media/theories/illuminati-narratives.jpg` | Portrait of Adam Weishaupt (RP-P-1914-2087) | Rijksmuseum | CC0 | https://commons.wikimedia.org/wiki/File:Portret_van_Adam_Weishaupt,_RP-P-1914-2087.jpg |
| `public/media/theories/mkultra.jpg` | Declassified MKUltra document | Central Intelligence Agency | Public domain | https://commons.wikimedia.org/wiki/File:DeclassifiedMKULTRA.jpg |
| `public/media/theories/operation-northwoods.jpg` | Northwoods memorandum, first page (13 March 1962) | U.S. Joint Chiefs of Staff | Public domain | https://commons.wikimedia.org/wiki/File:NorthwoodsMemorandum.jpg |
| `public/media/theories/watergate.jpg` | The Watergate complex from the air (2006) | Indutiomarus (English Wikipedia) | Public domain | https://commons.wikimedia.org/wiki/File:WatergateFromAir.JPG |
| `public/media/theories/area-51.jpg` | Groom Lake and Papoose Lake (2010) | Doc Searls | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Groom_Lake_and_Papoose_Lake.jpg |
| `public/media/theories/chemtrail-claims.jpg` | Contrails, 3 May 2025 | M. Cristian-Ioan | CC0 | https://commons.wikimedia.org/wiki/File:Contrails_3May_2025_(33).jpg |
| `public/media/theories/jfk-related-conspiracy-narratives.jpg` | President Kennedy in the Dallas motorcade, 22 November 1963 | Walt Cisco, Dallas Morning News | Public domain | https://commons.wikimedia.org/wiki/File:JFK_limousine.png |
| `public/media/theories/tuskegee-syphilis-study.jpg` | Doctor drawing blood from a participant of the Tuskegee syphilis study | National Archives at Atlanta (U.S. government) | Public domain | https://commons.wikimedia.org/wiki/File:Tuskegee-syphilis-study_doctor-injecting-subject.jpg |
| `public/media/theories/cointelpro.jpg` | FBI COINTELPRO document on "neutralizing" the actress Jean Seberg | Richard W. Held / FBI | Public domain | https://commons.wikimedia.org/wiki/File:COINTELPRO_-_Jean_Seberg.jpg |
| `public/media/theories/gulf-of-tonkin-incident.jpg` | The destroyer USS Maddox (DD-731) underway, early 1960s (NH 97900) | U.S. Navy / Naval History and Heritage Command | Public domain | https://commons.wikimedia.org/wiki/File:USS_Maddox_(DD-731)_underway_at_sea,_circa_the_early_1960s_(NH_97900).jpg |
| `public/media/theories/operation-paperclip.jpg` | Operation Paperclip team of German rocket scientists at Fort Bliss, Texas (1946) | U.S. Army / NASA | Public domain | https://commons.wikimedia.org/wiki/File:Project_Paperclip_Team_at_Fort_Bliss.jpg |
| `public/media/theories/roswell-incident.jpg` | Roswell Daily Record front page, 8 July 1947 | Roswell Daily Record | Public domain | https://commons.wikimedia.org/wiki/File:Roswell_Daily_Record._July_8,_1947._RAAF_Captures_Flying_Saucer_On_Ranch_in_Roswell_Region._Top_of_front_page.jpg |
| `public/media/theories/reichstag-fire.jpg` | Firemen at the burning Reichstag building, February 1933 (NARA 535790) | U.S. National Archives (NARA) | Public domain | https://commons.wikimedia.org/wiki/File:Firemen_work_on_the_burning_Reichstag_Building_in_February,_1933,_after_fire_broke_out_simultaneously_at_20_places...._-_NARA_-_535790.tif |

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

## Automatically imported content
Entries imported by the automatic archive import (`server/importer.ts`) use text from English
Wikipedia under CC BY-SA 4.0; each entry names and links its article. Their cover photos are freely
licensed Wikimedia Commons files, downloaded once and stored in D1; the author and licence are shown
on the photo and the file page is listed as a source. Cases without a photo of their own show one of
the category symbol photos listed in `SYMBOL_IMAGES` (also free Commons files, captioned "Symbolbild").
