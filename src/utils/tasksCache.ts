import TaskBoard from "main";
import { tasksJson } from "src/interfaces/TaskItemProps";

// Function to load tasks from disk and store in sessionStorage
export const loadTasksJsonFromDiskToSS = async (
	plugin: TaskBoard
): Promise<tasksJson> => {
	try {
		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		console.log(
			"---------- The only Disk Read Operation to Load tasks.json (loadTasksJsonFromDiskToSS) -------------"
		);
		const data: string = await plugin.app.vault.adapter.read(path);
		const allTasks: tasksJson = JSON.parse(data);
		console.log("Following tasks has been loaded from Disk : ", allTasks);

		// Store the tasks data in sessionStorage for future use
		sessionStorage.setItem("tasksData", JSON.stringify(allTasks));
		console.log(
			"Following tasks has been written to sessionStorage : ",
			JSON.parse(sessionStorage.getItem("tasksData"))
		);

		// Return the tasks data
		return allTasks;
	} catch (error) {
		console.error("Error reading tasks.json from disk:", error);
		throw error;
	}
};

// Function to write tasks data to disk (called after 5-minute intervals or before unload)
export const writeTasksJsonToDisk = async (plugin: TaskBoard): Promise<void> => {
	try {
		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		const ssData = sessionStorage.getItem("tasksData");
		const tasksData: tasksJson = JSON.parse(ssData ? ssData : "");
		console.log(
			"SESSIONSTORAGE : writeTasksJsonToDisk : The data i am going to write to the Disk : ",
			tasksData
		);

		if (tasksData) {
			console.log(
				"---------- The only Disk Write Operation to Write tasks.json (writeTasksJsonToDisk) -------------"
			);
			await plugin.app.vault.adapter.write(
				path,
				JSON.stringify(tasksData, null, 4)
			);

			// plugin.app.vault.adapter.writeBinary
			console.log("Successfully updated tasks.json from sessionStorage.");
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
export const loadTasksJsonFromSS = async (plugin: TaskBoard): Promise<tasksJson> => {
	try {
		const tasksData = sessionStorage.getItem("tasksData");
		console.log(
			"loadTasksJsonFromSS : Following is the data which will be sent for column rendering : ",
			JSON.parse(tasksData)
		);
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
		console.log(
			"SESSIONSTORAGE : Tasks updated in sessionStorage : ",
			JSON.parse(sessionStorage.getItem("tasksData"))
		);
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
		console.log(
			"SESSIONSTORAGE : Time UP : Running the Periodically Saving of data from sessionStorage to Disk."
		);
		if (!plugin.IsTasksJsonChanged) {
			console.log("The data in SessionStorage has not been changed. No need to write the data from sessionStorage to Disk....");
		} else {
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
		console.log("This function runs after every 1 min, let me see what is the value of the plugin.IsTasksJsonChanged = ", plugin.IsTasksJsonChanged);
		await writeTasksFromSessionStorageToDisk(plugin);
	}, 1 * 60 * 1000); // 5 minutes in milliseconds
};

// Call this function when the plugin is unloading
export const onUnloadSave = async (plugin: TaskBoard) => {
	await writeTasksJsonToDisk(plugin);
	console.log("Tasks saved to disk before plugin unload.");
};
