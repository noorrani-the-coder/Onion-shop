# Commodity photos for the arrivals board

Drop a **cutout PNG** (transparent background, roughly square) here, named for
the commodity. The arrivals board embeds it in place of the hand-drawn vector
icon; with no file it falls back to the vector.

| File | Used for |
|---|---|
| `onion.png` | ONION (and EB / BIG / GOLTA / CHOPDA / MUKKAL / MEDIUM grades) |
| `potato.png` | POTATO / AALU / ALOO |
| `garlic.png` | GARLIC / LEHSUN / BELLULLI |
| `ginger.png` | GINGER / ADRAK / SHUNTHI |
| `tomato.png` | TOMATO |
| `chilli.png` | CHILLI / MIRCHI |
| `lemon.png` | LEMON / NIMBU |
| `carrot.png` | CARROT / GAJAR |
| `cabbage.png` | CABBAGE |

Notes:

- `.jpg` / `.jpeg` also work, but a JPEG has no transparency — it will show a
  rectangular box on the row. Prefer PNG cutouts.
- Aim for ~400×400 px or larger. The board draws them up to ~180 px, so
  anything smaller will look soft.
- The image is centred and scaled to fit; aspect ratio is preserved, nothing
  is cropped or stretched.
- These are separate from `../onion.png`, `../truck.png`, `../warehouse.png`,
  which the rate poster uses for its background band — don't confuse the two.
