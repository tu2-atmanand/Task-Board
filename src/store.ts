// /src/store.ts

import type { App, ItemView, MetadataCache } from "obsidian";
import type {
	PluginDataJson,
	globalSettingsData,
} from "./interfaces/GlobalSettings";
import { derived, writable } from "svelte/store";
import { loadBoardsData, loadTasksAndMerge } from "./utils/JsonFileOperations";
import {
	loadTasksJsonFromDiskToShared,
	writeTasksJsonFromStoreToDisk,
} from "./utils/tasksCache";
import type {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "./interfaces/TaskItemProps";

import type { Board } from "./interfaces/BoardConfigs";
import type { KanbanView } from "./views/KanbanView";
import TaskBoard from "main";

// Stores for reactive state management
export const app = writable<App>();
export const plugin = writable<TaskBoard>();
export const view = writable<KanbanView>();
export const appCache = writable<MetadataCache>();

// Storing plugin settings and board configs
export const taskBoardSettings = writable<globalSettingsData>();
export const boardConfigs = writable<Board[]>();

// Storing task data
export const allTaskJsonData = writable<tasksJson>();
export const allTasksMerged = writable<taskJsonMerged>();
export const tasks = writable<taskJsonMerged>({ Pending: [], Completed: [] });
export const updatedTask = writable<taskItem>();

// Storing status to trigger events
export const isTasksJsonChanged = writable(false);
export const refreshSignal = writable<boolean>(false);
export const recentUpdatedFilePath = writable<string>("");

export const getAllTaskJsonData = async () => {
	const taskJson = await loadTasksJsonFromDiskToShared();
	console.log("allTaskJsonData : Loading taskJson from disk :", taskJson);
	allTaskJsonData.set(taskJson);
};

// export const allTasksMerged = writable<taskJsonMerged>({ Pending: [], Completed: [] });

// Load tasks from disk into store
export const getAllTasksMerged = async () => {
	try {
		const mergedTasks = await loadTasksAndMerge();
		console.log("getAllTasksMerged : Tasks loaded:", mergedTasks);
		if (mergedTasks) allTasksMerged.set(mergedTasks);
	} catch (error) {
		console.error("Error loading tasks into store:", error);
	}
};

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
export const initializeStores = async () => {
	try {
		console.log("Initializing stores...");
		await Promise.all([
			getBoardConfigs(),
			await getAllTaskJsonData(),
			getAllTasksMerged(),
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
	allTasksMerged,
	updatedTask,
	allTaskItemsToDisplay,
	refreshSignal,
	recentUpdatedFilePath,
};
