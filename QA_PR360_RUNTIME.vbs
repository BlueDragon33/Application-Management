' Blueprint OS 1.3.0: Run temporary QA only in Docker --network none.
Option Explicit
Dim sh,fs,base,script,code,report
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
base=fs.GetParentFolderName(WScript.ScriptFullName)
script=fs.BuildPath(base,"pr360-disposable-runtime-qa.mjs")
If Not fs.FileExists(script) Then script=fs.BuildPath(base,"scripts\pr360-disposable-runtime-qa.mjs")
If Not fs.FileExists(script) Then
  MsgBox "Dat QA_PR360_RUNTIME.vbs va pr360-disposable-runtime-qa.mjs cung thu muc.",vbExclamation,"Blueprint QA"
  WScript.Quit 2
End If
code=2
On Error Resume Next
code=sh.Run("node.exe """ & script & """",0,True)
If Err.Number<>0 Then
  MsgBox "Node hoac Git khong san sang. Khong doi quyen/Windows Security.",vbExclamation,"Blueprint QA"
  WScript.Quit 3
End If
On Error GoTo 0
report=sh.ExpandEnvironmentStrings("%TEMP%") & "\BaumanWeb-PR360-Runtime-QA\latest.json"
If fs.FileExists(report) Then
  MsgBox "Isolated QA da ghi ket qua; KHONG phai nghiem thu D1 thuc te." & vbCrLf & _
    "Exit code: " & CStr(code) & vbCrLf & report,vbInformation,"Blueprint QA"
Else
  MsgBox "QA bi chan truoc khi ghi bao cao. Bao ve Windows giu nguyen.",vbExclamation,"Blueprint QA"
End If
