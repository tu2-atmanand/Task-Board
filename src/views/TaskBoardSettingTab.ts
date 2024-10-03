// src/views/TaskBoardSettingTab.ts
import { App, PluginSettingTab, Setting } from "obsidian";

import TaskBoard from "../../main"; // Adjust the path based on your file structure
import fs from "fs";
import { globalSettingsData } from "src/interfaces/KanbanView";
import { loadGlobalSettings } from "src/utils/SettingsOperations";
import path from "path";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	dataFilePath = path.join(
		(window as any).app.vault.adapter.basePath,
		".obsidian",
		"plugins",
		"Task-Board",
		"data.json"
	);
	globalSettings: globalSettingsData | null = null;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private static createFragmentWithHTML = (html: string) =>
		createFragment(
			(documentFragment) =>
				(documentFragment.createDiv().innerHTML = html)
		);

	// Function to load the settings from data.json
	async loadSettings(): Promise<void> {
		try {
			const jsonData = loadGlobalSettings();
			console.log("The global setting i have loaded : ", jsonData);
			this.globalSettings = jsonData.data.globalSettings;
		} catch (err) {
			console.error("Error loading settings:", err);
		}
	}

	// Function to save settings back to data.json
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
		containerEl.addClass("TaskBoardSettingTab");

		await this.loadSettings();

		if (!this.globalSettings) {
			containerEl.createEl("p", { text: "Failed to load settings." });
			return;
		}

		const {
			firstDayOfWeek,
			scanFilters,
			taskCompletionFormat,
			taskCompletionDateTimePattern,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
			autoAddDue,
			scanVaultAtStartup,
			dayPlannerPlugin,
			realTimeScanning,
		} = this.globalSettings;

		containerEl.createEl("h1", {
			text: "Task Board",
			cls: "mainPluginTitle",
		});

		// Setting for taskCompletionFormat
		containerEl.createEl("h4", { text: "Filters for Scanning" });

		// CSS for proper layout
		const cssStyles = `
		.scan-filter-row {
			display: flex;
			align-items: center;
			margin-bottom: 10px;
		}
		.filter-label {
			width: 80px;
			font-weight: bold;
			color: #e74c3c;
		}
		.filter-input {
			flex-grow: 1;
			margin-right: 10px;
		}
		.filter-dropdown {
			width: 120px;
			text-align: center;
		}
	`;
		containerEl.createEl("style", { text: cssStyles });

		// Helper to add filter rows
		const addFilterRow = (
			label: string,
			filterType: keyof typeof scanFilters,
			polarity: number,
			values: string[]
		) => {
			const row = containerEl.createDiv({ cls: "scan-filter-row" });

			// Label
			row.createEl("span", { text: label, cls: "filter-label" });

			// Input for values
			const input = row.createEl("input", {
				type: "text",
				cls: "filter-input",
			});
			input.value = values.join(", ");
			input.addEventListener("change", async () => {
				this.globalSettings!.scanFilters[filterType].values =
					input.value.split(",").map((v) => v.trim());
					await this.saveSettings();
				});

			// Dropdown for polarity
			const dropdown = row.createEl("select", { cls: "filter-dropdown" });
			["Only Scan this", "Dont Scan this", "Disable"].forEach(
				(optionText, idx) => {
					const option = dropdown.createEl("option", {
						text: optionText,
					});
					option.value = (idx + 1).toString();
					if (idx + 1 === polarity) option.selected = true;
				}
			);
			dropdown.addEventListener("change", async () => {
				this.globalSettings!.scanFilters[filterType].polarity =
					parseInt(dropdown.value, 10);
				await this.saveSettings();
			});
		};

		// Files Row
		addFilterRow(
			"Files",
			"files",
			scanFilters.files.polarity,
			scanFilters.files.values
		);

		// Folders Row
		addFilterRow(
			"Folders",
			"folders",
			scanFilters.folders.polarity,
			scanFilters.folders.values
		);

		// Tags Row
		addFilterRow(
			"Tags",
			"tags",
			scanFilters.tags.polarity,
			scanFilters.tags.values
		);

		containerEl.createEl("hr");
		// Save settings and reflect changes
		// await this.saveSettings();

		// containerEl.createEl("h4", { text: "Time related settings" });

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

		containerEl.createEl("h4", { text: "Automation Settings" });
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
				toggle.setValue(scanVaultAtStartup).onChange(async (value) => {
					this.globalSettings!.scanVaultAtStartup = value;
					await this.saveSettings();
				})
			);

		// Setting to scan the modified file in realtime
		new Setting(containerEl)
			.setName("Real-Time Scanning")
			.setDesc(
				"This setting will scan the modified file every time some changes is made to any markdown file. This wont slow down the performance, but if it does, disbale this setting.\nDisabling this setting will scan the newly added task within 5 minutes and will render on the board."
			)
			.addToggle((toggle) =>
				toggle.setValue(realTimeScanning).onChange(async (value) => {
					this.globalSettings!.realTimeScanning = value;
					await this.saveSettings();
				})
			);

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(containerEl)
			.setName("Auto Add Due Date to Tasks")
			.setDesc(
				"When enabled, if you add a task using the Add New Task pop-up window, then today date will be added as Due date, if not Due date is entered."
			)
			.addToggle((toggle) =>
				toggle.setValue(autoAddDue).onChange(async (value) => {
					this.globalSettings!.autoAddDue = value;
					await this.saveSettings();
				})
			);

		containerEl.createEl("h4", { text: "Compatibility Settings" });
		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(containerEl)
			.setName("Day Planner Plugin Compatibility")
			.setDesc(
				"If you have installed Day Planner Plugin, this plugin enters the time at the start of the task body, instead in the metadata. After enabling this feature, the time will be shown according to the Day Planner plugin inside Markdown files, but in the Task Board, the time will be shown in the Task Footer."
			)
			.addToggle((toggle) =>
				toggle.setValue(dayPlannerPlugin).onChange(async (value) => {
					this.globalSettings!.dayPlannerPlugin = value;
					await this.saveSettings();
				})
			);

		// Seeting to take the format of Due and Completion values. And to take the date-Time format for the completion value.
		containerEl.createEl("h4", { text: "Due and Completion Formats" });

		// Show the Live format for both the tags, when the user will change the value of below dropDown.

		new Setting(containerEl)
			.setName("Compatible Plugin")
			.setDesc(
				"Different plugins have different format to give the Due and Completion tags in the task. Please select one and see the above format, if its compatible with your current setup."
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("1", "Default");
				dropdown.addOption("2", "Tasks Plugin");
				dropdown.addOption("3", "Dataview Plugine");
				dropdown.addOption("4", "Obsidian Native");

				dropdown.setValue(taskCompletionFormat as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.taskCompletionFormat = value;
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

		// It doesnt make sense to me why the user will want to give names to the default columns. Anyways, the user can delete the default columns and also can add new columns and give the names required.
		// containerEl.createEl("h4", { text: "Default Column Names" });

		// // Create settings for each default column name
		// for (const [key, value] of Object.entries(defaultColumnNames)) {
		// 	new Setting(containerEl)
		// 		.setName(`${key}`)
		// 		.setDesc(`Enter the name for the ${key} column`)
		// 		.addText((text) => {
		// 			const oldValue =
		// 				this.globalSettings!.defaultColumnNames[
		// 					key as keyof typeof defaultColumnNames
		// 				];
		// 			// console.log("Old Values of Columns names : ", oldValue);
		// 			// text.inputEl.setAttr("type", "string");
		// 			text.setPlaceholder(
		// 				`${oldValue ? oldValue : "Enter New Column Name"}`
		// 			);
		// 			// text.inputEl.value = value ? value.toString() : "";

		// 			text.setValue(value).onChange(async (newValue) => {
		// 				this.globalSettings!.defaultColumnNames[
		// 					key as keyof typeof defaultColumnNames
		// 				] = newValue;
		// 				await this.saveSettings();
		// 			});
		// 		});
		// }
	}
}
