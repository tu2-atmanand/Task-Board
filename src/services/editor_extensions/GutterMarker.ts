/**
 * Task Gutter Handler - Handles interaction for task markers in the gutter.
 * Displays a marker in front of task lines; clicking it opens TaskEditorModal.
 */

import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import {
	App,
	ExtraButtonComponent,
	getFrontMatterInfo,
	type FrontMatterInfo,
} from "obsidian";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import TaskBoard from "../../../main.js";
import { TaskEditorModal } from "../../ui/modals/TaskEditorModal.js";
import { isTaskLine } from "../../utils/CheckBoxUtils.js";
import { t } from "i18next";

const frontmatterInfoByDoc = new WeakMap<Text, FrontMatterInfo>();

function isLineInCodeBlockOrFrontmatter(
	view: EditorView,
	lineFrom: number,
): boolean {
	const doc = view.state.doc;
	let frontmatterInfo = frontmatterInfoByDoc.get(doc);
	if (!frontmatterInfo) {
		frontmatterInfo = getFrontMatterInfo(doc.toString());
		frontmatterInfoByDoc.set(doc, frontmatterInfo);
	}

	if (
		frontmatterInfo.exists &&
		lineFrom < frontmatterInfo.contentStart
	) {
		return true;
	}

	const syntaxNode = syntaxTree(view.state).resolveInner(lineFrom + 1);
	const nodeProps = syntaxNode.type.prop(
		tokenClassNodeProp as Parameters<typeof syntaxNode.type.prop>[0],
	) as string | undefined;

	return nodeProps?.split(" ").includes("hmd-codeblock") ?? false;
}

// Task icon marker
class TaskGutterMarker extends GutterMarker {
	text: string;
	lineNum: number;
	view: EditorView;
	plugin: TaskBoard;

	constructor(
		text: string,
		lineNum: number,
		view: EditorView,
		plugin: TaskBoard,
	) {
		super();
		this.text = text;
		this.lineNum = lineNum;
		this.view = view;
		this.plugin = plugin;
	}

	toDOM() {
		// Remove the padding on left side of the editor.
		// const scroller = this.view.dom.querySelector(
		// 	".cm-scroller"
		// ) as HTMLDivElement;
		const scroller = this.view.scrollDOM;
		if (scroller) scroller.addClass("tb_padding_left_0");

		const markerEl = createEl("div");
		const button = new ExtraButtonComponent(markerEl)
			.setIcon("edit")
			.setTooltip(t("edit-task"))
			.onClick(() => {
				const lineText = this.view.state.doc.line(this.lineNum).text;
				const file = this.plugin.app.workspace.getActiveFile();

				if (!file || !isTaskLine(lineText)) return false;

				const line = this.view.state.doc.line(this.lineNum);
				if (
					isLineInCodeBlockOrFrontmatter(this.view, line.from)
				) {
					return false;
				}

				// Create a save callback for the modal
				const saveTask = async (
					updatedTask: unknown,
					quickAddPluginChoice: string,
				) => {
					// This will be handled by the existing task saving logic
					// The modal will update the file content automatically
					// console.log("Task updated via gutter marker:", updatedTask);
				};

				// Open the TaskEditorModal
				const modal = new TaskEditorModal(
					this.plugin,
					saveTask,
					false,
					true, // activeNote
					true, // taskExists (we're editing an existing task)
					undefined, // task - let the modal parse it from the line
					file.path, // filePath
				);
				modal.open();
				return true;
			});

		button.extraSettingsEl.addClass("task-board-task-gutter-marker");
		return button.extraSettingsEl;
	}
}

/**
 * Task Gutter Extension
 */
export function taskGutterExtension(app: App, plugin: TaskBoard): Extension {
	return [
		gutter({
			class: "task-board-task-gutter",
			lineMarker(view, line) {
				// const file = plugin.app.workspace.getActiveFile();
				// console.log("Active file in taskGutterExtension:", file);
				const lineText = view.state.doc.lineAt(line.from).text;
				const lineNumber = view.state.doc.lineAt(line.from).number;
				// console.log("The view state:", view.state);

				// Skip if not a task
				if (!isTaskLine(lineText)) return null;

				if (isLineInCodeBlockOrFrontmatter(view, line.from)) {
					return null;
				}

				return new TaskGutterMarker(lineText, lineNumber, view, plugin);
			},
		}),
	];
}
