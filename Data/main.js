const fs = require('fs');
const path = require('path');

const csvFilePath = 'data/games_data.csv';

function findSteamGameFolder(selectedGameIndex, gameFolderPath) {
    const gameData = readCsvFile(csvFilePath);

    if (!isValidGameIndex(selectedGameIndex, gameData)) {
        return 'Invalid game index';
    }

    const { folderName, filesToRemove, removeAllThatStartsWith } = gameData[selectedGameIndex];
    const fullGameFolderPath = path.join(gameFolderPath, folderName);

    try {
        if (fs.existsSync(fullGameFolderPath)) {
            console.log('Game Folder Path:', fullGameFolderPath);
            removeItemsAndDisplaySummary(fullGameFolderPath, filesToRemove);
            removeAllFilesWithPrefix(fullGameFolderPath, removeAllThatStartsWith);
        } else {
            console.log('Game folder not found');
        }
    } catch (error) {
        console.error(`Error reading ${fullGameFolderPath}:`, error.message);
        console.log('Error finding game folder');
    }
}

function removeItemsAndDisplaySummary(basePath, itemsToRemove) {
    const removedItems = removeItems(basePath, itemsToRemove);
    displayRemovedItemsSummary(removedItems);
}

function isValidGameIndex(selectedGameIndex, gameData) {
    return selectedGameIndex >= 0 && selectedGameIndex < gameData.length;
}

function removeItems(basePath, itemsToRemove) {
    const removedItems = [];
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
    } catch (error) {
        console.error('Error removing files/folders:', error.message);
    }
    return removedItems;
}

function displayRemovedItemsSummary(removedItems) {
    console.log('Attempting to remove the following files/folders:');

    if (removedItems.length > 0) {
        removedItems.forEach(item => console.log(item));
    } else {
        console.log('No files/folders removed');
    }
}

function removeAllFilesWithPrefix(basePath, removeAllThatStartsWith) {
    const removedItems = [];
    let itemsRemoved = false;

    for (const folderAndPrefix of removeAllThatStartsWith) {
        const [folder, prefix] = folderAndPrefix.split('-');
        const fullFolderPath = path.join(basePath, folder);
        const files = fs.existsSync(fullFolderPath) && fs.statSync(fullFolderPath).isDirectory() ? fs.readdirSync(fullFolderPath) : [];

        const removedItemsInFolder = removeItems(fullFolderPath, files.filter(file => file.toLowerCase().startsWith(prefix.toLowerCase())));

        if (removedItemsInFolder.length > 0) {
            itemsRemoved = true;
            removedItems.push(...removedItemsInFolder);
        }
    }

    if (itemsRemoved) {
        displayRemovedItemsSummary(removedItems);
    } else {
        console.log('Files not found. No files/folders removed');
    }
}

function readCsvFile(csvFilePath) {
    const gameData = [];

    try {
        const fileContents = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = fileContents.trim().split('\n').slice(1);

        for (const row of rows) {
            const [_, folderName, filesToRemove, removeAllThatStartsWith] = row.split(',');
            const fullPathsToRemove = filesToRemove.toLowerCase() === 'none' ? [] : filesToRemove.split(';').map(file => file.trim());
            const fullPathsToRemoveStartsWith = removeAllThatStartsWith.toLowerCase() === 'none' ? [] : removeAllThatStartsWith.split(';').map(file => file.trim());
            gameData.push({ folderName, filesToRemove: fullPathsToRemove, removeAllThatStartsWith: fullPathsToRemoveStartsWith });
        }
    } catch (error) {
        console.error('Error reading CSV file:', error.message);
    }

    return gameData;
}

function readGameData(csvFilePath) {
    try {
        const fileContents = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = fileContents.trim().split('\n').slice(1);

        const gameData = [];

        for (let index = 0; index < rows.length; index++) {
            const [_, folderName, filesToRemove, removeAllThatStartsWith] = rows[index].split(',');
            const fullPathsToRemove = filesToRemove.toLowerCase() === 'none' ? [] : filesToRemove.split(';').map(file => file.trim());
            const fullPathsToRemoveStartsWith = removeAllThatStartsWith.toLowerCase() === 'none' ? [] : removeAllThatStartsWith.split(';').map(file => file.trim());
            gameData.push({ index, gameName: folderName, filesToRemove: fullPathsToRemove, removeAllThatStartsWith: fullPathsToRemoveStartsWith });
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

const gameData = readGameData(csvFilePath, action);

if (action === 'get_game_list') {
    console.log('List of Games:');
    gameData.forEach((game, index) => console.log(`${index} - ${game.gameName}`));
}
else if (action === 'clean_up_game') {
    if (isNaN(selectedGameIndex) || selectedGameIndex < 0 || selectedGameIndex >= gameData.length) {
        console.error('Invalid selectedGameIndex. Please provide a valid index.');
    } else {
        findSteamGameFolder(selectedGameIndex, steamFolderPath, gameData);
    }
} else {
    console.error('Invalid action. Usage: node your_script_name.js get_game_list <steamFolderPath>');
}
