/**
 * Task Gutter Handler - Handles interaction for task markers in the gutter.
 * Displays a marker in front of task lines; clicking it opens AddOrEditTaskModal.
 */

import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { App, ExtraButtonComponent } from "obsidian";
import TaskBoard from "main";
import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { isTaskLine } from "src/utils/CheckBoxUtils";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";

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
		plugin: TaskBoard
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
		if (scroller) scroller.style.paddingLeft = "0";

		const markerEl = createEl("div");
		const button = new ExtraButtonComponent(markerEl)
			.setIcon("edit")
			.setTooltip("Edit Task")
			.onClick(() => {
				const lineText = this.view.state.doc.line(this.lineNum).text;
				const file = this.plugin.app.workspace.getActiveFile();

				if (!file || !isTaskLine(lineText)) return false;

				// Check if the line is in a codeblock or frontmatter
				const line = this.view.state.doc.line(this.lineNum);
				const syntaxNode = syntaxTree(this.view.state).resolveInner(
					line.from + 1
				);
				const nodeProps = syntaxNode.type.prop(tokenClassNodeProp);

				if (nodeProps) {
					const props = nodeProps.split(" ");
					if (
						props.includes("hmd-codeblock") ||
						props.includes("hmd-frontmatter")
					) {
						return false;
					}
				}

				// Create a save callback for the modal
				const saveTask = (
					updatedTask: any,
					quickAddPluginChoice: string
				) => {
					// This will be handled by the existing task saving logic
					// The modal will update the file content automatically
					console.log("Task updated via gutter marker:", updatedTask);
				};

				// Open the AddOrEditTaskModal
				const modal = new AddOrEditTaskModal(
					this.plugin,
					saveTask,
					false,
					true, // activeNote
					true, // taskExists (we're editing an existing task)
					undefined, // task - let the modal parse it from the line
					file.path // filePath
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

				// Check if the line is in a codeblock or frontmatter
				const syntaxNode = syntaxTree(view.state).resolveInner(
					line.from + 1
				);
				const nodeProps = syntaxNode.type.prop(tokenClassNodeProp);

				if (nodeProps) {
					const props = nodeProps.split(" ");
					if (
						props.includes("hmd-codeblock") ||
						props.includes("hmd-frontmatter")
					) {
						return null;
					}
				}

				return new TaskGutterMarker(lineText, lineNumber, view, plugin);
			},
		}),
	];
}
