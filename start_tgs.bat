@echo off
TITLE TGS COMPLETE ONE-CLICK LAUNCHER
SETLOCAL EnableDelayedExpansion

:: ============================================================================
::   CONFIGURATION: Define your Apps and scaling
:: ============================================================================

:: --- NGINX CONFIG ---
SET "NGINX_ROOT=%~dp0tools\nginx"
SET "NGINX_URL=http://nginx.org/download/nginx-1.24.0.zip"

:: --- APP 1: TGS (at %~dp0) ---
SET APP1_NAME=TGS_Core
SET APP1_PATH=%~dp0
SET APP1_FRONTEND=TGS FRONTEND
SET APP1_HIGH_LOAD=false
SET APP1_PORTS=4567 4568

:: --- APP 2: Finance ---
SET APP2_NAME=Finance_App
SET APP2_PATH=C:\Apps\Finance
SET APP2_FRONTEND=frontend
SET APP2_PORTS=4570

:: --- APP 3: HR ---
SET APP3_NAME=HR_App
SET APP3_PATH=C:\Apps\HR
SET APP3_FRONTEND=frontend
SET APP3_PORTS=4573

echo ============================================================================
echo   TGS ZERO-INSTALL AUTOMATED LAUNCHER
echo   Handling Nginx setup, Frontend builds, and Backend workers...
echo ============================================================================

:: 1. SEARCH/DOWNLOAD NGINX
if not exist "%NGINX_ROOT%\nginx.exe" (
    echo [INFO] Nginx not found. Downloading portable version...
    if not exist "%~dp0tools" mkdir "%~dp0tools"
    
    powershell -Command "Invoke-WebRequest -Uri '%NGINX_URL%' -OutFile '%~dp0tools\nginx.zip'"
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to download Nginx. Please check internet connection.
        pause & exit /b
    )
    
    echo [INFO] Extracting Nginx...
    powershell -Command "Expand-Archive -Path '%~dp0tools\nginx.zip' -DestinationPath '%~dp0tools\temp_nginx' -Force"
    
    :: Move content from extracted folder to tools\nginx
    for /f "delims=" %%D in ('dir /b /ad "%~dp0tools\temp_nginx\nginx-*"') do (
        xcopy /E /I /Y "%~dp0tools\temp_nginx\%%D" "%NGINX_ROOT%" >nul
    )
    
    rd /s /q "%~dp0tools\temp_nginx" >nul 2>&1
    del /f /q "%~dp0tools\nginx.zip" >nul 2>&1
    echo [SUCCESS] Nginx setup complete.
)

:: 2. PROCESS APPLICATIONS
call :ProcessApp "%APP1_PATH%" "%APP1_NAME%" "%APP1_FRONTEND%" "%APP1_PORTS%" "%APP1_HIGH_LOAD%"
call :ProcessApp "%APP2_PATH%" "%APP2_NAME%" "%APP2_FRONTEND%" "%APP2_PORTS%" "%APP2_HIGH_LOAD%"
call :ProcessApp "%APP3_PATH%" "%APP3_NAME%" "%APP3_FRONTEND%" "%APP3_PORTS%" "%APP3_HIGH_LOAD%"

:: 3. START/RELOAD NGINX
echo [FINAL] Updating Nginx configuration paths...
set "APP_ROOT_FWD=%~dp0"
set "APP_ROOT_FWD=%APP_ROOT_FWD:\=/%"
if "%APP_ROOT_FWD:~-1%"=="/" set "APP_ROOT_FWD=%APP_ROOT_FWD:~0,-1%"

powershell -Command "(Get-Content '%~dp0nginx.conf') -replace 'include\s+\"[^\"]*?/?tools/nginx/conf/mime\.types\";', 'include       \"%APP_ROOT_FWD%/tools/nginx/conf/mime.types\";' -replace 'root\s+\"[^\"]*?/?TGS[ _]FRONTEND/dist\";', 'root \"%APP_ROOT_FWD%/TGS FRONTEND/dist\";' | Set-Content '%~dp0nginx.conf'"

echo [FINAL] Starting Nginx...
if exist "%NGINX_ROOT%\nginx.exe" (
    cd /d "%NGINX_ROOT%"
    start "" nginx.exe -c "%~dp0nginx.conf"
) else (
    echo [ERROR] Nginx binary not found at %NGINX_ROOT%.
    pause & exit /b
)

echo.
echo ============================================================================
echo   DEPLOYMENT COMPLETE
echo   TGS Apps are live at:
echo   - App 1 (TGS): http://localhost:6785
echo   - App 2 (Finance): http://localhost:6786
echo   - App 3 (HR): http://localhost:6787
echo ============================================================================
:: pause
exit /b

:: --- FUNCTION: ProcessApp ---
:ProcessApp
SET "B_PATH=%~1"
SET "NAME=%~2"
SET "FE_DIR=%~3"
SET "PORTS=%~4"
SET "HIGH_LOAD=%~5"
SET "VENV=%B_PATH%\backend\venv"

if not exist "%B_PATH%\backend\manage.py" (
    echo [SKIP] %NAME% not found.
    goto :eof
)

echo [INIT] Setting up %NAME%...

:: Build Frontend
if exist "%B_PATH%\%FE_DIR%" (
    echo      -- Building Frontend...
    cd /d "%B_PATH%\%FE_DIR%"
    if not exist "node_modules" call npm install --quiet
    call npm run build
)

:: Setup Backend
if not exist "%VENV%" python -m venv "%VENV%"
call "%VENV%\Scripts\activate"
pip install -r "%B_PATH%\backend\requirements.txt" --quiet


:: Start Workers
if "%HIGH_LOAD%"=="true" (
    for %%P in (%PORTS%) do start "TGS-%NAME%-Port-%%P" cmd /c "call "%VENV%\Scripts\activate" && cd /d "%B_PATH%\backend" && waitress-serve --port=%%P --threads=12 tgs_backend.wsgi:application"
) else (
    for /f "tokens=1" %%P in ("%PORTS%") do start "TGS-%NAME%-Port-%%P" cmd /c "call "%VENV%\Scripts\activate" && cd /d "%B_PATH%\backend" && waitress-serve --port=%%P --threads=12 tgs_backend.wsgi:application"
    
    :: Start Notification Scheduler for TGS_Core
    if "%NAME%"=="TGS_Core" (
        echo      -- Starting Notification Scheduler...
        start "TGS-Notification-Scheduler" cmd /c "call "%VENV%\Scripts\activate" && cd /d "%B_PATH%\backend" && python manage.py run_scheduler"
    )
)
goto :eof
