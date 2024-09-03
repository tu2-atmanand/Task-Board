// src/settings/TaskBoardSettingTab.ts
import { App, PluginSettingTab, Setting } from "obsidian";
import fs from "fs";
import path from "path";
import TaskBoard from "../../main"; // Adjust the path based on your file structure

// Define the interface for GlobalSettings based on your JSON structure
export interface GlobalSettings {
	defaultColumnNames: {
		today: string;
		tomorrow: string;
		future: string;
		undated: string;
		otherTags: string;
		untagged: string;
		completed: string;
	};
	filters: string[];
	firstDayOfWeek: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
}

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	dataFilePath = path.join((window as any).app.vault.adapter.basePath,".obsidian","plugins","Task-Board","plugindata.json");
	globalSettings: GlobalSettings | null = null;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Function to load the settings from plugindata.json
	async loadSettings(): Promise<void> {
		try {
			const data = fs.readFileSync(this.dataFilePath, "utf8");
			const jsonData = JSON.parse(data);
			this.globalSettings = jsonData.data.globalSettings;
		} catch (err) {
			console.error("Error loading settings:", err);
		}
	}

	// Function to save settings back to plugindata.json
	async saveSettings(): Promise<void> {
		if (!this.globalSettings) return;

		try {
			const data = fs.readFileSync(this.dataFilePath, "utf8");
			const jsonData = JSON.parse(data);
			jsonData.data.globalSettings = this.globalSettings;

			fs.writeFileSync(
				this.dataFilePath,
				JSON.stringify(jsonData, null, 2)
			);
		} catch (err) {
			console.error("Error saving settings:", err);
		}
	}

	// Display the settings in the settings tab
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		await this.loadSettings();

		if (!this.globalSettings) {
			containerEl.createEl("p", { text: "Failed to load settings." });
			return;
		}

		const {
			defaultColumnNames,
			firstDayOfWeek,
			ignoreFileNameDates,
			taskCompletionFormat,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
		} = this.globalSettings;

		// Create settings for each default column name
		for (const [key, value] of Object.entries(defaultColumnNames)) {
			new Setting(containerEl)
				.setName(`Default Column Name: ${key}`)
				.setDesc(`Enter the name for the ${key} column`)
				.addText((text) =>
					text.setValue(value).onChange(async (newValue) => {
						this.globalSettings!.defaultColumnNames[
							key as keyof typeof defaultColumnNames
						] = newValue;
						await this.saveSettings();
					})
				);
		}

		// Setting for firstDayOfWeek
		new Setting(containerEl)
			.setName("First Day of the Week")
			.setDesc("Set the first day of the week (e.g., Mon, Sun)")
			.addText((text) =>
				text.setValue(firstDayOfWeek).onChange(async (value) => {
					this.globalSettings!.firstDayOfWeek = value;
					await this.saveSettings();
				})
			);

		// Setting for ignoreFileNameDates
		new Setting(containerEl)
			.setName("Ignore File Name Dates")
			.setDesc("Whether to ignore dates in file names")
			.addToggle((toggle) =>
				toggle.setValue(ignoreFileNameDates).onChange(async (value) => {
					this.globalSettings!.ignoreFileNameDates = value;
					await this.saveSettings();
				})
			);

		// Setting for taskCompletionFormat
		new Setting(containerEl)
			.setName("Task Completion Format")
			.setDesc("Set the task completion format")
			.addText((text) =>
				text.setValue(taskCompletionFormat).onChange(async (value) => {
					this.globalSettings!.taskCompletionFormat = value;
					await this.saveSettings();
				})
			);

		// Setting for taskCompletionInLocalTime
		new Setting(containerEl)
			.setName("Task Completion in Local Time")
			.setDesc("Whether task completion times are shown in local time")
			.addToggle((toggle) =>
				toggle
					.setValue(taskCompletionInLocalTime)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionInLocalTime = value;
						await this.saveSettings();
					})
			);

		// Setting for taskCompletionShowUtcOffset
		new Setting(containerEl)
			.setName("Show UTC Offset for Task Completion")
			.setDesc(
				"Whether to display the UTC offset for task completion times"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(taskCompletionShowUtcOffset)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionShowUtcOffset =
							value;
						await this.saveSettings();
					})
			);
	}
}
