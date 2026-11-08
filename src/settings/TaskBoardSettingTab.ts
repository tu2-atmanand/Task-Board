// src/views/TaskBoardSettingTab.ts

import { t } from "i18next";
import {
	App,
	Notice,
	PluginSettingTab,
	setIcon,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionPage,
} from "obsidian";
import TaskBoard from "../../main.js";
import {
	globalSettingsData,
	SupportedPropertiesConfig,
} from "../interfaces/GlobalSettings.js";
import { PropertyTypeConfig } from "../interfaces/Enums.js";
import { TaskBoardIcon } from "../interfaces/Icons.js";
import { SettingsManager, SettingsTabPagesKey } from "./SettingConstructUI.js";
import { CURRENT_PLUGIN_VERSION } from "../interfaces/Constants.js";
import { setSettingsScope } from "./ScopeSettings.js";
import { showReloadObsidianNotice } from "./SettingSynchronizer.js";

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
		return button.closest(".task-board-settings-docs-tooltip-anchor") ?? button;
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

	private updateNativeSettingsDefinitions(): void {
		this.update();
	}

	private showReloadNoticeIfNeeded(): void {
		if (this.reloadNoticeAlreadyShown) return;
		this.reloadNoticeAlreadyShown = true;
		void showReloadObsidianNotice(this.plugin);
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
			// 			items: ,
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
						type: "group",
						items: [
							{
								type: "page",
								name: t("default-properties"),
								desc: t("default-properties-info"),
								items: this.renderPropertiesConfigurationSection(
									this.containerEl,
									"default",
								),
							},
							{
								type: "page",
								name: t("custom-properties"),
								desc: t("custom-properties-info"),
								items: this.renderPropertiesConfigurationSection(
									this.containerEl,
									"custom",
								),
							},
						],
					},
					{
						type: "group",
						items: [
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
				heading: t("support"),
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
							.setName("Hide property in inline task notes")
							.addToggle((toggle) =>
								toggle
									.setValue(
										current.hidePropertyInNotesForInlineTasks,
									)
									.onChange((value) => {
										current.hidePropertyInNotesForInlineTasks =
											value;
										save();
										this.showReloadNoticeIfNeeded();
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
									.setWarning()
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
		current: SupportedPropertiesConfig,
		propertyGroup: "default" | "custom",
		isNew = false,
	): SettingDefinitionPage {
		return {
			type: "page",
			name: current.name,
			// desc: this.createPropertySummaryDescription(current),
			items: [
				this.renderSupportedPropertyConfigurationPage(
					current,
					propertyGroup,
					isNew,
				),
			],
		};
	}

	private createPropertySummaryDescription(
		property: SupportedPropertiesConfig,
	): DocumentFragment {
		return createFragment((summary) => {
			const root = summary.createDiv("task-board-property-summary");

			// Row-1 = Icon + Title (on Left) | Type (on Right)
			const heading = root.createDiv(
				"task-board-property-summary-heading",
			);
			const headingLeft = heading.createDiv(
				"task-board-property-summary-heading-left",
			);
			const icon = headingLeft.createSpan({
				cls: "task-board-property-summary-heading-icon",
			});

			if (property.icon) setIcon(icon, property.icon);
			else icon.setText(property.emoji || "");

			headingLeft.createSpan({
				cls: "task-board-property-summary-heading-name",
				text: property.name,
			});
			const headingRight = heading.createDiv(
				"task-board-property-summary-heading-right",
			);
			headingRight.createSpan({
				cls: `task-board-property-summary-type task-board-property-type-${property.type}`,
				text: property.type,
			});

			// Row-2 = Description (Will only show description for now)
			const details = root.createDiv(
				"task-board-property-summary-details",
			);
			const detailValues = [
				// ["Key", property.key],
				// ["Frontmatter", property.id],
				["Description", property.desc],
				// ["Emoji", property.emoji],
				// [
				// 	"Hidden in notes",
				// 	property.hidePropertyInNotesForInlineTasks ? "Yes" : "No",
				// ],
				// [
				// 	"Default",
				// 	Array.isArray(property.defaultValue)
				// 		? property.defaultValue.join(", ")
				// 		: String(property.defaultValue),
				// ],
			];
			for (const [label, value] of detailValues) {
				const detail = details.createDiv(
					"task-board-property-summary-detail",
				);
				// detail.createSpan({
				// 	cls: "task-board-property-summary-label",
				// 	text: `${label}:`,
				// });
				detail.createSpan({ text: value });
			}

			const properties = this.globalSettings.defaultProperties.includes(
				property,
			)
				? this.globalSettings.defaultProperties
				: this.globalSettings.customProperties;
			const orderedProperties = properties
				.slice()
				.sort((a, b) => a.rank - b.rank);
			const index = orderedProperties.indexOf(property);

			// Row-3 = Up and Down arrow icons to move the item up and down
			const controls = root.createDiv(
				"task-board-property-summary-order-controls",
			);
			for (const [direction, iconName, label] of [
				[-1, "arrow-up", "Move property up"],
				[1, "arrow-down", "Move property down"],
			] as const) {
				const button = controls.createEl("button", {
					cls: "clickable-icon",
					attr: {
						type: "button",
						"aria-label": label,
						title: label,
					},
				});
				setIcon(button, iconName);
				button.disabled =
					direction < 0
						? index <= 0
						: index < 0 || index >= orderedProperties.length - 1;
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					this.moveProperty(properties, property, direction);
				});
			}
		});
	}

	private renderPropertiesConfigurationSection(
		contentEl: HTMLElement,
		type: string,
	): SettingDefinitionItem[] {
		const prepareHost = (setting: Setting): HTMLElement => {
			const host = setting.settingEl;
			host.empty();
			host.removeClass("setting-item");
			host.addClass(
				"task-board-settings-tab-root",
				"task-board-settings-native-page-root",
				"task-board-key-mapping-search-item",
			);
			return host;
		};

		if (type === "default") {
			return [
				{
					name: "",
					searchable: false,
					render: (setting) => {
						const host = prepareHost(setting);
						const explanation = host.createDiv(
							"setting-item-description task-board-key-mappings-help",
						);
						explanation.createEl("p", {
							text: t("default-properties-mapping-info"),
						});
						const title = t("default-properties-mapping");
						return attachDeclarativeSettingsPageTitleAction(
							host,
							title,
							[
								"DOCS-039 Key mappings",
								"DOCS-018 Task properties",
							].map(
								(target) =>
									buildNativeSettingsDocsAction(title, target)
										.action,
							),
						);
					},
				},
				...this.globalSettings.defaultProperties
					.slice()
					.sort((a, b) => a.rank - b.rank)
					.map((mapping) => ({
						...this.renderKeyMappingRow(mapping, "default"),
						aliases: [
							mapping.name,
							mapping.id,
							mapping.type,
							"keymapping",
							"key mappings",
							"frontmatter key",
						],
						class: "task-board-property-listitem",
					})),
			];
		} else {
			return [
				{
					name: "",
					searchable: false,
					render: (setting) => {
						const host = prepareHost(setting);
						const explanation = host.createDiv(
							"setting-item-description task-board-key-mappings-help",
						);
						explanation.createEl("p", {
							text: t("custom-properties-mapping-info"),
						});
						const title = t("custom-properties-mapping");
						return attachDeclarativeSettingsPageTitleAction(
							host,
							title,
							[
								"DOCS-039 Key mappings",
								"DOCS-018 Task properties",
							].map(
								(target) =>
									buildNativeSettingsDocsAction(title, target)
										.action,
							),
						);
					},
				},
				...this.globalSettings.customProperties
					.slice()
					.sort((a, b) => a.rank - b.rank)
					.map((mapping) => ({
						...this.renderKeyMappingRow(mapping, "custom"),
						aliases: [
							mapping.name,
							mapping.id,
							mapping.type,
							"keymapping",
							"key mappings",
							"frontmatter key",
						],
					})),
				this.renderKeyMappingRow(
					this.createNewCustomProperty(),
					"custom",
					true,
				),
			];
		}
	}

	private createNewCustomProperty(): SupportedPropertiesConfig {
		const existingIds = new Set(
			this.globalSettings.customProperties.map((property) => property.id),
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
		current: SupportedPropertiesConfig,
		direction: -1 | 1,
	) {
		const orderedProperties = properties
			.slice()
			.sort((a, b) => a.rank - b.rank);
		const index = orderedProperties.indexOf(current);
		const targetIndex = index + direction;
		if (
			index < 0 ||
			targetIndex < 0 ||
			targetIndex >= orderedProperties.length
		)
			return;

		[orderedProperties[index], orderedProperties[targetIndex]] = [
			orderedProperties[targetIndex],
			orderedProperties[index],
		];
		orderedProperties.forEach((property, rank) => {
			property.rank = rank + 1;
		});
		await this.settingsManager.saveSettings();
		this.updateNativeSettingsDefinitions();
	}

	hide(): void {
		this.settingsManager.cleanUp();
	}
}
