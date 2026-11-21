#define AppName "BetterView AI"
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#define AppPublisher "Hardik Gupta"
#define AppURL "https://github.com/hardikguptaofficialgit/betterview"
#define ManagerScript "BetterViewManager.ps1"

[Setup]
AppId={{9B3C14A4-2C82-4C9D-AB6C-4B7F5E0A21D9}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
DefaultDirName={localappdata}\Programs\BetterView
DefaultGroupName=BetterView AI
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\release
OutputBaseFilename=BetterView-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
CloseApplications=no
RestartApplications=no
Uninstallable=yes
UsePreviousAppDir=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "{#ManagerScript}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\landing-page\assets\icon-dark-128.png"; DestDir: "{app}"; DestName: "BetterView.png"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\BetterView AI\BetterView Setup"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\BetterViewManager.ps1"""; WorkingDir: "{app}"
Name: "{autodesktop}\BetterView Setup"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\BetterViewManager.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\BetterViewManager.ps1"""; Description: "Launch BetterView setup"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\extension"
Type: filesandordirs; Name: "{app}\staging-*"
Type: filesandordirs; Name: "{app}\previous-extension"
Type: files; Name: "{app}\install.json"

