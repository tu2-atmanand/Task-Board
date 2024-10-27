// src/views/KanbanView.ts

import { App, ItemView, Vault, WorkspaceLeaf } from "obsidian";

import { Board } from "src/interfaces/BoardConfigs";
import KanbanBoard from "src/components/KanbanBoard";
import { ReScanVaultIcon } from "src/types/Icons";
import ReactDOM from "react-dom/client";
import type TaskBoard from "../../main";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/GlobalVariables";
import { eventEmitter } from "src/services/EventEmitter";
import { loadBoardsData } from "src/utils/JsonFileOperations";
import { openReScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";

export class KanbanView extends ItemView {
	plugin: TaskBoard;
	private boards: Board[];
	private activeBoardIndex: number = 0;
	private root: ReactDOM.Root;

	constructor(app: App, plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
		this.app = app;
		this.plugin = plugin;
		this.root = ReactDOM.createRoot(this.contentEl);
		this.boards = [];
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
		this.addAction(ReScanVaultIcon, t(5), () => {
			// openBoardConfigModal(
			// 	this.app,
			// 	this.boards,
			// 	this.activeBoardIndex,
			// 	this.handleSaveBoards
			// );
			openReScanVaultModal(this.app, this.plugin);
		});

		// console.log(
		// 	"KanbanView : The Settings which i have loaded using Obsidian : ",
		// 	this.getSettings()
		// );

		// this.root = ReactDOM.createRoot(this.contentEl); // Store root reference
		await this.loadBoards();
		this.renderBoard();

		// eventEmitter.on("REFRESH_COLUMN", this.renderBoard);
	}

	private async loadBoards() {
		try {
			this.boards = await loadBoardsData(this.plugin);
		} catch (err) {
			console.error("Failed to load boards data:", err);
		}
	}

	private renderBoard() {
		// this.root.unmount();
		this.root.render(
			<KanbanBoard
				app={this.app}
				plugin={this.plugin}
				boardConfigs={this.boards}
			/>
		);
	}

	// public refreshBoard() {
	// 	this.renderBoard(); // Re-render the KanbanBoard
	// }

	async onClose() {
		// Clean up when view is closed
		this.root.unmount();
		// eventEmitter.off("REFRESH_COLUMN", this.loadBoards);
	}
}
