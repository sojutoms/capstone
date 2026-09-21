// Common English + Filipino profanity list. Matches whole words only so that
// legitimate substrings ("assist", "class", "shitake") are not censored. Add
// entries in lowercase; case-insensitive matching is applied at runtime.
//
// Kept in sync with mobile/src/utils/profanity.js and finals/src/utils/profanity.js.
const BAD_WORDS = [
  "fuck", "fucker", "fucking", "motherfucker",
  "shit", "bullshit",
  "bitch", "cunt", "asshole", "bastard", "dick", "piss", "prick",
  "whore", "slut", "damn", "crap",
  "gago", "gaga", "tanga", "bobo", "boba",
  "putangina", "puta", "tangina", "tang ina", "putang ina",
  "ulol", "leche", "hindot", "kupal", "pakshet", "putragis",
  "yawa", "bwisit",
];

const toPattern = (word) =>
  word
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

const PROFANITY_RE = new RegExp(
  `\\b(?:${BAD_WORDS.map(toPattern).join("|")})\\b`,
  "gi"
);

const censorProfanity = (text) => {
  if (!text) return text;
  return String(text).replace(PROFANITY_RE, (match) => "*".repeat(match.length));
};

module.exports = { censorProfanity };
