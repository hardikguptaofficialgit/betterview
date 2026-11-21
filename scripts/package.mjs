import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { updateStoreAssets } from './update-store-assets.mjs';

// Update store assets (store icon 128 and 1280x800 promo tiles)
try {
  updateStoreAssets();
} catch (err) {
  console.warn('[package] Could not update store assets:', err);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version || '0.1.0';

const releaseDir = path.resolve('release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const distDir = path.resolve('dist');
if (!fs.existsSync(distDir)) {
  console.error('[package] Error: dist/ directory does not exist. Run npm run build first.');
  process.exit(1);
}

const zipFileName = `betterview-ai-v${version}.zip`;
const zipFilePath = path.join(releaseDir, zipFileName);

if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

try {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(distDir, '*')}' -DestinationPath '${zipFilePath}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`cd '${distDir}' && zip -r '${zipFilePath}' ./*`, { stdio: 'inherit' });
  }

  console.log(`[package] Created release archive: release/${zipFileName}`);
} catch (err) {
  console.error('[package] Failed to create package zip:', err);
  process.exit(1);
}
