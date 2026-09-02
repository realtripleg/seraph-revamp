/* Regenerate the admin password material for assets/app.js.
 *
 *   node tools/set-password.mjs '<new password>'
 *
 * The password itself is never written anywhere. What lands in app.js is a
 * random salt plus a PBKDF2-SHA256 verifier, which is what the browser
 * recomputes at login. Changing the password invalidates any GitHub token
 * already stored in a browser, because the token is encrypted under a key
 * derived from the password - you just paste the token again.
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ITERATIONS = 1200000;
const pw = process.argv[2];
if (!pw) { console.error("usage: node tools/set-password.mjs '<password>'"); process.exit(1); }

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, 256);
const verify = await crypto.subtle.digest('SHA-256', bits);

const block =
`    var AUTH = {
        user: 'gunner',
        salt: '${hex(salt)}',
        iters: ${ITERATIONS},
        verify: '${hex(verify)}'
    };`;

const path = 'assets/app.js';
const src = readFileSync(path, 'utf8');
const re = /    var AUTH = \{[\s\S]*?\n    \};/;
if (!re.test(src)) { console.error('AUTH block not found in ' + path); process.exit(1); }
writeFileSync(path, src.replace(re, block));

console.log('password updated in ' + path);
console.log('  salt   ' + hex(salt));
console.log('  iters  ' + ITERATIONS);
console.log('  verify ' + hex(verify).slice(0, 32) + '...');
if (/^\d{1,6}$/.test(pw)) {
    console.log('\nnote: an all-digit password this short is brute-forceable offline,');
    console.log('since the verifier ships publicly. A word-based passphrase is far stronger.');
}
