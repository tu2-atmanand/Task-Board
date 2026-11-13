// src/views/TaskBoardSettingTab.ts

import { t } from "i18next";
import {
	App,
	getIcon,
	normalizePath,
	Notice,
	Platform,
	PluginSettingTab,
	setIcon,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
} from "obsidian";
import TaskBoard from "../../main.js";
import { PropertyConfigurationModal } from "../ui/modals/PropertyConfigurationModal.js";
import {
	CustomPriority,
	CustomStatus,
	globalSettingsData,
	SupportedPropertiesConfig,
} from "../interfaces/GlobalSettings.js";
import {
	EditButtonMode,
	mapViewArrowDirection,
	mapViewBackgrounVariantTypes,
	mapViewEdgeType,
	mapViewNodeMapOrientation,
	mapViewScrollAction,
	NotificationService,
	PropertyTypeConfig,
	RibbonIconActions,
	scanModeOptions,
	statusTypeNames,
	TagColorType,
	taskCardStyleNames,
	taskPropertyFormatOptions,
	UniversalDateOptions,
} from "../interfaces/Enums.js";
import {
	buyMeCoffeeSVGIcon,
	kofiSVGIcon,
	TaskBoardIcon,
} from "../interfaces/Icons.js";
import { SettingsManager, SettingsTabPagesKey } from "./SettingConstructUI.js";
import { CURRENT_PLUGIN_VERSION } from "../interfaces/Constants.js";
import { setSettingsScope } from "./ScopeSettings.js";
import {
	exportConfigurations,
	importConfigurations,
	showReloadObsidianNotice,
} from "./SettingSynchronizer.js";
import { createFragmentWithHTML } from "../utils/UIHelpers.js";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { downloadAndApplyLanguageFile } from "../utils/lang/helper.js";
import { moveTasksCacheFileToNewPath } from "../utils/JsonFileOperations.js";
import Sortable from "sortablejs";
import { MarkdownUIRenderer } from "../services/MarkdownUIRenderer.js";

import { CustomStatusModal } from "../ui/modals/CustomStatusConfigurator.js";
import { CustomPriorityModal } from "../ui/modals/CustomPriorityConfigurator.js";
import { fetchTasksPluginCustomStatuses } from "../services/tasks_plugin/helpers.js";
import {
	normalizeTaskIconValue,
	openIconPickerModal,
	showIconPicker,
} from "../ui/modals/icon_picker/index.js";
import {
	getFileSuggestions,
	getFolderSuggestions,
	getQuickAddPluginChoices,
	MultiSuggest,
} from "../services/MultiSuggest.js";
import { TASKS_PLUGIN_DEFAULT_SYMBOLS } from "../utils/regular_expressions/TasksPluginRegularExpr.js";
import { openScanFiltersModal } from "../ui/modals/OpenModals.js";
import { CommunityPlugins } from "../services/CommunityPlugins.js";
import { isValid, parse, format, differenceInHours } from "date-fns";
import { showColorPicker } from "../ui/modals/color_picker/ColorPickerModal.js";

/**
 * Filters tab — list of user-defined filter sets.
 */
export function buildNativeSettingsDocsAction(title: string, target: string) {
	return {
		action: {
			label: t("settings", "openDocumentationFor", { name: title }),
			docsTarget: target,
			onClick: () => {
				// Implementation pending
				// This will open a specific docs link in browser.
				// Need to keep a mapping of docs id and link to docs.
				// runSettingsAsync("settings docs link open failed", () =>
				// 	openTaskBoardDocsLink(
				// 		this.app,
				// 		target,
				// 	),
				// );
			},
		},
	};
}

/** Decorate the containing declarative page without replacing its searchable items. */
export function attachDeclarativeSettingsPageTitleAction(
	settingEl: HTMLElement,
	pageTitle: string,
	action: NativeSettingsDocsActionOptions | NativeSettingsDocsActionOptions[],
): (() => void) | undefined {
	// Declarative page definitions do not expose title actions. Fail closed if the
	// native page structure or title differs (for example, a search preview).
	const pageEl = settingEl.closest(".setting-page");
	const titlebarEl = pageEl?.querySelector<HTMLElement>(
		".setting-page-titlebar",
	);
	const titleEl = titlebarEl?.querySelector<HTMLElement>(
		".setting-page-title",
	);
	if (
		!titlebarEl ||
		titlebarEl.parentElement !== pageEl ||
		titleEl?.parentElement !== titlebarEl ||
		titleEl.textContent !== pageTitle ||
		titlebarEl.querySelector(
			".task-board-native-settings-page-title-docs-action",
		)
	)
		return;

	const hadScope = titlebarEl.classList.contains("task-board-settings-scope");
	setSettingsScope(titlebarEl, true);
	const anchors = (Array.isArray(action) ? action : [action]).map((item) => {
		const button = renderNativeSettingsPageTitleAction(
			titlebarEl,
			item,
			true,
		);
		return (
			button.closest(".task-board-settings-docs-tooltip-anchor") ?? button
		);
	});
	return () => {
		for (const anchor of anchors) anchor.remove();
		if (
			!titlebarEl.querySelector(
				".task-board-native-settings-page-title-docs-action",
			)
		) {
			titlebarEl.removeClass(
				"task-board-native-settings-page-titlebar-with-docs",
			);
			if (!hadScope) setSettingsScope(titlebarEl, false);
		}
	};
}

export interface NativeSettingsDocsActionOptions {
	label: string;
	docsTarget: string;
	onClick: () => void;
}

export interface NativeSettingsSectionOptions {
	action?: NativeSettingsDocsActionOptions;
}

export function renderNativeSettingsPageTitleAction(
	titlebarEl: HTMLElement,
	action: NativeSettingsDocsActionOptions,
	append = false,
): HTMLButtonElement {
	titlebarEl.addClass("task-board-native-settings-page-titlebar-with-docs");
	const existingButton = append
		? null
		: titlebarEl.querySelector<HTMLButtonElement>(
				".task-board-native-settings-page-title-docs-action",
			);
	const existingTooltipAnchor = existingButton?.closest(
		".task-board-settings-docs-tooltip-anchor",
	);
	if (existingTooltipAnchor) existingTooltipAnchor.remove();
	else existingButton?.remove();

	const actionButton = titlebarEl.createEl("button", {
		cls: "clickable-icon task-board-native-settings-page-title-docs-action",
		attr: {
			type: "button",
			"aria-label": action.label,
		},
	});
	setIcon(actionButton, "circle-question-mark");
	actionButton.addEventListener("click", () => {
		action.onClick();
	});
	return actionButton;
}

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	globalSettings: globalSettingsData;
	icon: string = TaskBoardIcon;
	private reloadNoticeAlreadyShown = false;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
		this.globalSettings = this.plugin.settings.data;
		this.settingsManager = new SettingsManager(plugin);
	}

	// Display the settings in the settings tab
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		void this.settingsManager.constructUI(containerEl, t("task-board"));
	}

	// Function to save settings back to data.json
	async saveSettings(): Promise<void> {
		if (!this.globalSettings) return;

		try {
			this.plugin.settings.data = this.globalSettings;
			await this.plugin.saveSettings();
		} catch (err) {
			bugReporterManagerInsatance.showNotice(
				43,
				"Failed to save settings",
				err as string,
				"TaskBoardSettingConstructUI.ts/SettingsManager/saveSettings",
			);
		}
	}

	/**
	 * Shows an Obsidian Notice to reload the application.
	 * It tracks if such a notice has already been shown.
	 * If already shown, will not show again.
	 * @returns void
	 */
	private openReloadNoticeIfNeeded() {
		if (!this.reloadNoticeAlreadyShown) {
			window.setTimeout(() => {
				void showReloadObsidianNotice(this.plugin);
				this.reloadNoticeAlreadyShown = true;
			}, 500);
		}
	}

	private updateNativeSettingsDefinitions(): void {
		this.update();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.containerEl.addClass("TaskBoardSettingTab");
		const customStatusAliases =
			this.globalSettings.customStatuses?.flatMap((status) => [
				status.name,
				status.symbol,
			]) ?? [];
		const tagColorAliases =
			this.globalSettings.tagColors?.map((tagColor) => tagColor.name) ??
			[];
		const scanningModeDescription = () =>
			createFragmentWithHTML(
				t("scanning-mode-info") +
					"<br/>" +
					"<ul>" +
					"<li>" +
					"<b>" +
					t("balanced") +
					"</b>" +
					" : " +
					t("balanced-scanning-mode-info") +
					"</li>" +
					"<li>" +
					"<b>" +
					t("real-time") +
					"</b>" +
					" : " +
					t("real-time-scanning-mode-info") +
					"</li>" +
					"<li>" +
					"<b>" +
					t("manual") +
					"</b>" +
					" : " +
					t("manual-scanning-mode-info") +
					"</li>" +
					"</ul>",
			);

		// Setting for choosing the default QuickAdd plugin run command
		const communityPlugins = new CommunityPlugins(this.plugin);
		if (!communityPlugins.isQuickAddPluginEnabled()) {
			this.globalSettings.compatiblePlugins.quickAddPlugin = false;
			void this.saveSettings();
		}

		return [
			// This is a simple group to show release notes and docs buttons.
			{
				type: "group",
				items: [
					{
						name: t("task-board") + " " + CURRENT_PLUGIN_VERSION,
						desc: t("release-notes-setting-button-info"),
						searchable: false,
						render: (setting) => {
							setting.settingEl.addClass(
								"task-board-release-notes-overview-setting",
							);
							setting
								.setName(
									t("task-board") +
										" " +
										CURRENT_PLUGIN_VERSION,
								)
								.setDesc(t("release-notes-setting-button-info"))
								.addButton((button) => {
									button
										.setButtonText(t("release-notes"))
										.onClick(() => {
											new Notice("Not Implemented!");
											// scopeSettingsModal(
											// 	new TaskBoardReleaseNotesModal(
											// 		this.app,
											// 		getReleaseNotesForManualView(),
											// 		{
											// 			docsFolder:
											// 				this.settings
											// 					.task-boardDocsFolder,
											// 		},
											// 	),
											// 	true,
											// ).open();
										});
								});
						},
					},
					{
						name: t("task-board-docs"),
						desc: t("task-board-docs-setting-info"),
						searchable: false,
						render: (setting) => {
							setting.settingEl.addClass(
								"task-board-docs-overview-setting",
							);
							setting
								.setName(t("task-board-docs"))
								.setDesc(t("task-board-docs-setting-info"))
								.addButton((button) => {
									button
										.setButtonText(t("open-docs"))
										.onClick(() => {
											new Notice("Not Implemented!");
											// scopeSettingsModal(
											// 	new TaskBoardReleaseNotesModal(
											// 		this.app,
											// 		getReleaseNotesForManualView(),
											// 		{
											// 			docsFolder:
											// 				this.settings
											// 					.task-boardDocsFolder,
											// 		},
											// 	),
											// 	true,
											// ).open();
										});
								});
						},
					},
				],
			},
			// General page
			{
				type: "page",
				name: t("general"),
				items: [
					{
						type: "group",
						heading: t("filters-for-scanning"),
						cls: "task-board-settings-tab-filters-for-scanning-container",
						items: [
							{
								name: "",
								desc: createFragmentWithHTML(
									t(
										"name-of-the-file-folder-tag-for-filter-info",
									) +
										"<br/>" +
										"<b>" +
										t("note") +
										" :</b> " +
										t(
											"name-of-the-file-folder-tag-for-filter-info-2",
										),
								),
								render: (setting) =>
									this.renderFiltersForScanningContainer(
										setting.settingEl,
									),
							},
						],
					},
					{
						type: "group",
						heading: t("scanning"),
						items: [
							{
								name: t("scanning-mode"),
								desc: scanningModeDescription(),
								render: (setting) => {
									setting
										.setName(t("scanning-mode"))
										.setDesc(scanningModeDescription())
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[scanModeOptions.AUTOMATIC]:
														t("balanced"),
													[scanModeOptions.REAL_TIME]:
														t("real-time"),
													[scanModeOptions.MANUAL]:
														t("manual"),
												})
												.setValue(
													this.globalSettings
														.scanMode,
												)
												.onChange(async (value) => {
													this.globalSettings.scanMode =
														value as scanModeOptions;
													await this.saveSettings();

													this.openReloadNoticeIfNeeded();
												}),
										);
								},
							},
							{
								name: t(
									"show-modified-files-message-on-startup",
								),
								desc: t(
									"show-modified-files-message-on-startup-info",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"show-modified-files-message-on-startup",
											),
										)
										.setDesc(
											t(
												"show-modified-files-message-on-startup-info",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.showModifiedFilesNotice,
												)
												.onChange((value) => {
													this.globalSettings.showModifiedFilesNotice =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("ribbon-icon-action"),
								desc: t("ribbon-icon-action-info"),
								render: (setting) => {
									setting
										.setName(t("ribbon-icon-action"))
										.setDesc(t("ribbon-icon-action-info"))
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[RibbonIconActions.lastBoard]:
														t("last-viewed-board"),
													[RibbonIconActions.allBoardsMenu]:
														t("all-boards-menu"),
													[RibbonIconActions.boardsExplorer]:
														t("boards-explorer"),
												})
												.setValue(
													this.globalSettings
														.ribbonIconAction,
												)
												.onChange((value) => {
													this.globalSettings.ribbonIconAction =
														value as RibbonIconActions;
													void this.saveSettings();
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("interface-language"),
						items: [
							{
								name: t("update-language-translations"),
								render: (setting) => {
									setting
										.setName(
											t("update-language-translations"),
										)
										.setDesc(
											createFragmentWithHTML(
												t(
													"update-language-translations-info",
												) +
													" <a href='https://tu2-atmanand.github.io/task-board-docs/docs/Advanced/Contribution_For_Languages/'>" +
													t("task-board-docs") +
													".",
											),
										)
										.addButton((button) =>
											button
												.setButtonText("Update")
												.onClick(async () => {
													const result =
														await downloadAndApplyLanguageFile(
															this.plugin,
														);
													if (result) {
														this.openReloadNoticeIfNeeded();
													}
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("advanced"),
						items: [
							{
								name: t("tasks-cache-file-path"),
								render: (setting) => {
									let newPath =
										this.globalSettings.tasksCacheFilePath;
									setting
										.setClass(
											"taskBoard-settings-wide-input",
										)
										.setName(t("tasks-cache-file-path"))
										.setDesc(
											createFragmentWithHTML(
												t(
													"tasks-cache-file-path-description",
												) +
													"<br/>" +
													t(
														"tasks-cache-file-path-description-2",
													),
											),
										)
										.addText((text) => {
											text.setValue(newPath).onChange(
												(editedPath: string) => {
													if (
														editedPath.endsWith(
															".json",
														)
													) {
														newPath =
															normalizePath(
																editedPath,
															);
													} else {
														newPath = normalizePath(
															editedPath +
																"/task-board-cache.json",
														);
													}
												},
											);

											// const inputEl = text.inputEl;
											// const suggestionContent = getFolderSuggestions(this.app);
											// const onSelectCallback = async (selectedPath: string) => {
											// 	let newPath = "";
											// 	if (this.globalSettings) {
											// 		if (selectedPath.endsWith(".json")) {
											// 			this.globalSettings.tasksCacheFilePath =
											// 				selectedPath;
											// 			newPath = selectedPath;
											// 		} else {
											// 			newPath = normalizePath(
											// 				selectedPath + "/task-board-cache.json",
											// 			);
											// 			this.globalSettings.tasksCacheFilePath =
											// 				newPath;
											// 		}
											// 	}
											// 	renderTasksCachePathSetting();
											// 	void this.saveSettings();
											// };

											// new MultiSuggest(
											// 	inputEl,
											// 	new Set(suggestionContent),
											// 	onSelectCallback,
											// 	this.app,
											// );
										})
										.addButton((button) =>
											button
												.setButtonText(t("transfer"))
												.onClick(async () => {
													const result =
														await moveTasksCacheFileToNewPath(
															this.app,
															this.globalSettings
																.tasksCacheFilePath,
															newPath,
														);
													if (result) {
														this.globalSettings.tasksCacheFilePath =
															newPath;
														void this.saveSettings();

														this.renderTab();
														new Notice(
															`Task Board cache file path changed to new location succussfully. New location : ${this.globalSettings.tasksCacheFilePath}`,
														);
													} else {
														new Notice(
															"Task board : Failed to change the path. Check logs for more info.",
														);
														this.globalSettings.tasksCacheFilePath = `${this.app.vault.configDir}/plugins/task-board/tasks.json`;
														void this.saveSettings();

														this.renderTab();
													}
												}),
										)
										.addButton((button) =>
											button
												.setButtonText(t("reset"))
												.onClick(async () => {
													newPath = `${this.app.vault.configDir}/plugins/task-board/tasks.json`;

													const result =
														await moveTasksCacheFileToNewPath(
															this.app,
															this.globalSettings
																.tasksCacheFilePath,
															newPath,
														);

													if (result) {
														this.globalSettings.tasksCacheFilePath =
															newPath;
														void this.saveSettings();

														this.renderTab();
														new Notice(
															`Task board cache file path reset was succussfully.`,
														);
													} else {
														new Notice(
															"Task board : Failed to change the path. Check logs for more info.",
														);
														this.globalSettings.tasksCacheFilePath = `${this.app.vault.configDir}/plugins/task-board/tasks.json`;
														void this.saveSettings();

														this.renderTab();
													}

													this.renderTab();
												}),
										);
								},
							},
							{
								name: t("import-export-configurations"),
								desc: t("import-export-configurations-info"),
								render: (setting) => {
									setting
										.setName(
											t("import-export-configurations"),
										)
										.setDesc(
											t(
												"import-export-configurations-info",
											),
										)
										.addButton((button) =>
											button
												.setButtonText(t("import"))
												.onClick(() => {
													void importConfigurations(
														this.plugin,
													).then((result) => {
														if (result) {
															this.openReloadNoticeIfNeeded();
														}
													});
												}),
										)
										.addButton((button) =>
											button
												.setButtonText(t("export"))
												.onClick(() => {
													void exportConfigurations(
														this.plugin,
													);
												}),
										);
								},
							},
							// {
							// 	name: "Safeguard feature",
							// 	desc: createFragmentWithHTML(
							// 		"This feature helps to ensure that task board should only update the task content in the note. It shows you a conflict in the content if this plugin couldnt able to find the exact match in the current note." +
							// 			"<br/>" +
							// 			"<br/>" +
							// 			"<b>" +
							// 			"NOTE : " +
							// 			"</b>" +
							// 			"Disabling this feature will by-pass the security check which might lead to unwanted behavior like tempering the content of other inline-tasks right below the intended task. Only disable this feature if you feel this modal is popping-up too many times and also its irrelevant as the content is properly getting edited and matched. Obsidian definitely provides a file recovery feature, but also ensure you are taking care of you data." +
							// 			"<br/>" +
							// 			"This setting was provided on the request of few users to tempararily disable safe-guard. In upcoming releasing, will remove this setting if everything is working as expected and safe-guard will be always doing the security checks.",
							// 	),
							// 	render: (setting) => {
							// 		setting
							// 			.setName("Safeguard feature")
							// 			.setDesc(
							// 				createFragmentWithHTML(
							// 					"This feature helps to ensure that task board should only update the task content in the note. It shows you a conflict in the content if this plugin couldnt able to find the exact match in the current note." +
							// 						"<br/>" +
							// 						"<br/>" +
							// 						"<b>" +
							// 						"NOTE : " +
							// 						"</b>" +
							// 						"Disabling this feature will by-pass the security check which might lead to unwanted behavior like tempering the content of other inline-tasks right below the intended task. Only disable this feature if you feel this modal is popping-up too many times and also its irrelevant as the content is properly getting edited and matched. Obsidian definitely provides a file recovery feature, but also ensure you are taking care of you data." +
							// 						"<br/>" +
							// 						"This setting was provided on the request of few users to tempararily disable safe-guard. In upcoming releasing, will remove this setting if everything is working as expected and safe-guard will be always doing the security checks.",
							// 				),
							// 			)
							// 			.addToggle((toggle) =>
							// 				toggle
							// 					.setValue(this.globalSettings.safeGuardFeature)
							// 					.onChange((value) => {
							// 						this.globalSettings.safeGuardFeature =
							// 							value;
							// 						void this.saveSettings();

							// 						this.openReloadNoticeIfNeeded();
							// 					}),
							// 			);
							// 	},
							// },
						],
					},
					{
						type: "group",
						heading: t("debugging"),
						items: [
							{
								name: t("export-logs"),
								desc: t("export-logs-info"),
								render: (setting) => {
									setting
										.setName(t("export-logs"))
										.setDesc(t("export-logs-info"))
										.addButton((button) =>
											button
												.setButtonText(t("export"))
												.onClick(() => {
													void bugReporterManagerInsatance.exportLogFile();
												}),
										);
								},
							},
						],
					},
				],
			},
			// All UI page
			{
				type: "page",
				name: t("all-ui"),
				items: [
					{
						type: "group",
						heading: t("appearance"),
						items: [
							{
								name: t("task-card-style"),
								desc: t("task-card-style-info"),
								render: (setting) => {
									setting
										.setName(t("task-card-style"))
										.setDesc(t("task-card-style-info"))
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[taskCardStyleNames.EMOJI]:
														t("tasks-plugin-emoji"),
													// [taskCardStyleNames.ICONS]: t("lucide-icons"),
													[taskCardStyleNames.BASES]:
														t("bases-cards-style"),
													// [taskCardStyleNames.DATAVIEW]: t("dataview-style"),
												})
												.setValue(
													this.globalSettings
														.taskCardStyle,
												)
												.onChange((value) => {
													this.globalSettings.taskCardStyle =
														value as taskCardStyleNames;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("show-task-without-metadata"),
								desc: t("show-task-without-metadata-info"),
								render: (setting) => {
									setting
										.setName(
											t("show-task-without-metadata"),
										)
										.setDesc(
											t(
												"show-task-without-metadata-info",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.showTaskWithoutMetadata,
												)
												.onChange((value) => {
													this.globalSettings.showTaskWithoutMetadata =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("width-of-task-card"),
								desc: t(
									"enter-the-value-of-width-for-task-card",
								),
								render: (setting) => {
									setting
										.setName(t("width-of-task-card"))
										.setDesc(
											t(
												"enter-the-value-of-width-for-task-card",
											),
										)
										.addText((text) =>
											text
												.setValue(
													this.globalSettings
														.columnWidth,
												)
												.onChange((value) => {
													this.globalSettings.columnWidth =
														value;
													void this.saveSettings();
												})
												.setPlaceholder("300"),
										);
								},
							},
							{
								name: t("show-column-scroll-bar"),
								desc: t(
									"enable-to-see-a-scrollbar-for-each-column",
								),
								render: (setting) => {
									setting
										.setName(t("show-column-scroll-bar"))
										.setDesc(
											t(
												"enable-to-see-a-scrollbar-for-each-column",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.showVerticalScroll,
												)
												.onChange((value) => {
													this.globalSettings.showVerticalScroll =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("interactions"),
						items: [
							{
								name: t("edit-button-mode"),
								desc: t("edit-button-mode-info"),
								render: (setting) => {
									setting
										.setName(t("edit-button-mode"))
										.setDesc(t("edit-button-mode-info"))
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[EditButtonMode.Modal]: t(
														"use-edit-task-modal-feature",
													),
													[EditButtonMode.ViewInSplitTab]:
														t("task-editor-tab"),
													[EditButtonMode.TasksPluginModal]:
														t("tasks-plugin-modal"),
													[EditButtonMode.NoteInTab]:
														t(
															"open-note-in-new-tab",
														),
													[EditButtonMode.NoteInSplit]:
														t(
															"open-note-in-right-split",
														),
													[EditButtonMode.NoteInWindow]:
														t(
															"open-note-in-new-window",
														),
													[EditButtonMode.NoteInHover]:
														t(
															"open-note-in-hover-preview",
														),
												})
												.setValue(
													this.globalSettings
														.editButtonAction,
												)
												.onChange((value) => {
													this.globalSettings.editButtonAction =
														value as EditButtonMode;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("double-click-card-action"),
								desc: t("double-click-card-action-info"),
								render: (setting) => {
									setting
										.setName(t("double-click-card-action"))
										.setDesc(
											t("double-click-card-action-info"),
										)
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[EditButtonMode.None]:
														t("none"),
													[EditButtonMode.Modal]: t(
														"use-edit-task-window-feature",
													),
													[EditButtonMode.NoteInTab]:
														t(
															"open-note-in-new-tab",
														),
													[EditButtonMode.NoteInSplit]:
														t(
															"open-note-in-right-split",
														),
													[EditButtonMode.NoteInWindow]:
														t(
															"open-note-in-new-window",
														),
													[EditButtonMode.NoteInHover]:
														t(
															"open-note-in-hover-preview",
														),
												})
												.setValue(
													this.globalSettings
														.cardDoubleClickAction,
												)
												.onChange((value) => {
													this.globalSettings.cardDoubleClickAction =
														value as EditButtonMode;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("drag-and-drop"),
								visible: Platform.isMobile,
								render: (setting) => {
									setting
										.setName(t("drag-and-drop"))
										.setDesc(
											createFragmentWithHTML(
												t("drag-and-drop-info") +
													"<ul>" +
													"<li><b>" +
													t("disable") +
													":</b> " +
													t("drag-and-drop-disable") +
													"</li>" +
													"<li><b>" +
													t("enable") +
													":</b> " +
													t("drag-and-drop-enable") +
													"</li>" +
													"</ul>",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.enableDragnDropTouch,
												)
												.onChange((value) => {
													this.globalSettings.enableDragnDropTouch =
														value;
													void this.saveSettings();

													this.openReloadNoticeIfNeeded();
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("tag-colors"),
						items: [
							{
								name: t("tag-color-indicator-type"),
								desc: t("tag-color-indicator-type-info"),
								render: (setting) => {
									setting
										.setName(t("tag-color-indicator-type"))
										.setDesc(
											t("tag-color-indicator-type-info"),
										)
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[TagColorType.TagText]:
														t("text-of-the-tag"),
													[TagColorType.TagBg]:
														t("tag-background"),
													[TagColorType.CardBg]: t(
														"background-of-the-card",
													),
												})
												.setValue(
													this.globalSettings
														.tagColorsType,
												)
												.onChange((value) => {
													this.globalSettings.tagColorsType =
														value as TagColorType;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								type: "page",
								name: t("configure-tag-colors"),
								items: [
									{
										type: "group",
										cls: "task-board-settings-tab-tag-colors-container",
										items: [
											{
												name: "",
												desc: t(
													"configure-tag-colors-info",
												),
												render: (setting) => {
													this.renderTagColorsConfigurationContainer(
														setting.settingEl,
													);
												},
											},
										],
									},
								],
							},
						],
					},
				],
			},
			// Task properties page
			{
				type: "page",
				name: t("task-properties"),
				items: [
					{
						type: "group",
						items: [
							{
								type: "page",
								name: t("default-properties"),
								desc: t("default-properties-info"),
								items: [
									this.renderPropertiesConfigurationSection(
										this.containerEl,
										"default",
									),
								],
							},
							{
								type: "page",
								name: t("custom-properties"),
								desc: t("custom-properties-info"),
								items: [
									this.renderPropertiesConfigurationSection(
										this.containerEl,
										"custom",
									),
								],
							},
						],
					},
					{
						type: "group",
						heading: t("configure-default-properties"),
						items: [
							{
								type: "page",
								name: t("statuses"),
								desc: t("statuses-configuration-info"),
								items: [
									{
										type: "group",
										cls: "task-board-settings-custom-statuses-container",
										items: [
											{
												name: "",
												desc: t(
													"statuses-configuration-info",
												),
												render: (setting) =>
													this.renderCustomStatusesTab(
														setting.settingEl,
													),
											},
										],
									},
								],
							},
							{
								type: "page",
								name: t("priorities"),
								desc: t("priorities-configuration-info"),
								items: [
									{
										type: "group",
										cls: "task-board-settings-custom-priorities-container",
										items: [
											{
												name: "",
												desc: t(
													"priorities-configuration-info",
												),
												render: (setting) =>
													this.renderCustomPrioritiesTab(
														setting.settingEl,
													),
											},
										],
									},
								],
							},
						],
					},
				],
			},
			// Views page
			{
				type: "page",
				name: t("views"),
				items: [
					{
						type: "page",
						name: t("map-view"),
						desc: t("map-view-tab-info"),
						items: [
							{
								type: "group",
								items: [
									{
										name: t("dfp-methodology"),
										desc: createFragmentWithHTML(
											t("dfp-methodology-description-1") +
												"<br />" +
												t(
													"dfp-methodology-description-2",
												) +
												" <a href='https://github.com/tu2-atmanand/Task-Board/discussions/400'>" +
												t("dfp-methodology") +
												"." +
												"</a>",
										),
										render: (setting) => {
											setting
												.setName(t("dfp-methodology"))
												.setDesc(
													createFragmentWithHTML(
														t(
															"dfp-methodology-description-1",
														) +
															"<br />" +
															t(
																"dfp-methodology-description-2",
															) +
															" <a href='https://github.com/tu2-atmanand/Task-Board/discussions/400'>" +
															t(
																"dfp-methodology",
															) +
															"." +
															"</a>",
													),
												);
										},
									},
								],
							},
							{
								type: "group",
								heading: t("performance"),
								items: [
									{
										name: t("render-only-visible-nodes"),
										desc: createFragmentWithHTML(
											"<ul>" +
												"<li>" +
												t(
													"render-only-visible-nodes-description-1",
												) +
												"</li>" +
												"<li>" +
												t(
													"render-only-visible-nodes-description-2",
												) +
												"</li>" +
												"</ul>",
										),
										render: (setting) => {
											setting
												.setName(
													t(
														"render-only-visible-nodes",
													),
												)
												.setDesc(
													createFragmentWithHTML(
														"<ul>" +
															"<li>" +
															t(
																"render-only-visible-nodes-description-1",
															) +
															"</li>" +
															"<li>" +
															t(
																"render-only-visible-nodes-description-2",
															) +
															"</li>" +
															"</ul>",
													),
												)
												.addToggle((toggle) =>
													toggle
														.setValue(
															this.globalSettings
																.mapView
																.renderVisibleNodes,
														)
														.onChange((value) => {
															this.globalSettings.mapView.renderVisibleNodes =
																value;
															void this.saveSettings();
														}),
												);
										},
									},
								],
							},
							{
								type: "group",
								heading: t("controls"),
								items: [
									{
										name: t("mouse-wheel-behaviour"),
										desc: t(
											"mouse-wheel-behaviour-description",
										),
										render: (setting) => {
											setting
												.setName(
													t("mouse-wheel-behaviour"),
												)
												.setDesc(
													t(
														"mouse-wheel-behaviour-description",
													),
												)
												.addDropdown((dropdown) =>
													dropdown
														.addOptions({
															[mapViewScrollAction.zoom]:
																t("zoom"),
															[mapViewScrollAction.pan]:
																t("pan"),
														})
														.setValue(
															this.globalSettings
																.mapView
																.scrollAction,
														)
														.onChange((value) => {
															this.globalSettings.mapView.scrollAction =
																value as mapViewScrollAction;
															void this.saveSettings();
														}),
												);
										},
									},
								],
							},
							{
								type: "group",
								heading: t("appearance"),
								items: [
									{
										name: t("canvas-background"),
										desc: t(
											"canvas-background-description",
										),
										render: (setting) => {
											setting
												.setName(t("canvas-background"))
												.setDesc(
													t(
														"canvas-background-description",
													),
												)
												.addDropdown((dropdown) =>
													dropdown
														.addOptions({
															[mapViewBackgrounVariantTypes.none]:
																t("default"),
															[mapViewBackgrounVariantTypes.transparent]:
																t(
																	"transparent",
																),
															[mapViewBackgrounVariantTypes.dots]:
																t("dots"),
															[mapViewBackgrounVariantTypes.lines]:
																t("lines"),
															[mapViewBackgrounVariantTypes.cross]:
																t("cross"),
														})
														.setValue(
															this.globalSettings
																.mapView
																.background,
														)
														.onChange((value) => {
															this.globalSettings.mapView.background =
																value as mapViewBackgrounVariantTypes;
															void this.saveSettings();
														}),
												);
										},
									},
									{
										name: t("map-orientation"),
										desc: t("map-orientation-description"),
										render: (setting) => {
											setting
												.setName(t("map-orientation"))
												.setDesc(
													t(
														"map-orientation-description",
													),
												)
												.addDropdown((dropdown) =>
													dropdown
														.addOptions({
															[mapViewNodeMapOrientation.horizontal]:
																t("horizontal"),
															[mapViewNodeMapOrientation.vertical]:
																t("vertical"),
														})
														.setValue(
															this.globalSettings
																.mapView
																.mapOrientation,
														)
														.onChange((value) => {
															this.globalSettings.mapView.mapOrientation =
																value as mapViewNodeMapOrientation;
															void this.saveSettings();
														}),
												);
										},
									},
									{
										name: t("link-arrow-direction"),
										desc: t(
											"link-arrow-direction-description",
										),
										render: (setting) => {
											setting
												.setName(
													t("link-arrow-direction"),
												)
												.setDesc(
													t(
														"link-arrow-direction-description",
													),
												)
												.addDropdown((dropdown) =>
													dropdown
														.addOptions({
															[mapViewArrowDirection.childToParent]:
																t(
																	"child-to-parent",
																),
															[mapViewArrowDirection.parentToChild]:
																t(
																	"parent-to-child",
																),
															[mapViewArrowDirection.bothWay]:
																t("both-way"),
														})
														.setValue(
															this.globalSettings
																.mapView
																.arrowDirection,
														)
														.onChange((value) => {
															this.globalSettings.mapView.arrowDirection =
																value as mapViewArrowDirection;
															void this.saveSettings();
														}),
												);
										},
									},
									{
										name: t("link-style"),
										desc: t("link-style-description"),
										render: (setting) => {
											setting
												.setName(t("link-style"))
												.setDesc(
													t("link-style-description"),
												)
												.addDropdown((dropdown) =>
													dropdown
														.addOptions({
															[mapViewEdgeType.straight]:
																t("straight"),
															[mapViewEdgeType.step]:
																t("step"),
															[mapViewEdgeType.smoothstep]:
																t(
																	"smooth-step",
																),
															[mapViewEdgeType.bezier]:
																t("curved"),
														})
														.setValue(
															this.globalSettings
																.mapView
																.edgeType,
														)
														.onChange((value) => {
															this.globalSettings.mapView.edgeType =
																value as mapViewEdgeType;
															void this.saveSettings();
														}),
												);
										},
									},
									{
										name: t("animate-links"),
										desc: t("animate-links-description"),
										render: (setting) => {
											setting
												.setName(t("animate-links"))
												.setDesc(
													t(
														"animate-links-description",
													),
												)
												.addToggle((toggle) =>
													toggle
														.setValue(
															this.globalSettings
																.mapView
																.animatedEdges,
														)
														.onChange((value) => {
															this.globalSettings.mapView.animatedEdges =
																value;
															void this.saveSettings();
														}),
												);
										},
									},
									{
										name: t("show-minimap"),
										desc: t("show-minimap-description"),
										render: (setting) => {
											setting
												.setName(t("show-minimap"))
												.setDesc(
													t(
														"show-minimap-description",
													),
												)
												.addToggle((toggle) =>
													toggle
														.setValue(
															this.globalSettings
																.mapView
																.showMinimap,
														)
														.onChange((value) => {
															this.globalSettings.mapView.showMinimap =
																value;
															void this.saveSettings();
														}),
												);
										},
									},
								],
							},
						],
					},
				],
			},
			// Inline tasks page
			{
				type: "page",
				name: t("inline-tasks"),
				items: [
					{
						type: "group",
						items: [
							{
								name: "",
								render: (setting) =>
									this.renderInlineTasksPreviewContainer(
										setting.settingEl,
									),
							},
						],
					},
					{
						type: "group",
						items: [
							{
								name: t("supported-plugin-formats"),
								desc: t("supported-plugin-formats-info"),
								render: (setting) => {
									setting
										.setName(t("supported-plugin-formats"))
										.setDesc(
											t("supported-plugin-formats-info"),
										)
										.addDropdown((dropdown) => {
											dropdown.addOption(
												taskPropertyFormatOptions.default,
												t("default"),
											);
											dropdown.addOption(
												taskPropertyFormatOptions.tasksPlugin,
												"Tasks " + t("plugin"),
											);
											dropdown.addOption(
												taskPropertyFormatOptions.dataviewPlugin,
												"Dataview " + t("plugin"),
											);
											dropdown.addOption(
												taskPropertyFormatOptions.obsidianNative,
												"Obsidian " + t("native"),
											);

											dropdown.setValue(
												this.globalSettings
													.taskPropertyFormat,
											);
											dropdown.onChange((value) => {
												this.globalSettings.taskPropertyFormat =
													value as taskPropertyFormatOptions;
												void this.saveSettings();
												this.renderTab();

												this.openReloadNoticeIfNeeded();
											});
										});
								},
							},
							{
								name: t("default-note-for-adding-new-tasks"),
								desc: t(
									"default-note-for-new-tasks-description",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"default-note-for-adding-new-tasks",
											),
										)
										.setDesc(
											t(
												"default-note-for-new-tasks-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.preDefinedNote,
											).onChange((value) => {
												if (this.globalSettings) {
													const normalized =
														normalizePath(value);
													this.globalSettings.preDefinedNote =
														normalized;
												}
											});

											const inputEl = text.inputEl;
											const suggestionContent =
												getFileSuggestions(this.app);
											const onSelectCallback = (
												selectedPath: string,
											) => {
												if (this.globalSettings) {
													this.globalSettings.preDefinedNote =
														selectedPath;
												}
												text.setValue(selectedPath);
												void this.saveSettings();
											};

											new MultiSuggest(
												inputEl,
												new Set(suggestionContent),
												onSelectCallback,
												this.app,
											);
										});
								},
							},
							{
								name: t("file-for-archived-tasks"),
								desc: t("file-for-archived-tasks-description"),
								render: (setting) => {
									setting
										.setName(t("file-for-archived-tasks"))
										.setDesc(
											t(
												"file-for-archived-tasks-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.archivedTasksFilePath,
											).onChange((value) => {
												if (this.globalSettings) {
													const normalized =
														normalizePath(value);
													this.globalSettings.archivedTasksFilePath =
														normalized;
												}
											});

											const inputEl = text.inputEl;
											const suggestionContent =
												getFileSuggestions(this.app);
											const onSelectCallback = (
												selectedPath: string,
											) => {
												if (this.globalSettings) {
													this.globalSettings.archivedTasksFilePath =
														selectedPath;
												}
												text.setValue(selectedPath);
												void this.saveSettings();
											};

											new MultiSuggest(
												inputEl,
												new Set(suggestionContent),
												onSelectCallback,
												this.app,
											);
										});
								},
							},
							{
								name: t(
									"show-note-frontmatter-tags-in-the-card-header",
								),
								desc: t(
									"show-note-frontmatter-tags-in-the-card-header-info",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"show-note-frontmatter-tags-in-the-card-header",
											),
										)
										.setDesc(
											t(
												"show-note-frontmatter-tags-in-the-card-header-info",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.showFrontmatterTagsOnCards,
												)
												.onChange((value) => {
													this.globalSettings.showFrontmatterTagsOnCards =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
						],
					},
				],
			},
			// Task notes page
			{
				type: "page",
				name: t("task-note"),
				items: [
					{
						type: "group",
						items: [
							{
								name: t("task-note-vs-tbnote"),
								desc: createFragmentWithHTML(
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
										"</ul>",
								),
								// render: (setting) => {
								// 	setting
								// 		.setName(t("task-note-vs-tbnote"))
								// 		.setDesc(
								// 			createFragmentWithHTML(
								// 				"<ul>" +
								// 					"<li><b>" +
								// 					t("task-note") +
								// 					":</b> " +
								// 					t("task-note-description") +
								// 					"</li>" +
								// 					"<li><b>" +
								// 					t("tbnote") +
								// 					":</b> " +
								// 					t("tbnote-description") +
								// 					" <a href='https://github.com/tu2-atmanand/Task-Board/issues/33'>" +
								// 					t(
								// 						"tbnote-development-ticker",
								// 					) +
								// 					"</a></li>" +
								// 					"</ul>",
								// 			),
								// 		);
								// },
							},
						],
					},
					{
						type: "group",
						items: [
							{
								name: t("task-note-identifier-tag"),
								desc: t("task-note-identifier-tag-description"),
								render: (setting) => {
									setting
										.setName(t("task-note-identifier-tag"))
										.setDesc(
											t(
												"task-note-identifier-tag-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.taskNoteIdentifierTag,
											).onChange((value) => {
												if (this.globalSettings)
													this.globalSettings.taskNoteIdentifierTag =
														value
															.trim()
															.replace("#", "");
											});

											const inputEl = text.inputEl;
											// eslint-disable-next-line obsidianmd/ui/sentence-case
											inputEl.placeholder =
												"E.g., taskNote";
										});
								},
							},
							{
								name: t("default-location-for-new-task-notes"),
								desc: t(
									"default-location-for-new-task-notes-description",
								),
								render: (setting) => {
									const folderSuggestions =
										getFolderSuggestions(this.app);

									setting
										.setName(
											t(
												"default-location-for-new-task-notes",
											),
										)
										.setDesc(
											t(
												"default-location-for-new-task-notes-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.taskNoteDefaultLocation,
											).onChange((value) => {
												if (this.globalSettings) {
													const normalized =
														normalizePath(value);
													this.globalSettings.taskNoteDefaultLocation =
														normalized;
												}
											});

											const inputEl = text.inputEl;
											// eslint-disable-next-line obsidianmd/ui/sentence-case
											inputEl.placeholder =
												"E.g., Task Notes/";
											const onSelectCallback = (
												selectedPath: string,
											) => {
												if (this.globalSettings) {
													this.globalSettings.taskNoteDefaultLocation =
														selectedPath;
												}
												text.setValue(selectedPath);
												void this.saveSettings();
											};

											new MultiSuggest(
												inputEl,
												new Set(folderSuggestions),
												onSelectCallback,
												this.app,
											);
										});
								},
							},
							{
								name: t("folder-for-archived-task-notes"),
								desc: t(
									"folder-for-archived-task-notes-description",
								),
								render: (setting) => {
									const folderSuggestions =
										getFolderSuggestions(this.app);
									setting
										.setName(
											t("folder-for-archived-task-notes"),
										)
										.setDesc(
											t(
												"folder-for-archived-task-notes-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.archivedTBNotesFolderPath,
											).onChange((value) => {
												if (this.globalSettings) {
													const normalized =
														normalizePath(value);
													this.globalSettings.archivedTBNotesFolderPath =
														normalized;
												}
											});

											const inputEl = text.inputEl;
											// eslint-disable-next-line obsidianmd/ui/sentence-case
											inputEl.placeholder =
												"e.g., TaskBoard/TaskNotes";
											const onSelectCallback = (
												selectedPath: string,
											) => {
												if (this.globalSettings) {
													this.globalSettings.archivedTBNotesFolderPath =
														selectedPath;
												}
												text.setValue(selectedPath);
												void this.saveSettings();
											};

											new MultiSuggest(
												inputEl,
												new Set(folderSuggestions),
												onSelectCallback,
												this.app,
											);
										});
								},
							},
						],
					},
				],
			},
			// Automations page
			{
				type: "page",
				name: t("automations"),
				items: [
					{
						type: "group",
						items: [
							{
								name: t("auto-add-unique-id"),
								render: (setting) => {
									setting
										.setName(t("auto-add-unique-id"))
										.setDesc(
											createFragmentWithHTML(
												t(
													"auto-add-unique-id-description",
												) +
													"<br/>" +
													"<ul>" +
													"<li>" +
													t("map-view-feature") +
													"</li>" +
													"<li>" +
													t(
														"manual-sorting-inside-each-column-upcoming",
													) +
													"</li>" +
													"<li>" +
													t(
														"pin-tasks-on-top-in-each-column-upcoming",
													) +
													"</li>" +
													"</ul>",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.autoAddUniqueID,
												)
												.onChange((value) => {
													this.globalSettings.autoAddUniqueID =
														value;
													void this.saveSettings();

													this.openReloadNoticeIfNeeded();
												}),
										);
								},
							},
							{
								name: t(
									"restrict-task-completion-to-child-tasks-and-sub-tasks",
								),
								desc: t(
									"restrict-task-completion-to-child-tasks-info",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"restrict-task-completion-to-child-tasks-and-sub-tasks",
											),
										)
										.setDesc(
											t(
												"restrict-task-completion-to-child-tasks-info",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.boundTaskCompletionToChildTasks,
												)
												.onChange((value) => {
													this.globalSettings.boundTaskCompletionToChildTasks =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("auto-add-universal-date-to-tasks"),
								desc: t(
									"auto-add-universal-date-to-tasks-info",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"auto-add-universal-date-to-tasks",
											),
										)
										.setDesc(
											t(
												"auto-add-universal-date-to-tasks-info",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.autoAddUniversalDate,
												)
												.onChange((value) => {
													this.globalSettings.autoAddUniversalDate =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("auto-add-created-date"),
								desc: t("auto-add-created-date-desc"),
								render: (setting) => {
									setting
										.setName(t("auto-add-created-date"))
										.setDesc(
											t("auto-add-created-date-desc"),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.autoAddCreatedDate,
												)
												.onChange((value) => {
													this.globalSettings.autoAddCreatedDate =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("auto-add-completed-date"),
								desc: t("auto-add-completed-date-desc"),
								render: (setting) => {
									setting
										.setName(t("auto-add-completed-date"))
										.setDesc(
											t("auto-add-completed-date-desc"),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.autoAddCompletedDate,
												)
												.onChange((value) => {
													this.globalSettings.autoAddCompletedDate =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: t("auto-add-cancelled-date"),
								desc: t("auto-add-cancelled-date-desc"),
								render: (setting) => {
									setting
										.setName(t("auto-add-cancelled-date"))
										.setDesc(
											t("auto-add-cancelled-date-desc"),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.autoAddCancelledDate,
												)
												.onChange((value) => {
													this.globalSettings.autoAddCancelledDate =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("compatible-plugins"),
						items: [
							{
								name:
									t("daily-notes") +
									t("plugin-compatibility"),
								desc: t("daily-notes-plugin-compatibility"),
								render: (setting) => {
									setting
										.setName(
											t("daily-notes") +
												t("plugin-compatibility"),
										)
										.setDesc(
											t(
												"daily-notes-plugin-compatibility",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.dailyNotesPluginComp,
												)
												.onChange((value) => {
													this.globalSettings.dailyNotesPluginComp =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name:
									"Day Planner " + t("plugin-compatibility"),
								desc: t("day-planner-plugin-compatibility"),
								render: (setting) => {
									setting
										.setName(
											"Day Planner " +
												t("plugin-compatibility"),
										)
										.setDesc(
											t(
												"day-planner-plugin-compatibility",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.compatiblePlugins
														.dayPlannerPlugin,
												)
												.onChange((value) => {
													this.globalSettings.compatiblePlugins.dayPlannerPlugin =
														value;
													void this.saveSettings();
												}),
										);
								},
							},
							{
								name: "QuickAdd " + t("plugin-compatibility"),
								desc: t(
									"quickadd-plugin-compatibility-description",
								),
								disabled:
									!communityPlugins.isQuickAddPluginEnabled(),
								render: (setting) => {
									setting
										.setName(
											"QuickAdd " +
												t("plugin-compatibility"),
										)
										.setDesc(
											t(
												"quickadd-plugin-compatibility-description",
											),
										)
										.addToggle((toggle) => {
											toggle.onChange((value) => {
												if (
													this.globalSettings &&
													!communityPlugins.isQuickAddPluginEnabled()
												) {
													new Notice(
														t(
															"quickadd-plugin-not-enabled",
														),
													);
													this.globalSettings.compatiblePlugins.quickAddPlugin = false;
												} else if (
													this.globalSettings
												) {
													this.globalSettings.compatiblePlugins.quickAddPlugin =
														value;

													this.openReloadNoticeIfNeeded();
												}

												void this.saveSettings();
											});
											// toggle.onClick();
										});
								},
							},
							{
								name: t("default-quickadd-choice"),
								desc: t("default-quickadd-choice-description"),
								disabled:
									!this.globalSettings.compatiblePlugins
										.quickAddPlugin,
								visible:
									communityPlugins.isQuickAddPluginEnabled(),
								render: (setting) => {
									setting
										.setName(t("default-quickadd-choice"))
										.setDesc(
											t(
												"default-quickadd-choice-description",
											),
										)
										.addText((text) => {
											text.setValue(
												this.globalSettings
													.quickAddPluginDefaultChoice,
											).onChange((value) => {
												if (this.globalSettings)
													this.globalSettings.quickAddPluginDefaultChoice =
														value;
											});

											const inputEl = text.inputEl;
											const suggestionContent =
												getQuickAddPluginChoices(
													this.app,
													communityPlugins.quickAddPlugin,
												);
											const onSelectCallback = (
												selectedChoiceName: string,
											) => {
												if (this.globalSettings) {
													this.globalSettings.quickAddPluginDefaultChoice =
														selectedChoiceName;
												}
												text.setValue(
													selectedChoiceName,
												);
												void this.saveSettings();
											};

											new MultiSuggest(
												inputEl,
												new Set(suggestionContent),
												onSelectCallback,
												this.app,
											);
										});
								},
							},
							{
								name: t("push-notification-compatibility"),
								desc: t(
									"push-notification-compatibility-description",
								),
								render: (setting) => {
									setting
										.setName(
											t(
												"push-notification-compatibility",
											),
										)
										.setDesc(
											t(
												"push-notification-compatibility-description",
											),
										)
										.addDropdown((dropdown) => {
											dropdown.addOption(
												NotificationService.None,
												t("none"),
											);
											dropdown.addOption(
												NotificationService.ReminderPlugin,
												"Reminder " + t("plugin"),
											);
											// dropdown.addOption(
											// 	NotificationService.NotifianApp,
											// 	"Notifian " + t("app")
											// );
											dropdown.addOption(
												NotificationService.ObsidApp,
												"Obsi " + t("app"),
											);

											dropdown.setValue(
												this.globalSettings
													.notificationService,
											);
											dropdown.onChange((value) => {
												this.globalSettings.notificationService =
													value as NotificationService;
												void this.saveSettings();
											});
										});
								},
							},
						],
					},
				],
			},
			// Formats page
			{
				type: "page",
				name: t("formats"),
				items: [
					{
						type: "group",
						heading: t("global"),
						items: [
							{
								name: t("universal-date"),
								desc: t("universal-date-description"),
								render: (setting) => {
									setting
										.setName(t("universal-date"))
										.setDesc(
											t("universal-date-description"),
										)
										.addDropdown((dropdown) =>
											dropdown
												.addOptions({
													[UniversalDateOptions.startDate]:
														t("start-date"),
													[UniversalDateOptions.scheduledDate]:
														t("scheduled-date"),
													[UniversalDateOptions.dueDate]:
														t("due-date"),
												})
												.setValue(
													this.globalSettings
														.universalDate,
												)
												.onChange((value) => {
													this.globalSettings.universalDate =
														value as UniversalDateOptions;
													void this.saveSettings();
												}),
										);
								},
							},
						],
					},
					{
						type: "group",
						heading: t("time-and-date"),
						items: [
							{
								name: t("date-format"),
								desc: createFragmentWithHTML(
									t("date-format-info") +
										"<br/>" +
										"<br/>" +
										"<b>" +
										t("note") +
										" :</b> " +
										t("date-format-info-note") +
										"<br/>" +
										"<br/>" +
										"<b>" +
										t("note") +
										" :</b> " +
										t("date-format-date-fns-note") +
										"<a href='https://date-fns.org/v4.1.0/docs/Unicode-Tokens'>" +
										"date-fns library formatting guide." +
										"</a>",
								),
								render: (setting) => {
									const folderSuggestions =
										getFolderSuggestions(this.app);

									setting
										.setClass(
											"taskBoard-settings-wide-input",
										)

										.setName(t("date-format"))
										.setDesc(
											createFragmentWithHTML(
												t("date-format-info") +
													"<br/>" +
													"<br/>" +
													"<b>" +
													t("note") +
													" :</b> " +
													t("date-format-info-note") +
													"<br/>" +
													"<br/>" +
													"<b>" +
													t("note") +
													" :</b> " +
													t(
														"date-format-date-fns-note",
													) +
													"<a href='https://date-fns.org/v4.1.0/docs/Unicode-Tokens'>" +
													"date-fns library formatting guide." +
													"</a>",
											),
										)
										.addText((text) =>
											text
												.setValue(
													this.globalSettings
														.dateFormat,
												)
												.onChange((value) => {
													this.globalSettings.dateFormat =
														value;
													void this.saveSettings();
												})
												// eslint-disable-next-line obsidianmd/ui/sentence-case
												.setPlaceholder("yyyy-MM-dd"),
										)
										.addButton((btn) => {
											btn.setButtonText(t("validate"));
											btn.onClick(() => {
												try {
													const testDate = new Date(
														2026,
														1,
														18,
													); // Fixed reference date: Feb 18, 2026
													const userFormat =
														this.globalSettings
															?.dateFormat;

													if (
														!userFormat ||
														userFormat.trim()
															.length === 0
													) {
														new Notice(
															"Please enter a date format.",
														);
														return;
													}

													// Format the test date using the user's format
													const formattedDate =
														format(
															testDate,
															userFormat,
														);

													// Try to parse it back
													const parsed = parse(
														formattedDate,
														userFormat,
														testDate,
													);

													// (1) Check if parsing succeeded
													if (!isValid(parsed)) {
														new Notice(
															"❌ Invalid date format. Parsing failed.",
															0,
														);
														return;
													}

													// (2) Check if the parsed date is reasonably close (within 48 hours)
													// This catches common mistakes like swapped date parts
													const hoursDiff = Math.abs(
														differenceInHours(
															parsed,
															testDate,
														),
													);
													if (hoursDiff > 48) {
														new Notice(
															"⚠️ Format is parsed but appears to have swapped date parts (parsed: " +
																parsed.toDateString() +
																", expected: " +
																testDate.toDateString() +
																"). Please verify.",
															0,
														);
														return;
													}

													// All checks passed
													new Notice(
														"✅ Date format is valid! Example: " +
															formattedDate,
													);
												} catch (error) {
													new Notice(
														"❌ Format validation error: " +
															(error instanceof
															Error
																? error.message
																: String(
																		error,
																	)),
														0,
													);
												}
											});
										});
								},
							},
							{
								name: t("date-time-format"),
								desc: createFragmentWithHTML(
									t("date-time-format-info") +
										"<br/>" +
										"<br/>" +
										"<b>" +
										t("note") +
										" :</b> " +
										t("date-format-date-fns-note") +
										"<a href='https://date-fns.org/v4.1.0/docs/Unicode-Tokens'>" +
										"date-fns library formatting guide." +
										"</a>",
								),
								render: (setting) => {
									const folderSuggestions =
										getFolderSuggestions(this.app);
									setting
										.setName(t("date-time-format"))
										.setDesc(
											createFragmentWithHTML(
												t("date-time-format-info") +
													"<br/>" +
													"<br/>" +
													"<b>" +
													t("note") +
													" :</b> " +
													t(
														"date-format-date-fns-note",
													) +
													"<a href='https://date-fns.org/v4.1.0/docs/Unicode-Tokens'>" +
													"date-fns library formatting guide." +
													"</a>",
											),
										)
										.addText((text) =>
											text
												.setValue(
													this.globalSettings
														.dateTimeFormat,
												)
												.onChange((value) => {
													this.globalSettings.dateTimeFormat =
														value;
													void this.saveSettings();
												})
												// eslint-disable-next-line obsidianmd/ui/sentence-case
												.setPlaceholder(
													"yyyy-MM-dd/HH:mm",
												),
										)
										.addButton((btn) => {
											btn.setButtonText(t("validate"));
											btn.onClick(() => {
												try {
													const testDate = new Date(
														2026,
														1,
														18,
														14,
														30,
														45,
													); // Fixed reference date: Feb 18, 2026, 14:30:45
													const userFormat =
														this.globalSettings
															?.dateTimeFormat;

													if (
														!userFormat ||
														userFormat.trim()
															.length === 0
													) {
														new Notice(
															"Please enter a date-time format.",
														);
														return;
													}

													// Format the test date using the user's format
													const formattedDateTime =
														format(
															testDate,
															userFormat,
														);

													// Try to parse it back
													const parsed = parse(
														formattedDateTime,
														userFormat,
														testDate,
													);

													// (1) Check if parsing succeeded
													if (!isValid(parsed)) {
														new Notice(
															"❌ Invalid date-time format. Parsing failed.",
															0,
														);
														return;
													}

													// (2) Check if the parsed date is reasonably close (within 1 hour for time accuracy)
													// This catches common mistakes like swapped date parts or time format issues
													const hoursDiff = Math.abs(
														differenceInHours(
															parsed,
															testDate,
														),
													);
													if (hoursDiff > 48) {
														new Notice(
															"⚠️ Format is parsed but appears to have swapped date parts (parsed: " +
																parsed.toISOString() +
																", expected: " +
																testDate.toISOString() +
																"). Please verify.",
															0,
														);
														return;
													}

													// All checks passed
													new Notice(
														"✅ Date-time format is valid! Example: " +
															formattedDateTime,
													);
												} catch (error) {
													new Notice(
														"❌ Format validation error: " +
															(error instanceof
															Error
																? error.message
																: String(
																		error,
																	)),
														0,
													);
												}
											});
										});
								},
							},
							{
								name: t("default-start-time"),
								desc: t("default-start-time-info"),
								render: (setting) => {
									setting
										.setName(t("default-start-time"))
										.setDesc(t("default-start-time-info"))
										.addText((text) =>
											text
												.setValue(
													this.globalSettings
														.defaultStartTime,
												)
												.onChange((value) => {
													this.globalSettings.defaultStartTime =
														value;
													void this.saveSettings();
												})
												.setPlaceholder(
													"Eg.: 00:00 or 23:59",
												),
										);
								},
							},
							{
								name: t("first-day-of-the-week"),
								desc: t("first-day-of-the-week-info"),
								render: (setting) => {
									setting
										.setName(t("first-day-of-the-week"))
										.setDesc(
											t("first-day-of-the-week-info"),
										)
										.addDropdown((dropdown) => {
											dropdown.addOption(
												"1",
												t("sunday"),
											);
											dropdown.addOption(
												"2",
												t("monday"),
											);
											dropdown.addOption(
												"3",
												t("tuesday"),
											);
											dropdown.addOption(
												"4",
												t("monday"),
											);
											dropdown.addOption(
												"5",
												t("thursday"),
											);
											dropdown.addOption(
												"6",
												t("friday"),
											);
											dropdown.addOption(
												"7",
												t("saturday"),
											);

											dropdown.setValue(
												this.globalSettings
													.firstDayOfWeek as string,
											);
											dropdown.onChange((value) => {
												this.globalSettings.firstDayOfWeek =
													value;
												void this.saveSettings();
											});
										});
								},
							},
						],
					},
				],
			},
			// Experimental features page
			{
				type: "page",
				name: t("experimental-features"),
				items: [
					{
						type: "group",
						items: [
							{
								name: "",
								desc:
									t("embed-task-boards") +
									t("embed-task-boards-info"),
								render: (setting) => {
									setting
										.setName(
											t("enable-experimental-features"),
										)
										.setDesc(
											createFragmentWithHTML(
												t(
													"enable-experimental-features-info-2",
												) +
													"<br/>" +
													"<br/>" +
													t(
														"enable-experimental-features-info-3",
													) +
													"<br/>" +
													"<br/>" +
													"<ul>" +
													"<li>" +
													"<b>" +
													t("embed-task-boards") +
													" : " +
													"</b>" +
													t(
														"embed-task-boards-info",
													) +
													"</li>" +
													"<li>" +
													"<b>" +
													t("inbox-view") +
													" : " +
													"</b>" +
													t("inbox-view-info") +
													"</li>" +
													"<li>" +
													"<b>" +
													t("calendar-view") +
													" : " +
													"</b>" +
													t("calendar-view-info") +
													"</li>" +
													"<li>" +
													"<b>" +
													t("table-view") +
													" : " +
													"</b>" +
													t("table-view-info") +
													"</li>" +
													"<li>" +
													"<b>" +
													t("list-view") +
													" : " +
													"</b>" +
													t("list-view-info") +
													"</li>" +
													"</ul>",
											),
										);
								},
							},
						],
					},
					{
						type: "group",
						items: [
							{
								name: t("enable-experimental-features"),
								desc: t("enable-experimental-features-info-1"),
								render: (setting) => {
									setting
										.setName(
											t("enable-experimental-features"),
										)
										.setDesc(
											t(
												"enable-experimental-features-info-1",
											),
										)
										.addToggle((toggle) =>
											toggle
												.setValue(
													this.globalSettings
														.experimentalFeatures,
												)
												.onChange((value) => {
													this.globalSettings.experimentalFeatures =
														value;
													void this.saveSettings();

													this.openReloadNoticeIfNeeded();
												}),
										);
								},
							},
						],
					},
				],
			},
			// This is a simple group to show donation links.
			{
				type: "group",
				heading: t("support"),
				items: [
					{
						name: "",
						render: (setting) =>
							this.renderSupportDevelopmentSection(
								setting.settingEl,
							),
					},
				],
			},
		];
	}

	// ================================================
	//          Filters for Scanning Container
	// ================================================

	private renderFiltersForScanningContainer(container: HTMLElement) {
		// new Setting(container)
		// 	.setDesc(
		// 		createFragmentWithHTML(
		// 			t("name-of-the-file-folder-tag-for-filter-info") +
		// 				"<br/>" +
		// 				"<b>" +
		// 				t("note") +
		// 				" :</b> " +
		// 				t("name-of-the-file-folder-tag-for-filter-info-2"),
		// 		),
		// 	);

		["tags", "frontmatter", "files", "folders"].forEach((type) => {
			const filterType =
				type as keyof typeof this.globalSettings.scanFilters;
			const filter = this.globalSettings.scanFilters[filterType];

			const row = container.createDiv({
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
					this.globalSettings.scanFilters[filterType].values =
						newValues;
					void this.saveSettings();
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
				attr: { "aria-label": "Select filter polarity" },
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
					(e.target as HTMLSelectElement).value,
				);
				this.globalSettings.scanFilters[filterType].polarity =
					newPolarity;
				void this.plugin.saveSettings();
			});
		});
	}

	// ================================================
	//          Tag Colors Configuration
	// ================================================

	private renderTagColorsConfigurationContainer(container: HTMLElement) {
		container.remove();
		const tagColorsContainer = container.createDiv({
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
			onSort: () => {
				const newOrder = Array.from(tagColorsContainer.children)
					.map((child, index) => {
						const tagName = child.getAttribute("data-tag-name");
						const tag = this.globalSettings.tagColors.find(
							(t) => t.name === tagName,
						);
						if (tag) {
							tag.priority = index + 1;
							return tag;
						}
						return null;
					})
					.filter(
						(
							tag,
						): tag is {
							name: string;
							color: string;
							priority: number;
						} => tag !== null,
					);

				this.globalSettings.tagColors = newOrder;
				void this.saveSettings();
			},
		});

		const renderTagColors = () => {
			tagColorsContainer.empty(); // Clear existing rendered rows

			this.globalSettings.tagColors
				.sort((a, b) => a.priority - b.priority)
				.forEach((tag, index) => {
					const row = tagColorsContainer.createDiv({
						cls: "tag-color-row",
						attr: { "data-tag-name": tag.name },
					});
					const controls = row.createDiv({
						cls: "tag-color-row-element setting-item-control",
					});
					const isTagText =
						this.globalSettings.tagColorsType ===
						TagColorType.TagText;
					const tagColorStyles = (element: HTMLElement) => {
						element.style.backgroundColor = isTagText
							? ""
							: tag.color;
						element.style.color = isTagText ? tag.color : "";
						element.style.border = isTagText
							? `1px solid ${tag.color}`
							: "";
					};

					const dragButton = controls.createEl("button", {
						cls: "clickable-icon taskboard-setting-tag-color-row-element-drag-handle",
						attr: { type: "button", title: "Hold and drag" },
					});
					setIcon(dragButton, "grip-horizontal");
					dragButton.style.cursor = "grab";
					dragButton.style.setProperty(
						"max-width",
						"max-content",
						"important",
					);
					tagColorStyles(dragButton);

					const tagNameInput = controls.createEl("input", {
						cls: "setting-input",
						attr: {
							type: "text",
							placeholder: t("enter-tag-name"),
						},
					});
					tagNameInput.value = tag.name;
					tagColorStyles(tagNameInput);
					tagNameInput.style.setProperty(
						"min-width",
						"23vw",
						"important",
					);
					tagNameInput.addEventListener("input", () => {
						tag.name = tagNameInput.value.trim().replace("#", "");
						row.setAttribute("data-tag-name", tag.name);
						void this.saveSettings();
					});

					const colorPickerButton = controls.createEl("button", {
						cls: "clickable-icon taskboard-setting-tag-color-row-element-color-picker",
						attr: {
							type: "button",
							title: t("pick-color-for-tag"),
							"aria-label": t("pick-color-for-tag"),
						},
					});
					setIcon(colorPickerButton, "palette");

					const colorInput = controls.createEl("input", {
						cls: "setting-input",
						attr: {
							type: "text",
							placeholder: "Color value",
						},
					});
					colorInput.value = tag.color;
					tagColorStyles(colorInput);
					colorInput.style.setProperty(
						"min-width",
						"23vw",
						"important",
					);
					colorInput.addEventListener("input", () => {
						tag.color = colorInput.value;
						void this.saveSettings();
					});

					colorPickerButton.addEventListener("click", () => {
						showColorPicker(colorPickerButton, {
							value: tag.color,
							outputFormat: "rgb",
							onSelect: (color) => {
								tag.color = color;
								colorInput.value = tag.color;
								renderTagColors();
								void this.saveSettings();
							},
							onClear: () => {
								tag.color = "";
								colorInput.value = "";
								renderTagColors();
								void this.saveSettings();
							},
						});
					});

					const deleteButton = controls.createEl("span", {
						cls: "clickable-icon mod-cta taskboard-setting-tag-color-row-element-delete",
						attr: {
							type: "span",
							title: t("delete-tag-color"),
							"aria-label": t("delete-tag-color"),
						},
					});
					setIcon(deleteButton, "trash");
					deleteButton.addEventListener("click", () => {
						this.globalSettings.tagColors.splice(index, 1);
						void this.saveSettings();
						renderTagColors();
					});
				});
		};

		// Initial render
		renderTagColors();

		// Add "Add New Tag Color" button
		new Setting(container)
			.addButton((btn) =>
				btn
					.setButtonText(t("add-tag-color"))
					.setCta()
					.onClick(async () => {
						const newTag = {
							name: "",
							color: "rgba(255, 0, 0, 1)",
							priority: this.globalSettings.tagColors.length + 1,
						};
						this.globalSettings.tagColors.push(newTag);
						void this.saveSettings();
						renderTagColors();
					}),
			)
			.setClass("task-board-settingtab-add-tag-color-btn");
	}

	// ================================================
	//          Custom Statuses Configuration
	// ================================================

	private renderCustomStatusesTab(contentEl: HTMLElement) {
		// new Setting(contentEl)
		// 	// .setName(t("custom-statuses"))
		// 	.setDesc(t("custom-statuses-info"));

		// Container for custom statuses list
		const customStatusesContainer = contentEl.createDiv({
			cls: "custom-statuses-container",
		});

		const renderCustomStatuses = () => {
			customStatusesContainer.empty(); // Clear existing rendered rows

			const customStatuses = this.globalSettings.customStatuses;

			if (!customStatuses || customStatuses.length === 0) {
				customStatusesContainer.createDiv({
					cls: "custom-statuses-empty-message",
					text: t("no-custom-statuses-configured"),
				});
				return;
			}

			customStatuses.forEach((status, index) => {
				const row = customStatusesContainer.createDiv({
					cls: "custom-status-row",
				});

				const statusInfoContainer = row.createDiv({
					cls: "custom-status-info-container",
				});

				// Heading Row
				const statusItemHeading = statusInfoContainer.createDiv({
					cls: "custom-status-field-element-heading setting-item-name",
				});
				// Status Icon - Lucide icon picker
				const statusLucideIcon = statusItemHeading.createDiv({
					cls: "custom-status-field-element-heading-icon",
				});
				const iconId = normalizeTaskIconValue(status.lucideIcon);
				const isIconAvailable = iconId && getIcon(iconId);
				const iconButton = statusLucideIcon.createEl("span", {
					cls: `custom-status-icon-button${isIconAvailable ? "" : " faint"}`,
					attr: {
						type: "button",
						title: t("select-status-icon"),
						"aria-label": t("select-status-icon"),
					},
				});
				setIcon(iconButton, isIconAvailable ? iconId : "plus");
				if (status.color) iconButton.style.color = status.color;
				iconButton.onclick = () => {
					const updateStatusIcon = (value: string) => {
						const currentStatus =
							this.globalSettings.customStatuses[index];
						if (!currentStatus) return;
						currentStatus.lucideIcon =
							normalizeTaskIconValue(value);
						void this.saveSettings();
						renderCustomStatuses();
						this.openReloadNoticeIfNeeded();
					};
					const pickerOptions = {
						value: iconId,
						title: t("select-status-icon"),
						onSelect: updateStatusIcon,
						onClear: () => updateStatusIcon(""),
					};

					if (Platform.isMobile) {
						openIconPickerModal(this.app, pickerOptions);
					} else {
						showIconPicker(iconButton, pickerOptions);
					}
				};
				// Status Name
				const statusInfoName = statusItemHeading.createDiv({
					cls: "custom-status-field-element-heading-name",
				});
				const statusName = statusInfoName.createDiv({
					cls: "custom-status-field-value",
					text: status.name,
				});
				if (status.color) statusName.style.color = status.color;

				if (status.desc?.trim()) {
					statusInfoContainer.createDiv({
						cls: "custom-status-field-value custom-status-description",
						text: status.desc,
					});
				}

				// Status Symbol
				const statusInfoSymbol = statusInfoContainer.createDiv({
					cls: "custom-status-field-element setting-item-description",
				});
				statusInfoSymbol.createDiv({
					cls: "custom-status-field-value",
					text: `This status [${status.symbol}] will change to [${status.nextStatusSymbol}].`,
				});

				const rightSideContainer = row.createDiv({
					cls: "custom-status-right-side",
				});
				// Status Type
				rightSideContainer.createDiv({
					cls: `custom-status-field-status-pill${
						status.type === statusTypeNames.TODO ? " todo" : ""
					}${status.type === statusTypeNames.DONE ? " done" : ""}${
						status.type === statusTypeNames.CANCELLED
							? " cancelled"
							: ""
					}${
						status.type === statusTypeNames.IN_PROGRESS
							? " wip"
							: ""
					}${status.type === statusTypeNames.ON_HOLD ? " hold" : ""}`,
					text: status.type,
				});

				// Buttons container
				const buttonsContainer = rightSideContainer.createDiv({
					cls: "custom-status-buttons",
				});

				// Edit button
				const editButton = buttonsContainer.createEl("span", {
					cls: "edit-btn",
					text: t("edit"),
					title: t("edit"),
				});
				setIcon(editButton, "pencil");
				editButton.onclick = async () => {
					const modal = new CustomStatusModal(
						this.plugin,
						status,
						false,
					);
					modal.onClose = () => {
						if (modal.saved) {
							const updatedStatus = modal.statusConfiguration();
							const customStatus: CustomStatus = {
								symbol: updatedStatus.symbol,
								name: updatedStatus.name,
								nextStatusSymbol:
									updatedStatus.nextStatusSymbol === ""
										? " "
										: updatedStatus.nextStatusSymbol,
								availableAsCommand:
									updatedStatus.availableAsCommand,
								type: updatedStatus.type,
								lucideIcon: status.lucideIcon ?? "",
								color: updatedStatus.color,
								desc: updatedStatus.desc,
							};
							this.globalSettings.customStatuses[index] =
								customStatus;
							void this.saveSettings();
							renderCustomStatuses();
							this.openReloadNoticeIfNeeded();
						}
					};
					modal.open();
				};

				// Delete button
				const deleteButton = buttonsContainer.createEl("span", {
					cls: "delete-btn",
					text: t("delete"),
					title: t("delete"),
				});
				setIcon(deleteButton, "trash");
				deleteButton.onclick = async () => {
					this.globalSettings.customStatuses.splice(index, 1);
					void this.saveSettings();
					renderCustomStatuses();
					this.openReloadNoticeIfNeeded();
				};
			});
		};

		// Initial render
		renderCustomStatuses();

		const isTasksPluginEnabled =
			this.globalSettings.compatiblePlugins.tasksPlugin;
		// Add "Add New Status" button
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(t("import-from-tasks-plugin"))
					.setClass("import-from-tasks-plugin-btn")
					.setCta()
					.onClick(async () => {
						const flag = await fetchTasksPluginCustomStatuses(
							this.plugin,
						);
						if (flag) {
							renderCustomStatuses();
							this.openReloadNoticeIfNeeded();
						}
					})
					.setDisabled(!isTasksPluginEnabled),
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("add-new-status"))
					.setCta()
					.onClick(async () => {
						const newStatus: CustomStatus = {
							symbol: "",
							name: "",
							nextStatusSymbol: "",
							availableAsCommand: false,
							type: statusTypeNames.TODO,
							lucideIcon: "",
						};
						const modal = new CustomStatusModal(
							this.plugin,
							newStatus,
							false,
						);
						modal.onClose = () => {
							if (modal.saved) {
								const statusConfig =
									modal.statusConfiguration();
								const customStatus: CustomStatus = {
									symbol: statusConfig.symbol,
									name: statusConfig.name,
									nextStatusSymbol:
										statusConfig.nextStatusSymbol,
									availableAsCommand:
										statusConfig.availableAsCommand,
									type: statusConfig.type,
									lucideIcon: "",
									color: statusConfig.color,
									desc: statusConfig.desc,
								};
								if (!this.globalSettings.customStatuses) {
									this.globalSettings.customStatuses = [];
								}
								this.globalSettings.customStatuses.push(
									customStatus,
								);
								void this.saveSettings();
								renderCustomStatuses();
								this.openReloadNoticeIfNeeded();
							}
						};

						modal.open();
					}),
			);
	}

	private renderCustomPrioritiesTab(contentEl: HTMLElement) {
		this.globalSettings.customPriorities ??= [];
		const customPrioritiesContainer = contentEl.createDiv({
			cls: "custom-priorities-container",
		});

		const renderCustomPriorities = () => {
			customPrioritiesContainer.empty();
			const priorities = this.globalSettings.customPriorities ?? [];

			if (priorities.length === 0) {
				customPrioritiesContainer.createDiv({
					cls: "custom-statuses-empty-message",
					text: t("no-custom-priorities-configured"),
				});
				return;
			}

			[...priorities]
				.sort((a, b) => a.rank - b.rank)
				.forEach((priority, orderIndex, orderedPriorities) => {
					const priorityIndex =
						this.globalSettings.customPriorities.indexOf(priority);
					const row = customPrioritiesContainer.createDiv({
						cls: "custom-status-row custom-priority-row",
					});
					const info = row.createDiv({
						cls: "custom-status-info-container",
					});
					const heading = info.createDiv({
						cls: "custom-status-field-element-heading setting-item-name",
					});
					if (priority.emoji) {
						heading.createSpan({
							cls: "custom-priority-emoji",
							text: priority.emoji,
						});
					}
					if (priority.lucideIcon) {
						const icon = heading.createSpan({
							cls: "custom-status-field-element-heading-icon",
						});
						setIcon(icon, priority.lucideIcon);
						if (priority.color) icon.style.color = priority.color;
					}
					const name = heading.createDiv({
						cls: "custom-status-field-value",
						text: priority.name,
					});
					if (priority.color) name.style.color = priority.color;
					if (priority.desc?.trim()) {
						info.createDiv({
							cls: "custom-status-field-value custom-status-description",
							text: priority.desc,
						});
					}
					info.createDiv({
						cls: "custom-status-field-value setting-item-description",
						text: t("priority-rank-value", {
							rank: priority.rank,
						}),
					});

					const buttons = row.createDiv({
						cls: "custom-status-buttons task-board-property-actions",
					});
					this.createPropertyActionButton(
						buttons,
						"arrow-up",
						t("move-priority-up"),
						() => {
							void this.movePriority(
								priority,
								-1,
								renderCustomPriorities,
							);
						},
						"move-up-btn",
					).disabled = orderIndex === 0;
					this.createPropertyActionButton(
						buttons,
						"arrow-down",
						t("move-priority-down"),
						() => {
							void this.movePriority(
								priority,
								1,
								renderCustomPriorities,
							);
						},
						"move-down-btn",
					).disabled = orderIndex === orderedPriorities.length - 1;
					const editButton = buttons.createEl("span", {
						cls: "edit-btn",
						text: t("edit"),
						title: t("edit"),
					});
					setIcon(editButton, "pencil");
					editButton.addEventListener("click", () => {
						const modal = new CustomPriorityModal(
							this.app,
							priority,
						);
						modal.onClose = () => {
							if (!modal.saved) return;
							this.globalSettings.customPriorities[
								priorityIndex
							] = modal.priorityConfiguration();
							void this.saveSettings();
							renderCustomPriorities();
						};
						modal.open();
					});

					const deleteButton = buttons.createEl("span", {
						cls: "delete-btn",
						text: t("delete"),
						title: t("delete"),
					});
					setIcon(deleteButton, "trash");
					deleteButton.addEventListener("click", () => {
						this.globalSettings.customPriorities.splice(
							priorityIndex,
							1,
						);
						[...this.globalSettings.customPriorities]
							.sort((a, b) => a.rank - b.rank)
							.forEach((item, rank) => (item.rank = rank + 1));
						void this.saveSettings();
						renderCustomPriorities();
					});
				});
		};

		renderCustomPriorities();

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(t("add-new-priority"))
				.setCta()
				.onClick(() => {
					const priority: CustomPriority = {
						name: "",
						rank:
							Math.max(
								0,
								...this.globalSettings.customPriorities.map(
									(item) => item.rank,
								),
							) + 1,
						emoji: "",
						lucideIcon: "",
						color: "",
						desc: "",
					};
					const modal = new CustomPriorityModal(this.app, priority);
					modal.onClose = () => {
						if (!modal.saved) return;
						this.globalSettings.customPriorities.push(
							modal.priorityConfiguration(),
						);
						void this.saveSettings();
						renderCustomPriorities();
					};
					modal.open();
				}),
		);
	}

	private async movePriority(
		priority: CustomPriority,
		direction: -1 | 1,
		renderRows: () => void,
	): Promise<void> {
		const priorities = this.globalSettings.customPriorities;
		const orderedPriorities = priorities
			.slice()
			.sort((a, b) => a.rank - b.rank);
		const currentIndex = orderedPriorities.indexOf(priority);
		const targetIndex = currentIndex + direction;
		if (
			currentIndex < 0 ||
			targetIndex < 0 ||
			targetIndex >= orderedPriorities.length
		) {
			return;
		}

		const previousRanks = priorities.map((item) => ({
			item,
			rank: item.rank,
		}));
		orderedPriorities.splice(currentIndex, 1);
		orderedPriorities.splice(targetIndex, 0, priority);
		orderedPriorities.forEach((item, index) => {
			item.rank = index + 1;
		});

		try {
			await this.plugin.saveSettings();
			renderRows();
		} catch (error) {
			previousRanks.forEach(({ item, rank }) => {
				item.rank = rank;
			});
			console.error("Failed to save priority order", error);
			new Notice(t("failed-to-save-priority-order"));
			renderRows();
		}
	}

	// ================================================
	//          Properties Configuration
	// ================================================

	/**
	 * This was used to configure task properites (Default + Custom)
	 * Now this will be handled by a modal. Keeping this function as backup
	 * for future use.
	 *
	 * @param current The task property
	 * @param propertyGroup Whether this property is default or custom
	 * @param isNew Whether we are creating a new property.
	 * @returns
	 */
	private renderSupportedPropertyConfigurationPage(
		current: SupportedPropertiesConfig,
		propertyGroup: "default" | "custom",
		isNew = false,
	): SettingDefinitionGroup {
		return {
			type: "group",
			items: [
				{
					name: "",
					searchable: false,
					render: (setting) => {
						const host = setting.settingEl;
						host.empty();
						host.removeClass("setting-item");
						host.addClass("task-board-property-editor");

						const properties =
							propertyGroup === "default"
								? this.globalSettings.defaultProperties
								: this.globalSettings.customProperties;
						if (isNew && !properties.includes(current)) {
							properties.push(current);
							void this.settingsManager.saveSettings();
						}

						const save = () => {
							void this.settingsManager.saveSettings();
						};
						const addTextField = (
							name: string,
							value: string,
							onChange: (value: string) => void,
							placeholder?: string,
						) => {
							new Setting(host).setName(name).addText((text) => {
								text.setValue(value).onChange(onChange);
								if (placeholder)
									text.setPlaceholder(placeholder);
							});
						};

						addTextField("Frontmatter key", current.id, (value) => {
							const id = value.trim();
							const duplicate = [
								...this.globalSettings.defaultProperties,
								...this.globalSettings.customProperties,
							].find(
								(property) =>
									property !== current && property.id === id,
							);
							if (id && duplicate) {
								new Notice(
									`The property key "${id}" is already in use.`,
								);
								return;
							}
							current.id = id;
							if (propertyGroup === "custom")
								current.key = current.id;
							save();
						});

						if (propertyGroup === "custom") {
							addTextField(
								"Property name",
								current.name,
								(value) => {
									current.name = value;
									save();
								},
								"e.g. Project",
							);
						} else {
							addTextField(
								"Task Board property key",
								current.key,
								(value) => {
									current.key = value.trim();
									save();
								},
							);
						}

						addTextField("Description", current.desc, (value) => {
							current.desc = value;
							save();
						});

						new Setting(host)
							.setName("Type")
							.addDropdown((dropdown) => {
								Object.values(PropertyTypeConfig).forEach(
									(type) => {
										dropdown.addOption(type, type);
									},
								);
								dropdown
									.setValue(current.type)
									.onChange((value) => {
										current.type =
											value as PropertyTypeConfig;
										save();
									});
							});

						addTextField("Emoji", current.emoji, (value) => {
							current.emoji = value;
							save();
						});
						addTextField("Lucide icon", current.icon, (value) => {
							current.icon = value;
							save();
						});

						new Setting(host)
							.setName("Hide property in notes for inline-tasks")
							.addToggle((toggle) =>
								toggle
									.setValue(
										current.hidePropertyInNotesForInlineTasks,
									)
									.onChange((value) => {
										current.hidePropertyInNotesForInlineTasks =
											value;
										save();
										this.openReloadNoticeIfNeeded();
									}),
							);

						addTextField(
							"Default value",
							Array.isArray(current.defaultValue)
								? current.defaultValue.join(", ")
								: String(current.defaultValue),
							(value) => {
								if (current.type === PropertyTypeConfig.list) {
									current.defaultValue = value
										.split(",")
										.map((item) => item.trim())
										.filter(Boolean);
								} else if (
									current.type ===
										PropertyTypeConfig.numeric &&
									value.trim() !== ""
								) {
									const numberValue = Number(value);
									if (Number.isFinite(numberValue))
										current.defaultValue = numberValue;
								} else {
									current.defaultValue = value;
								}
								save();
							},
						);

						if (propertyGroup === "custom") {
							new Setting(host).addButton((button) =>
								button
									.setButtonText("Delete property")
									.setDestructive()
									.onClick(() => {
										const propertyIndex =
											properties.indexOf(current);
										if (propertyIndex >= 0)
											properties.splice(propertyIndex, 1);
										this.normalizePropertyRanks(properties);
										void this.settingsManager.saveSettings();
										this.updateNativeSettingsDefinitions();
									}),
							);
						}
					},
				},
			],
		};
	}

	private renderKeyMappingRow(
		container: HTMLElement,
		current: SupportedPropertiesConfig,
		propertyGroup: "default" | "custom",
		onEdit: () => void,
		onMove: (direction: -1 | 1) => void,
		canMoveUp: boolean,
		canMoveDown: boolean,
		onDelete?: () => void,
	): HTMLElement {
		const row = container.createDiv("task-board-property-row");
		row.dataset.propertyId = current.id;
		const info = row.createDiv("task-board-property-info");
		const heading = info.createDiv("task-board-property-heading");
		const left = heading.createDiv("task-board-property-heading-left");
		const icon = left.createSpan("task-board-property-icon");
		if (current.icon) setIcon(icon, current.icon);
		else icon.setText(current.emoji || "");
		left.createSpan({
			cls: "task-board-property-name",
			text: current.name,
		});
		heading.createSpan({
			cls: `task-board-property-type task-board-property-type-${current.type}`,
			text: current.type,
		});

		info.createDiv({
			cls: "task-board-property-description",
			text: current.desc || "",
		});

		const footer = info.createDiv("task-board-property-footer");
		const values = footer.createDiv("task-board-property-values");
		// this.createPropertyValuePill(values, "ID", current.id);
		this.createPropertyValuePill(values, "Key", current.key);
		this.createPropertyValuePill(values, "emoji", current.emoji);

		const actions = footer.createDiv("task-board-property-actions");
		this.createPropertyActionButton(
			actions,
			"arrow-up",
			"Move property up",
			() => onMove(-1),
			"move-up-btn",
		).disabled = !canMoveUp;
		this.createPropertyActionButton(
			actions,
			"arrow-down",
			"Move property down",
			() => onMove(1),
			"move-down-btn",
		).disabled = !canMoveDown;
		this.createPropertyActionButton(actions, "pencil", t("edit"), onEdit);
		if (propertyGroup === "custom" && onDelete) {
			this.createPropertyActionButton(
				actions,
				"trash",
				t("delete"),
				onDelete,
				"delete-btn",
			);
		}
		return row;
	}

	private createPropertyValuePill(
		container: HTMLElement,
		label: string,
		value: string,
	): void {
		const pill = container.createDiv("task-board-property-value-pill");
		pill.createSpan({
			cls: "task-board-property-value-label",
			text: label,
		});
		pill.createSpan({
			cls: "task-board-property-value",
			text: value || "—",
		});
	}

	private createPropertyActionButton(
		container: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
		className = "edit-btn",
	): HTMLButtonElement {
		const button = container.createEl("button", {
			cls: `task-board-property-action ${className}`,
			attr: {
				type: "button",
				title: label,
				"aria-label": label,
			},
		});
		setIcon(button, icon);
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
		return button;
	}

	private createNewCustomProperty(): SupportedPropertiesConfig {
		const existingIds = new Set(
			[
				...this.globalSettings.defaultProperties,
				...this.globalSettings.customProperties,
			].map((property) => property.id),
		);
		let suffix = this.globalSettings.customProperties.length + 1;
		let id = `custom-property-${suffix}`;
		while (existingIds.has(id)) {
			suffix += 1;
			id = `custom-property-${suffix}`;
		}
		return {
			key: id,
			id,
			name: `Custom property ${suffix}`,
			desc: "",
			type: PropertyTypeConfig.text,
			emoji: "",
			icon: "",
			hidePropertyInNotesForInlineTasks: false,
			defaultValue: "",
			rank: this.globalSettings.customProperties.length + 1,
		};
	}

	private normalizePropertyRanks(properties: SupportedPropertiesConfig[]) {
		properties
			.slice()
			.sort((a, b) => a.rank - b.rank)
			.forEach((property, index) => {
				property.rank = index + 1;
			});
	}

	private async moveProperty(
		properties: SupportedPropertiesConfig[],
		property: SupportedPropertiesConfig,
		direction: -1 | 1,
		renderRows: () => void,
	): Promise<void> {
		const orderedProperties = properties
			.slice()
			.sort((a, b) => a.rank - b.rank);
		const currentIndex = orderedProperties.indexOf(property);
		const targetIndex = currentIndex + direction;
		if (
			currentIndex < 0 ||
			targetIndex < 0 ||
			targetIndex >= orderedProperties.length
		)
			return;

		const previousRanks = properties.map((item) => ({
			item,
			rank: item.rank,
		}));
		orderedProperties.splice(currentIndex, 1);
		orderedProperties.splice(targetIndex, 0, property);
		orderedProperties.forEach((item, index) => {
			item.rank = index + 1;
		});
		try {
			await this.settingsManager.saveSettings();
			renderRows();
		} catch (error) {
			previousRanks.forEach(({ item, rank }) => {
				item.rank = rank;
			});
			console.error("Failed to save property order", error);
			new Notice("Failed to save property order.");
			renderRows();
		}
	}

	private renderPropertiesConfigurationSection(
		_contentEl: HTMLElement,
		type: "default" | "custom",
	): SettingDefinitionGroup {
		const propertyGroup = type;
		const properties =
			propertyGroup === "default"
				? this.globalSettings.defaultProperties
				: this.globalSettings.customProperties;
		const pageTitle = t(`${propertyGroup}-properties-mapping`);
		const helpText = t(`${propertyGroup}-properties-mapping-info-2`);

		return {
			type: "group",
			cls: "task-board-settings-properties-configuration-container",
			heading: "",
			items: [
				{
					name: "",
					searchable: false,
					aliases: properties.flatMap((property) => [
						property.name,
						property.id,
						property.key,
						property.type,
					]),
					render: (setting) => {
						const host = setting.settingEl;
						host.empty();
						host.addClass(
							"task-board-property-list",
							"task-board-settings-tab-root",
						);

						const help = host.createDiv(
							"setting-item-description task-board-key-mappings-help",
						);
						help.createEl("p", { text: t(helpText) });

						const list = host.createDiv(
							"task-board-property-list-items",
						);
						const renderRows = () => {
							list.empty();
							const orderedProperties = properties
								.slice()
								.sort((a, b) => a.rank - b.rank);
							if (orderedProperties.length === 0) {
								list.createDiv({
									cls: "task-board-property-empty-message",
									text: "No properties configured.",
								});
							}

							orderedProperties.forEach((property, index) => {
								this.renderKeyMappingRow(
									list,
									property,
									propertyGroup,
									() => {
										new PropertyConfigurationModal(
											this.app,
											property,
											propertyGroup,
											async (updatedProperty) => {
												const duplicate = [
													...this.globalSettings
														.defaultProperties,
													...this.globalSettings
														.customProperties,
												].find(
													(candidate) =>
														candidate !==
															property &&
														candidate.id ===
															updatedProperty.id,
												);
												if (duplicate) {
													throw new Error(
														`The property key "${updatedProperty.id}" is already in use.`,
													);
												}
												const shouldShowReloadNotice =
													property.hidePropertyInNotesForInlineTasks !==
													updatedProperty.hidePropertyInNotesForInlineTasks;
												const previousProperty = {
													...property,
												};
												Object.assign(
													property,
													updatedProperty,
												);
												try {
													await this.settingsManager.saveSettings();
												} catch (error) {
													Object.assign(
														property,
														previousProperty,
													);
													throw error;
												}
												renderRows();
												if (shouldShowReloadNotice)
													this.openReloadNoticeIfNeeded();
											},
										).open();
									},
									(direction) => {
										void this.moveProperty(
											properties,
											property,
											direction,
											renderRows,
										);
									},
									index > 0,
									index < orderedProperties.length - 1,
									propertyGroup === "custom"
										? () => {
												const index =
													properties.indexOf(
														property,
													);
												if (index < 0) return;
												const previousRanks =
													properties.map((item) => ({
														item,
														rank: item.rank,
													}));
												properties.splice(index, 1);
												this.normalizePropertyRanks(
													properties,
												);
												void (async () => {
													try {
														await this.settingsManager.saveSettings();
														renderRows();
													} catch (error) {
														properties.splice(
															index,
															0,
															property,
														);
														previousRanks.forEach(
															({
																item,
																rank,
															}) => {
																item.rank =
																	rank;
															},
														);
														console.error(
															"Failed to delete property",
															error,
														);
														new Notice(
															"Failed to delete property.",
														);
														renderRows();
													}
												})();
											}
										: undefined,
								);
							});
						};

						renderRows();

						if (propertyGroup === "custom") {
							new Setting(host).addButton((button) =>
								button
									.setButtonText("Add custom property")
									.setCta()
									.onClick(() => {
										const newProperty =
											this.createNewCustomProperty();
										new PropertyConfigurationModal(
											this.app,
											newProperty,
											"custom",
											async (updatedProperty) => {
												const duplicate = [
													...this.globalSettings
														.defaultProperties,
													...this.globalSettings
														.customProperties,
												].some(
													(property) =>
														property.id ===
														updatedProperty.id,
												);
												if (duplicate) {
													throw new Error(
														`The property key "${updatedProperty.id}" is already in use.`,
													);
												}
												const previousRanks =
													properties.map(
														(property) => ({
															property,
															rank: property.rank,
														}),
													);
												properties.push(
													updatedProperty,
												);
												this.normalizePropertyRanks(
													properties,
												);
												try {
													await this.settingsManager.saveSettings();
												} catch (error) {
													properties.pop();
													previousRanks.forEach(
														({
															property,
															rank,
														}) => {
															property.rank =
																rank;
														},
													);
													throw error;
												}
												renderRows();
											},
											true,
										).open();
									}),
							);
						}

						const cleanupTitleAction =
							attachDeclarativeSettingsPageTitleAction(
								host,
								pageTitle,
								[
									"DOCS-039 Key mappings",
									"DOCS-018 Task properties",
								].map(
									(target) =>
										buildNativeSettingsDocsAction(
											pageTitle,
											target,
										).action,
								),
							);

						return () => {
							cleanupTitleAction?.();
						};
					},
				},
			],
		};
	}

	// ================================================
	//          Inline Tasks Preview Section
	// ================================================

	private renderInlineTasksPreviewContainer(contentEl: HTMLElement) {
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
			// MarkdownUIRenderer.safeRender(
			// 	this.app,
			// 	markdown,
			// 	markdownPreviewEl,
			// 	"",
			// 	this.plugin.view,
			// );

			void MarkdownUIRenderer.strictRender(
				this.app,
				markdown,
				markdownPreviewEl,
				"",
				null, // @todo - Need to pass the window of the settings modal.
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
			switch (this.globalSettings.taskPropertyFormat) {
				// Default
				case taskPropertyFormatOptions.default: {
					if (
						this.globalSettings.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} ${priority} ${universalDateEmoji}${date} ${tags} ✅${completionDate}`;
					} else {
						preview = `- [>] ${taskTitle} ${priority} ⏰[${time}] ${universalDateEmoji}${date} ${tags} ✅${completionDate}`;
					}
					break;
				}
				// Tasks Plugin
				case taskPropertyFormatOptions.tasksPlugin: {
					if (
						this.globalSettings.compatiblePlugins.dayPlannerPlugin
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
				case taskPropertyFormatOptions.dataviewPlugin: {
					if (
						this.globalSettings.compatiblePlugins.dayPlannerPlugin
					) {
						preview = `- [>] ${time} ${taskTitle} [priority:: 2] [${universalDateString}:: ${date}] ${tags} [completion:: ${completionDate}]`;
					} else {
						preview = `- [>] ${taskTitle} [priority:: 2] [time:: ${time}] [${universalDateString}:: ${date}] ${tags} [completion:: ${completionDate}]`;
					}
					break;
				}
				// Obsidian Native
				case taskPropertyFormatOptions.obsidianNative: {
					if (
						this.globalSettings.compatiblePlugins.dayPlannerPlugin
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

		updatePreview();
	}

	private renderSupportDevelopmentSection(contentEl: HTMLElement) {
		const footerSection = contentEl.createEl("div", {
			cls: "settingTabFooterSection setting-item-name",
		});

		// footerSection
		// 	.createEl("p", {
		// 		text: t("this-plugin-is-created-by"),
		// 	})
		// 	.createEl("a", {
		// 		text: t("author-name"),
		// 		href: "https://www.github.com/tu2-atmanand",
		// 	});

		const footerText = createEl("p");
		footerText.appendText(t("donation-message"));

		footerSection.appendChild(footerText);

		const parser = new DOMParser();

		const donationSection = createEl("div", {
			cls: "settingTabFooterDonationsSec",
		});
		donationSection.appendChild(
			paypalButton("https://paypal.me/tu2atmanand"),
		);
		donationSection.appendChild(
			buyMeACoffeeButton(
				"https://www.buymeacoffee.com/tu2_atmanand",
				parser.parseFromString(buyMeCoffeeSVGIcon, "text/xml")
					.documentElement,
			),
		);
		donationSection.appendChild(
			kofiButton(
				"https://ko-fi.com/atmanandgauns",
				parser.parseFromString(kofiSVGIcon, "text/xml").documentElement,
			),
		);

		footerSection.appendChild(donationSection);
	}

	hide(): void {
		this.settingsManager.cleanUp();
	}

	// ================================================
	//          Deprecated
	// ================================================

	private createLegacySettingsPage(
		section: SettingsTabPagesKey,
		searchAliases: string[],
	): SettingDefinitionItem {
		const name = t(section);
		return {
			type: "page",
			name,
			items: [
				{
					type: "group",
					items: [
						this.createLegacySettingsEntry(section, searchAliases),
					],
				},
			],
		};
	}

	private createLegacySettingsEntry(
		section: SettingsTabPagesKey,
		searchAliases: string[],
	): SettingDefinition {
		return {
			name: t(section),
			aliases: searchAliases.map((alias) => t(alias)),
			render: (setting) => {
				setting.settingEl.empty();
				setting.settingEl.removeClass("setting-item");
				setting.settingEl.addClass(
					"task-board-declarative-settings-content",
				);
				this.settingsManager.renderDeclarativeSettingsSection(
					section,
					setting.settingEl,
				);
			},
		};
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
		}),
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#179BD7",
				d: "M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z",
			},
		}),
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#253B80",
				d: "M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c3.114 0 5.263.648 6.385 1.927.526.6.861 1.227 1.023 1.917.17.724.173 1.589.007 2.644l-.012.077v.676l.526.298a3.69 3.69 0 0 1 1.065.812c.45.513.741 1.165.864 1.938.127.795.085 1.741-.123 2.812-.24 1.232-.628 2.305-1.152 3.183a6.547 6.547 0 0 1-1.825 2c-.696.494-1.523.869-2.458 1.109-.906.236-1.939.355-3.072.355h-.73c-.522 0-1.029.188-1.427.525a2.21 2.21 0 0 0-.744 1.328l-.055.299-.924 5.855-.042.215c-.011.068-.03.102-.058.125a.155.155 0 0 1-.096.035H7.266z",
			},
		}),
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#179BD7",
				d: "M23.048 7.667c-.028.179-.06.362-.096.55-1.237 6.351-5.469 8.545-10.874 8.545H9.326c-.661 0-1.218.48-1.321 1.132L6.596 26.83l-.399 2.533a.704.704 0 0 0 .695.814h4.881c.578 0 1.069-.42 1.16-.99l.048-.248.919-5.832.059-.32c.09-.572.582-.992 1.16-.992h.73c4.729 0 8.431-1.92 9.513-7.476.452-2.321.218-4.259-.978-5.622a4.667 4.667 0 0 0-1.336-1.03z",
			},
		}),
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#222D65",
				d: "M21.754 7.151a9.757 9.757 0 0 0-1.203-.267 15.284 15.284 0 0 0-2.426-.177h-7.352a1.172 1.172 0 0 0-1.159.992L8.05 17.605l-.045.289a1.336 1.336 0 0 1 1.321-1.132h2.752c5.405 0 9.637-2.195 10.874-8.545.037-.188.068-.371.096-.55a6.594 6.594 0 0 0-1.017-.429 9.045 9.045 0 0 0-.277-.087z",
			},
		}),
	);
	svg.appendChild(
		createSvg("path", {
			attr: {
				fill: "#253B80",
				d: "M9.614 7.699a1.169 1.169 0 0 1 1.159-.991h7.352c.871 0 1.684.057 2.426.177a9.757 9.757 0 0 1 1.481.353c.365.121.704.264 1.017.429.368-2.347-.003-3.945-1.272-5.392C20.378.682 17.853 0 14.622 0h-9.38c-.66 0-1.223.48-1.325 1.133L.01 25.898a.806.806 0 0 0 .795.932h5.791l1.454-9.225 1.564-9.906z",
			},
		}),
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
	const a = activeDocument.createElement("a");
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
	const a = activeDocument.createElement("a");
	a.setAttribute("href", link);
	a.addClass("buymeacoffee-tu2-atmanand-img");
	a.appendChild(img);
	return a;
};
