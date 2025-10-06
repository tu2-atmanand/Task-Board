// src/views/AddOrEditTaskView.tsx

import { ItemView, WorkspaceLeaf, normalizePath } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { StrictMode } from "react";

import { taskItem, taskItemEmpty, taskStatuses } from "src/interfaces/TaskItem";
import TaskBoard from "../../main";
import { VIEW_TYPE_ADD_OR_EDIT_TASK } from "src/types/uniqueIdentifiers";
import { t } from "src/utils/lang/helper";
import { AddOrEditTaskRC } from "src/components/AddOrEditTaskRC";
import { getFormattedTaskContent } from "src/utils/TaskContentFormatter";
import { generateTaskId } from "src/utils/VaultScanner";
import { readDataOfVaultFile } from "src/utils/MarkdownFileOperations";
import { getLocalDateTimeString } from "src/utils/TimeCalculations";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";


export class AddOrEditTaskView extends ItemView {
	plugin: TaskBoard;
	root: Root | null = null;
	viewTypeId: string = "";
	task: taskItem = taskItemEmpty;
	filePath: string;
	taskExists: boolean;
	isEdited: boolean;
	isTaskNote: boolean;
	activeNote: boolean;
	saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void;

	constructor(
		plugin: TaskBoard,
		leaf: WorkspaceLeaf,
		viewTypeId: string,
		saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void,
		isTaskNote: boolean,
		activeNote: boolean,
		taskExists: boolean,
		task?: taskItem,
		filePath?: string
	) {
		super(leaf);
		this.app = plugin.app;
		this.plugin = plugin;
		this.viewTypeId = viewTypeId;
		this.filePath = filePath ? filePath : "";
		this.taskExists = taskExists;
		this.saveTask = saveTask;
		if (taskExists && task) {
			this.task = task;
		}
		this.isEdited = false;
		this.isTaskNote = isTaskNote;
		this.activeNote = activeNote;
	}

	getViewType() {
		return this.viewTypeId;
	}

	getDisplayText() {
		return this.taskExists ? t("edit-task") + this.task.id : t("add-new-task");
	}

	async onOpen() {
		console.log("Container of Edit View :", this.containerEl);
		const container = this.containerEl.children[1];
		console.log("Ephemeral state in the view : ", this.getEphemeralState());
		// container.empty();
		container.setAttribute('data-type', 'task-board-view');

		if (!this.isTaskNote && this.plugin.settings.data.globalSettings.autoAddUniqueID && (!this.taskExists || !this.task.id || this.task.id === 0)) {
			this.task.id = generateTaskId(this.plugin);
			this.task.legacyId = String(this.task.id);
		}

		// Some processing, if this is a Task-Note
		let noteContent: string = "";
		if (this.isTaskNote) {
			if (this.filePath) {
				noteContent = await readDataOfVaultFile(this.plugin, this.filePath);
			} else {
				noteContent = "---\ntitle: \n---\n";

				const defaultLocation = this.plugin.settings.data.globalSettings.taskNoteDefaultLocation || 'TaskNotes';
				const noteName = this.task.title || getLocalDateTimeString();
				// Sanitize filename
				const sanitizedName = noteName.replace(/[<>:"/\\|?*]/g, '_');
				this.filePath = normalizePath(`${defaultLocation}/${sanitizedName}.md`);
			}

			if (!this.task.title) this.task.title = this.filePath.split('/').pop()?.replace(allowedFileExtensionsRegEx, "") ?? "Untitled";

			if (this.plugin.settings.data.globalSettings.autoAddUniqueID && (!this.taskExists || !this.task.id || this.task.id === 0)) {
				this.task.id = generateTaskId(this.plugin);
			}
		}

		this.root = createRoot(container);
		this.root.render(
			<StrictMode>
				<AddOrEditTaskRC
					plugin={this.plugin}
					root={container as HTMLElement}
					isTaskNote={this.isTaskNote}
					noteContent={noteContent}
					task={this.task}
					taskExists={this.taskExists}
					activeNote={this.activeNote}
					filePath={this.filePath}
					onSave={async (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => {
						this.isEdited = false;
						const formattedContent = await getFormattedTaskContent(updatedTask);
						this.saveTask(updatedTask, quickAddPluginChoice, updatedNoteContent);
						// Close the view leaf
						this.app.workspace.detachLeavesOfType(this.viewTypeId);
					}}
					onClose={() => {
						// Close the view leaf
						// this.app.workspace.detachLeavesOfType(this.viewTypeId);
					}}
					setIsEdited={(value: boolean) => { this.isEdited = value; }}
				/>
			</StrictMode>
		);
	}

	async onClose() {
		console.log("This should run while closing the tab.");
		// Clean up when view is closed
		this.root?.unmount();
	}
}
