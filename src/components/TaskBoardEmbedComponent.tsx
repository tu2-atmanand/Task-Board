import { Component, TFile } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { StrictMode } from "react";
import TaskBoard from "../../main.js";
import TaskBoardViewContainer from "./TaskBoardViewContainer.js";

export class TaskBoardEmbedComponent extends Component {
	plugin: TaskBoard;
	file: TFile;
	linkText?: string;
	root: Root | null = null;
	protected contentEl: HTMLElement;

	constructor(contentEl: HTMLElement, plugin: TaskBoard, file: TFile, linkText?: string) {
		super();
		this.contentEl = contentEl;
		this.contentEl.addClass("task-board-embed");
		this.plugin = plugin;
		this.file = file;
		this.linkText = linkText;
	}

	async loadFile() {
		try {
			const boardData = await this.plugin.taskBoardFileManager.loadBoardUsingPath(this.file.path);
			if (boardData) {
				this.root = createRoot(this.contentEl);
				this.root.render(
					<StrictMode>
						<TaskBoardViewContainer
							plugin={this.plugin}
							currentBoardData={boardData}
							currentLeaf={undefined}
						/>
					</StrictMode>
				);
			} else {
				this.contentEl.createEl("div", { text: "Failed to load task board" });
			}
		} catch (error) {
			console.error("Error loading task board for embed:", error);
			this.contentEl.createEl("div", { text: "Error loading task board" });
		}
	}

	onunload() {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		super.onunload();
	}
}
