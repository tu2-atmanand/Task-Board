// main.ts - WORKING

import {
	App,
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginManifest,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf,
	requireApiVersion,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	PluginDataJson,
	langCodes,
} from "src/interfaces/GlobalSettings";
import { RefreshIcon, TaskBoardIcon } from "src/types/Icons";
import {
	loadTasksJsonFromDiskToSS,
	onUnloadSave,
	startPeriodicSave,
	writeTasksJsonToDisk,
} from "src/utils/tasksCache";

import { KanbanView } from "./src/views/KanbanView";
import { RealTimeScanning } from "src/utils/RealTimeScanning";
import { ScanningVault } from "src/utils/ScanningVault";
import { TaskBoardSettingTab } from "./src/views/TaskBoardSettingTab";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/GlobalVariables";
import { eventEmitter } from "src/services/EventEmitter";
import { openAddNewTaskModal } from "src/services/OpenModals";
import { t } from "src/utils/lang/helper";

export default class TaskBoard extends Plugin {
	app: App;
	plugin: TaskBoard;
	settings: PluginDataJson = DEFAULT_SETTINGS;
	scanningVault: ScanningVault;
	realTimeScanning: RealTimeScanning;
	taskBoardFileStack: string[] = [];
	scanTimer: number;
	editorModified: boolean;
	currentModifiedFile: TFile | null;
	IsTasksJsonChanged: boolean;

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.app = app;
		this.plugin = this;
		this.settings = DEFAULT_SETTINGS;
		this.scanTimer = 0;
		this.scanningVault = new ScanningVault(this.app, this.plugin);
		this.realTimeScanning = new RealTimeScanning(this.app, this.plugin);
		this.editorModified = false;
		this.currentModifiedFile = null;
		this.IsTasksJsonChanged = false;
	}

	async onload() {
		console.log("TaskBoard : loading plugin ...");

		//Creates a Icon on Ribbon Bar
		this.getRibbonIcon();

		// Register few commands
		this.registerCommands();

		// Loads settings data and creating the Settings Tab in main Setting
		await this.loadSettings();
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));
		console.log("MAIN.ts : Loading the setting values : ", this.settings);

		this.getLanguage();

		// Creating Few Events
		this.registerEvents();

		this.createLocalStorageAndScanModifiedFiles();

		// Run scanVaultForTasks if scanVaultAtStartup is true
		this.scanVaultAtStartup();

		// Load all the tasks from the tasks.json into sessionStorage and start Periodic scanning
		this.loadTasksDataToSS();

		// Register the Kanban view
		this.registerTaskBoardView();

		this.registerTaskBoardStatusBar();
	}

	getRibbonIcon() {
		// Create a ribbon icon to open the Kanban board view
		const ribbonIconEl = this.addRibbonIcon(TaskBoardIcon, t(4), () => {
			this.app.workspace
				.getLeaf(true)
				.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true });
		});
		ribbonIconEl.addClass("task-board-ribbon-class");
	}

	onFileModifiedAndLostFocus() {
		if (this.editorModified && this.currentModifiedFile) {
			console.log("EVENT : activeEditor.focus() ...");
			this.realTimeScanning.onFileChange(
				this.currentModifiedFile,
				this.settings.data.globalSettings.realTimeScanning,
				this.settings.data.globalSettings.scanFilters
			);

			// Reset the editorModified flag after the scan
			this.editorModified = false;
		}
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

	getLanguage() {
		const obsidianLang = window.localStorage.getItem("language");

		if (obsidianLang && obsidianLang in langCodes) {
			localStorage.setItem("taskBoardLang", obsidianLang);
			this.settings.data.globalSettings.lang = obsidianLang;
			this.saveSettings();
		} else {
			localStorage.setItem(
				"taskBoardLang",
				this.settings.data.globalSettings.lang
			);
		}
	}

	createLocalStorageAndScanModifiedFiles() {
		// Following line will create a localStorage if the realTimeScanning value is FALSE. And then it will scan the previous files which didnt got scanned, becaues the Obsidian was closed before that or crashed.
		this.realTimeScanning.initializeStack(
			this.settings.data.globalSettings.realTimeScanning
		);
		this.realTimeScanning.processStack();
	}

	scanVaultAtStartup() {
		// TODO : This feature havent been tested. Also the way you are reading the variable scanVaultAtStartup is not correct.
		this.settings.data.globalSettings.scanVaultAtStartup
			? this.scanningVault.scanVaultForTasks()
			: "";
	}

	loadTasksDataToSS() {
		const _ = loadTasksJsonFromDiskToSS(this.plugin);
		// startPeriodicSave(this.plugin); // TODO : Enable this before release, disabled to during development.
	}

	registerTaskBoardView() {
		this.registerView(
			VIEW_TYPE_TASKBOARD,
			(leaf) => new KanbanView(this.app, this, leaf)
		);
	}

	registerTaskBoardStatusBar() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("Total # Tasks Pending");
	}

	registerCommands() {
		this.addCommand({
			id: "task-board-1",
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
			id: "task-board-2",
			name: "Open Task Board",
			callback: () => {
				this.app.workspace
					.getLeaf(true)
					.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true });
			},
		});
		this.addCommand({
			id: "task-board-3",
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
			id: "task-board-4",
			name: "DEV : Save Data from sessionStorage to Disk.",
			callback: () => {
				writeTasksJsonToDisk(this.plugin);
			},
		});
		this.addCommand({
			id: "task-board-5",
			name: "DEV : REFRESH_COLUMN.",
			callback: () => {
				eventEmitter.emit("REFRESH_COLUMN");
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

		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: "sample-editor-command",
		// 	name: "Sample editor command",
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection("Sample Editor Command");
		// 	},
		// });
	}

	registerEvents() {
		// TODO : Find out which of the below two methods are optized one. I think the first method is the best one.
		this.registerEvent(
			this.app.vault.on("modify", (file: TAbstractFile) => {
				this.editorModified = true;
				if (file instanceof TFile) {
					this.currentModifiedFile = file;
					console.log("Modified file is : ", this.currentModifiedFile	);
				}
			})
		);
		// this.registerEvent(
		// 	this.app.workspace.on(
		// 		"editor-change",
		// 		(editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
		// 			// console.log("EVENT : editor-change event working...");
		// 			// Set editorModified to true when any change occurs
		// 			this.editorModified = true;
		// 			this.currentModifiedFile =
		// 				this.app.workspace.getActiveFile();
		// 		}
		// 	)
		// );
		// Listen for editor-blur event and trigger scanning if the editor was modified
		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				(leaf: WorkspaceLeaf | null) => {
					this.onFileModifiedAndLostFocus();
				}
			)
		);
		this.registerDomEvent(window, "blur", () => {
			console.log(
				"User switched away from Obsidian or Obsidian lost focus."
			);
			this.onFileModifiedAndLostFocus();
		});

		// window.addEventListener("focus", () => {
		// 	console.log(
		// 		"User switched back to Obsidian or Obsidian gained focus."
		// 	);
		// 	// Trigger your custom code when the app gains focus
		// });

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

		// requireApiVersion("0.15.0")
		// 	? (activeDocument = activeWindow.document)
		// 	: (activeDocument = window.document);
		const closeButton = document.querySelector(
			".titlebar-button.mod-close"
		);
		if (closeButton) {
			this.registerDomEvent(window, "mouseenter", () => {
				console.log(
					"User hovered over the close button. Storing SessionStorage data to Disk."
				);
				// onUnloadSave(this.plugin);
			});
		}

		// Old method :
		// const closeButton = document.querySelector(
		// 	".titlebar-button.mod-close"
		// );
		// if (closeButton) {
		// 	closeButton.addEventListener("mouseenter", () => {
		// 		console.log(
		// 			"User hovered over the close button. Storing SessionStorage data to Disk."
		// 		);
		// 		onUnloadSave(this.plugin);
		// 	});
		// }

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				console.log(
					"MENU : Checking if this file-menu is registered or not"
				);
				if (source === "link-context-menu") return;

				const fileIsFile = file instanceof TFile;
				const fileIsFolder = file instanceof TFolder;
				const leafIsMarkdown = leaf?.view instanceof MarkdownView;
				const leafIsKanban = leaf?.view instanceof KanbanView;

				if (["pane-more-options"].includes(source)) {
					console.log("MENU : If the fileIsFile ");
					menu.addItem((item) => {
						item.setTitle("Refresh Board")
							.setIcon(RefreshIcon)
							.setSection("pane")
							.onClick(() => {
								eventEmitter.emit("REFRESH_BOARD");
							});
					});
				}

				if (fileIsFile) {
					menu.addItem((item) => {
						item.setTitle("Update tasks from this file")
							.setIcon(TaskBoardIcon)
							.setSection("action")
							.onClick(() => {
								this.scanningVault.updateTasksFromFiles([file]);
								this.scanningVault.saveTasksToFile();
							});
					});
					if (
						this.settings.data.globalSettings.scanFilters.files
							.polarity === 2
					) {
						menu.addItem((item) => {
							item.setTitle(
								"Add file in `Dont Scan this file` Filter"
							)
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.globalSettings.scanFilters.files.values.push(
										file.path
									);
									this.saveSettings();
								});
						});
					}
					if (
						this.settings.data.globalSettings.scanFilters.files
							.polarity === 1
					) {
						menu.addItem((item) => {
							item.setTitle(
								"Add file in `Only Scan this file` Filter"
							)
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.globalSettings.scanFilters.files.values.push(
										file.path
									);
									this.saveSettings();
								});
						});
					}

					menu.addItem((item) => {
						item.setTitle("DEV : Save Changes") // Cant keep this option in the meny, only for dev
							.setIcon(TaskBoardIcon)
							.setSection("action")
							.onClick(() => {
								onUnloadSave(this.plugin);
							});
					});
				}

				if (fileIsFolder) {
					console.log("WHat is the folder object :", file);
					
					// menu.addItem((item) => {
					// 	item.setTitle("Update tasks from this folder")
					// 		.setIcon(TaskBoardIcon)
					// 		.setSection("action")
					// 		.onClick(() => {
					// 		});
					// });

					if (
						this.settings.data.globalSettings.scanFilters.folders
							.polarity === 2
					) {
						menu.addItem((item) => {
							item.setTitle(
								"Add folder in `Dont Scan this folder` Filter"
							)
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.globalSettings.scanFilters.folders.values.push(
										file.path
									);
									this.saveSettings();
								});
						});
					}
					if (
						this.settings.data.globalSettings.scanFilters.folders
							.polarity === 1
					) {
						menu.addItem((item) => {
							item.setTitle(
								"Add folder in `Only Scan this folder` Filter"
							)
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.globalSettings.scanFilters.folders.values.push(
										file.path
									);
									this.saveSettings();
								});
						});
					}
				}

				if (
					!Platform.isMobile &&
					leafIsKanban &&
					leaf &&
					source === "sidebar-context-menu"
				) {
					console.log("MENU : If the 'sidebar-context-menu'");
					menu.addItem((item) => {
						item.setTitle("Refresh Board")
							.setIcon(RefreshIcon)
							.setSection("pane")
							.onClick(() => {
								eventEmitter.emit("REFRESH_BOARD");
							});
					})
						.addItem((item) => {
							item.setTitle("DEV : Save Changes") // Cant keep this option in the meny, only for dev
								.setIcon(RefreshIcon)
								.setSection("pane")
								.onClick(() => {
									onUnloadSave(this.plugin);
								});
						})
						.addItem((item) => {
							item.setTitle("Open Board Settings")
								.setIcon(RefreshIcon)
								.setSection("pane")
								.onClick(() => {
									// Need to find a way to open the Board Config Modal and then also to
								});
						});
				}
			})
		);
	}
}
