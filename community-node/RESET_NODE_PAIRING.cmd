@echo off
chcp 65001 >nul
title SpaceNovaX Node Pairing Reset
cd /d "%~dp0"
if exist node-config.json del /q node-config.json
echo 저장된 노드 페어링 정보가 삭제되었습니다.
echo 다음 실행 시 앱에서 새 페어링 코드를 발급받아 입력하세요.
pause
