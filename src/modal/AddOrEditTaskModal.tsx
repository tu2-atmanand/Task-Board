// /src/modal/AddOrEditTaskModal.tsx

import { Modal, normalizePath } from "obsidian";
import React from "react";
import { taskItem, taskStatuses } from "src/interfaces/TaskItem";

import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import ReactDOM from "react-dom/client";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { getFormattedTaskContent } from "src/utils/TaskContentFormatter";
import { generateTaskId } from "src/utils/VaultScanner";
import { readDataOfVaultFile } from "src/utils/MarkdownFileOperations";
import { getLocalDateTimeString } from "src/utils/TimeCalculations";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { AddOrEditTaskRC } from "src/components/AddOrEditTaskRC";

const taskItemEmpty: taskItem = {
id: 0,
legacyId: "",
title: "",
body: [],
createdDate: "",
startDate: "",
scheduledDate: "",
due: "",
tags: [],
frontmatterTags: [],
time: "",
priority: 0,
reminder: "",
completion: "",
cancelledDate: "",
filePath: "",
taskLocation: {
startLine: 0,
startCharIndex: 0,
endLine: 0,
endCharIndex: 0,
},
status: taskStatuses.unchecked,
};

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

this.modalEl.setAttribute('data-type', 'task-board-view');
contentEl.setAttribute('data-type', 'task-board-view');

const root = ReactDOM.createRoot(this.contentEl);

this.setTitle(this.taskExists ? t("edit-task") : t("add-new-task"));

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
this.rejectPromise("Task was not submitted.")
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
this.rejectPromise("Task was not submitted.")
this.onClose();
super.close();
}
}
}
