'use strict';

const assert = require('assert');
const http = require('http');

const userId = 'd7f2b138-8ce2-4ea0-8a12-55a4268a5a21';
const accountNumber = '1234567890';
let failSchema = false;
let accountLookups = 0;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const dataServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/rest/v1/bank_accounts') {
    accountLookups += 1;
    if (failSchema) {
      return sendJson(res, 400, {
        code: '42703',
        message: 'column bank_users.date_of_birth does not exist',
      });
    }
    const requestedAccount = (url.searchParams.get('account_number') || '').replace(/^eq\./, '');
    const requestedDob = (url.searchParams.get('bank_users.date_of_birth') || '').replace(/^eq\./, '');
    return sendJson(res, 200, requestedAccount === accountNumber && requestedDob === '1984-08-17' ? [{
      balance: 5240050,
      status: 'active',
      bank_users: { date_of_birth: '1984-08-17', status: 'active' },
    }] : []);
  }
  if (url.pathname === '/rest/v1/bank_settings') return sendJson(res, 200, []);
  return sendJson(res, 404, { message: 'not found' });
});

function actionFrom(xml) {
  const match = /action="([^"]+)"/.exec(xml);
  assert(match, 'TeXML should include the next action URL');
  return new URL(match[1].replace(/&amp;/g, '&'));
}

async function post(base, pathname, fields) {
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  return { status: response.status, body: await response.text(), contentType: response.headers.get('content-type') };
}

async function postJson(base, pathname, fields) {
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  return { status: response.status, body: await response.text(), contentType: response.headers.get('content-type') };
}

async function invokeAction(base, action, callSid, fields) {
  return post(base, `${action.pathname}${action.search}`, { CallSid: callSid, ...fields });
}

(async () => {
  await new Promise((resolve) => dataServer.listen(0, '127.0.0.1', resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${dataServer.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'voice-test-service-key';
  process.env.BANK_ENCRYPTION_KEY = 'voice-test-encryption-key';
  process.env.PUBLIC_BASE_URL = 'https://www.standardmerchantfinance.com';

  const app = require('../src/api-app');
  const appServer = await new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => resolve(server));
  });
  const base = `http://127.0.0.1:${appServer.address().port}`;

  try {
    const callSid = 'voice-test-call-1';
    const start = await post(base, '/api/telnyx/voice', { CallSid: callSid, Direction: 'inbound' });
    assert.strictEqual(start.status, 200);
    assert.match(start.contentType, /text\/xml/);
    assert.match(start.body, /<Gather input="dtmf" numDigits="10"/);
    assert.match(start.body, /Polly\.Joanna/);
    const accountAction = actionFrom(start.body);

    const jsonStart = await postJson(base, '/api/telnyx/voice', { CallSid: 'voice-test-json-call', Direction: 'inbound' });
    assert.strictEqual(jsonStart.status, 200);
    assert.match(jsonStart.contentType, /text\/xml/);

    const enteredAccount = await invokeAction(base, accountAction, callSid, { Digits: accountNumber });
    assert.match(enteredAccount.body, /numDigits="8"/);
    assert.match(enteredAccount.body, /date of birth as eight digits/);
    const dobAction = actionFrom(enteredAccount.body);

    const verified = await invokeAction(base, dobAction, callSid, { Digits: '17081984' });
    assert.match(verified.body, /fifty-two thousand, four hundred dollars and fifty cents/);
    assert.doesNotMatch(verified.body, /52,400\.50|52400\.50/);
    assert.match(verified.body, /To hear another account balance, press one/);
    assert.strictEqual(accountLookups, 1);

    const badState = new URL(accountAction);
    badState.searchParams.set('state', `${badState.searchParams.get('state')}tampered`);
    const beforeTamperedRequest = accountLookups;
    const rejectedState = await invokeAction(base, badState, callSid, { Digits: accountNumber });
    assert.match(rejectedState.body, /cannot verify this call session/i);
    assert.strictEqual(accountLookups, beforeTamperedRequest, 'tampered state must not access account data');

    const retryCallSid = 'voice-test-call-2';
    const retryStart = await post(base, '/api/telnyx/voice', { CallSid: retryCallSid, Direction: 'inbound' });
    let retryAccountAction = actionFrom(retryStart.body);
    let firstDob = await invokeAction(base, retryAccountAction, retryCallSid, { Digits: accountNumber });
    let retryDobAction = actionFrom(firstDob.body);
    const firstFailure = await invokeAction(base, retryDobAction, retryCallSid, { Digits: '01011900' });
    assert.match(firstFailure.body, /could not verify your information/i);
    retryAccountAction = actionFrom(firstFailure.body);
    const secondDob = await invokeAction(base, retryAccountAction, retryCallSid, { Digits: accountNumber });
    retryDobAction = actionFrom(secondDob.body);
    const secondFailure = await invokeAction(base, retryDobAction, retryCallSid, { Digits: '01011900' });
    assert.match(secondFailure.body, /<Hangup\/>/);
    assert.doesNotMatch(secondFailure.body, /balance is/);

    failSchema = true;
    const schemaCallSid = 'voice-test-call-3';
    const schemaStart = await post(base, '/api/telnyx/voice', { CallSid: schemaCallSid, Direction: 'inbound' });
    const schemaAccount = await invokeAction(base, actionFrom(schemaStart.body), schemaCallSid, { Digits: accountNumber });
    const schemaResult = await invokeAction(base, actionFrom(schemaAccount.body), schemaCallSid, { Digits: '17081984' });
    assert.match(schemaResult.body, /cannot access your account information right now/i);
    assert.match(schemaResult.body, /<Hangup\/>/);

    console.log('  ok  TeXML prompts, encrypted session state, spoken balance, retries, and schema failure handling');
    console.log('\nTelnyx voice suite passed');
  } finally {
    await new Promise((resolve) => appServer.close(resolve));
    await new Promise((resolve) => dataServer.close(resolve));
  }
})().catch((error) => {
  console.error('\nFAILED:', error);
  process.exitCode = 1;
});
