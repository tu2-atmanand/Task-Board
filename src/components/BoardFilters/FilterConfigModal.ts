import { App, Modal, Setting, Notice, DropdownComponent } from "obsidian";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import {
	FilterGroup,
	RootFilterState,
	SavedFilterConfig,
} from "src/interfaces/BoardConfigs";

export class FilterConfigModal extends Modal {
	private plugin: TaskBoard;
	private mode: "save" | "load";
	private currentFilterState?: RootFilterState;
	private onSave?: (config: SavedFilterConfig) => void;
	private onLoad?: (config: SavedFilterConfig) => void;
	private activeBoardIndex: number;

	constructor(
		app: App,
		plugin: TaskBoard,
		mode: "save" | "load",
		activeBoardIndex: number,
		currentFilterState?: RootFilterState,
		onSave?: (config: SavedFilterConfig) => void,
		onLoad?: (config: SavedFilterConfig) => void
	) {
		super(app);
		this.plugin = plugin;
		this.mode = mode;
		this.activeBoardIndex = activeBoardIndex;
		this.currentFilterState = currentFilterState;
		this.onSave = onSave;
		this.onLoad = onLoad;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.mode === "save") {
			this.renderSaveMode();
		} else {
			this.renderLoadMode();
		}
	}

	private renderSaveMode() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: t("save-filter-configuration") });

		let nameValue = "";
		let descriptionValue = "";

		new Setting(contentEl)
			.setName(t("filter-configuration-name"))
			.setDesc(t("filter-configuration-name-info"))
			.addText((text) => {
				text.setPlaceholder(t("filter-configuration-name"))
					.setValue(nameValue)
					.onChange((value) => {
						nameValue = value;
					});
			});

		new Setting(contentEl)
			.setName(t("filter-configuration-description"))
			.setDesc(t("filter-configuration-description-info"))
			.addTextArea((text) => {
				text.setPlaceholder(t("filter-configuration-description"))
					.setValue(descriptionValue)
					.onChange((value) => {
						descriptionValue = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText(t("save"))
					.setCta()
					.onClick(() => {
						this.saveConfiguration(nameValue, descriptionValue);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("cancel")).onClick(() => {
					this.close();
				});
			});
	}

	private renderLoadMode() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: t("load-filter-configuration") });

		const board =
			this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
		if (!board.filterConfig) {
			board.filterConfig = {
				enableSavedFilters: true,
				savedConfigs: [],
			};
		}
		const savedConfigs = board.filterConfig.savedConfigs;

		if (savedConfigs.length === 0) {
			contentEl.createEl("p", {
				text: t("no-saved-filter-configurations"),
			});
			new Setting(contentEl).addButton((btn) => {
				btn.setButtonText(t("Close")).onClick(() => {
					this.close();
				});
			});
			return;
		}

		let selectedConfigId = "";

		new Setting(contentEl)
			.setName(t("select-a-saved-filter-configuration"))
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOption(
					"",
					t("select-a-saved-filter-configuration")
				);

				savedConfigs.forEach((config) => {
					dropdown.addOption(config.id, config.name);
				});

				dropdown.onChange((value) => {
					selectedConfigId = value;
					this.updateConfigDetails(value);
				});
			});

		// Container for config details
		const detailsContainer = contentEl.createDiv({
			cls: "filter-config-details",
		});

		// Buttons container
		const buttonsContainer = contentEl.createDiv({
			cls: "filter-config-buttons",
		});

		new Setting(buttonsContainer)
			.addButton((btn) => {
				btn.setButtonText(t("load"))
					.setCta()
					.onClick(() => {
						this.loadConfiguration(selectedConfigId);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("delete"))
					.setWarning()
					.onClick(() => {
						this.deleteConfiguration(selectedConfigId);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("cancel")).onClick(() => {
					this.close();
				});
			});

		// Store references for updating
		(this as any).detailsContainer = detailsContainer;
	}

	private updateConfigDetails(configId: string) {
		const detailsContainer = (this as any).detailsContainer;
		if (!detailsContainer) return;

		detailsContainer.empty();

		if (!configId) return;

		const board =
			this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
		if (!board.filterConfig) return;

		const config = board.filterConfig.savedConfigs.find(
			(c: SavedFilterConfig) => c.id === configId
		);

		if (!config) return;

		detailsContainer.createEl("h3", { text: config.name });

		if (config.description) {
			detailsContainer.createEl("p", { text: config.description });
		}

		detailsContainer.createEl("p", {
			text: `${t("created")}: ${new Date(
				config.createdAt
			).toLocaleString()}`,
			cls: "filter-config-meta",
		});

		detailsContainer.createEl("p", {
			text: `${t("updated")}: ${new Date(
				config.updatedAt
			).toLocaleString()}`,
			cls: "filter-config-meta",
		});

		// Show filter summary
		const filterSummary = detailsContainer.createDiv({
			cls: "filter-config-summary",
		});
		filterSummary.createEl("h4", { text: t("filter-summary") });

		const groupCount = config.filterState.filterGroups.length;
		const totalFilters = config.filterState.filterGroups.reduce(
			(sum: number, group: FilterGroup) => sum + group.filters.length,
			0
		);

		filterSummary.createEl("p", {
			text: `${groupCount} ${t("filter-group")}${
				groupCount !== 1 ? "s" : ""
			}, ${totalFilters} ${t("filter")}${totalFilters !== 1 ? "s" : ""}`,
		});

		filterSummary.createEl("p", {
			text: `${t("root-condition")}: ${config.filterState.rootCondition}`,
		});
	}

	private async saveConfiguration(name: string, description: string) {
		if (!name.trim()) {
			new Notice(t("filter-configuration-name-is-required"));
			return;
		}

		if (!this.currentFilterState) {
			new Notice(t("failed-to-save-filter-configuration"));
			return;
		}

		const now = new Date().toISOString();
		const config: SavedFilterConfig = {
			id: `filter-config-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`,
			name: name.trim(),
			description: description.trim() || undefined,
			filterState: JSON.parse(JSON.stringify(this.currentFilterState)),
			createdAt: now,
			updatedAt: now,
		};

		try {
			const board =
				this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
			if (!board.filterConfig) {
				board.filterConfig = {
					enableSavedFilters: true,
					savedConfigs: [],
				};
			}
			board.filterConfig.savedConfigs.push(config);
			await this.plugin.saveSettings();

			if (this.onSave) {
				this.onSave(config);
			}

			this.close();
		} catch (error) {
			console.error("Failed to save filter configuration:", error);
			new Notice(t("failed-to-save-filter-configuration"));
		}
	}

	private async loadConfiguration(configId: string) {
		if (!configId) {
			new Notice(t("select-a-saved-filter-configuration"));
			return;
		}

		const board =
			this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
		if (!board.filterConfig) return;

		const config = board.filterConfig.savedConfigs.find(
			(c: SavedFilterConfig) => c.id === configId
		);

		if (!config) {
			new Notice(t("failed-to-load-filter-configuration"));
			return;
		}

		try {
			if (this.onLoad) {
				this.onLoad(config);
			}

			this.close();
		} catch (error) {
			console.error("Failed to load filter configuration:", error);
			new Notice(t("failed-to-load-filter-configuration"));
		}
	}

	private async deleteConfiguration(configId: string) {
		if (!configId) {
			new Notice(t("Select a saved filter configuration"));
			return;
		}

		const board =
			this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
		if (!board.filterConfig) return;

		const config = board.filterConfig.savedConfigs.find(
			(c: SavedFilterConfig) => c.id === configId
		);

		if (!config) {
			new Notice(t("failed-to-delete-filter-configuration"));
			return;
		}

		// Confirm deletion
		const confirmed = await new Promise<boolean>((resolve) => {
			const confirmModal = new Modal(this.app);
			confirmModal.contentEl.createEl("h2", {
				text: t("delete-filter-configuration"),
			});
			confirmModal.contentEl.createEl("p", {
				text: t("delete-filter-configuration-question"),
			});
			confirmModal.contentEl.createEl("p", {
				text: `"${config.name}"`,
				cls: "filter-config-name-highlight",
			});

			new Setting(confirmModal.contentEl)
				.addButton((btn) => {
					btn.setButtonText(t("delete"))
						.setWarning()
						.onClick(() => {
							resolve(true);
							confirmModal.close();
						});
				})
				.addButton((btn) => {
					btn.setButtonText(t("cancel")).onClick(() => {
						resolve(false);
						confirmModal.close();
					});
				});

			confirmModal.open();
		});

		if (!confirmed) return;

		try {
			const board =
				this.plugin.settings.data.boardConfigs[this.activeBoardIndex];
			if (!board.filterConfig) return;

			board.filterConfig.savedConfigs =
				board.filterConfig.savedConfigs.filter(
					(c: SavedFilterConfig) => c.id !== configId
				);

			await this.plugin.saveSettings();

			new Notice(t("filter-configuration-deleted-successfully"));

			// Refresh the load mode display
			this.close();

			// Reopen in load mode to refresh the list
			const newModal = new FilterConfigModal(
				this.app,
				this.plugin,
				"load",
				this.activeBoardIndex,
				undefined,
				this.onSave,
				this.onLoad
			);
			newModal.open();
		} catch (error) {
			console.error("Failed to delete filter configuration:", error);
			new Notice(t("failed-to-delete-filter-configuration"));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
