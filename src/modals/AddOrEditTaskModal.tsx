// /src/modal/AddOrEditTaskModal.tsx

import { Modal, normalizePath } from "obsidian";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import ReactDOM from "react-dom/client";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { getFormattedTaskContent } from "src/utils/taskLine/TaskContentFormatter";
import { readDataOfVaultFile } from "src/utils/MarkdownFileOperations";
import { getCurrentLocalTimeString } from "src/utils/DateTimeCalculations";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { AddOrEditTaskRC } from "src/components/AddOrEditTaskRC";
import { taskItemEmpty } from "src/interfaces/Mapping";
import { taskItem } from "src/interfaces/TaskItem";
import { generateTaskId } from "src/utils/TaskItemUtils";


// Class component extending Modal for Obsidian
export class AddOrEditTaskModal extends Modal {
	plugin: TaskBoard;
	task: taskItem = taskItemEmpty;
	filePath: string;
	taskExists: boolean;
	isEdited: boolean;
	isTaskNote: boolean;
	activeNote: boolean;
	saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void;

	public waitForClose: Promise<string>;
	private resolvePromise: (input: string) => void = (input: string) => { };
	private rejectPromise: (reason?: unknown) => void = (reason?: unknown) => { };

	constructor(plugin: TaskBoard, saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void, isTaskNote: boolean, activeNote: boolean, taskExists: boolean, task?: taskItem, filePath?: string) {
		super(plugin.app);
		this.plugin = plugin;
		this.filePath = filePath ? filePath : "";
		this.taskExists = taskExists;
		this.saveTask = saveTask;
		if (taskExists && task) {
			this.task = task;
		}
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
		contentEl.setAttribute('modal-type', 'task-board-edit-task');

		const root = ReactDOM.createRoot(this.contentEl);

		this.setTitle(this.taskExists ? t("edit-task") : t("add-new-task"));

		if (this.plugin.settings.data.globalSettings.autoAddUniqueID && (!this.taskExists || !this.task.id)) {
			this.task.id = generateTaskId(this.plugin);
			this.task.legacyId = this.task.id;
		}

		// Some processing, if this is a Task-Note
		let noteContent: string = "";
		if (this.isTaskNote) {
			if (this.filePath) {
				const data = await readDataOfVaultFile(this.plugin, this.filePath);

				if (data == null) this.onClose();
				else noteContent = data;
			} else {
				noteContent = "---\ntitle: \n---\n";

				const defaultLocation = this.plugin.settings.data.globalSettings.taskNoteDefaultLocation || 'Meta/Task_Board/Task_Notes';
				const noteName = this.task.title || getCurrentLocalTimeString();
				// Sanitize filename
				const sanitizedName = noteName.replace(/[<>:"/\\|?*]/g, '_');
				this.filePath = normalizePath(`${defaultLocation}/${sanitizedName}.md`);
			}

			if (!this.task.title) this.task.title = this.filePath.split('/').pop()?.replace(allowedFileExtensionsRegEx, "") ?? "Untitled";
		} else {
			if (!this.taskExists)
				this.task.title = "- [ ] ";
		}

		root.render(<AddOrEditTaskRC
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
				this.saveTask(updatedTask, quickAddPluginChoice, updatedNoteContent);
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
			this.modalEl.addClass(".slide-out");
			sleep(300);
			this.resolvePromise("");
			this.onClose();
			super.close();
		}
	}
}
