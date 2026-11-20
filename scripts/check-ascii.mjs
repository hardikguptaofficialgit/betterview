import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  console.error(`Dist directory not found: ${distDir}`);
  process.exit(1);
}

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = getJsFiles(distDir);
if (jsFiles.length === 0) {
  console.error(`No .js files found in ${distDir}`);
  process.exit(1);
}

let hasError = false;

for (const filePath of jsFiles) {
  const relativePath = path.relative(process.cwd(), filePath);
  const buffer = fs.readFileSync(filePath);

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte > 0x7F) {
      console.error(
        `[check-ascii] Non-ASCII byte 0x${byte.toString(16).toUpperCase()} found at offset ${i} in ${relativePath}`
      );
      hasError = true;
      break;
    }
  }
}

if (hasError) {
  console.error('[check-ascii] FAILED: non-ASCII byte(s) found in dist/ .js files');
  process.exit(1);
}

console.log(`[check-ascii] PASSED: All ${jsFiles.length} .js file(s) in dist/ contain only ASCII (<= 0x7F)`);
