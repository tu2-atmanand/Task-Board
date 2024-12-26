import store, { allTaskJsonData, plugin } from "src/store";

import TaskBoard from "main";
import { get } from "svelte/store";
import type { tasksJson } from "src/interfaces/TaskItemProps";

// Function to load tasks from disk and store in sessionStorage
export const loadTasksJsonFromDiskToStore = async (): Promise<tasksJson> => {
	try {
		const myPlugin = get(plugin);
		const path = `${myPlugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const data: string = await myPlugin.app.vault.adapter.read(path);
		const allTasks: tasksJson = JSON.parse(data);
		// Store the tasks data in sessionStorage for future use
		sessionStorage.setItem("tasksData", JSON.stringify(allTasks));
		// Return the tasks data
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
		const myPlugin = get(plugin);
		const path = `${myPlugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const ssData = get(allTaskJsonData);

		// Clean up data to remove empty arrays/objects before writing
		const tasksData = dataCleanup(ssData);

		if (tasksData) {
			// console.log(
			// 	"writeTasksJsonFromStoreToDisk : Writing following data to the disk : ",
			// 	JSON.stringify(tasksData, null, 4)
			// );
			await get(plugin).app.vault.adapter.write(
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
export const loadTasksJsonFromStore = async (): Promise<tasksJson | undefined> => {
	try {
		return get(allTaskJsonData);
	} catch (error) {
		console.warn("Error loading tasks from sessionStorage:", error);
		// throw error;
	}
};

// Function to update tasksJsonData in store
export const writeTasksJsonToStore = async (
	updatedData: tasksJson
): Promise<void> => {
	try {
		// Store the updated tasks data in svelte.store
		store.allTaskJsonData.set(updatedData);
		store.isTasksJsonChanged.set(true);
	} catch (error) {
		console.warn("Error updating tasks in sessionStorage:", error);
		throw error;
	}
};

// Function to write tasks from sessionStorage to disk after 5 minutes
export const writeTasksFromSessionStorageToDisk = async (): Promise<void> => {
	try {
		if (store.isTasksJsonChanged) {
			// Trigger write operation to save sessionStorage data to disk
			store.isTasksJsonChanged.set(false);
			await writeTasksJsonFromStoreToDisk();
		}
	} catch (error) {
		console.warn("Error writing tasks from sessionStorage to disk:", error);
	}
};

// Call this function when the plugin is unloading
export const onUnloadSave = async (plugin: TaskBoard) => {
	await writeTasksJsonFromStoreToDisk();
};
