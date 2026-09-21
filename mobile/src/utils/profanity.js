// Common English + Filipino profanity list. Matches whole words only so that
// legitimate substrings ("assist", "class", "shitake") are not censored. Add
// entries in lowercase; case-insensitive matching is applied at runtime.
const BAD_WORDS = [
  // English
  "fuck", "fucker", "fucking", "motherfucker",
  "shit", "bullshit",
  "bitch", "cunt", "asshole", "bastard", "dick", "piss", "prick",
  "whore", "slut", "damn", "crap",
  // Filipino
  "gago", "gaga", "tanga", "bobo", "boba",
  "putangina", "puta", "tangina", "tang ina", "putang ina",
  "ulol", "leche", "hindot", "kupal", "pakshet", "putragis",
  "yawa", "bwisit",
];

// Escape a word for use inside a regex, then allow one-or-more whitespace
// between tokens for multi-word entries (e.g. "tang ina" catches "tang  ina").
const toPattern = (word) =>
  word
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

// Combined case-insensitive regex, word-boundary anchored so "assist" is safe.
const PROFANITY_RE = new RegExp(
  `\\b(?:${BAD_WORDS.map(toPattern).join("|")})\\b`,
  "gi"
);

export const censorProfanity = (text) => {
  if (!text) return text;
  return text.replace(PROFANITY_RE, (match) => "*".repeat(match.length));
};

export default censorProfanity;
