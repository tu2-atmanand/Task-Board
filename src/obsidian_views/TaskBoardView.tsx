// src/views/TaskBoardView.tsx

import { ItemView, Platform, WorkspaceLeaf, ViewStateResult, Notice, Menu } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { funnelIcon, RefreshIcon, ScanVaultIcon, TaskBoardIcon } from "src/interfaces/Icons";
import { StrictMode } from "react";

import { Board } from "src/interfaces/BoardConfigs";
import TaskBoardViewContainer from "src/components/TaskBoardViewContainer";
import type TaskBoard from "../../main";
import { PENDING_SCAN_FILE_STACK, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";
import { eventEmitter } from "src/services/EventEmitter";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

export class TaskBoardView extends ItemView {
	plugin: TaskBoard;
	leaf: WorkspaceLeaf;
	root: Root | null = null;
	private currentFilePath: string | undefined = undefined;
	boardName: string = "No Board Loaded";

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
		return this.boardName;
	}

	onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string): void {
		if (source === "more-options") {
			menu.addItem((item) => {
				item.setTitle(t("quick-actions"));
				item.setIsLabel(true);
			});
			menu.addItem((item) => {
				item.setTitle(t("refresh-the-board"));
				item.setIcon("rotate-cw");
				item.onClick(async () => {
					// refreshBoardButton();
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("show-hide-properties"));
				item.setIcon("list");
				item.onClick(async () => {
					// handlePropertiesBtnClick(event);
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("open-board-filters-modal"));
				item.setIcon(funnelIcon);
				item.onClick(async () => {
					// handleFilterButtonClick(event);
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("open-board-configuration-modal"));
				item.setIcon("settings");
				item.onClick(async () => {
					// openBoardConfigModal(plugin, currentBoardData, (updatedBoard: Board) => {
					// 	// handleUpdateBoards(plugin, updatedBoards, setCurrentBoardData)
					// 	// setCurrentBoardData(updatedBoard);
					// 	this.plugin.taskBoardFileManager.saveBoard(updatedBoard);
					// })
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("scan-vault-modal"));
				item.setIcon(ScanVaultIcon);
				item.onClick(async () => {
					openScanVaultModal(this.plugin);
				});
			});


			// DEPRECATED : As we are moving the view switching options to the ribbon menu, we will remove these options from the pane menu to avoid confusion for users.
			// menu.addItem((item) => {
			// 	item.setTitle(t("view-type"));
			// 	item.setIsLabel(true);
			// });
			// menu.addItem((item) => {
			// 	item.setTitle(t("kanban-view"));
			// 	item.setIcon("square-kanban");
			// 	item.onClick(async () => {
			// 		eventEmitter.emit("SWITCH_VIEW", 'kanban');
			// 	});
			// });
			// menu.addItem((item) => {
			// 	item.setTitle(t("map-view"));
			// 	item.setIcon("network");
			// 	item.onClick(async () => {
			// 		eventEmitter.emit("SWITCH_VIEW", 'map');
			// 	});
			// });
		}
	}

	/**
	 * This is called by Obsidian when the layout is about to be save its state/layout.
	 * @returns The state data to be stored inside the workspace.json file inside the
	 * Obsidian's config folder. (.obsidian/workspace.json)
	 */
	getState() {
		// Save the current filePath to the workspace state
		return {
			...super.getState(),
			...(this.currentFilePath ? { filePath: this.currentFilePath } : {}),
		};
	}

	/**
	 * This setState is always called after the onOpen function has finished its work by Obsidian.
	 * If the leaf was saved by Obsidian in its workspace.json file previosly,
	 * we can get the data in this function through the state param.
	 * @param state 
	 * @param result 
	 */
	async setState(state: any, result: ViewStateResult): Promise<void> {
		const { filePath } = state;
		console.log(`Running setState for filepath :${filePath}`);

		// Check if a specific .taskboard file was clicked from File Navigator
		const clickedFilePath = (this.leaf as any).taskboardFilePath as string | undefined;
		if (clickedFilePath && typeof clickedFilePath === 'string' && clickedFilePath.endsWith('.taskboard')) {
			// Load and render the clicked file
			const clickedFileData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(clickedFilePath);
			if (clickedFileData) {
				this.currentFilePath = clickedFilePath;
				this.renderBoard(clickedFileData);
			} else {
				bugReporterManagerInsatance.showNotice(183, `There was an issue with opening the task board file : ${clickedFilePath}`, "clickedFileData is undefined", "TaskBoardView.tsx/onOpen");
			}
		} else {
			// In this case, mostly user is opening the leaf from the ribbon icon
			// Show last viewed board or the board from the filePath in the state if it exists
			// Check if the board was already loaded by setState() when workspace was restored
			// if (this.currentFilePath) {
			if (filePath && typeof filePath === "string") {
				// Use the filePath from saved state to load and render the board
				const boardData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(
					filePath
				);
				if (boardData) {
					this.currentFilePath = filePath;
					this.renderBoard(boardData);
				} else {
					bugReporterManagerInsatance.showNotice(
						183,
						`There was an issue with opening the task board file : ${filePath}`,
						"boardData is undefined",
						"TaskBoardView.tsx/setState"
					);
				}
			}
			// }
			else {
				const lastViewedBoardData = await this.plugin.taskBoardFileManager.getLastOpenedBoard();
				if (lastViewedBoardData) {
					// Get the filePath from the registry
					const taskBoardFilesRegistry = this.plugin.settings.data.taskBoardFilesRegistry || {};
					const registryEntries = Object.entries(taskBoardFilesRegistry)
						.filter(([key]) => isNaN(Number(key)))
						.slice(0, 1);

					if (registryEntries.length > 0) {
						const [, firstItemFromRegistry] = registryEntries[0];
						if (firstItemFromRegistry?.filePath) {
							this.currentFilePath = firstItemFromRegistry.filePath;
						}
					}

					this.renderBoard(lastViewedBoardData);
				} else {
					this.renderNoBoard();
					bugReporterManagerInsatance.showNotice(185, `There was an issue with opening the last viewed board by user`, "lastViewedBoardData is undefined", "TaskBoardView.tsx/onOpen");
				}

			}
		}

		await super.setState(state, result);
	}

	/**
	 * This function is ran by Obsidian, whenever a new leaf is created or
	 * an in-active leaf is brough to life.
	 */
	async onOpen() {
		console.log("Running onOpen...");
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
				openScanVaultModal(this.plugin);
			}).addClass("taskboardScanVaultBtn");
		}

		if (mandatoryScanSignal) this.highlighgtScanvaultIcon();
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

	private renderBoard(currentBoardData: Board) {
		this.boardName = currentBoardData.name || "Unnamed Board";
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<StrictMode>
				<TaskBoardViewContainer
					plugin={this.plugin}
					currentBoardData={currentBoardData}
					currentLeaf={this.leaf}
				/>
			</StrictMode>
		);

		// Signal the workspace to save the updated layout state
		this.app.workspace.requestSaveLayout();
	}

	/**
	 * This function will render a message to the user when there is no board to show in the view. This can happen when user opens the view for the first time and there is no board created, or when there is an issue with loading the board data. 
	 * Will show a button to create a new board when there is no board found.
	 * @todo
	 **/
	private renderNoBoard() {
		this.containerEl.createEl("h2", {
			text: t("no-board-found"),
			cls: "taskboard-no-board-message",
		});
	}

	async onClose() {
		// Clean up when view is closed
		this.root?.unmount();
		this.plugin.leafIsActive = false;
		// onUnloadSave(this.plugin);
	}
}
