import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const i18nPath = path.join(root, 'src/lib/i18n.ts');
const content = fs.readFileSync(i18nPath, 'utf8');

function extractLocaleBlock(locale) {
  const order = ['fr', 'en', 'nl', 'es'];
  const idx = order.indexOf(locale);
  const next = order[idx + 1];
  const startRe = new RegExp(`^  ${locale}: \\{`, 'm');
  const startMatch = content.match(startRe);
  if (!startMatch) throw new Error(`Could not find ${locale} start`);
  const startIdx = startMatch.index + startMatch[0].length;
  const endRe = next ? new RegExp(`\\n  ${next}: \\{`) : /\n} as const;/;
  const endMatch = content.slice(startIdx).match(endRe);
  if (!endMatch) throw new Error(`Could not find ${locale} end`);
  return content.slice(startIdx, startIdx + endMatch.index);
}

function parseBlock(block) {
  const pairs = {};
  const lines = block.split('\n');
  let currentKey = null;
  let currentVal = '';
  let inString = false;
  let quote = '';

  for (const line of lines) {
    const keyMatch = line.match(/^\s+(\w+):\s*(.*)$/);
    if (!keyMatch) continue;
    const [, key, rest] = keyMatch;
    if (rest.startsWith("'") || rest.startsWith('"')) {
      quote = rest[0];
      const valPart = rest.slice(1);
      if (valPart.endsWith("',") || valPart.endsWith('",')) {
        pairs[key] = valPart.slice(0, -2).replace(/\\'/g, "'").replace(/\\n/g, '\n');
      } else {
        currentKey = key;
        currentVal = valPart;
        inString = true;
      }
    }
  }
  return pairs;
}

// Parse key-value pairs (single-quoted, double-quoted, multi-line)
function parseBlockRegex(block) {
  const pairs = {};
  const re =
    /^\s+(\w+):\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"|(\n\s*'((?:\\'|[^'])*)'|\n\s*"((?:\\"|[^"])*")))/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    const val = (m[2] ?? m[3] ?? m[5] ?? m[6] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    pairs[m[1]] = val;
  }
  return pairs;
}

const enBlock = extractLocaleBlock('en');
const enPairs = parseBlockRegex(enBlock);
console.log('Extracted EN keys:', Object.keys(enPairs).length);

/** Map flat key → nested group for Localazy organization */
function getGroup(key) {
  const rules = [
    ['_meta', () => key.startsWith('_')],
    ['hero', () => /^(tagline|subtagline|scanPlay|tryDemo)$/.test(key)],
    ['navbar', () => /^(home|friends|shop|history|settings|streak|level|xp|navChest|navMore|backHome|back)$/.test(key)],
    ['auth', () => /^auth/.test(key) || /^(email|password|login|signup|or|forgotPassword|continueGuest|connect|logout|togglePassword)$/.test(key)],
    ['scan', () => /^(import|scan|ocr|reading|building|demo|items|sheet|training|pair)/.test(key)],
    ['games', () => /^(flashcards|quiz|match|mode|listen|true|false|cloze|speak|type|game|express|examMode|beatScore|tryAnotherMode|pickGame|sessionHint|gotIt|newBest|flashcard)/.test(key)],
    ['lesson', () => /^lesson/.test(key)],
    ['path', () => /^path/.test(key) || /^step/.test(key)],
    ['results', () => /^result/.test(key) || /^(totalScore|shareDeck|exportDeck)$/.test(key)],
    ['history', () => /^history/.test(key) || /^exam/.test(key) || key === 'delete'],
    ['profile', () => /^profile/.test(key)],
    ['settings', () => /^settings/.test(key) || /^(account|guest|preferences|darkMode|language|currentPlan|about|aboutText|devPlan|audio|sound|haptic)/.test(key)],
    ['password', () => /^changePassword|^password|^newPassword|^confirmPassword|^togglePassword/.test(key)],
    ['privacy', () => /^privacy/.test(key)],
    ['subscription', () => /^(pricing|plan|billing|per|upgrade|current|select|compare|scansToday|unlimited|stripe)/.test(key) || key === 'gotIt'],
    ['synthesis', () => /^synthesis/.test(key)],
    ['shop', () => /^(shop|chest|reward|daily|coin|streak|navChest)/.test(key)],
    ['achievements', () => /^achievement/.test(key)],
    ['mistakes', () => /^mistake/.test(key)],
    ['social', () => /^(multiplayer|friend|social|notification)/.test(key)],
    ['guest', () => /^guest/.test(key)],
    ['install', () => /^install/.test(key)],
    ['mascot', () => /^mascot/.test(key)],
    ['report', () => /^report/.test(key)],
    ['footer', () => /^footer|^site/.test(key)],
    ['error_boundary', () => /^errorBoundary/.test(key)],
    ['common', () => true],
  ];
  for (const [group, test] of rules) {
    if (test()) return group;
  }
  return 'common';
}

function toSnakeCase(camelKey) {
  return camelKey.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase();
}

function buildNested(pairs, extra = {}) {
  const nested = { ...extra };
  for (const [key, val] of Object.entries(pairs)) {
    const group = getGroup(key);
    if (!nested[group]) nested[group] = {};
    // Keep original camelCase keys as leaf names for backward compat with t()
    nested[group][key] = val;
  }
  return nested;
}

// Add missing keys for hardcoded strings
const extraKeys = {
  games: {
    flashcardTerm: 'Term',
    flashcardMeaning: 'Meaning',
    flashcardTapFlip: 'Tap to flip',
    flashcardStillLearning: 'Still learning',
    flashcardGotIt: 'Got it!',
  },
  error_boundary: {
    errorBoundaryMessage: 'Something went wrong. Reload the page to continue.',
    errorBoundaryReload: 'Reload',
  },
  common: {
    ariaMainNav: 'Main navigation',
    ariaTogglePassword: 'Show password',
  },
};

const nested = buildNested(enPairs, {
  _meta: {
    _comment: 'ScanPlay UI strings for Localazy. Upload only this file. Keys are stable; do not rename placeholders like {name}, {count}, {days}.',
    _context: 'Educational SaaS — scan study sheets and play learning games.',
  },
});

// Merge extra keys
for (const [group, keys] of Object.entries(extraKeys)) {
  if (!nested[group]) nested[group] = {};
  Object.assign(nested[group], keys);
}

// Add stripe errors from stripeCheckout.ts
const stripeEn = {
  stripe_not_logged_in: 'Sign in to subscribe.',
  stripe_unauthorized: 'Session expired. Sign in again.',
  stripe_not_configured: 'Checkout is not enabled yet.',
  stripe_no_customer: 'No Stripe subscription found for this account.',
  stripe_invalid_plan: 'Invalid plan.',
  stripe_api_error: 'Payment error. Try again.',
  stripe_already_subscribed: 'You already have this active plan.',
  stripe_upgrade_after_period_end:
    'You cannot change plans before your current period ends. Cancel renewal, wait until it ends, then subscribe to the new plan.',
  stripe_no_active_subscription: 'No active subscription to cancel.',
  stripe_checkout_failed: 'Could not open Stripe checkout. Try again or contact support@scanplay.org.',
  stripe_internal_error: 'Server error during checkout. Sign in again or contact support@scanplay.org.',
  stripe_portal_timeout: 'Stripe portal is taking too long. Try again.',
  stripe_portal_url_missing: 'Could not open the Stripe portal. Try again.',
  stripe_portal_blocked: 'Open scanplay.org in Chrome or Safari, then try again.',
  stripe_supabase_not_configured:
    'Server config incomplete. Contact support@scanplay.org.',
};

if (!nested.subscription) nested.subscription = {};
Object.assign(nested.subscription, stripeEn);

const outDir = path.join(root, 'locales');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'en.json');
fs.writeFileSync(outPath, JSON.stringify(nested, null, 2) + '\n', 'utf8');

// Count all leaf strings
function countLeaves(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') n++;
    else if (v && typeof v === 'object') n += countLeaves(v);
  }
  return n;
}

console.log('Written:', outPath);
console.log('Total strings:', countLeaves(nested));
console.log('Groups:', Object.keys(nested).filter(k => !k.startsWith('_')).sort().join(', '));
