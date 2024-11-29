// src/views/TaskBoardSettingTab.ts

import { App, PluginSettingTab, Setting } from "obsidian";

import { SettingsManager } from "../settings/TaskBoardSettingConstructUI";
import type TaskBoard from "../../main";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { scanningFiltersTab } from "src/settings/ScanningFiltersTab";
import { t } from "src/utils/lang/helper";

export class TaskBoardSettingTab extends PluginSettingTab {
	plugin: TaskBoard;
	settingsManager: SettingsManager;
	globalSettings: globalSettingsData | null = null;
	settingsPage!: HTMLElement;

	constructor(app: App, plugin: TaskBoard) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = new SettingsManager(app, plugin);
	}

	TABS = {
		GENERAL: {
			name: "General",
			id: "general",
		},
		FILTERS: {
			name: "Filters",
			id: "filters",
		},
		UI_SETTINGS: {
			name: "UI",
			id: "ui_settings",
		},
		AUTOMATIONS: {
			name: "Automations",
			id: "automations",
		},
		FORMATS: {
			name: "Formats",
			id: "formats",
		},
	};

	renderSettingsPage(tabId: string) {
		this.settingsPage.empty();
		switch (tabId.toLocaleLowerCase()) {
			case this.TABS.GENERAL.id:
				scanningFiltersTab();
				break;
			case this.TABS.FOLDER_OVERVIEW.id:
				renderFolderOverview(this);
				break;
			case this.TABS.EXCLUDE_FOLDERS.id:
				renderExcludeFolders(this);
				break;
			case this.TABS.FILE_EXPLORER.id:
				renderFileExplorer(this);
				break;
			case this.TABS.PATH.id:
				renderPath(this);
				break;
		}
	}

	// Display the settings in the settings tab
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("TaskBoardSettingTab");

		const tabBar = containerEl.createEl("nav", {
			cls: "fn-settings-tab-bar",
		});
		for (const [tabId, tabInfo] of Object.entries(this.TABS)) {
			const tabEl = tabBar.createEl("div", {
				cls: "fn-settings-tab",
			});
			const tabName = tabEl.createEl("div", {
				cls: "fn-settings-tab-name",
				text: tabInfo.name,
			});
			if (
				this.plugin.settings.data.globalSettings.settingsTab.toLocaleLowerCase() ===
				tabId.toLocaleLowerCase()
			) {
				tabEl.addClass("fn-settings-tab-active");
			}
			tabEl.addEventListener("click", () => {
				// @ts-ignore
				for (const tabEl of tabBar.children) {
					tabEl.removeClass("fn-settings-tab-active");
					this.plugin.settings.data.globalSettings.settingsTab =
						tabId.toLocaleLowerCase();
					this.plugin.saveSettings();
				}
				tabEl.addClass("fn-settings-tab-active");
				this.renderSettingsPage(tabId);
			});
		}
		this.settingsPage = containerEl.createDiv({
			cls: "fn-settings-page",
		});
		this.renderSettingsPage(
			this.plugin.settings.data.globalSettings.settingsTab
		);

		this.settingsManager.constructUI(containerEl, t(130));
	}
}
