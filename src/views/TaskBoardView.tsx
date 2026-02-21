// src/views/TaskBoardView.tsx

import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { RefreshIcon, ScanVaultIcon, TaskBoardIcon } from "src/interfaces/Icons";
import { StrictMode } from "react";

import { Board } from "src/interfaces/BoardConfigs";
import TaskBoardViewContent from "src/components/TaskBoardViewContent";
import type TaskBoard from "../../main";
import { PENDING_SCAN_FILE_STACK, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";
import { eventEmitter } from "src/services/EventEmitter";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

export class TaskBoardView extends ItemView {
	plugin: TaskBoard;
	leaf: WorkspaceLeaf;
	// boards: Board[];
	root: Root | null = null;

	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
		this.leaf = leaf;
		this.app = plugin.app;
		this.plugin = plugin;
		// this.boards = [];
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
			this.addAction(RefreshIcon, t("refresh-board-button"), async () => {
				const fileStackString = localStorage.getItem(PENDING_SCAN_FILE_STACK);
				const fileStack = fileStackString ? JSON.parse(fileStackString) : null;

				if (fileStack && fileStack.length > 0) {
					await this.plugin.realTimeScanner.processAllUpdatedFiles();
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

		if (this.plugin.settings.data.loadAllBoards) {
			// All boards data will be loaded based on user configuration
			let allBoardsData = await this.plugin.taskBoardFileManager.getAllBoards();

		} else {
			// Here we shall handle essentially three cases of opening this view : 
			// 1. When the board file is clicked from file-navigator.
			// 2. When the leaf changes from in-active state to active state.
			// 3. When the plugin ribbon icon is clicked.
			const leafID = this.leaf?.id;
			console.log("Leaf ID : ", leafID);

			const clickedFilePath = (this.leaf as any).taskboardFilePath as string | undefined;
			console.log("TaskBoardView.tsx : clickedFilePath from leaf:", clickedFilePath);
			let clickedFileData: Board | undefined;
			if (clickedFilePath && typeof clickedFilePath === 'string' && clickedFilePath.endsWith('.taskboard')) {
				// Check if a specific .taskboard file was clicked from File Navigator
				// First check the leaf instance directly (set by monkey patch)
				clickedFileData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(clickedFilePath);
				if (clickedFileData)
					this.renderBoard(clickedFileData, undefined);
				else
					bugReporterManagerInsatance.showNotice(183, `There was an issue with opening the task board file : ${clickedFilePath}`, "clickedFileData is undefined", "TaskBoardView.tsx/onOpen");

				this.plugin.taskBoardFileManager.setFilepathToLeafID(leafID, clickedFilePath);
			} else {
				// First lets check if this leafID already exists in localStorage
				const filePath = await this.plugin.taskBoardFileManager.getFilepathFromLeafID(leafID);
				if (filePath) {
					const lastViewedBoardData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(filePath || "");
					if (lastViewedBoardData)
						this.renderBoard(lastViewedBoardData, undefined);
					else
						bugReporterManagerInsatance.showNotice(184, `There was an issue with opening the task board file : ${filePath}`, "lastViewedBoardData is undefined", "TaskBoardView.tsx/onOpen");

					// } else if (filePath === undefined) {
					// 	bugReporterManagerInsatance.showNotice(186, `There was some issue while fetching the filepath from localStorage for the following leafID : ${leafID}`, "filePath is undefined", "TaskBoardView.tsx/onOpen");
				} else {
					// In this case, mostly user is opening the leaf from the ribbon icon
					// Show last viewed board
					const lastViewedBoardData = await this.plugin.taskBoardFileManager.getLastOpenedBoard();
					if (lastViewedBoardData)
						this.renderBoard(lastViewedBoardData, undefined);
					else
						bugReporterManagerInsatance.showNotice(185, `There was an issue with opening the last viewed board by user`, "lastViewedBoardData is undefined", "TaskBoardView.tsx/onOpen");
				}
			}
		}
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

	// private async loadBoards() {
	// 	try {
	// 		this.boards = await loadBoardsData(this.plugin);
	// 	} catch (err) {
	// 		bugReporterManagerInsatance.showNotice(
	// 			89,
	// 			"Failed to load board configurations from data.json",
	// 			String(err),
	// 			"TaskBoardView.tsx/loadBoards"
	// 		);
	// 	}
	// }

	private renderBoard(currentBoardData: Board, allBoardsData?: Board[] | undefined) {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<StrictMode>
				<TaskBoardViewContent
					plugin={this.plugin}
					allBoards={allBoardsData}
					currentBoardData={currentBoardData}
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
