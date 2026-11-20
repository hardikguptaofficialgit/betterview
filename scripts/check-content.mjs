import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const contentJsPath = path.join(distDir, 'content.js');
const manifestPath = path.join(distDir, 'manifest.json');

let hasError = false;

// 1. Check manifest.json for content-main.js in web_accessible_resources
if (!fs.existsSync(manifestPath)) {
  console.error(`[check-content] FAILED: ${manifestPath} does not exist`);
  process.exit(1);
}

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const war = manifest.web_accessible_resources;
  const hasContentMain = Array.isArray(war) && war.some((entry) => {
    return Array.isArray(entry.resources) && entry.resources.includes('content-main.js');
  });

  if (!hasContentMain) {
    console.error('[check-content] FAILED: content-main.js is missing from web_accessible_resources in dist/manifest.json');
    hasError = true;
  }
} catch (err) {
  console.error('[check-content] FAILED: Could not parse manifest.json:', err);
  hasError = true;
}

// 2. Check dist/content.js for top-level import/export and relative dynamic imports
if (!fs.existsSync(contentJsPath)) {
  console.error(`[check-content] FAILED: ${contentJsPath} does not exist`);
  process.exit(1);
}

const contentCode = fs.readFileSync(contentJsPath, 'utf8');

// Check for relative dynamic imports
if (contentCode.includes('import("./') || contentCode.includes("import('./")) {
  console.error('[check-content] FAILED: dist/content.js contains relative dynamic import ("import(\\"./...")');
  hasError = true;
}

// Check for top-level import statements (static imports start with "import " followed by identifiers, {, *, or quotes)
const importStatementRegex = /(?:^|[\n;])\s*import\s+/;
if (importStatementRegex.test(contentCode)) {
  console.error('[check-content] FAILED: dist/content.js contains a top-level import statement');
  hasError = true;
}

// Check for export statements (e.g., export default, export const, export {, export{)
const exportStatementRegex = /(?:^|[\n;])\s*export[\s{]/;
if (exportStatementRegex.test(contentCode)) {
  console.error('[check-content] FAILED: dist/content.js contains an export statement');
  hasError = true;
}

if (hasError) {
  process.exit(1);
}

console.log('[check-content] PASSED: dist/content.js has no top-level import/export or relative dynamic imports, and content-main.js is in web_accessible_resources');
