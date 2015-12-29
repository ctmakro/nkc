:loop
taskkill /f /im node.exe
node.exe -i server.js
goto :loop