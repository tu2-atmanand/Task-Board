import { t } from "i18next";
import {
	App,
	getIcon,
	Modal,
	Notice,
	Platform,
	setIcon,
	Setting,
} from "obsidian";
import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
} from "../interfaces/Enums.js";
import { SupportedPropertiesConfig } from "../interfaces/GlobalSettings.js";
import {
	normalizeTaskIconValue,
	openIconPickerModal,
	showIconPicker,
} from "./icon_picker/index.js";

export class PropertyConfigurationModal extends Modal {
	private draft: SupportedPropertiesConfig;

	constructor(
		app: App,
		property: SupportedPropertiesConfig,
		private propertyGroup: "default" | "custom",
		private onSave: (property: SupportedPropertiesConfig) => Promise<void>,
		private isNew = false,
	) {
		super(app);
		this.draft = {
			...property,
			defaultValue: Array.isArray(property.defaultValue)
				? [...property.defaultValue]
				: property.defaultValue,
		};
		this.setTitle(
			isNew ? "Add custom property" : `Configure ${property.name}`,
		);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("task-board-property-editor");
		const isTitleProperty =
			this.propertyGroup === "default" &&
			this.draft.key === DEFAULT_TASK_CACHE_KEYS.Title;

		const addTextField = (
			name: string,
			value: string,
			onChange: (value: string) => void,
			placeholder?: string,
		) => {
			new Setting(contentEl).setName(name).addText((text) => {
				text.setValue(value).onChange(onChange);
				if (placeholder) text.setPlaceholder(placeholder);
			});
		};

		addTextField("Property ID", this.draft.id, (value) => {
			this.draft.id = value.trim();
			if (this.propertyGroup === "custom")
				this.draft.key = this.draft.id;
		});

		if (this.propertyGroup === "custom") {
			addTextField(
				"Property name",
				this.draft.name,
				(value) => (this.draft.name = value),
				"e.g. Project",
			);
		}

		if (isTitleProperty) {
			this.renderFooter(contentEl);
			return;
		}

		addTextField("Description", this.draft.desc, (value) => {
			this.draft.desc = value;
		});

		new Setting(contentEl)
			.setName("Type")
			.addDropdown((dropdown) => {
				Object.values(PropertyTypeConfig).forEach((type) => {
					dropdown.addOption(type, type);
				});
				dropdown.setValue(this.draft.type).onChange((value) => {
					this.draft.type = value as PropertyTypeConfig;
				});
			});

		addTextField("Emoji", this.draft.emoji, (value) => {
			this.draft.emoji = value;
		});
		const iconSetting = new Setting(contentEl).setName("Lucide icon");
		const iconControl = iconSetting.controlEl.createDiv(
			"task-board-property-icon-control",
		);
		const iconButton = iconControl.createEl("button", {
			cls: `custom-status-icon-button${this.draft.icon ? "" : " faint"}`,
			attr: {
				type: "button",
				title: "Select icon",
				"aria-label": "Select icon",
			},
		});
		let iconValue = normalizeTaskIconValue(this.draft.icon);
		setIcon(iconButton, iconValue && getIcon(iconValue) ? iconValue : "plus");
		const iconName = iconControl.createSpan({
			cls: "task-board-property-icon-name",
			text: iconValue || "Select icon",
		});
		iconButton.addEventListener("click", () => {
			const updateIcon = (value: string) => {
				iconValue = normalizeTaskIconValue(value);
				this.draft.icon = iconValue;
				const hasIcon = Boolean(
					iconValue && getIcon(iconValue),
				);
				iconButton.toggleClass("faint", !hasIcon);
				setIcon(iconButton, hasIcon ? iconValue : "plus");
				iconName.setText(hasIcon ? iconValue : "Select icon");
			};
			const pickerOptions = {
				value: iconValue,
				title: "Select property icon",
				onSelect: updateIcon,
				onClear: () => updateIcon(""),
			};
			if (Platform.isMobile)
				openIconPickerModal(this.app, pickerOptions);
			else showIconPicker(iconButton, pickerOptions);
		});

		new Setting(contentEl)
			.setName("Hide property in inline task notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.draft.hidePropertyInNotesForInlineTasks)
					.onChange((value) => {
						this.draft.hidePropertyInNotesForInlineTasks = value;
					}),
			);

		addTextField(
			"Default value",
			Array.isArray(this.draft.defaultValue)
				? this.draft.defaultValue.join(", ")
				: String(this.draft.defaultValue),
			(value) => {
				if (this.draft.type === PropertyTypeConfig.list) {
					this.draft.defaultValue = value
						.split(",")
						.map((item) => item.trim())
						.filter(Boolean);
				} else if (this.draft.type === PropertyTypeConfig.numeric) {
					const numberValue = Number(value);
					if (value.trim() !== "" && Number.isFinite(numberValue))
						this.draft.defaultValue = numberValue;
					else this.draft.defaultValue = value;
				} else {
					this.draft.defaultValue = value;
				}
			},
		);

		this.renderFooter(contentEl);
	}

	private renderFooter(contentEl: HTMLElement): void {
		const footer = new Setting(contentEl);
		footer.addButton((button) =>
			button
				.setButtonText(t("save"))
				.setCta()
				.onClick(async () => {
					if (!this.draft.id) {
						new Notice("Frontmatter key cannot be empty.");
						return;
					}
					if (
						this.propertyGroup === "custom" &&
						!this.draft.name.trim()
					) {
						new Notice("Property name cannot be empty.");
						return;
					}
					try {
						await this.onSave(this.draft);
						this.close();
					} catch (error) {
						console.error(
							"Failed to save property configuration",
							error,
						);
						new Notice(
							error instanceof Error
								? error.message
								: "Failed to save property configuration.",
						);
					}
				}),
		);
		footer.addButton((button) =>
			button
				.setButtonText(t("cancel"))
				.onClick(() => this.close()),
		);
	}
}
