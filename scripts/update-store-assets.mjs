import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function updateStoreAssets(brandDir = path.resolve('public/brand'), storeDir = path.resolve('store')) {
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  // 1. Store icon 128
  const icon128Src = path.join(brandDir, 'icon-dark-128.png');
  if (fs.existsSync(icon128Src)) {
    fs.copyFileSync(icon128Src, path.join(storeDir, 'icon-128.png'));
    fs.copyFileSync(icon128Src, path.join(storeDir, 'icon128.png'));
    console.log('[store] Updated store icon 128: icon-128.png and icon128.png');
  } else {
    console.warn(`[store] Warning: ${icon128Src} not found.`);
  }

  // 2. Promo tiles: 1280x800 using logo-dark and logo-light
  const darkLogo = path.join(brandDir, 'logo-dark.png');
  const lightLogo = path.join(brandDir, 'logo-light.png');

  if (fs.existsSync(darkLogo)) {
    generatePromoTile(darkLogo, path.join(storeDir, 'promo-tile-dark.png'), 'Black');
    fs.copyFileSync(path.join(storeDir, 'promo-tile-dark.png'), path.join(storeDir, 'promo-dark-1280x800.png'));
    console.log('[store] Updated dark promo tile: promo-tile-dark.png & promo-dark-1280x800.png (1280x800)');
  }

  if (fs.existsSync(lightLogo)) {
    generatePromoTile(lightLogo, path.join(storeDir, 'promo-tile-light.png'), 'White');
    fs.copyFileSync(path.join(storeDir, 'promo-tile-light.png'), path.join(storeDir, 'promo-light-1280x800.png'));
    console.log('[store] Updated light promo tile: promo-tile-light.png & promo-light-1280x800.png (1280x800)');
  }
}

function generatePromoTile(srcPath, dstPath, colorName) {
  const normSrc = srcPath.replace(/\\/g, '/');
  const normDst = dstPath.replace(/\\/g, '/');

  if (process.platform === 'win32') {
    const psScript = [
      'Add-Type -AssemblyName System.Drawing',
      `$src = [System.Drawing.Bitmap]::FromFile('${normSrc}')`,
      '$bmp = [System.Drawing.Bitmap]::new(1280, 800)',
      '$g = [System.Drawing.Graphics]::FromImage($bmp)',
      '$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
      '$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
      '$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
      `$g.Clear([System.Drawing.Color]::${colorName})`,
      '$g.DrawImage($src, 40, 0, 1200, 800)',
      `$bmp.Save('${normDst}', [System.Drawing.Imaging.ImageFormat]::Png)`,
      '$g.Dispose()',
      '$bmp.Dispose()',
      '$src.Dispose()',
    ].join('; ');

    execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'inherit' });
  } else {
    // Non-windows: try python3 / PIL, magick, or sips
    try {
      execSync(`python3 -c "from PIL import Image; img=Image.open('${normSrc}'); bg=Image.new('RGBA', (1280, 800), '${colorName.toLowerCase()}'); img=img.resize((1200, 800), Image.Resampling.LANCZOS); bg.paste(img, (40, 0)); bg.convert('RGB').save('${normDst}')"`, { stdio: 'inherit' });
    } catch {
      try {
        execSync(`magick '${normSrc}' -resize 1200x800 -background '${colorName.toLowerCase()}' -gravity center -extent 1280x800 '${normDst}'`, { stdio: 'inherit' });
      } catch {
        try {
          execSync(`sips -z 800 1200 '${normSrc}' --out '${normDst}'`, { stdio: 'inherit' });
        } catch (e) {
          console.error('[store] Failed to generate promo tile with available tools:', e);
        }
      }
    }
  }
}

// When executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateStoreAssets();
}
