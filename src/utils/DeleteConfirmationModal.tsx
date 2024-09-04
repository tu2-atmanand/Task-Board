// src/utils/DeleteConfirmationModal.tsx

import React from 'react';
import { Modal, App } from 'obsidian';

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
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Confirm Delete' });
		contentEl.createEl('p', { text: 'Are you sure you want to delete this task?' });

		const buttonContainer = contentEl.createDiv('button-container');
		const confirmButton = buttonContainer.createEl('button', { text: 'Yes' });
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'No' });
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
