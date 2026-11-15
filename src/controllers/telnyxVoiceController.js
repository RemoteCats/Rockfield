'use strict';

const crypto = require('crypto');
const { getSupabase } = require('../utils/supabase');

const MAX_ATTEMPTS = 2;
const STATE_TTL_MS = 15 * 60 * 1000;
const BANK_ACCOUNT_NUMBER_LENGTH = 10;

const SMALL_NUMBERS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

function say(text) {
  return `<Say voice="Polly.Joanna">${xmlEscape(text)}</Say>`;
}

function texml(res, verbs) {
  res.status(200).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response>${verbs}</Response>`);
}

function hangUp(res, message) {
  texml(res, `${message ? say(message) : ''}<Hangup/>`);
}

function encryptionKey() {
  const secret = String(process.env.BANK_ENCRYPTION_KEY || '');
  if (!secret) throw new Error('BANK_ENCRYPTION_KEY is required for voice session state');
  return crypto.createHash('sha256').update('rockfield-telnyx-voice-state-v1\0').update(secret).digest();
}

function encodeState(state) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ ...state, expiresAt: Date.now() + STATE_TTL_MS }), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

function decodeState(token, callSid) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  try {
    const packed = Buffer.from(token, 'base64url');
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const state = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    if (state.callSid !== callSid || !Number.isFinite(state.expiresAt) || state.expiresAt < Date.now()) return null;
    if (!['account', 'dob', 'more'].includes(state.phase)) return null;
    if (!Number.isInteger(state.attempts) || state.attempts < 0 || state.attempts >= MAX_ATTEMPTS) return null;
    if (state.phase === 'dob' && !/^\d{10}$/.test(state.accountNumber || '')) return null;
    return state;
  } catch (error) {
    return null;
  }
}

function makeActionUrl(step, state) {
  const url = new URL('/api/telnyx/voice', 'https://www.standardmerchantfinance.com');
  url.searchParams.set('step', step);
  url.searchParams.set('state', encodeState(state));
  return url.toString();
}

function gather({ step, state, digits, prompt }) {
  const action = xmlEscape(makeActionUrl(step, state));
  return `<Gather input="dtmf" numDigits="${digits}" timeout="10" action="${action}" method="POST">${say(prompt)}</Gather>${say('We did not receive your entry. Goodbye.')}<Hangup/>`;
}

function accountPrompt(res, callSid, attempts, intro = '') {
  const state = { callSid, attempts, phase: 'account' };
  const prompt = `${intro ? `${intro} ` : ''}Please enter your ten digit account number on your keypad.`;
  texml(res, gather({ step: 'account', state, digits: BANK_ACCOUNT_NUMBER_LENGTH, prompt }));
}

function parseDateOfBirth(digits) {
  if (!/^\d{8}$/.test(String(digits || ''))) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function integerToWords(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1_000_000_000_000_000) {
    throw new Error('Amount is outside the supported speech range');
  }
  if (value < 20) return SMALL_NUMBERS[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? `-${SMALL_NUMBERS[value % 10]}` : ''}`;
  if (value < 1000) {
    const remainder = value % 100;
    return `${SMALL_NUMBERS[Math.floor(value / 100)]} hundred${remainder ? ` ${integerToWords(remainder)}` : ''}`;
  }

  const groups = [];
  let remaining = value;
  let scale = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group) groups.unshift(`${integerToWords(group)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  return groups.join(', ');
}

function balanceToWords(balanceCents) {
  const cents = Number(balanceCents);
  if (!Number.isSafeInteger(cents)) throw new Error('Account balance is not a safe integer in cents');
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const dollarLabel = dollars === 1 ? 'dollar' : 'dollars';
  const centLabel = remainder === 1 ? 'cent' : 'cents';
  return `${cents < 0 ? 'negative ' : ''}${integerToWords(dollars)} ${dollarLabel} and ${integerToWords(remainder)} ${centLabel}`;
}

function joinedUser(account) {
  const relation = account && account.bank_users;
  if (Array.isArray(relation)) return relation[0] || null;
  return relation || null;
}

async function findAccount(accountNumber, dateOfBirth) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const rows = await supabase.select(
    'bank_accounts',
    `select=balance,status,bank_users!inner(id)&account_number=eq.${encodeURIComponent(accountNumber)}` +
      `&status=eq.active&bank_users.status=eq.active&bank_users.date_of_birth=eq.${encodeURIComponent(dateOfBirth)}&limit=1`
  );
  const account = Array.isArray(rows) ? rows[0] : null;
  const user = joinedUser(account);
  if (!account || !user || account.status !== 'active') return null;
  return { balance: account.balance };
}

function promptForDob(res, state) {
  texml(res, gather({
    step: 'dob',
    state: { callSid: state.callSid, attempts: state.attempts, phase: 'dob', accountNumber: state.accountNumber },
    digits: 8,
    prompt: 'Thank you. Please enter your date of birth as eight digits: day, month, and four digit year.',
  }));
}

function failedAttempt(res, state) {
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return hangUp(res, 'We could not verify your information. For your security, please contact the bank for assistance. Goodbye.');
  }
  return accountPrompt(res, state.callSid, attempts, 'We could not verify your information.');
}

function callSidFrom(req) {
  const value = req.body && (req.body.CallSid || req.body.call_sid);
  return typeof value === 'string' && value.length <= 200 ? value.trim() : '';
}

async function handle(req, res) {
  try {
    const step = String(req.query.step || 'start');
    const body = req.body || {};
    const callSid = callSidFrom(req);

    if (step === 'start') {
      if (!callSid || (body.Direction && !/^inbound$/i.test(String(body.Direction)))) {
        return hangUp(res, 'We cannot complete this call. Goodbye.');
      }
      return accountPrompt(res, callSid, 0, 'Welcome to Standard Merchant Finance.');
    }

    const state = decodeState(req.query.state, callSid);
    if (!state || state.phase !== step) {
      return hangUp(res, 'We cannot verify this call session. Please call again. Goodbye.');
    }

    const digits = String(body.Digits || body.digits || '');
    if (step === 'account') {
      if (!/^\d{10}$/.test(digits)) return failedAttempt(res, state);
      return promptForDob(res, { ...state, phase: 'dob', accountNumber: digits });
    }

    if (step === 'dob') {
      const dateOfBirth = parseDateOfBirth(digits);
      if (!dateOfBirth) return failedAttempt(res, state);

      let account;
      try {
        account = await findAccount(state.accountNumber, dateOfBirth);
      } catch (error) {
        console.error('[rockfield] Telnyx balance lookup failed:', error && error.message ? error.message : 'unknown database error');
        return hangUp(res, 'We cannot access your account information right now. Please try again later. Goodbye.');
      }

      if (!account) {
        return failedAttempt(res, state);
      }

      let balance;
      try {
        balance = balanceToWords(account.balance);
      } catch (error) {
        console.error('[rockfield] Telnyx balance could not be spoken:', error && error.message ? error.message : 'invalid balance');
        return hangUp(res, 'We cannot access your account information right now. Please try again later. Goodbye.');
      }

      const moreState = { callSid, attempts: 0, phase: 'more' };
      const action = xmlEscape(makeActionUrl('more', moreState));
      return texml(res, `${say(`Your current balance is ${balance}.`)}<Gather input="dtmf" numDigits="1" timeout="8" action="${action}" method="POST">${say('To hear another account balance, press one. Otherwise, you may hang up.')}</Gather>${say('Thank you for banking with Standard Merchant Finance. Goodbye.')}<Hangup/>`);
    }

    if (step === 'more') {
      if (digits === '1') return accountPrompt(res, callSid, 0, '');
      return hangUp(res, 'Thank you for banking with Standard Merchant Finance. Goodbye.');
    }

    return hangUp(res, 'We cannot complete this call. Goodbye.');
  } catch (error) {
    console.error('[rockfield] Telnyx voice handler failed:', error && error.message ? error.message : 'unknown error');
    return hangUp(res, 'We cannot complete this call right now. Please try again later. Goodbye.');
  }
}

module.exports = {
  handle,
  parseDateOfBirth,
  integerToWords,
  balanceToWords,
};
