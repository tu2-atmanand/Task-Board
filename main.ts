
// main.ts  ---------  Before adding logic - WORKING

import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { KanbanView } from "./src/views/KanbanView";
import { VIEW_TYPE_KANBAN } from "./src/views/KanbanView";
import { TaskBoardSettingTab, GlobalSettings } from "./src/settings/TaskBoardSettingTab"; // Import the settings
import ConfigModal from "src/components/BoardModal";
import { AddTaskModal } from "src/components/AddTaskModal";

// Import required modules
import fs from "fs";
import path from "path";

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

export default class TaskBoard extends Plugin {
	settings: GlobalSettings; // Use the GlobalSettings type here

	async onload() {
		console.log("TaskBoard: loading plugin");

		await this.loadSettings();

		// const files = this.app.vault.getMarkdownFiles();
		// console.log(files);

		// Create a ribbon icon to open the Kanban board view
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Open Kanban Board",
			() => {
				this.app.workspace
					.getLeaf(true)
					.setViewState({ type: "kanban-view", active: true });
			}
		);
		ribbonIconEl.addClass("Task-Board-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Total # Tasks Pending");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open Kanban Board POP UP",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});

		// Add a command to open the ConfigModal
		this.addCommand({
			id: "open-kanban-config-modal",
			name: "Open Kanban Configuration Modal",
			callback: () => {
				this.openConfigModal();
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
							console.log("Task added successfully!");
						},
					}).open();
				} else {
					new Notice("No active file found to add a task.");
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TaskBoardSettingTab(this.app, this));

		// const files = this.app.vault.getMarkdownFiles();
		// console.log(files);

		this.registerEvent(
			this.app.vault.on("modify", (file: TFile) =>
				this.onFileChange(file)
			)
		);

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });

		// Register the Kanban view
		this.registerView(
			VIEW_TYPE_KANBAN,
			(leaf) => new KanbanView(this, leaf)
		);

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
	}

	async onFileChange(file: TFile) {
		if (file.extension === "md") {
			console.log(`File modified: ${file.path}`);
		}
	}

	// Function to open the ConfigModal
	openConfigModal() {
		const modal = new ConfigModal(this.app); // Pass the app instance to the modal
		modal.open();
	}

	onunload() {
		console.log("unloading TaskBoard plugin");
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_KANBAN);
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
