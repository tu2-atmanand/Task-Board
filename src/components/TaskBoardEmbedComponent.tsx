import { Component, TFile } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { StrictMode } from "react";
import TaskBoard from "../../main.js";
import TaskBoardViewContainer from "./TaskBoardViewContainer.js";
import { bugReporterManagerInsatance } from "../managers/BugReporter.js";
import { EmbedComponent } from "obsidian-typings";

export class TaskBoardEmbedComponent extends Component implements EmbedComponent {
	private plugin: TaskBoard;
	private root: Root | null = null;
	protected contentEl: HTMLElement;
	public file: TFile;
	public linkText?: string;

	constructor(contentEl: HTMLElement, plugin: TaskBoard, file: TFile, linkText?: string) {
		super();
		this.contentEl = contentEl;
		this.contentEl.addClass("task-board-embed");
		this.plugin = plugin;
		this.file = file;
		this.linkText = linkText;
	}

	loadFile() {
		try {
			void this.plugin.taskBoardFileManager.loadBoardUsingPath(this.file.path).then((boardData) => {
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
			})
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				196,
				`Error loading task board for embed: ${String(error)}`,
				"TaskBoardEmbedComponent.tsx/loadFile",
			);
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
