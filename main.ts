// main.ts

import { around } from "monkey-around";
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
import { EmbedRegistry } from "obsidian-typings";
import { parse } from "date-fns";
import { t } from "i18next";
import {
	taskPropertyHidingExtension,
	getTaskPropertyRegexPatterns,
} from "./src/editor-extensions/task-operations/property-hiding.js";
import {
	VIEW_TYPE_TASKBOARD,
	TASKBOARD_FILE_EXTENSION,
	OBSIDIAN_CLOSED_TIME_KEY,
	DEFAULT_DATE_TIME_FORMAT,
	newReleaseVersion,
	MANDATORY_SCAN_KEY,
} from "./src/interfaces/Constants.js";
import {
	taskPropertiesNames,
	scanModeOptions,
} from "./src/interfaces/Enums.js";
import {
	PluginDataJson,
	DEFAULT_SETTINGS,
} from "./src/interfaces/GlobalSettings.js";
import { TaskBoardIcon } from "./src/interfaces/Icons.js";
import { bugReporterManagerInsatance } from "./src/managers/BugReporter.js";
import { dragDropTasksManagerInsatance } from "./src/managers/DragDropTasksManager.js";
import { RealTimeScanner } from "./src/managers/RealTimeScanner.js";
import TaskBoardFileManager from "./src/managers/TaskBoardFileManager.js";
import VaultScanner, {
	fileTypeAllowedForScanning,
} from "./src/managers/VaultScanner.js";
import { MergeBoardsModal } from "./src/modals/MergeBoardsModal.js";
import { ModifiedFilesModal } from "./src/modals/ModifiedFilesModal.js";
import { TaskBoardView } from "./src/obsidian_views/TaskBoardView.js";
import { isReminderPluginInstalled } from "./src/services/CommunityPlugins.js";
import { eventEmitter } from "./src/services/EventEmitter.js";
import {
	openAddNewTaskModal,
	openAddNewTaskNoteModal,
	openAddNewTaskInCurrentFileModal,
	openBoardsExplorerModal,
	openScanVaultModal,
} from "./src/services/OpenModals.js";
import { TasksPluginApi } from "./src/services/tasks-plugin/api.js";
import { isTasksPluginEnabled } from "./src/services/tasks-plugin/helpers.js";
import { checkAndNotifyV2Migration } from "./src/settings/2_x_x_Migrations/MigrationUtils.js";
import { migrateSettings } from "./src/settings/SettingSynchronizer.js";
import { TaskBoardSettingTab } from "./src/settings/TaskBoardSettingTab.js";
import { TaskBoardApi } from "./src/taskboardAPIs.js";
import { getCurrentLocalDateTimeString } from "./src/utils/DateTimeCalculations.js";
import { loadTranslationsOnStartup } from "./src/utils/lang/helper.js";
import { DEFAULT_BOARD } from "./src/interfaces/BoardConfigs.js";

export default class TaskBoard extends Plugin {
	app: App;
	plugin: TaskBoard;
	view: TaskBoardView | null;
	settings: PluginDataJson = DEFAULT_SETTINGS;
	vaultScanner: VaultScanner;
	realTimeScanner: RealTimeScanner;
	taskBoardFileManager: TaskBoardFileManager;
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
	private readonly QUEUE_DELAY = 2000; // Delay in ms before starting to process queue
	private readonly PROCESSING_INTERVAL = 100; // Delay between processing each file

	constructor(app: App, menifest: PluginManifest) {
		super(app, menifest);
		this.plugin = this;
		this.app = app;
		this.plugin.app = app;
		this.view = null;
		this.settings = DEFAULT_SETTINGS;
		this.vaultScanner = new VaultScanner(this.app, this.plugin);
		this.realTimeScanner = new RealTimeScanner(
			this.app,
			this.plugin,
			this.vaultScanner,
		);
		this.taskBoardFileManager = new TaskBoardFileManager(this.plugin);
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

		// this.getLanguage();
		await loadTranslationsOnStartup(this);

		// NOTE : I feel, if these singleton instances needs the latest version of 'this', then they might show some unexpected behavior as I am not updating the 'this' inside those singleton instances latest during the plugin life-cycle.
		dragDropTasksManagerInsatance.setPlugin(this);
		bugReporterManagerInsatance.setPlugin(this);

		// Migrations for updating from v1.x.x version series to v2.x.x series version
		const appliedV2Migrations = await checkAndNotifyV2Migration(this);
		await sleep(200); // For all the migrations code to properly save all the files.

		// Loads settings data and creating the Settings Tab in main Setting
		await this.loadSettings();
		if (!appliedV2Migrations) await this.runOnPluginUpdate();
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		await this.vaultScanner.initializeTasksCache();

		// Register the Kanban view
		this.registerTaskBoardView();

		// Register events and commands only on Layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.compatiblePluginsAvailabilityCheck();

			//Creates a Icon on Ribbon Bar (after i18n is initialized)
			this.getRibbonIcon();

			// Creating Few Events
			this.registerEvents();

			// Register few commands
			this.registerCommands();

			this.taskBoardFileManager.validateBoardFiles();

			// For non-realtime scanning and scanning last modified files
			this.createLocalStorageAndScanModifiedFiles();

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

	/**
	 * Opens the Task Board view using either the last viewed board file or opens the board file
	 * whose filePath has been passed. Most of the time, this function will try to find an existing
	 * leaf for the specific board file. If user specifically wants to have a duplicate leaf, pass
	 * the {@link duplicate} as true.
	 *
	 * @param leafLayout - Where to open the board leaf/tab. New tab or new window.
	 * @param duplicate - Whether to re-use already opened leaf or create a new one.
	 * This will be true in only special cases, when user wants to specifical open a duplicate.
	 * @param filePath (OPTIONAL) - The file path of the board to open. If no filePath has been
	 * provided then will open the last viewed board.
	 */
	async activateView(
		leafLayout: string,
		duplicate: boolean,
		filePath?: string,
	) {
		let leaf: WorkspaceLeaf | null = null;
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD);

		function isFromMainWindow(leaf: WorkspaceLeaf): boolean | undefined {
			if (filePath) {
				const state = leaf.getViewState();
				if (
					state?.state?.filePath &&
					state?.state?.filePath !== filePath
				) {
					return false;
				}
			}

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
			if (mainWindowLeaf && !duplicate) {
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
			leaf.setEphemeralState({ taskboardFilePath: filePath ?? "" });

			await leaf.setViewState({
				type: VIEW_TYPE_TASKBOARD,
				active: true,
				state: {
					filePath: filePath ?? "",
				},
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
				this.activateView("icon", false);

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
	// 		this.settings.data.lang = obsidianLang;
	// 		this.saveSettings();
	// 	} else {
	// 		localStorage.setItem(
	// 			"taskBoardLang",
	// 			// this.settings.data.lang
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
			console.log("Leaf :", leaf);
			this.view = new TaskBoardView(this, leaf);
			return this.view;
		});

		this.registerExtensions(
			[TASKBOARD_FILE_EXTENSION],
			VIEW_TYPE_TASKBOARD,
		);

		// Monkey-patch WorkspaceLeaf.setViewState to intercept .taskboard file clicks
		this.registerMonkeyPatchForTaskboardFiles();

		// @ts-ignore
		const embedRegistry = this.app.embedRegistry as EmbedRegistry;
		embedRegistry.registerExtension(
			TASKBOARD_FILE_EXTENSION,
			(context, file, _) => {
				console.log("Context :", context, "\nFile :", file);

				// @ts-ignore
				return new TaskBoardEmbedComponent(
					context.containerEl,
					this,
					// @ts-ignore
					file,
					context.containerEl.getAttr("alt") || undefined,
				) as any;
			},
		);

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

	/**
	 * Monkey-patch WorkspaceLeaf.setViewState to intercept .taskboard file clicks
	 * When a user clicks on a .taskboard file in the File Navigator, this intercepts
	 * the default markdown view and opens it in the TaskBoard custom view instead,
	 * while preserving the file path in the view state
	 */
	private registerMonkeyPatchForTaskboardFiles() {
		// Use monkey-around to safely patch WorkspaceLeaf.prototype.setViewState
		// This allows multiple plugins to patch the same method without conflicts
		const unregisterPatch = around(WorkspaceLeaf.prototype, {
			setViewState: (next) =>
				function (this: WorkspaceLeaf, state: any, eState?: any) {
					const isTaskBoardView = state.type === VIEW_TYPE_TASKBOARD;
					const filePath = state.state?.file as string | undefined;
					const isTaskboardFile =
						filePath && filePath.endsWith(".taskboard");

					if (isTaskBoardView && isTaskboardFile) {
						// Store the file path directly on the leaf instance for immediate access
						(this as any).taskboardFilePath = filePath;

						// Also set ephemeral state for safety
						this.setEphemeralState({ taskboardFilePath: filePath });
					}

					// Call the next method in the chain (original or other patches)
					return next.call(this, state, eState);
				},
		});

		// Register cleanup handler to unregister the patch when plugin unloads
		// This prevents memory leaks and ensures the patch is properly removed
		this.register(unregisterPatch);
	}

	registerEditorExtensions() {
		// TODO : The below editor extension will not going to be released in the upcoming version, will plan it for the next version.
		// Register task gutter extension
		// this.registerEditorExtension(taskGutterExtension(this.app, this));

		// Register task property hiding extension
		const hiddenProperties = this.settings.data?.hiddenTaskProperties || [];
		if (hiddenProperties.length > 0) {
			this.registerEditorExtension(taskPropertyHidingExtension(this));
		}
	}

	registerReadingModePostProcessor() {
		const hiddenProperties = this.settings.data?.hiddenTaskProperties || [];
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
					this.settings.data?.taskPropertyFormat,
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
		if (!this.settings.data.openOnStartup) return;

		this.activateView("icon", false);
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
				openAddNewTaskModal(this.plugin);
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
				this.activateView("tab", false);
			},
		});
		this.addCommand({
			id: "open-task-board-new-window",
			name: t("open-task-board-in-new-window"),
			callback: () => {
				this.activateView("window", false);
			},
		});
		this.addCommand({
			id: "open-task-boards-explorer",
			name: t("open-task-boards-explorer"),
			callback: () => {
				openBoardsExplorerModal(this);
			},
		});
		this.addCommand({
			id: "open-scan-vault-modal",
			name: t("open-scan-vault-modal"),
			callback: () => {
				openScanVaultModal(this.plugin);
			},
		});
		this.addCommand({
			id: "merge-boards",
			name: "Merge Boards",
			callback: () => {
				new MergeBoardsModal(this.app, {
					plugin: this,
					taskBoardFileManager: this.taskBoardFileManager,
				}).open();
			},
		});
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
			this.settings.data.archivedTBNotesFolderPath,
		);
		let allowedFiles = this.renameQueue.filter((fileData) =>
			fileTypeAllowedForScanning(this.settings.data, fileData.file),
		);
		const totalFilesLength = allowedFiles.length;

		// Empty the global queue
		this.renameQueue = [];

		if (totalFilesLength > 0) {
			// Show progress notice
			this.currentProgressNotice = new Notice(
				`Processing renamed files: 0/${totalFilesLength}`,
				0,
			);

			let processed = 0;
			while (allowedFiles.length > 0) {
				const { file, oldPath } = allowedFiles.shift()!;

				try {
					this.realTimeScanner.onFileRenamed(
						file,
						oldPath,
						archivedPath,
					);
					processed++;

					// Update progress notice
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing renamed files: ${processed}/${totalFilesLength}`;
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
				if (allowedFiles.length > 0) {
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
					`✓ Task Board : Finished processing ${totalFilesLength} renamed file(s)`,
				);
			}
		}

		if (this.renameProcessingTimer)
			clearTimeout(this.renameProcessingTimer);
	}

	/**
	 * Add a file to the delete queue and schedule processing
	 */
	private queueFileForDeletion(file: TAbstractFile) {
		// Only queue TFile objects (not folders) that are allowed for scanning
		if (file instanceof TFile) {
			this.deleteQueue.push(file);

			// Clear existing timer and set a new one
			if (!this.deleteProcessingTimer) {
				this.deleteProcessingTimer = setTimeout(() => {
					this.processDeleteQueue();
				}, this.QUEUE_DELAY);
			} else {
				// NOTE : I think there is no need to remove the Timout created, in 2 seconds, all the Obsidians triggers should finish, for the Task Board's processing to start.
				// clearTimeout(this.deleteProcessingTimer);
			}
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

		let allowedFiles = this.deleteQueue.filter((file: TAbstractFile) =>
			fileTypeAllowedForScanning(this.settings.data, file),
		);
		const totalFilesLength = allowedFiles.length;

		if (allowedFiles.length > 0) {
			// Show progress notice
			this.currentProgressNotice = new Notice(
				`Processing deleted files: 0/${totalFilesLength}`,
				0,
			);

			let processed = 0;
			while (allowedFiles.length > 0) {
				const file = allowedFiles.shift()!;

				try {
					this.realTimeScanner.onFileDeleted(file);
					processed++;

					// Update progress notice
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing deleted files: ${processed}/${totalFilesLength}`;
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
				if (allowedFiles.length > 0) {
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
					`✓ Task Board : Finished processing ${totalFilesLength} deleted file(s)`,
				);
			}
		}
	}

	/**
	 * Add a file to the create queue and schedule processing
	 */
	private queueFileForCreation(file: TFile) {
		// Only queue files that are allowed for scanning

		this.createQueue.push(file);

		// Clear existing timer and set a new one
		if (!this.createProcessingTimer) {
			this.createProcessingTimer = setTimeout(() => {
				this.processCreateQueue();
			}, this.QUEUE_DELAY);
		} else {
			// NOTE : I think there is no need to remove the Timout created, in 2 seconds, all the Obsidians triggers should finish, for the Task Board's processing to start.
			// clearTimeout(this.createProcessingTimer);
		}
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

		let allowedFiles = this.createQueue.filter((file: TFile) =>
			fileTypeAllowedForScanning(this.settings.data, file),
		);
		const totalFilesLength = allowedFiles.length;

		this.plugin.vaultScanner.refreshTasksFromFiles(allowedFiles, false);

		// Show progress notice only if the files are more than 10
		if (totalFilesLength > 10) {
			this.currentProgressNotice = new Notice(
				`Task Board : Processing created files: 0/${totalFilesLength}`,
				0,
			);
			let processed = 0;
			while (allowedFiles.length > 0) {
				const file = allowedFiles.shift()!;

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
					this.currentProgressNotice.messageEl.textContent = `Task Board : Processing created files: ${processed}/${totalFilesLength}`;
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
				if (allowedFiles.length > 0) {
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
					`✓ Task Board : Finished processing ${totalFilesLength} created file(s)`,
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
		const storedTime = this.app.loadLocalStorage(
			OBSIDIAN_CLOSED_TIME_KEY,
		) as string | undefined;

		let OBSIDIAN_CLOSED_TIME: Date | undefined;

		if (storedTime) {
			OBSIDIAN_CLOSED_TIME = parse(
				storedTime,
				DEFAULT_DATE_TIME_FORMAT,
				new Date(),
			);
		} else {
			OBSIDIAN_CLOSED_TIME = parse(
				this.vaultScanner.tasksCache.Modified_at,
				DEFAULT_DATE_TIME_FORMAT,
				new Date(),
			);
		}

		if (OBSIDIAN_CLOSED_TIME) {
			let filesScannedCount = 0;
			const modifiedCreatedRenamedFiles = this.app.vault
				.getFiles()
				.filter((file) => {
					filesScannedCount++;
					return (
						file.stat.mtime > OBSIDIAN_CLOSED_TIME!.getTime() ||
						file.stat.ctime > OBSIDIAN_CLOSED_TIME!.getTime()
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
				fileTypeAllowedForScanning(this.plugin.settings.data, file),
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

				if (this.settings.data.showModifiedFilesNotice) {
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
					fileTypeAllowedForScanning(this.plugin.settings.data, file)
				) {
					if (file instanceof TFile) {
						if (
							this.plugin.settings.data.scanMode ===
							scanModeOptions.REAL_TIME
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

		if (this.plugin.settings.data.scanMode !== scanModeOptions.MANUAL) {
			// Listen for editor-blur event and trigger scanning if the editor was modified
			this.registerEvent(
				this.app.workspace.on(
					"active-leaf-change",
					(leaf: WorkspaceLeaf | null) => {
						this.onFileModifiedAndLostFocus();
						eventEmitter.emit("SAVE_MAP");
					},
				),
			);
			this.registerDomEvent(window, "blur", () => {
				this.onFileModifiedAndLostFocus();
				eventEmitter.emit("SAVE_MAP");
			});
			this.registerDomEvent(window, "focus", () => {
				setTimeout(() => {
					this.onFileModifiedAndLostFocus();
					eventEmitter.emit("SAVE_MAP");
				}, 200);
			});
		}

		this.registerEvent(
			this.app.workspace.on("quit", () => {
				const currentTime = getCurrentLocalDateTimeString();
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
										this.plugin.settings.data,
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
					if (this.settings.data.scanFilters.files.polarity === 2) {
						menu.addItem((item) => {
							item.setTitle(t("add-file-in-scan-filter"))
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.scanFilters.files.values.push(
										file.path,
									);
									this.saveSettings();
								});
						});
					}
					if (this.settings.data.scanFilters.files.polarity === 1) {
						menu.addItem((item) => {
							item.setTitle(t("add-file-in-scan-filter"))
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.scanFilters.files.values.push(
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

					if (this.settings.data.scanFilters.folders.polarity === 2) {
						menu.addItem((item) => {
							item.setTitle(t("add-folder-in-scan-filter"))
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.scanFilters.folders.values.push(
										file.path,
									);
									this.saveSettings();
								});
						});
					}
					if (this.settings.data.scanFilters.folders.polarity === 1) {
						menu.addItem((item) => {
							item.setTitle(t("add-folder-in-scan-filter"))
								.setIcon(TaskBoardIcon)
								.setSection("action")
								.onClick(() => {
									this.settings.data.scanFilters.folders.values.push(
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

		const openBoardCallback = (data: {
			layout: string;
			filePath: string;
			duplicate: boolean;
		}) => {
			try {
				this.activateView(data.layout, data.duplicate, data.filePath);
			} catch (error) {
				console.error(error);
			}
		};

		eventEmitter.on("OPEN_BOARD", openBoardCallback);
		return () => eventEmitter.off("OPEN_BOARD", openBoardCallback);
	}

	async onFileModifiedAndLostFocus() {
		if (this.editorModified) {
			// if (this.currentModifiedFile.path !== this.fileUpdatedUsingModal) {
			// 	await this.realTimeScanner.onFileModified(
			// 		this.currentModifiedFile,
			// 		this.settings.data.realTimeScanner
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
		this.plugin.settings.data.compatiblePlugins.tasksPlugin = tasksPlug;

		// Check if the Reminder plugin is installed
		isReminderPluginInstalled(this.plugin);
	}

	private async runOnPluginUpdate() {
		// Check if the plugin version has changed
		const currentVersion = newReleaseVersion; // Change this whenever you will going to release a new version.
		const runMandatoryScan = false; // Change this whenever you will release a major version which requires user to scan the whole vault again. And to enable the notification.
		const previousVersion = this.settings.version;

		if (previousVersion == "" || currentVersion !== previousVersion) {
			// A short custom message to show in Obsidian's Notice on plugin update.
			// if (previousVersion !== "") {
			// 	const customMessage = new Notice("", 0);

			// 	const messageContainer = customMessage.containerEl;

			// 	const customMessageContainer = messageContainer.createDiv({
			// 		cls: "taskboardCustomMessageContainer",
			// 	});

			// 	customMessageContainer.createEl("h3", { text: "Task Board" });
			// 	customMessageContainer.createEl("p", {
			// 		text: "Note for existing users",
			// 		cls: "taskboardCustomMessageContainerBold",
			// 	});
			// 	customMessageContainer.createEl("span", {
			// 		text: "If you were using the custom statuses from Tasks plugin configs. Please import them in Task Board's setting, using a button in the new Custom Statuses setting section. Task Board will no longer import the custom statuses from Tasks plugin automatically.",
			// 	});
			// 	customMessageContainer.createEl("p", {
			// 		text: "Read the release notes for all the latest features : ",
			// 	});
			// 	customMessageContainer.createEl("a", {
			// 		text: "Task Board v1.9.4",
			// 		href: `https://github.com/tu2-atmanand/Task-Board/releases/tag/${newReleaseVersion}`,
			// 	});
			// }

			// Show a message to existing users to re-scan the vault on minor version updates
			// if (runMandatoryScan && previousVersion === "") {
			// const smallMessage =
			// 	"Even being a minor release, this new version of Task Board requires a re-scan of your vault. Kindly re-scan using the top-right button in the task board tab.";
			// new Notice(smallMessage, 0);
			// }

			// This will run only on a fresh plugin install
			if (previousVersion === "") {
				// creates the DEFAULT_BOARD file if it doesnt exists.
				await this.createTemplateBoard();
			}

			// make the localStorage flag, 'manadatoryScan' to True
			if (previousVersion === "" || runMandatoryScan) {
				localStorage.setItem(MANDATORY_SCAN_KEY, "true");
			}

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

	/**
	 * This function only runs during the plugin installation time and
	 * creates the template board(DEFAULT_BOARD) for user to use for the
	 * first time.
	 */
	private async createTemplateBoard() {
		try {
			// Import DEFAULT_BOARDS from BoardConfigs
			const DEFAULT_BOARD_REGISTRY_ITEM = Object.values(
				DEFAULT_SETTINGS.data.taskBoardFilesRegistry,
			)[0];

			const success = await this.taskBoardFileManager.createNewBoardFile(
				DEFAULT_BOARD_REGISTRY_ITEM.filePath,
				DEFAULT_BOARD,
			);

			if (success) {
				new Notice(
					`Task Board: Created the template board file to help you start using the plugin quickly.\n\nBoard Path : ${DEFAULT_BOARD_REGISTRY_ITEM.filePath}`,
					0,
				);
			} else {
				throw "Task Board: There was an issue while creating the template board file. Please check the logs.";
			}
		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				34,
				"Error checking or creating board files",
				error as string,
				"main.ts/checkAndCreateBoardFiles",
			);
		}
	}

	// /**
	//  * @deprecated - In the new design, we will not going to create multiple board files,
	//  * instead there will be a single bord file. Please use the {@link createTemplateBoard()} function.
	//  *
	//  * Check if configured board files exist, and create missing default board files
	//  * This is called during plugin initialization
	//  */
	// private async checkAndCreateBoardFiles() {
	// 	try {
	// 		console.log("Task Board: Checking for configured board files...");

	// 		// Get the missing board files
	// 		const missingFiles =
	// 			await this.taskBoardFileManager.validateBoardFiles();

	// 		if (missingFiles.length > 0) {
	// 			console.log(
	// 				`Task Board: Found ${missingFiles.length} missing board file(s)`,
	// 				missingFiles,
	// 			);

	// 			// Import DEFAULT_BOARDS from BoardConfigs
	// 			const { DEFAULT_BOARD } =
	// 				await import("src/interfaces/BoardConfigs");

	// 			// Try to create missing default board files
	// 			const createdCount =
	// 				await this.taskBoardFileManager.createMissingDefaultBoardFiles(
	// 					[DEFAULT_BOARD],
	// 				);

	// 			if (createdCount > 0) {
	// 				new Notice(
	// 					`Task Board: Created ${createdCount} missing board file(s). Please restart the plugin or reload Obsidian to load the new boards.`,
	// 					5000,
	// 				);
	// 				console.log(
	// 					`Task Board: Successfully created ${createdCount} board file(s)`,
	// 				);
	// 			}
	// 		} else {
	// 			console.log("Task Board: All configured board files exist.");
	// 		}
	// 	} catch (error) {
	// 		console.error(
	// 			"Task Board: Error checking or creating board files:",
	// 			error,
	// 		);
	// 		bugReporterManagerInsatance.showNotice(
	// 			34,
	// 			"Error checking or creating board files",
	// 			error as string,
	// 			"main.ts/checkAndCreateBoardFiles",
	// 		);
	// 	}
	// }

	async fileExists(filePath: string): Promise<boolean> {
		return await this.app.vault.adapter.exists(filePath);
	}
}
