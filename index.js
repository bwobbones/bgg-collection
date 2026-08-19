#!/usr/bin/env node

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Command } from "commander";
import chalk from "chalk";
import { getProcessedCollection } from "./lib/collectionService.js";
import {
  formatTable,
  formatSimpleList,
  formatCompactList,
  formatJSON,
  formatCSV,
} from "./lib/formatter.js";

const PRESETS = ["shit", "gold", "allgold", "2p"];

const program = new Command();

program
  .name("bgg-collection")
  .description("CLI tool to fetch and display BoardGameGeek game collections")
  .version("1.0.0")
  .argument("[arg1]", "Mode ('shit', 'gold', 'allgold', '2p') or BoardGameGeek username")
  .argument("[arg2]", "BoardGameGeek username or Mode ('shit', 'gold', 'allgold', '2p')")
  .option("-u, --username <username>", "BoardGameGeek username (alternative option)")
  .option("-t, --token <token>", "BGG API Bearer Token (defaults to BGG_TOKEN env var)")
  .option("--own", "Filter owned games")
  .option("--played", "Filter played games")
  .option("--rated", "Filter rated games")
  .option("--wishlist", "Filter wishlist items")
  .option("--all", "Fetch all items without applying status filter on API")
  .option("--subtype <subtype>", "BGG item subtype (e.g. boardgame, boardgameexpansion)", "boardgame")
  .option("--include-expansions", "Include expansions in the output (excluded by default)", false)
  .option("-f, --format <format>", "Output format: table, simple, list, json, csv", "table")
  .option("--list", "Output item names as a comma-separated list with all spaces removed")
  .option("-s, --sort <field>", "Sort by: name, year, rating, avg-rating, rank, plays", "name")
  .option("--desc", "Sort in descending order", false)
  .option("-l, --limit <number>", "Limit output to N items", parseInt)
  .option("-q, --query <text>", "Filter titles by search string")
  .option("--min-rating <number>", "Filter items with average/user rating >= min-rating", parseFloat)
  .option("--max-rating <number>", "Filter items with average/user rating <= max-rating", parseFloat)
  .option("--min-plays <number>", "Filter items with plays >= min-plays", parseInt)
  .option("--best-at <count>", "Filter items where best player count matches N (e.g., 2, 3, 4)")
  .option("--no-best", "Skip fetching 'Best At' player count data", false)
  .option("-o, --output <filepath>", "Write output to file instead of stdout")
  .option("-v, --verbose", "Enable verbose debug logs", false)
  .action(async (arg1, arg2, options) => {
    try {
      let mode = null;
      let username = null;

      const clean1 = arg1 ? arg1.trim().toLowerCase() : null;
      const clean2 = arg2 ? arg2.trim().toLowerCase() : null;

      if (clean1 && PRESETS.includes(clean1)) {
        mode = clean1;
        username = arg2 || options.username || process.env.BGG_USERNAME || "bwobbones";
      } else if (clean2 && PRESETS.includes(clean2)) {
        mode = clean2;
        username = arg1 || options.username || process.env.BGG_USERNAME || "bwobbones";
      } else {
        username = arg1 || options.username || process.env.BGG_USERNAME || "bwobbones";
      }

      if (!username) {
        console.error(
          chalk.red(
            "Error: BoardGameGeek username is required.\n" +
              "Provide it as an argument: bgg-collection <username>\n" +
              "Or set BGG_USERNAME in your .env file."
          )
        );
        process.exit(1);
      }

      const token = options.token || process.env.BGG_TOKEN;

      const result = await getProcessedCollection({
        username,
        mode,
        own: options.own,
        played: options.played,
        rated: options.rated,
        wishlist: options.wishlist,
        all: options.all,
        subtype: options.subtype,
        includeExpansions: options.includeExpansions,
        query: options.query,
        minRating: options.minRating,
        maxRating: options.maxRating,
        minPlays: options.minPlays,
        bestAt: options.bestAt,
        noBest: options.noBest,
        token,
        verbose: options.verbose,
      });

      let items = [...result.items];

      // Sorting
      const sortField = options.sort.toLowerCase();
      const sortMultiplier = options.desc ? -1 : 1;

      items.sort((a, b) => {
        let valA, valB;

        switch (sortField) {
          case "year":
            valA = a.year ?? (options.desc ? -9999 : 9999);
            valB = b.year ?? (options.desc ? -9999 : 9999);
            break;
          case "rating":
            valA = a.userRating ?? (options.desc ? -1 : 99);
            valB = b.userRating ?? (options.desc ? -1 : 99);
            break;
          case "avg-rating":
            valA = a.averageRating ?? (options.desc ? -1 : 99);
            valB = b.averageRating ?? (options.desc ? -1 : 99);
            break;
          case "rank":
            valA = a.rank ?? (options.desc ? -1 : 999999);
            valB = b.rank ?? (options.desc ? -1 : 999999);
            break;
          case "plays":
            valA = a.numPlays ?? 0;
            valB = b.numPlays ?? 0;
            break;
          case "name":
          default:
            return a.name.localeCompare(b.name) * sortMultiplier;
        }

        if (valA < valB) return -1 * sortMultiplier;
        if (valA > valB) return 1 * sortMultiplier;
        return a.name.localeCompare(b.name);
      });

      // Limit
      if (options.limit && options.limit > 0) {
        items = items.slice(0, options.limit);
      }

      let summaryExtra = null;
      if (mode === "allgold" || result.goldCount > 0) {
        summaryExtra = `Gold: ${result.goldCount}/${result.totalEligibleCount} (${result.goldPercentage}%)`;
      }

      // Format output
      let outputText = "";
      const format = options.format.toLowerCase();

      if (options.list || format === "list") {
        if (summaryExtra) {
          console.error(chalk.yellow.bold(`[${summaryExtra}]`));
        }
        outputText = formatCompactList(items);
      } else {
        switch (format) {
          case "json":
            outputText = formatJSON(items);
            break;
          case "csv":
            outputText = formatCSV(items);
            break;
          case "simple":
            outputText = formatSimpleList(items, summaryExtra);
            break;
          case "table":
          default:
            outputText = formatTable(items, username, result.totalItems, summaryExtra);
            break;
        }
      }

      if (options.output) {
        const filePath = path.resolve(process.cwd(), options.output);
        await fs.writeFile(filePath, outputText, "utf-8");
        console.log(chalk.green(`Successfully wrote output to ${filePath}`));
      } else {
        console.log(outputText);
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
