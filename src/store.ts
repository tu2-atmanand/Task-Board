import type { App, MetadataCache } from "obsidian";
import type { PluginDataJson, globalSettingsData } from "./interfaces/GlobalSettings";
import { derived, writable } from "svelte/store";
import {
	loadBoardsData,
	loadTasksAndMerge,
} from "./utils/JsonFileOperations";
import {
	loadTasksJsonFromDiskToStore,
	writeTasksJsonFromStoreToDisk,
} from "./utils/tasksCache";
import type {
	taskItem,
	taskJsonMerged,
	tasksJson
} from "./interfaces/TaskItemProps";

import type { Board } from "./interfaces/BoardConfigs";
import type { KanbanView } from "./views/KanbanView";
import TaskBoard from "main";

// Stores for reactive state management
export const app = writable<App>();
export const plugin = writable<TaskBoard>();
export const view = writable<KanbanView>();
export const appCache = writable<MetadataCache>();
export const taskBoardSettings = writable<globalSettingsData>();
export const boardConfigs = writable<Board[]>();
export const tasks = writable<taskJsonMerged>({ Pending: [], Completed: [] });
export const isTasksJsonChanged = writable(false);

export const allTaskJsonData = writable<tasksJson>();

export const getAllTaskJsonData = async () => {
	const taskJson = await loadTasksJsonFromDiskToStore();
	console.log("allTaskJsonData : Loading taskJson from disk :", taskJson);
	allTaskJsonData.set(taskJson);
};

// export const allTasksMerged = writable<taskJsonMerged>({ Pending: [], Completed: [] });

// Load tasks from disk into store
export const allTasksMerged = derived([allTaskJsonData], async ([$allTaskJsonData]) => {
	try {
		console.log("Loading tasks from disk...");
		const processedTasks = await loadTasksAndMerge();
		console.log("Tasks loaded:", processedTasks);
		return processedTasks;
	} catch (error) {
		console.error("Error loading tasks into store:", error);
	}
});

export const allTaskItemsToDisplay = writable<taskItem[]>([]);

// Load boards data into store
export const getBoardConfigs = async () => {
	try {
		console.log("Loading boards data...");
		const boardData = await loadBoardsData();
		console.log("Boards data loaded:", boardData);
		boardConfigs.set(boardData);
	} catch (error) {
		console.error("Error loading boards data:", error);
	}
};

// Initialize stores when plugin loads
export const initializeStores = async (plugin: TaskBoard) => {
	try {
		console.log("Initializing stores...");
		await Promise.all([
			getAllTaskJsonData(),
			getBoardConfigs(),
		]);
		console.log("Stores initialized successfully.");
	} catch (error) {
		console.error("Error initializing stores:", error);
	}
};

export default {
	app,
	plugin,
	view,
	appCache,
	taskBoardSettings,
	boardConfigs,
	isTasksJsonChanged,
	allTaskJsonData,
	allTaskItemsToDisplay,
};
