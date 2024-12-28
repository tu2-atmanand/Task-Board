// import store, { allTaskJsonData, isTasksJsonChanged, plugin } from "src/store";

import { store } from "src/shared.svelte";
import type { tasksJson } from "src/interfaces/TaskItemProps";

// Function to load tasks from disk and store in sessionStorage
export const loadTasksJsonFromDiskToShared = async (): Promise<tasksJson> => {
	try {
		const myPlugin = store.plugin;
		let allTasks: tasksJson = { Pending: {}, Completed: {} };
		if (myPlugin) {
			const path = `${myPlugin.app.vault.configDir}/plugins/task-board/tasks.json`;
			const data: string = await myPlugin.app.vault.adapter.read(path);
			allTasks = JSON.parse(data);
			// Store the tasks data in sessionStorage for future use
			sessionStorage.setItem("tasksData", JSON.stringify(allTasks));
			// Return the tasks data
		}
		return allTasks;
	} catch (error) {
		console.error("Error reading tasks.json from disk:", error);
		throw error;
	}
};

export const dataCleanup = (oldTaskData: tasksJson): tasksJson => {
	// Function to remove keys with empty arrays from a specified section
	const removeEmptyKeys = (section: any) => {
		Object.keys(section).forEach((key) => {
			if (Array.isArray(section[key]) && section[key].length === 0) {
				delete section[key];
			}
		});
	};

	// Remove empty arrays from "Pending" and "Completed" sections
	removeEmptyKeys(oldTaskData.Pending);
	removeEmptyKeys(oldTaskData.Completed);

	return oldTaskData;
};

// Function to write tasks data to disk (called after 5-minute intervals or before unload)
export const writeTasksJsonFromStoreToDisk = async (): Promise<void> => {
	try {
		const myPlugin = store.plugin;
		if (!myPlugin) return;
		const path = `${myPlugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const ssData = store.allTaskJsonData;
		if (!ssData) {
			console.warn("No tasks data found in sessionStorage to write to disk.");
			return;
		}

		// Clean up data to remove empty arrays/objects before writing
		const tasksData = dataCleanup(ssData);

		if (tasksData) {
			// console.log(
			// 	"writeTasksJsonFromStoreToDisk : Writing following data to the disk : ",
			// 	JSON.stringify(tasksData, null, 4)
			// );
			await myPlugin.app.vault.adapter.write(
				path,
				JSON.stringify(tasksData, null, 4)
			);
		} else {
			console.warn(
				"No tasks data found in sessionStorage to write to disk."
			);
		}
	} catch (error) {
		console.warn("Error writing tasks.json to disk:", error);
	}
};

// Function to load tasksJsonData from store
export const loadTasksJsonFromShared = async (): Promise<
	tasksJson | undefined
> => {
	try {
		return store.allTaskJsonData ?? undefined;
	} catch (error) {
		console.warn("Error loading tasks from sessionStorage:", error);
		// throw error;
	}
};

// Function to update tasksJsonData in store
export const writeTasksJsonToSharedStore = async (
	updatedData: tasksJson
): Promise<void> => {
	try {
		// Store the updated tasks data in svelte.store
		store.allTaskJsonData = updatedData;
		store.isTasksJsonChanged = true;
	} catch (error) {
		console.warn("Error updating tasks in sessionStorage:", error);
		throw error;
	}
};

// Function to write tasks from sessionStorage to disk after 5 minutes
export const writeTasksFromSessionStorageToDisk = async (): Promise<void> => {
	try {
		if (store.allTaskJsonData && store.isTasksJsonChanged) {
			// Trigger write operation to save sessionStorage data to disk
			store.isTasksJsonChanged = false;
			await writeTasksJsonFromStoreToDisk();
		}
	} catch (error) {
		console.warn("Error writing tasks from sessionStorage to disk:", error);
	}
};

// Call this function when the plugin is unloading
export const onUnloadSave = async () => {
	await writeTasksJsonFromStoreToDisk();
};
