// /src/utils/JsonFileOperations.ts

import { App, Plugin } from "obsidian";
import { dataFilePath, tasksPath } from "src/interfaces/GlobalVariables";
import { taskItem, taskJsonMerged, tasksJson } from "src/interfaces/TaskItem";

import { Board } from "../interfaces/KanbanBoard";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import TaskBoard from "main";
import fs from "fs";
import path from "path";

// Operations with data.json

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = () => {
	try {
		const settingsData = fs.readFileSync(dataFilePath, "utf8");
		return JSON.parse(settingsData).data.globalSettings;
	} catch (error) {
		console.error("Error loading globalSettings:", error);
		return {};
	}
};

// Load only the boardConfigs part from the data.json
export const loadBoardConfigs = () => {
	try {
		const settingsData = fs.readFileSync(dataFilePath, "utf8");
		return JSON.parse(settingsData).data.boardConfigs;
	} catch (error) {
		console.error("Error loading boardConfigs:", error);
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
			const jsonData = JSON.parse(data).data; // Adjusting to match the exact json structure
			console.log(
				"loadBoardsData : Loading data.json for boardConfigs, I hope this is running only once..."
			);
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
			fs.writeFile(
				dataFilePath,
				JSON.stringify(currentData, null, 2),
				(writeErr) => {
					if (writeErr) {
						console.error("Error writing to data file:", writeErr);
					}
				}
			);
		} catch (parseErr) {
			console.error("Error parsing JSON data:", parseErr);
		}
	});
};

// Operations with tasks.json


export const loadTasksUsingObsidianMethod = async (
	plugin: TaskBoard
): Promise<{ allTasksMerged: taskJsonMerged }> => {
	const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
	console.log(
		"loadTasksUsingObsidianMethod2 : Let me see how many times this is running..."
	);
	try {
		const data: string = await plugin.app.vault.adapter.read(path);
		const allTasks: tasksJson = JSON.parse(data);

		const pendingTasks: taskItem[] = [];
		const completedTasks: taskItem[] = [];

		// Separate pending tasks
		for (const [filePath, tasks] of Object.entries(
			allTasks.Pending || {}
		)) {
			tasks.forEach((task: any) =>
				pendingTasks.push({ ...task, filePath })
			);
		}

		// Separate completed tasks
		for (const [filePath, tasks] of Object.entries(
			allTasks.Completed || {}
		)) {
			tasks.forEach((task: any) =>
				completedTasks.push({ ...task, filePath })
			);
		}

		const allTasksMerged: taskJsonMerged = {
			Pending: pendingTasks,
			Completed: completedTasks,
		};

		console.log("I am going to return the following data : ", allTasksMerged);

		return { allTasksMerged };
	} catch (error) {
		console.error("Failed to load tasks from tasks.json:", error);
		throw error;
	}
};

export async function loadTasksFromJson(plugin: TaskBoard) {
	console.log(
		"loadTasksFromJson : Let me see how many times this is running..."
	);
	return loadTasksUsingObsidianMethod(plugin)
		.then(({ allTasksMerged }) => {
			return allTasksMerged; // Ensure it returns the merged tasks
		})
		.catch((error) => {
			console.error("Error while loading tasks:", error);
			// Return an empty taskJsonMerged object to avoid 'undefined'
			return { Pending: [], Completed: [] };
		});
}
