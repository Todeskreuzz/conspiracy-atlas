#!/usr/bin/env node
// Generates a PBKDF2-SHA256 admin password hash locally.
// The password is read without echo and never written anywhere; only the hash is printed.
// Usage: npm run hash-password   then   npx wrangler pages secret put ADMIN_PASSWORD_HASH --project-name conspiracy-atlas
import { webcrypto as crypto } from 'node:crypto';
import readline from 'node:readline';

const ITERATIONS = 100000; // Cloudflare Workers' PBKDF2 maximum

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(prompt)) process.stdout.write(prompt);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const toHex = (buf) => Buffer.from(buf).toString('hex');

const password = process.stdin.isTTY ? await ask('Admin password: ') : (await new Promise((r) => { let d = ''; process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => r(d.replace(/\r?\n$/, ''))); }));
if (process.stdin.isTTY) {
  const repeat = await ask('Repeat password: ');
  if (repeat !== password) {
    console.error('Passwords do not match.');
    process.exit(1);
  }
}
if (password.length < 12) {
  console.error('Use at least 12 characters.');
  process.exit(1);
}
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
console.log(`pbkdf2_sha256$${ITERATIONS}$${toHex(salt)}$${toHex(bits)}`);
