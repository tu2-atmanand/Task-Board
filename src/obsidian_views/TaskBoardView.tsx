// src/views/TaskBoardView.tsx

import { ItemView, Platform, WorkspaceLeaf, ViewStateResult, Notice, Menu, TFolder } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { funnelIcon, RefreshIcon, ScanVaultIcon, TaskBoardIcon } from "src/interfaces/Icons";
import { StrictMode } from "react";

import { Board, DEFAULT_BOARD } from "src/interfaces/BoardConfigs";
import TaskBoardViewContainer from "src/components/TaskBoardViewContainer";
import type TaskBoard from "../../main";
import { MANDATORY_SCAN_KEY, PENDING_SCAN_FILE_STACK, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { openBoardsExplorerModal, openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";
import { eventEmitter } from "src/services/EventEmitter";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";

export class TaskBoardView extends ItemView {
	plugin: TaskBoard;
	leaf: WorkspaceLeaf;
	root: Root | null = null;
	private currentFilePath: string = "";
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
		console.log("Running getState...");
		console.log("Value of currentFilePath : ", this.currentFilePath);
		// Save the current filePath to the workspace state
		return {
			...super.getState(),
			filePath: this.currentFilePath ?? "",
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
		console.log(`Running setState...`);
		const { filePath } = state;

		// Check if a specific .taskboard file was clicked from File Navigator
		const clickedFilePath = (this.leaf as any).taskboardFilePath as string | undefined;
		if (clickedFilePath && typeof clickedFilePath === 'string' && clickedFilePath.endsWith('.taskboard')) {
			// Load and render the clicked file
			const clickedFileData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(clickedFilePath);
			if (clickedFileData) {
				this.currentFilePath = clickedFilePath;
				state = {
					...state,
					filePath: this.currentFilePath
				};
				this.renderBoard(clickedFileData);
			} else {
				bugReporterManagerInsatance.showNotice(183, `There was an issue with opening the task board file : ${clickedFilePath}`, "clickedFileData is undefined", "TaskBoardView.tsx/onOpen");
			}
		} else {
			if (filePath && typeof filePath === "string") {
				// This will run when an in-active (deffered) leaf will come in focus. Specially happen when Obsidian is opened again and the Task Board leaf was brought in focus.
				const boardData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(
					filePath
				);
				if (boardData) {
					this.currentFilePath = filePath;
					state = {
						...state,
						filePath: this.currentFilePath
					};
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
			else {
				// This will run when user has clicked on the Ribbon icon or running the "Open task board" command.
				// We need to get the last opened board.
				const lastViewedBoardData = await this.plugin.taskBoardFileManager.getLastOpenedBoard();
				if (lastViewedBoardData) {
					// Get the filePath from the registry
					const taskBoardFilesRegistry = this.plugin.settings.data.taskBoardFilesRegistry || {};
					const registryEntries = Object.values(taskBoardFilesRegistry);

					if (registryEntries.length > 0) {
						const firstItemFromRegistry = registryEntries[0];
						if (firstItemFromRegistry.filePath) {
							this.currentFilePath = firstItemFromRegistry.filePath;
							state.filePath = {
								...state.state,
								filePath: this.currentFilePath
							};
						}
					}

					this.renderBoard(lastViewedBoardData);
				} else {
					this.renderNoBoard();
					bugReporterManagerInsatance.addToLogs(185, "There was an issue with opening the last viewed board. lastViewedBoardData is undefined", "TaskBoardView.tsx/onOpen");
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

		const mandatoryScanSignal = localStorage.getItem(MANDATORY_SCAN_KEY) === "true";

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

		// Render custom view header with file path
		this.renderCustomViewHeader();

		// Signal the workspace to save the updated layout state
		this.app.workspace.requestSaveLayout();
	}

	/**
	 * Renders a custom view header with clickable file path elements that highlight folders in the File Navigator.
	 */
	private renderCustomViewHeader() {
		// Find the view header title container
		const leafEl = this.containerEl.closest('.workspace-leaf');
		if (!leafEl) return;

		const viewHeader = leafEl.querySelector('.view-header');
		if (!viewHeader) return;

		const titleContainer = viewHeader.querySelector('.view-header-title-container');
		if (!titleContainer) return;

		// Clear existing content
		titleContainer.empty();

		// If no file path, show default text
		if (!this.currentFilePath) {
			titleContainer.createSpan({ text: this.boardName });
			return;
		}

		// Parse the file path
		const pathParts = this.currentFilePath.split('/');
		const fileName = pathParts.pop() || '';
		const folderParts = pathParts;

		// Create path elements
		let currentPath = '';

		// Add root if path starts with /
		if (this.currentFilePath.startsWith('/')) {
			const rootSpan = titleContainer.createSpan({ text: '/', cls: 'taskboard-path-root' });
			rootSpan.addEventListener('click', () => {
				// Reveal root folder
				const rootFolder = this.app.vault.getRoot();
				this.revealFolderInFileExplorer(rootFolder);
			});
			currentPath = '/';
		}

		// Add folder parts
		folderParts.forEach((part, index) => {
			if (part) {
				currentPath += part;
				const folderSpan = titleContainer.createSpan({ text: part, cls: 'taskboard-path-folder' });
				folderSpan.addEventListener('click', () => {
					const folder = this.app.vault.getAbstractFileByPath(currentPath) as TFolder;
					if (folder) {
						this.revealFolderInFileExplorer(folder);
					}
				});

				// Add separator
				if (index < folderParts.length - 1 || fileName) {
					titleContainer.createSpan({ text: '/', cls: 'taskboard-path-separator' });
				}
				currentPath += '/';
			}
		});

		// Add file name
		if (fileName) {
			const fileSpan = titleContainer.createSpan({ text: fileName, cls: 'taskboard-path-file' });
			// File click could open the file, but since it's already open, maybe no action
		}
	}

	/**
	 * Reveals a folder in the file explorer by setting it as active.
	 */
	private revealFolderInFileExplorer(folder: TFolder) {
		const fileExplorerLeaves = this.app.workspace.getLeavesOfType('file-explorer');
		fileExplorerLeaves.forEach(leaf => {
			const view = leaf.view as any;
			if (view.setActiveFolder) {
				view.setActiveFolder(folder);
			}
		});
	}

	/**
	 * This function will render a message to the user when there is no board to show in the view. This can happen when user opens the view for the first time and there is no board created, or when there is an issue with loading the board data. 
	 * Will show a button to create a new board and to scan the vault when there is no board found.
	 **/
	private renderNoBoard() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty(); // Clear any previous content

		// Reset view header
		this.renderCustomViewHeader();

		const wrapper = container.createDiv({ cls: "taskboard-no-board-wrapper" });

		const content = wrapper.createDiv({ cls: "taskboard-no-board-container" });

		// Main message
		content.createEl("h2", {
			text: t("no-board-found"),
			cls: "taskboard-no-board-title",
		});

		// Detailed description
		const description = content.createEl("p", {
			cls: "taskboard-no-board-description",
		});
		description.innerHTML = t("no-boards-found-description");

		// Action buttons
		const buttonContainer = content.createDiv({
			cls: "taskboard-no-board-buttons",
		});

		// Create template board button
		const createBtn = buttonContainer.createEl("button", {
			text: t("create-template-board") || "Create Template Board",
			cls: "taskboard-no-board-create-btn",
			attr: {
				"aria-label": t("create-template-board"),
			},
		});
		createBtn.addEventListener("click", () => {
			this.handleCreateTemplateBoard();
		});

		// Scan vault button
		const scanBtn = buttonContainer.createEl("button", {
			text: t("scan-vault-modal") || "Scan Vault",
			cls: "taskboard-no-board-scan-btn",
			attr: {
				"aria-label": t("scan-vault-modal"),
			},
		});
		scanBtn.addEventListener("click", () => {
			openBoardsExplorerModal(this.plugin);
		});
	}

	/**
	 * Creates a new template board from DEFAULT_BOARD, saves it to disk, and renders it in the current view.
	 * Generates a unique ID and file path for the new board.
	 */
	private async handleCreateTemplateBoard() {
		try {
			// Generate unique ID and filename for the new template board
			const boardId = generateRandomTempTaskId();
			const timestamp = new Date().getTime();
			const filePath = `TaskBoard-Template-${timestamp}.taskboard`;

			// Create a deep copy of DEFAULT_BOARD and update its properties
			const newBoard: Board = JSON.parse(JSON.stringify(DEFAULT_BOARD));
			newBoard.id = boardId;

			// Save the board to disk
			const saveSuccess = await this.plugin.taskBoardFileManager.createNewBoardFile(
				filePath,
				newBoard,
			);

			if (!saveSuccess) {
				bugReporterManagerInsatance.showNotice(
					187,
					"Failed to create template board",
					"saveBoardToDisk returned false",
					"TaskBoardView.tsx/handleCreateTemplateBoard",
				);
				return;
			}

			// Update current file path
			this.currentFilePath = filePath;

			// Show success notice
			new Notice(t("board-created-successfully") || "Template board created successfully!");

			// Render the newly created board
			this.renderBoard(newBoard);

		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				187,
				"Error creating template board",
				String(error),
				"TaskBoardView.tsx/handleCreateTemplateBoard",
			);
		}
	}

	async onClose() {
		// Clean up when view is closed
		this.root?.unmount();
		this.plugin.leafIsActive = false;
		// onUnloadSave(this.plugin);
	}
}
