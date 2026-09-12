/**
 * User-keyed exclusion list of game titles to exclude from collection results.
 * Keys should be lowercase BGG usernames.
 * Modify this object directly in code to add or remove games for specific users.
 */
export const USER_EXCLUSIONS = {
  bwobbones: [
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
  ],
};

/**
 * Helper to get exclusions array for a given username
 *
 * @param {string} username
 * @returns {Array<string>}
 */
export function getExclusionsForUser(username) {
  if (!username) return [];
  const normalized = String(username).trim().toLowerCase();
  return USER_EXCLUSIONS[normalized] || [];
}

// Backward-compatibility export
export const EXCLUSION_LIST = USER_EXCLUSIONS.bwobbones || [];
