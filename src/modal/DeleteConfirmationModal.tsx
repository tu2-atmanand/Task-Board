// src/utils/DeleteConfirmationModal.tsx

import { App, Modal } from 'obsidian';
import { t } from 'src/utils/lang/helper';

interface DeleteConfirmationModalProps {
	app: App;
	mssg: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export class DeleteConfirmationModal extends Modal {
	mssg: string;
	onConfirm: () => void;
	onCancel: () => void;

	constructor(app: App, { mssg, onConfirm, onCancel }: DeleteConfirmationModalProps) {
		super(app);
		this.app = app;
		this.mssg = mssg;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

		const homeComponenet = contentEl.createEl("span", { cls: "deleteConfirmationModalHome" });
		homeComponenet.createEl('h2', { text: t("confirm-delete") });
		homeComponenet.createEl('p', { text: this.mssg });

		const buttonContainer = homeComponenet.createDiv('deleteConfirmationModalHome-button-container');

		const confirmButton = buttonContainer.createEl('button', { text: t("yes") });
		confirmButton.classList.add('deleteTaskConfirmBtn');
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelButton = buttonContainer.createEl('button', { text: t("no") });
		cancelButton.classList.add('deleteTaskCancelmBtn');
		cancelButton.addEventListener('click', () => {
			this.onCancel();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
