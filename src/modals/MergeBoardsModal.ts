import { App, Modal, Setting, Notice, TFile, setIcon } from "obsidian";
import TaskBoard from "../../main.js";
import { Board } from "../interfaces/BoardConfigs.js";
import TaskBoardFileManager from "../managers/TaskBoardFileManager.js";
import { MultiSuggest } from "../services/MultiSuggest.js";
import { generateRandomNumber } from "../utils/TaskItemUtils.js";
import { CURRENT_REVISION } from "../interfaces/Constants.js";
import { t } from "i18next";

interface MergeBoardsModalProps {
	plugin: TaskBoard;
	taskBoardFileManager: TaskBoardFileManager;
}

export class MergeBoardsModal extends Modal {
	private plugin: TaskBoard;
	private taskBoardFileManager: TaskBoardFileManager;
	private firstBoardPath: string = "";
	private secondBoardPath: string = "";
	private newBoardName: string = "";
	private mergeButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		{ plugin, taskBoardFileManager }: MergeBoardsModalProps,
	) {
		super(app);
		this.plugin = plugin;
		this.taskBoardFileManager = taskBoardFileManager;
	}

	onOpen() {
		const { contentEl } = this;

		this.setTitle(t("merge-board-files"));

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "mergeBoardsModalContent",
		});

		// Header
		modalContent.createEl("p", {
			text: t("merge-board-files-info"),
			cls: "setting-item-description",
		});

		// First Board Path Field
		const firstBoardField = modalContent.createDiv({
			cls: "mergeBoardsModalField",
		});
		firstBoardField.createEl("label", {
			text: "First task board file (.taskboard)",
		});
		const firstBoardSetting = new Setting(firstBoardField).addText(
			(text) => {
				text.setPlaceholder(
					"Enter or select first .taskboard file path",
				);
				const inputEl = text.inputEl;
				const suggestionContent = this.getTaskboardFileSuggestions();
				const onSelectCallback = (selectedPath: string) => {
					this.firstBoardPath = selectedPath;
					text.setValue(selectedPath);
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app,
				);
			},
		);

		// Arrow
		const mergeBoardsModalPluginIcon = modalContent.createDiv({
			cls: "mergeBoardsModalArrow",
		});
		setIcon(mergeBoardsModalPluginIcon, "plus");

		// Second Board Path Field
		const secondBoardField = modalContent.createDiv({
			cls: "mergeBoardsModalField",
		});
		secondBoardField.createEl("label", {
			text: "Second task board file (.taskboard)",
		});
		const secondBoardSetting = new Setting(secondBoardField).addText(
			(text) => {
				text.setPlaceholder(
					"Enter or select second .taskboard file path",
				);
				const inputEl = text.inputEl;
				const suggestionContent = this.getTaskboardFileSuggestions();
				const onSelectCallback = (selectedPath: string) => {
					this.secondBoardPath = selectedPath;
					text.setValue(selectedPath);
				};

				new MultiSuggest(
					inputEl,
					new Set(suggestionContent),
					onSelectCallback,
					this.app,
				);
			},
		);

		// Arrow
		const mergeBoardsModalArrow = modalContent.createDiv({
			cls: "mergeBoardsModalArrow",
		});
		setIcon(mergeBoardsModalArrow, "arrow-big-down");

		// New Board Name Field
		const newBoardNameField = modalContent.createDiv({
			cls: "mergeBoardsModalField",
		});
		newBoardNameField.createEl("label", {
			text: "New board file name",
		});
		newBoardNameField.createEl("p", {
			text: "This task board file will be created at the same location as that of the first board file.",
			cls: "setting-item-description",
		});
		const newBoardNameInput = newBoardNameField.createEl("input", {
			attr: {
				type: "text",
				placeholder: "Enter name for the merged board file",
			},
		});
		newBoardNameInput.addEventListener("input", (event: Event) => {
			const target = event.target as HTMLInputElement;
			this.newBoardName = target.value;
		});

		// Merge Button
		const actions = modalContent.createDiv({
			cls: "mergeBoardsModalActions",
		});
		this.mergeButton = actions.createEl("button", { text: "Merge Boards" });
		this.mergeButton.addEventListener("click", () => {
			this.handleMerge();
		});

		// Cancel Button
		// const cancelButton = actions.createEl("button", { text: "Cancel" });
		// cancelButton.addEventListener("click", () => {
		// 	this.close();
		// });
	}

	private getTaskboardFileSuggestions(): string[] {
		const files = this.app.vault
			.getAllLoadedFiles()
			.filter((f) => f instanceof TFile && f.path.endsWith(".taskboard"))
			.map((f) => f.path);
		return files;
	}

	private async handleMerge() {
		if (
			!this.firstBoardPath ||
			!this.secondBoardPath ||
			!this.newBoardName
		) {
			new Notice("Please fill in all fields.");
			return;
		}

		if (this.firstBoardPath === this.secondBoardPath) {
			new Notice("Please select two different board files.");
			return;
		}

		// Disable button and show loading
		if (this.mergeButton) {
			this.mergeButton.disabled = true;
			this.mergeButton.textContent = "Merging...";
		}

		try {
			// Load both boards
			const board1 = await this.taskBoardFileManager.loadBoardUsingPath(
				this.firstBoardPath,
			);
			const board2 = await this.taskBoardFileManager.loadBoardUsingPath(
				this.secondBoardPath,
			);

			if (!board1 || !board2) {
				throw new Error("Failed to load one or both board files.");
			}

			// Merge boards
			const mergedBoard = this.mergeBoards(board1, board2);

			// Determine save path (same location as first board)
			const firstBoardDir = this.firstBoardPath.substring(
				0,
				this.firstBoardPath.lastIndexOf("/"),
			);
			const newBoardPath = `${firstBoardDir}/${this.newBoardName}.taskboard`;

			// Save the merged board
			const success = await this.taskBoardFileManager.createNewBoardFile(
				newBoardPath,
				mergedBoard,
			);

			if (success) {
				new Notice(
					`Boards merged successfully! New board saved as: ${newBoardPath}`,
				);
				this.close();
			} else {
				throw new Error("Failed to save the merged board.");
			}
		} catch (error) {
			new Notice(
				`Error merging boards: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			// Re-enable button
			if (this.mergeButton) {
				this.mergeButton.disabled = false;
				this.mergeButton.textContent = "Merge Boards";
			}
		}
	}

	private mergeBoards(board1: Board, board2: Board): Board {
		// Generate new ID
		const newId = String(generateRandomNumber());

		// Combine filterConfig
		const combinedFilterConfig = {
			enableSavedFilters:
				board1.filterConfig?.enableSavedFilters ||
				board2.filterConfig?.enableSavedFilters ||
				false,
			savedConfigs: [
				...(board1.filterConfig?.savedConfigs || []),
				...(board2.filterConfig?.savedConfigs || []),
			],
		};

		// Combine views
		const combinedViews = [...board1.views, ...board2.views];

		// Create merged board (prioritizing board1 for common settings)
		const mergedBoard: Board = {
			id: newId,
			revision: board1?.revision ?? CURRENT_REVISION,
			name: this.newBoardName,
			description: board1.description,
			filterConfig: combinedFilterConfig,
			views: combinedViews,
			lastViewId: board1.lastViewId, // Use from first board
			viewsPanel: board1.viewsPanel, // Use from first board
		};

		return mergedBoard;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
