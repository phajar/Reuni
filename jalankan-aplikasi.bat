@echo off
title Server Lokal Alumni PP Al-Fatah
color 0b
cls
echo =========================================================
echo       SERVER LOKAL PORTAL ALUMNI PP AL-FATAH (WEB)
echo =========================================================
echo.
echo Sedang mendeteksi lingkungan sistem Anda...
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python terdeteksi.
    echo Memulai server statis via Python di http://localhost:3000...
    start http://localhost:3000/login.html
    python -m http.server 3000
    goto end
)

:: Check Node.js / npx
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js terdeteksi.
    echo Memulai server statis via npx http-server di http://localhost:3000...
    start http://localhost:3000/login.html
    npx -y http-server -p 3000 -c-1
    goto end
)

:: Check PHP
where php >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PHP terdeteksi.
    echo Memulai server statis via PHP di http://localhost:3000...
    start http://localhost:3000/login.html
    php -S localhost:3000
    goto end
)

:: Fallback if nothing is found
echo [PERINGATAN] Tidak menemukan Python, Node.js, atau PHP di sistem Anda.
echo.
echo Google Sign-In membutuhkan server lokal agar dapat berjalan secara lokal.
echo Anda dapat memasang Node.js atau Python di PC Anda,
echo atau langsung deploy aplikasi ke GitHub Pages secara online.
echo.
echo Membuka berkas login secara langsung via browser...
echo (Catatan: Google Sign-in tidak akan berfungsi di mode lokal file://)
echo.
start login.html
pause

:end
