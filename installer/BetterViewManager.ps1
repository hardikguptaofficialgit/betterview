param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$script:Repository = if ($env:BETTERVIEW_REPOSITORY) { $env:BETTERVIEW_REPOSITORY } else { 'hardikguptaofficialgit/betterview' }
$script:InstallRoot = Join-Path $env:LOCALAPPDATA 'Programs\BetterView'
$script:ExtensionRoot = Join-Path $script:InstallRoot 'extension'
$script:StateFile = Join-Path $script:InstallRoot 'install.json'
$script:ApiHeaders = @{ 'User-Agent' = 'BetterView-Windows-Installer'; 'Accept' = 'application/vnd.github+json' }

function Get-BrowserCandidates {
  $items = @(
    @{ Name='Google Chrome'; Id='chrome'; Url='https://chrome.google.com'; Page='chrome://extensions/'; Paths=@("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"); Keys=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe') },
    @{ Name='Brave'; Id='brave'; Url='https://brave.com'; Page='brave://extensions/'; Paths=@("$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"); Keys=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\brave.exe','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\brave.exe') },
    @{ Name='Microsoft Edge'; Id='edge'; Url='https://www.microsoft.com/edge'; Page='edge://extensions/'; Paths=@("$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"); Keys=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe') }
  )
  foreach ($item in $items) {
    $exe = $item.Paths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
    if (-not $exe) {
      foreach ($key in $item.Keys) {
        if (Test-Path $key) { $candidate = (Get-Item $key).GetValue(''); if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { $exe = $candidate; break } }
      }
    }
    $item.Exe = $exe
    $item.Installed = [bool]$exe
    [pscustomobject]$item
  }
}

function Get-LatestRelease {
  $uri = "https://api.github.com/repos/$script:Repository/releases/latest"
  $release = Invoke-RestMethod -Uri $uri -Headers $script:ApiHeaders -TimeoutSec 30
  $asset = @($release.assets | Where-Object { $_.name -match '^betterview-ai-v.+\.zip$' } | Select-Object -First 1)[0]
  if (-not $asset -or -not $asset.browser_download_url -or $asset.browser_download_url -notmatch '^https://github\.com/') { throw 'The latest GitHub release does not contain a valid BetterView ZIP asset.' }
  $digest = [string]$asset.digest
  if ($digest -notmatch '^sha256:[a-fA-F0-9]{64}$') { throw 'GitHub did not provide a SHA-256 asset digest. Refusing to install an unverifiable package.' }
  [pscustomobject]@{ Version=[string]$release.tag_name; Asset=$asset; Sha256=$digest.Substring(7).ToLowerInvariant(); Page=$release.html_url }
}

function Get-InstalledVersion {
  $manifestPath = Join-Path $script:ExtensionRoot 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { return $null }
  try { return [string](Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).version } catch { return $null }
}

function Test-VersionNewer([string]$Latest, [string]$Installed) {
  try {
    $a = [version]($Latest -replace '^[vV]',''); $b = [version]($Installed -replace '^[vV]','')
    return $a -gt $b
  } catch { return $Latest -ne $Installed }
}

function Expand-VerifiedPackage([string]$ZipPath, [string]$Destination) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    if ($archive.Entries.Count -lt 3 -or $archive.Entries.Count -gt 5000) { throw 'The release archive has an unexpected number of files.' }
    $root = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
    foreach ($entry in $archive.Entries) {
      $name = $entry.FullName.Replace('/', '\')
      if ([string]::IsNullOrWhiteSpace($name) -or $name.StartsWith('\') -or $name -match '(^|\\)\.\.(\\|$)' -or $name -match '^[a-zA-Z]:') { throw "Unsafe path in release archive: $($entry.FullName)" }
      $target = [IO.Path]::GetFullPath((Join-Path $Destination $name))
      if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'The release archive contains a path traversal entry.' }
      if ($entry.Length -gt 100MB) { throw 'The release archive contains an unexpectedly large file.' }
    }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Destination)
  } finally { $archive.Dispose() }
  $manifestPath = Join-Path $Destination 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'The downloaded package is missing manifest.json at its root.' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.name -ne 'BetterView AI' -or $manifest.manifest_version -ne 3 -or -not $manifest.version) { throw 'The downloaded extension manifest failed validation.' }
  foreach ($required in @('popup.html','content.js','background.js','content-main.js')) { if (-not (Test-Path -LiteralPath (Join-Path $Destination $required))) { throw "The package is incomplete: $required is missing." } }
  return [string]$manifest.version
}

function Invoke-Install([object]$Release, [object[]]$Browsers, [scriptblock]$Progress) {
  $work = Join-Path $env:TEMP ('BetterView-' + [guid]::NewGuid().ToString('N'))
  $stage = Join-Path $script:InstallRoot ('staging-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $script:InstallRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $work,$stage -Force | Out-Null
  try {
    $zip = Join-Path $work 'betterview.zip'
    & $Progress 20 'Downloading the latest official release…'
    Invoke-WebRequest -Uri $Release.Asset.browser_download_url -OutFile $zip -Headers @{ 'User-Agent'='BetterView-Windows-Installer' } -TimeoutSec 120
    & $Progress 48 'Verifying SHA-256 package integrity…'
    $actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Release.Sha256) { throw 'SHA-256 verification failed. The downloaded file may be corrupted or modified.' }
    & $Progress 65 'Checking and safely extracting extension files…'
    $version = Expand-VerifiedPackage -ZipPath $zip -Destination $stage
    if ($version -ne ($Release.Version -replace '^[vV]','')) { throw 'The package version does not match the GitHub release tag.' }
    if ($script:ExtensionRoot -and (Test-Path -LiteralPath $script:ExtensionRoot)) {
      $processNames = @{ chrome='chrome'; brave='brave'; edge='msedge' }
      foreach ($browser in (Get-BrowserCandidates | Where-Object Installed)) {
        if ($browser.Installed -and (Get-Process -Name $processNames[$browser.Id] -ErrorAction SilentlyContinue)) { throw "Close all $($browser.Name) windows before updating so extension files are not changed while in use." }
      }
      & $Progress 82 'Preparing the update…'
      $backup = Join-Path $script:InstallRoot 'previous-extension'
      if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
      Move-Item -LiteralPath $script:ExtensionRoot -Destination $backup
      try { Move-Item -LiteralPath $stage -Destination $script:ExtensionRoot; Remove-Item -LiteralPath $backup -Recurse -Force }
      catch { if (-not (Test-Path $script:ExtensionRoot) -and (Test-Path $backup)) { Move-Item -LiteralPath $backup -Destination $script:ExtensionRoot }; throw }
    } else { Move-Item -LiteralPath $stage -Destination $script:ExtensionRoot }
    New-Item -ItemType Directory -Path $script:InstallRoot -Force | Out-Null
    @{ version=$version; browsers=@($Browsers | ForEach-Object { $_.Id }); installedAt=(Get-Date).ToUniversalTime().ToString('o'); extensionPath=$script:ExtensionRoot } | ConvertTo-Json | Set-Content -LiteralPath $script:StateFile -Encoding UTF8
    & $Progress 100 'BetterView files are ready. Preparing browser setup…'
    return $version
  } finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

function Get-BrowserProfiles([object]$Browser) {
  $root = switch ($Browser.Id) {
    'chrome' { Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data' }
    'brave' { Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\User Data' }
    'edge' { Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data' }
  }
  $profiles = @()
  if ($root -and (Test-Path -LiteralPath $root -PathType Container)) {
    $profiles = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$' } | Sort-Object @{Expression={ if ($_.Name -eq 'Default') { 0 } else { [int]($_.Name -replace '\D','') } }} | ForEach-Object {
      $profileName=$null; $preferencesPath=Join-Path $_.FullName 'Preferences'
      if (Test-Path -LiteralPath $preferencesPath -PathType Leaf) { try { $profileName=[string](Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json).profile.name } catch { $profileName=$null } }
      $label=if ($_.Name -eq 'Default') { 'Default profile' } elseif ($profileName) { "$profileName ($($_.Name))" } else { $_.Name }
      [pscustomobject]@{ Name=$_.Name; Label=$label; Directory=$_.Name }
    })
  }
  if (-not $profiles) { $profiles = @([pscustomobject]@{ Name='Default'; Label='Default profile'; Directory='Default' }) }
  return $profiles
}

function Find-UiElement([System.Windows.Automation.AutomationElement]$Root, [string]$Name, [System.Windows.Automation.TreeScope]$Scope = [System.Windows.Automation.TreeScope]::Descendants) {
  $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)
  $matches = $Root.FindAll($Scope, $condition)
  if (-not $matches -or $matches.Count -eq 0) { return $null }
  foreach ($element in $matches) {
    if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button) { return $element }
  }
  return $matches[0]
}

function Invoke-BrowserSetup([object]$Browser, [object]$Profile, [string]$ExtensionPath, [object]$StatusLabel) {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName System.Windows.Forms
  if (-not ('BetterViewNativeClick' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class BetterViewNativeClick {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
'@
  }
  if ($StatusLabel) { $StatusLabel.Text="Opening $($Browser.Name) / $($Profile.Label)…"; $StatusLabel.FindForm().Refresh(); [Windows.Forms.Application]::DoEvents() }
  $processName = @{ chrome='chrome'; brave='brave'; edge='msedge' }[$Browser.Id]
  $arguments = '--profile-directory="' + $Profile.Directory + '" --new-window "' + $Browser.Page + '"'
  Start-Process -FilePath $Browser.Exe -ArgumentList $arguments -ErrorAction Stop | Out-Null
  $desktop = [System.Windows.Automation.AutomationElement]::RootElement
  $window = $null
  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline -and -not $window) {
    $processIds = @((Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id))
    $foregroundHandle = [BetterViewNativeClick]::GetForegroundWindow()
    if ($foregroundHandle -ne [IntPtr]::Zero) {
      try {
        $foregroundWindow = [System.Windows.Automation.AutomationElement]::FromHandle($foregroundHandle)
        if ($foregroundWindow.Current.ClassName -eq 'Chrome_WidgetWin_1' -and $processIds -contains $foregroundWindow.Current.ProcessId) { $window = $foregroundWindow }
      } catch { }
    }
    $topWindows = $desktop.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    if (-not $window) {
      foreach ($candidate in $topWindows) {
        if ($candidate.Current.ClassName -eq 'Chrome_WidgetWin_1' -and $processIds -contains $candidate.Current.ProcessId) {
          $window = $candidate
          break
        }
      }
    }
    if (-not $window) { Start-Sleep -Milliseconds 400 }
  }
  if (-not $window) { throw "Could not find an open $($Browser.Name) window for $($Profile.Label). Make sure the browser is visible." }
  [void][BetterViewNativeClick]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle)

  $loadButton = Find-UiElement -Root $window -Name 'Load unpacked'
  if (-not $loadButton) {
    $address = Find-UiElement -Root $window -Name 'Address and search bar'
    if ($address) {
      try {
        $address.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($Browser.Page)
        $address.SetFocus()
        [Windows.Forms.SendKeys]::SendWait('%{ENTER}')
      } catch {
        throw "Could not open $($Browser.Page) in $($Browser.Name): $($_.Exception.Message)"
      }
    }
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline -and -not $loadButton) {
      Start-Sleep -Milliseconds 400
      $loadButton = Find-UiElement -Root $window -Name 'Load unpacked'
    }
  }

  if ($StatusLabel) { $StatusLabel.Text="Enabling Developer mode in $($Browser.Name)…"; $StatusLabel.FindForm().Refresh(); [Windows.Forms.Application]::DoEvents() }
  if (-not $loadButton) {
    $developer = Find-UiElement -Root $window -Name 'Developer mode'
    if (-not $developer -or $developer.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) {
      throw "Could not locate the Developer mode button in $($Browser.Name). The browser UI may have changed or may be using another language."
    }
    try {
      $developer.SetFocus()
      [Windows.Forms.SendKeys]::SendWait(' ')
      Start-Sleep -Milliseconds 700
      $loadButton = Find-UiElement -Root $window -Name 'Load unpacked'
    } catch {
      throw "Could not enable Developer mode in $($Browser.Name): $($_.Exception.Message)"
    }
  }
  if (-not $loadButton) { throw "Developer mode could not be enabled in $($Browser.Name). Turn it on manually and retry." }

  if ($StatusLabel) { $StatusLabel.Text="Opening the BetterView folder picker in $($Browser.Name)…"; $StatusLabel.FindForm().Refresh(); [Windows.Forms.Application]::DoEvents() }
  $loadButton.SetFocus()
  [Windows.Forms.SendKeys]::SendWait('{ENTER}')
  $folderDialog = $null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and -not $folderDialog) {
    $folderDialog = Find-UiElement -Root $window -Name 'Select the extension directory.'
    if (-not $folderDialog) {
      $all = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      foreach ($candidate in $all) {
        if ($candidate.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window -and $candidate.Current.Name -match 'Select.*(directory|folder)|Choose.*(directory|folder)') { $folderDialog = $candidate; break }
      }
    }
    if (-not $folderDialog) { Start-Sleep -Milliseconds 300 }
  }
  if (-not $folderDialog) { throw "The $($Browser.Name) folder picker did not appear. Select Load unpacked and choose: $ExtensionPath" }
  $dialogHandle = [IntPtr]$folderDialog.Current.NativeWindowHandle
  if ($dialogHandle -eq [IntPtr]::Zero) { throw "The $($Browser.Name) folder picker did not expose a native window handle. Select the folder manually: $ExtensionPath" }
  [void][BetterViewNativeClick]::SetForegroundWindow($dialogHandle)
  $panes = $folderDialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Pane)))
  $folderField = $null
  $folderLabel = Find-UiElement -Root $folderDialog -Name 'Folder:'
  $folderLabelBounds = if ($folderLabel) { $folderLabel.Current.BoundingRectangle } else { $null }
  foreach ($pane in $panes) {
    $bounds = $pane.Current.BoundingRectangle
    if ($pane.Current.Name -match '^[A-Za-z]:') { $folderField = $pane; break }
    if (-not $pane.Current.Name -and $folderLabel -and $bounds.X -ge ($folderLabelBounds.Right - 4) -and $bounds.Y -ge ($folderLabelBounds.Y - 8) -and $bounds.Y -le ($folderLabelBounds.Bottom + 12) -and $bounds.Width -gt 250) { $folderField = $pane; break }
  }
  if (-not $folderField) { throw "The $($Browser.Name) folder picker did not expose its folder field. Select this folder manually: $ExtensionPath" }
  $folderBounds = $folderField.Current.BoundingRectangle
  if ($folderBounds.Width -le 0 -or $folderBounds.Height -le 0) { throw "The $($Browser.Name) folder field is not visible. Select this folder manually: $ExtensionPath" }
  try {
    [Windows.Forms.Clipboard]::SetText($ExtensionPath)
    [BetterViewNativeClick]::Click([int]($folderBounds.X + $folderBounds.Width / 2), [int]($folderBounds.Y + $folderBounds.Height / 2))
    [Windows.Forms.SendKeys]::SendWait('^a')
    [Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 400
  } catch {
    throw "Could not enter the BetterView folder in $($Browser.Name): $($_.Exception.Message)"
  }
  $updatedField = $folderDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $ExtensionPath)))
  if (-not $updatedField) { throw "The folder path was not accepted by $($Browser.Name). Select it manually: $ExtensionPath" }
  $selectButton = Find-UiElement -Root $folderDialog -Name 'Select Folder'
  if (-not $selectButton) { throw "The Select Folder control was not found in $($Browser.Name). Select the folder manually: $ExtensionPath" }
  $selectBounds = $selectButton.Current.BoundingRectangle
  [BetterViewNativeClick]::Click([int]($selectBounds.X + $selectBounds.Width / 2), [int]($selectBounds.Y + $selectBounds.Height / 2))
  Start-Sleep -Seconds 3
  $loaded = Find-UiElement -Root $window -Name 'BetterView AI'
  if (-not $loaded) {
    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline -and -not $loaded) { Start-Sleep -Milliseconds 400; $loaded = Find-UiElement -Root $window -Name 'BetterView AI' }
  }
  if (-not $loaded) { throw "The folder was selected in $($Browser.Name), but BetterView did not appear in the Extensions list. Check the browser's extension error details." }
  if ($StatusLabel) { $StatusLabel.Text="Finished $($Browser.Name) / $($Profile.Label)."; $StatusLabel.FindForm().Refresh(); [Windows.Forms.Application]::DoEvents() }
  return "$($Browser.Name) / $($Profile.Label): BetterView loaded successfully"
}

function Start-Manager {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $form = New-Object System.Windows.Forms.Form
  $form.Text='BetterView Setup'; $form.ClientSize=New-Object Drawing.Size(620,650); $form.StartPosition='CenterScreen'; $form.BackColor=[Drawing.Color]::FromArgb(255,255,255); $form.ForeColor=[Drawing.Color]::FromArgb(18,18,18); $form.Font=New-Object Drawing.Font('Segoe UI',9); $form.FormBorderStyle='None'; $form.MaximizeBox=$false; $form.MinimizeBox=$true; $form.ShowInTaskbar=$true; $form.KeyPreview=$true
  $script:ManagerBusy=$false
  $palette=@{ Background=[Drawing.Color]::White; Header=[Drawing.Color]::White; Card=[Drawing.Color]::White; Input=[Drawing.Color]::FromArgb(248,248,248); Border=[Drawing.Color]::FromArgb(220,220,220); Text=[Drawing.Color]::FromArgb(18,18,18); Muted=[Drawing.Color]::FromArgb(105,105,105); Accent=[Drawing.Color]::FromArgb(18,18,18); AccentText=[Drawing.Color]::White; Danger=[Drawing.Color]::FromArgb(18,18,18) }
  $round={param($control,[int]$radius) if($radius -le 0 -or $control.Width -le 0 -or $control.Height -le 0){$control.Region=$null;return}; $path=New-Object Drawing.Drawing2D.GraphicsPath; $d=[Math]::Min($radius*2,[Math]::Min($control.Width,$control.Height)); $r=New-Object Drawing.Rectangle(0,0,$control.Width,$control.Height); $path.AddArc($r.X,$r.Y,$d,$d,180,90); $path.AddArc($r.Right-$d,$r.Y,$d,$d,270,90); $path.AddArc($r.Right-$d,$r.Bottom-$d,$d,$d,0,90); $path.AddArc($r.X,$r.Bottom-$d,$d,$d,90,90); $path.CloseFigure(); $control.Region=New-Object Drawing.Region($path); $path.Dispose() }
  $makeButton={param([string]$caption,[Drawing.Point]$location,[Drawing.Size]$size,[Drawing.Color]$back,[Drawing.Color]$fore,[int]$radius=8) $b=New-Object Windows.Forms.Button; $b.Text=$caption; $b.Location=$location; $b.Size=$size; $b.FlatStyle='Flat'; $b.FlatAppearance.BorderSize=0; $b.FlatAppearance.MouseOverBackColor=if($fore -eq [Drawing.Color]::White){[Drawing.Color]::FromArgb(42,42,42)}else{[Drawing.Color]::FromArgb(242,242,242)}; $b.FlatAppearance.MouseDownBackColor=if($fore -eq [Drawing.Color]::White){[Drawing.Color]::FromArgb(68,68,68)}else{[Drawing.Color]::FromArgb(226,226,226)}; $b.BackColor=$back; $b.ForeColor=$fore; $b.Font=New-Object Drawing.Font('Segoe UI Semibold',9); $b.Cursor=[Windows.Forms.Cursors]::Hand; $b.UseVisualStyleBackColor=$false; $b.TabStop=$true; & $round $b $radius; return $b }
  $header=New-Object Windows.Forms.Panel; $header.Location=New-Object Drawing.Point(0,0); $header.Size=New-Object Drawing.Size(620,70); $header.BackColor=$palette.Header; [void]$form.Controls.Add($header)
  $logoPath=Join-Path $PSScriptRoot 'BetterView.png'
  $logo=$null
  if (Test-Path -LiteralPath $logoPath) { try { $logo=New-Object Windows.Forms.PictureBox; $logo.Image=[Drawing.Image]::FromFile($logoPath); $logo.SizeMode='Zoom'; $logo.Location=New-Object Drawing.Point(22,13); $logo.Size=New-Object Drawing.Size(44,44); [void]$header.Controls.Add($logo) } catch { $logo=$null } }
  $title=New-Object Windows.Forms.Label; $title.Text='BetterView'; $title.Font=New-Object Drawing.Font('Segoe UI Semibold',16); $title.Location=New-Object Drawing.Point(78,13); $title.Size=New-Object Drawing.Size(250,25); [void]$header.Controls.Add($title)
  $sub=New-Object Windows.Forms.Label; $sub.Text='A clearer way to experience AI'; $sub.ForeColor=$palette.Muted; $sub.Font=New-Object Drawing.Font('Segoe UI',8.5); $sub.Location=New-Object Drawing.Point(80,39); $sub.Size=New-Object Drawing.Size(300,19); [void]$header.Controls.Add($sub)
  $minimizeGlyph=[string][char]0x2014; $minimize=& $makeButton $minimizeGlyph (New-Object Drawing.Point(518,12)) (New-Object Drawing.Size(40,36)) $palette.Header $palette.Muted 8; $minimize.Font=New-Object Drawing.Font('Segoe UI',10); $minimize.AccessibleName='Minimize window'; [void]$header.Controls.Add($minimize); $minimize.Add_Click({$form.WindowState='Minimized'})
  $closeGlyph=[string][char]0x00D7; $close=& $makeButton $closeGlyph (New-Object Drawing.Point(564,12)) (New-Object Drawing.Size(44,36)) $palette.Header $palette.Text 8; $close.Font=New-Object Drawing.Font('Segoe UI',17); $close.AccessibleName='Close BetterView setup'; $close.FlatAppearance.MouseOverBackColor=[Drawing.Color]::FromArgb(18,18,18); $close.FlatAppearance.MouseDownBackColor=[Drawing.Color]::FromArgb(64,64,64); [void]$header.Controls.Add($close); $close.Add_MouseEnter({$this.ForeColor=[Drawing.Color]::White}); $close.Add_MouseLeave({$this.ForeColor=$palette.Text}); $close.Add_Click({$form.Close()})
  $dragState=@{Dragging=$false;Offset=[Drawing.Point]::Empty}; $drag={param($sender,$e) if($e.Button -eq [Windows.Forms.MouseButtons]::Left){$dragState.Dragging=$true;$dragState.Offset=$e.Location;if($sender -ne $header){$dragState.Offset.X+=$sender.Left;$dragState.Offset.Y+=$sender.Top}}}; $move={param($sender,$e) if($dragState.Dragging){$p=[Windows.Forms.Cursor]::Position;$form.Location=New-Object Drawing.Point(($p.X-$dragState.Offset.X),($p.Y-$dragState.Offset.Y))}}; $stopDrag={$dragState.Dragging=$false}; $header.Add_MouseDown($drag); $header.Add_MouseMove($move); $header.Add_MouseUp($stopDrag); $title.Add_MouseDown($drag); $title.Add_MouseMove($move); $title.Add_MouseUp($stopDrag); $sub.Add_MouseDown($drag); $sub.Add_MouseMove($move); $sub.Add_MouseUp($stopDrag)
  $card=New-Object Windows.Forms.Panel; $card.Location=New-Object Drawing.Point(20,82); $card.Size=New-Object Drawing.Size(580,526); $card.BackColor=$palette.Card; $card.BorderStyle='None'; [void]$form.Controls.Add($card); & $round $card 10; $card.Add_Paint({param($sender,$e) $pen=New-Object Drawing.Pen([Drawing.Color]::FromArgb(224,224,224),1); $e.Graphics.DrawRectangle($pen,0,0,$sender.Width-1,$sender.Height-1); $pen.Dispose()})
  $browserLabel=New-Object Windows.Forms.Label; $browserLabel.Text='BROWSER'; $browserLabel.Font=New-Object Drawing.Font('Segoe UI Semibold',8); $browserLabel.ForeColor=$palette.Muted; $browserLabel.Location=New-Object Drawing.Point(24,20); $browserLabel.Size=New-Object Drawing.Size(520,20); [void]$card.Controls.Add($browserLabel)
  $browserList=New-Object Windows.Forms.ComboBox; $browserList.DropDownStyle='DropDownList'; $browserList.DrawMode='OwnerDrawFixed'; $browserList.ItemHeight=29; $browserList.Location=New-Object Drawing.Point(24,45); $browserList.Size=New-Object Drawing.Size(532,36); $browserList.BackColor=$palette.Input; $browserList.ForeColor=$palette.Text; $browserList.FlatStyle='Flat'; $browserList.Font=New-Object Drawing.Font('Segoe UI',9)
  $drawSelector={param($sender,$e) if($e.Index -lt 0){$index=$sender.SelectedIndex;if($index -lt 0){return};$itemText=[string]$sender.Items[$index];$itemBack=$palette.Input;$itemFore=$palette.Text}else{$itemText=[string]$sender.Items[$e.Index];$active=(($e.State -band [Windows.Forms.DrawItemState]::Selected) -ne 0) -and $sender.DroppedDown;$itemBack=if($active){$palette.Text}else{$palette.Input};$itemFore=if($active){[Drawing.Color]::White}else{$palette.Text}}; $backBrush=New-Object Drawing.SolidBrush($itemBack); $foreBrush=New-Object Drawing.SolidBrush($itemFore); $e.Graphics.FillRectangle($backBrush,$e.Bounds); $textBounds=New-Object Drawing.RectangleF(($e.Bounds.X+12),($e.Bounds.Y+5),($e.Bounds.Width-24),($e.Bounds.Height-8)); $font=if($sender.DroppedDown -and $e.Index -ge 0 -and (($e.State -band [Windows.Forms.DrawItemState]::Selected) -ne 0)){New-Object Drawing.Font($sender.Font,[Drawing.FontStyle]::Bold)}else{$sender.Font}; $format=New-Object Drawing.StringFormat; $format.LineAlignment=[Drawing.StringAlignment]::Center; $format.Trimming=[Drawing.StringTrimming]::EllipsisCharacter; $e.Graphics.DrawString($itemText,$font,$foreBrush,$textBounds,$format); if($font -ne $sender.Font){$font.Dispose()}; $format.Dispose(); $backBrush.Dispose(); $foreBrush.Dispose(); if(($e.State -band [Windows.Forms.DrawItemState]::Focus) -ne 0){$e.DrawFocusRectangle()} }
  $browserList.Add_DrawItem($drawSelector)
  $browsers=@(Get-BrowserCandidates); [void]$browserList.Items.Add('All detected browsers')
  foreach($b in $browsers){$label=$b.Name; if(-not $b.Installed){$label+=' (not detected)'}; [void]$browserList.Items.Add($label)}
  $first=@($browsers | Where-Object Installed | Select-Object -First 1)[0]; if($first){$browserList.SelectedIndex=0}else{$browserList.SelectedIndex=1}; [void]$form.Controls.Add($browserList)
  [void]$card.Controls.Add($browserList)
  $browserNote=New-Object Windows.Forms.Label; $browserNote.Text='Chrome, Brave and Edge are supported.'; $browserNote.ForeColor=$palette.Muted; $browserNote.Font=New-Object Drawing.Font('Segoe UI',8); $browserNote.Location=New-Object Drawing.Point(26,85); $browserNote.Size=New-Object Drawing.Size(520,20); [void]$card.Controls.Add($browserNote)
  $profileLabel=New-Object Windows.Forms.Label; $profileLabel.Text='BROWSER PROFILE'; $profileLabel.Font=New-Object Drawing.Font('Segoe UI Semibold',8); $profileLabel.ForeColor=$palette.Muted; $profileLabel.Location=New-Object Drawing.Point(24,126); $profileLabel.Size=New-Object Drawing.Size(520,20); [void]$card.Controls.Add($profileLabel)
  $profileList=New-Object Windows.Forms.ComboBox; $profileList.DropDownStyle='DropDownList'; $profileList.DrawMode='OwnerDrawFixed'; $profileList.ItemHeight=29; $profileList.Location=New-Object Drawing.Point(24,151); $profileList.Size=New-Object Drawing.Size(532,36); $profileList.BackColor=$palette.Input; $profileList.ForeColor=$palette.Text; $profileList.FlatStyle='Flat'; $profileList.Font=New-Object Drawing.Font('Segoe UI',9)
  $profileList.Add_DrawItem($drawSelector); [void]$card.Controls.Add($profileList)
  $profileNote=New-Object Windows.Forms.Label; $profileNote.Text='Choose the browser profiles where BetterView should be enabled.'; $profileNote.ForeColor=$palette.Muted; $profileNote.Font=New-Object Drawing.Font('Segoe UI',8); $profileNote.Location=New-Object Drawing.Point(26,191); $profileNote.Size=New-Object Drawing.Size(520,20); [void]$card.Controls.Add($profileNote)
  $installed=Get-InstalledVersion
  $separator=New-Object Windows.Forms.Panel; $separator.Location=New-Object Drawing.Point(24,229); $separator.Size=New-Object Drawing.Size(532,1); $separator.BackColor=$palette.Border; [void]$card.Controls.Add($separator)
  $section=New-Object Windows.Forms.Label; $section.Text='INSTALLATION'; $section.Font=New-Object Drawing.Font('Segoe UI Semibold',8); $section.ForeColor=$palette.Muted; $section.Location=New-Object Drawing.Point(24,249); $section.Size=New-Object Drawing.Size(520,20); [void]$card.Controls.Add($section)
  $versionLabel=New-Object Windows.Forms.Label; $versionLabel.Text=if($installed){"Installed version: $installed"}else{'Ready to install the latest version.'}; $versionLabel.ForeColor=$palette.Text; $versionLabel.Location=New-Object Drawing.Point(26,276); $versionLabel.Size=New-Object Drawing.Size(520,24); [void]$card.Controls.Add($versionLabel)
  $progressTrack=New-Object Windows.Forms.Panel; $progressTrack.Location=New-Object Drawing.Point(26,313); $progressTrack.Size=New-Object Drawing.Size(528,6); $progressTrack.BackColor=$palette.Border; [void]$card.Controls.Add($progressTrack)
  $progressFill=New-Object Windows.Forms.Panel; $progressFill.Location=New-Object Drawing.Point(0,0); $progressFill.Size=New-Object Drawing.Size(0,6); $progressFill.BackColor=$palette.Accent; [void]$progressTrack.Controls.Add($progressFill)
  $progressFill.Region=$null
  $status=New-Object Windows.Forms.Label; $status.Text='Ready when you are.'; $status.ForeColor=$palette.Muted; $status.Location=New-Object Drawing.Point(26,331); $status.Size=New-Object Drawing.Size(520,25); [void]$card.Controls.Add($status)
  $install=& $makeButton $(if($installed){'Check for updates'}else{'Install BetterView'}) (New-Object Drawing.Point(24,378)) (New-Object Drawing.Size(532,46)) $palette.Accent $palette.AccentText 10; $install.Font=New-Object Drawing.Font('Segoe UI Semibold',10); [void]$card.Controls.Add($install)
   $instructions=New-Object Windows.Forms.Label; $instructions.Text='BetterView opens each selected browser profile and handles Developer mode and Load unpacked automatically.'; $instructions.ForeColor=$palette.Muted; $instructions.Font=New-Object Drawing.Font('Segoe UI',8); $instructions.Location=New-Object Drawing.Point(26,439); $instructions.Size=New-Object Drawing.Size(520,42); [void]$card.Controls.Add($instructions)
  $uninstall=& $makeButton 'Uninstall BetterView' (New-Object Drawing.Point(24,476)) (New-Object Drawing.Size(166,34)) $palette.Card $palette.Text 8; $uninstall.Font=New-Object Drawing.Font('Segoe UI Semibold',8); $uninstall.FlatAppearance.BorderSize=1; $uninstall.FlatAppearance.BorderColor=$palette.Border; $uninstall.FlatAppearance.MouseOverBackColor=[Drawing.Color]::FromArgb(242,242,242); [void]$card.Controls.Add($uninstall)
  $footer=New-Object Windows.Forms.Label; $footer.Text='BETTERVIEW  |  WINDOWS SETUP'; $footer.ForeColor=[Drawing.Color]::FromArgb(91,105,126); $footer.Font=New-Object Drawing.Font('Segoe UI Semibold',7); $footer.TextAlign='MiddleCenter'; $footer.Location=New-Object Drawing.Point(20,617); $footer.Size=New-Object Drawing.Size(580,20); [void]$form.Controls.Add($footer)

  $refreshProfiles = {
    $profileList.Items.Clear()
    [void]$profileList.Items.Add('Default profile')
    [void]$profileList.Items.Add('All profiles')
    $profileOptions=@()
    $profileBrowsers=if($browserList.SelectedIndex -eq 0){@($browsers | Where-Object Installed)}else{@($browsers[$browserList.SelectedIndex - 1])}
    foreach($profileBrowser in $profileBrowsers){$profileOptions+=@(Get-BrowserProfiles $profileBrowser | Where-Object Directory -ne 'Default')}
    foreach($profileName in @($profileOptions | Select-Object -ExpandProperty Label -Unique)){[void]$profileList.Items.Add($profileName)}
    $profileList.SelectedIndex=0
    if ($browserList.SelectedIndex -eq 0) { $profileNote.Text='Choose Default, All profiles, or a matching named profile across the selected browsers.' }
    else { $profileNote.Text='Choose Default, All profiles, or a specific browser profile.' }
  }
  $browserList.Add_SelectedIndexChanged($refreshProfiles)
  & $refreshProfiles
  $form.Add_FormClosing({param($sender,$e) if($script:ManagerBusy){$e.Cancel=$true}})
  $install.Add_Click({
    if($script:ManagerBusy){return}
    $selectedBrowsers=if($browserList.SelectedIndex -eq 0){@($browsers | Where-Object Installed)}else{@($browsers[$browserList.SelectedIndex - 1])}; if(-not $selectedBrowsers){[Windows.Forms.MessageBox]::Show('No supported browser was detected. Choose a browser manually from the list or install Chrome, Brave, or Edge.','No browser detected','OK','Information')|Out-Null; return}; $script:ManagerBusy=$true; $install.Enabled=$false; $browserList.Enabled=$false; $profileList.Enabled=$false; $progressFill.Width=0; $status.Text='Preparing installation…'; $form.Refresh()
    try {
      $status.Text='Connecting securely to GitHub Releases…'; $form.Refresh(); $release=Get-LatestRelease; $current=Get-InstalledVersion
      if($current -and -not (Test-VersionNewer $release.Version $current)) {
        if(($release.Version -replace '^[vV]','') -eq $current){$message='You are already using the latest release (' + $current + ').'}
        else{$message='Installed version ' + $current + ' is newer than the latest published release ' + $release.Version + '. No downgrade was made.'}
        $version=$current; $status.Text='Your BetterView files are up to date.'
      } else {
        $version=Invoke-Install -Release $release -Browsers $selectedBrowsers -Progress {param($n,$message) $progressFill.Width=[Math]::Max(1,[int](528*$n/100)); $status.Text=$message; $form.Refresh()}
        $status.Text='Installation complete.'
      }
      $versionLabel.Text='Installed version: ' + $version; $install.Text='Check for updates'
      $profileChoice=[string]$profileList.SelectedItem
      $targetList=@()
      foreach($browser in $selectedBrowsers){
        $profiles=@(Get-BrowserProfiles $browser)
        if($profileChoice -eq 'All profiles'){$chosenProfiles=$profiles}
        elseif($profileChoice -eq 'Default profile'){$chosenProfiles=@($profiles | Where-Object Directory -eq 'Default' | Select-Object -First 1)}
        else{$chosenProfiles=@($profiles | Where-Object Label -eq $profileChoice)}
        foreach($profile in $chosenProfiles){$targetList+=,[pscustomobject]@{Browser=$browser;Profile=$profile}}
      }
      $clipboardReady=$false; try { [Windows.Forms.Clipboard]::SetText($script:ExtensionRoot); $clipboardReady=$true } catch { }
      $clipboardMessage=if($clipboardReady){'The folder path has been copied to your clipboard.'}else{'Copy this folder path manually:'}
      $finishMessage='BetterView ' + $version + ' is ready.' + [Environment]::NewLine + [Environment]::NewLine + 'BetterView can now open each selected browser profile, enable Developer mode, choose Load unpacked, and select the extension folder.' + [Environment]::NewLine + [Environment]::NewLine + $clipboardMessage + [Environment]::NewLine + $script:ExtensionRoot + [Environment]::NewLine + [Environment]::NewLine + 'Keep the browser windows visible while setup runs. Start automatic browser setup?'
      $answer=[Windows.Forms.MessageBox]::Show($finishMessage,'Finish BetterView setup','YesNo','Information')
      if($answer -eq 'Yes'){
        $launchFailures=@(); $setupResults=@()
        foreach($target in $targetList){
          if($target.Browser.Installed -and $target.Browser.Exe){
             try { $setupResults+=Invoke-BrowserSetup -Browser $target.Browser -Profile $target.Profile -ExtensionPath $script:ExtensionRoot -StatusLabel $status }
            catch { $launchFailures+=('{0} ({1}): {2}' -f $target.Browser.Name,$target.Profile.Label,$_.Exception.Message) }
          }
        }
        if($launchFailures.Count -gt 0){$failureText=$launchFailures -join [Environment]::NewLine; $failureMessage='Automatic setup needs help for these profiles:' + [Environment]::NewLine + [Environment]::NewLine + $failureText + [Environment]::NewLine + [Environment]::NewLine + 'The browser is open. Complete the remaining step manually using Load unpacked and this folder:' + [Environment]::NewLine + $script:ExtensionRoot; [Windows.Forms.MessageBox]::Show($failureMessage,'Browser setup needs attention','OK','Warning')|Out-Null}
        elseif($setupResults.Count -gt 0){[Windows.Forms.MessageBox]::Show(($setupResults -join [Environment]::NewLine),'BetterView browser setup','OK','Information')|Out-Null}
      }
      if (@($selectedBrowsers | Where-Object Installed).Count -eq 0) { $manualMessage='BetterView is installed at:' + [Environment]::NewLine + $script:ExtensionRoot + [Environment]::NewLine + [Environment]::NewLine + 'Install ' + $selectedBrowsers[0].Name + ', then open ' + $selectedBrowsers[0].Page + ', enable Developer mode, and choose Load unpacked.'; [Windows.Forms.MessageBox]::Show($manualMessage,'Browser not detected','OK','Information')|Out-Null }
    } catch { $status.Text='Setup could not finish. Your previous version was kept when possible.'; [Windows.Forms.MessageBox]::Show($_.Exception.Message,'BetterView setup failed','OK','Error')|Out-Null }
    finally {$script:ManagerBusy=$false; $install.Enabled=$true; $browserList.Enabled=$true; $profileList.Enabled=$true}
  })
  $uninstall.Add_Click({
    if($script:ManagerBusy){return}
    $confirm=[Windows.Forms.MessageBox]::Show('Remove BetterView files? The loaded extension must also be removed from your browser.','Uninstall BetterView','YesNo','Warning')
    if($confirm -eq 'Yes'){
      try {
        if(Test-Path -LiteralPath $script:InstallRoot){Remove-Item -LiteralPath $script:InstallRoot -Recurse -Force -ErrorAction Stop}
        [Windows.Forms.MessageBox]::Show('BetterView files have been removed. Remove the loaded extension from the browser Extensions page to finish.','Uninstall complete','OK','Information')|Out-Null
        $form.Close()
      } catch {
        [Windows.Forms.MessageBox]::Show($_.Exception.Message,'Uninstall failed','OK','Error')|Out-Null
      }
    }
  })
  $form.Add_KeyDown({param($sender,$e) if($e.KeyCode -eq [Windows.Forms.Keys]::Escape){$form.Close();$e.Handled=$true}})
  $form.Add_FormClosed({if($logo -and $logo.Image){$logo.Image.Dispose()}})
  [void]$form.ShowDialog()
}

if ($Uninstall) { if (Test-Path -LiteralPath $script:InstallRoot) { Remove-Item -LiteralPath $script:InstallRoot -Recurse -Force }; exit 0 }
Start-Manager
