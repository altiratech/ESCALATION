import fs from 'node:fs/promises';
import path from 'node:path';

interface ImageMeta {
  id: string;
  path: string;
  domain: 'economy' | 'energy' | 'unrest' | 'military' | 'cyber' | 'diplomacy';
  severity: 0 | 1 | 2 | 3 | 4;
  environment: 'generic' | 'coastal' | 'arctic' | 'dense_city' | 'industrial';
  perspective: 'satellite' | 'street' | 'news_frame' | 'memo' | 'ticker';
  tags: string[];
}

const root = path.resolve(__dirname, '..');
const imageDir = path.join(root, 'apps/web/public/assets/images');
const metadataPath = path.join(root, 'packages/content/data/images.json');

const domains: Array<ImageMeta['domain']> = ['economy', 'energy', 'unrest', 'military', 'cyber', 'diplomacy'];
const environments: Array<ImageMeta['environment']> = ['generic', 'coastal', 'arctic', 'dense_city', 'industrial'];
const perspectives: Array<ImageMeta['perspective']> = ['satellite', 'street', 'news_frame', 'memo', 'ticker'];

const domainColors: Record<ImageMeta['domain'], { base: string; accent: string }> = {
  economy: { base: '#243040', accent: '#c9a86a' },
  energy: { base: '#1f2c3d', accent: '#cc7f49' },
  unrest: { base: '#2b1f25', accent: '#cc7f49' },
  military: { base: '#1f2630', accent: '#8da6c1' },
  cyber: { base: '#1d2c2f', accent: '#6aa285' },
  diplomacy: { base: '#2a2830', accent: '#b8a6ce' }
};

const buildSvg = (meta: ImageMeta): string => {
  const palette = domainColors[meta.domain];
  const alpha = 0.15 + meta.severity * 0.13;
  const glow = (meta.severity + 1) * 18;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.base}" />
      <stop offset="100%" stop-color="#10161d" />
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="20%" r="70%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="${alpha.toFixed(2)}" />
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#grad)" />
  <rect width="1280" height="720" fill="url(#glow)" />
  <rect x="40" y="40" width="1200" height="640" fill="none" stroke="${palette.accent}" stroke-opacity="0.36" />
  <circle cx="980" cy="120" r="${glow}" fill="${palette.accent}" fill-opacity="${(alpha * 0.6).toFixed(2)}" />
  <text x="72" y="120" fill="#e6e5df" font-family="IBM Plex Sans, sans-serif" font-size="24" letter-spacing="4">ESCALATION VISUAL LEXICON</text>
  <text x="72" y="172" fill="#9ca7b3" font-family="IBM Plex Sans, sans-serif" font-size="16">${meta.domain.toUpperCase()} | ${meta.environment.toUpperCase()} | ${meta.perspective.toUpperCase()}</text>
  <text x="72" y="216" fill="#9ca7b3" font-family="IBM Plex Sans, sans-serif" font-size="16">SEVERITY LEVEL ${meta.severity}</text>
  <line x1="72" y1="248" x2="500" y2="248" stroke="${palette.accent}" stroke-opacity="0.5" />
  <text x="72" y="288" fill="#d6d6d0" font-family="Source Serif 4, serif" font-size="34">Simulation Placeholder Frame</text>
  <rect x="72" y="330" width="420" height="3" fill="${palette.accent}" fill-opacity="0.65" />
  <text x="72" y="382" fill="#d6d6d0" font-family="IBM Plex Sans, sans-serif" font-size="18">Tagged for deterministic selection and non-repeating rotation logic.</text>
</svg>`;
};

const run = async (): Promise<void> => {
  await fs.mkdir(imageDir, { recursive: true });

  const metadata: ImageMeta[] = [];
  let index = 1;

  for (const domain of domains) {
    for (let severity = 0 as ImageMeta['severity']; severity <= 4; severity += 1 as ImageMeta['severity']) {
      const environment = environments[(index + severity) % environments.length] as ImageMeta['environment'];
      const perspective = perspectives[(index * 2 + severity) % perspectives.length] as ImageMeta['perspective'];
      const id = `img_${String(index).padStart(3, '0')}`;
      const filename = `${id}.svg`;

      const meta: ImageMeta = {
        id,
        path: `/assets/images/${filename}`,
        domain,
        severity,
        environment,
        perspective,
        tags: [domain, environment, perspective, severity >= 3 ? 'high_tension' : 'low_tension']
      };

      metadata.push(meta);
      await fs.writeFile(path.join(imageDir, filename), buildSvg(meta), 'utf8');
      index += 1;
    }
  }

  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  console.log(`Generated ${metadata.length} placeholder images and metadata.`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
