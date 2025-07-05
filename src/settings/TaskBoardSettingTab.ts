// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab } from "obsidian";

import { SettingsManager } from "src/settings/TaskBoardSettingConstructUI";
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
		this.settingsManager = new SettingsManager(plugin);
	}

	// Display the settings in the settings tab
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		this.settingsManager.constructUI(containerEl, t("task-board"));
	}

	hide(): void {
		this.settingsManager.cleanUp();
	}
}
