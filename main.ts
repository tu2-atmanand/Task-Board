// main.ts

import {
	App,
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
} from "src/interfaces/GlobalSettings";
import {
	openAddNewTaskInCurrentFileModal,
	openAddNewTaskModal,
	openScanVaultModal,
} from "src/services/OpenModals";

import { TaskBoardView } from "./src/views/TaskBoardView";
import { RealTimeScanning } from "src/utils/RealTimeScanning";
import ScanningVault from "src/utils/ScanningVault";
import { TaskBoardIcon } from "src/types/Icons";
import { TaskBoardSettingTab } from "./src/settings/TaskBoardSettingTab";
import { VIEW_TYPE_TASKBOARD } from "src/types/GlobalVariables";
import { isReminderPluginInstalled } from "src/services/CommunityPlugins";
import {
	clearCachedTranslations,
	loadTranslationsOnStartup,
	t,
} from "src/utils/lang/helper";
import { TaskBoardApi } from "src/taskboardAPIs";
import { fetchTasksPluginCustomStatuses } from "src/services/tasks-plugin/api";
import { Board, ColumnData } from "src/interfaces/BoardConfigs";

export default class TaskBoard extends Plugin {
	app: App;
	plugin: TaskBoard;
	view: TaskBoardView | null;
	settings: PluginDataJson = DEFAULT_SETTINGS;
	scanningVault: ScanningVault;
	realTimeScanning: RealTimeScanning;
	taskBoardFileStack: string[] = [];
	editorModified: boolean;
	// currentModifiedFile: TFile | null;
	// fileUpdatedUsingModal: string;
	IstasksJsonDataChanged: boolean;
	private _leafIsActive: boolean; // Private property to track leaf state
	private ribbonIconEl: HTMLElement | null; // Store ribbonIconEl globally for reference

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.plugin = this;
		this.app = this.plugin.app;
		this.view = null;
		this.settings = DEFAULT_SETTINGS;
		this.scanningVault = new ScanningVault(this.app, this.plugin);
		this.realTimeScanning = new RealTimeScanning(
			this.app,
			this.plugin,
			this.scanningVault
		);
		this.editorModified = false;
		// this.currentModifiedFile = null;
		// this.fileUpdatedUsingModal = "";
		this.IstasksJsonDataChanged = false;
		this._leafIsActive = false;
		this.ribbonIconEl = null;
	}

	get api(): ReturnType<typeof TaskBoardApi.GetApi> {
		return TaskBoardApi.GetApi(this.app, this.plugin);
	}

	async onload() {
		console.log("TaskBoard : Loading plugin ...");

		//Creates a Icon on Ribbon Bar
		await this.getRibbonIcon();

		// Loads settings data and creating the Settings Tab in main Setting
		await this.loadSettings();
		this.runOnPluginUpdate();
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		// this.getLanguage();

		await loadTranslationsOnStartup(this);

		await this.scanningVault.initializeTasksCache();

		// Register events and commands only on Layout is ready
		this.app.workspace.onLayoutReady(() => {
			// Creating Few Events
			this.registerEvents();

			// Register few commands
			this.registerCommands();

			// For non-realtime scanning and scanning last modified files
			this.createLocalStorageAndScanModifiedFiles();

			// Run scanVaultForTasks if scanVaultAtStartup is true
			this.scanVaultAtStartup();

			// Register the Kanban view
			this.registerTaskBoardView();

			this.openAtStartup();

			// Register status bar element
			this.registerTaskBoardStatusBar();

			this.compatiblePluginsAvailabilityCheck();
		});
	}

	onunload() {
		console.log("TaskBoard : Unloading plugin...");
		clearCachedTranslations();
		// onUnloadSave(this.plugin);
		// this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKBOARD);
	}

	async activateView(leafLayout: string) {
		let leaf: WorkspaceLeaf | null = null;
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD);

		function isFromMainWindow(leaf: WorkspaceLeaf): boolean | undefined {
			if (!leaf.view.containerEl.ownerDocument.defaultView) return;
			return "Notice" in leaf.view.containerEl.ownerDocument.defaultView;
		}

		// Separate leaves into MainWindow and SeparateWindow categories
		const mainWindowLeaf = leaves.find((leaf) => isFromMainWindow(leaf));
		const separateWindowLeaf = leaves.find(
			(leaf) => !isFromMainWindow(leaf)
		);

		if (leafLayout === "icon") {
			// Focus on any existing leaf, prioritizing MainWindow
			leaf =
				mainWindowLeaf ||
				separateWindowLeaf ||
				this.app.workspace.getLeaf("tab");
		} else if (leafLayout === "tab") {
			// Check if a leaf exists in MainWindow
			if (mainWindowLeaf) {
				// Prevent duplicate in MainWindow
				leaf = mainWindowLeaf;
			} else {
				// Allow opening a new leaf in MainWindow
				leaf = this.app.workspace.getLeaf("tab");
			}
		} else if (leafLayout === "window") {
			// Check if a leaf exists in SeparateWindow
			if (separateWindowLeaf) {
				// Prevent duplicate in SeparateWindow
				leaf = separateWindowLeaf;
			} else {
				// Allow opening a new leaf in SeparateWindow
				leaf = this.app.workspace.getLeaf("window");
			}
		} else {
			// Default behavior: open in MainWindow
			leaf = this.app.workspace.getLeaf("tab");
		}

		// Open or focus the leaf
		if (leaf) {
			this.leafIsActive = true;
			await leaf.setViewState({
				type: VIEW_TYPE_TASKBOARD,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	async getRibbonIcon() {
		// Create a ribbon icon to open the Kanban board view
		this.ribbonIconEl = this.addRibbonIcon(
			TaskBoardIcon,
			t("open-task-board"),
			() => {
				this.activateView("icon");

				// this.app.workspace.ensureSideLeaf(VIEW_TYPE_TASKBOARD, "right", {
				// 	active: true,
				// 	reveal: true,
				// });
			}
		);
	}
	get leafIsActive(): boolean {
		return this._leafIsActive;
	}
	set leafIsActive(value: boolean) {
		this._leafIsActive = value;
		if (this._leafIsActive) {
			this.ribbonIconEl?.addClass("task-board-ribbon-class");
		} else {
			this.ribbonIconEl?.removeClass("task-board-ribbon-class");
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.migrateSettings(DEFAULT_SETTINGS, this.settings);
		this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// getLanguage() {
	// 	const obsidianLang = window.localStorage.getItem("language");

	// 	if (obsidianLang && obsidianLang in langCodes) {
	// 		localStorage.setItem("taskBoardLang", obsidianLang);
	// 		this.settings.data.globalSettings.lang = obsidianLang;
	// 		this.saveSettings();
	// 	} else {
	// 		localStorage.setItem(
	// 			"taskBoardLang",
	// 			// this.settings.data.globalSettings.lang
	// 			"en"
	// 		);
	// 	}
	// }

	createLocalStorageAndScanModifiedFiles() {
		// Following line will create a localStorage. And then it will scan the previous files which didnt got scanned, becaues the Obsidian was closed before that or crashed.
		this.realTimeScanning.initializeStack();
		this.realTimeScanning.processAllUpdatedFiles();
	}

	scanVaultAtStartup() {
		if (this.settings.data.globalSettings.scanVaultAtStartup) {
			this.scanningVault.scanVaultForTasks();
		}
	}

	registerTaskBoardView() {
		this.registerView(VIEW_TYPE_TASKBOARD, (leaf) => {
			this.view = new TaskBoardView(this, leaf);
			return this.view;
		});
	}

	openAtStartup() {
		if (!this.settings.data.globalSettings.openOnStartup) return;

		this.activateView("icon");
	}

	registerTaskBoardStatusBar() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("Next task in # min");
	}

	registerCommands() {
		this.addCommand({
			id: "add-new-task",
			name: t("add-new-task"),
			callback: () => {
				openAddNewTaskModal(this.app, this.plugin);
			},
		});
		this.addCommand({
			id: "add-new-task-current-file",
			name: t("add-new-task-in-current-file"),
			callback: () => {
				let activeEditor = this.app.workspace.activeEditor?.editor;
				let activeFile = this.app.workspace.getActiveFile();

				if (activeEditor && activeFile) {
					openAddNewTaskInCurrentFileModal(
						this.app,
						this.plugin,
						activeFile,
						activeEditor?.getCursor()
					);
					activeEditor = undefined;
					return true;
				} else {
					new Notice(t("no-active-editor-is-open-error-notice"));
					return true;
				}
			},
		});
		this.addCommand({
			id: "open-task-board",
			name: t("open-task-board"),
			callback: () => {
				this.activateView("tab");
			},
		});
		this.addCommand({
			id: "open-task-board-new-window",
			name: t("open-task-board-in-new-window"),
			callback: () => {
				this.activateView("window");
			},
		});
		this.addCommand({
			id: "open-scan-vault-modal",
			name: t("open-scan-vault-modal"),
			callback: () => {
				openScanVaultModal(this.app, this.plugin);
			},
		});

		// // TODO : Remove this command before publishing, DEV commands
		// this.addCommand({
		// 	id: "4",
		// 	name: "DEV : Save Data from sessionStorage to Disk",
		// 	callback: () => {
		// 		writeJsonCacheDataFromDisk(this.plugin);
		// 	},
		// });
		// this.addCommand({
		// 	id: "5",
		// 	name: "DEV : REFRESH_COLUMN",
		// 	callback: () => {
		// 		eventEmitter.emit("REFRESH_COLUMN");
		// 	},
		// });
	}

	registerEvents() {
		// // Start a timer to write tasks from sessionStorage to disk every 5 minutes
		// this.registerInterval(
		// 	window.setInterval(async () => {
		// 		await writeTasksFromSessionStorageToDisk(this.plugin);
		// 	}, 5 * 60 * 1000)
		// );

		this.registerEvent(
			this.app.vault.on("modify", (file: TAbstractFile) => {
				if (
					file.path ===
						this.settings.data.globalSettings
							.archivedTasksFilePath ||
					file.path.endsWith(".excalidraw.md")
				) {
					return false;
				}

				if (file instanceof TFile) {
					// 	this.taskBoardFileStack.push(file.path);
					this.realTimeScanning.onFileModified(file);
					this.editorModified = true;
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
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					// Instead of scanning the file, it will be good idea to update the file path in the tasks.json directly.
					this.realTimeScanning.onFileRenamed(file, oldPath);
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					// Instead of scanning the file, it will be good idea to update the file path in the tasks.json directly.
					this.realTimeScanning.onFileDeleted(file);
				}
			})
		);

		// this.registerEvent(
		// 	this.app.vault.on("create", (file) => {
		// 		// NOT REQUIRED : This will be same as the modify functinality, since after adding the file, it will be modified, so i will catch that.
		// 	})
		// );

		// const closeButton = document.querySelector<HTMLElement>(
		// 	".titlebar-button.mod-close"
		// );
		// if (closeButton) {
		// 	this.registerDomEvent(closeButton, "mouseenter", () => {
		// 		onUnloadSave(this.plugin);
		// 	});
		// }

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (source === "link-context-menu") return;

				const fileIsFile = file instanceof TFile;
				const fileIsFolder = file instanceof TFolder;
				// const leafIsMarkdown = leaf?.view instanceof MarkdownView;
				// const leafIsKanban = leaf?.view instanceof TaskBoardView;

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
						item.setTitle(t("update-tasks-from-this-file"))
							.setIcon(TaskBoardIcon)
							.setSection("action")
							.onClick(() => {
								this.scanningVault.refreshTasksFromFiles([
									file,
								], true);
							});
					});
					if (
						this.settings.data.globalSettings.scanFilters.files
							.polarity === 2
					) {
						menu.addItem((item) => {
							item.setTitle(t("add-file-in-scan-filter"))
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
							item.setTitle(t("add-file-in-scan-filter"))
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
							item.setTitle(t("add-folder-in-scan-filter"))
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
							item.setTitle(t("add-folder-in-scan-filter"))
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
		// 		// const leafIsMarkdown = view instanceof MarkdownView;
		// 		const leafIsKanban = view instanceof TaskBoardView;

		// 		if (leafIsKanban) {
		// 			console.log("MENU : If the fileIsFile ");
		// 			// menu.addItem((item) => {
		// 			// 	item.setTitle("Refresh Board")
		// 			// 		.setIcon(RefreshIcon)
		// 			// 		.setSection("pane")
		// 			// 		.onClick(() => {
		// 			// 			eventEmitter.emit("REFRESH_BOARD");
		// 			// 		});
		// 			// });
		// 		}
		// 	})
		// );
	}

	async onFileModifiedAndLostFocus() {
		if (this.editorModified) {
			// if (this.currentModifiedFile.path !== this.fileUpdatedUsingModal) {
			// 	await this.realTimeScanning.onFileModified(
			// 		this.currentModifiedFile,
			// 		this.settings.data.globalSettings.realTimeScanning
			// 	);
			// } else {
			// 	this.fileUpdatedUsingModal = "";
			// }

			await this.realTimeScanning.processAllUpdatedFiles();

			// Reset the editorModified flag after the scan.
			this.editorModified = false;
		}
	}

	compatiblePluginsAvailabilityCheck() {
		// Check if the Tasks plugin is installed and fetch the custom statuses
		fetchTasksPluginCustomStatuses(this.plugin);

		// Check if the Reminder plugin is installed
		isReminderPluginInstalled(this.plugin);
	}

	private migrateSettings(defaults: any, settings: any) {
		for (const key in defaults) {
			if (!(key in settings)) {
				settings[key] = defaults[key];
			} else if (
				// This is a temporary fix for the tagColors
				!Array.isArray(settings[key]) &&
				key === "tagColors" &&
				typeof settings[key] === "object" &&
				settings[key] !== null
			) {
				settings[key] = Object.entries(
					settings[key] as Record<string, string>
				).map(
					([name, color], idx) =>
						({
							name,
							color,
							priority: idx + 1,
						} as any)
				);
			} else if (key === "boardConfigs" && Array.isArray(settings[key])) {
				// This is a temporary solution to sync the boardConfigs. I will need to replace the range object with the new 'datedBasedColumn', which will have three values 'dateType', 'from' and 'to'. So, basically I want to copy range.rangedata.from value to datedBasedColumn.from and similarly for to. And for datedBasedColumn.dateType, put the value this.settings.data.globalSettings.defaultDateType.
				settings[key].forEach((boardConfig: Board) => {
					boardConfig.columns.forEach((column: ColumnData) => {
						if (!column.id) {
							column.id = Math.floor(Math.random() * 1000000);
						}
						if (
							column.colType === "dated" ||
							(column.colType === "undated" &&
								!column.datedBasedColumn)
						) {
							column.datedBasedColumn = {
								dateType:
									this.settings.data.globalSettings
										.universalDate,
								from: column.datedBasedColumn?.from || 0,
								to: column.datedBasedColumn?.to || 0,
							};
							delete column.range;
						}
					});

					if (!boardConfig.hideEmptyColumns) {
						boardConfig.hideEmptyColumns = false;
					}
				});
			} else if (
				typeof defaults[key] === "object" &&
				defaults[key] !== null &&
				!Array.isArray(defaults[key])
			) {
				// Recursively sync nested objects
				// console.log(
				// 	"Syncing settings for key:",
				// 	key,
				// 	"Defaults:",
				// 	defaults[key],
				// 	"Settings:",
				// 	settings[key]
				// );
				this.migrateSettings(defaults[key], settings[key]);
			} else if (key === 'tasksCacheFilePath' && settings[key] === '') {
				settings[key] = `${this.app.vault.configDir}/plugins/task-board/tasks.json`;
			}
		}

		this.settings = settings;
		// this.saveSettings();
	}

	private runOnPluginUpdate() {
		// Check if the plugin version has changed
		const currentVersion = this.manifest.version;
		const previousVersion = this.settings.version;

		if (previousVersion == "" || currentVersion[2] !== previousVersion[2]) {
			// make the localStorage flag, 'manadatoryScan' to True
			localStorage.setItem("manadatoryScan", "true");

			this.settings.version = currentVersion;
			this.saveSettings();

			// new Notice(
			// 	t("plugin-updated-notice", {
			// 		version: currentVersion,
			// 	})
			// );
		}
	}

	async fileExists(filePath: string): Promise<boolean> {
		return await this.app.vault.adapter.exists(filePath);
	}
}
