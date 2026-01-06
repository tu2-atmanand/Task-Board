import { Modal, Notice, Setting, TextComponent } from "obsidian";
import type { Plugin } from "obsidian";
import { statusTypeNames } from "src/interfaces/Enums";
import { StatusConfiguration } from "src/interfaces/StatusConfiguration";
import { t } from "src/utils/lang/helper";

export class CustomStatusModal extends Modal {
	statusSymbol: string;
	statusName: string;
	statusNextSymbol: string;
	statusAvailableAsCommand: boolean;
	type: string;

	saved: boolean = false;
	error: boolean = false;
	private isCoreStatus: boolean;
	constructor(
		public plugin: Plugin,
		statusType: StatusConfiguration,
		isCoreStatus: boolean
	) {
		super(plugin.app);
		this.statusSymbol = statusType.symbol;
		this.statusName = statusType.name;
		this.statusNextSymbol = statusType.nextStatusSymbol;
		this.statusAvailableAsCommand = statusType.availableAsCommand;
		this.type = statusType.type;
		this.isCoreStatus = isCoreStatus;
		this.setTitle(t("Configure status entry"));
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
			this.type
		);
	}

	async display() {
		const { contentEl } = this;

		contentEl.empty();

		const settingDiv = contentEl.createDiv();
		//const title = this.title ?? '...';

		let statusSymbolText: TextComponent;
		new Setting(settingDiv)
			.setName(t("Task status symbol"))
			.setDesc(
				t(
					"This is the character between the square braces in case of inline-tasks. Also, this is used to store in the case."
				)
			)
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
			.setName(t("Task status name"))
			.setDesc(
				t(
					"Map a unique name to the above status symbol. This name will be used in the task-note frontmatter."
				)
			)
			.addText((text) => {
				statusNameText = text;
				text.setValue(this.statusName).onChange((v) => {
					this.statusName = v;
				});
			})
			.then((_setting) => {});

		new Setting(settingDiv)
			.setName(t("Task status type"))
			.setDesc(
				t(
					"Select what kind of status is this. If this status if of type DONE or CANCELLED, then the task will appear inside the 'completed' type column."
				)
			)
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
					this.type = v;
				});
			});

		let statusNextSymbolText: TextComponent;
		new Setting(settingDiv)
			.setName(t("Cycle to the following status"))
			.setDesc(
				t(
					"Once you click on the above status, cycle to this status. Also, dont forget to create a new entry for this status type."
				)
			)
			.addText((text) => {
				statusNextSymbolText = text;
				text.setValue(this.statusNextSymbol).onChange((v) => {
					this.statusNextSymbol = v;
				});
			})
			.then((_setting) => {});

		const footerEl = contentEl.createDiv();
		const footerButtons = new Setting(footerEl);
		footerButtons.addButton((b) => {
			b.setTooltip(t("save"))
				.setIcon("checkmark")
				.onClick(async () => {
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
