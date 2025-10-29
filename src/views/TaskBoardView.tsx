// src/views/TaskBoardView.tsx

import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { RefreshIcon, ScanVaultIcon, TaskBoardIcon } from "src/interfaces/Icons";
import { StrictMode } from "react";

import { Board } from "src/interfaces/BoardConfigs";
import TaskBoardViewContent from "src/components/TaskBoardViewContent";
import type TaskBoard from "../../main";
import { PENDING_SCAN_FILE_STACK, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { loadBoardsData } from "src/utils/JsonFileOperations";
import { bugReporter, openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";
import { eventEmitter } from "src/services/EventEmitter";

export class TaskBoardView extends ItemView {
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
		if (Platform.isMobile) {
			console.log("Adding new icon...");
			this.addAction(RefreshIcon, t("refresh-board-button"), async () => {
				const fileStackString = localStorage.getItem(PENDING_SCAN_FILE_STACK);
				const fileStack = fileStackString ? JSON.parse(fileStackString) : null;

				if (fileStack && fileStack.length > 0) {
					await this.plugin.realTimeScanning.processAllUpdatedFiles();
				}
				eventEmitter.emit("REFRESH_BOARD");
			}).addClass("taskboardRefreshBtn");
		}

		const mandatoryScanSignal = localStorage.getItem("manadatoryScan") === "true";

		if (!Platform.isMobile || mandatoryScanSignal) {
			this.addAction(ScanVaultIcon, t("scan-vault-modal"), () => {
				openScanVaultModal(this.app, this.plugin);
			}).addClass("taskboardScanVaultBtn");
		}

		if (mandatoryScanSignal) this.highlighgtScanvaultIcon();

		await this.loadBoards();
		this.renderBoard();
	}

	async highlighgtScanvaultIcon() {
		const scanVaultIcon = this.containerEl.querySelector(
			".taskboardScanVaultBtn"
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
				"TaskBoardView.tsx/loadBoards"
			);
		}
	}

	private renderBoard() {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<StrictMode>
				<TaskBoardViewContent
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
