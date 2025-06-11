// /src/modal/AddColumnModal.ts

import { App, Modal } from "obsidian";

import { t } from "src/utils/lang/helper";

export type columnDataProp = {
	colType: string;
	name: string;
	active: boolean;
	range?: { tag: string; rangedata: { from: number; to: number } };
	coltag?: string;
	limit?: number;
	path?: string;
};

interface AddColumnModalProps {
	app: App;
	onCancel: () => void;
	onSubmit: (columnData: columnDataProp) => void;
}

export class AddColumnModal extends Modal {
	private onSubmit: (columnData: {
		colType: string;
		name: string;
		active: boolean;
		range?: { tag: string; rangedata: { from: number; to: number } };
		coltag?: string;
		limit?: number;
		path?: string;
	}) => void;
	private onCancel: () => void;
	private colType: string;
	private name: string;

	constructor(app: App, { onCancel, onSubmit }: AddColumnModalProps) {
		super(app);
		this.onCancel = onCancel; // Renamed
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
			{ value: "undated", text: t("undated") },
			{ value: "dated", text: t("dated") },
			{ value: "namedTag", text: t("tagged") },
			{ value: "untagged", text: t("untagged") },
			{ value: "otherTags", text: t("other-tags") },
			{ value: "completed", text: t("completed") },
			{ value: "pathFiltered", text: t("path-filtered") },
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
		nameField.createEl("label", { attr: { for: "name" }, text: t("column-name") });
		const nameInput = nameField.createEl("input", {
			attr: { type: "text", id: "name", placeholder: t("enter-column-name") },
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
			const active = true;
			if (this.colType === "dated") {
				this.onSubmit({
					colType: this.colType,
					name: this.name,
					active,
					range: { tag: "", rangedata: { from: 0, to: 0 } },
				}); // Add range data
			} else if (this.colType === "namedTag") {
				this.onSubmit({
					colType: this.colType,
					name: this.name,
					active,
					coltag: "",
				}); // Add coltag
			} else if (this.colType === "completed") {
				this.onSubmit({
					colType: this.colType,
					name: this.name,
					active,
					limit: 20,
				}); // Add limit
			} else if (this.colType === "pathFiltered") {
				this.onSubmit({
					colType: this.colType,
					name: this.name,
					active,
					path: "",
				}); // Add path filter
			} else {
				this.onSubmit({
					colType: this.colType,
					name: this.name,
					active,
				});
			}
			this.close();
		});

		const cancelButton = actions.createEl("button", { text: t("cancel") });
		cancelButton.addEventListener("click", () => {
			this.onCancel(); // Renamed from onClose to onCancel
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
