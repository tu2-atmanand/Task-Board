import TaskBoard from "main";
import { TaskBoardSubmodule } from "./subModules";

export class CommunityPlugins extends TaskBoardSubmodule {
	get reminderPlugin() {
		this.app
		return (
			this.app.plugins.plugins["obsidian-reminder-plugin"] ??
			null
		);
	}

	isReminderPluginEnabled() {
		return !!this.reminderPlugin;
	}

	get quickAddPlugin() {
		return this.app.plugins.plugins["quickadd"] ?? null;
	}

	isQuickAddPluginEnabled() {
		return !!this.quickAddPlugin;
	}

	isQuickAddPluginIntegrationEnabled() {
		return (
			this.settings.data.globalSettings.compatiblePlugins
				.quickAddPlugin && this.isQuickAddPluginEnabled()
		);
	}

	// async getSettings(): Promise<void> {
	// 	const tasksPlugin = this.app.plugins.getPlugin("");
	// 	if (!tasksPlugin) return;
	// 	return await tasksPlugin.loadSettings();
	// }
}

export function isReminderPluginInstalled(plugin: TaskBoard) {
	const reminderPlugin = new CommunityPlugins(plugin);

	plugin.settings.data.globalSettings.compatiblePlugins.reminderPlugin =
		reminderPlugin.isReminderPluginEnabled();
}
