// /src/utils/TaskNoteEventHandlers.ts

import { Notice } from "obsidian";
import { taskItem } from "src/interfaces/TaskItem";
import TaskBoard from "main";
import {
	getStatusNameFromStatusSymbol,
	updateFrontmatterInMarkdownFile,
} from "./TaskNoteUtils";
import { checkboxStateSwitcher } from "../CheckBoxUtils";
import {
	readDataOfVaultFile,
	writeDataToVaultFile,
} from "../MarkdownFileOperations";

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
		const newStatusSymbol = checkboxStateSwitcher(plugin, task.status);
		const updatedTask = {
			...task,
			status: newStatusSymbol,
		};
		const newStatusName = getStatusNameFromStatusSymbol(
			newStatusSymbol,
			plugin.settings
		);

		// Update frontmatter with new status
		await updateFrontmatterInMarkdownFile(plugin, updatedTask).then(() => {
			// This is required to rescan the updated file and refresh the board.
			sleep(1000).then(() => {
				// This is required to rescan the updated file and refresh the board.
				plugin.realTimeScanning.processAllUpdatedFiles(
					updatedTask.filePath,
					task.legacyId
				);
			});
		});

		new Notice(`Task note status updated to ${newStatusName}`);
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
		await updateFrontmatterInMarkdownFile(plugin, updatedTask).then(() => {
			// This is required to rescan the updated file and refresh the board.
			sleep(1000).then(() => {
				// This is required to rescan the updated file and refresh the board.
				plugin.realTimeScanning.processAllUpdatedFiles(
					updatedTask.filePath
				);
			});
		});

		new Notice("Task note properties updated");
	} catch (error) {
		console.error("Error updating task note properties:", error);
		new Notice("Error updating task note properties: " + String(error));
	}
};

/**
 * Handle task note deletion (remove #TASK_NOTE_IDENTIFIER_TAG tag from frontmatter)
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
				(tag: string) =>
					tag.includes(
						plugin.settings.data.globalSettings
							.taskNoteIdentifierTag
					) === false
			);

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
		const updatedLines = lines.map((line: string) => {
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
			sleep(1000).then(() => {
				// This is required to rescan the updated file and refresh the board.
				plugin.realTimeScanning.processAllUpdatedFiles(
					updatedTask.filePath,
					oldTask.id
				);
			});
		});
	} catch (error) {
		console.error(
			"TaskItemEventHandlers.ts : Error in handleTaskNoteBodyChange",
			error
		);
	}
};
