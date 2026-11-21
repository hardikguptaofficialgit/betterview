# BetterView Windows installer

The installer uses **Inno Setup 6** for a small, per-user Windows installer (no administrator prompt) and a PowerShell WinForms setup manager already included in Windows. This avoids shipping a browser, runtime, or paid installer service.

## Build

1. Install Inno Setup 6 from <https://jrsoftware.org/isinfo.php>.
2. From the repository root run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File installer/build.ps1
   ```

3. Find `release/BetterView-Setup.exe`.

To build against a fork, pass `-Repository owner/name`. The default is `hardikguptaofficialgit/betterview`.

## What it does

- Detects Chrome, Brave, and Edge using common per-user/system install locations and App Paths registry entries. You can also select a browser manually if detection misses it, or choose all detected browsers.
- Lists the browser's Default and additional profiles, with Default profile, a specific profile, and All profiles options. When all browsers are selected, named profiles are matched across the selected browsers.
- Retrieves the latest non-prerelease GitHub Release through the HTTPS API and downloads its BetterView ZIP asset.
- Requires GitHub's SHA-256 asset digest and verifies the downloaded bytes before extraction.
- Checks archive entry count, file sizes, traversal/absolute paths, root manifest identity, version, and required extension files.
- Stages new files before replacing the previous extension directory. It refuses to replace files while the selected browser process is running.
- Uses a compact black-and-white setup window with a draggable title bar, rounded close/minimize controls with clear hover and pressed states, accessible window controls, subtle borders, and matching owner-drawn browser/profile selectors with a high-contrast active row. On completion, it can use Windows UI Automation to open each selected browser profile's own extensions page, enable Developer mode, choose **Load unpacked**, and enter the BetterView extension folder in the folder picker.
- Prevents duplicate install actions and closing the manager during an install, reports clipboard/browser-launch/uninstall failures, quotes profile launch arguments, checks all installed Chromium browsers before replacing shared extension files, and still offers the browser handoff when the installed release is already current.
- The manager can check for newer releases; the user can rerun the setup manager to apply updates. Browser reload remains a user action.
- Uninstaller removes only BetterView's own application directory. Remove the loaded extension from the browser separately.

## Browser automation and security

The setup manager automates the visible Developer mode and **Load unpacked** steps when the browser exposes compatible Windows accessibility controls. Keep each browser window visible while it runs. Browser UI updates, localization, enterprise policies, or inaccessible folder dialogs can interrupt automation; the manager reports the affected browser/profile and leaves the extension folder path available for manual completion. Browser policy and security confirmation remain under the user's control; the installer does not silently change browser policies or credentials.

## Release publishing

Build and test `release/BetterView-Setup.exe`, then attach it to a GitHub Release alongside `betterview-ai-v<version>.zip`. Publish the installer asset only after code-signing it with a trusted Windows code-signing certificate; unsigned builds may show SmartScreen warnings. Do not publish an installer built from unreviewed source.

The installer expects GitHub Releases to expose the ZIP asset's SHA-256 digest (the `digest` field). If a release has no digest, it refuses to install rather than silently trusting an unverified download.
