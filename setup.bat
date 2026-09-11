@echo off
echo ========================================================================
echo INSTALLING DEPENDENCIES FOR CIVIL POLICE AIRSPACE C2 WORKSTATION
echo ========================================================================

echo 1. Installing Python Backend Dependencies...
pip install -r backend\requirements.txt

echo 2. Installing Frontend Node.js Dependencies...
cd frontend
call npm install
cd ..

echo ========================================================================
echo STARTING C2 WORKSTATION CONSOLE
echo ========================================================================
python run_console.py
