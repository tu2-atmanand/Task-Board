// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab, Setting } from "obsidian";

import { SettingsManager } from "../services/TaskBoardSettingConstructUI";
import type TaskBoard from "../../main";
import { globalSettingsData } from "src/interfaces/GlobalSettings";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	globalSettings: globalSettingsData | null = null;
	dataFilePath: string;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = new SettingsManager(app, plugin);
		this.dataFilePath = `${this.plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
	}

	// Display the settings in the settings tab
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		this.settingsManager.constructUI(containerEl, "Task Board");
	}
}
