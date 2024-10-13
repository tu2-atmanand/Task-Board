// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab, Setting } from "obsidian";

import { SettingsManager } from "../services/TaskBoardSettingConstructUI";
import type TaskBoard from "../../main"; // Adjust the path based on your file structure
import fs from "fs";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import path from "path";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	dataFilePath = path.join(
		(window as any).app.vault.adapter.basePath,
		".obsidian",
		"plugins",
		"task-board",
		"data.json"
	);
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

		this.settingsManager.constructUI(containerEl, "Task Board");

	}
}
