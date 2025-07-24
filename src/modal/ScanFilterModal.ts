import TaskBoard from "main";
import { App, Modal, Setting, setIcon } from "obsidian";
import {
	MultiSuggest,
	getFileSuggestions,
	getFolderSuggestions,
	getTagSuggestions,
} from "src/services/MultiSuggest";
import { trashIcon } from "src/types/Icons";
import { t } from "src/utils/lang/helper";

export class ScanFilterModal extends Modal {
	private inputEl!: HTMLInputElement;
	private selectedValues: Set<string> = new Set();
	private suggestionContent: Set<string> = new Set();

	constructor(
		private plugin: TaskBoard,
		private filterType: "files" | "folders" | "tags",
		private onSave: (values: string[]) => void
	) {
		super(plugin.app);
		this.selectedValues = new Set(
			this.plugin.settings.data.globalSettings.scanFilters[
				this.filterType
			].values
		);
	}

	async onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h3", {
			text: `Configure ${this.filterType}`,
		});

		this.inputEl = contentEl.createEl("input", {
			type: "text",
			cls: "scan-filter-input",
			placeholder: "Type to search...",
		});

		// Load suggestion content
		if (this.filterType === "files") {
			this.suggestionContent = new Set(getFileSuggestions(this.app));
		} else if (this.filterType === "folders") {
			this.suggestionContent = new Set(getFolderSuggestions(this.app));
		} else if (this.filterType === "tags") {
			this.suggestionContent = new Set(getTagSuggestions(this.app));
		}

		const multiSuggestInput = new MultiSuggest(
			this.inputEl,
			this.suggestionContent,
			(value: string) => {
				if (!this.selectedValues.has(value)) {
					this.selectedValues.add(value);
					this.renderList();
				}
				this.inputEl.value = "";
			},
			this.app
		);

		// this.inputEl.blur();
		// multiSuggestInput.close();

		this.renderList();

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						this.onSave(Array.from(this.selectedValues));
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("cancel"))
					.setTooltip("Cancel")
					.onClick(() => this.close())
			);
	}

	private renderList() {
		let listEl = this.contentEl.querySelector(".scan-filter-list");
		if (listEl) listEl.remove();

		listEl = this.contentEl.createDiv("scan-filter-list");

		if (this.selectedValues.size === 0) {
			listEl.setText("No values selected.");
			// listEl.style.opacity = "0.6";
			return;
		}

		this.selectedValues.forEach((value) => {
			const itemEl = listEl!.createDiv("scan-filter-item");
			itemEl.setText(value);
			const removeBtn = itemEl.createEl("button", {
				text: "Remove",
				cls: "scan-filter-remove-btn",
			});
			setIcon(removeBtn, trashIcon);
			removeBtn.onclick = () => {
				this.selectedValues.delete(value);
				this.renderList();
			};
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
