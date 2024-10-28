// src/utils/DeleteConfirmationModal.tsx

import { App, Modal } from 'obsidian';

import React from 'react';
import { t } from 'src/utils/lang/helper';

interface DeleteConfirmationModalProps {
	app: App;
	onConfirm: () => void;
	onCancel: () => void;
}

export class DeleteConfirmationModal extends Modal {
	onConfirm: () => void;
	onCancel: () => void;

	constructor(app: App, { onConfirm, onCancel }: DeleteConfirmationModalProps) {
		super(app);
		this.app = app;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;

		const homeComponenet = contentEl.createEl("span", { cls: "deleteConfirmationModalHome" });
		homeComponenet.createEl('h2', { text: t(60) });
		homeComponenet.createEl('p', { text: t(61) });

		const buttonContainer = homeComponenet.createDiv('button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '1em';

		const confirmButton = buttonContainer.createEl('button', { text: t(62) });
		confirmButton.style.paddingBlock = '4px';
		confirmButton.style.paddingInline = '25px';
		confirmButton.classList.add('deleteTaskConfirmBtn');
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelButton = buttonContainer.createEl('button', { text: t(63) });
		cancelButton.style.paddingBlock = '4px';
		cancelButton.style.paddingInline = '25px';
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
