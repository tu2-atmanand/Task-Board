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
} from "obsidian";
import TaskBoard from "../../main.js";
import { PropertyConfigurationModal } from "../ui/modals/PropertyConfigurationModal.js";
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
		this.createPropertyValuePill(values, "Key", current.key);
		this.createPropertyValuePill(values, "ID", current.id);

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
	): SettingDefinitionItem[] {
		const propertyGroup = type;
		const properties =
			propertyGroup === "default"
				? this.globalSettings.defaultProperties
				: this.globalSettings.customProperties;
		const pageTitle = t(`${propertyGroup}-properties-mapping`);
		const helpText = t(`${propertyGroup}-properties-mapping-info`);

		return [
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
					host.removeClass("setting-item");
					host.addClass(
						"task-board-property-list",
						"task-board-settings-tab-root",
					);

					const help = host.createDiv(
						"setting-item-description task-board-key-mappings-help",
					);
					help.createEl("p", { text: helpText });

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
												...this.globalSettings.defaultProperties,
												...this.globalSettings.customProperties,
											].find(
												(candidate) =>
													candidate !== property &&
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
												this.showReloadNoticeIfNeeded();
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
												properties.indexOf(property);
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
														({ item, rank }) => {
															item.rank = rank;
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
												...this.globalSettings.defaultProperties,
												...this.globalSettings.customProperties,
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
											const previousRanks = properties.map(
												(property) => ({
													property,
													rank: property.rank,
												}),
											);
											properties.push(updatedProperty);
											this.normalizePropertyRanks(
												properties,
											);
											try {
												await this.settingsManager.saveSettings();
											} catch (error) {
												properties.pop();
												previousRanks.forEach(
													({ property, rank }) => {
														property.rank = rank;
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
		];
	}

	hide(): void {
		this.settingsManager.cleanUp();
	}
}
