import TaskBoard from "main";
import { TaskBoardSubmodule } from "./subModules";

export class CommunityPlugins extends TaskBoardSubmodule {
	get tasksPlugin() {
		return this.app.plugins.plugins["obsidian-tasks-plugin"] ?? null;
	}

	isTasksPluginEnabled() {
		return !!this.tasksPlugin;
	}

	get reminderPlugin() {
		return this.app.plugins.plugins["obsidian-reminder-plugin"] ?? null;
	}

	isReminderPluginEnabled() {
		return !!this.reminderPlugin;
	}

	// async getSettings(): Promise<void> {
	// 	const tasksPlugin = this.app.plugins.getPlugin("");
	// 	if (!tasksPlugin) return;
	// 	return await tasksPlugin.loadSettings();
	// }
}

export async function fetchTasksPluginCustomStatuses(plugin: TaskBoard) {
	try {
		const tasksPluginO = new CommunityPlugins(plugin);
		// if( plugin.app.plugins.getPlugin("obsidian-tasks-plugin")) {
		if (tasksPluginO.isTasksPluginEnabled()) {
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
		}
	} catch (error) {
		console.error(
			"Error fetching custom statuses from tasks plugin:",
			error
		);
	}
}

export function isReminderPluginInstalled(plugin: TaskBoard) {
	const reminderPlugin = new CommunityPlugins(plugin);

	console.log("Reminder Plugin Installed: ", reminderPlugin.isReminderPluginEnabled());

	plugin.settings.data.globalSettings.compatiblePlugins.reminderPlugin =
		reminderPlugin.isReminderPluginEnabled();
}
