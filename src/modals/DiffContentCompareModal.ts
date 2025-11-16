// /src/modal/DiffContentCompareModal.ts

import TaskBoard from "main";
import { App, Modal, ButtonComponent } from "obsidian";

export type DiffSelection = "old" | "new";

export class DiffContentCompareModal extends Modal {
	cachedTaskContent: string;
	EditedTaskContent: string;
	taskContentFromFile: string;
	onSelect: (which: DiffSelection) => void;

	constructor(
		plugin: TaskBoard,
		cachedTaskContent: string,
		EditedTaskContent: string,
		taskContentFromFile: string,
		onSelect: (sel: DiffSelection) => void
	) {
		super(plugin.app);
		this.cachedTaskContent = cachedTaskContent;
		this.EditedTaskContent = EditedTaskContent;
		this.taskContentFromFile = taskContentFromFile;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute(
			"data-type",
			"task-board-diff-content-compare"
		);
		this.setTitle("Task Board Safe Guard");

		contentEl.classList.add("taskboard-diff-content-compare-modal");

		contentEl.createEl("h2", { text: "Content mismatch detected" });
		contentEl.createEl("p", {
			text: "Looks like the task content in your file is a little different from the content you just edited through Task Board. Choose which version of content you would like to keep:",
		});

		const container = contentEl.createDiv({
			cls: "taskboard-diff-content-compare-modal-container",
		});

		const rightDiv = container.createDiv({
			cls: "taskboard-diff-content-compare-modal-side",
		});
		rightDiv.createEl("h3", { text: "Current content in your note" });
		const newContentDiv = rightDiv.createDiv({
			cls: "taskboard-diff-content-compare-modal-content",
		});
		newContentDiv.innerHTML = this.getHighlightedDiff(
			this.cachedTaskContent,
			this.taskContentFromFile,
			"left"
		);
		new ButtonComponent(rightDiv)
			.setButtonText("Keep this as it is")
			.setClass("taskboard-diff-content-compare-modal-new-content-button")
			.onClick(() => {
				this.onSelect("new");
				this.close();
			});

		const leftDiv = container.createDiv({
			cls: "taskboard-diff-content-compare-modal-side",
		});
		leftDiv.createEl("h3", { text: "Content you just edited" });
		const oldContentDiv = leftDiv.createDiv({
			cls: "taskboard-diff-content-compare-modal-content",
		});
		oldContentDiv.innerHTML = this.getHighlightedDiff(
			this.taskContentFromFile,
			this.EditedTaskContent,
			"right"
		);
		new ButtonComponent(leftDiv)
			.setButtonText("Use this")
			.setClass("taskboard-diff-content-compare-modal-old-content-button")
			.onClick(() => {
				this.onSelect("old");
				this.close();
			});

		const infoDiv = contentEl.createDiv({
			cls: "taskboard-diff-content-compare-modal-info",
		});
		infoDiv.createEl("ul", {}, (ul) => {
			ul.createEl("li", {
				text: "Red highlighted content indicates the characters which are different by comparing the task-board-cache content and the current content in your note.",
			});
			ul.createEl("li", {
				text: "Green highlighted content indicates the characters which are different by comparing the content you just now edited and the current content in your note.",
			});
			ul.createEl("li", {
				text: "Select the version of content you want Task Board to write in your note.",
			});
			ul.createEl("li", {
				text: "If the content shown on left-side is completely different from the content of the task you just edited. This probably means, that Task Board couldnt able to find the task you are looking for inside the current file at stored line. Either some other plugin updated the content or during sync the content was tempered. Use the abort button below or close this modal, to avoid updating any data. And manually scan the file or update the task.",
			});
		});

		new ButtonComponent(contentEl)
			.setButtonText("Abort")
			.setClass("taskboard-diff-content-compare-modal-abort-button")
			.onClick(() => {
				this.close();
			});
	}

	onClose() {
		this.contentEl.empty();
	}

	/**
	 * Generates highlighted HTML diff between two contents.
	 * @param oldContent The original content.
	 * @param newContent The modified content.
	 * @param side The side to highlight ("left" or "right").
	 * @returns The HTML string with highlighted differences.
	 */
	getHighlightedDiff(
		oldContent: string,
		newContent: string,
		side: "left" | "right"
	): string {
		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		const maxLines = Math.max(oldLines.length, newLines.length);
		const lines: string[] = [];

		for (let i = 0; i < maxLines; i++) {
			const oldLine = oldLines[i] || "";
			const newLine = newLines[i] || "";

			if (oldLine === newLine) {
				lines.push(
					`<div>${this.escapeHtml(
						side === "left" ? oldLine : newLine
					)}</div>`
				);
			} else {
				const charsOld = oldLine.split("");
				const charsNew = newLine.split("");
				const maxChars = Math.max(charsOld.length, charsNew.length);
				const highlightedChars: string[] = [];

				for (let j = 0; j < maxChars; j++) {
					const charOld = charsOld[j] || " ";
					const charNew = charsNew[j] || " ";

					if (charOld === charNew) {
						const char = this.escapeHtml(
							side === "left" ? charOld : charNew
						);
						highlightedChars.push(char);
					} else {
						if (side === "left") {
							highlightedChars.push(
								`<span style="background-color:#ff5858c0;">${this.escapeHtml(
									charNew
								)}</span>`
							);
						} else {
							highlightedChars.push(
								`<span style="background-color:#26bb26c9;">${this.escapeHtml(
									charNew
								)}</span>`
							);
						}
					}
				}

				const fullLine = highlightedChars.join("");
				const bgColor = side === "left" ? "#ff585825" : "#36ff3625";
				lines.push(
					`<div style="background-color:${bgColor};">${fullLine}</div>`
				);
			}
		}

		return lines.join("");
	}

	/**
	 * Escapes HTML special characters to prevent XSS attacks.
	 * @param text The text to escape.
	 * @returns The escaped text.
	 */
	escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}

export function isTheContentDiffAreOnlySpaces(
	oldContent: string,
	newContent: string
): boolean {
	const normalizeSpaces = (content: string) => content.replace(/ +/g, " ");
	const updatedOldContent = normalizeSpaces(oldContent);
	const updatedNewContent = normalizeSpaces(newContent);

	const maxLength = Math.max(
		updatedOldContent.length,
		updatedNewContent.length
	);
	for (let i = 0; i < maxLength; i++) {
		const charOld = updatedOldContent[i] || "";
		const charNew = updatedNewContent[i] || "";
		if (charOld !== charNew) {
			if (charOld !== " " && charNew !== " ") {
				return false;
			}
		}
	}
	return true;
}
