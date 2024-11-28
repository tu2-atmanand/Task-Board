// /src/views/TaskBoardSettingConstructUI.ts

import { App, Setting, normalizePath, sanitizeHTMLToDom } from "obsidian";
import { buyMeCoffeeSVGIcon, kofiSVGIcon } from "src/types/Icons";
import { globalSettingsData, langCodes } from "src/interfaces/GlobalSettings";

import TaskBoard from "main";
import { t } from "src/utils/lang/helper";

export class SettingsManager {
	win: Window;
	app: App;
	plugin: TaskBoard;
	globalSettings: globalSettingsData | null = null;

	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.win = window;
	}

	private static createFragmentWithHTML = (html: string) =>
		sanitizeHTMLToDom(html);

	// Function to load the settings from data.json
	async loadSettings(): Promise<void> {
		try {
			const settingsData = this.plugin.settings.data.globalSettings;
			this.globalSettings = settingsData;
		} catch (err) {
			console.error("Error loading settings:", err);
		}
	}

	// Function to save settings back to data.json
	async saveSettings(): Promise<void> {
		if (!this.globalSettings) return;

		try {
			this.plugin.settings.data.globalSettings = this.globalSettings;
			this.plugin.saveSettings();
		} catch (err) {
			console.error("Error saving settings:", err);
		}
	}

	async constructUI(contentEl: HTMLElement, heading: string) {
		await this.loadSettings();

		if (!this.globalSettings) {
			contentEl.createEl("p", {
				text: t(72),
			});
			return;
		}

		const {
			lang,
			firstDayOfWeek,
			scanFilters,
			taskCompletionFormat,
			taskCompletionDateTimePattern,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
			dailyNotesPluginComp,
			dueDateFormat,
			autoAddDue,
			scanVaultAtStartup,
			dayPlannerPlugin,
			realTimeScanning,
			columnWidth,
			showHeader,
			showFooter,
			showVerticalScroll,
			tagColors,
		} = this.globalSettings;

		// contentEl.createEl("h1", {
		// 	text: heading,
		// 	cls: "TaskBoardSettingConstructUI-mainPluginTitle",
		// });

		contentEl
			.createEl("p", {
				text: t(73),
			})
			.createEl("a", {
				text: t(74),
				href: "https://tu2-atmanand.github.io/task-board-docs/index.html",
			});

		// Setting for taskCompletionFormat
		contentEl.createEl("h4", { text: t(75) });

		// Helper to add filter rows
		const addFilterRow = (
			label: string,
			filterType: keyof typeof scanFilters,
			polarity: number,
			values: string[],
			placeholder: string
		) => {
			const row = contentEl.createDiv({
				cls: "TaskBoardSettingConstructUI-scan-filter-row",
			});

			// Label
			row.createEl("span", {
				text: label,
				cls: "TaskBoardSettingConstructUI-filter-label",
			});

			// Input for values
			const input = row.createEl("input", {
				type: "text",
				cls: "TaskBoardSettingConstructUI-filter-input",
			});
			input.value = values.join(", ");
			input.addEventListener("change", async () => {
				this.globalSettings!.scanFilters[filterType].values =
					input.value.split(",").map((v) => normalizePath(v.trim()));
				await this.saveSettings();
			});
			input.placeholder = placeholder;

			// Dropdown for polarity
			const dropdown = row.createEl("select", {
				cls: "TaskBoardSettingConstructUI-filter-dropdown",
			});
			[t(76), t(77), t(78)].forEach((optionText, idx) => {
				const option = dropdown.createEl("option", {
					text: optionText,
				});
				option.value = (idx + 1).toString();
				if (idx + 1 === polarity) option.selected = true;
			});
			dropdown.addEventListener("change", async () => {
				this.globalSettings!.scanFilters[filterType].polarity =
					parseInt(dropdown.value, 10);
				await this.saveSettings();
			});
		};

		// Files Row
		addFilterRow(
			t(140),
			"files",
			scanFilters.files.polarity,
			scanFilters.files.values,
			"Personal Tasks.md, New folder/New file.md"
		);

		// Folders Row
		addFilterRow(
			t(141),
			"folders",
			scanFilters.folders.polarity,
			scanFilters.folders.values,
			"New Folder 1, New Folder 2, Parent Folder/child folder/New folder"
		);

		// Tags Row
		addFilterRow(
			t(142),
			"tags",
			scanFilters.tags.polarity,
			scanFilters.tags.values,
			"#Bug, #docs/🔥bug, #feature"
		);

		contentEl.createEl("hr");

		contentEl.createEl("h4", { text: t(79) });

		// // Setting for Plugin Language
		// new Setting(contentEl)
		// 	.setName(t(127))
		// 	.setDesc(t(128))
		// 	.addDropdown((dropdown) => {
		// 		// Dynamically add options from langCodes
		// 		Object.keys(langCodes).forEach((key) => {
		// 			dropdown.addOption(key, langCodes[key]); // key as value, langCodes[key] as label
		// 		});

		// 		// Set the initial value (assuming lang is the current selected language)
		// 		dropdown.setValue(lang as string);

		// 		// On dropdown value change, update the global settings
		// 		dropdown.onChange(async (value) => {
		// 			this.globalSettings!.lang = value;
		// 			await this.saveSettings();
		// 		});
		// 	});

		// Setting to show/Hide the Header of the task card
		new Setting(contentEl)
			.setName(t(80))
			.setDesc(t(81))
			.addToggle((toggle) =>
				toggle.setValue(showHeader).onChange(async (value) => {
					this.globalSettings!.showHeader = value;
					await this.saveSettings();
				})
			);

		// Setting to show/Hide the Footer of the task card
		new Setting(contentEl)
			.setName(t(82))
			.setDesc(t(83))
			.addToggle((toggle) =>
				toggle.setValue(showFooter).onChange(async (value) => {
					this.globalSettings!.showFooter = value;
					await this.saveSettings();
				})
			);

		// Setting to take the width of each Column in px.
		new Setting(contentEl)
			.setName(t(84))
			.setDesc(t(85))
			.addText((text) =>
				text
					.setValue(columnWidth)
					.onChange(async (value) => {
						this.globalSettings!.columnWidth = value;
						await this.saveSettings();
						updatePreview(); // Update the preview when the text pattern changes
					})
					.setPlaceholder("273px")
			);

		// Setting to show/Hide the Vertical ScrollBar of each Column
		new Setting(contentEl)
			.setName(t(86))
			.setDesc(t(87))
			.addToggle((toggle) =>
				toggle.setValue(showVerticalScroll).onChange(async (value) => {
					this.globalSettings!.showVerticalScroll = value;
					await this.saveSettings();
				})
			);

		// Tag Colors settings
		contentEl.createEl("h4", { text: t(88) });

		// If there are existing tag colors, show them
		const tagColorsContainer = contentEl.createDiv({
			cls: "tag-colors-container",
		});

		Object.entries(tagColors).forEach(([tagName, color]) => {
			// Create the preview element after adding inputs and buttons
			const previewElement = document.createElement("span");
			previewElement.className = "tag-color-preview";
			previewElement.textContent = tagName; // Show the tag name as text
			previewElement.style.color = color; // Set text color to 'newColor'
			previewElement.style.border = `1px solid ${color}`; // Set border with 'newColor'
			previewElement.style.borderRadius = "20px"; // Set border-radius
			previewElement.style.padding = "1px 10px"; // Add padding inside the border

			// Convert the color to 20% opacity for the background
			let rgbaColor = colorTo20PercentOpacity(color);
			previewElement.style.backgroundColor = rgbaColor; // Apply 20% opacity background color

			const tagSetting = new Setting(tagColorsContainer)
				.setName("")
				.setDesc("") // Setting an empty description to allow space for the custom preview
				.addText((text) => text.setValue(tagName).setDisabled(true)) // Tag name input
				.addText((text) =>
					text.setValue(color).onChange(async (newColor) => {
						this.globalSettings!.tagColors[tagName] = newColor;

						// Update the preview color dynamically
						const previewElement =
							tagSetting.settingEl.querySelector(
								".tag-color-preview"
							) as HTMLElement;
						if (previewElement) {
							previewElement.style.color = newColor;
							previewElement.style.border = `1px solid ${newColor}`;
							previewElement.style.backgroundColor =
								colorTo20PercentOpacity(newColor);
						}

						await this.saveSettings();
					})
				)
				.addButton((btn) =>
					btn.setButtonText(t(89)).onClick(async () => {
						delete this.globalSettings!.tagColors[tagName];
						tagSetting.settingEl.remove();
						await this.saveSettings();
					})
				);

			// Append the preview element to the tag setting container
			tagSetting.settingEl.prepend(previewElement);
		});

		const addTagColorButton = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText(t(90)).onClick(() => {
				const newTagSetting = new Setting(tagColorsContainer)
					.addText((text) =>
						text.setPlaceholder(t(91)).onChange(async (newTag) => {
							// if (!this.globalSettings!.tagColors[newTag]) {
							// 	this.globalSettings!.tagColors[newTag] = ""; // Set empty color initially
							// }
						})
					)
					.addColorPicker((picker) =>
						picker.onChange(async (hexColor) => {
							const tagName =
								newTagSetting.settingEl.querySelector(
									"input"
								)?.value;
							if (tagName) {
								this.globalSettings!.tagColors[tagName] =
									hexColor; // Save as hex initially
								await this.saveSettings();
							}
						})
					)
					.addText((alphaText) =>
						alphaText
							.setPlaceholder("Alpha (0-1)")
							.onChange(async (alpha) => {
								const tagName =
									newTagSetting.settingEl.querySelector(
										"input"
									)?.value;
								if (tagName) {
									const hexColor =
										this.globalSettings!.tagColors[tagName];
									const rgbaColor = hexToHexAlpha(
										hexColor,
										parseFloat(alpha)
									); // Convert hex to RGBA with alpha
									this.globalSettings!.tagColors[tagName] =
										rgbaColor;
									await this.saveSettings();
								}
							})
					);
			})
		);

		contentEl.createEl("h4", { text: t(92) });
		// Setting to scan the modified file in realtime
		new Setting(contentEl)
			.setName(t(93))
			.setDesc(t(94))
			.addToggle((toggle) =>
				toggle.setValue(realTimeScanning).onChange(async (value) => {
					this.globalSettings!.realTimeScanning = value;
					await this.saveSettings();
				})
			);

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName(t(95))
			.setDesc(t(96))
			.addToggle((toggle) =>
				toggle.setValue(autoAddDue).onChange(async (value) => {
					this.globalSettings!.autoAddDue = value;
					await this.saveSettings();
				})
			);

		// Setting to Scan the whole Vault to detect all tasks and re-write the tasks.json
		new Setting(contentEl)
			.setName(t(97))
			.setDesc(
				SettingsManager.createFragmentWithHTML(
					t(98) + "<br/>" + "<b>NOTE :</b>" + t(99)
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(scanVaultAtStartup).onChange(async (value) => {
					this.globalSettings!.scanVaultAtStartup = value;
					await this.saveSettings();
				})
			);

		contentEl.createEl("h4", { text: t(100) });
		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName("Day Planner " + t(101))
			.setDesc(t(102))
			.addToggle((toggle) =>
				toggle.setValue(dayPlannerPlugin).onChange(async (value) => {
					this.globalSettings!.dayPlannerPlugin = value;
					await this.saveSettings();
				})
			);

		// Setting for Auto Adding Due Date from the Daily Notes file name.
		new Setting(contentEl)
			.setName(t(149) + t(101))
			.setDesc(t(103))
			.addToggle((toggle) =>
				toggle
					.setValue(dailyNotesPluginComp)
					.onChange(async (value) => {
						this.globalSettings!.dailyNotesPluginComp = value;
						await this.saveSettings();
					})
			);

		// Text input for the dueDateFormat
		new Setting(contentEl)
			.setName(t(104))
			.setDesc(t(105))
			.addText((text) =>
				text
					.setValue(dueDateFormat)
					.onChange(async (value) => {
						this.globalSettings!.dueDateFormat = value;
						await this.saveSettings();
						updatePreview(); // Update the preview when the text pattern changes
					})
					.setPlaceholder("yyyy-MM-DD")
			);

		// Seeting to take the format of Due and Completion values. And to take the date-Time format for the completion value.
		contentEl.createEl("h4", {
			text: t(106),
		});

		// Create the live preview element
		const previewEl = contentEl.createDiv({
			cls: "global-setting-tab-live-preview",
		});
		const previewLabel = previewEl.createDiv({
			cls: "global-setting-tab-live-preview-label",
		});
		previewLabel.setText(t(150));

		const previewData = previewEl.createDiv({
			cls: "global-setting-tab-live-preview-data",
		});
		const updatePreview = () => {
			let taskTitle = "<" + t(151) + ">";
			let priority = "⏫";
			let time = "10:00 - 11:00";
			let dueDate = "2024-09-21";
			let tags = `#tag #test`;
			let completionDate = "2024-09-21/12:20:33";

			let preview = "";
			switch (this.globalSettings!.taskCompletionFormat) {
				// Default
				case "1": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${time} ${taskTitle} | ${priority} 📅[${dueDate}] ${tags} ✅[${completionDate}]`;
					} else {
						preview = `- [x] ${taskTitle} | ${priority} ⏰[${time}] 📅[${dueDate}] ${tags} ✅[${completionDate}]`;
					}
					break;
				}
				// Tasks Plugin
				case "2": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${taskTitle} | ${priority} 📅 ${dueDate} ${tags} ✅ ${
							completionDate.split("/")[0]
						}`;
					} else {
						preview = `- [x] ${time} ${taskTitle} | ${priority} 📅 ${dueDate} ${tags} ✅ ${
							completionDate.split("/")[0]
						}`;
					}
					break;
				}
				// Dataview Plugin
				case "3": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${taskTitle} | [priority:: 2] [due:: ${dueDate}] ${tags} [completion:: ${completionDate}]`;
					} else {
						preview = `- [x] ${time} ${taskTitle} | [priority:: 2] [due:: ${dueDate}] ${tags} [completion:: ${completionDate}]`;
					}
					break;
				}
				// Obsidian Native
				case "4": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${taskTitle} | @priority(2) @due(${dueDate}) ${tags} @completion(${completionDate})`;
					} else {
						preview = `- [x] ${time} ${taskTitle} | @priority(2) @due(${dueDate}) ${tags} @completion(${completionDate})`;
					}
					break;
				}
			}
			previewData.setText(preview);
		};

		// Setting for Due and Completion Date-Time pattern format
		new Setting(contentEl)
			.setName(t(108))
			.setDesc(t(109))
			.addDropdown((dropdown) => {
				dropdown.addOption("1", t(110));
				dropdown.addOption("2", "Tasks " + t(143));
				dropdown.addOption("3", "Dataview " + t(143));
				dropdown.addOption("4", "Obsidian " + t(144));

				dropdown.setValue(taskCompletionFormat as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.taskCompletionFormat = value;
					await this.saveSettings();
					updatePreview();
				});
			});

		// Text input for the taskCompletionDateTimePattern
		new Setting(contentEl)
			.setName(t(111))
			.setDesc(t(112))
			.addText((text) =>
				text
					.setValue(taskCompletionDateTimePattern)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionDateTimePattern =
							value;
						await this.saveSettings();
						updatePreview(); // Update the preview when the text pattern changes
					})
					.setPlaceholder("yyyy-MM-DD/HH:mm")
			);

		// Initialize the preview on page load
		updatePreview();

		// Setting for firstDayOfWeek
		new Setting(contentEl)
			.setName(t(113))
			.setDesc(t(114))
			// .addText((text) =>
			// 	text.setValue(firstDayOfWeek).onChange(async (value) => {
			// 		this.globalSettings!.firstDayOfWeek = value;
			// 		await this.saveSettings();
			// 	})
			// );
			.addDropdown((dropdown) => {
				dropdown.addOption("1", t(115));
				dropdown.addOption("2", t(116));
				dropdown.addOption("3", t(117));
				dropdown.addOption("4", t(118));
				dropdown.addOption("5", t(119));
				dropdown.addOption("6", t(120));
				dropdown.addOption("7", t(121));

				dropdown.setValue(firstDayOfWeek as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.firstDayOfWeek = value;
					await this.saveSettings();
				});
			});

		// Setting for taskCompletionInLocalTime
		new Setting(contentEl)
			.setName(t(122))
			.setDesc(t(123))
			.addToggle((toggle) =>
				toggle
					.setValue(taskCompletionInLocalTime)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionInLocalTime = value;
						await this.saveSettings();
					})
			);

		// Setting for taskCompletionShowUtcOffset
		new Setting(contentEl)
			.setName(t(124))
			.setDesc(t(125))
			.addToggle((toggle) =>
				toggle
					.setValue(taskCompletionShowUtcOffset)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionShowUtcOffset =
							value;
						await this.saveSettings();
					})
			);

		contentEl.createEl("hr");

		const footerSection = contentEl.createEl("div", {
			cls: "settingTabFooterSection",
		});

		const footerText = createEl("p");
		footerText.appendText(t(126));

		footerSection.appendChild(footerText);

		const parser = new DOMParser();

		const donationSection = createEl("div", {
			cls: "settingTabFooterDonationsSec",
		});
		donationSection.appendChild(
			paypalButton("https://paypal.me/tu2atmanand")
		);
		donationSection.appendChild(
			buyMeACoffeeButton(
				"https://www.buymeacoffee.com/tu2_atmanand",
				parser.parseFromString(buyMeCoffeeSVGIcon, "text/xml")
					.documentElement
			)
		);
		donationSection.appendChild(
			kofiButton(
				"https://ko-fi.com/atmanandgauns",
				parser.parseFromString(kofiSVGIcon, 'text/xml').documentElement,
			)
		);

		footerSection.appendChild(donationSection);
	}

	cleanUp() {
		// Clear the content of contentEl (if set)
		// if (this.contentEl) {
		// 	this.contentEl.empty(); // Empty the contentEl to remove all child elements
		// }

		// Reset global settings if necessary
		this.globalSettings = null;
	}
}

const paypalButton = (link: string): HTMLElement => {
	const a = createEl("a", {
		href: link,
		cls: "buymeacoffee-tu2-atmanand-img",
	});
	const svg = createSvg("svg", {
		attr: {
			xmlns: "http://www.w3.org/2000/svg",
			width: "150",
			height: "40",
		},
	});
	// Append `path` elements to `svg`
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#253B80",
				d: "M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z",
			},
		})
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#179BD7",
				d: "M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z",
			},
		})
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#253B80",
				d: "M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c3.114 0 5.263.648 6.385 1.927.526.6.861 1.227 1.023 1.917.17.724.173 1.589.007 2.644l-.012.077v.676l.526.298a3.69 3.69 0 0 1 1.065.812c.45.513.741 1.165.864 1.938.127.795.085 1.741-.123 2.812-.24 1.232-.628 2.305-1.152 3.183a6.547 6.547 0 0 1-1.825 2c-.696.494-1.523.869-2.458 1.109-.906.236-1.939.355-3.072.355h-.73c-.522 0-1.029.188-1.427.525a2.21 2.21 0 0 0-.744 1.328l-.055.299-.924 5.855-.042.215c-.011.068-.03.102-.058.125a.155.155 0 0 1-.096.035H7.266z",
			},
		})
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#179BD7",
				d: "M23.048 7.667c-.028.179-.06.362-.096.55-1.237 6.351-5.469 8.545-10.874 8.545H9.326c-.661 0-1.218.48-1.321 1.132L6.596 26.83l-.399 2.533a.704.704 0 0 0 .695.814h4.881c.578 0 1.069-.42 1.16-.99l.048-.248.919-5.832.059-.32c.09-.572.582-.992 1.16-.992h.73c4.729 0 8.431-1.92 9.513-7.476.452-2.321.218-4.259-.978-5.622a4.667 4.667 0 0 0-1.336-1.03z",
			},
		})
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#222D65",
				d: "M21.754 7.151a9.757 9.757 0 0 0-1.203-.267 15.284 15.284 0 0 0-2.426-.177h-7.352a1.172 1.172 0 0 0-1.159.992L8.05 17.605l-.045.289a1.336 1.336 0 0 1 1.321-1.132h2.752c5.405 0 9.637-2.195 10.874-8.545.037-.188.068-.371.096-.55a6.594 6.594 0 0 0-1.017-.429 9.045 9.045 0 0 0-.277-.087z",
			},
		})
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#253B80",
				d: "M9.614 7.699a1.169 1.169 0 0 1 1.159-.991h7.352c.871 0 1.684.057 2.426.177a9.757 9.757 0 0 1 1.481.353c.365.121.704.264 1.017.429.368-2.347-.003-3.945-1.272-5.392C20.378.682 17.853 0 14.622 0h-9.38c-.66 0-1.223.48-1.325 1.133L.01 25.898a.806.806 0 0 0 .795.932h5.791l1.454-9.225 1.564-9.906z",
			},
		})
	);

	a.appendChild(svg);
	return a;
};

// const buyMeACoffeeButton = (link: string): HTMLElement => {
// 	const a = createEl("a", {
// 		href: link,
// 		cls: "buymeacoffee-tu2-atmanand-img",
// 	});
// 	const img = createEl("img", {
// 		attr: {
// 			src: "https://img.buymeacoffee.com/button-api/?text=Buy me a book&emoji=📖&slug=tu2_atmanand&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00",
// 		},
// 	});
// 	a.appendChild(img);
// 	return a;
// };

const buyMeACoffeeButton = (link: string, img: HTMLElement): HTMLElement => {
	const a = document.createElement("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-tu2-atmanand-img");
	a.appendChild(img);
	return a;
};

// const kofiButton = (link: string): HTMLElement => {
// 	const a = createEl("a", {
// 		href: link,
// 		cls: "buymeacoffee-tu2-atmanand-img",
// 	});
// 	const img = createEl("img", {
// 		attr: {
// 			src: "https://raw.githubusercontent.com/tu2-atmanand/Task-Board/main/assets/kofi_color.svg",
// 			height: "40",
// 		},
// 	});
// 	a.appendChild(img);
// 	return a;
// };

const kofiButton = (link: string, img: HTMLElement): HTMLElement => {
	const a = document.createElement("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-tu2-atmanand-img");
	a.appendChild(img);
	return a;
};

// Utility to convert hex to RGBA with specific opacity
function hexToRgba(hex: string, opacity: number): string {
	let r = 0,
		g = 0,
		b = 0;

	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else if (hex.length === 7 || hex.length === 9) {
		r = parseInt(hex[1] + hex[2], 16);
		g = parseInt(hex[3] + hex[4], 16);
		b = parseInt(hex[5] + hex[6], 16);
	}

	return `rgba(${r},${g},${b},${opacity})`;
}

// Convert hex color to hex with Alpha
function hexToHexAlpha(hex: string, alpha: number = 1): string {
	hex = hex.slice(0, 7);
	const alphaHex = Math.floor(alpha * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${alphaHex}`;
}

// Function to convert RGBA/Hex color to 20% opacity background color
function colorTo20PercentOpacity(color: string): string {
	if (color.startsWith("#")) {
		return hexToRgba(color, 0.1);
	}
	return color; // If it's already RGBA, return the same color
}
