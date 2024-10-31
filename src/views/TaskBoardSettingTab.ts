// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab, Setting } from "obsidian";

import { SettingsManager } from "../services/TaskBoardSettingConstructUI";
import type TaskBoard from "../../main";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	globalSettings: globalSettingsData | null = null;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = new SettingsManager(app, plugin);
	}

	// Display the settings in the settings tab
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		this.settingsManager.constructUI(containerEl, t(130));
	}
}
