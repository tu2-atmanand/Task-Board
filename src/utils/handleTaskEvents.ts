// /src/utils/handleTaskEvents.ts

import { App, moment as _moment } from "obsidian";
import {
	deleteTaskFromFile,
	deleteTaskFromJson,
	moveFromCompletedToPending,
	moveFromPendingToCompleted,
	updateTaskInFile,
	updateTaskInJson,
} from "./TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { DeleteConfirmationModal } from "src/modal/DeleteConfirmationModal";
import { EditButtonMode } from "src/interfaces/GlobalSettings";
import { get } from "svelte/store";
import { store } from "src/shared.svelte";
import { t } from "./lang/helper";
import type { taskItem } from "src/interfaces/TaskItemProps";

// import store, {
// 	allTaskItemsToDisplay,
// 	plugin,
// 	taskBoardSettings,
// } from "src/store";

export const handleSubTasksChange = (updatedTask: taskItem) => {
	console.log(
		"handleSubTasksChange : Here is the updatedTask :",
		updatedTask
	);
	const plugin = store.plugin;
	if (plugin) {
		updateTaskInJson(updatedTask);
		updateTaskInFile(plugin, updatedTask, updatedTask);
	}
};

export const handleCheckboxChange = (updatedTask: taskItem) => {
	const myPlugin = store.plugin;
	// const moment = require("moment");

	const updatedTasks = store.allTaskItemsToDisplay.filter(
		(t: taskItem) => t.id !== updatedTask.id
	);
	store.allTaskItemsToDisplay = updatedTasks; // Update state to remove completed task

	// Check if the task is completed
	if (updatedTask.completed && myPlugin) {
		const taskWithCompleted = { ...updatedTask, completed: "" };
		// Move from Completed to Pending
		moveFromCompletedToPending(myPlugin, taskWithCompleted);
		updateTaskInFile(myPlugin, taskWithCompleted, taskWithCompleted);
	} else if (myPlugin) {
		const moment = _moment as unknown as typeof _moment.default;
		const taskWithCompleted = {
			...updatedTask,
			completed: moment().format(
				store.taskBoardSettings?.taskCompletionDateTimePattern
			),
		};
		// Move from Pending to Completed
		moveFromPendingToCompleted(myPlugin, taskWithCompleted);
		updateTaskInFile(myPlugin, taskWithCompleted, taskWithCompleted);
	}
};

export const handleDeleteTask = (task: taskItem) => {
	const myPlugin = store.plugin;
	if (!myPlugin) return;
	const app = myPlugin?.app;
	const mssg = t(61);
	const deleteModal = new DeleteConfirmationModal(app, {
		app,
		mssg,
		onConfirm: () => {
			deleteTaskFromFile(myPlugin, task);
			deleteTaskFromJson(myPlugin, task);
			// Remove the task from state after deletion
			const newTasks = store.allTaskItemsToDisplay.filter(
				(t: taskItem) => t.id !== task.id
			);
			store.allTaskItemsToDisplay = newTasks;
		},
		onCancel: () => {
			// console.log('Task deletion canceled');
		},
	});
	deleteModal.open();
};

export const handleEditTask = (task: taskItem) => {
	const myPlugin = store.plugin;
	if (!myPlugin) return;
	if (
		myPlugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.PopUp
	) {
		const editModal = new AddOrEditTaskModal(
			myPlugin.app,
			myPlugin,
			(updatedTask: taskItem) => {
				updatedTask.filePath = task.filePath;
				// Update the task in the file and JSON
				updateTaskInFile(myPlugin, updatedTask, task);
				updateTaskInJson(updatedTask);
			},
			task.filePath,
			true,
			task
		);
		editModal.open();
	} else if (
		myPlugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInTab
	) {
		const getFile = myPlugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			myPlugin.app.workspace.getLeaf("tab").openFile(getFile);
		}
	} else if (
		myPlugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInSplit
	) {
		const getFile = myPlugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			myPlugin.app.workspace.getLeaf("split").openFile(getFile);
		}
	} else if (
		myPlugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInWindow
	) {
		const getFile = myPlugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			myPlugin.app.workspace.getLeaf("window").openFile(getFile);
		}
	} else {
		// markdownButtonHoverPreviewEvent(app, event, task.filePath);
	}
};
