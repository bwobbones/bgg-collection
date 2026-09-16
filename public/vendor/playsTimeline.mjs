/**
 * Play-history timeline builder.
 *
 * First-party (not vendored) module under public/ so it can be imported by both
 * the browser (via `import("/vendor/playsTimeline.mjs")`) and, if ever needed,
 * by Node. It is deliberately free of I/O and DOM access.
 *
 * Workers allow only 50 subrequests per invocation, so the raw play pages are
 * fetched in small bundles and the timeline is assembled here in the browser.
 */

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function addMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

/**
 * Turn raw plays into a monthly cumulative "share of collection played" series.
 *
 * The denominator is the CURRENT eligible collection size because BGG does not
 * expose acquisition dates, so a historically accurate denominator is
 * impossible. Games that are no longer owned are excluded from both the
 * numerator and the denominator by intersecting with the eligible id set.
 *
 * @param {object} options
 * @param {object[]} options.plays
 * @param {Set<number>|null} [options.eligibleIds] Owned + eligible game ids
 * @param {number} [options.eligibleCount]
 * @param {Date} [options.now]
 */
export function buildPlayTimeline({ plays, eligibleIds = null, eligibleCount = 0, now = new Date() }) {
  const firstPlayByGame = new Map();
  let totalPlaysAllTime = 0;
  let totalPlaysInCollection = 0;
  let playRecordsInCollection = 0;
  let lastPlayDate = null;

  for (const play of plays) {
    totalPlaysAllTime += play.quantity || 1;
    if (!lastPlayDate || play.date > lastPlayDate) lastPlayDate = play.date;

    if (eligibleIds && !eligibleIds.has(play.objectId)) continue;

    totalPlaysInCollection += play.quantity || 1;
    playRecordsInCollection++;

    const previous = firstPlayByGame.get(play.objectId);
    if (!previous || play.date < previous) firstPlayByGame.set(play.objectId, play.date);
  }

  const firstDates = [...firstPlayByGame.values()].sort();
  const points = [];

  if (firstDates.length > 0) {
    const todayMonth = monthKey(now.toISOString().slice(0, 10));
    const lastPlayMonth = monthKey(lastPlayDate);
    const endMonth = todayMonth > lastPlayMonth ? todayMonth : lastPlayMonth;

    let cursor = 0;
    for (let month = monthKey(firstDates[0]); month <= endMonth; month = addMonth(month, 1)) {
      const monthEnd = lastDayOfMonth(month);
      while (cursor < firstDates.length && firstDates[cursor] <= monthEnd) cursor++;
      points.push({
        date: `${month}-01`,
        playedCount: cursor,
        percentage: eligibleCount > 0 ? Number(((cursor / eligibleCount) * 100).toFixed(2)) : 0,
      });
    }
  }

  const distinctPlayedGames = firstDates.length;
  const firstPlayDate = firstDates[0] || null;
  const years =
    firstPlayDate && lastPlayDate
      ? Number(((new Date(lastPlayDate) - new Date(firstPlayDate)) / (365.25 * 24 * 3600 * 1000)).toFixed(1))
      : 0;

  return {
    eligibleCount,
    distinctPlayedGames,
    unplayedCount: Math.max(0, eligibleCount - distinctPlayedGames),
    playedPercentage: eligibleCount > 0 ? Number(((distinctPlayedGames / eligibleCount) * 100).toFixed(1)) : 0,
    totalPlays: totalPlaysInCollection,
    playRecords: playRecordsInCollection,
    totalPlaysAllTime,
    firstPlayDate,
    lastPlayDate,
    years,
    points,
  };
}
