// /src/views/TaskBoardSettingConstructUI.ts

import { App, Setting, normalizePath, sanitizeHTMLToDom } from "obsidian";
import {
	EditButtonMode,
	TagColorType,
	globalSettingsData,
} from "src/interfaces/GlobalSettings";
import { buyMeCoffeeSVGIcon, kofiSVGIcon } from "src/types/Icons";
import Pickr from "@simonwep/pickr";
import Sortable from "sortablejs";
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
				text: t("falied-to-load-settings"),
			});
			return;
		}

		// Create Tab Bar
		const tabBar = contentEl.createDiv({
			cls: "taskBoard-settings-tab-bar",
		});
		const tabContent = contentEl.createDiv({
			cls: "taskBoard-settings-tab-content",
		});

		const tabs: { [key: string]: HTMLElement } = {};
		const sections: Record<string, () => void> = {};
		[
			{
				key: t("general"),
				handler: () => this.renderGeneralTabSettings(tabContent),
			},
			{
				key: t("board-ui"),
				handler: () => this.renderBoardUISettings(tabContent),
			},
			{
				key: t("automation"),
				handler: () => this.renderAutomationSettings(tabContent),
			},
			{
				key: t("formats"),
				handler: () => this.renderFormatsSettings(tabContent),
			},
		].forEach(({ key, handler }) => {
			sections[key] = handler;
		});

		// Create tabs and attach click listeners
		Object.keys(sections).forEach((tabName) => {
			const tabButton = tabBar.createEl("div", {
				text: tabName,
				cls: "taskBoard-settings-tab-button",
			});

			tabButton.addEventListener("click", () => {
				// Highlight selected tab
				Array.from(tabBar.children).forEach((child) =>
					child.toggleClass(
						"taskBoard-settings-tab-button-active",
						child === tabButton
					)
				);

				// Clear and render the appropriate content
				tabContent.empty();
				sections[tabName]();
			});

			tabs[tabName] = tabButton;
		});

		contentEl.createEl("hr");

		// Set the default tab
		const defaultTab = Object.keys(sections)[0];
		tabs[defaultTab].click();

		contentEl
			.createEl("p", {
				text: t(
					"please-read-the-documentation-to-make-an-efficient-use-of-this-plugin"
				),
				cls: "taskBoard-docs-section",
			})
			.createEl("a", {
				text: t("task-board-docs"),
				href: "https://tu2-atmanand.github.io/task-board-docs/",
			});
	}

	cleanUp() {
		// Clear the content of contentEl (if set)
		// if (this.contentEl) {
		// 	this.contentEl.empty(); // Empty the contentEl to remove all child elements
		// }

		// Reset global settings if necessary
		this.globalSettings = null;
	}

	// Function to render the "Filters for scanning" tab content
	private renderGeneralTabSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("general-settings-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const { scanFilters, showHeader, openOnStartup } = this.globalSettings!;

		// Setting to show/Hide the Header of the task card
		new Setting(contentEl)
			.setName(t("open-board-on-obsidian-startup"))
			.setDesc(t("open-board-on-obsidian-startup-info"))
			.addToggle((toggle) =>
				toggle.setValue(openOnStartup).onChange(async (value) => {
					this.globalSettings!.openOnStartup = value;
					await this.saveSettings();
				})
			);

		// Setting to show/Hide the Header of the task card
		new Setting(contentEl)
			.setName(t("filters-for-scanning"))
			.setDesc(t("name-of-the-file-folder-tag-for-filter-info"));

		// Helper to add filter rows
		const addFilterRow = (
			label: string,
			filterType: keyof typeof scanFilters,
			polarity: number,
			values: string[],
			placeholder: string
		) => {
			const row = contentEl.createDiv({
				cls: "taskBoard-filter-row",
			});

			// Label
			row.createEl("span", {
				text: label,
				cls: "taskBoard-filter-label",
			});

			// Input for values
			const input = row.createEl("input", {
				type: "text",
				cls: "taskBoard-filter-input",
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
				cls: "taskBoard-filter-dropdown",
			});
			[t("only-scan-this"), t("dont-scan-this"), t("disable")].forEach(
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
			t("files"),
			"files",
			scanFilters.files.polarity,
			scanFilters.files.values,
			"Personal.md, FolderName/New_file.md"
		);

		// Folders Row
		addFilterRow(
			t("folders"),
			"folders",
			scanFilters.folders.polarity,
			scanFilters.folders.values,
			"Folder_Name 1, Folder_Name 2, Parent_Folder/child_folder/New_folder"
		);

		// Tags Row
		addFilterRow(
			t("tags"),
			"tags",
			scanFilters.tags.polarity,
			scanFilters.tags.values,
			"#Bug, #docs/🔥bug, #feature"
		);

		contentEl.createEl("hr");

		const footerSection = contentEl.createEl("div", {
			cls: "settingTabFooterSection",
		});

		footerSection
			.createEl("p", {
				text: t("this-plugin-is-created-by"),
			})
			.createEl("a", {
				text: "Atmanand Gauns",
				href: "https://www.github.com/tu2-atmanand",
			});

		const footerText = createEl("p");
		footerText.appendText(t("donation-message"));

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
				parser.parseFromString(kofiSVGIcon, "text/xml").documentElement
			)
		);

		footerSection.appendChild(donationSection);
	}

	// Function to render "Board UI settings" tab content
	private renderBoardUISettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("board-ui-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		// // Setting for Plugin Language
		// new Setting(contentEl)
		// 	.setName(t("plugin-language"))
		// 	.setDesc(t("plugin-language-info"))
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

		const {
			showHeader,
			showFooter,
			columnWidth,
			showVerticalScroll,
			tagColors,
			tagColorsType,
			showTaskWithoutMetadata,
		} = this.globalSettings!;

		// Setting to show/Hide the Header of the task card
		new Setting(contentEl)
			.setName(t("show-header-of-the-task-card"))
			.setDesc(t("enable-this-to-see-the-header-in-the-task-card"))
			.addToggle((toggle) =>
				toggle.setValue(showHeader).onChange(async (value) => {
					this.globalSettings!.showHeader = value;
					await this.saveSettings();
				})
			);

		// Setting to show/Hide the Footer of the task card
		new Setting(contentEl)
			.setName(t("show-footer-of-the-task-card"))
			.setDesc(t("enable-this-to-see-the-footer-in-the-task-card"))
			.addToggle((toggle) =>
				toggle.setValue(showFooter).onChange(async (value) => {
					this.globalSettings!.showFooter = value;
					await this.saveSettings();
				})
			);

		// Setting to show/Hide the Footer of the task card
		new Setting(contentEl)
			.setName(t("show-task-without-metadata"))
			.setDesc(t("show-task-without-metadata-info"))
			.addToggle((toggle) =>
				toggle
					.setValue(showTaskWithoutMetadata)
					.onChange(async (value) => {
						this.globalSettings!.showTaskWithoutMetadata = value;
						await this.saveSettings();
					})
			);

		// Setting to take the width of each Column in px.
		new Setting(contentEl)
			.setName(t("width-of-each-column"))
			.setDesc(t("enter-the-value-of-width-for-each-column"))
			.addText((text) =>
				text
					.setValue(columnWidth)
					.onChange(async (value) => {
						this.globalSettings!.columnWidth = value;
						await this.saveSettings();
					})
					.setPlaceholder("273px")
			);

		// Setting to show/Hide the Vertical ScrollBar of each Column
		new Setting(contentEl)
			.setName(t("show-column-scroll-bar"))
			.setDesc(t("enable-to-see-a-scrollbar-for-each-column"))
			.addToggle((toggle) =>
				toggle.setValue(showVerticalScroll).onChange(async (value) => {
					this.globalSettings!.showVerticalScroll = value;
					await this.saveSettings();
				})
			);

		// Tag Colors settings
		// Setting to show/Hide the Header of the task card
		new Setting(contentEl)
			.setName(t("tag-colors"))
			.setDesc(t("tag-colors-info"));

		new Setting(contentEl)
			.setName(t("tag-color-indicator-type"))
			.setDesc(t("tag-color-indicator-type-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[TagColorType.Text]: t("text-of-the-tag"),
						[TagColorType.Background]: t("background-of-the-card"),
					})
					.setValue(tagColorsType)
					.onChange(async (value) => {
						this.globalSettings!.tagColorsType =
							value as TagColorType;
						await this.plugin.saveSettings();
						renderTagColors();
					})
			);

		const tagColorsContainer = contentEl.createDiv({
			cls: "tag-colors-container",
		});

		// Initialize Sortable.js
		Sortable.create(tagColorsContainer, {
			animation: 150,
			ghostClass: "task-board-sortable-ghost",
			chosenClass: "task-board-sortable-chosen",
			dragClass: "task-board-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-board-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: async () => {
				const newOrder = Array.from(tagColorsContainer.children)
					.map((child, index) => {
						const tagName = child.getAttribute("data-tag-name");
						const tag = tagColors.find((t) => t.name === tagName);
						if (tag) {
							tag.priority = index + 1;
							return tag;
						}
						return null;
					})
					.filter(
						(
							tag
						): tag is {
							name: string;
							color: string;
							priority: number;
						} => tag !== null
					);

				this.globalSettings!.tagColors = newOrder;
				await this.saveSettings();
			},
		});

		const renderTagColors = () => {
			tagColorsContainer.empty(); // Clear existing rendered rows

			this.globalSettings!.tagColors.sort(
				(a, b) => a.priority - b.priority
			).forEach((tag, index) => {
				const row = tagColorsContainer.createDiv({
					cls: "tag-color-row",
					attr: { "data-tag-name": tag.name },
				});
				let colorInputRef: any;

				new Setting(row)
					.setClass("tag-color-row-element")
					.addButton((drag) =>
						drag
							.setTooltip("Hold and drag")
							.setIcon("grip-horizontal")
							.buttonEl.setCssStyles({
								cursor: "grab",
								backgroundColor:
									this.globalSettings!.tagColorsType ===
									TagColorType.Background
										? tag.color
										: "",
								color:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? tag.color
										: "",
								border:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? `1px solid ${tag.color}`
										: "",
							})
					)
					.addText((text) =>
						text
							.setPlaceholder("Tag Name")
							.setValue(tag.name)
							.onChange(async (value) => {
								tag.name = value;
								row.setAttribute("data-tag-name", value);
								await this.saveSettings();
							})
							.inputEl.setCssStyles({
								backgroundColor:
									this.globalSettings!.tagColorsType ===
									TagColorType.Background
										? tag.color
										: "",
								color:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? tag.color
										: "",
								border:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? `1px solid ${tag.color}`
										: "",
							})
					)
					.addButton((btn) => {
						const pickr = new Pickr({
							el: btn.buttonEl,
							theme: "nano",
							default: tag.color || "#ff0000",
							components: {
								preview: true,
								opacity: true,
								hue: true,
								interaction: {
									rgba: true,
									input: true,
									clear: true,
									cancel: true,
									save: false,
								},
							},
						});
						console.log("tagColorType", tagColorsType);

						pickr
							.on("change", (color: any) => {
								const rgbaColor = `rgba(${color
									.toRGBA()
									.map((v: number, i: number) =>
										i < 3 ? Math.round(v) : v
									)
									.join(", ")})`;
								tag.color = rgbaColor;
								colorInputRef.setValue(rgbaColor);
								// row.style.backgroundColor = rgbaColor;
							})
							.on("hide", () => {
								renderTagColors();
								this.saveSettings();
							})
							.on("cancel", () => pickr.hide())
							.on("clear", () => pickr.hide());
					})
					.addText((colorInput) => {
						colorInputRef = colorInput;
						colorInput
							.setPlaceholder("Color Value")
							.setValue(tag.color)
							.onChange(async (newColor) => {
								tag.color = newColor;
								await this.saveSettings();
							})
							.inputEl.setCssStyles({
								backgroundColor:
									this.globalSettings!.tagColorsType ===
									TagColorType.Background
										? tag.color
										: "",
								color:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? tag.color
										: "",
								border:
									this.globalSettings!.tagColorsType ===
									TagColorType.Text
										? `1px solid ${tag.color}`
										: "",
							});
					})
					.addButton((del) =>
						del
							.setButtonText("Delete")
							.setIcon("trash")
							.setCta()
							.onClick(async () => {
								this.globalSettings!.tagColors.splice(index, 1);
								await this.saveSettings();
								renderTagColors(); // Re-render after delete
							})
					);
			});
		};

		// Initial render
		renderTagColors();

		// Add "Add New Tag Color" button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("add-tag-color"))
				.setCta()
				.onClick(async () => {
					const newTag = {
						name: "",
						color: "rgba(255, 0, 0, 1)",
						priority: this.globalSettings!.tagColors.length + 1,
					};
					this.globalSettings!.tagColors.push(newTag);
					await this.saveSettings();
					renderTagColors();
				})
		);
	}

	// Function to render "Automation" tab content
	private renderAutomationSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("automation-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const {
			realTimeScanning,
			autoAddDue,
			scanVaultAtStartup,
			dayPlannerPlugin,
			dailyNotesPluginComp,
			editButtonAction,
		} = this.globalSettings!;

		new Setting(contentEl)
			.setName(t("edit-button-mode"))
			.setDesc(t("edit-button-mode-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[EditButtonMode.PopUp]: t(
							"use-edit-task-window-feature"
						),
						[EditButtonMode.NoteInTab]: t("open-note-in-new-tab"),
						[EditButtonMode.NoteInSplit]: t(
							"open-note-in-right-split"
						),
						[EditButtonMode.NoteInWindow]: t(
							"open-note-in-new-window"
						),
						[EditButtonMode.NoteInHover]: t(
							"open-note-in-hover-preview"
						),
					})
					.setValue(this.globalSettings!.editButtonAction)
					.onChange(async (value) => {
						this.globalSettings!.editButtonAction =
							value as EditButtonMode;
						await this.plugin.saveSettings();
					})
			);

		// Setting to scan the modified file in realtime
		new Setting(contentEl)
			.setName(t("real-time-scanning"))
			.setDesc(t("real-time-scanning-info"))
			.addToggle((toggle) =>
				toggle.setValue(realTimeScanning).onChange(async (value) => {
					this.globalSettings!.realTimeScanning = value;
					await this.saveSettings();
				})
			);

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName(t("auto-add-due-date-to-tasks"))
			.setDesc(t("auto-add-due-date-to-tasks-info"))
			.addToggle((toggle) =>
				toggle.setValue(autoAddDue).onChange(async (value) => {
					this.globalSettings!.autoAddDue = value;
					await this.saveSettings();
				})
			);

		// Setting to Scan the whole Vault to detect all tasks and re-write the tasks.json
		new Setting(contentEl)
			.setName(t("auto-scan-the-vault-on-obsidian-startup"))
			.setDesc(
				SettingsManager.createFragmentWithHTML(
					t("auto-scan-the-vault-on-obsidian-startup-info") +
						"<br/>" +
						"<b>" +
						t("note") +
						" :</b>" +
						t("auto-scan-the-vault-on-obsidian-startup-info-2")
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(scanVaultAtStartup).onChange(async (value) => {
					this.globalSettings!.scanVaultAtStartup = value;
					await this.saveSettings();
				})
			);

		// contentEl.createEl("h4", { text: t("compatible-plugins") });
		new Setting(contentEl).setName(t("compatible-plugins")).setHeading();
		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName("Day Planner " + t("plugin-compatibility"))
			.setDesc(t("day-planner-plugin-compatibility"))
			.addToggle((toggle) =>
				toggle.setValue(dayPlannerPlugin).onChange(async (value) => {
					this.globalSettings!.dayPlannerPlugin = value;
					await this.saveSettings();
				})
			);

		// Setting for Auto Adding Due Date from the Daily Notes file name.
		new Setting(contentEl)
			.setName(t("daily-notes") + t("plugin-compatibility"))
			.setDesc(t("daily-notes-plugin-compatibility"))
			.addToggle((toggle) =>
				toggle
					.setValue(dailyNotesPluginComp)
					.onChange(async (value) => {
						this.globalSettings!.dailyNotesPluginComp = value;
						await this.saveSettings();
					})
			);
	}

	// Function to render "Task formats" tab content
	private renderFormatsSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("format-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const {
			dueDateFormat,
			taskCompletionFormat,
			taskCompletionDateTimePattern,
			firstDayOfWeek,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
		} = this.globalSettings!;

		// Create the live preview element
		const previewEl = contentEl.createDiv({
			cls: "global-setting-tab-live-preview",
		});
		const previewLabel = previewEl.createDiv({
			cls: "global-setting-tab-live-preview-label",
		});
		previewLabel.setText(t("preview"));

		const previewData = previewEl.createDiv({
			cls: "global-setting-tab-live-preview-data",
		});
		const updatePreview = () => {
			let taskTitle = t("dummy-task-title");
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
						preview = `- [x] ${time} ${taskTitle} ${priority} 📅[${dueDate}] ${tags} ✅[${completionDate}]`;
					} else {
						preview = `- [x] ${taskTitle} ${priority} ⏰[${time}] 📅[${dueDate}] ${tags} ✅[${completionDate}]`;
					}
					break;
				}
				// Tasks Plugin
				case "2": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${time} ${taskTitle} ${priority} 📅 ${dueDate} ${tags} ✅ ${
							completionDate.split("/")[0]
						}`;
					} else {
						preview = `- [x] ${taskTitle} ${priority} ⏰ ${time} 📅 ${dueDate} ${tags} ✅${
							completionDate.split("/")[0]
						}`;
					}
					break;
				}
				// Dataview Plugin
				case "3": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${time} ${taskTitle} [priority:: 2] [due:: ${dueDate}] ${tags} [completion:: ${completionDate}]`;
					} else {
						preview = `- [x] ${taskTitle} [priority:: 2] [time:: ${time}] [due:: ${dueDate}] ${tags} [completion:: ${completionDate}]`;
					}
					break;
				}
				// Obsidian Native
				case "4": {
					if (this.globalSettings!.dayPlannerPlugin) {
						preview = `- [x] ${time} ${taskTitle} @priority(2) @due(${dueDate}) ${tags} @completion(${completionDate})`;
					} else {
						preview = `- [x] ${taskTitle} @priority(2) @time(${time}) @due(${dueDate}) ${tags} @completion(${completionDate})`;
					}
					break;
				}
			}
			previewData.setText(preview);
		};

		// Setting for Due and Completion Date-Time pattern format
		new Setting(contentEl)
			.setName(t("supported-plugin-formats"))
			.setDesc(t("supported-plugin-formats-info"))
			.addDropdown((dropdown) => {
				dropdown.addOption("1", t("default"));
				dropdown.addOption("2", "Tasks " + t("plugin"));
				dropdown.addOption("3", "Dataview " + t("plugin"));
				dropdown.addOption("4", "Obsidian " + t("native"));

				dropdown.setValue(taskCompletionFormat as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.taskCompletionFormat = value;
					await this.saveSettings();
					updatePreview();
				});
			});

		// Text input for the dueDateFormat
		new Setting(contentEl)
			.setName(t("due-date-format"))
			.setDesc(t("due-date-format-info"))
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

		// Text input for the taskCompletionDateTimePattern
		new Setting(contentEl)
			.setName(t("task-completion-date-time-pattern"))
			.setDesc(t("task-completion-date-time-pattern-info"))
			.addText((text) =>
				text
					.setValue(taskCompletionDateTimePattern)
					.onChange(async (value) => {
						this.globalSettings!.taskCompletionDateTimePattern =
							value;
						await this.saveSettings();
						updatePreview();
					})
					.setPlaceholder("yyyy-MM-DD/HH:mm")
			);

		// Initialize the preview on page load
		updatePreview();

		// Setting for firstDayOfWeek
		new Setting(contentEl)
			.setName(t("first-day-of-the-week"))
			.setDesc(t("first-day-of-the-week-info"))
			// .addText((text) =>
			// 	text.setValue(firstDayOfWeek).onChange(async (value) => {
			// 		this.globalSettings!.firstDayOfWeek = value;
			// 		await this.saveSettings();
			// 	})
			// );
			.addDropdown((dropdown) => {
				dropdown.addOption("1", t("sunday"));
				dropdown.addOption("2", t("monday"));
				dropdown.addOption("3", t("tuesday"));
				dropdown.addOption("4", t("monday"));
				dropdown.addOption("5", t("thursday"));
				dropdown.addOption("6", t("friday"));
				dropdown.addOption("7", t("saturday"));

				dropdown.setValue(firstDayOfWeek as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.firstDayOfWeek = value;
					await this.saveSettings();
				});
			});

		// Setting for taskCompletionInLocalTime
		new Setting(contentEl)
			.setName(t("task-completion-in-local-time"))
			.setDesc(t("task-completion-in-local-time-info"))
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
			.setName(t("show-utc-offset-for-task-completion"))
			.setDesc(t("show-utc-offset-for-task-completion-info"))
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
