@echo off
cd /d "%~dp0\.."
py tools\import_qwen_quiz.py
if errorlevel 1 python tools\import_qwen_quiz.py
echo.
pause
