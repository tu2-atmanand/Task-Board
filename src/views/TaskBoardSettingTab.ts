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

		// Create the live preview element
		const previewEl = containerEl.createEl("div", {
			text: "Preview will appear here",
			cls: "live-preview",
		});
		const updatePreview = () => {
			let dueDate = "2024-09-21";
			let completionDate = "2024-09-21T12:20:33";
			let taskTitle = "<Task Title>";

			let preview = `- [ ] ${taskTitle} | `;
			switch (this.globalSettings!.taskCompletionFormat) {
				case "1": // Default
					preview += `📅 ${dueDate} ✅ ${completionDate}`;
					break;
				case "2": // Tasks Plugin
					preview += `📅 ${dueDate} ✅ ${
						completionDate.split("T")[0]
					}`; // Only date
					break;
				case "3": // Dataview Plugin
					preview += `[due:: ${dueDate}] [completion:: ${completionDate}]`;
					break;
				case "4": // Obsidian Native
					preview += `@Due(${dueDate}) @completion(${completionDate})`;
					break;
			}
			previewEl.setText(preview);
		};

		// Setting for Due and Completion Date-Time pattern format
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
					updatePreview();
				});
			});

		// Text input for the taskCompletionDateTimePattern
		new Setting(containerEl)
			.setName("Task Completion Date-Time Pattern")
			.setDesc(
				"Enter the pattern of the Date-Time which you would like to see for the Completion value. Eg. yyyy-MM-ddTHH:mm:ss"
			)
			.addText((text) =>
				text
					.setValue(taskCompletionDateTimePattern)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionDateTimePattern =
							value;
						await this.saveSettings();
						updatePreview(); // Update the preview when the text pattern changes
					})
			);

		// Initialize the preview on page load
		updatePreview();

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

		containerEl.createEl("hr");

		const footerSection = containerEl.createEl("div", {
			cls: "settingTabFooterSection",
		});

		const footerText = createEl("p");
		footerText.appendText(
			"If you like this Plugin, do consider supporting my work by making a small donation for contineued better improvement of the idea!"
		);

		footerSection.appendChild(footerText);

		const donationSection = createEl("div", {
			cls: "settingTabFooterDonationsSec",
		});
		donationSection.appendChild(
			paypalButton("https://paypal.me/tu2atmanand")
		);
		donationSection.appendChild(
			buyMeACoffeeButton("https://www.buymeacoffee.com/tu2_atmanand")
		);
		donationSection.appendChild(
			kofiButton("https://ko-fi.com/atmanandgauns")
		);

		footerSection.appendChild(donationSection);
	}
}

const buyMeACoffeeButton = (link: string): HTMLElement => {
	const a = createEl("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-chetachi-img");
	a.innerHTML = `<img src="https://img.buymeacoffee.com/button-api/?text=Buy me a book&emoji=📖&slug=tu2_atmanand&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00"> `;
	return a;
};

const paypalButton = (link: string): HTMLElement => {
	const a = createEl("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-chetachi-img");
	a.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40">
  <path fill="#253B80" d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z"></path>
  <path fill="#179BD7" d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z"></path>
  <path fill="#253B80" d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c3.114 0 5.263.648 6.385 1.927.526.6.861 1.227 1.023 1.917.17.724.173 1.589.007 2.644l-.012.077v.676l.526.298a3.69 3.69 0 0 1 1.065.812c.45.513.741 1.165.864 1.938.127.795.085 1.741-.123 2.812-.24 1.232-.628 2.305-1.152 3.183a6.547 6.547 0 0 1-1.825 2c-.696.494-1.523.869-2.458 1.109-.906.236-1.939.355-3.072.355h-.73c-.522 0-1.029.188-1.427.525a2.21 2.21 0 0 0-.744 1.328l-.055.299-.924 5.855-.042.215c-.011.068-.03.102-.058.125a.155.155 0 0 1-.096.035H7.266z"></path>
  <path fill="#179BD7" d="M23.048 7.667c-.028.179-.06.362-.096.55-1.237 6.351-5.469 8.545-10.874 8.545H9.326c-.661 0-1.218.48-1.321 1.132L6.596 26.83l-.399 2.533a.704.704 0 0 0 .695.814h4.881c.578 0 1.069-.42 1.16-.99l.048-.248.919-5.832.059-.32c.09-.572.582-.992 1.16-.992h.73c4.729 0 8.431-1.92 9.513-7.476.452-2.321.218-4.259-.978-5.622a4.667 4.667 0 0 0-1.336-1.03z"></path>
  <path fill="#222D65" d="M21.754 7.151a9.757 9.757 0 0 0-1.203-.267 15.284 15.284 0 0 0-2.426-.177h-7.352a1.172 1.172 0 0 0-1.159.992L8.05 17.605l-.045.289a1.336 1.336 0 0 1 1.321-1.132h2.752c5.405 0 9.637-2.195 10.874-8.545.037-.188.068-.371.096-.55a6.594 6.594 0 0 0-1.017-.429 9.045 9.045 0 0 0-.277-.087z"></path>
  <path fill="#253B80" d="M9.614 7.699a1.169 1.169 0 0 1 1.159-.991h7.352c.871 0 1.684.057 2.426.177a9.757 9.757 0 0 1 1.481.353c.365.121.704.264 1.017.429.368-2.347-.003-3.945-1.272-5.392C20.378.682 17.853 0 14.622 0h-9.38c-.66 0-1.223.48-1.325 1.133L.01 25.898a.806.806 0 0 0 .795.932h5.791l1.454-9.225 1.564-9.906z"></path>
  </svg>`;
	return a;
};

const kofiButton = (link: string): HTMLElement => {
	const a = createEl("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-chetachi-img");
	a.innerHTML = `<img src="https://raw.githubusercontent.com/tu2-atmanand/Task-Board/main/assets/kofi_color.svg" height="40">`;
	return a;
};
