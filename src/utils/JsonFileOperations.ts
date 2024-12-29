// /src/utils/JsonFileOperations.ts

import {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "src/interfaces/TaskItemProps";

import { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import { loadTasksJsonFromSS } from "./tasksCache";

// Operations with data.json

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = async (plugin: TaskBoard) => {
	try {
		await plugin.loadSettings();
		const globalSettings = plugin.settings.data.globalSettings || {};
		return globalSettings;
	} catch (error) {
		console.error("Error loading globalSettings:", error);
		return {};
	}
};

// Function to load boards data from the JSON file
export const loadBoardsData = async (plugin: TaskBoard): Promise<Board[]> => {
	try {
		// Fetch settings via Obsidian's loadData method
		await plugin.loadSettings();

		const boardConfigs = plugin.settings.data.boardConfigs || [];

		return boardConfigs;
	} catch (error) {
		console.error("Error loading board configurations:", error);
		throw error;
	}
};

// Function to save boards data to the JSON file
export const saveBoardsData = async (
	plugin: TaskBoard,
	updatedBoards: Board[]
) => {
	try {
		// Fetch current settings
		await plugin.loadSettings();

		// Update the boardConfigs in settings
		plugin.settings.data.boardConfigs = updatedBoards;

		// Save updated settings
		await plugin.saveSettings();
	} catch (error) {
		console.error("Error saving board configurations:", error);
		throw error;
	}
};

// Operations with tasks.json

export const loadTasksAndMerge = async (
	plugin: TaskBoard
): Promise<taskJsonMerged> => {
	try {
		const allTasks: tasksJson = await loadTasksJsonFromSS(plugin);
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

		return allTasksMerged;
	} catch (error) {
		console.error("Failed to load tasks from tasks.json:", error);
		throw error;
	}
};

// export async function loadTasksProcessed(plugin: TaskBoard) {
// 	return loadTasksAndMerge(plugin)
// 		.then(({ allTasksMerged }) => {
// 			return allTasksMerged; // Ensure it returns the merged tasks
// 		})
// 		.catch((error) => {
// 			console.error("Error while loading tasks:", error);
// 			// Return an empty taskJsonMerged object to avoid 'undefined'
// 			return { Pending: [], Completed: [] };
// 		});
// }
