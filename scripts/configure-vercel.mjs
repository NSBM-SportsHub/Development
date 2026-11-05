import { readFileSync, writeFileSync } from 'node:fs';
const value = process.argv[2];
let origin;
try {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error();
  origin = url.origin;
} catch { console.error('Usage: node scripts/configure-vercel.mjs https://your-actual-api.onrender.com'); process.exit(1); }
const path = new URL('../frontend/vercel.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
config.rewrites[0].destination = `${origin}/api/:path*`;
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Frontend API rewrite configured for ' + origin + '. Commit frontend/vercel.json before deploying.');
