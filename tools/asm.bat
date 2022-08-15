@REM simple script to redirect calls to Node.js
@echo off
setlocal
cd /d "%~dp0/asm"
node ./asm.js "%1"