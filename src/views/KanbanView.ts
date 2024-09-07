// src/views/KanbanView.ts

import { App, ItemView, WorkspaceLeaf } from "obsidian";
import {
	loadBoardsData,
	openConfigModal,
	saveBoardsData,
} from "../services/OpenColumnConfig";

import KanbanBoard from "../components/KanbanBoard";
import React from "react";
import ReactDOM from "react-dom/client";
import TaskBoard from "../../main";

export const VIEW_TYPE_KANBAN = "kanban-view";

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
		return VIEW_TYPE_KANBAN;
	}

	getDisplayText() {
		return "Kanban Board";
	}

	async onOpen() {
		this.addAction("search", "Re-Scan Vault", () => {
			openConfigModal(
				this.app,
				this.boards,
				this.activeBoardIndex,
				this.handleSaveBoards
			);
		});

		const root = ReactDOM.createRoot(this.contentEl);
		root.render(<KanbanBoard app={this.plugin.app} />);
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

// import ConfigModal from "src/components/BoardModal";
// import KanbanBoard from "../components/KanbanBoard";
// import React from "react";
// import ReactDOM from "react-dom/client"; // Ensure this import is correct for React 18+
// import TaskBoard from "../../main";

// export const VIEW_TYPE_KANBAN = "kanban-view";

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
// 		return VIEW_TYPE_KANBAN;
// 	}

// 	getDisplayText() {
// 		return "Kanban Board";
// 	}

// 	async onOpen() {
// 		// Add icon button to the view header
// 		this.addAction("gear", "Open Configure Window", () => {
// 			this.openConfigModal();
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

// 	// Function to open the ConfigModal
// 	openConfigModal() {
// 		const modal = new ConfigModal(this.app); // Pass the app instance to the modal
// 		modal.open();
// 	}
// }
