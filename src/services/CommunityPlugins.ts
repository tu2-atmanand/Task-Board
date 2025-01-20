import type TaskBoard from "main";
import { TaskBoardSubmodule } from "./subModules";

export class TasksPlugin extends TaskBoardSubmodule {
	get tasksPlugin() {
		return this.app.plugins.plugins["obsidian-tasks-plugin"] ?? null;
	}

	isEnabled() {
		return !!this.tasksPlugin;
	}

	// async getSettings(): Promise<void> {
	// 	const tasksPlugin = this.app.plugins.getPlugin("");
	// 	if (!tasksPlugin) return;
	// 	return await tasksPlugin.loadSettings();
	// }
}

export async function fetchTasksPluginCustomStatuses(plugin: TaskBoard) {
	try {
		const tasksPluginO = new TasksPlugin(plugin);
		// if( plugin.app.plugins.getPlugin("obsidian-tasks-plugin")) {
		if (tasksPluginO.isEnabled()) {
			// Define the path to the tasks plugin data.json file
			const path = `${plugin.app.vault.configDir}/plugins/obsidian-tasks-plugin/data.json`;

			// Read the file content
			const data: string = await plugin.app.vault.adapter.read(path);
			const parsedData = JSON.parse(data);

			// Extract customStatuses from the JSON
			const customStatuses =
				parsedData?.statusSettings?.customStatuses || [];

			// Store it in the plugin settings
			plugin.settings.data.globalSettings.tasksPluginCustomStatuses =
				customStatuses;
			plugin.saveSettings();
			console.log(
				"Custom statuses from tasks plugin fetched successfully:",
				customStatuses
			);
		}
	} catch (error) {
		console.error(
			"Error fetching custom statuses from tasks plugin:",
			error
		);
	}
}
