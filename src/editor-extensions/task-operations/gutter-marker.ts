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
	app: App;
	plugin: TaskBoard;

	constructor(
		text: string,
		lineNum: number,
		view: EditorView,
		app: App,
		plugin: TaskBoard
	) {
		super();
		this.text = text;
		this.lineNum = lineNum;
		this.view = view;
		this.app = app;
		this.plugin = plugin;
	}

	toDOM() {
		const markerEl = createEl("div");
		const button = new ExtraButtonComponent(markerEl)
			.setIcon("edit")
			.setTooltip("Edit Task")
			.onClick(() => {
				const lineText = this.view.state.doc.line(this.lineNum).text;
				const file = this.app.workspace.getActiveFile();

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
				const saveTask = (updatedTask: any, quickAddPluginChoice: string) => {
					// This will be handled by the existing task saving logic
					// The modal will update the file content automatically
					console.log("Task updated via gutter marker:", updatedTask);
				};

				// Open the AddOrEditTaskModal
				const modal = new AddOrEditTaskModal(
					this.app, 
					this.plugin, 
					saveTask,
					true, // activeNote
					true, // taskExists (we're editing an existing task)
					undefined, // task - let the modal parse it from the line
					file.path // filePath
				);
				modal.open();
				return true;
			});

		button.extraSettingsEl.addClass("task-gutter-marker");
		return button.extraSettingsEl;
	}
}

/**
 * Task Gutter Extension
 */
export function taskGutterExtension(
	app: App,
	plugin: TaskBoard
): Extension {
	return [
		gutter({
			class: "task-gutter",
			lineMarker(view, line) {
				const lineText = view.state.doc.lineAt(line.from).text;
				const lineNumber = view.state.doc.lineAt(line.from).number;

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

				return new TaskGutterMarker(
					lineText,
					lineNumber,
					view,
					app,
					plugin
				);
			},
		}),
	];
}