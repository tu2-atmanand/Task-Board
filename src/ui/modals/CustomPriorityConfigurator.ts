import { t } from "i18next";
import { App, getIcon, Modal, Platform, setIcon, Setting } from "obsidian";
import { CustomPriority } from "../../interfaces/GlobalSettings.js";
import {
	normalizeTaskIconValue,
	openIconPickerModal,
	showIconPicker,
} from "./icon_picker/index.js";
import { showColorPicker } from "./color_picker/ColorPickerModal.js";

export class CustomPriorityModal extends Modal {
	saved = false;
	name: string;
	private readonly rank: number;
	emoji: string;
	lucideIcon: string;
	color: string;
	desc: string;

	constructor(app: App, priority: CustomPriority) {
		super(app);
		this.name = priority.name;
		this.rank = priority.rank;
		this.emoji = priority.emoji;
		this.lucideIcon = normalizeTaskIconValue(priority.lucideIcon);
		this.color = priority.color ?? "";
		this.desc = priority.desc ?? "";
		this.setTitle(t("configure-priority"));
	}

	priorityConfiguration(): CustomPriority {
		return {
			name: this.name.trim(),
			rank: Math.max(1, Math.round(this.rank)),
			emoji: this.emoji.trim(),
			lucideIcon: this.lucideIcon,
			color: this.color,
			desc: this.desc,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(t("priority-name"))
			.addText((text) =>
				text.setValue(this.name).onChange((value) => {
					this.name = value;
				}),
			);

		new Setting(contentEl)
			.setName(t("priority-emoji"))
			.addText((text) =>
				text.setValue(this.emoji).onChange((value) => {
					this.emoji = value;
				}),
			);

		const iconSetting = new Setting(contentEl)
			.setName(t("priority-icon"));
		const iconControl = iconSetting.controlEl.createDiv(
			"task-board-property-icon-control",
		);
		const iconButton = iconControl.createEl("button", {
			cls: `custom-status-icon-button${this.lucideIcon ? "" : " faint"}`,
			attr: {
				type: "button",
				title: t("priority-icon"),
				"aria-label": t("priority-icon"),
			},
		});
		const renderIcon = () => {
			const availableIcon =
				this.lucideIcon && getIcon(this.lucideIcon)
					? this.lucideIcon
					: null;
			iconButton.toggleClass("faint", !availableIcon);
			setIcon(iconButton, availableIcon ?? "plus");
			if (this.color) iconButton.style.color = this.color;
			else iconButton.style.removeProperty("color");
		};
		renderIcon();
		iconButton.addEventListener("click", () => {
			const updateIcon = (value: string) => {
				this.lucideIcon = normalizeTaskIconValue(value);
				renderIcon();
			};
			const options = {
				value: this.lucideIcon,
				title: t("priority-icon"),
				onSelect: updateIcon,
				onClear: () => updateIcon(""),
			};
			if (Platform.isMobile) openIconPickerModal(this.app, options);
			else showIconPicker(iconButton, options);
		});

		const colorSetting = new Setting(contentEl).setName(t("priority-color"));
		const colorButton = colorSetting.controlEl.createEl("button", {
			cls: "task-board-custom-status-color-button",
			attr: {
				type: "button",
				"aria-label": t("priority-color"),
			},
		});
		const renderColor = () => {
			colorButton.textContent = this.color || t("choose-color");
			if (this.color) colorButton.style.backgroundColor = this.color;
			else colorButton.style.removeProperty("background-color");
		};
		renderColor();
		colorButton.addEventListener("click", () => {
			showColorPicker(colorButton, {
				value: this.color,
				outputFormat: "rgb",
				onSelect: (value) => {
					this.color = value;
					renderColor();
					renderIcon();
				},
				onClear: () => {
					this.color = "";
					renderColor();
					renderIcon();
				},
			});
		});

		new Setting(contentEl)
			.setName(t("priority-description"))
			.addTextArea((text) => {
				text.setValue(this.desc).onChange((value) => {
					this.desc = value;
				});
				text.inputEl.rows = 3;
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("save"))
					.setCta()
					.onClick(() => {
						this.saved = true;
						this.close();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("cross")
					.setTooltip(t("cancel"))
					.onClick(() => {
						this.saved = false;
						this.close();
					}),
			);
	}
}
