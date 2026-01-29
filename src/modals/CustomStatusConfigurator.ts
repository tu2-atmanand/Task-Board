import { Modal, Notice, Setting, TextComponent } from "obsidian";
import type { Plugin } from "obsidian";
import { statusTypeNames } from "src/interfaces/Enums";
import {
	StatusConfiguration,
	StatusType,
} from "src/interfaces/StatusConfiguration";
import { t } from "src/utils/lang/helper";
import type { CustomStatus } from "src/interfaces/GlobalSettings";

export class CustomStatusModal extends Modal {
	statusSymbol: string;
	statusName: string;
	statusNextSymbol: string;
	statusAvailableAsCommand: boolean;
	type: StatusType;

	saved: boolean = false;
	error: boolean = false;
	private isCoreStatus: boolean;
	constructor(
		public plugin: Plugin,
		statusType: CustomStatus | StatusConfiguration,
		isCoreStatus: boolean,
	) {
		super(plugin.app);
		const status = statusType as any;
		this.statusSymbol = status.symbol;
		this.statusName = status.name;
		this.statusNextSymbol = status.nextStatusSymbol;
		this.statusAvailableAsCommand = status.availableAsCommand;
		// Ensure type is a valid StatusType enum value
		if (typeof status.type === "string") {
			this.type = status.type as StatusType;
		} else {
			this.type = status.type;
		}
		this.isCoreStatus = isCoreStatus;
		this.setTitle(t("configure-status-entry"));
	}

	/**
	 * Return a {@link StatusConfiguration} from the modal's contents
	 */
	public statusConfiguration() {
		return new StatusConfiguration(
			this.statusSymbol,
			this.statusName,
			this.statusNextSymbol,
			this.statusAvailableAsCommand,
			this.type,
		);
	}

	async display() {
		const { contentEl } = this;

		contentEl.empty();

		const settingDiv = contentEl.createDiv();
		//const title = this.title ?? '...';

		let statusSymbolText: TextComponent;
		new Setting(settingDiv)
			.setName(t("task-status-symbol"))
			.setDesc(t("task-status-symbol-info"))
			.addText((text) => {
				statusSymbolText = text;
				text.setValue(this.statusSymbol).onChange((v) => {
					this.statusSymbol = v;
				});
			})
			.setDisabled(this.isCoreStatus)
			.then((_setting) => {
				// Show any error if the initial value loaded is incorrect.
			});

		let statusNameText: TextComponent;
		new Setting(settingDiv)
			.setName(t("task-status-name"))
			.setDesc(t("task-status-name-info"))
			.addText((text) => {
				statusNameText = text;
				text.setValue(this.statusName).onChange((v) => {
					this.statusName = v;
				});
			})
			.then((_setting) => {});

		new Setting(settingDiv)
			.setName(t("task-status-type"))
			.setDesc(t("task-status-type-info"))
			.addDropdown((dropdown) => {
				const types = [
					statusTypeNames.TODO,
					statusTypeNames.IN_PROGRESS,
					statusTypeNames.ON_HOLD,
					statusTypeNames.DONE,
					statusTypeNames.CANCELLED,
					statusTypeNames.NON_TASK,
				];
				types.forEach((s) => {
					dropdown.addOption(s, s);
				});
				dropdown.setValue(this.type).onChange((v) => {
					this.type = v as StatusType;
				});
			});

		let statusNextSymbolText: TextComponent;
		new Setting(settingDiv)
			.setName(t("cycle-to-following-status"))
			.setDesc(t("cycle-to-following-status-info"))
			.addText((text) => {
				text.setPlaceholder("eg.: /");
				statusNextSymbolText = text;
				text.setValue(this.statusNextSymbol).onChange((v) => {
					this.statusNextSymbol = v;
				});
			})
			.then((_setting) => {});

		const footerEl = contentEl.createDiv();
		const footerButtons = new Setting(footerEl);
		footerButtons.addButton((b) => {
			b.setButtonText(t("save"));
			b.setTooltip(t("save")).onClick(async () => {
				this.saved = true;
				this.close();
			});
			return b;
		});
		footerButtons.addExtraButton((b) => {
			b.setIcon("cross")
				.setTooltip(t("cancel"))
				.onClick(() => {
					this.saved = false;
					this.close();
				});
			return b;
		});
	}

	// updateTitle(admonitionPreview: HTMLElement, title: string) {
	//     let titleSpan = admonitionPreview.querySelector('.admonition-title-content');
	//     let iconEl = admonitionPreview.querySelector('.admonition-title-icon');
	//     titleSpan.textContent = title;
	//     titleSpan.prepend(iconEl);
	// }
	onOpen() {
		this.display();
	}

	static setValidationError(textInput: TextComponent) {
		textInput.inputEl.addClass("tasks-settings-is-invalid");
	}

	static removeValidationError(textInput: TextComponent) {
		textInput.inputEl.removeClass("tasks-settings-is-invalid");
	}

	private static setValid(text: TextComponent, messages: string[]) {
		const valid = messages.length === 0;
		if (valid) {
			CustomStatusModal.removeValidationError(text);
		} else {
			CustomStatusModal.setValidationError(text);
		}
	}
}
