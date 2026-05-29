; 灵犀市场洞察 安装脚本增强
; 自定义安装界面和选项

!macro customHeader
  !system "echo '灵犀市场洞察安装程序'"
!macroend

; 自定义安装页面
!macro customInstall
  ; 安装完成后自动运行应用
  ExecWait '"$INSTDIR\灵犀市场洞察.exe"'
!macroend

; 自定义卸载页面
!macro customUnInstall
  ; 提示用户是否删除数据
  MessageBox MB_YESNO "是否删除应用数据？$\n$\n选择「是」将删除所有配置和缓存数据。$\n选择「否」将保留数据以便下次安装使用。" IDYES deleteData IDNO keepData

  deleteData:
    RMDir /r "$APPDATA\lingxi-market"
    RMDir /r "$LOCALAPPDATA\lingxi-market"
  keepData:
!macroend

; 安装完成页面
!macro customInstallSuccess
  MessageBox MB_OK "灵犀市场洞察 安装完成！$\n$\n感谢您选择灵犀市场洞察。$\n$\n安装完成后，您可以在桌面或开始菜单找到应用图标。"
!macroend
