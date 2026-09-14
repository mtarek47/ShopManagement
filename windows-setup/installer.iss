; =====================================================================
;   Smart Buy POS System - All-in-One Windows Installer Script (Inno Setup 6)
;   Embeds: Electron Frontend + Node.js Backend + Portable PostgreSQL
;   Features: Auto-start on Laptop Boot, Auto-Database Setup, Desktop Icon
; =====================================================================

#define MyAppName "Smart Buy POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Smart Buy Retail Systems"
#define MyAppURL "http://localhost:5000"
#define MyAppExeName "Demo Shop POS.exe"

[Setup]
AppId={{D3F12456-91A2-4B6C-81E4-90BC1A612345}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist-installer
OutputBaseFilename=SmartBuy-POS-Setup-v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Automatically launch POS when laptop/Windows starts up (স্বয়ংক্রিয়ভাবে চালু হওয়া)"; GroupDescription: "Startup Options:"

[Files]
; 1. Packaged Electron Application & Resources
Source: "..\frontend\dist-electron\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; 2. Database Auto-Setup Script
Source: "setup-database.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Auto-start POS system on Windows boot / laptop startup
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SmartBuyPOS"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Run database setup silently on installation finish
Filename: "{app}\setup-database.bat"; Description: "Configuring PostgreSQL database..."; Flags: runhidden waituntilterminated
; Launch the POS application
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Gracefully stop background PostgreSQL if running
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "-D ""{userappdata}\ShopManagement\postgres_data"" stop -m fast"; Flags: runhidden; RunOnceId: "StopPostgres"
