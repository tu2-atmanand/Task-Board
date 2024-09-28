import { App, Plugin } from "obsidian";

import { Board } from "../interfaces/KanbanBoard";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import fs from "fs";
import path from "path";

// File path to the JSON data
const basePath = (window as any).app.vault.adapter.basePath;
const dataFilePath = path.join(
	basePath,
	".obsidian",
	"plugins",
	"Task-Board",
	"data.json"
);

// Load globalSettings to check for dayPlannerPlugin value
export const loadGlobalSettings = () => {
	try {
		const settingsData = fs.readFileSync(dataFilePath, "utf8");
		return JSON.parse(settingsData);
	} catch (error) {
		console.error("Error loading globalSettings:", error);
		return {};
	}
};


// Function to load boards data from the JSON file
export const loadBoardsData = (): Promise<Board[]> => {
	return new Promise((resolve, reject) => {
		fs.readFile(dataFilePath, "utf8", (err, data) => {
			if (err) {
				console.error("Error reading data file:", err);
				reject(err);
				return;
			}
			const jsonData = JSON.parse(data).data; // Adjust this to match the exact JSON structure
			resolve(jsonData.boardConfigs);
		});
	});
};


// Function to save boards data to the JSON file
export const saveBoardsData = (updatedBoards: Board[]) => {
    // First, read the current content of the file
    fs.readFile(dataFilePath, "utf8", (readErr, data) => {
        if (readErr) {
            console.error("Error reading data file:", readErr);
            return;
        }

        try {
            // Parse the current JSON content
            const currentData = JSON.parse(data);

            // Update the boardConfigs part while keeping the other settings intact
            currentData.data.boardConfigs = updatedBoards;

            // Write the updated content back to the file
            fs.writeFile(dataFilePath, JSON.stringify(currentData, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error("Error writing to data file:", writeErr);
                }
            });
        } catch (parseErr) {
            console.error("Error parsing JSON data:", parseErr);
        }
    });
};
