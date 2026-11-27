// /src/modal/TaskEditorModal.tsx

import { t } from "i18next";
import { Modal, normalizePath } from "obsidian";
import ReactDOM from "react-dom/client";
import TaskBoard from "../../../main.js";
import { TaskEditorRC } from "../components/TaskEditorRC.js";
import { DEFAULT_SETTINGS } from "../../interfaces/GlobalSettings.js";
import { EMPTY_TASK_ITEM } from "../../interfaces/Mapping.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import { allowedFileExtensionsRegEx } from "../../utils/regular_expressions/MiscelleneousRegExpr.js";
import { getCurrentLocalDateTimeString } from "../../utils/DateTimeCalculations.js";
import { readDataOfVaultFile } from "../../utils/MarkdownFileOperations.js";
import { getFormattedTaskContent, getSanitizedTaskContent } from "../../utils/task_line/TaskContentFormatter.js";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../interfaces/Enums.js";
import { populateInitialValues } from "../../utils/TaskItemUtils.js";



// Class component extending Modal for Obsidian
export class TaskEditorModal extends Modal {
	plugin: TaskBoard;
	task: taskItem = { ...EMPTY_TASK_ITEM };
	filePath: string;
	taskExists: boolean;
	isEdited: boolean;
	isTaskNote: boolean;
	activeNote: boolean;
	saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => Promise<void>;

	public waitForClose: Promise<string>;
	private resolvePromise: (input: string) => void = (input: string) => { };
	private rejectPromise: (reason?: unknown) => void = (reason?: unknown) => { };

	constructor(plugin: TaskBoard, saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => Promise<void>, isTaskNote: boolean, activeNote: boolean, taskExists: boolean, task?: taskItem, filePath?: string) {
		super(plugin.app);
		this.plugin = plugin;
		this.filePath = filePath ? filePath : "";
		this.taskExists = taskExists;
		this.saveTask = saveTask;
		this.task = task ? { ...task } : { ...EMPTY_TASK_ITEM };
		this.isEdited = false;
		this.isTaskNote = isTaskNote;
		this.activeNote = activeNote;

		this.waitForClose = new Promise<string>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.containerEl.setAttribute('modal-type', 'task-board-edit-task');
		this.modalEl.setAttribute('modal-type', 'task-board-edit-task');
		this.modalEl.addClass('task-board-task-editor-modal');
		contentEl.setAttribute('modal-type', 'task-board-edit-task');

		const root = ReactDOM.createRoot(this.contentEl);

		this.setTitle(this.taskExists ? t("edit-task") : t("add-new-task"));

		// If adding a new task (taskExists = false) OR editing a task and the task dont have an id 
		// Then, check if user has allowed to auto add ID and assign a new id.
		if (this.plugin.settings.data.autoAddUniqueID && (!this.taskExists || !this.task[DEFAULT_TASK_CACHE_KEYS.ID])) {
			this.task[DEFAULT_TASK_CACHE_KEYS.ID] = this.plugin.vaultScanner.generateTaskId();
			this.task[DEFAULT_TASK_CACHE_KEYS.LegacyID] = this.task[DEFAULT_TASK_CACHE_KEYS.ID];
		}

		// If adding a new task, populate the initial values configured by user.
		if (!this.taskExists) {
			this.task = populateInitialValues(this.plugin, this.task, this.filePath);
		}

		// Some processing, if this is a Task-Note
		let noteContent: string = "";
		if (this.isTaskNote) {
			if (this.taskExists) {
				const data = await readDataOfVaultFile(this.plugin, this.filePath, true);

				if (data == null) this.onClose();
				else noteContent = data;

				if (!this.task[DEFAULT_TASK_CACHE_KEYS.Title]) this.task[DEFAULT_TASK_CACHE_KEYS.Title] = this.filePath.split('/').pop()?.replace(allowedFileExtensionsRegEx, "") ?? "";
			} else {
				noteContent = "---\ntitle: \n---\n";

				const defaultLocation = normalizePath(this.plugin.settings.data.taskNoteDefaultLocation || DEFAULT_SETTINGS.data.taskNoteDefaultLocation);
				this.task[DEFAULT_TASK_CACHE_KEYS.Title] = "";

				// Sanitize filename
				const noteName = this.task[DEFAULT_TASK_CACHE_KEYS.Title] || getCurrentLocalDateTimeString();
				const sanitizedName = noteName.replace(/[<>:"/\\|?*]/g, '_');
				this.filePath = normalizePath(`${defaultLocation}/${sanitizedName}.md`);
			}
		} else {
			this.task[DEFAULT_TASK_CACHE_KEYS.Title] = getSanitizedTaskContent(this.plugin.settings.data, this.task).split("\n")[0];

			if (!this.task[DEFAULT_TASK_CACHE_KEYS.Title])
				this.task[DEFAULT_TASK_CACHE_KEYS.Title] = "- [ ] ";
		}

		root.render(<TaskEditorRC
			plugin={this.plugin}
			root={contentEl}
			isTaskNote={this.isTaskNote}
			noteContent={noteContent}
			task={this.task}
			taskExists={this.taskExists}
			activeNote={this.activeNote}
			filePath={this.filePath}
			onSave={async (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => {
				this.isEdited = false;
				const formattedContent = await getFormattedTaskContent(updatedTask);
				this.resolvePromise(formattedContent);
				void this.saveTask(updatedTask, quickAddPluginChoice, updatedNoteContent);
				this.close();
			}}
			onClose={() => this.close()}
			setIsEdited={(value: boolean) => { this.isEdited = value; }}
		/>);
	}

	handleCloseAttempt() {
		// Open confirmation modal
		const mssg = t("edit-task-modal-close-confirm-mssg");
		const closeConfirmModal = new ClosePopupConfrimationModal(this.app, {
			app: this.app,
			mssg,
			onDiscard: () => {
				this.isEdited = false;
				this.resolvePromise("");
				this.close();
			},
			onGoBack: () => {
				// Do nothing
			}
		});
		closeConfirmModal.open();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	public close(): void {
		if (this.isEdited) {
			this.handleCloseAttempt();
		} else {
			this.modalEl.addClass("slide-out");
			this.resolvePromise("");
			this.onClose();
			super.close();
		}
	}
}
