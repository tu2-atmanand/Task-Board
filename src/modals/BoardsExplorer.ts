// src/modals/BoardsExplorer.ts

import type TaskBoard from "main";
import { Modal } from "obsidian";
import { taskBoardFilesRegistryType } from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";

export class BoardsExplorerModal extends Modal {
	private plugin: TaskBoard;
	private boardsRegistry: taskBoardFilesRegistryType;
	private onBoardSelect: (boardId: string, boardName: string) => void;

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

		// Check if there are any boards
		const boardIds = Object.keys(this.boardsRegistry);

		if (boardIds.length === 0) {
			const emptyState = modalContent.createDiv({
				cls: "boardsExplorerEmptyState",
			});

			emptyState.createEl("p", {
				text: "No boards found. Create a new board to get started.",
				cls: "boardsExplorerEmptyStateText",
			});
		} else {
			// Grid container for board cards
			const gridContainer = modalContent.createDiv({
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
				card.addEventListener("click", () => {
					this.onBoardSelect(boardId, board.boardName);
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

		// Footer section
		const footerSection = modalContent.createDiv({
			cls: "boardsExplorerFooter",
		});

		const closeButton = footerSection.createEl("button", {
			text: "Close",
			cls: "boardsExplorerCloseButton",
		});

		closeButton.addEventListener("click", () => {
			this.close();
		});
	}
}
