// src/views/KanbanView.ts

import { App, ItemView, Vault, WorkspaceLeaf } from "obsidian";
import {
	loadBoardsData,
	openBoardConfigModal,
	openReScanVaultModal,
	saveBoardsData,
} from "../services/OpenColumnConfig";

import { Board } from "src/interfaces/KanbanBoard";
import KanbanBoard from "../components/KanbanBoard";
import { ReScanVaultModal } from "src/modal/ReScanVaultModal";
import React from "react";
import ReactDOM from "react-dom/client";
import TaskBoard from "../../main";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/TaskBoardGlobalValues";

export class KanbanView extends ItemView {
	private vault: Vault;
	private plugin: TaskBoard;
	private boards: Board[] = [];
	private activeBoardIndex: number = 0;

	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
		this.app = plugin.app;
		this.plugin = plugin;
		this.vault = plugin.app.vault;
	}

	getViewType() {
		return VIEW_TYPE_TASKBOARD;
	}

	getDisplayText() {
		return "Task Board";
	}

	getSettings() {
		return this.plugin.settings;
	}

	async onOpen() {
		this.addAction("lucide-scan-text", "Re-Scan Vault", () => {
			// openBoardConfigModal(
			// 	this.app,
			// 	this.boards,
			// 	this.activeBoardIndex,
			// 	this.handleSaveBoards
			// );
			openReScanVaultModal(this.app);
		});

		console.log("The Settings which i have loaded using Obsidian : ", this.getSettings());

		const root = ReactDOM.createRoot(this.contentEl); // Correct element reference
		root.render(<KanbanBoard app={this.app} />); // Use 'this.app' here
		await this.loadBoards();
	}

	private async loadBoards() {
		try {
			this.boards = await loadBoardsData();
		} catch (err) {
			console.error("Failed to load boards data:", err);
		}
	}

	private handleSaveBoards = (updatedBoards: Board[]) => {
		this.boards = updatedBoards;
		saveBoardsData(updatedBoards);
	};

	async onClose() {
		// Clean up when view is closed
	}
}









// // src/views/KanbanView.ts   ----- Wokring - V2

// import { App, ItemView, Vault, Workspace, WorkspaceLeaf } from "obsidian";

// import BoardConfigModal from "src/components/BoardConfigureModal";
// import KanbanBoard from "../components/KanbanBoard";
// import React from "react";
// import ReactDOM from "react-dom/client"; // Ensure this import is correct for React 18+
// import TaskBoard from "../../main";

// export const VIEW_TYPE_TASKBOARD = "task-board-view";

// export class KanbanView extends ItemView {
// 	private vault: Vault;
// 	private plugin: TaskBoard;

// 	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
// 		super(leaf);
// 		this.app = plugin.app;
// 		this.plugin = plugin;
// 		this.vault = plugin.app.vault;
// 	}

// 	getViewType() {
// 		return VIEW_TYPE_TASKBOARD;
// 	}

// 	getDisplayText() {
// 		return "Kanban Board";
// 	}

// 	async onOpen() {
// 		// Add icon button to the view header
// 		this.addAction("gear", "Open Configure Window", () => {
// 			this.openBoardConfigModal();
// 		});

// 		this.addAction("plus-circle", "Add New Task", () => {
// 			// main.ts
// 			// const MY_COMMAND_ID = "task-board:open-add-task-modal";
// 			// this.app.commands.executeCommandById(MY_COMMAND_ID);
// 		});

// 		const root = ReactDOM.createRoot(this.contentEl);
// 		// Pass the app instance to the KanbanBoard component
// 		root.render(<KanbanBoard app={this.plugin.app} />);

// 		// Optional: You can remove the task loading logic here if it's meant to be triggered by a button
// 	}

// 	async loadTasks() {
// 		// Scan markdown files and populate Kanban board with tasks
// 		console.log("Executing script to read all Todo Tasks Checkboxes");
// 	}

// 	async onClose() {
// 		// Cleanup if needed when the view is closed
// 		// ReactDOM.unmountComponentAtNode(this.contentEl);
// 	}

// 	// Function to open the BoardConfigModal
// 	openBoardConfigModal() {
// 		const modal = new BoardConfigModal(this.app); // Pass the app instance to the modal
// 		modal.open();
// 	}
// }
