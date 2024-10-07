// main.ts - WORKING

import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginManifest,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	GlobalSettings,
	globalSettingsData,
} from "src/interfaces/KanbanView";
import {
	TaskBoardIcon,
	VIEW_TYPE_TASKBOARD,
} from "src/interfaces/GlobalVariables";

import { AddTaskModal } from "src/modal/AddTaskModal";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { KanbanView } from "./src/views/KanbanView";
import { RealTimeScanning } from "src/utils/RealTimeScanning";
import { ScanningVault } from "src/utils/ScanningVault";
import { TaskBoardSettingTab } from "./src/views/TaskBoardSettingTab";
import fs from "fs";
// import { loadGlobalSettings } from "src/utils/TaskItemUtils";
import path from "path";
import { refreshKanbanBoard } from "src/services/RefreshServices";

export default class TaskBoard extends Plugin {
	settings: GlobalSettings = DEFAULT_SETTINGS;
	scanningVault: ScanningVault;
	realTimeScanning: RealTimeScanning;
	fileStack: string[] = [];
	stackFilePath = path.join(
		(window as any).app.vault.adapter.basePath,
		".obsidian",
		"plugins",
		"Task-Board",
		"file-stack.json"
	);
	scanTimer: number;
	app: App;
	plugin: TaskBoard;

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.app = app;
		this.plugin = this;
		this.settings = DEFAULT_SETTINGS;
		this.scanTimer = 0;
		this.scanningVault = new ScanningVault(this.app, this.plugin);
		this.realTimeScanning = new RealTimeScanning(this.app, this.plugin);
	}

	async onload() {
		console.log("TaskBoard : loading plugin ...");

		// Create a ribbon icon to open the Kanban board view
		const ribbonIconEl = this.addRibbonIcon(
			TaskBoardIcon,
			"Open Task Board",
			() => {
				this.app.workspace
					.getLeaf(true)
					.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true });
			}
		);
		ribbonIconEl.addClass("Task-Board-ribbon-class");

		// Register a new command to open AddTaskModal
		this.addCommand({
			id: "open-add-task-modal",
			name: "Add New Task in Current File",
			callback: () => {
				const app = this.app as App;
				const activeFile = app.workspace.getActiveFile();

				if (activeFile) {
					new AddTaskModal(app, {
						app,
						filePath: activeFile.path,
						onTaskAdded: () => {
							// Refresh tasks or perform necessary actions after task is added
							// console.log("Task added successfully!");
						},
					}).open();
				} else {
					new Notice("No active file found to add a task.");
				}
			},
		});
		this.addCommand({
			id: "open-task-board",
			name: "Open Task Board",
			callback: () => {
				this.app.workspace
					.getLeaf(true)
					.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true });
			},
		});
		this.addCommand({
			id: "open-task-board-new-window",
			name: "Open Task Board in New Window",
			callback: () => {
				this.app.workspace.getLeaf("window").setViewState({
					type: VIEW_TYPE_TASKBOARD,
					active: true,
				});
			},
		});
		// // Add a command to Re-Scan the whole Vault
		// this.addCommand({
		// 	id: "rescan-vault-for-tasks",
		// 	name: "Re-Scan Vault",
		// 	callback: () => {
		// 		this.scanningVault.scanVaultForTasks();
		// 	},
		// });

		await this.loadSettings();
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		// Following line will create a localStorage if the realTimeScanning value is TRUE.
		this.realTimeScanning.initializeStack(
			this.settings.data.globalSettings.realTimeScanning
		);
		console.log("Creating localStorage ...");
		// Creating Few Events
		this.registerEvent(
			this.app.vault.on("modify", (file: TFile) =>
				this.realTimeScanning.onFileChange(
					file,
					this.settings.data.globalSettings.realTimeScanning,
					this.settings.data.globalSettings.scanFilters
				)
			)
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				// NOT REQUIRED : This will be same as the modify functinality, since after adding the file, it will be modified, so i will catch that.
				// console.log(
				// 	"NOT REQUIRED : This will be same as the modify functinality, since after adding the file, it will be modified, so i will catch that."
				// );
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				console.log(
					"TODO : A file has been renamed, immediately, change the corresponding data in Tasks.json file. That is find the old object under Pending and Completed part in tasks.json and either delete it or best way will be to replace the old name with new one."
				);
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				console.log(
					"TODO : A file has been deleted, immediately remove the corresponding data in Tasks.json file."
				);
			})
		);

		// this.settings = loadGlobalSettings().data.globalSettings;
		console.log("MAIN.ts : Loading the setting values : ", this.settings);

		// Run scanVaultForTasks if scanVaultAtStartup is true
		// TODO : This feature havent been tested. Also the way you are reading the variable scanVaultAtStartup is not correct.
		this.settings.data.globalSettings.scanVaultAtStartup
			? this.scanningVault.scanVaultForTasks()
			: "";

		// Register the Kanban view
		this.registerView(
			VIEW_TYPE_TASKBOARD,
			(leaf) => new KanbanView(this, leaf)
		);

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Total # Tasks Pending");

		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: "sample-editor-command",
		// 	name: "Sample editor command",
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection("Sample Editor Command");
		// 	},
		// });

		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(
		// 	window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		// );

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });
	}

	onunload() {
		console.log("TaskBoard : unloading plugin...");
		window.clearInterval(this.scanTimer);
		this.realTimeScanning.clearScanTimer();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKBOARD);
	}

	async loadSettings() {
		this.settings = Object.assign({}, await this.loadData());
		console.log(
			"The setting loaded in Main.ts using the Object.assign method : ",
			this.settings
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
