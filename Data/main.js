const fs = require('fs');
const path = require('path');

const csvFilePath = 'data/games_data.csv';

function findSteamGameFolder(selectedGameIndex, gameFolderPath, gameData) {
    if (!isValidGameIndex(selectedGameIndex, gameData)) {
        return 'Invalid game index';
    }

    const { gameName, filesToRemove, removeAllThatStartsWith } = gameData[selectedGameIndex];
    const fullGameFolderPath = path.join(gameFolderPath, gameName);

    try {
        if (fs.existsSync(fullGameFolderPath)) {
            console.log('Game Folder Path:', fullGameFolderPath);
            processGameCleanup(fullGameFolderPath, filesToRemove, removeAllThatStartsWith);
        } else {
            console.log('Game folder not found');
        }
    } catch (error) {
        console.error(`Error reading ${fullGameFolderPath}:`, error.message);
        console.log('Error finding game folder');
    }
}

function processGameCleanup(basePath, itemsToRemove, removeAllThatStartsWith) {
    const removedItems = [];
    let itemsRemoved = false;

    try {
        for (const item of itemsToRemove) {
            const fullPath = path.join(basePath, item);
            if (fs.existsSync(fullPath)) {
                if (fs.statSync(fullPath).isDirectory()) {
                    fs.rmdirSync(fullPath, { recursive: true });
                    removedItems.push(`Removed folder: ${fullPath}`);
                } else {
                    fs.unlinkSync(fullPath);
                    removedItems.push(`Removed file: ${fullPath}`);
                }
            } else {
                removedItems.push(`File or folder not found: ${fullPath}`);
            }
        }

        for (const folderAndPrefix of removeAllThatStartsWith) {
            const [folder, prefix] = folderAndPrefix.split(' ');
            const fullFolderPath = path.join(basePath, folder);
            const files = fs.existsSync(fullFolderPath) && fs.statSync(fullFolderPath).isDirectory() ? fs.readdirSync(fullFolderPath) : [];

            const removedItemsInFolder = removedItems.concat(
                files
                    .filter(file => file.toLowerCase().startsWith(prefix.toLowerCase()))
                    .map(file => `Removed file: ${path.join(fullFolderPath, file)}`)
            );

            if (removedItemsInFolder.length > 0) {
                itemsRemoved = true;
                removedItems.push(...removedItemsInFolder);
            }
        }

        console.log('Attempting to remove the following files/folders:');

        if (removedItems.length > 0) {
            removedItems.forEach(item => console.log(item));
        } else {
            console.log('No files/folders removed');
        }

    } catch (error) {
        console.error('Error removing files/folders:', error.message);
    }
}

function isValidGameIndex(selectedGameIndex, gameData) {
    return selectedGameIndex >= 0 && selectedGameIndex < gameData.length;
}

function readGameData(csvFilePath) {
    try {
        const fileContents = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = fileContents.trim().split('\n').slice(1);

        const gameData = [];

        for (const row of rows) {
            const [_, gameName, filesToRemove, removeAllThatStartsWith] = row.split(',');
            const fullPathsToRemove = filesToRemove.toLowerCase() === 'none' ? [] : filesToRemove.split(';').map(file => file.trim());
            const fullPathsToRemoveStartsWith = removeAllThatStartsWith.toLowerCase() === 'none' ? [] : removeAllThatStartsWith.split(';').map(file => file.trim());
            gameData.push({ gameName, filesToRemove: fullPathsToRemove, removeAllThatStartsWith: fullPathsToRemoveStartsWith });
        }

        return gameData;
    } catch (error) {
        console.error('Error reading CSV file:', error.message);
        return [];
    }
}

// Process command line arguments
const action = process.argv[2];
const steamFolderPath = process.argv[3];
const selectedGameIndex = parseInt(process.argv[4]);

const gameData = readGameData(csvFilePath);

if (action === 'get_game_list') {
    console.log('List of Games:');
    gameData.forEach((game, index) => console.log(`${index} - ${game.gameName}`));
} else if (action === 'clean_up_game') {
    if (isNaN(selectedGameIndex) || selectedGameIndex < 0 || selectedGameIndex >= gameData.length) {
        console.error('Invalid selectedGameIndex. Please provide a valid index.');
    } else {
        findSteamGameFolder(selectedGameIndex, steamFolderPath, gameData);
    }
} else {
    console.error('Invalid action. Usage: node your_script_name.js get_game_list <steamFolderPath>');
}
