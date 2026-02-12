// /src/modals/ModifiedFilesModal.ts

import { App, Modal, TFile } from "obsidian";

interface ModifiedFilesModalProps {
	modifiedFiles?: TFile[];
	deletedFiles?: string[];
}

export class ModifiedFilesModal extends Modal {
	private modifiedFiles: TFile[];
	private deletedFiles: string[];

	constructor(
		app: App,
		{ modifiedFiles = [], deletedFiles = [] }: ModifiedFilesModalProps,
	) {
		super(app);
		this.modifiedFiles = modifiedFiles;
		this.deletedFiles = deletedFiles;
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "modifiedFilesModalContent",
		});

		// Header
		const totalCount = this.modifiedFiles.length + this.deletedFiles.length;
		modalContent.createEl("h2", {
			text: `File Changes (${totalCount})`,
			cls: "modifiedFilesModalContentHeader",
		});

		// Description
		modalContent.createEl("p", {
			text: "The below files were either modified, created, renamed or deleted while Obsidian was closed:",
			cls: "modifiedFilesModalDescription",
		});

		// Modified files section
		if (this.modifiedFiles.length > 0) {
			this.createModifiedFilesSection(modalContent);
		}

		// Deleted files section
		if (this.deletedFiles.length > 0) {
			this.createDeletedFilesSection(modalContent);
		}

		// Show empty state if no files
		if (this.modifiedFiles.length === 0 && this.deletedFiles.length === 0) {
			modalContent.createEl("div", {
				text: "No file changes found.",
				cls: "modifiedFilesEmpty",
			});
		}

		// Button container
		const buttonContainer = modalContent.createDiv({
			cls: "modifiedFilesButtonContainer",
		});

		// Close button
		buttonContainer.createEl("button", {
			text: "Close",
			cls: "mod-cta",
			onclick: () => {
				this.close();
			},
		});
	}

	private createModifiedFilesSection(container: HTMLElement) {
		const sectionContainer = container.createDiv({
			cls: "modifiedFilesSection",
		});

		// Section header
		sectionContainer.createEl("h3", {
			text: `Modified/Created Files (${this.modifiedFiles.length})`,
			cls: "modifiedFilesSectionHeader",
		});

		// Create scrollable container
		const fileListContainer = sectionContainer.createDiv({
			cls: "modifiedFilesListContainer",
		});

		// Display modified files
		this.modifiedFiles.forEach((file, index) => {
			this.createFileItem(fileListContainer, file, index, "modified");
		});
	}

	private createDeletedFilesSection(container: HTMLElement) {
		const sectionContainer = container.createDiv({
			cls: "deletedFilesSection",
		});

		// Section header
		sectionContainer.createEl("h3", {
			text: `Deleted/Renamed Files (${this.deletedFiles.length})`,
			cls: "deletedFilesSectionHeader",
		});
		sectionContainer.createEl("p", {
			text: "NOTE : Renamed files are little difficult to find. So if you see a lot of files here, it will be good idea to run the vault scan to re-build the cache.",
		});

		// Create scrollable container
		const fileListContainer = sectionContainer.createDiv({
			cls: "deletedFilesListContainer",
		});

		// Display deleted files
		this.deletedFiles.forEach((filePath, index) => {
			this.createDeletedFileItem(fileListContainer, filePath, index);
		});
	}

	private createFileItem(
		container: HTMLElement,
		file: TFile,
		index: number,
		type: "modified",
	) {
		const fileItem = container.createDiv({
			cls: "modifiedFileItem",
		});

		// File info (left side)
		const fileInfo = fileItem.createDiv({
			cls: "modifiedFileInfo",
		});

		// File name
		fileInfo.createEl("div", {
			text: file.name,
			cls: "modifiedFileName",
		});

		// File path
		fileInfo.createEl("div", {
			text: file.path,
			cls: "modifiedFilePath",
		});

		// Date/time info (right side)
		const dateInfo = fileItem.createDiv({
			cls: "modifiedFileDate",
		});

		// Modified date
		const modifiedDate = new Date(file.stat.mtime);
		dateInfo.createEl("div", {
			text: modifiedDate.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			}),
			cls: "modifiedFileDay",
		});

		// Modified time
		dateInfo.createEl("div", {
			text: modifiedDate.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			}),
			cls: "modifiedFileTime",
		});
	}

	private createDeletedFileItem(
		container: HTMLElement,
		filePath: string,
		index: number,
	) {
		const fileItem = container.createDiv({
			cls: "deletedFileItem",
		});

		// Delete icon/indicator
		const deleteIndicator = fileItem.createDiv({
			cls: "deletedFileIndicator",
		});
		deleteIndicator.innerText = "🗑️";

		// File info
		const fileInfo = fileItem.createDiv({
			cls: "deletedFileInfo",
		});

		// File name/path
		fileInfo.createEl("div", {
			text: filePath,
			cls: "deletedFileName",
		});
	}
}
