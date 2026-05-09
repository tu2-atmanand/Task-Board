import { t } from "i18next";
import { Modal, Setting, setIcon } from "obsidian";
import TaskBoard from "../../main.js";
import { ScanFilters } from "../interfaces/GlobalSettings.js";
import { trashIcon } from "../interfaces/Icons.js";
import { getFileSuggestions, getYAMLPropertySuggestions, getFolderSuggestions, getTagSuggestions, MultiSuggest } from "../services/MultiSuggest.js";

export class ScanFilterModal extends Modal {
	private inputEl!: HTMLInputElement;
	private selectedValues: Set<string> = new Set();
	private selectedValue: string = "";
	private suggestionContent: Set<string> = new Set();

	constructor(
		private plugin: TaskBoard,
		private filterType: keyof ScanFilters,
		private onSave: (values: string[]) => void,
	) {
		super(plugin.app);
		this.selectedValues = new Set(
			this.plugin.settings.data.scanFilters[this.filterType].values,
		);
		this.selectedValue = "";
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

		this.inputEl.onchange = (e) => {
			const target = e.target as HTMLInputElement;
			const value = target.value.trim();
			if (this.selectedValues.has(this.selectedValue)) {
				this.selectedValues.delete(this.selectedValue);
			}
			this.selectedValue = value;
			this.selectedValues.add(value);
			this.renderList();
		};

		// Load suggestion content
		if (this.filterType === "files") {
			this.suggestionContent = new Set(getFileSuggestions(this.app));
		} else if (this.filterType === "frontmatter") {
			this.suggestionContent = new Set(
				getYAMLPropertySuggestions(this.app),
			);
		} else if (this.filterType === "folders") {
			this.suggestionContent = new Set(getFolderSuggestions(this.app));
		} else if (this.filterType === "tags") {
			this.suggestionContent = new Set(getTagSuggestions(this.app));
		}

		new MultiSuggest(
			this.inputEl,
			this.suggestionContent,
			(value: string) => {
				this.selectedValue = value;
				if (!this.selectedValues.has(value)) {
					this.selectedValues.add(value);
					this.renderList();
				}
				this.inputEl.value = "";
			},
			this.app,
		);

		// this.inputEl.blur();
		// multiSuggestInput.close();

		this.renderList();

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(t("save"))
					.setCta()
					.onClick(() => {
						this.onSave(Array.from(this.selectedValues));
						this.close();
					}),
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("cancel"))
					.setTooltip(t("cancel"))
					.onClick(() => this.close()),
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
