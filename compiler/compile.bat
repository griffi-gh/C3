@echo off
setlocal
cd /d "%~dp0"
node ./compile.js "%1"
pause