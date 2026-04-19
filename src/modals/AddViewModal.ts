// /src/modals/AddViewModal.ts

import { App, Modal } from "obsidian";
import { Board } from "src/interfaces/BoardConfigs";
import { viewTypeNames } from "src/interfaces/Enums";
import { t } from "src/utils/lang/helper";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";
import { addViewToBoard } from "src/utils/ViewUtils";

interface AddViewModalProps {
	app?: App;
	onCancel: () => void;
	onSubmit: (updatedBoardData: Board) => void;
}

export class AddViewModal extends Modal {
	private onSubmit: (updatedBoardData: Board) => void;
	private onCancel: () => void;
	private viewType: string;
	private viewName: string;
	private boardData: Board;

	constructor(
		app: App,
		boardData: Board,
		{ onCancel, onSubmit }: AddViewModalProps,
	) {
		super(app);
		this.onCancel = onCancel;
		this.onSubmit = onSubmit;
		this.viewType = viewTypeNames.kanban;
		this.viewName = "";
		this.boardData = boardData;
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "addViewModalOverlayContent",
		});

		// Header
		modalContent.createEl("h2", { text: t("add-view") });

		// View Name Field
		const nameField = modalContent.createDiv({
			cls: "addViewModalOverlayContentField",
		});
		nameField.createEl("label", {
			attr: { for: "viewName" },
			text: t("view-name"),
		});
		const nameInput = nameField.createEl("input", {
			attr: {
				type: "text",
				id: "viewName",
				placeholder: t("enter-view-name"),
			},
		});
		nameInput.addEventListener("input", (event: Event) => {
			const target = event.target as HTMLInputElement;
			this.viewName = target.value;
		});

		// View Type Field
		const viewTypeField = modalContent.createDiv({
			cls: "addViewModalOverlayContentField",
		});
		viewTypeField.createEl("label", {
			attr: { for: "viewType" },
			text: t("view-type"),
		});
		const viewTypeSelect = viewTypeField.createEl("select", {
			attr: { id: "viewType" },
		});

		[
			{
				value: viewTypeNames.kanban,
				text: t("kanban-view"),
			},
			{
				value: viewTypeNames.map,
				text: t("map-view"),
			},
		].forEach((option) => {
			viewTypeSelect.createEl("option", {
				attr: { value: option.value },
				text: option.text,
			});
		});

		viewTypeSelect.addEventListener("change", (event: Event) => {
			const target = event.target as HTMLSelectElement;
			this.viewType = target.value;
		});

		// Action Buttons
		const actions = modalContent.createDiv({
			cls: "addViewModalOverlayContentActions",
		});

		const cancelButton = actions.createEl("button", { text: t("cancel") });
		cancelButton.addEventListener("click", () => {
			this.onCancel();
			this.close();
		});

		const submitButton = actions.createEl("button", {
			text: t("submit"),
			cls: "mod-cta",
		});
		submitButton.addEventListener("click", () => {
			if (!this.viewName.trim()) {
				alert(t("please-enter-view-name"));
				return;
			}

			let updatedBoard = addViewToBoard(
				this.boardData,
				this.viewType,
				this.viewName,
			);

			this.onSubmit(updatedBoard);
			this.close();
		});

		// Set focus on name input
		setTimeout(() => {
			nameInput.focus();
		}, 100);

		// Handle Enter key to submit
		nameInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				submitButton.click();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancelButton.click();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
