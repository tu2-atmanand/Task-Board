// src/settings/TaskBoardSettingTab.ts
import { App, PluginSettingTab, Setting } from "obsidian";

import { GlobalSettings } from "src/interfaces/KanbanView";
import TaskBoard from "../../main"; // Adjust the path based on your file structure
import fs from "fs";
import path from "path";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	dataFilePath = path.join(
		(window as any).app.vault.adapter.basePath,
		".obsidian",
		"plugins",
		"Task-Board",
		"plugindata.json"
	);
	globalSettings: GlobalSettings | null = null;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private static createFragmentWithHTML = (html: string) =>
		createFragment(
			(documentFragment) =>
				(documentFragment.createDiv().innerHTML = html)
		);

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
			filters,
			taskCompletionFormat,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
			autoAddDue,
			ScanVaultAtStartup,
		} = this.globalSettings;

		containerEl.createEl("h3", { text: "Task Board Plugin" });

		// Setting for taskCompletionFormat
		new Setting(containerEl)
			.setName("Files and Paths to ignore")
			// .setDesc("Enter the file names and Paths separated by comman. All tasks under this files will be ignored.")
			.setDesc(
				TaskBoardSettingTab.createFragmentWithHTML(
					"<p>Enter the file names and Paths separated by comman. All tasks under this files will be ignored.</p>" +
						"<p>NOTE : <b>You will need to Rescan the Vault by pressing the rescan button from the Title bar of the plugin window.</b></p>"
				)
			)
			.setTooltip(
				"You will need to Rescan the Vault by pressing the rescan button from the Title bar of the plugin window."
			)
			.addText((text) => {
				const oldValue = this.globalSettings!.filters;
				text.setPlaceholder(
					`${
						oldValue
							? oldValue
							: "Enter File and Folder names, separated with comma"
					}`
				);
				text.setValue(oldValue ? oldValue.toString() : "");
				text.setValue(filters).onChange(async (string) => {
					this.globalSettings!.filters.pop();
					this.globalSettings!.filters.push(string);
					await this.saveSettings();
				});
			});

		// Setting for firstDayOfWeek
		new Setting(containerEl)
			.setName("First Day of the Week")
			.setDesc("Set the first day of the week")
			// .addText((text) =>
			// 	text.setValue(firstDayOfWeek).onChange(async (value) => {
			// 		this.globalSettings!.firstDayOfWeek = value;
			// 		await this.saveSettings();
			// 	})
			// );
			.addDropdown((dropdown) => {
				dropdown.addOption("1", "Sunday");
				dropdown.addOption("2", "Monday");
				dropdown.addOption("3", "Tuesday");
				dropdown.addOption("4", "Wednesday");
				dropdown.addOption("5", "Thursday");
				dropdown.addOption("6", "Friday");
				dropdown.addOption("7", "Satday");

				dropdown.setValue(firstDayOfWeek as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.firstDayOfWeek = value;
					await this.saveSettings();
				});
			});

		// // Setting for ignoreFileNameDates
		// new Setting(containerEl)
		// 	.setName("Ignore File Name Dates")
		// 	.setDesc("Whether to ignore dates in file names")
		// 	.addToggle((toggle) =>
		// 		toggle.setValue(ignoreFileNameDates).onChange(async (value) => {
		// 			this.globalSettings!.ignoreFileNameDates = value;
		// 			await this.saveSettings();
		// 		})
		// 	);

		// // Setting for taskCompletionFormat
		// new Setting(containerEl)
		// 	.setName("Task Completion Format")
		// 	.setDesc("Set the task completion format")
		// 	.addText((text) =>
		// 		text.setValue(taskCompletionFormat).onChange(async (value) => {
		// 			this.globalSettings!.taskCompletionFormat = value;
		// 			await this.saveSettings();
		// 		})
		// 	);

		// Setting to Scan the whole Vault to detect all tasks and re-write the tasks.json
		new Setting(containerEl)
			.setName("Auto Scan the Vault on Obsidian Startup")
			.setDesc(
				TaskBoardSettingTab.createFragmentWithHTML(
					"<p>The plugin will scan the whole vault to detect all the undetected tasks from whole vault everytime Obsidian starts.</p>" +
						"<p>NOTE : <b>If your vault contains lot of files with huge data, this might affect the startup time of Obsidian.</b></p>"
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(ScanVaultAtStartup).onChange(async (value) => {
					this.globalSettings!.ScanVaultAtStartup = value;
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

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(containerEl)
			.setName("Auto Add Due Date to Tasks")
			.setDesc(
				"Whether to auto add Due Date as Today's date when the tasks are created from the Add New task shortcut."
			)
			.addToggle((toggle) =>
				toggle.setValue(autoAddDue).onChange(async (value) => {
					this.globalSettings!.autoAddDue = value;
					await this.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Default Column Names" });

		// Create settings for each default column name
		for (const [key, value] of Object.entries(defaultColumnNames)) {
			new Setting(containerEl)
				.setName(`${key}`)
				.setDesc(`Enter the name for the ${key} column`)
				.addText((text) => {
					const oldValue =
						this.globalSettings!.defaultColumnNames[
							key as keyof typeof defaultColumnNames
						];
					// console.log("Old Values of Columns names : ", oldValue);
					// text.inputEl.setAttr("type", "string");
					text.setPlaceholder(
						`${oldValue ? oldValue : "Enter New Column Name"}`
					);
					// text.inputEl.value = value ? value.toString() : "";

					text.setValue(value).onChange(async (newValue) => {
						this.globalSettings!.defaultColumnNames[
							key as keyof typeof defaultColumnNames
						] = newValue;
						await this.saveSettings();
					});
				});
		}
	}
}
