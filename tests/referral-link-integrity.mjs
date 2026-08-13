import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const v15 = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');
const legacy = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

assert.equal(/SpaceNovaXBot/.test(`${server}\n${v15}\n${legacy}`), false, 'retired bot username remains in app source');
assert.match(server, /SpaceNovaXAdminBot/, 'official Admin Bot fallback is missing');
assert.match(server, /verifiedBotReferralTicket/, 'signed bot-to-app referral verification is missing');
assert.match(server, /function publicReferralLink/, 'public invitation-card link helper is missing');
assert.match(server, /REFERRAL_SHARE_VERSION = 'join-fleet-20260814'/, 'referral preview cache-busting version is missing');
assert.match(server, /referralLink:\s*publicReferralLink/, 'primary app referral link must open the public invitation card');
assert.match(server, /telegramReferralLink:\s*telegramReferralLink/, 'invitation card must retain the official Telegram handoff');
assert.match(server, /legacyReferralLink:/, 'legacy share-link compatibility is missing');
assert.match(server, /app\.get\('\/join\/:code'/, 'public invitation-card route is missing');
assert.match(server, /const telegramUrl = telegramReferralLink\(code\)/, 'invitation card must hand off to the official bot with the same code');
assert.match(server, /captain\.id === user\.id/, 'self-referral guard is missing');
assert.match(server, /if \(user\.referredBy\)/, 'one-time referral attribution guard is missing');
assert.match(server, /REFERRAL_HARD_LIMIT = 1000/, '1,000-member referral hard limit is missing');

console.log(JSON.stringify({ publicInvitationCards: true, officialBot: true, signedHandoff: true, oneTimeAttribution: true, hardLimit: 1000 }));
