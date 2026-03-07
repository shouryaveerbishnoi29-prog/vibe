@echo off
start cmd.exe /k "cd server && node index.js"
start cmd.exe /k "cd client && npm run dev"
echo Both Frontend and Backend servers have been started!
