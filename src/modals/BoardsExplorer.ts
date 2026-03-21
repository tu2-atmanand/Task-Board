// src/modals/BoardsExplorer.ts

import type TaskBoard from "main";
import { Modal, Notice } from "obsidian";
import { taskBoardFilesRegistryType } from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";

export class BoardsExplorerModal extends Modal {
	private plugin: TaskBoard;
	private boardsRegistry: taskBoardFilesRegistryType;
	private onBoardSelect: (boardId: string, boardName: string) => void;
	private isScanning: boolean = false;

	constructor(
		plugin: TaskBoard,
		boardsRegistry: taskBoardFilesRegistryType,
		onBoardSelect: (boardId: string, boardName: string) => void,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.boardsRegistry = boardsRegistry;
		this.onBoardSelect = onBoardSelect;
		this.setTitle(t("boards-explorer-modal"));
	}

	async onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "boards-explorer-modal");

		const modalContent = contentEl.createDiv({
			cls: "boardsExplorerModalContent",
		});

		// Header section
		const headerSection = modalContent.createDiv({
			cls: "boardsExplorerHeader",
		});

		headerSection.createEl("h2", {
			text: t("your-boards"),
			cls: "boardsExplorerHeaderTitle",
		});

		headerSection.createEl("p", {
			text: "Select a board to view or manage it",
			cls: "boardsExplorerHeaderDescription",
		});

		// Main content area - this will hold the board grid or empty state
		// Separating this makes it easy to refresh the content without redrawing the entire modal
		const mainContent = modalContent.createDiv({
			cls: "boardsExplorerMainContent",
		});

		// Initial render of board grid
		this.renderBoardGrid(mainContent);

		// Footer section with buttons
		const footerSection = modalContent.createDiv({
			cls: "boardsExplorerFooter",
		});

		// Button container for horizontal layout
		const buttonContainer = footerSection.createDiv({
			cls: "boardsExplorerButtonContainer",
		});

		const scanButton = footerSection.createEl("button", {
			text: "Scan boards",
			cls: "boardsExplorerScanButton",
		});

		const closeButton = footerSection.createEl("button", {
			text: "Close",
			cls: "boardsExplorerCloseButton",
		});

		scanButton.addEventListener("click", async () => {
			if (!this.isScanning) {
				await this.handleScanBoards(mainContent, footerSection, scanButton);
			}
		});

		closeButton.addEventListener("click", () => {
			this.close();
		});
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

				// Make card clickable
				card.style.cursor = "pointer";
				card.addEventListener("click", async () => {
					await this.openBoard(boardId, board.filePath);
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
					text: "File Path:",
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
		const container = document.createElement("div");
		container.className = "boardsExplorerLoadingBarContainer";

		const style = document.createElement("style");
		style.textContent = `
			.boardsExplorerLoadingBarContainer {
				width: calc(100% + 40px);
				margin: 0 -20px 12px -20px;
				padding: 0 20px;
				overflow: hidden;
			}

			.boardsExplorerLoadingBar {
				width: 100%;
				height: 4px;
				background: linear-gradient(
					90deg,
					#0066cc 0%,
					#0066cc 20%,
					transparent 20%,
					transparent 40%,
					#0066cc 40%,
					#0066cc 60%,
					transparent 60%,
					transparent 80%,
					#0066cc 80%,
					#0066cc 100%
				);
				background-size: 100px 4px;
				animation: boardsExplorerLoadingPendulum 2s ease-in-out infinite;
				border-radius: 2px;
			}

			@keyframes boardsExplorerLoadingPendulum {
				0% {
					background-position: -100px 0;
				}
				50% {
					background-position: calc(100% + 100px) 0;
				}
				100% {
					background-position: -100px 0;
				}
			}
		`;

		container.appendChild(style);

		const bar = document.createElement("div");
		bar.className = "boardsExplorerLoadingBar";

		container.appendChild(bar);

		return container;
	}

	private async openBoard(boardId: string, filePath: string): Promise<void> {
		try {
			// Load the board data from disk
			const boardData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(filePath);

			if (!boardData) {
				new Notice(`Error loading board: ${boardId}`);
				return;
			}

			// Call the onBoardSelect callback to handle opening the board
			// This callback is responsible for opening the board in a view
			this.onBoardSelect(boardId, boardData.name);
		} catch (error) {
			console.error(`Error opening board ${boardId}:`, error);
			new Notice(`Error opening board. Check console for details.`);
		}
	}
}
