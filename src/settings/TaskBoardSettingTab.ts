// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab } from "obsidian";

import { SettingsManager } from "src/settings/SettingConstructUI";
import type TaskBoard from "../../main";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";
import { TaskBoardIcon } from "src/interfaces/Icons";

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
