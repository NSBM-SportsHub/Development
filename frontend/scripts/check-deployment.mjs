import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = process.argv[2] ? resolve(process.argv[2]) : new URL('../vercel.json', import.meta.url);
try {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  const rewrite = config.rewrites.find((rule) => rule.source === '/api/:path*');
  const url = new URL(rewrite?.destination);
  if (url.protocol !== 'https:' || url.hostname.endsWith('.invalid') || url.username || url.password || url.pathname !== '/api/:path*' || url.search || url.hash) throw Error();
  console.log('Deployment API origin configured: ' + url.origin);
} catch {
  console.error('Set the actual Render API URL before deployment: run node scripts/configure-vercel.mjs https://your-api.onrender.com from the repository root, then commit frontend/vercel.json.');
  process.exit(1);
}
