// main.ts

import {
	App,
	normalizePath,
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
	openAddNewTaskNoteModal,
	openScanVaultModal,
} from "src/services/OpenModals";

import { TaskBoardView } from "./src/views/TaskBoardView";
import { RealTimeScanner } from "src/managers/RealTimeScanner";
import VaultScanner, {
	fileTypeAllowedForScanning,
} from "src/managers/VaultScanner";
import { TaskBoardIcon } from "src/interfaces/Icons";
import { TaskBoardSettingTab } from "./src/settings/TaskBoardSettingTab";
import { ModifiedFilesModal } from "src/modals/ModifiedFilesModal";
import {
	newReleaseVersion,
	OBSIDIAN_CLOSED_TIME_KEY,
	VIEW_TYPE_TASKBOARD,
} from "src/interfaces/Constants";
import { isReminderPluginInstalled } from "src/services/CommunityPlugins";
import { loadTranslationsOnStartup, t } from "src/utils/lang/helper";
import { TaskBoardApi } from "src/taskboardAPIs";
import { TasksPluginApi } from "src/services/tasks-plugin/api";
import {
	getTaskPropertyRegexPatterns,
	taskPropertyHidingExtension,
} from "src/editor-extensions/task-operations/property-hiding";
import { isTasksPluginEnabled } from "src/services/tasks-plugin/helpers";
import { scanModeOptions, taskPropertiesNames } from "src/interfaces/Enums";
import { migrateSettings } from "src/settings/SettingSynchronizer";
import { dragDropTasksManagerInsatance } from "src/managers/DragDropTasksManager";
import { eventEmitter } from "src/services/EventEmitter";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { getCurrentLocalTimeString } from "src/utils/DateTimeCalculations";

export default class TaskBoard extends Plugin {
	app: App;
	plugin: TaskBoard;
	view: TaskBoardView | null;
	settings: PluginDataJson = DEFAULT_SETTINGS;
	vaultScanner: VaultScanner;
	realTimeScanner: RealTimeScanner;
	// taskBoardFileStack: string[] = [];
	private _editorModified: boolean = false; // Private backing field
	// currentModifiedFile: TFile | null;
	// fileUpdatedUsingModal: string;
	IstasksJsonDataChanged: boolean;
	isI18nInitialized: boolean;
	private _leafIsActive: boolean; // Private property to track leaf state
	private ribbonIconEl: HTMLElement | null; // Store ribbonIconEl globally for reference

	// Public getter/setter for editorModified that emits events
	get editorModified(): boolean {
		return this._editorModified;
	}

	set editorModified(value: boolean) {
		if (this._editorModified !== value) {
			this._editorModified = value;
			// Emit event whenever the value changes so React components can update
			eventEmitter.emit("EDITOR_MODIFIED_CHANGED", value);
		}
	}

	// Queue management for bulk file operations
	private renameQueue: Array<{ file: TAbstractFile; oldPath: string }> = [];
	private deleteQueue: TAbstractFile[] = [];
	private createQueue: TFile[] = [];
	private renameProcessingTimer: NodeJS.Timeout | null = null;
	private deleteProcessingTimer: NodeJS.Timeout | null = null;
	private createProcessingTimer: NodeJS.Timeout | null = null;
	private currentProgressNotice: Notice | null = null;
	private readonly QUEUE_DELAY = 1000; // Delay in ms before starting to process queue
	private readonly PROCESSING_INTERVAL = 100; // Delay between processing each file

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.plugin = this;
		this.app = this.plugin.app;
		this.view = null;
		this.settings = DEFAULT_SETTINGS;
		this.vaultScanner = new VaultScanner(this.app, this.plugin);
		this.realTimeScanner = new RealTimeScanner(
			this.app,
			this.plugin,
			this.vaultScanner,
		);
		this.editorModified = false;
		// this.currentModifiedFile = null;
		// this.fileUpdatedUsingModal = "";
		this.IstasksJsonDataChanged = false;
		this._leafIsActive = false;
		this.ribbonIconEl = null;
		this.isI18nInitialized = false;
	}

	get api(): ReturnType<typeof TaskBoardApi.GetApi> {
		return TaskBoardApi.GetApi(this.app, this.plugin);
	}

	async onload() {
		console.log("Task Board : Loading...");

		// NOTE : I feel, if these singleton instances needs the latest version of 'this', then they might show some unexpected behavior as I am not updating the 'this' inside those singleton instances latest during the plugin life-cycle.
		dragDropTasksManagerInsatance.setPlugin(this);
		bugReporterManagerInsatance.setPlugin(this);

		// Loads settings data and creating the Settings Tab in main Setting
		await this.loadSettings();
		this.runOnPluginUpdate();
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		// this.getLanguage();

		await loadTranslationsOnStartup(this);

		await this.vaultScanner.initializeTasksCache();

		// Register events and commands only on Layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.compatiblePluginsAvailabilityCheck();

			//Creates a Icon on Ribbon Bar (after i18n is initialized)
			this.getRibbonIcon();

			// Creating Few Events
			this.registerEvents();

			// Register few commands
			this.registerCommands();

			// For non-realtime scanning and scanning last modified files
			this.createLocalStorageAndScanModifiedFiles();

			// Register the Kanban view
			this.registerTaskBoardView();

			// Run openAtStartup if openOnStartup is true
			this.openAtStartup();

			// Register status bar element
			this.registerTaskBoardStatusBar();

			// Register editor extensions
			this.registerEditorExtensions();

			// Register markdown post processor for hiding task properties
			this.registerReadingModePostProcessor();

			setTimeout(() => this.findModifiedFilesOnAppAbsense(), 10000);
		});
	}

	onunload() {
		console.log("Task Board : Uninstalling...");

		// deleteAllLocalStorageKeys(); // TODO : Enable this while production build. This is disabled for testing purpose because the data from localStorage is required for testing.
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
			(leaf) => !isFromMainWindow(leaf),
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
			t("open-task-board") ?? "Open task board",
			() => {
				this.activateView("icon");

				// this.app.workspace.ensureSideLeaf(VIEW_TYPE_TASKBOARD, "right", {
				// 	active: true,
				// 	reveal: true,
				// });
			},
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
			await this.loadData(),
		);
		// this.migrateSettings(DEFAULT_SETTINGS, this.settings);
		this.saveSettings();
	}

	async saveSettings(newSetting?: PluginDataJson) {
		try {
			if (newSetting) {
				this.settings = newSetting;
				await this.saveData(newSetting);
			} else {
				await this.saveData(this.settings);
			}
		} catch (err) {
			bugReporterManagerInsatance.addToLogs(
				140,
				String(err),
				"main.ts/saveSettings",
			);
		}
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
		this.realTimeScanner.initializeStack();
		this.realTimeScanner.processAllUpdatedFiles();
	}

	registerTaskBoardView() {
		this.registerView(VIEW_TYPE_TASKBOARD, (leaf) => {
			this.view = new TaskBoardView(this, leaf);
			return this.view;
		});

		// Register AddOrEditTask view (can be opened in tabs or popout windows)
		// this.registerView(VIEW_TYPE_ADD_OR_EDIT_TASK, (leaf) => {
		// 	console.log("Leaf returned by registerView :", leaf);
		// 	leaf.setEphemeralState({ viewTaskId: 0 });
		// 	// This view will be created dynamically when needed via openAddOrEditTaskView
		// 	// The constructor requires specific parameters, so we return a placeholder
		// 	return new AddOrEditTaskView(
		// 		this,
		// 		leaf,
		// 		VIEW_TYPE_ADD_OR_EDIT_TASK,
		// 		() => {},
		// 		false,
		// 		false,
		// 		false
		// 	);
		// });
	}

	registerEditorExtensions() {
		// TODO : The below editor extension will not going to be released in the upcoming version, will plan it for the next version.
		// Register task gutter extension
		// this.registerEditorExtension(taskGutterExtension(this.app, this));

		// Register task property hiding extension
		const hiddenProperties =
			this.settings.data.globalSettings?.hiddenTaskProperties || [];
		if (hiddenProperties.length > 0) {
			this.registerEditorExtension(taskPropertyHidingExtension(this));
		}
	}

	registerReadingModePostProcessor() {
		const hiddenProperties =
			this.settings.data.globalSettings?.hiddenTaskProperties || [];
		if (hiddenProperties.length === 0) {
			return;
		}
		const tasksPlugin = new TasksPluginApi(this);
		if (!tasksPlugin.isTasksPluginEnabled()) {
			this.registerMarkdownPostProcessor((element, context) => {
				// Only process if we have properties to hide
				// Find all list items that could be tasks
				const listItems = element.querySelectorAll("li");

				listItems.forEach((listItem) => {
					// const textContent = listItem.textContent || "";
					// Check if this is a task (starts with checkbox syntax)
					if (listItem.querySelector(".contains-task-list")) {
						this.hidePropertiesInElement(
							listItem,
							hiddenProperties,
						);
					}
				});
			});
		} else {
			// Else body will mean that Tasks plugin has been enabled, so here, I can basically directly make use of the CSS classes added to the span elements by Tasks plugin from the following link and add hide CSS style to the specific span elements, based on the hiddenTaskProperties setting. Link to refer : https://publish.obsidian.md/tasks/Advanced/Styling#Sample+HTML+Full+mode.

			// Dynamically inject CSS to hide spans with the specified class names
			const styleId = "task-board-hide-task-properties-style";
			let styleEl = document.getElementById(
				styleId,
			) as HTMLStyleElement | null;
			if (!styleEl) {
				styleEl = document.createElement("style");
				styleEl.id = styleId;
				document.head.appendChild(styleEl);
			}
			let css = "";
			const fadeInCSS =
				"@keyframes task-board-fade-in { from { display: none !important; opacity: 0; transform: scaleX(0.8); } to { display: inline !important; opacity: 1; transform: scaleX(1); } }";
			// const fadeOutCSS =
			// 	"@keyframes task-board-fade-out { from { display: inline !important; opacity: 1; transform: scaleX(1); } to { display: none !important; opacity: 0; transform: scaleX(0.8); } }";
			hiddenProperties.forEach((property) => {
				switch (property) {
					case taskPropertiesNames.ID:
						css += ".task-id{ display: none !important; }";
						css +=
							"span:hover .task-id { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-id { animation: task-board-fade-out 0.5s ease-in-out 0.5s; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.Tags:
						css +=
							".task-description>span>a.tag { display: none !important; }";
						css +=
							"span:hover .task-description>span>a.tag { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
					// css +=
					// 	"li:out-of-range .task-description>span>a.tag { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
					// css += fadeOutCSS;
					case taskPropertiesNames.CreatedDate:
						css += ".task-created { display: none !important; }";
						css +=
							"span:hover .task-created { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:out-of-range .task-created { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.StartDate:
						css += ".task-start { display: none !important; }";
						css +=
							"span:hover .task-start { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-start { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.ScheduledDate:
						css += ".task-scheduled { display: none !important; }";
						css +=
							"span:hover .task-scheduled { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-scheduled { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.DueDate:
						css += ".task-due { display: none !important; }";
						css +=
							"span:hover .task-due { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-due { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.CompletionDate:
						css += ".task-completion { display: none !important; }";
						css +=
							"span:hover .task-completion { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-completion { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.CancelledDate:
						css += ".task-cancelled { display: none !important; }";
						css +=
							"span:hover .task-cancelled { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-cancelled { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.Priority:
						css += ".task-priority { display: none !important; }";
						css +=
							"span:hover .task-priority { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-priority { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.Time:
						css += ".task-time { display: none !important; }";
						css +=
							"span:hover .task-time { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-time { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.Dependencies:
						css += ".task-dependsOn { display: none !important; }";
						css +=
							"span:hover .task-dependsOn { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-dependsOn { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.OnCompletion:
						css +=
							".task-onCompletion{ display: none !important; }";
						css +=
							"span:hover .task-onCompletion { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-onCompletion { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;
					case taskPropertiesNames.Recurring:
						css += ".task-recurring{ display: none !important; }";
						css +=
							"span:hover .task-recurring { display: inline !important; animation: task-board-fade-in 0.5s ease-in-out; }";
						css += fadeInCSS;
						// css +=
						// 	"li:not(:hover) .task-recurring { display: none !important; animation: task-board-fade-out 0.5s ease-in-out; }";
						// css += fadeOutCSS;
						break;

					// TODO : Reminder is pending.
				}
			});
			styleEl.textContent = css;
		}
	}

	private hidePropertiesInElement(
		element: HTMLElement,
		hiddenProperties: taskPropertiesNames[],
	) {
		// Process text nodes to find and hide specific patterns
		const walker = document.createTreeWalker(
			element,
			NodeFilter.SHOW_TEXT,
			null,
		);

		const textNodes: Text[] = [];
		let node;
		while ((node = walker.nextNode())) {
			textNodes.push(node as Text);
		}

		textNodes.forEach((textNode) => {
			let content = textNode.textContent || "";
			let modified = false;

			hiddenProperties.forEach((property) => {
				const pattern = getTaskPropertyRegexPatterns(
					property,
					this.settings.data.globalSettings?.taskPropertyFormat,
				);
				if (pattern.test(content)) {
					content = content.replace(pattern, (match) => {
						modified = true;
						return `<span class="taskboard-hidden-property" style="display: none;">${match}</span>`;
					});
				}
			});

			if (modified && textNode.parentElement) {
				// Create a temporary element to hold the HTML
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = content;

				// Replace the text node with the new content
				while (tempDiv.firstChild) {
					textNode.parentNode?.insertBefore(
						tempDiv.firstChild,
						textNode,
					);
				}
				textNode.remove();
			}
		});
	}

	openAtStartup() {
		if (!this.settings.data.globalSettings.openOnStartup) return;

		this.activateView("icon");
	}

	registerTaskBoardStatusBar() {
		return;
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
			id: "add-new-task-note",
			name: t("add-new-task-note"),
			callback: () => {
				openAddNewTaskNoteModal(this.app, this.plugin);
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
						activeEditor?.getCursor(),
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
		// 		writeJsonCacheDataToDisk(this.plugin);
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

	// ========================================================
	// Queue Management for Bulk File Operations - Rename, Delete, Create
	// ========================================================

	/**
	 * Add a file to the rename queue and schedule processing
	 * @private
	 * @param file - The file to add to the queue
	 * @param oldPath - The old path of the file
	 */
	private queueFileForRename(file: TAbstractFile, oldPath: string) {
		// Only queue TFile objects (not folders) that are allowed for scanning
		if (file instanceof TFile) {
			this.renameQueue.push({ file, oldPath });

			// Clear existing timer and set a new one
			if (this.renameProcessingTimer) {
				clearTimeout(this.renameProcessingTimer);
			}

			this.renameProcessingTimer = setTimeout(() => {
				this.processRenameQueue();
			}, this.QUEUE_DELAY);
		}
	}

	/**
	 * Process all files in the rename queue one by one
	 */
	async processRenameQueue() {
		if (this.renameQueue.length === 0) {
			this.currentProgressNotice?.hide();
			this.currentProgressNotice = null;
			return;
		}

		const archivedPath = normalizePath(
			this.settings.data.globalSettings.archivedTBNotesFolderPath,
		);
		const totalFiles = this.renameQueue.length;

		// Show progress notice
		this.currentProgressNotice = new Notice(
			`Processing renamed files: 0/${totalFiles}`,
			0,
		);

		let processed = 0;
		while (this.renameQueue.length > 0) {
			const { file, oldPath } = this.renameQueue.shift()!;

			try {
				if (
					fileTypeAllowedForScanning(
						this.plugin.settings.data.globalSettings,
						file,
					)
				) {
					this.realTimeScanner.onFileRenamed(
						file,
						oldPath,
						archivedPath,
					);
					processed++;

					// Update progress notice
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing renamed files: ${processed}/${totalFiles}`;
				}
			} catch (error) {
				this.currentProgressNotice?.hide();
				// this.currentProgressNotice = null;
				bugReporterManagerInsatance.addToLogs(
					162,
					String(error),
					"main.ts/processRenameQueue",
				);
			}

			// Add delay between processing each file to prevent blocking UI
			if (this.renameQueue.length > 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, this.PROCESSING_INTERVAL),
				);
			}
		}

		// Hide progress notice after completion
		this.currentProgressNotice?.hide();
		this.currentProgressNotice = null;

		this.plugin.vaultScanner.saveTasksToJsonCache();
		eventEmitter.emit("REFRESH_BOARD");

		if (processed > 0) {
			new Notice(
				`✓ Task Board : Finished processing ${totalFiles} renamed file(s)`,
			);
		}
	}

	/**
	 * Add a file to the delete queue and schedule processing
	 */
	private queueFileForDeletion(file: TAbstractFile) {
		// Only queue TFile objects (not folders) that are allowed for scanning
		if (file instanceof TFile) {
			this.deleteQueue.push(file);

			// Clear existing timer and set a new one
			if (this.deleteProcessingTimer) {
				clearTimeout(this.deleteProcessingTimer);
			}

			this.deleteProcessingTimer = setTimeout(() => {
				this.processDeleteQueue();
			}, this.QUEUE_DELAY);
		}
	}

	/**
	 * Process all files in the delete queue one by one
	 */
	async processDeleteQueue() {
		if (this.deleteQueue.length === 0) {
			this.currentProgressNotice?.hide();
			this.currentProgressNotice = null;
			return;
		}

		const totalFiles = this.deleteQueue.length;

		// Show progress notice
		this.currentProgressNotice = new Notice(
			`Processing deleted files: 0/${totalFiles}`,
			0,
		);

		let processed = 0;
		while (this.deleteQueue.length > 0) {
			const file = this.deleteQueue.shift()!;

			try {
				if (
					fileTypeAllowedForScanning(
						this.plugin.settings.data.globalSettings,
						file,
					)
				) {
					this.realTimeScanner.onFileDeleted(file);
					processed++;

					// Update progress notice
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing deleted files: ${processed}/${totalFiles}`;
				}
			} catch (error) {
				this.currentProgressNotice?.hide();
				// this.currentProgressNotice = null;
				bugReporterManagerInsatance.addToLogs(
					163,
					String(error),
					"main.ts/processDeleteQueue",
				);
			}

			// Add delay between processing each file to prevent blocking UI
			if (this.deleteQueue.length > 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, this.PROCESSING_INTERVAL),
				);
			}
		}
		// Hide progress notice after completion
		this.currentProgressNotice?.hide();
		this.currentProgressNotice = null;

		this.plugin.vaultScanner.saveTasksToJsonCache();
		eventEmitter.emit("REFRESH_COLUMN");

		if (processed > 0) {
			new Notice(
				`✓ Task Board : Finished processing ${totalFiles} deleted file(s)`,
			);
		}
	}

	/**
	 * Add a file to the create queue and schedule processing
	 */
	private queueFileForCreation(file: TFile) {
		// Only queue files that are allowed for scanning

		this.createQueue.push(file);

		// Clear existing timer and set a new one
		if (this.createProcessingTimer) {
			clearTimeout(this.createProcessingTimer);
		}

		this.createProcessingTimer = setTimeout(() => {
			this.processCreateQueue();
		}, this.QUEUE_DELAY);
	}

	/**
	 * Process all files in the create queue one by one
	 */
	async processCreateQueue() {
		if (this.createQueue.length === 0) {
			this.currentProgressNotice?.hide();
			this.currentProgressNotice = null;
			return;
		}

		const totalFiles = this.createQueue.length;

		this.plugin.vaultScanner.refreshTasksFromFiles(this.createQueue, false);

		// Show progress notice only if the files are more than 10
		if (totalFiles > 10) {
			this.currentProgressNotice = new Notice(
				`Task Board : Processing created files: 0/${totalFiles}`,
				0,
			);
			let processed = 0;
			while (this.createQueue.length > 0) {
				const file = this.createQueue.shift()!;

				try {
					// if (
					// 	fileTypeAllowedForScanning(
					// 		this.plugin.settings.data.globalSettings,
					// 		file
					// 	)
					// ) {
					// 	await this.realTimeScanner.processAllUpdatedFiles(file);
					// }
					processed++;

					// Update progress notice
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing created files: ${processed}/${totalFiles}`;
				} catch (error) {
					this.currentProgressNotice?.hide();
					// this.currentProgressNotice = null;
					bugReporterManagerInsatance.addToLogs(
						164,
						String(error),
						"main.ts/processCreateQueue",
					);
				}

				// Add delay between processing each file to prevent blocking UI
				if (this.createQueue.length > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.PROCESSING_INTERVAL),
					);
				}
			}

			// Hide progress notice after completion
			this.currentProgressNotice?.hide();
			this.currentProgressNotice = null;
			if (processed > 0) {
				new Notice(
					`✓ Task Board : Finished processing ${totalFiles} created file(s)`,
				);
			}
		}
	}

	/**
	 * Runs on plugin load/Obsidian startup time and find all the files which where
	 * modified (edited/renamed/deleted) between the time when Obsidian was last closed
	 * till now.
	 */
	async findModifiedFilesOnAppAbsense() {
		let OBSIDIAN_CLOSED_TIME = this.app.loadLocalStorage(
			OBSIDIAN_CLOSED_TIME_KEY,
		);

		if (!OBSIDIAN_CLOSED_TIME)
			OBSIDIAN_CLOSED_TIME = this.vaultScanner.tasksCache.Modified_at;

		if (OBSIDIAN_CLOSED_TIME) {
			OBSIDIAN_CLOSED_TIME = Date.parse(OBSIDIAN_CLOSED_TIME);
			let filesScannedCount = 0;
			const modifiedCreatedRenamedFiles = this.app.vault
				.getFiles()
				.filter((file) => {
					filesScannedCount++;
					return (
						file.stat.mtime > OBSIDIAN_CLOSED_TIME ||
						file.stat.ctime > OBSIDIAN_CLOSED_TIME
					);
				});

			// Find deleted files by comparing cache with current vault files
			const currentFilesPaths = new Set(
				this.app.vault.getFiles().map((file) => file.path),
			);
			const cachedFilesPaths = Object.keys(
				this.vaultScanner.tasksCache.Pending || {},
			).concat(Object.keys(this.vaultScanner.tasksCache.Completed || {}));
			const deletedFiles = new Set(
				cachedFilesPaths.filter(
					(filePath) => !currentFilesPaths.has(filePath),
				),
			);
			const deletedFilesList = [...deletedFiles];

			const changed_files = modifiedCreatedRenamedFiles.filter((file) =>
				fileTypeAllowedForScanning(
					this.plugin.settings.data.globalSettings,
					file,
				),
			);
			const totalFilesLength =
				changed_files.length + deletedFilesList.length;

			if (totalFilesLength > 0) {
				const scanAllModifiedFiles = () => {
					this.plugin.vaultScanner
						.refreshTasksFromFiles(changed_files, false)
						.then(async () => {
							if (deletedFilesList.length > 0) {
								await this.plugin.vaultScanner.deleteCacheForFiles(
									deletedFilesList,
								);
							}
						});
				};

				if (this.settings.data.globalSettings.showModifiedFilesNotice) {
					const modifiedFilesNotice = new Notice(
						createFragment((f) => {
							f.createDiv("bugReportNotice", (el) => {
								el.createEl("p", {
									text: `Task Board : ${totalFilesLength} files has been modified when Obsidian was inactive.`,
								});
								el.createEl("button", {
									text: t("show-me"),
									cls: "reportBugButton",
									onclick: () => {
										// el.hide();

										// Open a modal and show all these file names with their modified date-time in a nice UI.
										const modifiedFilesModal =
											new ModifiedFilesModal(this.app, {
												modifiedFiles: changed_files,
												deletedFiles: deletedFilesList,
											});
										modifiedFilesModal.open();
									},
								});
								el.createEl("button", {
									text: t("scan-them"),
									cls: "ignoreBugButton",
									onclick: async () => {
										try {
											modifiedFilesNotice.hide();

											// Show progress notice
											this.currentProgressNotice =
												new Notice(
													`Task Board : Processing modified files: 0/${totalFilesLength}`,
													0,
												);

											scanAllModifiedFiles();

											let modifiedFilesQueueLength =
												changed_files?.length ?? 0;

											let processed = 0;
											while (
												modifiedFilesQueueLength > 0
											) {
												modifiedFilesQueueLength =
													modifiedFilesQueueLength -
													1;

												processed++;

												// Update progress notice
												this.currentProgressNotice.messageEl.textContent = `Task Board : Processing created files: ${processed}/${totalFilesLength}`;

												// Add delay between processing each file to prevent blocking UI
												if (
													modifiedFilesQueueLength > 0
												) {
													await new Promise(
														(resolve) =>
															setTimeout(
																resolve,
																this
																	.PROCESSING_INTERVAL,
															),
													);
												}
											}

											// Hide progress notice after completion
											this.currentProgressNotice?.hide();
											this.currentProgressNotice = null;
											new Notice(
												`✓ Task Board : Finished processing ${totalFilesLength} created file(s)`,
											);
										} catch (error) {
											this.currentProgressNotice?.hide();
											bugReporterManagerInsatance.addToLogs(
												165,
												String(error),
												"main.ts/findModifiedFilesOnAppAbsense",
											);
										}
									},
								});
							});
						}),
						0,
					);

					modifiedFilesNotice.messageEl.onClickEvent((e) => {
						if (e.target instanceof HTMLButtonElement) {
							e.stopPropagation();
							e.preventDefault();
							e.stopImmediatePropagation();
						}
					});
				} else {
					scanAllModifiedFiles();
				}
			}
		}
	}

	/**
	 * Registers all the events that TaskBoard needs to listen to
	 */
	registerEvents() {
		this.registerEvent(
			this.app.vault.on("modify", async (file: TAbstractFile) => {
				if (
					fileTypeAllowedForScanning(
						this.plugin.settings.data.globalSettings,
						file,
					)
				) {
					if (file instanceof TFile) {
						if (
							this.plugin.settings.data.globalSettings
								.scanMode === scanModeOptions.REAL_TIME
						) {
							this.vaultScanner.refreshTasksFromFiles(
								[file],
								false,
							);
						} else {
							// 	this.taskBoardFileStack.push(file.path);
							this.editorModified = true;
							this.realTimeScanner.onFileModified(file);
						}
					}
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				// Queue the file for processing instead of processing immediately
				this.queueFileForRename(file, oldPath);
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				// Queue the file for processing instead of processing immediately
				this.queueFileForDeletion(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					// Queue the file for processing instead of processing immediately
					this.queueFileForCreation(file);
				}
			}),
		);

		if (
			this.plugin.settings.data.globalSettings.scanMode !==
			scanModeOptions.MANUAL
		) {
			// Listen for editor-blur event and trigger scanning if the editor was modified
			this.registerEvent(
				this.app.workspace.on(
					"active-leaf-change",
					(leaf: WorkspaceLeaf | null) => {
						this.onFileModifiedAndLostFocus();
					},
				),
			);
			this.registerDomEvent(window, "blur", () => {
				this.onFileModifiedAndLostFocus();
			});
			this.registerDomEvent(window, "focus", () => {
				setTimeout(() => this.onFileModifiedAndLostFocus(), 200);
			});
		}

		this.registerEvent(
			this.app.workspace.on("quit", () => {
				const currentTime = getCurrentLocalTimeString();
				this.app.saveLocalStorage(
					OBSIDIAN_CLOSED_TIME_KEY,
					currentTime,
				);
			}),
		);

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
								if (
									fileTypeAllowedForScanning(
										this.plugin.settings.data
											.globalSettings,
										file,
									)
								) {
									this.vaultScanner.refreshTasksFromFiles(
										[file],
										true,
									);
								}
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
										file.path,
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
										file.path,
									);
									this.saveSettings();
								});
						});
					}
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
										file.path,
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
										file.path,
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
			}),
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
			// 	await this.realTimeScanner.onFileModified(
			// 		this.currentModifiedFile,
			// 		this.settings.data.globalSettings.realTimeScanner
			// 	);
			// } else {
			// 	this.fileUpdatedUsingModal = "";
			// }

			await this.realTimeScanner.processAllUpdatedFiles();
		}
	}

	async compatiblePluginsAvailabilityCheck() {
		// Check if the Tasks plugin is installed and fetch the custom statuses
		// await fetchTasksPluginCustomStatuses(this.plugin);
		const tasksPlug = await isTasksPluginEnabled(this.plugin);
		this.plugin.settings.data.globalSettings.compatiblePlugins.tasksPlugin =
			tasksPlug;

		// Check if the Reminder plugin is installed
		isReminderPluginInstalled(this.plugin);
	}

	private runOnPluginUpdate() {
		// Check if the plugin version has changed
		const currentVersion = newReleaseVersion; // Change this whenever you will going to release a new version.
		const runMandatoryScan = false; // Change this whenever you will release a major version which requires user to scan the whole vault again. And to enable the notification.
		const previousVersion = this.settings.version;

		if (previousVersion == "" || currentVersion !== previousVersion) {
			// make the localStorage flag, 'manadatoryScan' to True

			if (previousVersion !== "") {
				const customMessage = new Notice("", 0);

				const messageContainer = customMessage.containerEl;

				const customMessageContainer = messageContainer.createDiv({
					cls: "taskboardCustomMessageContainer",
				});

				customMessageContainer.createEl("h3", { text: "Task Board" });
				customMessageContainer.createEl("p", {
					text: "Note for existing users",
					cls: "taskboardCustomMessageContainerBold",
				});
				customMessageContainer.createEl("span", {
					text: "If you were using the custom statuses from Tasks plugin configs. Please import them in Task Board's setting, using a button in the new Custom Statuses setting section. Task Board will no longer import the custom statuses from Tasks plugin automatically.",
				});
				customMessageContainer.createEl("p", {
					text: "Read the release notes for all the latest features : ",
				});
				customMessageContainer.createEl("a", {
					text: "Task Board v1.9.0",
					href: `https://github.com/tu2-atmanand/Task-Board/releases/tag/${newReleaseVersion}`,
				});
			}

			if (previousVersion === "" || runMandatoryScan) {
				localStorage.setItem("manadatoryScan", "true");
			}

			// if (runMandatoryScan) {
			// const smallMessage =
			// 	"Even being a minor release, this new version of Task Board requires a re-scan of your vault. Kindly re-scan using the top-right button in the task board tab.";
			// new Notice(smallMessage, 0);
			// }

			this.settings.version = currentVersion;

			// Settings migrations should be only applied after plugin update.
			this.settings = migrateSettings(DEFAULT_SETTINGS, this.settings);

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
