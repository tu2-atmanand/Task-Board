import { t } from "i18next";
import { App, Modal, Notice, Setting } from "obsidian";
import { PropertyTypeConfig } from "../interfaces/Enums.js";
import { SupportedPropertiesConfig } from "../interfaces/GlobalSettings.js";

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

		addTextField("Frontmatter key", this.draft.id, (value) => {
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
		} else {
			addTextField("Task Board property key", this.draft.key, (value) => {
				this.draft.key = value.trim();
			});
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
		addTextField("Lucide icon", this.draft.icon, (value) => {
			this.draft.icon = value;
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
