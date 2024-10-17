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
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import {
	TaskBoardIcon,
	VIEW_TYPE_TASKBOARD,
} from "src/interfaces/GlobalVariables";
import {
	loadTasksJsonFromDiskToSS,
	onUnloadSave,
	startPeriodicSave,
} from "src/utils/tasksCache";

import { KanbanView } from "./src/views/KanbanView";
import { RealTimeScanning } from "src/utils/RealTimeScanning";
import { ScanningVault } from "src/utils/ScanningVault";
import { TaskBoardSettingTab } from "./src/views/TaskBoardSettingTab";
import { openAddNewTaskModal } from "src/services/OpenModals";

// import { loadGlobalSettings } from "src/utils/TaskItemUtils";

export default class TaskBoard extends Plugin {
	app: App;
	plugin: TaskBoard;
	settings: PluginDataJson = DEFAULT_SETTINGS;
	scanningVault: ScanningVault;
	realTimeScanning: RealTimeScanning;
	fileStack: string[] = [];
	scanTimer: number;
	currentModifiedFile: TFile | null;

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.app = app;
		this.plugin = this;
		this.settings = DEFAULT_SETTINGS;
		this.scanTimer = 0;
		this.scanningVault = new ScanningVault(this.app, this.plugin);
		this.realTimeScanning = new RealTimeScanning(this.app, this.plugin);
		this.currentModifiedFile = null;
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
		ribbonIconEl.addClass("task-board-ribbon-class");

		// Register few commands
		this.addCommand({
			id: "open-add-task-modal",
			name: "Add New Task in Current File",
			callback: () => {
				const app = this.app as App;
				const activeFile = app.workspace.getActiveFile();
				if (activeFile) {
					openAddNewTaskModal(app, this.plugin, activeFile);
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
		// TODO : Remove this command before publishing
		this.addCommand({
			id: "save-session-to-disk",
			name: "DEV : Save Data from sessionStorage to Disk.",
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

		// Loading settings and creating the Settings Tab in main Setting
		await this.loadSettings();
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));
		console.log("MAIN.ts : Loading the setting values : ", this.settings);

		// Following line will create a localStorage if the realTimeScanning value is TRUE. And then it will scan the previous files which got left scanning, becaues the Obsidian was closed before that or crashed.
		console.log("Creating localStorage ...");
		this.realTimeScanning.initializeStack(
			this.settings.data.globalSettings.realTimeScanning
		);
		this.realTimeScanning.processStack();

		// Creating Few Events

		// this.registerEvent(
		// 	this.app.vault.on("modify", (file: TFile) =>
		// 		this.realTimeScanning.onFileChange(
		// 			file,
		// 			this.settings.data.globalSettings.realTimeScanning,
		// 			this.settings.data.globalSettings.scanFilters
		// 		)
		// 	)
		// );
		// Register an event for the 'editor-blur' event
		// Track if the editor has been modified
		let editorModified = false;
		// Listen for editor-change event using workspace.trigger
		this.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(editor: CodeMirror.Editor) => {
					// console.log("EVENT : editor-change event working...");
					// Set editorModified to true when any change occurs
					editorModified = true;
					this.currentModifiedFile = this.app.workspace.getActiveFile();
				}
			)
		);
		// Listen for editor-blur event and trigger scanning if the editor was modified
		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				(editor: CodeMirror.Editor) => {
					// onblur= (this, event: "blur") => {};
					// const activeEditor = this.app.workspace.activeEditor?.editor;
					// console.log(
					// 	"EVENT : editor-blur event working... | Value of blur : ",
					// 	activeEditor?.focus()
					// );
					if (editorModified && this.currentModifiedFile) {
						console.log("EVENT : activeEditor.focus() ...");
						this.realTimeScanning.onFileChange(
							this.currentModifiedFile,
							this.settings.data.globalSettings.realTimeScanning,
							this.settings.data.globalSettings.scanFilters
						);

						// Reset the editorModified flag after the scan
						editorModified = false;
					}
				}
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

		// Run scanVaultForTasks if scanVaultAtStartup is true
		// TODO : This feature havent been tested. Also the way you are reading the variable scanVaultAtStartup is not correct.
		this.settings.data.globalSettings.scanVaultAtStartup
			? this.scanningVault.scanVaultForTasks()
			: "";

		// Load all the tasks from the tasks.json into sessionStorage
		const _ = loadTasksJsonFromDiskToSS(this.plugin);
		startPeriodicSave(this.plugin);

		// Register the Kanban view
		this.registerView(
			VIEW_TYPE_TASKBOARD,
			(leaf) => new KanbanView(this.app, this, leaf)
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
		onUnloadSave(this.plugin);
		window.clearInterval(this.scanTimer);
		this.realTimeScanning.clearScanTimer();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKBOARD);
	}

	async loadSettings() {
		this.settings = Object.assign({}, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
