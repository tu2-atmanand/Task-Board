// /src/shared.svelte.ts
import type { App, ItemView, MetadataCache } from "obsidian";
import type {
	PluginDataJson,
	globalSettingsData,
} from "./interfaces/GlobalSettings";
import { loadBoardsData, loadTasksAndMerge } from "./utils/JsonFileOperations";
import type {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "./interfaces/TaskItemProps";

import type { Board } from "./interfaces/BoardConfigs";
import type { KanbanView } from "./views/KanbanView";
import TaskBoard from "main";
import { loadTasksJsonFromDiskToShared } from "./utils/tasksCache";

// Reactive state variables
// export let plugin = $state<TaskBoard>();
// export let app = $state<App>();
// export let appCache = $state<MetadataCache>();
// export let view = $state<KanbanView>();
// export let taskBoardSettings = $state<globalSettingsData>();

interface types {
	plugin: TaskBoard | null;
	app: App | null;
	appCache: MetadataCache | null;
	view: KanbanView | null;
	taskBoardSettings: globalSettingsData | null;
	boardConfigs: Board[] | [];
	allTaskJsonData: tasksJson | {};
	allTasksMerged: taskJsonMerged | { Pending: []; Completed: [] };
	allTaskItemsToDisplay: taskItem[] | [];
	refreshSignal: boolean;
	recentUpdatedFilePath: string;
	isTasksJsonChanged: boolean;
}

export const store = $state<types>({
	plugin: null,
	app: null,
	appCache: null,
	view: null,
	taskBoardSettings: null,
	boardConfigs: [],
	allTaskJsonData: {},
	allTasksMerged: { Pending: [], Completed: [] },
	allTaskItemsToDisplay: [],
	refreshSignal: false,
	recentUpdatedFilePath: "",
	isTasksJsonChanged: false,
});

export const setTaskBoardSettings = (data: globalSettingsData) => {
	store.taskBoardSettings = data;
};

// Board configs
// export let boardConfigs = $state<Board[]>([]);
export const initializeBoardConfigs = async () => {
	try {
		console.log("Loading boards data...");
		const boardData = await loadBoardsData();
		console.log("Boards data loaded:", boardData);
		store.boardConfigs = boardData;
	} catch (error) {
		console.error("Error loading boards data:", error);
	}
};
export const getBoardConfigs = () => {
	return store.boardConfigs;
};
export const setBoardConfigs = (data: Board[]) => {
	store.boardConfigs = data;
};

// All utils related to allTasksJsonData
// export let allTaskJsonData = $state<tasksJson>();
export const initializeAllTasksJsonData = async () => {
	const taskJson = await loadTasksJsonFromDiskToShared();
	console.log("allTaskJsonData : Loading taskJson from disk :", taskJson);
	store.allTaskJsonData = taskJson;
};
export const getAllTasksJsonData = async () => {
	return store.allTaskJsonData;
};
export const setAllTasksJsonData = (data: tasksJson) => {
	store.allTaskJsonData = data;
};

// All utils related to allTasksMerged
// export let allTasksMerged = $state<taskJsonMerged>({
// 	Pending: [],
// 	Completed: [],
// });
export const initializeAllTasksMerged = async () => {
	try {
		const mergedTasks = await loadTasksAndMerge();
		console.log("initializeAllTasksMerged : Tasks loaded:", mergedTasks);
		if (mergedTasks) store.allTasksMerged = mergedTasks;
	} catch (error) {
		console.error("Error loading tasks into store:", error);
	}
};
export const getAllTasksMerged = async () => {
	return store.allTasksMerged;
};
export const setAllTasksMerged = (data: taskJsonMerged) => {
	store.allTasksMerged = data;
};

// export const allTaskItemsToDisplay = $state<taskItem[]>([]);
// export let $tasks = $derived(
// 	(tasksMerged: taskJsonMerged) =>
// 		tasksMerged || { Pending: [], Completed: [] }
// );
// export let $updatedTask = $state<taskItem>();

// Status flags and signals
// export let isTasksJsonChanged = $state(false);
// export let refreshSignal = $state(false);
// export let recentUpdatedFilePath = $state("");

// Derived state
// export let $allTaskItemsToDisplay = $derived((tasks: taskJsonMerged) => [
// 	...tasks.Pending,
// 	...tasks.Completed,
// ]);

// Initializer function
export const initializeSharedState = async () => {
	try {
		console.log("Initializing shared state...");
		await Promise.all([
			initializeBoardConfigs(),
			initializeAllTasksJsonData(),
			initializeAllTasksMerged(),
		]);
		console.log("Shared state initialized successfully.");
	} catch (error) {
		console.error("Error initializing shared state:", error);
	}
};
