import { App, Plugin, TFile, TFolder } from "obsidian";
import { TaskBoardSubmodule } from "./subModules.js";
import type TaskBoard from "../../main.js";

export interface QuickAddPlugin extends Plugin {
	app: App;
	api: {
		executeChoice(
			choiceName: string,
			variables?: { [key: string]: unknown },
		): Promise<void>;
	};
}

export class CommunityPlugins extends TaskBoardSubmodule {
	get fileExplorerPlugin() {
		return this.app.internalPlugins.getEnabledPluginById("file-explorer");
	}

	isFileExplorerPluginEnabled() {
		return !!this.fileExplorerPlugin;
	}

	get reminderPlugin() {
		return this.app.plugins.plugins["obsidian-reminder-plugin"] ?? null;
	}

	isReminderPluginEnabled() {
		return !!this.reminderPlugin;
	}

	get quickAddPlugin(): QuickAddPlugin {
		return (this.app.plugins.plugins.quickAdd as QuickAddPlugin) ?? null;
	}

	isQuickAddPluginEnabled() {
		return !!this.quickAddPlugin;
	}

	isQuickAddPluginIntegrationEnabled() {
		return (
			this.settings.data.compatiblePlugins.quickAddPlugin &&
			this.isQuickAddPluginEnabled()
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

	plugin.settings.data.compatiblePlugins.reminderPlugin =
		reminderPlugin.isReminderPluginEnabled();
}

export function revealFileFolderInExplorer(
	plugin: TaskBoard,
	abstractFile: TFile | TFolder,
) {
	const communityPlugins = new CommunityPlugins(plugin);

	if (communityPlugins.isFileExplorerPluginEnabled()) {
		communityPlugins.fileExplorerPlugin?.revealInFolder(abstractFile);
	}
}
