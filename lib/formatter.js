import Table from "cli-table3";
import chalk from "chalk";

/**
 * Format rating with color
 */
function formatRating(rating) {
  if (rating === null || rating === undefined) return chalk.gray("N/A");
  const val = typeof rating === "number" ? rating : parseFloat(rating);
  if (isNaN(val)) return chalk.gray("N/A");

  const formatted = val.toFixed(1);
  if (val >= 8.0) return chalk.green.bold(formatted);
  if (val >= 7.0) return chalk.green(formatted);
  if (val >= 6.0) return chalk.yellow(formatted);
  if (val >= 5.0) return chalk.magenta(formatted);
  return chalk.red(formatted);
}

/**
 * Format collection items into CLI table format
 */
export function formatTable(items, username, totalItems, summaryExtra = null) {
  const table = new Table({
    head: [
      chalk.bold("#"),
      chalk.bold("Title"),
      chalk.bold("Best At"),
      chalk.bold("Avg Rating"),
      chalk.bold("Plays"),
    ],
    colWidths: [6, 42, 16, 14, 10],
    wordWrap: true,
  });

  items.forEach((item, idx) => {
    table.push([
      idx + 1,
      chalk.bold(item.name),
      item.bestAt ? chalk.cyan(item.bestAt) : chalk.gray("—"),
      formatRating(item.averageRating),
      item.numPlays > 0 ? chalk.bold(item.numPlays) : chalk.gray("0"),
    ]);
  });

  let header = chalk.bold.cyan(`\n🎲 BoardGameGeek Collection for: `) + chalk.bold.underline(username);
  let summaryText = `Showing ${items.length} of ${totalItems} items`;
  if (summaryExtra) {
    summaryText += `  •  ${summaryExtra}`;
  }
  let summary = chalk.gray(summaryText + "\n");

  return `${header}\n${summary}${table.toString()}\n`;
}

/**
 * Format collection items into simple one-line list format
 */
export function formatSimpleList(items, summaryExtra = null) {
  const lines = [];
  if (summaryExtra) {
    lines.push(chalk.yellow.bold(`[${summaryExtra}]\n`));
  }

  items.forEach((item, idx) => {
    const bestStr = item.bestAt ? ` [Best: ${item.bestAt}]` : "";
    const avgStr = item.averageRating ? ` [Avg: ${item.averageRating.toFixed(1)}]` : "";
    const playsStr = item.numPlays > 0 ? ` [Plays: ${item.numPlays}]` : "";
    lines.push(`${idx + 1}. ${item.name}${bestStr}${avgStr}${playsStr}`);
  });

  return lines.join("\n");
}

/**
 * Helper to clean title (removes parentheticals)
 */
function getCleanTitle(fullName) {
  let name = fullName.replace(/\([^)]*\)/g, "").trim();
  return name.replace(/\s+/g, "");
}

/**
 * Disambiguates duplicate shortened names by adding distinguishing characters or numbers
 */
function disambiguateDuplicates(list, fullNames) {
  const counts = new Map();
  list.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));

  const result = [...list];
  const duplicateKeys = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );

  if (duplicateKeys.size === 0) return result;

  for (const dupKey of duplicateKeys) {
    const indices = [];
    result.forEach((val, idx) => {
      if (val === dupKey) indices.push(idx);
    });

    indices.forEach((itemIdx) => {
      const fn = fullNames[itemIdx];
      let diff = fn.slice(dupKey.length).replace(/[^a-zA-Z0-9]/g, "");
      if (diff.length > 0) {
        result[itemIdx] = dupKey + diff.slice(0, 2);
      } else {
        result[itemIdx] = dupKey + (indices.indexOf(itemIdx) + 1);
      }
    });
  }

  const finalCounts = new Map();
  result.forEach((item) => finalCounts.set(item, (finalCounts.get(item) || 0) + 1));
  const seen = new Map();

  return result.map((item) => {
    if (finalCounts.get(item) > 1) {
      const c = (seen.get(item) || 0) + 1;
      seen.set(item, c);
      return `${item}${c}`;
    }
    return item;
  });
}

/**
 * Format collection items as a compact comma-separated list with all spaces removed.
 *
 * @param {Array<Object>} items
 * @param {number} maxLength
 * @returns {string}
 */
export function formatCompactList(items, maxLength = 1500) {
  if (!items || items.length === 0) return "";

  const fullNames = items.map((i) => getCleanTitle(i.name));

  let candidateNames = disambiguateDuplicates(fullNames, fullNames);
  let candidate = candidateNames.join(",");
  if (candidate.length <= maxLength) return candidate;

  const maxLen = Math.max(...fullNames.map((n) => n.length));

  for (let K = maxLen; K >= 1; K--) {
    let truncated = fullNames.map((n) => n.slice(0, K));
    truncated = disambiguateDuplicates(truncated, fullNames);
    candidate = truncated.join(",");
    if (candidate.length <= maxLength) {
      return candidate;
    }
  }

  return candidateNames
    .map((n, idx) => `${n.slice(0, 1)}${idx + 1}`)
    .join(",")
    .slice(0, maxLength);
}

/**
 * Format collection items as JSON
 */
export function formatJSON(items) {
  const cleanItems = items.map((item) => {
    const { year, userRating, rank, status, ...rest } = item;
    return rest;
  });
  return JSON.stringify(cleanItems, null, 2);
}

/**
 * Format collection items as CSV
 */
export function formatCSV(items) {
  const headers = [
    "id",
    "name",
    "subtype",
    "bestAt",
    "recommendedAt",
    "averageRating",
    "numPlays",
    "comment",
  ];

  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = items.map((item) => [
    item.id,
    escapeCSV(item.name),
    escapeCSV(item.subtype),
    escapeCSV(item.bestAt || ""),
    escapeCSV(item.recommendedAt || ""),
    item.averageRating ?? "",
    item.numPlays ?? 0,
    escapeCSV(item.comment || ""),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
