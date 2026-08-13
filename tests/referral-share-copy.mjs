import assert from 'node:assert/strict';
import { REFERRAL_SHARE_COPY, buildReferralInvitation } from '../src/referralInvite.js';

const firstCode = '3E807788';
const secondCode = 'AB12CD34';
const firstLink = 'https://app.spacenovax.com/join/3E807788';
const secondLink = 'https://app.spacenovax.com/join/AB12CD34';
const languages = Object.keys(REFERRAL_SHARE_COPY);

assert.equal(languages.length, 12, 'every supported app language needs referral copy');
for (const language of languages) {
  const firstInvitation = buildReferralInvitation({ language, code: firstCode, link: firstLink });
  const secondInvitation = buildReferralInvitation({ language, code: secondCode, link: firstLink });

  assert.equal(firstInvitation.code, firstCode, language + ' must keep the member referral code');
  assert.equal(firstInvitation.link, firstLink, language + ' must keep the member public invitation-card link');
  assert.ok(firstInvitation.text.includes(firstCode), language + ' share text must include the member referral code');
  assert.ok(firstInvitation.text.includes(firstLink), language + ' share text must include the member public invitation-card link');
  assert.equal(firstInvitation.text.includes(secondCode), false, language + ' share text must not contain another member code');

  assert.equal(secondInvitation.code, secondCode, language + ' must generate a separate member code');
  assert.equal(secondInvitation.link, secondLink, language + ' must rebuild a mismatched link with the current member code');
  assert.ok(secondInvitation.text.includes(secondCode), language + ' second share text must include its own code');
  assert.ok(secondInvitation.text.includes(secondLink), language + ' second share text must include its own public invitation-card link');
}

console.log(JSON.stringify({ languages: languages.length, personalCodes: true, publicInvitationCards: true }));
