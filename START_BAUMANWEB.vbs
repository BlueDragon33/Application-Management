' One-time Windows local launcher. Hidden CMD bootstrap only; no shell exposed over HTTP.
Option Explicit
Dim shell, fso, root
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
If LCase(fso.GetFileName(fso.GetParentFolderName(root))) <> "baumanweb" Then
  MsgBox "Vui long chay tu thu muc BaumanWeb\Application-Management. Khong su dung ban sao legacy.", vbExclamation, "Application Management"
  WScript.Quit 2
End If
shell.CurrentDirectory = root
shell.Run "cmd.exe /d /c node scripts\local-ops-daemon.mjs --start >> .local-ops-bootstrap.log 2>&1", 0, False
