// src/views/TaskBoardSettingTab.ts

import { t } from "i18next";
import {
	App,
	PluginSettingTab,
	SettingDefinition,
	SettingDefinitionItem,
} from "obsidian";
import TaskBoard from "../../main.js";
import { globalSettingsData } from "../interfaces/GlobalSettings.js";
import { TaskBoardIcon } from "../interfaces/Icons.js";
import { SettingsManager, SettingsTabPagesKey } from "./SettingConstructUI.js";
import { CURRENT_PLUGIN_VERSION } from "../interfaces/Constants.js";
import { scopeSettingsModal } from "./ScopeSettings.js";

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
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		void this.settingsManager.constructUI(containerEl, t("task-board"));
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.containerEl.addClass("TaskBoardSettingTab");
		const customStatusAliases =
			this.plugin.settings.data.customStatuses?.flatMap((status) => [
				status.name,
				status.symbol,
			]) ?? [];
		const tagColorAliases =
			this.plugin.settings.data.tagColors?.map(
				(tagColor) => tagColor.name,
			) ?? [];

		return [
			{
				type: "group",
				searchable: false,
				items: [
					{
						name: "task-board" + " " + CURRENT_PLUGIN_VERSION,
						desc: "Read the release notes to learn whats new!",
						searchable: false,
						render: (setting) => {
							setting.settingEl.addClass(
								"task-board-release-notes-overview-setting",
							);
							setting
								.setName(
									"task-board" + " " + CURRENT_PLUGIN_VERSION,
								)
								.setDesc(
									"Read the release notes to learn whats new!",
								)
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
											// 					.operonDocsFolder,
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
										.setButtonText(t("Open docs"))
										.onClick(() => {
											new Notice("Not Implemented!");
											// scopeSettingsModal(
											// 	new TaskBoardReleaseNotesModal(
											// 		this.app,
											// 		getReleaseNotesForManualView(),
											// 		{
											// 			docsFolder:
											// 				this.settings
											// 					.operonDocsFolder,
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
			this.createLegacySettingsPage("general", [
				"filters-for-scanning",
				"scanning-mode",
				"auto-add-unique-id",
				"open-board-on-obsidian-startup",
				"show-modified-files-message-on-startup",
				"ribbon-icon-action",
				"update-language-translations",
				"tasks-cache-file-path",
				"import-export-configurations",
				"export-logs",
				"Safeguard feature",
			]),
			this.createLegacySettingsPage("all-ui", [
				"task-card-style",
				"show-task-without-metadata",
				"width-of-task-card",
				"show-column-scroll-bar",
				"interactions",
				"edit-button-mode",
				"double-click-card-action",
				"drag-and-drop",
				"tag-colors",
				"tag-color-indicator-type",
				"add-tag-color",
				"tag-name",
				...tagColorAliases,
			]),
			{
				type: "page",
				name: t("properties"),
				items: [
					{
						type: "page",
						name: t("default-properties"),
						desc: t("default-properties-info"),
						items: [
							{
								type: "list",
								items: [
									this.createLegacySettingsEntry(
										"default-properties",
										[
											"supported-properties",
											...customStatusAliases,
										],
									),
								],
							},
						],
					},
					{
						type: "page",
						name: t("custom-properties"),
						desc: t("custom-properties-info"),
						items: [
							{
								type: "list",
								items: [
									this.createLegacySettingsEntry(
										"custom-properties",
										["extra-properties"],
									),
								],
							},
						],
					},
					{
						type: "page",
						name: t("custom-statuses"),
						desc: t("custom-statuses-info"),
						items: [
							{
								type: "list",
								items: [
									this.createLegacySettingsEntry(
										"custom-statuses",
										[
											"custom-statuses",
											"status-name",
											"status-symbol",
											"status-action",
											"name",
											"symbol",
											"click-action",
											"lucide-icon",
											"add-new-status",
											"import-from-tasks-plugin",
											...customStatusAliases,
										],
									),
								],
							},
						],
					},
					{
						type: "page",
						name: t("custom-priorities"),
						desc: t("custom-priorities-info"),
						items: [
							{
								type: "list",
								heading: t("custom-statuses"),
								items: [
									this.createLegacySettingsEntry(
										"custom-priorities",
										[
											"custom-statuses",
											"status-name",
											"status-symbol",
											"status-action",
											"name",
											"symbol",
											"click-action",
											"lucide-icon",
											"add-new-status",
											"import-from-tasks-plugin",
											...customStatusAliases,
										],
									),
								],
							},
						],
					},
				],
			},
			{
				type: "page",
				name: t("views"),
				items: [
					{
						type: "page",
						name: t("map-view"),
						desc: t("map-view-tab-info"),
						items: [
							this.createLegacySettingsEntry("map-view", [
								"render-only-visible-nodes",
								"controls",
								"mouse-wheel-behaviour",
								"appearance",
								"canvas-background",
								"map-orientation",
								"link-arrow-direction",
								"link-style",
								"animate-links",
								"show-minimap",
							]),
						],
					},
				],
			},
			this.createLegacySettingsPage("inline-tasks", [
				"supported-plugin-formats",
				"default-note-for-adding-new-tasks",
				"file-for-archived-tasks",
				"show-note-frontmatter-tags-in-the-card-header",
				"hide-specific-properties-in-notes",
				"ID",
				"Tags",
				"Priority",
				"Created Date",
				"Start Date",
				"Scheduled Date",
				"Due Date",
				"Completion Date",
				"Cancelled Date",
				"Time",
				"Reminder",
				"Recurring",
				"On-completion",
				"Dependencies",
			]),
			this.createLegacySettingsPage("task-notes", [
				"task-note-vs-tbnote",
				"task-note-identifier-tag",
				"default-location-for-new-task-notes",
				"folder-for-archived-task-notes",
				"frontmatter-formatting",
			]),
			this.createLegacySettingsPage("automation", [
				"restrict-task-completion-to-child-tasks-and-sub-tasks",
				"auto-add-universal-date-to-tasks",
				"auto-add-created-date",
				"auto-add-completed-date",
				"auto-add-cancelled-date",
				"compatible-plugins",
				"daily-notes",
				"Day Planner plugin compatibility",
				"QuickAdd plugin compatibility",
				"default-quickadd-choice",
				"push-notification-compatibility",
			]),
			this.createLegacySettingsPage("formats", [
				"universal-date",
				"date-format",
				"date-time-format",
				"default-start-time",
				"first-day-of-the-week",
			]),
			this.createLegacySettingsPage("experimental-features", [
				"embed-board",
			]),
			{
				type: "group",
				name: t("support"),
				items: [
					this.createLegacySettingsEntry("support-development", [
						"support-development",
						"donation",
					]),
				],
			},
		];
	}

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
					desc: "Hello",
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

	hide(): void {
		this.settingsManager.cleanUp();
	}
}
