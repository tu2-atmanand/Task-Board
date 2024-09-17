// main.ts  ---------  Before adding logic - WORKING

import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { DEFAULT_SETTINGS, GlobalSettings } from "src/interfaces/KanbanView";
import {
	TaskBoardIcon,
	VIEW_TYPE_TASKBOARD,
} from "src/interfaces/TaskBoardGlobalValues";

import { AddTaskModal } from "src/modal/AddTaskModal";
import { BoardConfigureModal } from "src/settings/BoardConfigureModal";
import { GlobalSettings } from "src/interfaces/KanbanView";
import { KanbanView } from "./src/views/KanbanView";
import { TaskBoardSettingTab } from "./src/settings/TaskBoardSettingTab";
import fs from "fs";
import path from "path";

// Import the settings

const DEFAULT_SETTINGS: GlobalSettings = {
	defaultColumnNames: {
		today: "",
		tomorrow: "",
		future: "",
		undated: "",
		otherTags: "",
		untagged: "",
		completed: "",
	},
	filters: [],
	firstDayOfWeek: "Mon",
	ignoreFileNameDates: false,
	taskCompletionFormat: "ObsidianTasks",
	taskCompletionInLocalTime: true,
	taskCompletionShowUtcOffset: true,
};

export const TaskBoardIcon = "lucide-trello";

export default class TaskBoard extends Plugin {
	settings: GlobalSettings; // Use the GlobalSettings type here

	async onload() {
		console.log("TaskBoard: loading plugin");

		await this.loadSettings();

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

		// Add a command to open the BoardConfigModal
		this.addCommand({
			id: "open-kanban-config-modal",
			name: "Open Kanban Configuration Modal",
			callback: () => {
				this.openBoardConfigModal();
			},
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});

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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		// Calling a function based on any file change in the valut.
		this.registerEvent(
			this.app.vault.on("modify", (file: TFile) =>
				this.onFileChange(file)
			)
		);

		// Register the Kanban view
		this.registerView(
			VIEW_TYPE_TASKBOARD,
			(leaf) => new KanbanView(this, leaf)
		);

		// this.registerEvents();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Total # Tasks Pending");

		// following is the code from the documentation i have brought, which is kind of like Event Detection from Vault, like that i have to detect whether a new Checkbox have been added or not.
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				console.log("a new file has entered the arena");
			})
		);

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


	// Detecting any file change in the vault, TODO : Run th necessary function based on this.
	async onFileChange(file: TFile) {
		if (file.extension === "md") {
			console.log(`File modified: ${file.path}`);
		}
	}

	// Function to open the BoardConfigModal
	openBoardConfigModal() {
		const modal = new BoardConfigureModal(this.app); // Pass the app instance to the modal
		modal.open();
	}

	onunload() {
		console.log("unloading TaskBoard plugin");
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKBOARD);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
