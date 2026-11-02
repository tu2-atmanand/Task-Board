import { Component, TFile } from "obsidian";
import { type Root, createRoot } from "react-dom/client";
import { StrictMode } from "react";
import TaskBoard from "../../main.js";
import TaskBoardViewContainer from "./TaskBoardViewContainer.js";
import { bugReporterManagerInsatance } from "../managers/BugReporter.js";
import { type EmbedComponent, type EmbedContext } from "obsidian-typings";

export const MAX_EMBED_Height = 400;
export const MAX_EMBED_WIDTH = 'max-content';

interface EmbedDeminsions {
	width: string;
	height: string;
}

interface Options {
	readonly viewId: string;
	readonly height: string;
	// NOTE: Its better to not make use of width, as I dont think it will be that useful, the embed should take as much width as possible. Atleast for now, we are keeping this disabled, unless a very important usecase has been found.
	// readonly dimensions: EmbedDeminsions;
}

/**
 * Trims the given string and extracts a portion of string between the {@link start} pattern and {@link end} pattern.
 * 
 * - If {@link start} pattern is not found, then slices the given string from the start till the {@link end} pattern is found.
 * - If {@link end} pattern is not found, then slices from the start pattern to the end of the given string.
 * - If both patterns are not found, then returns empty string.
 *
 * @param str - The string to trim.
 * @param prefix - The prefix to remove from the start of the string.
 * @param validate - If `true`, throws an error if the string does not start with the prefix.
 * @returns The trimmed/extracted string.
 * @throws If `validate` is `true` and the string does not start with the prefix.
 */
export function trimBetween(str: string | undefined, start: string | undefined, end: string | undefined, validate?: boolean): string {
	if (!str) return "";
	if (start && str.contains(start)) {
		const firtsHalf = str.slice(str.indexOf(start)).replace(start, "");

		if (end && firtsHalf && firtsHalf.contains(end)) return firtsHalf.slice(0, firtsHalf.indexOf(end))

		return firtsHalf;
	}

	if (end && str.contains(end)) return str.slice(0, str.indexOf(end))

	if (validate) {
		throw new Error(`String ${str} does not contains either start pattern (${start}), or end pattern (${end})`);
	}

	return "";
}

export class TaskBoardEmbedComponent extends Component implements EmbedComponent {
	private plugin: TaskBoard;
	private root: Root | null = null;
	public context: EmbedContext;
	public file: TFile;
	protected contentEl: HTMLElement;
	public linkText?: string;
	public subPath?: string;

	constructor(plugin: TaskBoard, context: EmbedContext, file: TFile, subPath?: string) {
		super();
		this.plugin = plugin;
		this.context = context;
		this.file = file;
		this.subPath = subPath;
		this.linkText = this.context.linktext;
		this.contentEl = context.containerEl;
		this.contentEl.addClass("task-board-embed");
		// this.linkText = context.containerEl.getAttr("alt") ?? undefined;
	}

	private parseOptions(): Options {
		const viewNameParams = new URLSearchParams(`viewId=${trimBetween(this.linkText, '#', ':')}`);
		const dimensionsParams = new URLSearchParams(`dimensions=${trimBetween(this.linkText, ':', undefined)}`);
		return {
			viewId: viewNameParams.get('viewId') ?? '',
			height: (dimensionsParams.get('dimensions') ? `${dimensionsParams.get('dimensions')}px` : `${MAX_EMBED_Height}px`)
			// dimensions: {
			// 	width: (dimensionsParams.get('mode') ?? MAX_EMBED_WIDTH),
			// 	height: (dimensionsParams.get('mode') ?? MAX_EMBED_Height)
			// }
		};
	}

	loadFile() {
		try {
			// console.log("Params :", { context: this.context, file: this.file, linkText: this.context.linktext, subPath: this.subPath });
			this.linkText = this.context.linktext;
			const linkTextOptions = this.parseOptions();
			this.contentEl.setCssProps({
				'--task-board-embed-wdith': linkTextOptions.height
			});
			const viewID = linkTextOptions.viewId ?? "";

			void this.plugin.taskBoardFileManager.loadBoardUsingPath(this.file.path).then((boardData) => {
				if (boardData) {
					this.root = createRoot(this.contentEl);
					this.root.render(
						<StrictMode>
							<TaskBoardViewContainer
								plugin={this.plugin}
								currentBoardData={boardData}
								currentLeaf={undefined}
								viewId={viewID}
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
