// src/views/KanbanView.tsx

import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { ScanVaultIcon, TaskBoardIcon } from "src/types/Icons";
import { StrictMode, useMemo } from "react";

import { Board } from "src/interfaces/BoardConfigs";
import KanbanBoard from "src/components/KanbanBoard";
import type TaskBoard from "../../main";
import { VIEW_TYPE_TASKBOARD } from "src/types/GlobalVariables";
import { loadBoardsData } from "src/utils/JsonFileOperations";
import { bugReporter, openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";

export class KanbanView extends ItemView {
	plugin: TaskBoard;
	boards: Board[];
	root: Root | null = null;

	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
		this.app = plugin.app;
		this.plugin = plugin;
		this.boards = [];
		this.icon = TaskBoardIcon;
	}

	getViewType() {
		return VIEW_TYPE_TASKBOARD;
	}

	getDisplayText() {
		return t("task-board");
	}

	getSettings() {
		return this.plugin.settings;
	}

	async onOpen() {
		this.addAction(ScanVaultIcon, t("scan-vault-window"), () => {
			openScanVaultModal(this.app, this.plugin);
		}).addClass("scan-vault-btn");

		if (localStorage.getItem("manadatoryScan") === "true") this.highlighgtScanvaultIcon();

		await this.loadBoards();
		this.renderBoard();
	}

	async highlighgtScanvaultIcon() {
		const scanVaultIcon = this.containerEl.querySelector(
			".scan-vault-btn"
		) as HTMLElement;
		if (scanVaultIcon) {
			scanVaultIcon.classList.add("highlight");
			setInterval(() => {
				scanVaultIcon.classList.toggle("highlight");
			}, 800); // Toggle highlight class every 500ms for blinking effect
		}
	}

	private async loadBoards() {
		try {
			this.boards = await loadBoardsData(this.plugin);
		} catch (err) {
			bugReporter(
				this.plugin,
				"Failed to load board configurations from data.json",
				String(err),
				"KanbanView.tsx/loadBoards"
			);
		}
	}

	private renderBoard() {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<StrictMode>
				<KanbanBoard
					app={this.app}
					plugin={this.plugin}
					boardConfigs={this.boards}
				/>,
			</StrictMode>,
		);
	}

	async onClose() {
		// Clean up when view is closed
		this.root?.unmount();
		this.plugin.leafIsActive = false;
		// onUnloadSave(this.plugin);
	}
}
