@ECHO OFF
SET /P steamFolder="Enter your Steam Common Folder path: "
ECHO.

:GAME_LIST
REM Run Node.js script to get game list
FOR /F "tokens=*" %%i IN ('CALL node "data\main.js" get_game_list "%steamFolder%"') DO (
    ECHO %%i
)

:SELECT_GAME
SET /P selectedGame="Enter the number corresponding to the game you want to clean up (or 'exit' to close): "

IF "%selectedGame%"=="exit" (
    ECHO Exiting...
    EXIT /B 0
)

REM Run Node.js script to clean up selected game
CALL node "data\main.js" clean_up_game "%steamFolder%" "%selectedGame%"

SET /P repeat="Do you want to clean up another game? (yes/no): "
IF /I "%repeat%"=="yes" GOTO GAME_LIST
ECHO Exiting...