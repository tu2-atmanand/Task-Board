// src/modals/BoardsExplorer.ts

import { t } from "i18next";
import { Modal, Notice } from "obsidian";
import TaskBoard from "../../main.js";
import { taskBoardFilesRegistryType } from "../interfaces/GlobalSettings.js";

export class BoardsExplorerModal extends Modal {
	private plugin: TaskBoard;
	private boardsRegistry: taskBoardFilesRegistryType;
	private onBoardSelect: (boardId: string, filePath: string) => void;
	private isScanning: boolean = false;

	constructor(
		plugin: TaskBoard,
		boardsRegistry: taskBoardFilesRegistryType,
		onBoardSelect: (boardId: string, filePath: string) => void,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.boardsRegistry = boardsRegistry;
		this.onBoardSelect = onBoardSelect;
		this.setTitle(t("boards-explorer"));
	}

	async onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute(
			"modal-type",
			"task-board-boards-explorer-modal",
		);

		const modalContent = contentEl.createDiv({
			cls: "boardsExplorerModalContent",
		});

		// Header section
		const headerSection = modalContent.createDiv({
			cls: "boardsExplorerHeader",
		});

		// headerSection.createEl("h2", {
		// 	text: t("your-boards"),
		// 	cls: "boardsExplorerHeaderTitle",
		// });

		const headerSecBottom = headerSection.createDiv({
			cls: "boardsExplorerHeaderBottom",
		});

		headerSecBottom.createEl("p", {
			text: "Click on a board to open it.",
			cls: "boardsExplorerHeaderDescription",
		});

		const scanButton = headerSecBottom.createEl("button", {
			text: t("refresh-boards"),
			cls: "boardsExplorerScanButton",
		});
		scanButton.addEventListener("click", () => {
			if (!this.isScanning) {
				void this.handleScanBoards(
					mainContent,
					headerSection,
					scanButton,
				);
			}
		});

		// Main content area - this will hold the board grid or empty state
		// Separating this makes it easy to refresh the content without redrawing the entire modal
		const mainContent = modalContent.createDiv({
			cls: "boardsExplorerMainContent",
		});

		// Initial render of board grid
		this.renderBoardGrid(mainContent);

		// // Footer section with buttons
		// const footerSection = modalContent.createDiv({
		// 	cls: "boardsExplorerFooter",
		// });

		// const closeButton = footerSection.createEl("button", {
		// 	text: t("close"),
		// 	cls: "boardsExplorerCloseButton",
		// });
		// closeButton.addEventListener("click", () => {
		// 	this.close();
		// });
	}

	private renderBoardGrid(container: HTMLElement): void {
		// Clear existing content
		container.empty();

		// Check if there are any boards
		const boardIds = Object.keys(this.boardsRegistry);

		if (boardIds.length === 0) {
			const emptyState = container.createDiv({
				cls: "boardsExplorerEmptyState",
			});

			emptyState.createEl("p", {
				text: "No boards found. Create a new board to get started.",
				cls: "boardsExplorerEmptyStateText",
			});
		} else {
			// Grid container for board cards
			const gridContainer = container.createDiv({
				cls: "boardsExplorerGrid",
			});

			// Create a card for each board
			boardIds.forEach((boardId) => {
				const board = this.boardsRegistry[boardId];

				const card = gridContainer.createDiv({
					cls: "boardsExplorerCard",
				});

				card.addEventListener("click", () => {
					void this.openBoard(boardId, board.filePath);
					this.close();
				});

				// Card header with board name
				const cardHeader = card.createDiv({
					cls: "boardsExplorerCardHeader",
				});

				cardHeader.createEl("h3", {
					text: board.boardName,
					cls: "boardsExplorerCardTitle",
				});

				// Card content with board details
				const cardContent = card.createDiv({
					cls: "boardsExplorerCardContent",
				});

				// Board description (if available)
				if (board.boardDescription && board.boardDescription.trim()) {
					cardContent.createEl("p", {
						text: board.boardDescription,
						cls: "boardsExplorerCardDescription",
					});
				}

				// Board ID
				const idRow = cardContent.createDiv({
					cls: "boardsExplorerCardRow",
				});

				idRow.createEl("span", {
					text: "Board ID:",
					cls: "boardsExplorerCardRowLabel",
				});

				idRow.createEl("span", {
					text: boardId,
					cls: "boardsExplorerCardRowValue",
				});

				// File path
				const pathRow = cardContent.createDiv({
					cls: "boardsExplorerCardRow",
				});

				pathRow.createEl("span", {
					text: t("file-path") + " : ",
					cls: "boardsExplorerCardRowLabel",
				});

				const pathValue = pathRow.createEl("span", {
					text: board.filePath,
					cls: "boardsExplorerCardRowValue boardsExplorerCardRowFilePath",
					attr: {
						title: board.filePath, // Full path on hover
					},
				});

				// Hover effect
				card.addEventListener("mouseenter", () => {
					card.addClass("boardsExplorerCardHover");
				});

				card.addEventListener("mouseleave", () => {
					card.removeClass("boardsExplorerCardHover");
				});
			});
		}
	}

	private async handleScanBoards(
		mainContent: HTMLElement,
		footerSection: HTMLElement,
		scanButton: HTMLElement,
	): Promise<void> {
		this.isScanning = true;
		(scanButton as HTMLButtonElement).disabled = true;

		// Create and show loading bar
		const loadingBar = this.createLoadingBar();
		footerSection.insertBefore(loadingBar, footerSection.firstChild);

		try {
			// Run the scan
			await this.plugin.taskBoardFileManager.scanAllTaskBoardFiles();

			// Update the registry from plugin settings
			this.boardsRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};

			// Re-render the board grid with updated data
			this.renderBoardGrid(mainContent);

			// Show success notification
			new Notice("Boards scanned successfully!");
		} catch (error) {
			console.error("Error scanning boards:", error);
			new Notice("Error scanning boards. Check console for details.");
		} finally {
			// Hide loading bar and re-enable button
			loadingBar.remove();
			(scanButton as HTMLButtonElement).disabled = false;
			this.isScanning = false;
		}
	}

	private createLoadingBar(): HTMLElement {
		const container = activeDocument.createElement("div");
		container.addClass("boardsExplorerLoadingBarContainer");
		const bar = activeDocument.createElement("div");
		bar.addClass("boardsExplorerLoadingBar");
		container.appendChild(bar);

		return container;
	}

	private async openBoard(boardId: string, filePath: string): Promise<void> {
		try {
			// Load the board data from disk
			const boardData =
				await this.plugin.taskBoardFileManager.loadBoardUsingPath(
					filePath,
				);

			if (!boardData) {
				new Notice(`Error loading board: ${boardId}`);
				return;
			}

			// Call the onBoardSelect callback to handle opening the board
			// This callback is responsible for opening the board in a view
			this.onBoardSelect(boardId, filePath);
		} catch (error) {
			console.error(`Error opening board ${boardId}:`, error);
			new Notice(`Error opening board. Check console for details.`);
		}
	}
}
