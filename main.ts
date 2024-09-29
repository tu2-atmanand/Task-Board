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
	globalSettingsData,
} from "src/interfaces/KanbanView";
import {
	TaskBoardIcon,
	VIEW_TYPE_TASKBOARD,
} from "src/interfaces/GlobalVariables";

import { AddTaskModal } from "src/modal/AddTaskModal";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { KanbanView } from "./src/views/KanbanView";
import { ScanningVault } from "src/utils/ScanningVault";
import { TaskBoardSettingTab } from "./src/views/TaskBoardSettingTab";
import fs from "fs";
// import { loadGlobalSettings } from "src/utils/TaskItemUtils";
import path from "path";
import { refreshKanbanBoard } from "src/services/RefreshServices";

export default class TaskBoard extends Plugin {
	settings: globalSettingsData;
	scanningVault: ScanningVault;
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
		this.scanTimer = 0;
		this.scanningVault = new ScanningVault(this.app, this.plugin);
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

		// Creating Few Events
		this.initializeStack();
		console.log("Creating localStorage ...");
		// Calling a function based on any file change in the valut.
		this.registerEvent(
			this.app.vault.on("modify", (file: TFile) =>
				this.onFileChange(file)
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
		this.settings.scanVaultAtStartup
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

	// Initialize stack from localStorage or file
	async initializeStack() {
		if (this.settings.realTimeScanning) return;

		try {
			// Try loading stack from localStorage
			console.log(
				"The data inside the localstorage at startup : ",
				localStorage.getItem("fileStack")
			);
			const storedStack = localStorage.getItem("fileStack");
			if (storedStack) {
				this.fileStack = JSON.parse(storedStack);
				console.log(
					"I think the local storage have been created, value of fileStack : ",
					this.fileStack
				);
			} else {
				// Fallback to loading from file if localStorage isn't available
				if (fs.existsSync(this.stackFilePath)) {
					const data = fs.readFileSync(this.stackFilePath, "utf8");
					this.fileStack = JSON.parse(data) || [];
					console.log(
						"The data i stored inside the file-stack.json, which i have put inside the localStorage : ",
						this.fileStack
					);
				}
			}
			this.startScanTimer();
		} catch (error) {
			console.error("Error loading file stack:", error);
		}
	}

	// Save stack to localStorage and file
	async saveStack() {
		try {
			// Save to localStorage
			localStorage.setItem("fileStack", JSON.stringify(this.fileStack));
			console.log(
				"saveStack() : The data inside localStorage after setItem : ",
				localStorage.getItem("fileStack")
			);
			console.log("After updating the data is : ", this.fileStack);
			// Save to file as fallback
			fs.writeFileSync(
				this.stackFilePath,
				JSON.stringify(this.fileStack, null, 2)
			);
		} catch (error) {
			console.error("Error saving file stack:", error);
		}
	}

	// Timer function to scan files every 5 minutes
	async startScanTimer() {
		console.log(
			"Creating LocalStorage, starting 10 Seconds timer : ",
			this.fileStack
		);
		this.scanTimer = window.setInterval(() => {
			this.processStack();
		}, 10 * 60 * 1000); // TODO : Change the following value to : 5 * 60 * 1000
	}

	// Process all files from the stack at once
	async processStack() {
		console.log(
			"TIME UP : 1 minute has passed, scanning the following files: ",
			this.fileStack
		);

		// Copy the current stack to a new array and clear the stack
		const filesToProcess = this.fileStack.slice();
		this.fileStack = [];

		// Retrieve TFile objects for each file path in the stack
		const files = filesToProcess
			.map((filePath) => this.getFileFromPath(filePath))
			.filter((file) => !!file);

		if (files.length > 0) {
			// Send all files for scanning and updating tasks
			await this.scanningVault.updateTasksFromFiles(files);
		}

		// Save updated stack (which should now be empty)
		await this.saveStack();
	}

	// Fetch the file object from the path (mock function)
	getFileFromPath(filePath: string): TFile {
		// This function should retrieve the file by its path in the vault
		// Assuming this is implemented in your plugin
		return (window as any).app.vault.getAbstractFileByPath(
			filePath
		) as TFile;
	}

	// File change handler
	async onFileChange(file: TFile) {
		if (file.extension === "md") {
			console.log(`File modified: ${file.path}`);
			// console.log("The value of realTimeScanning : ", this.settings.data.globalSettings.realTimeScanning);
			// console.log(
			// 	"The data inside LocalStorage Before adding the new modified file : ",
			// 	this.fileStack
			// );
			// If real-time scanning is enabled, scan the file immediately
			if (this.settings.data.globalSettings.realTimeScanning) {
				console.log(
					"Reat-Time Scanning is ON. Scanning following file : ",
					file
				);
				this.scanningVault.updateTasksFromFiles([file]);
			} else {
				// console.log(
				// 	"So the tasks will be updated after 10 seconds. This will only run in the following is true : !this.fileStack.includes(file.path) : ",
				// 	!this.fileStack.includes(file.path)
				// );
				// If the file is already in the stack, ignore it
				console.log(
					"The value of localStorage before adding updated file : ",
					this.fileStack
				);

				if (this.fileStack.at(0) === undefined) {
					this.fileStack.push(file.path); // Add the file to the stack
				} else if (!this.fileStack.includes(file.path)) {
					this.fileStack.push(file.path);
					await this.saveStack(); // Save the updated stack
				} else {
					console.log(
						"The file alrady exists in fileStack : ",
						file.path
					);
				}
			}
		}
	}

	onunload() {
		console.log("TaskBoard : unloading plugin...");
		window.clearInterval(this.scanTimer);
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
