const fs = require('fs');
const fsPromises = require('fs').promises;
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
            console.log('Game Folder Path:\n', fullGameFolderPath, '\n');
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
    size += fs.statSync(folderPath).size;

    return size;
}

async function removeFolderRecursive(folderPath) {
    const files = await fsPromises.readdir(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fsPromises.stat(filePath);

        if (stat.isDirectory()) {
            await removeFolderRecursive(filePath);
        } else {
            await fsPromises.unlink(filePath);
        }
    }

    await fsPromises.rmdir(folderPath);
}

async function processGameCleanup(basePath, itemsToRemove, removeAllThatStartsWith, removeRange) {
    const removedItems = [];
    let itemsRemoved = false;

    try {
        let totalBytesFreed = 0;

        // Remove specified files/folders
        for (const item of itemsToRemove) {
            const fullPath = path.join(basePath, item);
            if (fs.existsSync(fullPath)) {
                const isDirectory = fs.statSync(fullPath).isDirectory();

                const size = isDirectory ? await getFolderSize(fullPath) : fs.statSync(fullPath).size;
                totalBytesFreed += size;

                removedItems.push({
                    path: fullPath,
                    isDirectory,
                    size
                });

                if (isDirectory) {
                    await removeFolderRecursive(fullPath);
                } else {
                    await fsPromises.unlink(fullPath);
                }
            } else {
                removedItems.push({ path: fullPath, notFound: true });
            }
        }

        // Remove files within a specified range
        if (removeRange) {
            const [start, end] = removeRange.split('|').map(Number);
            const filesInRange = fs.readdirSync(basePath)
                .filter(file => {
                    const fileNumber = parseInt(file.split('|')[1]);
                    return !isNaN(fileNumber) && fileNumber >= start && fileNumber <= end;
                });

            for (const fileInRange of filesInRange) {
                const fullPath = path.join(basePath, fileInRange);
                const isDirectory = fs.statSync(fullPath).isDirectory();

                const size = isDirectory ? await getFolderSize(fullPath) : fs.statSync(fullPath).size;
                totalBytesFreed += size;

                removedItems.push({
                    path: fullPath,
                    isDirectory,
                    size
                });

                if (isDirectory) {
                    await removeFolderRecursive(fullPath);
                } else {
                    await fsPromises.unlink(fullPath);
                }
            }
        }

        const totalSize = calculateTotalSize(removedItems);
        const confirmationPrompt = `${removedItems.map(item => `${item.path} (${formatBytes(item.size)})`).join('\n')}\n\nTotal Size: ${formatBytes(totalSize)}\n\nRemove the following files and folders? (yes/no)`;
        const confirmation = readlineSync.question(confirmationPrompt);

        if (confirmation.toLowerCase() === 'yes') {
            for (const item of removedItems) {
                if (item.isDirectory) {
                    console.log(`Removed folder: ${item.path} (${formatBytes(item.size)})`);
                } else {
                    console.log(`Removed file: ${item.path} (${formatBytes(item.size)})`);
                }
                itemsRemoved = true;
            }
            console.log(`Total space freed: ${formatBytes(totalBytesFreed)}`);
        } else {
            console.log('Removal canceled by user.');
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

async function runCleanup() {
    try {
        // Process command line arguments
        const action = process.argv[2];
        const steamFolderPath = process.argv[3];
        const selectedGameIndex = parseInt(process.argv[4]);

        const gameData = readGameData(csvFilePath);

        if (action === 'get_game_list') {
            console.log('Supported Games:');
            gameData.forEach((game, index) => console.log(`${index} - ${game.gameName}`));
        } else if (action === 'clean_up_game') {
            await findSteamGameFolder(selectedGameIndex, steamFolderPath, gameData);
        } else {
            console.error('Invalid action. Usage: node your_script_name.js get_game_list <steamFolderPath>');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Call the async function
runCleanup();
