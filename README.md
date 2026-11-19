# news-image-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/antololcrazy1/news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/antololcrazy1/news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**World News — Wednesday 18 November 2026, in one image.** A program that draws a
1024×1024 newspaper front page summing up the day's world news, for make.fun's
"Sum up 18 November's world news in one image" bounty.

## What the image shows

- **Lead — Gulf crisis:** the US sinks five Iranian tankers and hits a missile site on
  Qeshm Island after Iran fires drones at Bahrain and Kuwait and says it hit 10 ships
  near the Strait of Hormuz.
- **Kerch Bridge hit for a second night** — part of the road span fell into the strait.
- **Xi, Trump and Putin meet in Shenzhen** at the APEC summit on Thursday.
- **COP31 in Antalya:** 144 items still in dispute as talks enter their final days.
- **Gaza winter:** the UN warns of more cold deaths; 1.7M displaced without shelter.
- **Ebola in DR Congo more than doubles** — 5,400 dead; the World Court rules on the
  Myanmar genocide case.
- **Also today:** Category 5 Cyclone Xavier hits the Cook Islands, Peltola wins the
  Alaska Senate seat, the US loses its measles-free status after 26 years, Nvidia
  posts a $116B quarter as its board refuses to reinstate Jensen Huang as CEO,
  Eisenkot is tapped to form Israel's next government, and a Russian military
  plane crash in Siberia kills 19.

## How it works

`main.ts` (Node 22, standard library only) draws everything with code: an embedded
5×7 bitmap font for all text, simple vector shapes for the tanker, the broken bridge,
the Shenzhen skyline, the globe, the tent and the virus, and a hand-rolled PNG
encoder (`node:zlib`). No network, no clock, no randomness — two runs write the same
bytes.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`entry.png` is a preview of the image the program writes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cde26xpc&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
