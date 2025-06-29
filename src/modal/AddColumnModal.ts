// /src/modal/AddColumnModal.ts

import { App, Modal } from "obsidian";
import { columnTypeAndNameMapping } from "src/interfaces/BoardConfigs";
import { UniversalDateOptions } from "src/interfaces/GlobalSettings";

import { t } from "src/utils/lang/helper";

export type columnDataProp = {
	id: number;
	colType: string;
	name: string;
	active?: boolean;
	datedBasedColumn?: { dateType: string; from: number; to: number };
	coltag?: string;
	taskStatus?: string;
	taskPriority?: number;
	limit?: number;
};

interface AddColumnModalProps {
	app: App;
	onCancel: () => void;
	onSubmit: (columnData: columnDataProp) => void;
}

export class AddColumnModal extends Modal {
	private onSubmit: (columnData: {
		id: number;
		colType: string;
		name: string;
		active?: boolean;
		datedBasedColumn?: { dateType: string; from: number; to: number };
		coltag?: string;
		taskStatus?: string;
		taskPriority?: number;
		limit?: number;
	}) => void;
	private onCancel: () => void;
	private colType: string;
	private name: string;

	constructor(app: App, { onCancel, onSubmit }: AddColumnModalProps) {
		super(app);
		this.onCancel = onCancel;
		this.onSubmit = onSubmit;
		this.colType = "undated";
		this.name = "";
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "addColumnModalOverlayContent",
		});

		// Header
		modalContent.createEl("h2", { text: t("add-column") });

		// Column Type Field
		const colTypeField = modalContent.createDiv({
			cls: "addColumnModalOverlayContentField",
		});
		colTypeField.createEl("label", {
			attr: { for: "colType" },
			text: t("column-type"),
		});
		const colTypeSelect = colTypeField.createEl("select", {
			attr: { id: "colType" },
		});

		[
			{ value: "undated", text: columnTypeAndNameMapping.undated },
			{ value: "dated", text: columnTypeAndNameMapping.dated },
			{ value: "namedTag", text: columnTypeAndNameMapping.namedTag },
			{ value: "untagged", text: columnTypeAndNameMapping.untagged },
			{ value: "otherTags", text: columnTypeAndNameMapping.otherTags },
			{ value: "taskStatus", text: columnTypeAndNameMapping.taskStatus },
			{
				value: "taskPriority",
				text: columnTypeAndNameMapping.taskPriority,
			},
			{ value: "completed", text: columnTypeAndNameMapping.completed },
		].forEach((option) => {
			colTypeSelect.createEl("option", {
				attr: { value: option.value },
				text: option.text,
			});
		});

		colTypeSelect.addEventListener("change", (event: Event) => {
			const target = event.target as HTMLSelectElement;
			this.colType = target.value;
		});

		// Name Field
		const nameField = modalContent.createDiv({
			cls: "addColumnModalOverlayContentField",
		});
		nameField.createEl("label", {
			attr: { for: "name" },
			text: t("column-name"),
		});
		const nameInput = nameField.createEl("input", {
			attr: {
				type: "text",
				id: "name",
				placeholder: t("enter-column-name"),
			},
		});
		nameInput.addEventListener("input", (event: Event) => {
			const target = event.target as HTMLInputElement;
			this.name = target.value;
		});

		// Action Buttons
		const actions = modalContent.createDiv({
			cls: "addColumnModalOverlayContentActions",
		});
		const submitButton = actions.createEl("button", { text: t("submit") });
		submitButton.addEventListener("click", () => {
			if (this.colType === "dated") {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0], // Generate a random ID
					colType: this.colType,
					name: this.name,
					datedBasedColumn: {
						dateType: UniversalDateOptions.dueDate,
						from: 0,
						to: 0,
					},
				}); // Add range data
			} else if (this.colType === "namedTag") {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0],
					colType: this.colType,
					name: this.name,
					coltag: "",
				});
			} else if (this.colType === "taskStatus") {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0],
					colType: this.colType,
					name: this.name,
					taskStatus: "",
				});
			} else if (this.colType === "taskPriority") {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0],
					colType: this.colType,
					name: this.name,
					taskPriority: 1,
				});
			} else if (this.colType === "completed") {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0],
					colType: this.colType,
					name: this.name,
					limit: 20,
				}); // Add limit
			} else {
				this.onSubmit({
					id: crypto.getRandomValues(new Uint32Array(1))[0],
					colType: this.colType,
					name: this.name,
				});
			}
			this.close();
		});

		const cancelButton = actions.createEl("button", { text: t("cancel") });
		cancelButton.addEventListener("click", () => {
			this.onCancel();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.onCancel();
		// this.close();
	}
}
