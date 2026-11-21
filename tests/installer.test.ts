import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Windows installer and download page', () => {
  const manager = read('installer/BetterViewManager.ps1');
  const setup = read('installer/BetterView.iss');
  const download = read('landing-page/download.html');
  const landing = read('landing-page/index.html');

  it('requires a GitHub-provided SHA-256 digest and verifies downloaded bytes', () => {
    expect(manager).toContain("$asset.digest");
    expect(manager).toContain("Get-FileHash -LiteralPath $zip -Algorithm SHA256");
    expect(manager).toContain("$actual -ne $Release.Sha256");
  });

  it('validates archive paths and the BetterView extension manifest before install', () => {
    expect(manager).toContain("$name -match '(^|\\\\)\\.\\.(\\\\|$)'");
    expect(manager).toContain("$manifest.name -ne 'BetterView AI'");
    expect(manager).toContain("'popup.html','content.js','background.js','content-main.js'");
  });

  it('supports Chrome, Brave and Edge without requesting administrator privileges', () => {
    for (const browser of ['Google Chrome', 'Brave', 'Microsoft Edge']) expect(manager).toContain(browser);
    expect(setup).toContain('PrivilegesRequired=lowest');
  });

  it('stages updates and refuses to replace files while the browser is running', () => {
    expect(manager).toContain("'staging-' + [guid]");
    expect(manager).toContain('Close all $($browser.Name) windows before updating');
    expect(manager).toContain('previous-extension');
  });

  it('offers browser-wide and per-profile setup without relying on a missing Value property', () => {
    expect(manager).toContain("'All detected browsers'");
    expect(manager).toContain("'All profiles'");
    expect(manager).toContain('function Get-BrowserProfiles');
    expect(manager).toContain('--profile-directory=');
    expect(manager).toContain('chrome://extensions/');
    expect(manager).toContain('--new-window');
    expect(manager).toContain('[Windows.Forms.Clipboard]::SetText($script:ExtensionRoot)');
    expect(manager).toContain('Select-Object -ExpandProperty Label -Unique');
    expect(manager).not.toContain('$progress.Value');
  });

  it('uses browser-specific extension pages and automates the unpacked extension flow', () => {
    expect(manager).toContain("Page='edge://extensions/'");
    expect(manager).toContain("Page='brave://extensions/'");
    expect(manager).toContain('function Invoke-BrowserSetup');
    expect(manager).toContain("Find-UiElement -Root $window -Name 'Developer mode'");
    expect(manager).toContain("Find-UiElement -Root $window -Name 'Load unpacked'");
    expect(manager).toContain("$developer.SetFocus()");
    expect(manager).toContain("[Windows.Forms.SendKeys]::SendWait(' ')");
    expect(manager).toContain("$pane.Current.Name -match '^[A-Za-z]:'");
    expect(manager).toContain('[Windows.Forms.Clipboard]::SetText($ExtensionPath)');
    expect(manager).toContain('[BetterViewNativeClick]::Click');
    expect(manager).toContain("Find-UiElement -Root $folderDialog -Name 'Select Folder'");
    expect(manager).toContain('Start automatic browser setup?');
  });

  it('includes the BetterView logo in the setup window and installer package', () => {
    expect(manager).toContain("Join-Path $PSScriptRoot 'BetterView.png'");
    expect(setup).toContain('icon-dark-128.png');
  });

  it('uses a compact branded window with custom chrome and owner-drawn selectors', () => {
    expect(manager).toContain("$form.FormBorderStyle='None'");
    expect(manager).toContain("$closeGlyph=[string][char]0x00D7");
    expect(manager).toContain("$minimizeGlyph=[string][char]0x2014");
    expect(manager).toContain("Background=[Drawing.Color]::White; Header=[Drawing.Color]::White; Card=[Drawing.Color]::White");
    expect(manager).toContain("Accent=[Drawing.Color]::FromArgb(18,18,18); AccentText=[Drawing.Color]::White");
    expect(manager).toContain("$close.FlatAppearance.MouseOverBackColor=[Drawing.Color]::FromArgb(18,18,18)");
    expect(manager).toContain("if($radius -le 0 -or $control.Width -le 0 -or $control.Height -le 0){$control.Region=$null;return}");
    expect(manager).toContain("$browserList.DrawMode='OwnerDrawFixed'");
    expect(manager).toContain("$profileList.DrawMode='OwnerDrawFixed'");
    expect(manager).toContain("$card.Size=New-Object Drawing.Size(580,526)");
    expect(manager).toContain("$close.AccessibleName='Close BetterView setup'");
    expect(manager).toContain("$minimize.AccessibleName='Minimize window'");
    expect(manager).toContain("$b.FlatAppearance.MouseDownBackColor=if($fore -eq [Drawing.Color]::White)");
    expect(manager).toContain('$browserList.Add_DrawItem($drawSelector)');
    expect(manager).toContain('$profileList.Add_DrawItem($drawSelector)');
    expect(manager).toContain("$sender.DroppedDown");
  });

  it('guards repeated actions, close-during-install, clipboard and browser launch failures', () => {
    expect(manager).toContain('if($script:ManagerBusy){return}');
    expect(manager).toContain('if($script:ManagerBusy){$e.Cancel=$true}');
    expect(manager).toContain('$clipboardReady=$false');
    expect(manager).toContain('$launchFailures=@()');
    expect(manager).toContain("'Browser setup needs attention'");
    expect(manager).toContain("'Uninstall failed'");
  });

  it('links the landing-page install CTA to a dedicated download page', () => {
    expect(landing).toContain('href="download.html"');
    expect(download).toContain('BetterView-Setup.exe');
    expect(download).toContain('Developer mode');
    expect(download).toContain('Load unpacked');
    expect(download).toContain('api.github.com/repos/hardikguptaofficialgit/betterview/releases/latest');
  });
});
