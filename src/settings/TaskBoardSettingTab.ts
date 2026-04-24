// src/views/TaskBoardSettingTab.ts

import { t } from "i18next";
import { App, PluginSettingTab } from "obsidian";
import TaskBoard from "../../main.js";
import { globalSettingsData } from "../interfaces/GlobalSettings.js";
import { TaskBoardIcon } from "../interfaces/Icons.js";
import { SettingsManager } from "./SettingConstructUI.js";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	globalSettings: globalSettingsData | null = null;
	icon: string = TaskBoardIcon;

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
