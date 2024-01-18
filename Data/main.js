const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const csvFilePath = 'data/games_data.csv';
const readlineSync = require('readline-sync');

async function findSteamGameFolder(selectedGameIndex, gameFolderPath, gameData) {
    if (!(selectedGameIndex >= 0 && selectedGameIndex < gameData.length)) {
        console.error('Invalid number entered. Please provide a valid number.');
        return;
    }

    const { gameName, filesToRemove, removeAllThatStartsWith, removeRange } = gameData[selectedGameIndex];
    const fullGameFolderPath = path.join(gameFolderPath, gameName);

    try {
        if (await fsPromises.access(fullGameFolderPath).then(() => true).catch(() => false)) {
            console.log('Game Folder Path:\n', fullGameFolderPath, '\n');
            await processGameCleanup(fullGameFolderPath, filesToRemove, removeAllThatStartsWith, removeRange);
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
            const cleanedItem = item.replace(/'/g, '');
            const fullPath = path.join(basePath, cleanedItem);

            if (await fsPromises.access(fullPath).then(() => true).catch(() => false)) {
                const isDirectory = (await fsPromises.stat(fullPath)).isDirectory();

                if (isDirectory) {
                    // If it's a directory, remove the entire folder
                    await removeFolderRecursive(fullPath);
                } else {
                    // If it's a file, remove the file
                    const size = (await fsPromises.stat(fullPath)).size;
                    totalBytesFreed += size;

                    removedItems.push({
                        path: fullPath,
                        isDirectory,
                        size: isDirectory ? await getFolderSize(fullPath) : size
                    });
                }
            } else {
                removedItems.push({ path: fullPath, notFound: true });
            }
        }

        // Remove files within a specified range
        if (removeRange) {
            const [folder, range] = removeRange.replace(/'/g, '').split('>');
            const [start, end] = range.split('-').map(range => range.trim());
            const fullFolderPath = path.join(basePath, folder);

            console.log(`Looking for files in range: ${start} to ${end} in folder: ${fullFolderPath}`);

            const isInRange = (fileName) => {
                const lowerCaseFileName = fileName.toLowerCase();
                const lowerCaseStart = start.toLowerCase();
                const lowerCaseEnd = end.toLowerCase();

                console.log(`Checking file: ${fileName}`);

                return lowerCaseFileName.includes(lowerCaseStart) && lowerCaseFileName.includes(lowerCaseEnd);
            };

            const filesInRange = await fsPromises.readdir(fullFolderPath);

            for (const fileInRange of filesInRange) {
                const fullPath = path.join(fullFolderPath, fileInRange);
            
                console.log(`Checking file: ${fileInRange}`);
            
                if (isInRange(fileInRange)) {
                    console.log(`File ${fileInRange} is within the specified range.`);
                    const isDirectory = (await fsPromises.stat(fullPath)).isDirectory();
                    const size = isDirectory ? await getFolderSize(fullPath) : (await fsPromises.stat(fullPath)).size;
            
                    totalBytesFreed += size;
            
                    removedItems.push({
                        path: fullPath,
                        isDirectory,
                        size
                    });
                } else {
                    console.log(`File ${fileInRange} is NOT within the specified range.`);
                }
            }
        }

        // Remove files based on the beginning of the file name
        for (const folderAndPrefix of removeAllThatStartsWith) {
            const [folder, prefix] = folderAndPrefix.split('/');
            const cleanedFolder = folder.replace(/'/g, '');
            const cleanedPrefix = prefix.replace(/'/g, '');
            const fullFolderPath = path.join(basePath, cleanedFolder);

            const files = await fsPromises.readdir(fullFolderPath);

            const removedItemsInFolder = await Promise.all(files.map(async (file) => {
                const fullPath = path.join(fullFolderPath, file);

                if (file.toLowerCase().startsWith(cleanedPrefix.toLowerCase())) {

                    const stat = await fsPromises.stat(fullPath);
                    const isDirectory = stat.isDirectory();
                    const size = isDirectory ? await getFolderSize(fullPath) : stat.size;

                    totalBytesFreed += size;

                    return {
                        path: fullPath,
                        isDirectory,
                        size
                    };
                } else {
                    return null;
                }
            }));

            removedItems.push(...removedItemsInFolder.filter(item => item !== null));
        }


        const totalSize = calculateTotalSize(removedItems);
        const confirmationPrompt = `${removedItems.map(item => `${item.path} (${formatBytes(item.size)})`).join('\n')}\n\nTotal Size: ${formatBytes(totalSize)}\n\nRemove the above files and folders? (yes/no)`;
        const confirmation = readlineSync.question(confirmationPrompt);

        if (confirmation.toLowerCase() === 'yes') {
            for (const item of removedItems) {
                if (item.isDirectory) {
                    await removeFolderRecursive(item.path);
                    console.log(`Removed folder: ${item.path} (${formatBytes(item.size)})`);
                } else {
                    await fsPromises.unlink(item.path);
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
    return { itemsRemoved, removedItems };
}

function readGameData(csvFilePath) {
    try {
        const fileContents = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = fileContents.trim().split('\n').slice(1);

        const gameData = [];

        for (const row of rows) {
            const [_, gameName, filesToRemove, removeAllThatStartsWith, removeRange] = row.split(',');
            const fullPathsToRemove = filesToRemove.toLowerCase() === 'none' ? [] : filesToRemove.split(';').map(file => file.trim());
            const fullPathsToRemoveStartsWith = removeAllThatStartsWith.toLowerCase() === 'none' ? [] : removeAllThatStartsWith.split(';').map(file => file.trim());
            gameData.push({ gameName, filesToRemove: fullPathsToRemove, removeAllThatStartsWith: fullPathsToRemoveStartsWith, removeRange });
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
