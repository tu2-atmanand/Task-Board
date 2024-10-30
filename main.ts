// main.ts

import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginManifest,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf,
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

		// Loads settings data and creating the Settings Tab in main Setting
		await this.loadSettings();
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		this.getLanguage();

		// Register events and commands only on Layout is ready
		this.app.workspace.onLayoutReady(() => {
			// Creating Few Events
			this.registerEvents();

			// Register few commands
			this.registerCommands();
		});

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
			this.realTimeScanning.onFileChange(
				this.currentModifiedFile,
				this.settings.data.globalSettings.realTimeScanning,
				this.settings.data.globalSettings.scanFilters
			);

			// Reset the editorModified flag after the scan.
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
		if (this.settings.data.globalSettings.scanVaultAtStartup) {
			this.scanningVault.scanVaultForTasks();
		}
	}

	loadTasksDataToSS() {
		const _ = loadTasksJsonFromDiskToSS(this.plugin);
		startPeriodicSave(this.plugin); // TODO : Enable this before release, disabled to during development.
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
			name: t(131),
			callback: () => {
				const app = this.app as App;
				const activeEditor = app.workspace.activeEditor?.editor;
				const activeFile = app.workspace.getActiveFile();
				if (activeEditor && activeFile) {
					openAddNewTaskModal(app, this.plugin, activeFile);
				} else {
					new Notice(t(147));
				}
			},
		});
		this.addCommand({
			id: "task-board-2",
			name: t(132),
			callback: () => {
				this.app.workspace
					.getLeaf(true)
					.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true });
			},
		});
		this.addCommand({
			id: "task-board-3",
			name: t(133),
			callback: () => {
				this.app.workspace.getLeaf("window").setViewState({
					type: VIEW_TYPE_TASKBOARD,
					active: true,
				});
			},
		});
		// // Add a command to Re-Scan the whole Vault
		// this.addCommand({
		// 	id: "task-board-6",
		// 	name: "Re-Scan Vault",
		// 	callback: () => {
		// 		this.scanningVault.scanVaultForTasks();
		// 	},
		// });

		// // TODO : Remove this command before publishing, DEV commands
		// this.addCommand({
		// 	id: "task-board-4",
		// 	name: "DEV : Save Data from sessionStorage to Disk",
		// 	callback: () => {
		// 		writeTasksJsonToDisk(this.plugin);
		// 	},
		// });
		// this.addCommand({
		// 	id: "task-board-5",
		// 	name: "DEV : REFRESH_COLUMN",
		// 	callback: () => {
		// 		eventEmitter.emit("REFRESH_COLUMN");
		// 	},
		// });
	}

	registerEvents() {
		this.registerEvent(
			this.app.vault.on("modify", (file: TAbstractFile) => {
				this.editorModified = true;
				if (file instanceof TFile) {
					this.currentModifiedFile = file;
				}
			})
		);
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
			this.onFileModifiedAndLostFocus();
		});

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				// NOT REQUIRED : This will be same as the modify functinality, since after adding the file, it will be modified, so i will catch that.
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				// console.log(
				// 	"TODO : A file has been renamed, immediately, change the corresponding data in Tasks.json file. That is find the old object under Pending and Completed part in tasks.json and either delete it or best way will be to replace the old name with new one."
				// );
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				console.log(
					"TODO : A file has been deleted, immediately remove the corresponding data in Tasks.json file."
				);
			})
		);

		const closeButton = document.querySelector (
			".titlebar-button.mod-close"
		);
		if (closeButton) {
			this.registerDomEvent(closeButton, "mouseenter", () => {
				onUnloadSave(this.plugin);
			});
		}

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (source === "link-context-menu") return;

				const fileIsFile = file instanceof TFile;
				const fileIsFolder = file instanceof TFolder;
				// const leafIsMarkdown = leaf?.view instanceof MarkdownView;
				// const leafIsKanban = leaf?.view instanceof KanbanView;

				// if (leafIsKanban || source === "pane-more-options") {
				// 	console.log("MENU : If the fileIsFile ");
				// 	menu.addItem((item) => {
				// 		item.setTitle("Refresh Board")
				// 			.setIcon(RefreshIcon)
				// 			.setSection("pane")
				// 			.onClick(() => {
				// 				eventEmitter.emit("REFRESH_BOARD");
				// 			});
				// 	});
				// }

				if (fileIsFile) {
					menu.addItem((item) => {
						item.setTitle(t(134))
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
							item.setTitle(t(135))
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
							item.setTitle(t(136))
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

					// menu.addItem((item) => {
					// 	item.setTitle("DEV : Save Changes") // Cant keep this option in the meny, only for dev
					// 		.setIcon(TaskBoardIcon)
					// 		.setSection("action")
					// 		.onClick(() => {
					// 			onUnloadSave(this.plugin);
					// 		});
					// });
				}

				if (fileIsFolder) {
					// TODO : Implement this in future releases
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
							item.setTitle(t(137))
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
							item.setTitle(t(138))
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

				// if (
				// 	!Platform.isMobile &&
				// 	leafIsKanban &&
				// 	leaf &&
				// 	source === "sidebar-context-menu"
				// ) {
				// 	console.log("MENU : If the 'sidebar-context-menu'");
				// 	menu.addItem((item) => {
				// 		item.setTitle("Refresh Board")
				// 			.setIcon(RefreshIcon)
				// 			.setSection("action")
				// 			.onClick(() => {
				// 				eventEmitter.emit("REFRESH_BOARD");
				// 			});
				// 	})
				// 		.addItem((item) => {
				// 			item.setTitle("Open Board Settings")
				// 				.setIcon(RefreshIcon)
				// 				.setSection("action")
				// 				.onClick(() => {
				// 					// Need to find a way to open the Board Config Modal and then also to
				// 				});
				// 		})
				// 		.addItem((item) => {
				// 			item.setTitle("DEV : Save Changes") // Delete this item before release, only for dev
				// 				.setIcon(RefreshIcon)
				// 				.setSection("action")
				// 				.onClick(() => {
				// 					onUnloadSave(this.plugin);
				// 				});
				// 		});
				// }
			})
		);

		// this.registerEvent(
		// 	this.app.workspace.on("editor-menu", (menu, editor, view) => {
		// 		const leafIsMarkdown = view instanceof MarkdownView;
		// 		const leafIsKanban = view instanceof KanbanView;

		// 		if (leafIsKanban) {
		// 			console.log("MENU : If the fileIsFile ");
		// 			menu.addItem((item) => {
		// 				item.setTitle("Refresh Board")
		// 					.setIcon(RefreshIcon)
		// 					.setSection("pane")
		// 					.onClick(() => {
		// 						eventEmitter.emit("REFRESH_BOARD");
		// 					});
		// 			});
		// 		}
		// 	})
		// );
	}
}
