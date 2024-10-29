import TaskBoard from "main";
import { tasksJson } from "src/interfaces/TaskItemProps";

// Function to load tasks from disk and store in sessionStorage
export const loadTasksJsonFromDiskToSS = async (
	plugin: TaskBoard
): Promise<tasksJson> => {
	try {
		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const data: string = await plugin.app.vault.adapter.read(path);
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
export const writeTasksJsonToDisk = async (
	plugin: TaskBoard
): Promise<void> => {
	try {
		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const ssData = sessionStorage.getItem("tasksData");
		let tasksData: tasksJson = JSON.parse(ssData ? ssData : "");

		// Clean up data to remove empty arrays/objects before writing
		tasksData = dataCleanup(tasksData);

		if (tasksData) {
			await plugin.app.vault.adapter.write(
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
		throw error;
	}
};

// Function to load tasks from sessionStorage (faster than reading from disk)
export const loadTasksJsonFromSS = async (
	plugin: TaskBoard
): Promise<tasksJson> => {
	try {
		const tasksData = sessionStorage.getItem("tasksData");
		if (tasksData) {
			return JSON.parse(tasksData);
		}
		return JSON.parse(tasksData ? tasksData : "");
	} catch (error) {
		console.warn("Error loading tasks from sessionStorage:", error);
		throw error;
	}
};

// Function to update tasks in sessionStorage (avoiding immediate disk write)
export const writeTasksJsonToSS = async (
	plugin: TaskBoard,
	updatedData: tasksJson
): Promise<void> => {
	try {
		// Store the updated tasks data in sessionStorage
		sessionStorage.setItem("tasksData", JSON.stringify(updatedData));
		plugin.IsTasksJsonChanged = true;
	} catch (error) {
		console.warn("Error updating tasks in sessionStorage:", error);
		throw error;
	}
};

// Function to write tasks from sessionStorage to disk after 5 minutes
export const writeTasksFromSessionStorageToDisk = async (
	plugin: TaskBoard
): Promise<void> => {
	try {
		if (plugin.IsTasksJsonChanged) {
			// Trigger write operation to save sessionStorage data to disk
			plugin.IsTasksJsonChanged = false;
			await writeTasksJsonToDisk(plugin);
		}
	} catch (error) {
		console.warn("Error writing tasks from sessionStorage to disk:", error);
	}
};

// Start a timer to write tasks from sessionStorage to disk every 5 minutes
export const startPeriodicSave = (plugin: TaskBoard) => {
	setInterval(async () => {
		await writeTasksFromSessionStorageToDisk(plugin);
	}, 10 * 60 * 1000); // 5 minutes in milliseconds
};

// Call this function when the plugin is unloading
export const onUnloadSave = async (plugin: TaskBoard) => {
	await writeTasksJsonToDisk(plugin);
};
