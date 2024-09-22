// src/utils/DeleteConfirmationModal.tsx

import { App, Modal } from 'obsidian';

import React from 'react';

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
		contentEl.createEl('h2', { text: 'Confirm Delete' });
		contentEl.createEl('p', { text: 'Are you sure you want to delete this task?' });

		const buttonContainer = contentEl.createDiv('button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '1em';

		const confirmButton = buttonContainer.createEl('button', { text: 'Yes' });
		confirmButton.style.paddingBlock = '4px';
		confirmButton.style.paddingInline = '25px';
		confirmButton.classList.add('deleteTaskConfirmBtn');
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'No' });
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
