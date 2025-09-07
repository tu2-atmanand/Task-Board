// /src/utils/TaskNoteEventHandlers.ts

import { App, Notice } from "obsidian";
import { taskItem } from "src/interfaces/TaskItem";
import TaskBoard from "main";
import { updateTaskNoteFrontmatter } from "./TaskNoteUtils";
import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { EditButtonMode } from "src/interfaces/GlobalSettings";
import {
	readDataOfVaultFile,
	writeDataToVaultFile,
} from "./MarkdownFileOperations";
import { checkboxStateSwitcher } from "./CheckBoxUtils";

/**
 * Handle editing a task note
 * @param plugin - TaskBoard plugin instance
 * @param app - Obsidian app instance
 * @param task - Task note to edit
 */
export const handleTaskNoteEdit = (plugin: TaskBoard, task: taskItem) => {
	const editButtonAction =
		plugin.settings.data.globalSettings.editButtonAction;

	if (editButtonAction === EditButtonMode.PopUp) {
		// Open task note in edit modal
		const editTaskModal = new AddOrEditTaskModal(
			plugin,
			async (
				updatedTask: taskItem,
				quickAddPluginChoice: string,
				newTaskContent: string | undefined
			) => {
				try {
					if (!newTaskContent) {
						// Update frontmatter with task properties
						await updateTaskNoteFrontmatter(
							plugin,
							updatedTask
						).then(() => {
							// This is required to rescan the updated file and refresh the board.
							const currentFile = plugin.app.vault.getFileByPath(
								updatedTask.filePath
							);
							plugin.realTimeScanning.processAllUpdatedFiles(
								currentFile
							);
						});
					} else {
						writeDataToVaultFile(
							plugin,
							updatedTask.filePath,
							newTaskContent
						).then(() => {
							// This is required to rescan the updated file and refresh the board.
							const currentFile = plugin.app.vault.getFileByPath(
								updatedTask.filePath
							);
							plugin.realTimeScanning.processAllUpdatedFiles(
								currentFile
							);
						});
					}
					new Notice("Task note updated successfully");
				} catch (error) {
					console.error("Error updating task note:", error);
					new Notice("Error updating task note: " + String(error));
				}
			},
			true,
			false, // activeNote
			true, // taskExists
			task, // task
			task.filePath
		);
		editTaskModal.open();
	} else if (editButtonAction === EditButtonMode.NoteInTab) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("tab").openFile(getFile);
		}
	} else if (editButtonAction === EditButtonMode.NoteInSplit) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("split").openFile(getFile);
		}
	} else if (editButtonAction === EditButtonMode.NoteInWindow) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("window").openFile(getFile);
		}
	}
};

/**
 * Handle task note status change (checkbox change)
 * @param plugin - TaskBoard plugin instance
 * @param task - Task note to update
 * @param newStatus - New status symbol
 */
export const handleTaskNoteStatusChange = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const newStatus = checkboxStateSwitcher(plugin, task.status);
		const updatedTask = {
			...task,
			status: newStatus,
		};

		// Update frontmatter with new status
		await updateTaskNoteFrontmatter(plugin, updatedTask).then(() => {
			// This is required to rescan the updated file and refresh the board.
			const currentFile = plugin.app.vault.getFileByPath(
				updatedTask.filePath
			);
			plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
		});

		new Notice(`Task note status updated to ${newStatus}`);
	} catch (error) {
		console.error("Error updating task note status:", error);
		new Notice("Error updating task note status: " + String(error));
	}
};

/**
 * Handle task note property updates (dates, priority, etc.)
 * @param plugin - TaskBoard plugin instance
 * @param oldTask - Original task note
 * @param updatedTask - Updated task note
 */
export const handleTaskNotePropertyUpdate = async (
	plugin: TaskBoard,
	oldTask: taskItem,
	updatedTask: taskItem
) => {
	try {
		// Update frontmatter with all updated properties
		await updateTaskNoteFrontmatter(plugin, updatedTask).then(() => {
			// This is required to rescan the updated file and refresh the board.
			const currentFile = plugin.app.vault.getFileByPath(
				updatedTask.filePath
			);
			plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
		});

		new Notice("Task note properties updated");
	} catch (error) {
		console.error("Error updating task note properties:", error);
		new Notice("Error updating task note properties: " + String(error));
	}
};

/**
 * Handle task note deletion (remove #taskNote tag from frontmatter)
 * @param plugin - TaskBoard plugin instance
 * @param task - Task note to delete
 */
export const handleTaskNoteDelete = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const file = plugin.app.vault.getFileByPath(task.filePath);
		if (!file) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		// Get current frontmatter
		const frontmatter =
			plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (frontmatter && frontmatter.tags) {
			// Remove taskNote tag from frontmatter
			let tags = Array.isArray(frontmatter.tags)
				? [...frontmatter.tags]
				: [frontmatter.tags];
			tags = tags.filter(
				(tag: string) => tag !== "taskNote" && tag !== "#taskNote"
			);

			const updatedTask = {
				...task,
				// Update to remove taskNote tag
			};

			// If no other tags remain, we could remove the tags property entirely
			// But for now, just update with filtered tags
			// This is a simplified implementation - full YAML manipulation would be more robust

			new Notice("Task note converted back to regular note");
		}
	} catch (error) {
		console.error("Error deleting task note:", error);
		new Notice("Error deleting task note: " + String(error));
	}
};

export const handleTaskNoteBodyChange = async (
	plugin: TaskBoard,
	oldTask: taskItem,
	updatedTask: taskItem
) => {
	try {
		const file = plugin.app.vault.getFileByPath(updatedTask.filePath);
		if (!file) return;

		const fileContent = await readDataOfVaultFile(
			plugin,
			updatedTask.filePath
		);

		// Find the line representing the old task and the updated task
		// Find all lines between oldTask.body and updatedTask.body that are different
		const oldBodyLines = Array.isArray(oldTask.body) ? oldTask.body : [];
		const newBodyLines = Array.isArray(updatedTask.body)
			? updatedTask.body
			: [];

		// Find differing lines (simple diff)
		const oldLinesWhichAreModified: string[] = [];
		const maxLen = Math.max(oldBodyLines.length, newBodyLines.length);
		for (let i = 0; i < maxLen; i++) {
			if (oldBodyLines[i] !== newBodyLines[i]) {
				oldLinesWhichAreModified.push(oldBodyLines[i]);
			}
		}

		// Split content into lines and replace the old line with the new line
		const lines = fileContent.split("\n");
		const updatedLines = lines.map((line) => {
			for (const oldLine of oldLinesWhichAreModified) {
				const index = oldBodyLines.indexOf(oldLine);
				const newLine = index !== -1 ? newBodyLines[index] : "";
				return line.trim() === oldLine.trim() ? newLine : line;
			}
		});

		await writeDataToVaultFile(
			plugin,
			updatedTask.filePath,
			updatedLines.join("\n")
		).then(() => {
			// This is required to rescan the updated file and refresh the board.
			const currentFile = plugin.app.vault.getFileByPath(
				updatedTask.filePath
			);
			plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
		});
	} catch (error) {
		console.error(
			"TaskItemEventHandlers.ts : Error in handleTaskNoteBodyChange",
			error
		);
	}
};
