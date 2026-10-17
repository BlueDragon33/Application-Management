' Windows read-only acceptance collector. No elevated rights, no unsafe shutdown.
Option Explicit
Dim sh, fs, base, command, code
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
base=fs.GetParentFolderName(WScript.ScriptFullName)
If fs.FileExists(fs.BuildPath(base,"scripts\windows-readonly-acceptance.ps1")) Then
  command=fs.BuildPath(base,"scripts\windows-readonly-acceptance.ps1")
ElseIf fs.FileExists(fs.BuildPath(base,"windows-readonly-acceptance.ps1")) Then
  command=fs.BuildPath(base,"windows-readonly-acceptance.ps1")
Else
  MsgBox "Khong tim thay cong cu QA PowerShell.",vbExclamation,"Blueprint QA"
  WScript.Quit 2
End If
code=sh.Run("powershell.exe -NoProfile -NonInteractive -File """ & command & """",0,True)
If code=0 Then
  MsgBox "Da thu thap bang chung chi doc. KHONG phai nghiem thu hay phe duyet." & vbCrLf & _
    "Bao cao: %TEMP%\BaumanWeb-ReadOnly-QA\latest.txt" & vbCrLf & _
    "Khong gui file co secrets; cong cu chi ghi PID/port/SHA va trang thai.",vbInformation,"Blueprint OS QA"
Else
  MsgBox "QA bi chan, PowerShell policy hoac dieu kien Windows khong hop le. Khong thay doi he thong." & vbCrLf & _
    "Khong tat Windows security. Can kiem tra trong PowerShell tai may.",vbExclamation,"Blueprint OS QA"
End If
