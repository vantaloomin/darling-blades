# Starting-life study (D1) readings

29 Warchest decks (15 prefabs, 8 sweep crafts, 6 First Dawn summit bosses), every pair, Hard on both seats, 20 / 25 / 30 starting life. 32480 paired games per arm (97440 games), the same seeds, seats and AI seeds in every arm. Shards: 8, 0 stopped at budget.

## Game length and how games end

`state.turn` counts each player's turn, so a round is two turns.

| | 20 life | 25 life | 30 life |
| --- | --- | --- | --- |
| Median turns | 17 (8.5 rounds) | 19 (9.5 rounds) | 21 (10.5 rounds) |
| Mean turns | 19.7 | 21.6 | 23.3 |
| 90th percentile turns | 30 | 33 | 35 |
| Over by round 12 | 81.1% | 74.1% | 66.9% |
| Ended on life | 96.6% | 95.2% | 93.6% |
| Ended on decking | 3.4% | 4.8% | 6.4% |
| Turn-limit draws | 0.0% | 0.0% | 0.0% |
| Winner's life at the end | 16.7 | 19.6 | 22.4 |

## Lands and what gets cast

Warchest decks hold their lands in a 10-land reserve, so 10 is the most a player can have.

| | 20 life | 25 life | 30 life |
| --- | --- | --- | --- |
| Lands in play at the end (per player) | 8.40 | 8.87 | 9.19 |
| Players at all 10 lands at the end | 40.8% | 52.4% | 62.2% |
| Games with a 6+ cost spell cast | 59.5% | 65.6% | 69.6% |
| Games with an 8+ cost spell cast | 5.5% | 6.4% | 7.1% |
| Casts per game at cost 0 | 0.00 | 0.00 | 0.00 |
| Casts per game at cost 1 | 2.94 | 3.29 | 3.60 |
| Casts per game at cost 2 | 6.21 | 7.01 | 7.69 |
| Casts per game at cost 3 | 6.07 | 6.90 | 7.60 |
| Casts per game at cost 4 | 5.99 | 6.79 | 7.45 |
| Casts per game at cost 5 | 2.78 | 3.15 | 3.45 |
| Casts per game at cost 6 | 0.89 | 1.03 | 1.15 |
| Casts per game at cost 7 | 0.15 | 0.18 | 0.20 |
| Casts per game at cost 8 | 0.07 | 0.08 | 0.09 |
| Casts per game at cost 9 | 0.00 | 0.00 | 0.00 |
| Casts per game at cost 10+ | 0.00 | 0.00 | 0.00 |

## The board cap

| | 20 life | 25 life | 30 life |
| --- | --- | --- | --- |
| Creatures in play at the end (per player) | 3.73 | 3.97 | 4.16 |
| Players at the 8-creature cap at the end | 10.9% | 12.8% | 14.5% |
| Overcharges per game | 0.37 | 0.47 | 0.55 |
| Tokens refused per game (no namesake) | 0.15 | 0.19 | 0.23 |

## Hard AI time

Every shard plays all arms on one runner, so the ratios compare like with like; absolute ms depend on the runner.

| | 20 life | 25 life | 30 life |
| --- | --- | --- | --- |
| Hard ms per game (both seats) | 434.5 | 554.1 | 671.0 |
| 90th percentile ms per game | 932.0 | 1231.0 | 1504.0 |
| Decisions per game | 123.3 | 136.9 | 148.6 |
| ms per decision | 3.52 | 4.05 | 4.51 |
| Time per game vs 20 life | x1.00 | x1.28 | x1.54 |

## Each deck's win rate and its shift

Win rate over decided games against the rest of the field. The shift is paired: the same game at 20 life and at the higher total, ± one standard error. Draws count as half a win in the shift.

| Deck | Kind | 20 life | 25 life | 30 life | Shift at 25 | Shift at 30 |
| --- | --- | --- | --- | --- | --- | --- |
| Crafted weenie | craft | 75.6% | 78.3% | 81.3% | +2.7 ± 0.8 | +5.7 ± 0.9 |
| Crafted attrition | craft | 53.9% | 57.1% | 58.8% | +3.2 ± 0.9 | +4.9 ± 1.0 |
| R23 Chrome Broodmother | boss | 43.0% | 46.6% | 47.9% | +3.6 ± 0.8 | +4.9 ± 0.9 |
| Shadow Mandate | prefab | 33.9% | 36.8% | 38.7% | +2.9 ± 0.8 | +4.8 ± 0.9 |
| Neon Afterimage | prefab | 39.4% | 41.0% | 44.1% | +1.5 ± 0.7 | +4.7 ± 0.9 |
| Questing Table | prefab | 40.0% | 42.3% | 44.4% | +2.3 ± 0.8 | +4.4 ± 0.9 |
| Crafted reanimator | craft | 55.2% | 57.0% | 59.2% | +1.9 ± 0.8 | +4.0 ± 0.9 |
| R27 The Shepherdess of Giants | boss | 34.7% | 37.0% | 38.2% | +2.3 ± 1.0 | +3.5 ± 1.0 |
| Crafted stompy | craft | 62.9% | 63.6% | 65.9% | +0.7 ± 0.8 | +3.0 ± 0.9 |
| Chrome-Violet Broodship | prefab | 37.7% | 37.8% | 39.6% | +0.2 ± 0.8 | +2.0 ± 0.8 |
| R24 The Violet Signal Queen | boss | 51.2% | 51.6% | 53.0% | +0.4 ± 0.8 | +1.8 ± 0.9 |
| Crafted draw-go | craft | 77.3% | 78.3% | 79.0% | +1.0 ± 0.7 | +1.7 ± 0.8 |
| Midnight Storybook | prefab | 48.5% | 49.9% | 49.9% | +1.3 ± 0.8 | +1.4 ± 0.9 |
| Bloodmoon Masquerade | prefab | 57.7% | 58.9% | 58.5% | +1.2 ± 0.9 | +0.8 ± 0.9 |
| R28 The Tyrant Queen | boss | 58.8% | 59.2% | 59.4% | +0.3 ± 0.8 | +0.5 ± 0.9 |
| Pride at the Ninth Gate | prefab | 48.6% | 49.4% | 49.1% | +0.8 ± 0.8 | +0.4 ± 0.8 |
| Burning Tides | prefab | 41.7% | 41.2% | 41.8% | -0.6 ± 0.7 | +0.1 ± 0.8 |
| R26 The Marsh-Mother | boss | 57.5% | 56.4% | 57.5% | -1.1 ± 0.8 | -0.0 ± 0.9 |
| R25 The Drowned Deacon | boss | 55.5% | 56.1% | 55.2% | +0.6 ± 0.8 | -0.2 ± 0.9 |
| Crafted warband | craft | 85.9% | 84.9% | 85.3% | -1.0 ± 0.6 | -0.6 ± 0.7 |
| Crimson Muster | prefab | 62.1% | 61.7% | 60.5% | -0.4 ± 0.8 | -1.6 ± 0.9 |
| Valhalla's Muster | prefab | 30.7% | 29.7% | 27.2% | -1.0 ± 0.8 | -3.5 ± 0.9 |
| Lanterns Below | prefab | 25.0% | 23.2% | 21.1% | -1.9 ± 0.8 | -3.9 ± 0.8 |
| Glimmer Bargain | prefab | 25.0% | 22.4% | 20.4% | -2.5 ± 0.7 | -4.6 ± 0.8 |
| Grave Harvest | prefab | 35.7% | 32.2% | 30.6% | -3.4 ± 0.8 | -5.0 ± 0.9 |
| Crafted midrange | craft | 63.2% | 59.3% | 57.5% | -3.8 ± 0.8 | -5.7 ± 0.9 |
| Hooves and Fire | prefab | 34.4% | 30.7% | 28.2% | -3.7 ± 0.7 | -6.2 ± 0.8 |
| Wild Communion | prefab | 49.5% | 47.2% | 41.8% | -2.4 ± 1.0 | -7.7 ± 1.1 |
| Crafted burn | craft | 65.6% | 60.5% | 55.8% | -5.1 ± 0.7 | -9.8 ± 0.9 |

| | 20 life | 25 life | 30 life |
| --- | --- | --- | --- |
| Field spread (best minus worst deck) | 61.0 pts | 62.5 pts | 65.0 pts |
| Standard deviation of deck win rates | 15.5 pts | 15.8 pts | 16.5 pts |
