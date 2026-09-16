# BGG Collection CLI

A Node.js command-line tool to fetch and display BoardGameGeek (BGG) game collections with filtering, sorting, and multiple output formats.

## Features

- 🎲 **Fetch BGG Collections**: Easily retrieve any user's collection from BoardGameGeek using the BGG XML API2.
- ⏳ **Smart Queue Handling**: Automatically handles BGG's 202 Accepted response / queued collection processing with retries and progress updates.
- 🔑 **API Authentication**: Supports `BGG_TOKEN` via environment variables (`.env`) or command-line option.
- 👥 **Best Player Count ("Best At")**: Automatically enriches collection items with BGG community poll data for recommended "Best At" player count.
- 📊 **Multiple Output Formats**:
  - `table` (default): Colored terminal table showing Title, Best At player count, Avg Rating, and Plays.
  - `simple`: One-liner text list suitable for quick scanning or terminal piping.
  - `json`: Pretty-printed JSON representation.
  - `csv`: CSV format with headers, suitable for importing into spreadsheets.
- 🔍 **Filtering & Search**:
  - Filter by ownership/status (`--own`, `--played`, `--rated`, `--wishlist`, `--all`).
  - Search title by string (`-q, --query <text>`).
  - Filter by minimum rating (`--min-rating <number>`) or minimum play count (`--min-plays <number>`).
  - Filter by subtype (`--subtype boardgameexpansion`, etc.).
- 🔀 **Flexible Sorting**:
  - Sort by `name`, `year`, `rating` (user rating), `avg-rating` (BGG average rating), `rank`, or `plays`.
  - Ascending or descending (`--desc`).
  - Limit top N items (`-l, --limit <number>`).
- 💾 **Export to File**: Output directly to a file with `-o, --output <filepath>`.
- 🎡 **Wheel of Fortune**: Spin the filtered collection to pick a random game, then share the spin to Discord as an animated GIF.
- 📈 **Collection Metrics**: The web app shows a **Gold Games** card (share of the collection rated ≥ 7.2 with > 300 votes) and a **Played Games** card (share of the collection with at least one logged play, plus the unplayed count).
- 📉 **Played Over Time Chart**: A dependency-free SVG chart showing how the share of the collection played grew month by month, built from every play ever logged on BGG.

## Installation

1. Clone or download this repository.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional but recommended):
   Copy `.env.example` to `.env` and set your BGG API token and default username:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   BGG_TOKEN=your_bgg_api_bearer_token
   BGG_USERNAME=your_bgg_username
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

   `DISCORD_WEBHOOK_URL` is only needed for the web app's "Send Spin to Discord"
   button. Create one in Discord via **Server Settings → Integrations → Webhooks**.

   For the Cloudflare Worker deployment, store it as a secret instead of a var so
   it is never committed:

   ```bash
   npx wrangler secret put DISCORD_WEBHOOK_URL
   ```

## Running the Web Application

Launch the Express web app locally:

```bash
# Production mode
npm start

# Development mode with auto-reload (Node --watch / nodemon)
npm run dev
```

Open `http://localhost:3000` in your browser.

## Collection Metrics

After a collection loads, two banner cards summarise the whole eligible
collection (owned games, after exclusion and expansion filtering). They describe
the collection itself and deliberately ignore the rating presets, player-count
pills, search, min-rating, and "Unplayed Only" filters:

| Card | Calculation |
| --- | --- |
| **Gold Games** | `averageRating >= 7.2 && usersRated > 300` |
| **Played Games** | `numPlays > 0` (plus the unplayed remainder) |

Both counts and percentages are computed server-side (`playedCount`,
`unplayedCount`, `playedPercentage` alongside `goldCount`/`goldPercentage`) and
returned with the collection payload. The client falls back to counting items
itself if it receives a cached payload that predates these fields.

## Played Over Time Chart

Below the metric cards, a **Played Over Time** chart plots the cumulative share
of the collection that had at least one logged play in each month. Click the
**Played Games Metric** card to expand or collapse it (it is a real button:
keyboard-accessible via <kbd>Enter</kbd>/<kbd>Space</kbd>, with `aria-expanded`
kept in sync).

The chart is collapsed by default and its play history is fetched **lazily on
first expand**, so a collapsed chart costs no BGG requests. Expanding again
reuses the rendered chart, and reloading the collection re-syncs it if (and only
if) it is currently open.

**Data source.** The collection API only exposes a per-game play *count*, so the
history comes from the paginated `xmlapi2/plays` endpoint. Each game's *first*
play date is what drives the curve. Plays are matched against the currently
eligible collection, so games you sold on are excluded and the numerator always
agrees with the collection's own `numplays > 0` count.

**Bounded paging (Workers subrequest limit).** A Worker invocation may only make
50 subrequests on the free plan, and this account has 24 pages of plays — so the
plays endpoint is **never walked server-side in one call**. `GET /api/plays/pages`
returns at most 6 pages per invocation (hard cap 8, which keeps even the worst
case with retries well under 50), and the browser walks the bundles in order and
assembles the timeline locally with `public/vendor/playsTimeline.mjs`. Each page
is cached in KV for 12 hours, so repeat loads make no BGG requests at all.

**Denominator.** BoardGameGeek does not expose purchase dates (and this account
has none set), so a historically accurate "share of what I owned at the time" is
impossible. The chart therefore divides by *today's* eligible collection size:
buying more games lowers the earlier points, and the curve only rises as you log
new games.

```
GET /api/plays/pages?username=<user>&from=<first page>&count=<pages, max 8>&forceRefresh=
```

Returns `{ plays: [{ date, objectId, quantity }], total, totalPages, from, count,
cacheHits }` for that bundle of pages. The browser then computes the monthly
series (`points: [{ date, playedCount, percentage }]`) plus a summary
(`distinctPlayedGames`, `eligibleCount`, `totalPlays`, `firstPlayDate`,
`lastPlayDate`, `years`). The chart never blocks the main view — the table
renders first and the play history loads on demand — and it degrades to an
inline message if the fetch fails or nothing matches the current view.

The curve, axes, area fill, crosshair and tooltip are hand-built SVG in
`public/app.js` (`renderPlayHistoryChart`) — no charting library is loaded.

## Wheel of Fortune & Discord Sharing

The web app can spin your currently filtered collection and post the result to a
Discord channel as an animated GIF.

1. Fetch a collection and narrow it down with the rating presets, player-count
   pills, search, min rating, and "Unplayed Only" filters.
2. Click **Open Wheel of Fortune** and hit **SPIN THE WHEEL!**
3. Once a winner is announced, click **Send Spin to Discord**.

The browser re-renders the spin onto an offscreen canvas at a fixed 12 fps and
encodes it into an animated GIF with [gifenc](https://github.com/mattdesl/gifenc)
(vendored at `public/vendor/gifenc.esm.js`), so the GIF is smooth regardless of
the display refresh rate. The GIF is then POSTed to `/api/discord/spin`, which
forwards it to the configured Discord webhook — the webhook URL stays server-side
and is never exposed to the browser.

The final frame holds on a winner banner for 1.5s and the Discord message
includes an embed with the game's Best At player count, average rating, year, and
your play count, plus a link to its BGG page.

| Layer | File |
| --- | --- |
| GIF rendering + upload | `public/app.js` (`buildSpinGif`, `sendSpinResultToDiscord`) |
| Shared Discord posting | `lib/discord.js` |
| Worker route (`POST /api/discord/spin`) | `src/worker.js` |
| Local dev route | `server.js` |

If `DISCORD_WEBHOOK_URL` is not configured the button reports a clear error and
nothing is posted. GIFs above 8 MB are rejected to stay within Discord's upload
limit; the current export is ~0.7 MB for 55 frames at 360×360.

## Usage

### Usage Plan / Modes

- **`node index shit`**: All owned games with average rating **<= 7.1** that are **"Best At" 3+ players**.
- **`node index gold`**: All owned games with average rating **>= 7.2** AND **> 300 ratings** that are **"Best At" 3+ players**.
- **`node index allgold`**: All owned games with average rating **>= 7.2** AND **> 300 ratings** for **ALL player counts**.
- **`node index 2p`**: All owned games that are **"Best At" 2 players**.

### Basic Command

```bash
# Preset modes (uses default username bwobbones)
node index shit
node index gold
node index allgold
node index 2p

# Preset mode for a specific user (arguments can be passed in any order)
node index gold jonky
node index jonky gold

# General usage (fetches entire owned collection)
node index [username]
```

### Examples

#### 1. Display Top Rated Games in Terminal Table
```bash
./index.js Octavian -s rating --desc -l 10
```

#### 2. Search Collection for a Game Name
```bash
./index.js Octavian -q "catan"
```

#### 3. Filter Games with at Least 5 Plays
```bash
./index.js Octavian --min-plays 5 -s plays --desc
```

#### 4. Export Owned Collection to CSV File
```bash
./index.js Octavian -f csv -o my_collection.csv
```

#### 5. Output Collection as JSON
```bash
./index.js Octavian -f json -l 5
```

#### 6. Filter Games Best Played at 2 Players
```bash
./index.js --best-at 2 -l 10
```

#### 7. View Wishlist Items
```bash
./index.js bwobbones --wishlist
```

## CLI Options Reference

```text
Usage: bgg-collection [options] [username]

Arguments:
  username                  BoardGameGeek username

Options:
  -V, --version             output the version number
  -u, --username <username> BoardGameGeek username (alternative to argument)
  -t, --token <token>       BGG API Bearer Token (defaults to BGG_TOKEN env var)
  --own                     Filter owned games (default: enabled if no other status set)
  --played                  Filter played games
  --rated                   Filter rated games
  --wishlist                Filter wishlist items
  --all                     Fetch all items without applying status filter on API
  --subtype <subtype>       BGG item subtype (e.g. boardgame, boardgameexpansion) (default: "boardgame")
  --include-expansions      Include expansions in the output (excluded by default)
  -f, --format <format>     Output format: table, simple, json, csv (default: "table")
  --list                    Output item names as a comma-separated list with all spaces removed (smartly truncated to fit within 1500 characters)
  -s, --sort <field>        Sort by: name, year, rating, avg-rating, rank, plays (default: "name")
  --desc                    Sort in descending order (default: false)
  -l, --limit <number>      Limit output to N items
  -q, --query <text>        Filter titles by search string
  --min-rating <number>     Filter items with average/user rating >= min-rating
  --min-plays <number>      Filter items with plays >= min-plays
  --best-at <count>         Filter items where best player count matches N (e.g., 2, 3, 4)
  --no-best                 Skip fetching 'Best At' player count data
  -o, --output <filepath>   Write output to file instead of stdout
  -v, --verbose             Enable verbose debug logs (default: false)
  -h, --help                display help for command
```

## Exclusion List

You can exclude specific games by title directly in code without passing arguments.
Edit `lib/exclusions.js` to add or remove game titles from the array:

```javascript
export const EXCLUSION_LIST = [
  "Agricola (Revised Edition)",
  "Excalibur",
  "Flash Point: Legacy of Flame",
  "GKR: Heavy Hitters",
  "Glen More II: Chronicles",
  "Moon Colony Bloodbath",
  "Pictomania (Second Edition)",
  "Psycho Raiders",
  "Quacks",
  "Ready Set Bet",
  "Sagrada Artisans",
  "Shikoku 1889",
  "The Queen's Dilemma",
  "Through Ice & Snow",
  "Ticket to Ride: Europe",
  "Wingspan",
];
```

ISC
