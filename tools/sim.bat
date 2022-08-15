<<<<<<< Updated upstream
@REM simple script to redirect calls to Node.js
@echo off
setlocal
rem cd /d "%~dp0/sim"
node "%~dp0/sim" %*
=======
@REM simple script to redirect calls to Node.js
@echo off
setlocal
cd /d "%~dp0/asm"
node ./index.js "%1"
>>>>>>> Stashed changes
