; NSIS installer script for Mesh Community Planner
; Bundles PyInstaller output into a Windows installer with:
; - Start Menu and Desktop shortcuts
; - Browser launch on start
; - Uninstall with data preservation choice
; - Windows Add/Remove Programs registry entry

!include "MUI2.nsh"

; --- Application metadata ---
!define APP_NAME "Mesh Community Planner"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "Mesh Community Planner Project"
!define APP_URL "https://github.com/mesh-community-planner"
!define APP_EXE "MeshCommunityPlanner.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

Name "${APP_NAME}"
OutFile "MeshCommunityPlanner-${APP_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES\${APP_NAME}"
InstallDirRegKey HKLM "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel admin

; --- Modern UI configuration ---
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will install ${APP_NAME} ${APP_VERSION} on your computer.$\r$\n$\r$\nA desktop web application for planning LoRa mesh network deployments.$\r$\n$\r$\nClick Next to continue."

; --- Installer pages ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${NSISDIR}\Docs\Modern UI\License.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; --- Uninstaller pages ---
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --- Language ---
!insertmacro MUI_LANGUAGE "English"

; ===================================================================
; INSTALLER SECTION
; ===================================================================
Section "Install"
    SetOutPath "$INSTDIR"

    ; Copy all PyInstaller output files
    File /r "..\dist\MeshCommunityPlanner\*.*"

    ; Create Start Menu shortcuts
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0

    ; Create Desktop shortcut
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Write Windows registry entries for Add/Remove Programs
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "URLInfoAbout" "${APP_URL}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1

    ; Estimate installed size (in KB)
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize" "$0"
SectionEnd

; ===================================================================
; UNINSTALLER SECTION
; ===================================================================
Section "Uninstall"
    ; Ask user about preserving application data
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Do you want to preserve your application data (plans, settings, cached terrain)?$\r$\n$\r$\nClick Yes to keep data, No to delete everything." \
        IDYES SkipDataRemoval

    ; User chose to remove data too
    RMDir /r "$LOCALAPPDATA\MeshCommunityPlanner"

SkipDataRemoval:
    ; Remove application files
    RMDir /r "$INSTDIR"

    ; Remove Start Menu shortcuts
    RMDir /r "$SMPROGRAMS\${APP_NAME}"

    ; Remove Desktop shortcut
    Delete "$DESKTOP\${APP_NAME}.lnk"

    ; Remove registry keys
    DeleteRegKey HKLM "${UNINSTALL_KEY}"
SectionEnd
