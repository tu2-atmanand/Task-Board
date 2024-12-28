// /src/modal/BoardConfigModal.ts

import { App, Modal } from "obsidian";
import type { Board, ColumnData } from "src/interfaces/BoardConfigs";

import type { SettingsManager } from "src/settings/TaskBoardSettingConstructUI";
import { store } from "src/shared.svelte";
import { t } from "src/utils/lang/helper";

interface BoardConfigureModalProps {
	app: App | undefined;
	settingsManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	onSave: (updatedBoards: Board[]) => void;
}

export class BoardConfigureModal extends Modal {
	private boards: Board[];
	private activeBoardIndex: number;
	private onSave: (updatedBoards: Board[]) => void;
	private selectedBoardIndex: number;

	constructor(
		app: App,
		boards: Board[],
		activeBoardIndex: number,
		onSave: (updatedBoards: Board[]) => void
	) {
		super(app);
		this.boards = boards; // Deep clone
		this.activeBoardIndex = activeBoardIndex;
		this.onSave = onSave;
		this.selectedBoardIndex = -1; // Default to global settings
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const container = contentEl.createDiv({ cls: "boardConfigModalHome" });

		// Sidebar
		const sidebar = container.createDiv({ cls: "boardConfigModalSidebar" });
		this.renderSidebar(sidebar);

		// Main Content Area
		const mainContent = container.createDiv({
			cls: "boardConfigModalMainContent",
		});
		this.renderMainContent(mainContent);
	}

	private renderSidebar(sidebar: HTMLElement) {
		const buttonArea = sidebar.createDiv({
			cls: "boardConfigModalSidebarBtnArea",
		});

		// Global Settings Button
		buttonArea
			.createDiv({
				cls: "boardConfigModalSidebarBtnAreaGlobal",
				text: t(58),
			})
			.addEventListener("click", () => {
				this.selectedBoardIndex = -1;
				this.refreshMainContent();
			});

		buttonArea.createEl("hr", { cls: "boardConfigModalHr-100" });

		// Description
		buttonArea.createDiv({
			cls: "boardConfigModalSettingDescription",
			text: t(170),
		});

		// Board Buttons
		this.boards.forEach((board, index) => {
			const boardButton = buttonArea.createDiv({
				cls: `boardConfigModalSidebarBtnArea-btn${
					index === this.selectedBoardIndex ? "-active" : ""
				}`,
				text: board.name,
			});
			boardButton.addEventListener("click", () => {
				this.selectedBoardIndex = index;
				this.refreshMainContent();
			});
		});

		// Add Board Button
		buttonArea
			.createEl("button", {
				cls: "boardConfigModalSidebarBtnAreaAddBoard",
				text: t(59),
			})
			.addEventListener("click", () => {
				const newBoard: Board = {
					name: `Board ${this.boards.length + 1}`,
					index: this.boards.length,
					columns: [],
				};
				this.boards.push(newBoard);
				this.refreshSidebar(sidebar);
			});

		buttonArea.createEl("hr", { cls: "boardConfigModalHr-100" });

		// Save Button
		buttonArea
			.createEl("button", {
				cls: "boardConfigModalSidebarSaveBtn",
				text: t(1),
			})
			.addEventListener("click", () => {
				this.onSave(this.boards);
				this.close();
			});
	}

	private renderMainContent(mainContent: HTMLElement) {
		mainContent.empty();

		if (this.selectedBoardIndex === -1) {
			this.renderGlobalSettings(mainContent);
		} else {
			this.renderBoardSettings(mainContent, this.selectedBoardIndex);
		}
	}

	private renderGlobalSettings(mainContent: HTMLElement) {
		const globalSettingsSection = mainContent.createDiv();
		// this.settingsManager.constructUI(globalSettingsSection, t(36));
	}

	private renderBoardSettings(mainContent: HTMLElement, boardIndex: number) {
		const board = this.boards[boardIndex];
		const boardSettingsSection = mainContent.createDiv({
			cls: "boardConfigModalMainContentBoardSettingTab",
		});

		// Example of adding a toggle column button
		board.columns.forEach((column, columnIndex) => {
			const columnRow = boardSettingsSection.createDiv({
				cls: "boardConfigColumnRow",
			});
			columnRow.createEl("span", { text: column.data.name });

			const toggleButton = columnRow.createEl("button", {
				text: column.active ? t(65) : t(66),
			});
			toggleButton.addEventListener("click", () => {
				column.active = !column.active;
				this.renderBoardSettings(mainContent, boardIndex); // Refresh board settings
			});
		});

		// Add column button
		boardSettingsSection
			.createEl("button", { text: t(59) })
			.addEventListener("click", () => {
				const newColumn: ColumnData = {
					colType: "undated",
					data: {
						name: "New Column",
						index: 1,
					},
					active: true,
				};
				board.columns.push(newColumn);
				this.renderBoardSettings(mainContent, boardIndex); // Refresh board settings
			});
	}

	private refreshSidebar(sidebar: HTMLElement) {
		sidebar.empty();
		this.renderSidebar(sidebar);
	}

	private refreshMainContent() {
		const mainContent = this.modalEl.querySelector(
			".boardConfigModalMainContent"
		);
		if (mainContent) {
			this.renderMainContent(mainContent as HTMLElement);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// this.settingsManager.cleanUp();
	}
}
