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
   ```

## Usage

### Usage Plan / Modes

- **`node index shit`**: All owned games with average rating **<= 7.1** that are **"Best At" 3+ players**.
- **`node index gold`**: All owned games with average rating **>= 7.2** that are **"Best At" 3+ players**.
- **`node index allgold`**: All owned games with average rating **>= 7.2** for **ALL player counts** (includes 2p games).
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
