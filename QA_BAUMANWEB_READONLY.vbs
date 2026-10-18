' Blueprint OS 1.3.0 - Node-only passive read QA (no PowerShell policy changes).
Option Explicit
Dim sh, fs, base, script, cmd, code, report, diagnostic, info
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
base=fs.GetParentFolderName(WScript.ScriptFullName)
script=fs.BuildPath(base,"scripts\windows-readonly-acceptance.mjs")
If Not fs.FileExists(script) Then script=fs.BuildPath(base,"windows-readonly-acceptance.mjs")
If Not fs.FileExists(script) Then
  MsgBox "Khong tim thay windows-readonly-acceptance.mjs. Dat file .vbs va .mjs trong cung thu muc (hoac thu muc scripts).",vbExclamation,"Blueprint OS QA"
  WScript.Quit 2
End If
cmd="node.exe """ & script & """"
On Error Resume Next
code=sh.Run(cmd,0,True)
If Err.Number<>0 Then
  info="Khong the chay Node.js. Kiem tra Node.js da cai va co trong PATH." & vbCrLf & "WSH: " & Hex(Err.Number)
  Err.Clear
  MsgBox info,vbExclamation,"Blueprint OS QA"
  WScript.Quit 3
End If
On Error GoTo 0
report=sh.ExpandEnvironmentStrings("%TEMP%") & "\BaumanWeb-ReadOnly-QA\latest.json"
diagnostic=sh.ExpandEnvironmentStrings("%TEMP%") & "\BaumanWeb-ReadOnly-QA\diagnostic.txt"
If code=0 And fs.FileExists(report) Then
  MsgBox "Da thu thap QA chi doc (khong can PowerShell)." & vbCrLf & _
    "Chua nghiem thu / D1 van BLOCKED." & vbCrLf & _
    "Bao cao: " & report,vbInformation,"Blueprint OS QA"
Else
  info="QA khong hoan thanh. Exit code: " & CStr(code)
  If fs.FileExists(diagnostic) Then
    info=info & vbCrLf & "Ma loi: " & fs.OpenTextFile(diagnostic,1).ReadAll
  End If
  MsgBox info & vbCrLf & "Khong can doi Windows Security / Execution Policy.",vbExclamation,"Blueprint OS QA"
End If
