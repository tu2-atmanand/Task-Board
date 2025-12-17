// /src/views/TaskBoardSettingConstructUI.ts

import { App, Notice, Setting, normalizePath } from "obsidian";
import { buyMeCoffeeSVGIcon, kofiSVGIcon } from "src/interfaces/Icons";
import Pickr from "@simonwep/pickr";
import Sortable from "sortablejs";
import TaskBoard from "main";
import { downloadAndApplyLanguageFile, t } from "src/utils/lang/helper";
import {
	MultiSuggest,
	getFileSuggestions,
	getFolderSuggestions,
	getQuickAddPluginChoices,
} from "src/services/MultiSuggest";
import { CommunityPlugins } from "src/services/CommunityPlugins";
import { bugReporter, openScanFiltersModal } from "src/services/OpenModals";
import { moveTasksCacheFileToNewPath } from "src/utils/JsonFileOperations";
import {
	exportConfigurations,
	importConfigurations,
	showReloadObsidianNotice,
} from "./SettingSynchronizer";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import { TASKS_PLUGIN_DEFAULT_SYMBOLS } from "src/regularExpressions/TasksPluginRegularExpr";
import {
	HideableTaskProperty,
	cardSectionsVisibilityOptions,
	TagColorType,
	EditButtonMode,
	NotificationService,
	UniversalDateOptions,
	taskPropertyFormatOptions,
	mapViewBackgrounVariantTypes,
	mapViewNodeMapOrientation,
	mapViewArrowDirection,
	mapViewScrollAction,
	mapViewEdgeType,
} from "src/interfaces/Enums";
import {
	frontmatterFormatting,
	globalSettingsData,
} from "src/interfaces/GlobalSettings";
import { createFragmentWithHTML } from "src/utils/UIHelpers";

export class SettingsManager {
	win: Window;
	app: App;
	plugin: TaskBoard;
	globalSettings: globalSettingsData | null = null;
	allPickrs: Pickr[] = [];
	reloadNoticeAlreadyShown: boolean = false;

	constructor(plugin: TaskBoard) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.win = window;
	}

	private getPropertyDisplayName(property: HideableTaskProperty): string {
		const displayNames: Record<HideableTaskProperty, string> = {
			[HideableTaskProperty.ID]: "ID (🆔 fpyvkz)",
			[HideableTaskProperty.Tags]: "Tags (#tag)",
			[HideableTaskProperty.Priority]: "Priority (🔺)",
			[HideableTaskProperty.CreatedDate]: "Created Date (➕ 2024-01-01)",
			[HideableTaskProperty.StartDate]: "Start Date (🛫 2024-01-01)",
			[HideableTaskProperty.ScheduledDate]:
				"Scheduled Date (⏳ 2024-01-01)",
			[HideableTaskProperty.DueDate]: "Due Date (📅 2024-01-01)",
			[HideableTaskProperty.CompletionDate]:
				"Completion Date (✅ 2024-01-01)",
			[HideableTaskProperty.CancelledDate]:
				"Cancelled Date (❌ 2024-01-01)",
			[HideableTaskProperty.Time]: "Time (⏰ 09:00-10:00)",
			[HideableTaskProperty.Reminder]: "Reminder ((@12:30))",
			[HideableTaskProperty.Recurring]: "Recurring (🔁 every 2 weeks)",
			[HideableTaskProperty.OnCompletion]: "On-completion (🏁 delete)",
			[HideableTaskProperty.Dependencies]: "Dependens-on ⛔ fa4sm9",
		};
		return displayNames[property] || property;
	}

	private openReloadNoticeIfNeeded() {
		if (!this.reloadNoticeAlreadyShown) {
			sleep(100).then(() => {
				showReloadObsidianNotice(this.plugin);
				this.reloadNoticeAlreadyShown = true;
			});
			return;
		}
		return;
	}

	// Function to load the settings from data.json
	async loadSettings(): Promise<void> {
		try {
			const settingsData = this.plugin.settings.data.globalSettings;
			this.globalSettings = settingsData;
		} catch (err) {
			bugReporter(
				this.plugin,
				"Failed to load settings",
				err as string,
				"TaskBoardSettingConstructUI.ts/SettingsManager/loadSettings"
			);
		}
	}

	// Function to save settings back to data.json
	async saveSettings(): Promise<void> {
		if (!this.globalSettings) return;

		try {
			this.plugin.settings.data.globalSettings = this.globalSettings;
			this.plugin.saveSettings();
		} catch (err) {
			bugReporter(
				this.plugin,
				"Failed to save settings",
				err as string,
				"TaskBoardSettingConstructUI.ts/SettingsManager/saveSettings"
			);
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
				key: t("all-ui"),
				handler: () => this.renderAllUITabSettings(tabContent),
			},
			{
				key: t("tbnote"),
				handler: () => this.renderTBNoteTabSettings(tabContent),
			},
			{
				key: t("map-view"),
				handler: () => this.renderMapViewTabSettings(tabContent),
			},
			{
				key: t("automation"),
				handler: () => this.renderAutomationTabSettings(tabContent),
			},
			{
				key: t("formats"),
				handler: () => this.renderFormatsTabSettings(tabContent),
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

			tabButton.addEventListener("click", async () => {
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

				// Store the tabIndex inside `this.plugin.settings.data.globalSettings.lastViewHistory.settingTab` and call this.saveSetting()
				const tabKeys = Object.keys(sections);
				const tabIndex = tabKeys.indexOf(tabName);
				if (this.globalSettings) {
					this.globalSettings.lastViewHistory.settingTab = tabIndex;
					// saveSettings is async; call without awaiting inside this non-async handler
					await this.saveSettings();
				}
			});

			tabs[tabName] = tabButton;
		});

		contentEl.createEl("hr");

		// Set the last viewed tab
		const defaultTab =
			Object.keys(sections)[
				this.plugin.settings.data.globalSettings.lastViewHistory
					.settingTab
			];
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

		this.reloadNoticeAlreadyShown = false;

		//Destroy all Pickr instances
		this.allPickrs.forEach((pickr) => pickr.destroy());

		//find all the div with calls picr-app using query-selector and remove them from the main window
		const pickrApps = this.win.document.querySelectorAll(".pcr-app ");
		if (pickrApps) {
			pickrApps.forEach((app) => {
				app.remove();
			});
		}
	}

	// Function to render the "Filters for scanning" tab content
	private renderGeneralTabSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("general-settings-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const {
			scanFilters,
			openOnStartup,
			realTimeScanning,
			archivedTasksFilePath,
			tasksCacheFilePath,
			scanVaultAtStartup,
			preDefinedNote,
			autoAddUniqueID,
			experimentalFeatures,
			safeGuardFeature,
		} = this.globalSettings!;

		new Setting(contentEl)
			.setName(t("filters-for-scanning"))
			.setDesc(
				createFragmentWithHTML(
					t("name-of-the-file-folder-tag-for-filter-info") +
						"<br/>" +
						"<b>" +
						t("note") +
						" :</b> " +
						t("name-of-the-file-folder-tag-for-filter-info-2")
				)
			);

		["files", "folders", "frontMatter", "tags"].forEach((type) => {
			const filterType = type as keyof typeof scanFilters;
			const filter = scanFilters[filterType];

			const row = contentEl.createDiv({
				cls: "taskBoard-filter-row",
			});

			const rowHeading = row.createDiv({
				cls: "taskBoard-filter-row-heading",
			});

			const rowBody = row.createDiv({
				cls: "taskBoard-filter-row-body",
			});

			// Filter label
			rowHeading.createEl("span", {
				text: type.charAt(0).toUpperCase() + type.slice(1),
				cls: "taskBoard-filter-label",
			});

			// Configure button
			const configureBtn = rowHeading.createEl("button", {
				text: "Configure",
				cls: "taskBoard-filter-configure-button",
			});
			configureBtn.addEventListener("click", () => {
				openScanFiltersModal(this.plugin, filterType, (newValues) => {
					this.plugin.settings.data.globalSettings.scanFilters[
						filterType
					].values = newValues;
					this.plugin.saveSettings();
					refreshTagList(); // Refresh the tag list after updating values
				});
			});

			// Visual tag list
			const tagList = rowBody.createDiv({
				cls: "taskBoard-filter-values",
			});

			const refreshTagList = () => {
				tagList.empty(); // Clear existing tags
				if (filter.values.length === 0) {
					tagList.createEl("em", {
						text: "None",
						attr: { style: "opacity: 0.5;" },
					});
				} else {
					filter.values.forEach((val) => {
						tagList.createEl("span", {
							text: val,
							cls: "taskBoard-filter-tag",
						});
					});
				}
			};

			refreshTagList(); // Initial render of the tag list

			// Polarity dropdown
			const polarityDropdown = rowBody.createEl("select", {
				attr: { "aria-label": "Select Filter Polarity" },
				cls: "taskBoard-filter-dropdown",
			});
			[
				{ label: "Only scan this", value: 1 },
				{ label: "Don't scan this", value: 2 },
				{ label: "Disable", value: 3 },
			].forEach((opt) => {
				const option = polarityDropdown.createEl("option", {
					text: opt.label,
					value: String(opt.value),
				});
				if (filter.polarity === opt.value) {
					option.selected = true;
				}
			});
			polarityDropdown.addEventListener("change", (e) => {
				const newPolarity = Number(
					(e.target as HTMLSelectElement).value
				);
				this.plugin.settings.data.globalSettings.scanFilters[
					filterType
				].polarity = newPolarity;
				this.plugin.saveSettings();
			});
		});

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

		// Setting to scan the modified file in realtime
		new Setting(contentEl)
			.setName(t("auto-add-unique-id"))
			.setDesc(
				createFragmentWithHTML(
					t("auto-add-unique-id-description") +
						"<br/>" +
						"<ul>" +
						"<li>" +
						t("link-parent-child-tasks") +
						"</li>" +
						"<li>" +
						t("pin-tasks-on-top-in-each-column-upcoming") +
						"</li>" +
						"<li>" +
						t("manual-sorting-inside-each-column-upcoming") +
						"</li>" +
						"<li>" +
						t("map-view-upcoming") +
						"</li>" +
						"</ul>"
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(autoAddUniqueID).onChange(async (value) => {
					this.globalSettings!.autoAddUniqueID = value;
					await this.saveSettings();

					this.openReloadNoticeIfNeeded();
				})
			);

		new Setting(contentEl)
			.setName(t("default-note-for-adding-new-tasks"))
			.setDesc(t("default-note-for-new-tasks-description"))
			.addText((text) => {
				text.setValue(preDefinedNote).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.preDefinedNote = value;
				});

				const inputEl = text.inputEl;
				const suggestionContent = getFileSuggestions(this.app);
				const onSelectCallback = async (selectedPath: string) => {
					if (this.globalSettings) {
						this.globalSettings.preDefinedNote = selectedPath;
					}
					text.setValue(selectedPath);
					await this.saveSettings();
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app
				);
			});

		// Setting for choosing the default file to archive tasks
		new Setting(contentEl)
			.setName(t("file-for-archived-tasks"))
			.setDesc(t("file-for-archived-tasks-description"))
			.addText((text) => {
				text.setValue(archivedTasksFilePath).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.archivedTasksFilePath = value;
				});

				const inputEl = text.inputEl;
				const suggestionContent = getFileSuggestions(this.plugin.app);
				const onSelectCallback = async (selectedPath: string) => {
					if (this.globalSettings) {
						this.globalSettings.archivedTasksFilePath =
							selectedPath;
					}
					text.setValue(selectedPath);
					await this.saveSettings();
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app
				);
			});

		new Setting(contentEl)
			.setClass("taskBoard-settings-wide-input")
			.setName(t("tasks-cache-file-path"))
			.setDesc(
				createFragmentWithHTML(
					t("tasks-cache-file-path-description") +
						"<br/>" +
						t("tasks-cache-file-path-description-2")
				)
			)
			.addDropdown((dropdown) => {
				const defaultPath = `${this.plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
				const suggestionContent = [
					defaultPath,
					...getFolderSuggestions(this.app).map((item) =>
						normalizePath(`${item}/task-board-cache.json`)
					),
				];
				// Add 'Default' option label for the default path
				dropdown.addOption(defaultPath, `Default - ${defaultPath}`);

				// Add options to dropdown
				suggestionContent.forEach((path) => {
					dropdown.addOption(path, path);
				});

				// Set current value
				dropdown.setValue(tasksCacheFilePath);

				dropdown.onChange(async (selectedPath) => {
					const result = await moveTasksCacheFileToNewPath(
						this.plugin,
						tasksCacheFilePath,
						selectedPath
					);

					if (this.globalSettings && result) {
						this.globalSettings.tasksCacheFilePath = selectedPath;
						await this.saveSettings();

						this.openReloadNoticeIfNeeded();
					}
				});
			});

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

		// Setting to Scan the whole Vault to detect all tasks and re-write the tasks.json
		new Setting(contentEl)
			.setName(t("auto-scan-the-vault-on-obsidian-startup"))
			.setDesc(
				createFragmentWithHTML(
					t("auto-scan-the-vault-on-obsidian-startup-info") +
						"<br/>" +
						"<b>" +
						t("note") +
						" :</b> " +
						t("auto-scan-the-vault-on-obsidian-startup-info-2")
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(scanVaultAtStartup).onChange(async (value) => {
					this.globalSettings!.scanVaultAtStartup = value;
					await this.saveSettings();
				})
			);

		// New setting for updating language file
		new Setting(contentEl)
			.setName(t("update-language-translations"))
			.setDesc(t("update-language-translations-info"))
			.addButton((button) =>
				button.setButtonText("Update").onClick(async () => {
					const result = await downloadAndApplyLanguageFile(
						this.plugin
					);
					if (result) {
						this.openReloadNoticeIfNeeded();
					}
				})
			);

		new Setting(contentEl)
			.setName(t("import-export-configurations"))
			.setDesc(t("import-export-configurations-info"))
			.addButton((button) =>
				button.setButtonText(t("import")).onClick(async () => {
					const result = await importConfigurations(this.plugin);
					if (result) {
						this.openReloadNoticeIfNeeded();
					}
				})
			)
			.addButton((button) =>
				button.setButtonText(t("export")).onClick(async () => {
					await exportConfigurations(this.plugin);
				})
			);

		new Setting(contentEl)
			.setName("Safeguard feature")
			.setDesc(
				createFragmentWithHTML(
					"This feature helps to ensure that this plugin wont temper the conte of other tasks. It shows you a conflict in the content if this plugin couldnt able to find the exact match in the current note." +
						"<br/>" +
						"<b>" +
						"NOTE :" +
						"</b>" +
						"Disabling this feature will by-pass the security check which might lead to unwanted behavior. Example in case where there are multiple inline tasks one after the another. Only disable this feature if you feel this modal is poppin-up too many times and also its irrelevant as the content is properly getting edited and matched. Obsidian definitely provides a file recovery feature, but ensure you take care of you data manually." +
						"<br/>" +
						"This is a temporary solution to the problem few users are facing right now. This will be the default behavior moving forward and you will not require to disable this feature moving forward."
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(safeGuardFeature).onChange(async (value) => {
					this.globalSettings!.safeGuardFeature = value;
					await this.saveSettings();

					this.openReloadNoticeIfNeeded();
				})
			);

		// new Setting(contentEl)
		// 	.setName(t("enable-experimental-features"))
		// 	.setDesc(
		// 		createFragmentWithHTML(
		// 			t("enable-experimental-features-info-1") +
		// 				"<br/>" +
		// 				t("enable-experimental-features-info-2") +
		// 				"<br/>" +
		// 				"<ul>" +
		// 				"<li>" +
		// 				"<b>" +
		// 				t("drag-and-drop") +
		// 				"</b>" +
		// 				t("drag-and-drop-feature-description") +
		// 				"</li>" +
		// 				"</ul>" +
		// 		)
		// 	)
		// 	.addToggle((toggle) =>
		// 		toggle
		// 			.setValue(experimentalFeatures)
		// 			.onChange(async (value) => {
		// 				this.globalSettings!.experimentalFeatures = value;
		// 				await this.saveSettings();

		// 				this.openReloadNoticeIfNeeded();
		// 			})
		// 	);

		// // Helper to add filter rows
		// const addFilterRow = (
		// 	label: string,
		// 	filterType: keyof typeof scanFilters,
		// 	polarity: number,
		// 	values: string[],
		// 	placeholder: string
		// ) => {
		// 	const row = contentEl.createDiv({
		// 		cls: "taskBoard-filter-row",
		// 	});

		// 	// Label
		// 	row.createEl("span", {
		// 		text: label,
		// 		cls: "taskBoard-filter-label",
		// 	});

		// 	// Input for values
		// 	const input = row.createEl("input", {
		// 		type: "text",
		// 		cls: "taskBoard-filter-input",
		// 	});
		// 	input.value = values.join(", ");
		// 	input.addEventListener("change", async () => {
		// 		this.globalSettings!.scanFilters[filterType].values =
		// 			input.value.split(",").map((v) => normalizePath(v.trim()));
		// 		await this.saveSettings();
		// 	});
		// 	input.placeholder = placeholder;

		// 	// Dropdown for polarity
		// 	const dropdown = row.createEl("select", {
		// 		cls: "taskBoard-filter-dropdown",
		// 	});
		// 	[t("only-scan-this"), t("dont-scan-this"), t("disable")].forEach(
		// 		(optionText, idx) => {
		// 			const option = dropdown.createEl("option", {
		// 				text: optionText,
		// 			});
		// 			option.value = (idx + 1).toString();
		// 			if (idx + 1 === polarity) option.selected = true;
		// 		}
		// 	);
		// 	dropdown.addEventListener("change", async () => {
		// 		this.globalSettings!.scanFilters[filterType].polarity =
		// 			parseInt(dropdown.value, 10);
		// 		await this.saveSettings();
		// 	});
		// };

		// // Files Row
		// addFilterRow(
		// 	t("files"),
		// 	"files",
		// 	scanFilters.files.polarity,
		// 	scanFilters.files.values,
		// 	"Personal.md, FolderName/New_file.md"
		// );

		// // Folders Row
		// addFilterRow(
		// 	t("folders"),
		// 	"folders",
		// 	scanFilters.folders.polarity,
		// 	scanFilters.folders.values,
		// 	"Folder_Name 1, Folder_Name 2, Parent_Folder/child_folder/New_folder"
		// );

		// // Tags Row
		// addFilterRow(
		// 	t("tags"),
		// 	"tags",
		// 	scanFilters.tags.polarity,
		// 	scanFilters.tags.values,
		// 	"#Bug, #docs/🔥bug, #feature"
		// );

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
	private renderAllUITabSettings(contentEl: HTMLElement) {
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
			showFileNameInCard,
			cardSectionsVisibility,
			showFrontmatterTagsOnCards,
			hiddenTaskProperties,
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

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName(t("show-note-frontmatter-tags-in-the-card-header"))
			.setDesc(t("show-note-frontmatter-tags-in-the-card-header-info"))
			.addToggle((toggle) =>
				toggle
					.setValue(showFrontmatterTagsOnCards)
					.onChange(async (value) => {
						this.globalSettings!.showFrontmatterTagsOnCards = value;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("customize-card-sections"))
			.setDesc(t("customize-card-sections-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[cardSectionsVisibilityOptions.showDescriptionOnly]: t(
							"show-description-only"
						),
						[cardSectionsVisibilityOptions.showSubTasksOnly]:
							t("show-subtasks-only"),
						[cardSectionsVisibilityOptions.showBoth]:
							t("show-both"),
						[cardSectionsVisibilityOptions.hideBoth]:
							t("hide-both"),
					})
					.setValue(cardSectionsVisibility)
					.onChange(async (value) => {
						this.globalSettings!.cardSectionsVisibility = value;
						await this.saveSettings();
					})
			);

		// Setting to show/Hide the Footer of the task card
		new Setting(contentEl)
			.setName(t("show-note-name-in-task-header"))
			.setDesc(t("show-note-name-in-task-header-description"))
			.addToggle((toggle) =>
				toggle.setValue(showFileNameInCard).onChange(async (value) => {
					this.globalSettings!.showFileNameInCard = value;
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
			.setName(t("width-of-task-card"))
			.setDesc(t("enter-the-value-of-width-for-task-card"))
			.addText((text) =>
				text
					.setValue(columnWidth)
					.onChange(async (value) => {
						this.globalSettings!.columnWidth = value;
						await this.saveSettings();
					})
					.setPlaceholder("300px")
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

		// Lazy loading settings for Kanban view
		new Setting(contentEl)
			.setName("Enable lazy loading for Kanban view")
			.setDesc(
				"When enabled, only a limited number of task cards are initially rendered per column. More tasks load automatically as you scroll within each column. This significantly improves performance for boards with thousands of tasks. This setting is just to provide a backward compatibility in case user faces any issue with rendering. If there are no issues faced with this approach, this setting will be removed in the future releases and this technique will be used a default behavior for rendering the columns."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.globalSettings!.kanbanView?.lazyLoadingEnabled ??
							false
					)
					.onChange(async (value) => {
						if (!this.globalSettings!.kanbanView) {
							this.globalSettings!.kanbanView = {
								lazyLoadingEnabled: false,
								initialTaskCount: 20,
								loadMoreCount: 10,
								scrollThresholdPercent: 80,
							};
						}
						this.globalSettings!.kanbanView.lazyLoadingEnabled =
							value;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("live-editor-and-reading-mode"))
			.setHeading();

		// Setting for hiding specific task properties in Live Editor and Reading mode
		new Setting(contentEl)
			.setName(t("hide-specific-properties-in-notes"))
			.setDesc(t("hide-specific-properties-in-notes-description"))
			.setClass("taskboard-hidden-properties-setting");

		// Create a container for checkboxes
		const checkboxContainer = contentEl.createDiv(
			"taskboard-hidden-properties-container"
		);

		// Create checkboxes for each hideable property
		Object.values(HideableTaskProperty).forEach((property) => {
			const displayName = this.getPropertyDisplayName(property);

			const checkboxSetting = new Setting(checkboxContainer)
				.setName(displayName)
				.setClass("taskboard-property-checkbox-setting")
				.addToggle((toggle) => {
					const isSelected = hiddenTaskProperties.includes(property);
					toggle.setValue(isSelected).onChange(async (value) => {
						if (value) {
							// Add property if not already included
							if (
								!this.globalSettings!.hiddenTaskProperties.includes(
									property
								)
							) {
								this.globalSettings!.hiddenTaskProperties.push(
									property
								);
							}
						} else {
							// Remove property
							this.globalSettings!.hiddenTaskProperties =
								this.globalSettings!.hiddenTaskProperties.filter(
									(p) => p !== property
								);
						}
						await this.saveSettings();

						this.openReloadNoticeIfNeeded();
					});
				});

			// Style the checkbox setting to be more compact
			checkboxSetting.settingEl.addClass("taskboard-compact-setting");
		});

		// Tag Colors settings
		// Setting to show/Hide the Header of the task card
		// new Setting(contentEl)
		// 	.setName(t("tag-colors"))
		// 	.setDesc(t("tag-colors-info"));

		new Setting(contentEl).setName(t("tag-colors")).setHeading();

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
						await this.saveSettings();
						renderTagColors();
					})
			);

		const tagColorsContainer = contentEl.createDiv({
			cls: "tag-colors-container",
		});

		// Initialize Sortable.js
		Sortable.create(tagColorsContainer, {
			animation: 150,
			handle: ".taskboard-setting-tag-color-row-element-drag-handle",
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
							.setClass(
								"taskboard-setting-tag-color-row-element-drag-handle"
							)
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
								maxWidth: "max-content !important",
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
								minWidth: "23vw !important",
							})
					)
					.addButton((btn) => {
						btn.setTooltip(t("pick-color-for-tag"))
							.setIcon("palette")
							.setClass(
								"taskboard-setting-tag-color-row-element-color-picker"
							)
							.then(() => {
								const colorMap =
									this.plugin.settings.data.globalSettings.tagColors.map(
										(tagColor) => ({
											color:
												this.plugin.settings.data
													.globalSettings.tagColors[
													tagColor.priority - 1
												]?.color || "#ff0000",
										})
									);
								const pickr = new Pickr({
									el: btn.buttonEl,
									theme: "nano",
									swatches: colorMap.map(
										(item) => item.color
									),
									defaultRepresentation: "HEXA",
									default: tag.color || "#ff0000",
									comparison: false,
									components: {
										preview: true,
										opacity: true,
										hue: true,
										interaction: {
											hex: true,
											rgba: true,
											hsla: false,
											hsva: false,
											cmyk: false,
											input: true,
											clear: true,
											cancel: true,
											save: false,
										},
									},
								});

								this.allPickrs.push(pickr);

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
									.on("cancel", () => pickr.destroy())
									.on("clear", () => pickr.hide());
							});
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
								minWidth: "23vw !important",
							});
					})
					.addButton((del) =>
						del
							.setButtonText("Delete")
							.setIcon("trash")
							.setClass(
								"taskboard-setting-tag-color-row-element-delete"
							)
							.setTooltip(t("delete-tag-color"))
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

	private renderTBNoteTabSettings(contentEl: HTMLElement) {
		const {
			taskNoteIdentifierTag,
			taskNoteDefaultLocation,
			archivedTBNotesFolderPath,
			frontmatterFormatting,
		} = this.globalSettings!;

		new Setting(contentEl)
			.setName(t("task-note-vs-tbnote"))
			.setDesc(
				createFragmentWithHTML(
					"<ul>" +
						"<li><b>" +
						t("task-note") +
						":</b> " +
						t("task-note-description") +
						"</li>" +
						"<li><b>" +
						t("tbnote") +
						":</b> " +
						t("tbnote-description") +
						" <a href='https://github.com/tu2-atmanand/Task-Board/issues/33'>" +
						t("tbnote-development-ticker") +
						"</a></li>" +
						"</ul>"
				)
			);

		new Setting(contentEl)
			.setName(t("task-note-identifier-tag"))
			.setDesc(t("task-note-identifier-tag-description"))
			.addText((text) => {
				text.setValue(taskNoteIdentifierTag).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.taskNoteIdentifierTag =
							value.startsWith("#")
								? value.replace("#", "")
								: value;
				});

				const inputEl = text.inputEl;
				inputEl.placeholder = "e.g., #taskNote";
			});

		// Setting for choosing the default location for task notes
		new Setting(contentEl)
			.setName(t("default-location-for-new-task-notes"))
			.setDesc(t("default-location-for-new-task-notes-description"))
			.addText((text) => {
				text.setValue(taskNoteDefaultLocation).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.taskNoteDefaultLocation = value;
				});

				const inputEl = text.inputEl;
				// For folders, we could use folder suggestions or just allow text input
				// For now, let's keep it simple with text input
				inputEl.placeholder = "e.g., Task Notes/";
			});

		// Setting for choosing the default file to archive tasks
		new Setting(contentEl)
			.setName(t("folder-for-archived-task-notes"))
			.setDesc(t("folder-for-archived-task-notes-description"))
			.addText((text) => {
				text.setValue(archivedTBNotesFolderPath).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.archivedTBNotesFolderPath = value;
				});

				const inputEl = text.inputEl;
				inputEl.placeholder = "e.g., TaskBoard/TaskNotes";
				const suggestionContent = getFolderSuggestions(this.plugin.app);
				const onSelectCallback = async (selectedPath: string) => {
					if (this.globalSettings) {
						this.globalSettings.archivedTBNotesFolderPath =
							selectedPath;
					}
					text.setValue(selectedPath);
					await this.saveSettings();
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app
				);
			});

		new Setting(contentEl)
			.setName(t("frontmatter-formatting"))
			.setDesc(t("frontmatter-formatting-description"));

		const frontmatterFormattingContainer = contentEl.createDiv({
			cls: "taskBoardSettingsFrontmatterFormattingContainer",
		});

		// Initialize Sortable.js
		Sortable.create(frontmatterFormattingContainer, {
			animation: 150,
			handle: ".taskBoardSettingsFrontmatterFormattingContainerItemDragHandle",
			ghostClass: "task-board-sortable-ghost",
			chosenClass: "task-board-sortable-chosen",
			dragClass: "task-board-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-board-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: async () => {
				const newOrder = Array.from(
					frontmatterFormattingContainer.children
				)
					.map((child, index) => {
						const propertyName = child.getAttribute(
							"data-frontmatterItem-name"
						);
						const frontmatterItem = frontmatterFormatting?.find(
							(c) => c.property === propertyName
						);
						if (frontmatterItem) {
							frontmatterItem.index = index + 1;
							return frontmatterItem;
						}
						return null;
					})
					.filter(
						(
							frontmatterItem
						): frontmatterItem is frontmatterFormatting =>
							frontmatterItem !== null
					);

				this.plugin.settings.data.globalSettings.frontmatterFormatting =
					newOrder;
			},
		});

		const renderFrontmatterFormattingItems = () => {
			if (!frontmatterFormatting) return;

			frontmatterFormattingContainer.empty(); // Clear existing rendered rows

			frontmatterFormatting
				.sort((a, b) => a.index - b.index)
				.forEach((sortfrontmatterItem, index) => {
					const row = frontmatterFormattingContainer.createDiv({
						cls: "taskBoardSettingsFrontmatterFormattingContainerItemRow",
						attr: {
							"data-frontmatterItem-name":
								sortfrontmatterItem.property,
						},
					});

					new Setting(row)
						.setClass(
							"taskBoardSettingsFrontmatterFormattingContainerItem"
						)
						.addButton((drag) =>
							drag
								.setTooltip("Hold and drag")
								.setIcon("grip-horizontal")
								.setClass(
									"taskBoardSettingsFrontmatterFormattingContainerItemDragHandle"
								)
						)
						.addButton((button) => {
							button.setButtonText(sortfrontmatterItem.property);
						})
						.addText((text) => {
							text.setValue(sortfrontmatterItem.key)
								.setPlaceholder(t("Enter property key"))
								.onChange((value) => {
									this.plugin.settings.data.globalSettings.frontmatterFormatting[
										index
									].key = value.trim();
								});
						});
					// .addButton((del) =>
					// 	del
					// 		.setButtonText("delete")
					// 		.setIcon("trash")
					// 		.setClass(
					// 			"taskBoardSettingsFrontmatterFormattingContainerItemDeleteCriterion"
					// 		)
					// 		.setTooltip(t("remove-sort-criterion"))
					// 		.onClick(async () => {
					// 			if (
					// 				this.plugin.settings.data.globalSettings
					// 					.frontmatterFormatting
					// 			) {
					// 				this.plugin.settings.data.globalSettings.frontmatterFormatting.splice(
					// 					index,
					// 					1
					// 				);
					// 				this.saveSettings();
					// 				renderFrontmatterFormattingItems(); // Re-render after delete
					// 			}
					// 		})
					// );
				});
		};

		// Initial render
		renderFrontmatterFormattingItems();

		// const addNewSortingButton = frontmatterFormattingContainer.createEl(
		// 	"button",
		// 	{
		// 		text: t("add-new-sorting-criterion"),
		// 		cls: "configureColumnSortingModalHomeAddSortingBtn",
		// 	}
		// );
		// addNewSortingButton.addEventListener("click", async () => {
		// 	const newfrontmatterItem: frontmatterFormatting = {
		// 		index:
		// 			(this.plugin.settings.data.globalSettings
		// 				.frontmatterFormatting?.length || 0) + 1,
		// 		property: "",
		// 		key: "",
		// 	};
		// 	if (
		// 		!this.plugin.settings.data.globalSettings.frontmatterFormatting
		// 	) {
		// 		this.plugin.settings.data.globalSettings.frontmatterFormatting =
		// 			[];
		// 	}
		// 	this.plugin.settings.data.globalSettings.frontmatterFormatting.push(
		// 		newfrontmatterItem
		// 	);
		// 	renderFrontmatterFormattingItems();
		// });
	}

	private renderMapViewTabSettings(contentEl: HTMLElement) {
		const {
			background,
			mapOrientation,
			optimizedRender,
			arrowDirection,
			animatedEdges,
			scrollAction,
			showMinimap,
			renderVisibleNodes,
			edgeType,
		} = this.globalSettings?.mapView!;

		new Setting(contentEl)
			.setName(
				createFragmentWithHTML("<b>" + t("dfp-methodology") + "</b>")
			)
			.setDesc(
				createFragmentWithHTML(
					t("dfp-methodology-description-1") +
						"<br />" +
						t("dfp-methodology-description-2") +
						" <a href='https://github.com/tu2-atmanand/Task-Board/discussions/400'>" +
						t("dfp-methodology") +
						"." +
						"</a>"
				)
			);

		new Setting(contentEl)
			.setName(t("render-only-visible-nodes"))
			.setDesc(
				createFragmentWithHTML(
					"<ul>" +
						"<li>" +
						t("render-only-visible-nodes-description-1") +
						"</li>" +
						"<li>" +
						t("render-only-visible-nodes-description-2") +
						"</li>" +
						"</ul>"
				)
			)
			.addToggle((toggle) =>
				toggle.setValue(renderVisibleNodes).onChange(async (value) => {
					this.globalSettings!.mapView.renderVisibleNodes = value;
					await this.saveSettings();
				})
			);

		new Setting(contentEl).setName(t("controls")).setHeading();

		new Setting(contentEl)
			.setName(t("mouse-wheel-behaviour"))
			.setDesc(t("mouse-wheel-behaviour-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[mapViewScrollAction.zoom]: t("zoom"),
						[mapViewScrollAction.pan]: t("pan"),
					})
					.setValue(scrollAction)
					.onChange(async (value) => {
						this.globalSettings!.mapView.scrollAction =
							value as mapViewScrollAction;
						await this.saveSettings();
					})
			);

		new Setting(contentEl).setName(t("appearance")).setHeading();

		new Setting(contentEl)
			.setName(t("canvas-background"))
			.setDesc(t("canvas-background-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[mapViewBackgrounVariantTypes.none]: t("default"),
						[mapViewBackgrounVariantTypes.transparent]:
							t("transparent"),
						[mapViewBackgrounVariantTypes.dots]: t("dots"),
						[mapViewBackgrounVariantTypes.lines]: t("lines"),
						[mapViewBackgrounVariantTypes.cross]: t("cross"),
					})
					.setValue(background)
					.onChange(async (value) => {
						this.globalSettings!.mapView.background =
							value as mapViewBackgrounVariantTypes;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("map-orientation"))
			.setDesc(t("map-orientation-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[mapViewNodeMapOrientation.horizontal]: t("horizontal"),
						[mapViewNodeMapOrientation.vertical]: t("vertical"),
					})
					.setValue(mapOrientation)
					.onChange(async (value) => {
						this.globalSettings!.mapView.mapOrientation =
							value as mapViewNodeMapOrientation;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("link-arrow-direction"))
			.setDesc(t("link-arrow-direction-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[mapViewArrowDirection.childToParent]:
							t("child-to-parent"),
						[mapViewArrowDirection.parentToChild]:
							t("parent-to-child"),
						[mapViewArrowDirection.bothWay]: t("both-way"),
					})
					.setValue(arrowDirection)
					.onChange(async (value) => {
						this.globalSettings!.mapView.arrowDirection =
							value as mapViewArrowDirection;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("link-style"))
			.setDesc(t("link-style-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[mapViewEdgeType.straight]: t("straight"),
						[mapViewEdgeType.step]: t("step"),
						[mapViewEdgeType.smoothstep]: t("smooth-step"),
						[mapViewEdgeType.bezier]: t("curved"),
					})
					.setValue(edgeType)
					.onChange(async (value) => {
						this.globalSettings!.mapView.edgeType =
							value as mapViewEdgeType;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("animate-links"))
			.setDesc(t("animate-links-description"))
			.addToggle((toggle) =>
				toggle.setValue(animatedEdges).onChange(async (value) => {
					this.globalSettings!.mapView.animatedEdges = value;
					await this.saveSettings();
				})
			);

		new Setting(contentEl)
			.setName(t("show-minimap"))
			.setDesc(t("show-minimap-description"))
			.addToggle((toggle) =>
				toggle.setValue(showMinimap).onChange(async (value) => {
					this.globalSettings!.mapView.showMinimap = value;
					await this.saveSettings();
				})
			);
	}

	// Function to render "Automation" tab content
	private renderAutomationTabSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("automation-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const {
			autoAddUniversalDate,
			autoAddCreatedDate,
			compatiblePlugins,
			dailyNotesPluginComp,
			quickAddPluginDefaultChoice,
			notificationService,
			frontmatterPropertyForReminder,
			boundTaskCompletionToChildTasks,
		} = this.globalSettings!;

		new Setting(contentEl)
			.setName(t("edit-button-mode"))
			.setDesc(t("edit-button-mode-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[EditButtonMode.Modal]: t(
							"use-edit-task-modal-feature"
						),
						[EditButtonMode.View]: t(
							"use-edit-task-window-feature"
						),
						[EditButtonMode.TasksPluginModal]:
							t("tasks-plugin-modal"),
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
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("double-click-card-action"))
			.setDesc(t("double-click-card-action-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[EditButtonMode.None]: t("none"),
						[EditButtonMode.Modal]: t(
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
					.setValue(this.globalSettings!.doubleClickCardToEdit)
					.onChange(async (value) => {
						this.globalSettings!.doubleClickCardToEdit =
							value as EditButtonMode;
						await this.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName(t("restrict-task-completion-to-child-tasks-and-sub-tasks"))
			.setDesc(t("restrict-task-completion-to-child-tasks-info"))
			.addToggle((toggle) =>
				toggle
					.setValue(boundTaskCompletionToChildTasks)
					.onChange(async (value) => {
						this.globalSettings!.boundTaskCompletionToChildTasks =
							value;
						await this.saveSettings();
					})
			);

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName(t("auto-add-universal-date-to-tasks"))
			.setDesc(t("auto-add-universal-date-to-tasks-info"))
			.addToggle((toggle) =>
				toggle
					.setValue(autoAddUniversalDate)
					.onChange(async (value) => {
						this.globalSettings!.autoAddUniversalDate = value;
						await this.saveSettings();
					})
			);

		// Setting for Auto Adding Created Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName(t("auto-add-created-date-to-tasks"))
			.setDesc(t("auto-add-created-date-to-tasks-desc"))
			.addToggle((toggle) =>
				toggle.setValue(autoAddCreatedDate).onChange(async (value) => {
					this.globalSettings!.autoAddCreatedDate = value;
					await this.saveSettings();
				})
			);

		// contentEl.createEl("h4", { text: t("compatible-plugins") });
		new Setting(contentEl).setName(t("compatible-plugins")).setHeading();

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

		// Setting for Auto Adding Due Date while creating new Tasks through AddTaskModal
		new Setting(contentEl)
			.setName("Day Planner " + t("plugin-compatibility"))
			.setDesc(t("day-planner-plugin-compatibility"))
			.addToggle((toggle) =>
				toggle
					.setValue(compatiblePlugins.dayPlannerPlugin)
					.onChange(async (value) => {
						this.globalSettings!.compatiblePlugins.dayPlannerPlugin =
							value;
						await this.saveSettings();
					})
			);

		// Setting for choosing the default QuickAdd plugin run command
		const communityPlugins = new CommunityPlugins(this.plugin);
		if (!communityPlugins.isQuickAddPluginEnabled()) {
			this.globalSettings!.compatiblePlugins.quickAddPlugin = false;
			this.saveSettings();
		}
		new Setting(contentEl)
			.setName("QuickAdd " + t("plugin-compatibility"))
			.setDesc(t("quickadd-plugin-compatibility-description"))
			.setTooltip(
				t("Install and enable QuickAdd plugin to use this setting.")
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						compatiblePlugins.quickAddPlugin &&
							communityPlugins.isQuickAddPluginEnabled()
					)
					.onChange(async (value) => {
						if (
							this.globalSettings &&
							!communityPlugins.isQuickAddPluginEnabled()
						) {
							new Notice(t("quickadd-plugin-not-enabled"));
							this.globalSettings.compatiblePlugins.quickAddPlugin =
								false;
						} else if (this.globalSettings) {
							this.globalSettings.compatiblePlugins.quickAddPlugin =
								value;

							this.openReloadNoticeIfNeeded();
						}

						await this.saveSettings();
					})
			)
			.setDisabled(!communityPlugins.isQuickAddPluginEnabled());

		new Setting(contentEl)
			.setName(t("default-quickadd-choice"))
			.setDesc(t("default-quickadd-choice-description"))
			.setTooltip(t("Enable the above setting to use this setting."))
			.addText((text) => {
				text.setValue(quickAddPluginDefaultChoice).onChange((value) => {
					if (this.globalSettings)
						this.globalSettings.quickAddPluginDefaultChoice = value;
				});

				const inputEl = text.inputEl;
				const suggestionContent = getQuickAddPluginChoices(
					this.app,
					communityPlugins.quickAddPlugin
				);
				const onSelectCallback = async (selectedChoiceName: string) => {
					if (this.globalSettings) {
						this.globalSettings.quickAddPluginDefaultChoice =
							selectedChoiceName;
					}
					text.setValue(selectedChoiceName);
					await this.saveSettings();
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app
				);
			})
			.setDisabled(
				!this.globalSettings!.compatiblePlugins.quickAddPlugin
			);

		new Setting(contentEl)
			.setName(t("push-notification-compatibility"))
			.setDesc(t("push-notification-compatibility-description"))
			.addDropdown((dropdown) => {
				dropdown.addOption(NotificationService.None, t("none"));
				dropdown.addOption(
					NotificationService.ReminderPlugin,
					"Reminder " + t("plugin")
				);
				// dropdown.addOption(
				// 	NotificationService.NotifianApp,
				// 	"Notifian " + t("app")
				// );
				dropdown.addOption(
					NotificationService.ObsidApp,
					"Obsi " + t("app")
				);

				dropdown.setValue(notificationService as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.notificationService = value;
					await this.saveSettings();
				});
			});

		new Setting(contentEl)
			.setName(t("frontmatter-property-for-reminder"))
			.setDesc(t("frontmatter-property-for-reminder-description"))
			.addText((text) => {
				text.setValue(frontmatterPropertyForReminder)
					.onChange((value) => {
						if (this.globalSettings)
							this.globalSettings.frontmatterPropertyForReminder =
								value;
						this.saveSettings();
					})
					.setPlaceholder("eg.: reminder");

				// const inputEl = text.inputEl;
				// const suggestionContent = getFrontmatterPropertyNames(
				// 	this.plugin
				// );
				// const onSelectCallback = async (selectedPath: string) => {
				// 	if (this.globalSettings) {
				// 		this.globalSettings.quickAddPluginDefaultChoice =
				// 			selectedPath;
				// 	}
				// 	text.setValue(selectedPath);
				// 	await this.saveSettings();
				// };

				// new MultiSuggest(
				// 	inputEl,
				// 	new Set(suggestionContent),
				// 	onSelectCallback,
				// 	this.app
				// );
			});
	}

	// Function to render "Task formats" tab content
	private renderFormatsTabSettings(contentEl: HTMLElement) {
		// contentEl.createEl("p", {
		// 	text: t("format-section-description"),
		// 	cls: "taskBoard-tab-section-desc",
		// });

		const {
			universalDateFormat,
			defaultStartTime,
			taskPropertyFormat,
			// taskCompletionDateTimePattern,
			firstDayOfWeek,
			taskCompletionInLocalTime,
			taskCompletionShowUtcOffset,
		} = this.globalSettings!;

		// Create the live preview element
		const previewEl = contentEl.createDiv({
			cls: "global-setting-tab-live-preview",
		});

		const readingPreviewLabel = previewEl.createDiv({
			cls: "global-setting-tab-reading-mode-preview-label",
		});
		readingPreviewLabel.setText(t("reading-mode-preview"));
		// Render markdown preview above the raw preview
		const markdownPreviewEl = previewEl.createDiv({
			cls: "global-setting-tab-reading-mode-preview-markdown",
		});

		const sourcePreviewLabel = previewEl.createDiv({
			cls: "global-setting-tab-source-mode-preview-label",
		});
		sourcePreviewLabel.setText(t("source-mode-preview"));
		const previewData = previewEl.createDiv({
			cls: "global-setting-tab-source-mode-preview-data",
		});

		// Helper to render markdown using MarkdownUIRenderer
		const renderMarkdownPreview = (markdown: string) => {
			// Remove previous preview if any
			markdownPreviewEl.empty();
			// Use Obsidian's MarkdownUIRenderer to render markdown
			// @ts-ignore
			MarkdownUIRenderer.renderSubtaskText(
				this.plugin.app,
				markdown,
				markdownPreviewEl,
				"",
				this.plugin.view
			);
		};
		const updatePreview = () => {
			let taskTitle = t("dummy-task-title");
			let priority = "⏫";
			let time = "10:00 - 11:00";
			let universalDateEmoji = "";
			let universalDateString = "";
			if (
				this.globalSettings?.universalDate ===
				UniversalDateOptions.startDate
			) {
				universalDateEmoji =
					TASKS_PLUGIN_DEFAULT_SYMBOLS.startDateSymbol;
				universalDateString = "start";
			} else if (
				this.globalSettings?.universalDate ===
				UniversalDateOptions.scheduledDate
			) {
				universalDateEmoji =
					TASKS_PLUGIN_DEFAULT_SYMBOLS.scheduledDateSymbol;
				universalDateString = "scheduled";
			} else if (
				this.globalSettings?.universalDate ===
				UniversalDateOptions.dueDate
			) {
				universalDateEmoji = TASKS_PLUGIN_DEFAULT_SYMBOLS.dueDateSymbol;
				universalDateString = "due";
			}
			let date = "2024-09-21";
			let tags = `#tag #test`;
			let completionDate = "2024-09-21/12:20:33";

			let preview = "";
			switch (this.globalSettings!.taskPropertyFormat) {
				// Default
				case "1": {
					if (
						this.globalSettings!.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} ${priority} ${universalDateEmoji}${date} ${tags} ✅${completionDate}`;
					} else {
						preview = `- [>] ${taskTitle} ${priority} ⏰[${time}] ${universalDateEmoji}${date} ${tags} ✅${completionDate}`;
					}
					break;
				}
				// Tasks Plugin
				case "2": {
					if (
						this.globalSettings!.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} ${priority} ${universalDateEmoji} ${date} ${tags} ✅ ${
							completionDate.split("/")[0]
						}`;
					} else {
						preview = `- [>] ${taskTitle} ${priority} ⏰ ${time} ${universalDateEmoji} ${date} ${tags} ✅${
							completionDate.split("/")[0]
						}`;
					}
					break;
				}
				// Dataview Plugin
				case "3": {
					if (
						this.globalSettings!.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} [priority:: 2] [${universalDateString}:: ${date}] ${tags} [completion:: ${completionDate}]`;
					} else {
						preview = `- [>] ${taskTitle} [priority:: 2] [time:: ${time}] [${universalDateString}:: ${date}] ${tags} [completion:: ${completionDate}]`;
					}
					break;
				}
				// Obsidian Native
				case "4": {
					if (
						this.globalSettings!.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} @priority(2) @${universalDateString}(${date}) ${tags} @completion(${completionDate})`;
					} else {
						preview = `- [>] ${taskTitle} @priority(2) @time(${time}) @${universalDateString}(${date}) ${tags} @completion(${completionDate})`;
					}
					break;
				}
			}
			renderMarkdownPreview(preview);
			previewData.setText(preview);
		};

		// Setting for Due and Completion Date-Time pattern format
		new Setting(contentEl)
			.setName(t("supported-plugin-formats"))
			.setDesc(t("supported-plugin-formats-info"))
			.addDropdown((dropdown) => {
				dropdown.addOption(
					taskPropertyFormatOptions.default,
					t("default")
				);
				dropdown.addOption(
					taskPropertyFormatOptions.tasksPlugin,
					"Tasks " + t("plugin")
				);
				dropdown.addOption(
					taskPropertyFormatOptions.dataviewPlugin,
					"Dataview " + t("plugin")
				);
				dropdown.addOption(
					taskPropertyFormatOptions.obsidianNative,
					"Obsidian " + t("native")
				);

				dropdown.setValue(taskPropertyFormat as string);
				dropdown.onChange(async (value) => {
					this.globalSettings!.taskPropertyFormat = value;
					await this.saveSettings();
					updatePreview();

					this.openReloadNoticeIfNeeded();
				});
			});

		new Setting(contentEl)
			.setName(t("universal-date"))
			.setDesc(t("universal-date-description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[UniversalDateOptions.startDate]: t("start-date"),
						[UniversalDateOptions.scheduledDate]:
							t("scheduled-date"),
						[UniversalDateOptions.dueDate]: t("due-date"),
					})
					.setValue(this.globalSettings!.universalDate)
					.onChange(async (value) => {
						this.globalSettings!.universalDate =
							value as UniversalDateOptions;
						await this.saveSettings();
						updatePreview(); // Update the preview when the universal date changes
					})
			);

		// Text input for the universalDateFormat
		new Setting(contentEl)
			.setName(t("universal-date-format"))
			.setDesc(t("universal-date-format-info"))
			.addText((text) =>
				text
					.setValue(universalDateFormat)
					.onChange(async (value) => {
						this.globalSettings!.universalDateFormat = value;
						await this.saveSettings();
						updatePreview(); // Update the preview when the text pattern changes
					})
					.setPlaceholder("YYYY-MM-DD")
			);

		// Text input for the default startime
		new Setting(contentEl)
			.setName(t("default-start-time"))
			.setDesc(t("default-start-time-info"))
			.addText((text) =>
				text
					.setValue(defaultStartTime)
					.onChange(async (value) => {
						this.globalSettings!.defaultStartTime = value;
						await this.saveSettings();
					})
					.setPlaceholder("eg.: 00:00 or 23:59")
			);

		// Text input for the taskCompletionDateTimePattern
		// new Setting(contentEl)
		// 	.setName(t("task-completion-date-time-pattern"))
		// 	.setDesc(t("task-completion-date-time-pattern-info"))
		// 	.addText((text) =>
		// 		text
		// 			.setValue(taskCompletionDateTimePattern)
		// 			.onChange(async (value) => {
		// 				this.globalSettings!.taskCompletionDateTimePattern =
		// 					value;
		// 				await this.saveSettings();
		// 				updatePreview();
		// 			})
		// 			.setPlaceholder("YYYY-MM-DD/HH:mm")
		// 	);

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
