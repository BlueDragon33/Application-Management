' Explicit operator-invoked cold updater. Never auto-stop Node or D1.
Option Explicit
Dim sh, fs, root, result
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
root=fs.GetParentFolderName(WScript.ScriptFullName)
If LCase(fs.GetFileName(fs.GetParentFolderName(root))) <> "baumanweb" Then
  MsgBox "Chi su dung tai BaumanWeb\Application-Management.", vbExclamation, "Cold Pull"
  WScript.Quit 2
End If
result=MsgBox("Chi Pull khi da dong tat ca App Manager va app con (cong 3000-3011). Se khong tu tat/ep tat bat ky tien trinh hoac D1 nao. Tiep tuc?", vbYesNo+vbQuestion, "Pull origin/main")
If result <> vbYes Then WScript.Quit 1
sh.CurrentDirectory=root
result=sh.Run("cmd.exe /d /c node scripts\local-ops-cold-pull.mjs > .local-ops-cold-pull.log 2>&1",0,True)
If result=0 Then
  MsgBox "Pull da ket thuc. Xem .local-ops-cold-pull.log de kiem tra ket qua tung repo va SHA. Sau do chay START_BAUMANWEB.vbs.", vbInformation, "Cold Pull"
Else
  MsgBox "Pull bi chan hoac co repo bi bo qua. Khong ghi de cuong buc. Xem .local-ops-cold-pull.log.", vbExclamation, "Cold Pull"
End If
