// src/views/TaskBoardSettingTab.ts

import { t } from "i18next";
import {
	App,
	PluginSettingTab,
	setIcon,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";
import TaskBoard from "../../main.js";
import {
	globalSettingsData,
	SupportedPropertiesConfig,
} from "../interfaces/GlobalSettings.js";
import { TaskBoardIcon } from "../interfaces/Icons.js";
import { SettingsManager, SettingsTabPagesKey } from "./SettingConstructUI.js";
import { CURRENT_PLUGIN_VERSION } from "../interfaces/Constants.js";
import { scopeSettingsModal, setSettingsScope } from "./ScopeSettings.js";
import { createFragmentWithHTML } from "../utils/UIHelpers.js";

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
			".operon-native-settings-page-title-docs-action",
		)
	)
		return;

	const hadScope = titlebarEl.classList.contains("operon-settings-scope");
	setSettingsScope(titlebarEl, true);
	const anchors = (Array.isArray(action) ? action : [action]).map((item) => {
		const button = renderNativeSettingsPageTitleAction(
			titlebarEl,
			item,
			true,
		);
		return button.closest(".operon-settings-docs-tooltip-anchor") ?? button;
	});
	return () => {
		for (const anchor of anchors) anchor.remove();
		if (
			!titlebarEl.querySelector(
				".operon-native-settings-page-title-docs-action",
			)
		) {
			titlebarEl.removeClass(
				"operon-native-settings-page-titlebar-with-docs",
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
	titlebarEl.addClass("operon-native-settings-page-titlebar-with-docs");
	const existingButton = append
		? null
		: titlebarEl.querySelector<HTMLButtonElement>(
				".operon-native-settings-page-title-docs-action",
			);
	const existingTooltipAnchor = existingButton?.closest(
		".operon-settings-docs-tooltip-anchor",
	);
	if (existingTooltipAnchor) existingTooltipAnchor.remove();
	else existingButton?.remove();

	const actionButton = titlebarEl.createEl("button", {
		cls: "clickable-icon operon-native-settings-page-title-docs-action",
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

	private updateNativeSettingsDefinitions(): void {
		this.update();
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
			// {
			// 	type: "page",
			// 	name: t("general"),
			// 	items: [
			// 		{
			// 			type: "list",
			// 			name: t("filters-for-scanning"),
			// 			desc: createFragmentWithHTML(
			// 				t("name-of-the-file-folder-tag-for-filter-info") +
			// 					"<br/>" +
			// 					"<b>" +
			// 					t("note") +
			// 					" :</b> " +
			// 					t(
			// 						"name-of-the-file-folder-tag-for-filter-info-2",
			// 					),
			// 			),
			// 			items: [this.renderCustomPropertiesSection],
			// 		},
			// 	],
			// },
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
						items: this.renderCustomPropertiesSection(
							this.containerEl,
						),
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

	// ---------------------------------------------
	//      Custom Settings Sections Rendering
	// ---------------------------------------------

	private renderSupportedPropertyConfigurationPage(
		current: SupportedPropertiesConfig,
	): SettingDefinitionGroup {
		return {
			type: "list",
			items: [
				// For defaultProperties - Render each of the settings here for user to input the values for SupportedPropertiesConfig, except name, because name is something by default supported by Task Board. - This will going to replace the this.globalSettings.frontmatterFormatting setting. It will going to be deprecated.

				// For customProperties - Render each of the settings here for user to input the values for SupportedPropertiesConfig.
			],
		};
	}

	private renderKeyMappingRow(
		host: HTMLElement,
		current: SupportedPropertiesConfig,
	): SettingDefinitionItem {
		return {
			type: "page",
			name: "",
			render: (setting) => {
				// Row 1 = [current.lucideIcon] [current.name] + [current.type]
				// The lucide icon should be rendered and then will be the name, aligned to left. The type should be aligned to the right and should be shown as a pill and different type will be of different pill colors. For example, text = blue, numeric = greeen, etc..
				// Row 2 = A columnn of key value pair of other fields such as desc, emoji, hidden in notes, default value.
				// Row 3 = There will be two icon side by side, with icons of up-arrow and down-arrow. This buttons will be used to change the rank of the property item. And accordingly it should refresh and move it up and down.
			},
		};
	}

	private renderCustomPropertiesSection(
		contentEl: HTMLElement,
	): SettingDefinitionItem[] {
		const prepareHost = (setting: Setting): HTMLElement => {
			const host = setting.settingEl;
			host.empty();
			host.removeClass("setting-item");
			host.addClass(
				"operon-settings-tab-root",
				"operon-settings-native-page-root",
				"operon-key-mapping-search-item",
			);
			return host;
		};

		return [
			{
				name: "",
				searchable: false,
				render: (setting) => {
					const host = prepareHost(setting);
					const explanation = host.createDiv(
						"setting-item-description operon-key-mappings-help",
					);
					explanation.createEl("p", {
						text: t("custom-properties-mapping"),
					});
					const title = t("custom-properties-mapping");
					// return attachDeclarativeSettingsPageTitleAction(
					// 	host,
					// 	title,
					// 	[
					// 		"DOCS-039 Key mappings",
					// 		"DOCS-018 Task properties",
					// 	].map(
					// 		(target) =>
					// 			this.buildNativeSettingsDocsAction(
					// 				title,
					// 				target,
					// 			).action,
					// 	),
					// );
				},
			},
			...this.globalSettings.customProperties.map(
				(mapping): SettingDefinition => ({
					name:
						mapping.name === mapping.id
							? mapping.id
							: `${mapping.name} — ${mapping.id}`,
					desc: mapping.desc,
					aliases: [
						mapping.name,
						mapping.id,
						mapping.type,
						"keymapping",
						"key mappings",
						"frontmatter key",
					],
					render: (setting) => {
						const host = prepareHost(setting);
						const current =
							this.globalSettings.customProperties.find(
								(candidate) => candidate.id === mapping.id,
							);
						if (current) this.renderKeyMappingRow(host, current);
						// return () => {
						// 	closeFloatingPanelsForRoot(host);
						// 	cleanupOperonHoverTooltips(host);
						// };
					},
				}),
			),
		];
	}

	hide(): void {
		this.settingsManager.cleanUp();
	}
}
