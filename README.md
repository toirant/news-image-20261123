# news-image-20261123

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![make.fun bounty](https://img.shields.io/badge/make.fun-news--image--20261123-blue)](https://make.fun/c/news-image-20261123)

A make.fun bounty entry: a program that draws one image summing up the
world's news of **Monday 23 November 2026** — a newspaper front page,
"The World in One Day".

## The image

The front page leads with the collapse of the COP31 climate talks in
Turkiye (nearly 200 nations left without an overarching deal), then covers
the Democrats clinching a 258-seat US House majority, suspected Ukrainian
sea drones hitting the Russian corvette Merkury off Benghazi, oil tankers
struck in and near the Strait of Hormuz, and briefs from Indonesia, the
Kyiv region, Atlanta and the ATP Finals.

## How it works

`main.ts` is a self-contained Node 22 program (standard library only). It
draws the page pixel by pixel with a hand-rolled RGB canvas, a 5x7 bitmap
font and simple shape routines, then encodes the result as a deterministic
PNG with a hand-written encoder (zlib from the Node standard library).
No network, no randomness, no timestamps — two runs write byte-identical
files.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024, under 1 MiB)
```

## License

MIT — see [LICENSE](LICENSE).
