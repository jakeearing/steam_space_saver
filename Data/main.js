const fs = require('fs');
const path = require('path');
const csvFilePath = 'data/games_data.csv';
const readlineSync = require('readline-sync');

function findSteamGameFolder(selectedGameIndex, gameFolderPath, gameData) {
    if (!(selectedGameIndex >= 0 && selectedGameIndex < gameData.length)) {
        console.error('Invalid number entered. Please provide a valid number.');
        return;
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

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(10 * (bytes / Math.pow(1024, i))) / 10 + ' ' + sizes[i];
}

function calculateTotalSize(items) {
    return items.reduce((total, item) => total + (item.isDirectory ? (item.children ? calculateTotalSize(item.children) : 0) : item.size), 0);
}

function getFolderSize(folderPath) {
    const files = fs.readdirSync(folderPath);
    let size = 0;

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            size += getFolderSize(filePath);
        } else {
            size += stat.size;
        }
    }

    return size;
}

function processGameCleanup(basePath, itemsToRemove, removeAllThatStartsWith) {
    const removedItems = [];
    let itemsRemoved = false;

    try {
        let totalBytesFreed = 0;

        for (const item of itemsToRemove) {
            const fullPath = path.join(basePath, item);
            if (fs.existsSync(fullPath)) {
                const isDirectory = fs.statSync(fullPath).isDirectory();

                const size = isDirectory ? getFolderSize(fullPath) : fs.statSync(fullPath).size;
                totalBytesFreed += size;

                removedItems.push({
                    path: fullPath,
                    isDirectory,
                    size
                });
            } else {
                removedItems.push({ path: fullPath, notFound: true });
            }
        }

        const totalSize = calculateTotalSize(removedItems);
        const confirmationPrompt = `Remove the following files and folders? (yes/no)\n${removedItems.map(item => `${item.path} (${formatBytes(item.size)})`).join('\n')}\nTotal Size: ${formatBytes(totalSize)}\n`;
        const confirmation = readlineSync.question(confirmationPrompt);

        if (confirmation.toLowerCase() === 'yes') {
            for (const item of removedItems) {
                if (item.isDirectory) {
                    fs.rm(item.path, { recursive: true });
                    console.log(`Removed folder: ${item.path} (${formatBytes(item.size)})`);
                } else {
                    fs.unlinkSync(item.path);
                    console.log(`Removed file: ${item.path} (${formatBytes(item.size)})`);
                }
                itemsRemoved = true;
            }
            console.log(`Total space freed: ${formatBytes(totalBytesFreed)}`);
        } else {
            console.log('Removal canceled by user.');
        }

        for (const folderAndPrefix of removeAllThatStartsWith) {
            const [folder, prefix] = folderAndPrefix.split('/');
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

        console.log('The following files/folders will be removed:');

        if (removedItems.length > 0) {
            removedItems.forEach(item => console.log(item));
        } else {
            console.log('No files/folders removed');
        }

    } catch (error) {
        console.error('Error removing files/folders:', error.message);
    }
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
    console.log('Supported Games:');
    gameData.forEach((game, index) => console.log(`${index} - ${game.gameName}`));
} else if (action === 'clean_up_game') {
    findSteamGameFolder(selectedGameIndex, steamFolderPath, gameData);
} else {
    console.error('Invalid action. Usage: node your_script_name.js get_game_list <steamFolderPath>');
}
