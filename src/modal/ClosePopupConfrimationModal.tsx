// src/utils/ClosePopupConfrimationModal.tsx

import { App, Modal } from 'obsidian';
import { t } from 'src/utils/lang/helper';

interface ClosePopupConfrimationModalProps {
	app: App;
	mssg: string;
	onDiscard: () => void;
	onGoBack: () => void;
}

export class ClosePopupConfrimationModal extends Modal {
	mssg: string;
	onDiscard: () => void;
	onGoBack: () => void;

	constructor(app: App, { mssg, onDiscard, onGoBack }: ClosePopupConfrimationModalProps) {
		super(app);
		this.app = app;
		this.mssg = mssg;
		this.onDiscard = onDiscard;
		this.onGoBack = onGoBack;
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

		const homeComponenet = contentEl.createEl("span", { cls: "deleteConfirmationModalHome" });
		homeComponenet.createEl('h2', { text: t("are-you-sure") });
		homeComponenet.createEl('p', { text: this.mssg });

		const buttonContainer = homeComponenet.createDiv('deleteConfirmationModalHome-button-container');

		const discardButton = buttonContainer.createEl('button', { text: t("discard") });
		discardButton.classList.add('deleteTaskConfirmBtn');
		discardButton.addEventListener('click', () => {
			this.onDiscard();
			this.close();
		});

		const goBackButton = buttonContainer.createEl('button', { text: t("go-back") });
		goBackButton.classList.add('deleteTaskCancelmBtn');
		goBackButton.addEventListener('click', () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
