' Blueprint OS candidate Windows QA. No PowerShell, no app/data changes.
Option Explicit
Dim sh,fs,base,script,code,report
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
base=fs.GetParentFolderName(WScript.ScriptFullName)
script=fs.BuildPath(base,"candidate-pr360-isolated-qa.mjs")
If Not fs.FileExists(script) Then script=fs.BuildPath(base,"scripts\candidate-pr360-isolated-qa.mjs")
If Not fs.FileExists(script) Then
  MsgBox "Dat file QA_PR360_CANDIDATE.vbs va candidate-pr360-isolated-qa.mjs cung thu muc.",vbExclamation,"Blueprint QA"
  WScript.Quit 2
End If
On Error Resume Next
code=sh.Run("node.exe """ & script & """",0,True)
If Err.Number<>0 Then
  MsgBox "Node.js khong hoat dong trong PATH. Khong can Admin/PowerShell.",vbExclamation,"Blueprint QA"
  WScript.Quit 3
End If
On Error GoTo 0
report=sh.ExpandEnvironmentStrings("%TEMP%") & "\BaumanWeb-PR360-Candidate-QA\latest.json"
If fs.FileExists(report) Then
  MsgBox "Da thu thap source QA. Chua chay app hay D1. Exit code: " & CStr(code) & vbCrLf & _
    "Bao cao: " & report,vbInformation,"Blueprint QA"
Else
  MsgBox "QA khong hoan thanh. Kiem tra Node va Git; khong tat bao ve Windows.",vbExclamation,"Blueprint QA"
End If
