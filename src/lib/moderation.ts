/**
 * Content Moderation System for Gospel Life Ministries
 *
 * Multi-layer text and image filtering:
 * 1. Profanity/slur dictionary (instant block)
 * 2. Leetspeak & evasion pattern detection
 * 3. Contextual phrase detection (harassment, threats, sexual content)
 * 4. Image upload restrictions (whitelist approach)
 *
 * Future: Claude API moderation pass for nuanced context understanding
 */

/* ── Layer 1: Profanity & Slur Dictionary ── */

// Words that are ALWAYS blocked (exact match after normalization)
const BLOCKED_WORDS = new Set([
  // Profanity (common)
  "ass", "asshole", "bastard", "bitch", "bullshit", "crap", "cunt",
  "damn", "damned", "dammit", "dick", "douche", "douchebag",
  "fuck", "fucking", "fucker", "fucked", "fck", "fuk",
  "goddamn", "goddammit", "hell", "ho", "hoe",
  "jackass", "motherfucker", "mf", "nigga", "nigger",
  "piss", "pissed", "prick", "pussy", "retard", "retarded",
  "shit", "shitty", "slut", "sob", "stfu", "tit", "tits",
  "twat", "whore", "wtf", "wth",
  // Slurs & hate speech
  "chink", "coon", "dyke", "fag", "faggot", "gook",
  "kike", "negro", "spic", "tranny", "wetback",
  // Sexual terms
  "blowjob", "boner", "boobs", "booty", "cum", "dildo",
  "erection", "handjob", "horny", "jerkoff", "masturbat",
  "milf", "orgasm", "penis", "porn", "pornography",
  "prostitute", "rape", "semen", "sex", "sexual", "sexy",
  "stripper", "vagina", "viagra", "xxx",
]);

// Words that are OK in biblical/church context but would otherwise flag
const CONTEXT_EXCEPTIONS = new Set([
  "hell", // as in "hell is real" — theological context
  "damn", // as in "damnation" — theological context
  "ass", // as in "donkey" — biblical context
  "sex", // as in "sexual immorality" — biblical teaching context
  "sexual", // same
  "prostitute", // as in biblical narrative (Rahab, etc.)
  "rape", // as in biblical narrative discussion
]);

// Phrases that indicate biblical/theological context (allow exception words)
const BIBLICAL_CONTEXT_PHRASES = [
  "bible", "scripture", "verse", "chapter", "book of",
  "jesus", "christ", "god", "lord", "holy spirit",
  "sermon", "pastor", "church", "ministry", "faith",
  "sin", "repent", "salvation", "grace", "forgive",
  "pray", "prayer", "worship", "praise",
  "genesis", "exodus", "leviticus", "numbers", "deuteronomy",
  "matthew", "mark", "luke", "john", "acts", "romans",
  "corinthians", "galatians", "ephesians", "philippians",
  "colossians", "thessalonians", "timothy", "titus",
  "hebrews", "james", "peter", "revelation",
  "proverbs", "psalms", "isaiah", "jeremiah",
  "immorality", "wickedness", "unclean", "abomination",
  "judgment", "damnation", "eternal",
];

/* ── Layer 2: Leetspeak & Evasion Detection ── */

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "8": "b", "9": "g", "@": "a", "$": "s",
  "!": "i", "+": "t", "ph": "f", "ck": "ck",
};

function deLeet(text: string): string {
  let result = text.toLowerCase();
  // Remove common separator tricks (f.u.c.k, f-u-c-k, f_u_c_k)
  result = result.replace(/[\.\-_\*\s]+(?=[a-z0-9])/g, "");
  // Replace leet characters
  for (const [leet, normal] of Object.entries(LEET_MAP)) {
    result = result.split(leet).join(normal);
  }
  return result;
}

/* ── Layer 3: Contextual Phrase Detection ── */

const BLOCKED_PHRASES = [
  // Threats
  /\b(kill|murder|shoot|stab|hurt|attack)\s+(you|him|her|them|myself)\b/i,
  /\b(i('ll|m going to|want to|will))\s+(kill|murder|hurt|attack)\b/i,
  // Self-harm
  /\b(kill\s+myself|end\s+(my|it)\s*(life|all))\b/i,
  /\b(suicide|suicidal)\b/i,
  // Harassment
  /\b(you('re| are)\s+(stupid|worthless|ugly|fat|disgusting|pathetic))\b/i,
  /\b(go\s+(die|away|to\s+hell))\b/i,
  /\b(no\s+one\s+(loves|cares|wants)\s+you)\b/i,
  // Solicitation / spam
  /\b(buy\s+now|click\s+here|free\s+money|make\s+\$|earn\s+\$)\b/i,
  /\b(https?:\/\/[^\s]+\.(ru|cn|tk|ml|xyz))\b/i, // suspicious TLDs
  // Drug references
  /\b(weed|marijuana|cocaine|heroin|meth|ecstasy|molly|acid|lsd)\b/i,
];

// Crisis phrases — don't block, but flag for pastor notification
const CRISIS_PHRASES = [
  /\b(suicide|suicidal)\b/i,
  /\b(kill\s+myself)\b/i,
  /\b(end\s+(my|it)\s*(life|all))\b/i,
  /\b(don('t| not)\s+want\s+to\s+live)\b/i,
  /\b(self[- ]?harm)\b/i,
];

/* ── Layer 4: Image Upload Restrictions ── */

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_IMAGE_SIZE_MB = 5;

/* ── Main Moderation Functions ── */

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  flaggedWords?: string[];
  isCrisis?: boolean;
  crisisMessage?: string;
  severity: "clean" | "warning" | "blocked" | "crisis";
}

/**
 * Moderate text content before posting
 */
export function moderateText(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { allowed: false, reason: "Empty message", severity: "blocked" };
  }

  // Check for crisis phrases first — these need special handling
  const isCrisis = CRISIS_PHRASES.some((pattern) => pattern.test(text));
  if (isCrisis) {
    return {
      allowed: true, // Allow the post but flag it
      isCrisis: true,
      crisisMessage:
        "If you or someone you know is in crisis, please call 988 (Suicide & Crisis Lifeline) " +
        "or text HOME to 741741. You are loved, and help is available. Pastor Charlie has been notified.",
      severity: "crisis",
    };
  }

  // Determine if text has biblical context (allows certain exception words)
  const lowerText = text.toLowerCase();
  const hasBiblicalContext = BIBLICAL_CONTEXT_PHRASES.some((phrase) =>
    lowerText.includes(phrase)
  );

  // Layer 1: Direct word matching
  const words = lowerText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const flaggedWords: string[] = [];

  for (const word of words) {
    if (BLOCKED_WORDS.has(word)) {
      // Check if this word is an exception in biblical context
      if (hasBiblicalContext && CONTEXT_EXCEPTIONS.has(word)) {
        continue; // Allow in biblical context
      }
      flaggedWords.push(word);
    }
  }

  // Layer 2: Leetspeak detection
  const deLeetedText = deLeet(text);
  const deLeetedWords = deLeetedText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const word of deLeetedWords) {
    if (BLOCKED_WORDS.has(word) && !flaggedWords.includes(word)) {
      if (hasBiblicalContext && CONTEXT_EXCEPTIONS.has(word)) {
        continue;
      }
      flaggedWords.push(word);
    }
  }

  // Layer 3: Contextual phrase detection
  for (const pattern of BLOCKED_PHRASES) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason:
          "Your message contains content that doesn't align with our community values. " +
          "Please revise and try again. If you believe this is an error, contact Pastor Charlie.",
        severity: "blocked",
      };
    }
  }

  // Return results
  if (flaggedWords.length > 0) {
    return {
      allowed: false,
      reason:
        "Your message contains language that doesn't reflect the spirit of our community. " +
        "Please rephrase with grace and try again.",
      flaggedWords,
      severity: "blocked",
    };
  }

  return { allowed: true, severity: "clean" };
}

/**
 * Validate image upload before processing
 */
export function moderateImage(file: {
  type: string;
  size: number;
  name: string;
}): ModerationResult {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      allowed: false,
      reason: `File type "${file.type}" is not allowed. Please upload JPEG, PNG, GIF, or WebP images only.`,
      severity: "blocked",
    };
  }

  // Check file size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_IMAGE_SIZE_MB) {
    return {
      allowed: false,
      reason: `Image is too large (${sizeMB.toFixed(1)}MB). Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`,
      severity: "blocked",
    };
  }

  return { allowed: true, severity: "clean" };
}

/**
 * Sanitize display name / username
 */
export function moderateUsername(name: string): ModerationResult {
  const result = moderateText(name);
  if (!result.allowed) {
    return {
      ...result,
      reason: "This name contains inappropriate content. Please choose a different name.",
    };
  }

  // Additional username checks
  if (name.length < 2) {
    return {
      allowed: false,
      reason: "Name must be at least 2 characters.",
      severity: "blocked",
    };
  }

  if (name.length > 40) {
    return {
      allowed: false,
      reason: "Name must be 40 characters or fewer.",
      severity: "blocked",
    };
  }

  // Block impersonation attempts
  const impersonation = /\b(admin|moderator|pastor\s*charlie|staff|official)\b/i;
  if (impersonation.test(name) && !name.toLowerCase().includes("pastor charlie")) {
    return {
      allowed: false,
      reason: "This name could be confused with a church leader. Please choose a different name.",
      severity: "blocked",
    };
  }

  return { allowed: true, severity: "clean" };
}

/**
 * Rate limiting helper — tracks posts per user
 * In production, this would be server-side via Supabase
 */
const postTimestamps: Record<string, number[]> = {};

export function checkRateLimit(
  userId: string,
  maxPosts = 10,
  windowMinutes = 5
): ModerationResult {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  if (!postTimestamps[userId]) {
    postTimestamps[userId] = [];
  }

  // Clean old timestamps
  postTimestamps[userId] = postTimestamps[userId].filter(
    (ts) => now - ts < windowMs
  );

  if (postTimestamps[userId].length >= maxPosts) {
    return {
      allowed: false,
      reason: `You're posting too quickly. Please wait a few minutes before posting again.`,
      severity: "warning",
    };
  }

  postTimestamps[userId].push(now);
  return { allowed: true, severity: "clean" };
}
