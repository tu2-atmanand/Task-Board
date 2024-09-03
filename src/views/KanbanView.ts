// src/views/KanbanView.ts

import { App, ItemView, WorkspaceLeaf, Vault } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client"; // Ensure this import is correct for React 18+
import KanbanBoard from "../components/KanbanBoard";
import TaskBoard from "../../main";

export const VIEW_TYPE_KANBAN = "kanban-view";

export class KanbanView extends ItemView {
	private vault: Vault;
	private plugin: TaskBoard;

	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
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
		const root = ReactDOM.createRoot(this.contentEl);
		// Pass the app instance to the KanbanBoard component
		root.render(<KanbanBoard app={this.plugin.app} />);

		// Optional: You can remove the task loading logic here if it's meant to be triggered by a button
	}

	async loadTasks() {
		// Scan markdown files and populate Kanban board with tasks
		console.log("Executing script to read all Todo Tasks Checkboxes");
	}

	async onClose() {
		// Cleanup if needed when the view is closed
		// ReactDOM.unmountComponentAtNode(this.contentEl);
	}
}
