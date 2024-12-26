// /src/utils/JsonFileOperations.ts

import type {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "src/interfaces/TaskItemProps";

import type { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import { get } from "svelte/store";
import { loadTasksJsonFromStore } from "./tasksCache";
import { plugin } from "src/store";

// Operations with data.json

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = async () => {
	try {
		const myPlugin = get(plugin);
		await myPlugin.loadSettings();
		const globalSettings = myPlugin.settings.data.globalSettings || {};
		return globalSettings;
	} catch (error) {
		console.error("Error loading globalSettings:", error);
	}
};
// Function to load boards data from the JSON file
export const loadBoardsData = async (): Promise<Board[]> => {
	const myPlugin = get(plugin);
	try {
		// Fetch settings via Obsidian's loadData method
		await myPlugin.loadSettings();

		const boardConfigs = myPlugin.settings.data.boardConfigs || [];

		return boardConfigs;
	} catch (error) {
		console.error("Error loading board configurations:", error);
		throw error;
	}
};
// Function to save boards data to the JSON file
export const saveBoardsData = async (updatedBoards: Board[]) => {
	try {
		const myPlugin = get(plugin);
		// Fetch current settings
		await myPlugin.loadSettings();

		// Update the boardConfigs in settings
		myPlugin.settings.data.boardConfigs = updatedBoards;

		// Save updated settings
		await myPlugin.saveSettings();
	} catch (error) {
		console.error("Error saving board configurations:", error);
		throw error;
	}
};

// Operations with tasks.json

export const loadTasksAndMerge = async (): Promise<taskJsonMerged | undefined> => {
	try {
		const allTasks: tasksJson | undefined = await loadTasksJsonFromStore();
		console.log(
			"loadTasksAndMerge : What have I got from store :",
			allTasks
		);
		if (allTasks) {
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
		}
	} catch (error) {
		console.error("Failed to load tasks from tasks.json:", error);
		// throw error;
	}
};
