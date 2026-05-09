// /src/modals/AddViewModal.ts

import { t } from "i18next";
import { App, Modal, Setting } from "obsidian";
import { Board } from "../interfaces/BoardConfigs.js";
import { viewTypeNames } from "../interfaces/Enums.js";
import { addViewToBoard } from "../utils/ViewUtils.js";

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

		this.setTitle(t("add-view"));

		const modalContent = contentEl.createDiv({
			cls: "addViewModalOverlayContent",
		});

		new Setting(modalContent)
			.setName(t("view-type"))
			.setDesc(t("view-type-info"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[viewTypeNames.kanban]: t(viewTypeNames.kanban),
						[viewTypeNames.map]: t(viewTypeNames.map),
					})
					.setValue(this.viewType)
					.onChange(async (value) => {
						this.viewType = value;
					}),
			);

		new Setting(modalContent)
			.setName(t("view-name"))
			.setDesc(t("view-name-info"))
			.addText((text) =>
				text
					.setValue(this.viewName)
					.onChange(async (value) => {
						this.viewName = value;
					})
					.setPlaceholder(t("enter-view-name")),
			);

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
			let updatedBoard = addViewToBoard(
				this.boardData,
				this.viewType,
				this.viewName,
			);

			this.onSubmit(updatedBoard);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
