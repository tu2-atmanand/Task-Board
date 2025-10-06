import { App, Modal, Setting, Notice, DropdownComponent } from "obsidian";
import { RootFilterState } from "./ViewTaskFilter";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { SavedFilterConfig } from "src/interfaces/BoardConfigs";

export class FilterConfigModal extends Modal {
	private plugin: TaskBoard;
	private mode: "save" | "load";
	private currentFilterState?: RootFilterState;
	private onSave?: (config: SavedFilterConfig) => void;
	private onLoad?: (config: SavedFilterConfig) => void;

	constructor(
		app: App,
		plugin: TaskBoard,
		mode: "save" | "load",
		currentFilterState?: RootFilterState,
		onSave?: (config: SavedFilterConfig) => void,
		onLoad?: (config: SavedFilterConfig) => void
	) {
		super(app);
		this.plugin = plugin;
		this.mode = mode;
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

		contentEl.createEl("h2", { text: t("Save Filter Configuration") });

		let nameValue = "";
		let descriptionValue = "";

		new Setting(contentEl)
			.setName(t("Filter Configuration Name"))
			.setDesc(t("Enter a name for this filter configuration"))
			.addText((text) => {
				text.setPlaceholder(t("Filter Configuration Name"))
					.setValue(nameValue)
					.onChange((value) => {
						nameValue = value;
					});
			});

		new Setting(contentEl)
			.setName(t("Filter Configuration Description"))
			.setDesc(
				t(
					"Enter a description for this filter configuration (optional)"
				)
			)
			.addTextArea((text) => {
				text.setPlaceholder(t("Filter Configuration Description"))
					.setValue(descriptionValue)
					.onChange((value) => {
						descriptionValue = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText(t("Save"))
					.setCta()
					.onClick(() => {
						this.saveConfiguration(nameValue, descriptionValue);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("Cancel")).onClick(() => {
					this.close();
				});
			});
	}

	private renderLoadMode() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: t("Load Filter Configuration") });

		const savedConfigs = this.plugin.settings.data.boardConfigs[activeBoardIndex].filterConfig.savedConfigs;

		if (savedConfigs.length === 0) {
			contentEl.createEl("p", {
				text: t("No saved filter configurations"),
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
			.setName(t("Select a saved filter configuration"))
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOption(
					"",
					t("Select a saved filter configuration")
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
				btn.setButtonText(t("Load"))
					.setCta()
					.onClick(() => {
						this.loadConfiguration(selectedConfigId);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("Delete"))
					.setWarning()
					.onClick(() => {
						this.deleteConfiguration(selectedConfigId);
					});
			})
			.addButton((btn) => {
				btn.setButtonText(t("Cancel")).onClick(() => {
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

		const config = this.plugin.settings.data.boardConfigs[
			activeBoardIndex
		].filterConfig.savedConfigs.find((c) => c.id === configId);

		if (!config) return;

		detailsContainer.createEl("h3", { text: config.name });

		if (config.description) {
			detailsContainer.createEl("p", { text: config.description });
		}

		detailsContainer.createEl("p", {
			text: `${t("Created")}: ${new Date(
				config.createdAt
			).toLocaleString()}`,
			cls: "filter-config-meta",
		});

		detailsContainer.createEl("p", {
			text: `${t("Updated")}: ${new Date(
				config.updatedAt
			).toLocaleString()}`,
			cls: "filter-config-meta",
		});

		// Show filter summary
		const filterSummary = detailsContainer.createDiv({
			cls: "filter-config-summary",
		});
		filterSummary.createEl("h4", { text: t("Filter Summary") });

		const groupCount = config.filterState.filterGroups.length;
		const totalFilters = config.filterState.filterGroups.reduce(
			(sum, group) => sum + group.filters.length,
			0
		);

		filterSummary.createEl("p", {
			text: `${groupCount} ${t("filter group")}${
				groupCount !== 1 ? "s" : ""
			}, ${totalFilters} ${t("filter")}${totalFilters !== 1 ? "s" : ""}`,
		});

		filterSummary.createEl("p", {
			text: `${t("Root condition")}: ${config.filterState.rootCondition}`,
		});
	}

	private async saveConfiguration(name: string, description: string) {
		if (!name.trim()) {
			new Notice(t("Filter configuration name is required"));
			return;
		}

		if (!this.currentFilterState) {
			new Notice(t("Failed to save filter configuration"));
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
			this.plugin.settings.data.boardConfigs[
				activeBoardIndex
			].filterConfig.savedConfigs.push(config);
			await this.plugin.saveSettings();

			new Notice(t("Filter configuration saved successfully"));

			if (this.onSave) {
				this.onSave(config);
			}

			this.close();
		} catch (error) {
			console.error("Failed to save filter configuration:", error);
			new Notice(t("Failed to save filter configuration"));
		}
	}

	private async loadConfiguration(configId: string) {
		if (!configId) {
			new Notice(t("Select a saved filter configuration"));
			return;
		}

		const config = this.plugin.settings.data.boardConfigs[
			activeBoardIndex
		].filterConfig.savedConfigs.find((c) => c.id === configId);

		if (!config) {
			new Notice(t("Failed to load filter configuration"));
			return;
		}

		try {
			if (this.onLoad) {
				this.onLoad(config);
			}

			new Notice(t("Filter configuration loaded successfully"));
			this.close();
		} catch (error) {
			console.error("Failed to load filter configuration:", error);
			new Notice(t("Failed to load filter configuration"));
		}
	}

	private async deleteConfiguration(configId: string) {
		if (!configId) {
			new Notice(t("Select a saved filter configuration"));
			return;
		}

		const config = this.plugin.settings.data.boardConfigs[
			activeBoardIndex
		].filterConfig.savedConfigs.find((c) => c.id === configId);

		if (!config) {
			new Notice(t("Failed to delete filter configuration"));
			return;
		}

		// Confirm deletion
		const confirmed = await new Promise<boolean>((resolve) => {
			const confirmModal = new Modal(this.app);
			confirmModal.contentEl.createEl("h2", {
				text: t("Delete Filter Configuration"),
			});
			confirmModal.contentEl.createEl("p", {
				text: t(
					"Are you sure you want to delete this filter configuration?"
				),
			});
			confirmModal.contentEl.createEl("p", {
				text: `"${config.name}"`,
				cls: "filter-config-name-highlight",
			});

			new Setting(confirmModal.contentEl)
				.addButton((btn) => {
					btn.setButtonText(t("Delete"))
						.setWarning()
						.onClick(() => {
							resolve(true);
							confirmModal.close();
						});
				})
				.addButton((btn) => {
					btn.setButtonText(t("Cancel")).onClick(() => {
						resolve(false);
						confirmModal.close();
					});
				});

			confirmModal.open();
		});

		if (!confirmed) return;

		try {
			this.plugin.settings.data.boardConfigs[
				activeBoardIndex
			].filterConfig.savedConfigs =
				this.plugin.settings.data.boardConfigs[
					activeBoardIndex
				].filterConfig.savedConfigs.filter((c) => c.id !== configId);

			await this.plugin.saveSettings();

			new Notice(t("Filter configuration deleted successfully"));

			// Refresh the load mode display
			this.close();

			// Reopen in load mode to refresh the list
			const newModal = new FilterConfigModal(
				this.app,
				this.plugin,
				"load",
				undefined,
				this.onSave,
				this.onLoad
			);
			newModal.open();
		} catch (error) {
			console.error("Failed to delete filter configuration:", error);
			new Notice(t("Failed to delete filter configuration"));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
