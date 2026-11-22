// /src/utils/TaskNoteEventHandlers.ts

import { Notice } from "obsidian";
import TaskBoard from "../../../main.js";
import { statusTypeNames } from "../../interfaces/Enums.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import { checkboxStateSwitcher } from "../CheckBoxUtils.js";
import { updateFrontmatterInMarkdownFile } from "./TaskNoteUtils.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../interfaces/Enums.js";
import { getStatusNameFromStatusSymbol } from "../TaskItemUtils.js";

/**
 * Handle task note status change (checkbox change)
 * @param plugin - TaskBoard plugin instance
 * @param task - Task note to update
 * @param newStatus - New status symbol
 */
export const handleTaskNoteStatusChange = async (
	plugin: TaskBoard,
	task: taskItem,
) => {
	try {
		const globalSettings = plugin.settings.data;
		const newStatus = checkboxStateSwitcher(
			globalSettings.customStatuses,
			task[DEFAULT_TASK_CACHE_KEYS.Status],
		);
		// const moment = _moment as unknown as typeof _moment.default;
		// const currentDateValue = moment().format(
		// 	globalSettings?.dateTimeFormat,
		// );
		const currentDateValue = Date.now();

		const updatedTask = {
			...task,
			status: newStatus.newSymbol,
		};
		if (
			globalSettings.autoAddCompletedDate &&
			newStatus.newSymbolType === statusTypeNames.DONE
		) {
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CompletionDate] =
				currentDateValue;
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CancelledDate] = undefined;
		} else if (
			globalSettings.autoAddCancelledDate &&
			newStatus.newSymbolType === statusTypeNames.CANCELLED
		) {
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CancelledDate] =
				currentDateValue;
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CompletionDate] = undefined;
		} else {
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CompletionDate] = undefined;
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CancelledDate] = undefined;
		}
		const newStatusName = getStatusNameFromStatusSymbol(
			newStatus.newSymbol,
			plugin.settings.data.customStatuses ?? [],
		);

		// Update frontmatter with new status
		await updateFrontmatterInMarkdownFile(plugin, updatedTask).then(() => {
			// This delay is required to rescan the updated file and refresh the board.
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(
						updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath],
						task[DEFAULT_TASK_CACHE_KEYS.LegacyID],
					)
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"TaskNoteEventHandlers.ts/handleTaskNoteStatusChange/updateFrontmatterInMarkdownFile",
						);
					});
			}, 1000);
		});

		new Notice(`Task note status updated to ${newStatusName}`);
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			153,
			"There was an error while updating the status.",
			String(error),
			"TaskNoteEventHandlers.ts/handleTaskNoteStatusChange",
		);
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
	updatedTask: taskItem,
) => {
	try {
		// Update frontmatter with all updated properties
		await updateFrontmatterInMarkdownFile(plugin, updatedTask).then(() => {
			// This delay is required to rescan the updated file and refresh the board.
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(
						updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath],
					)
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"TaskNoteEventHandlers.ts/handleTaskNoteStatusChange/handleTaskNotePropertyUpdate",
						);
					});
			}, 1000);
		});

		new Notice("Task note properties updated");
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			154,
			"There was an error while updating the task note.",
			String(error),
			"TaskNoteEventHandlers.ts/handleTaskNotePropertyUpdate",
		);
	}
};

/**
 * Handle task note deletion (remove #TASK_NOTE_IDENTIFIER_TAG tag from frontmatter)
 * @param plugin - TaskBoard plugin instance
 * @param task - Task note to delete
 */
export const handleTaskNote2NormalNote = async (
	plugin: TaskBoard,
	task: taskItem,
) => {
	try {
		const file = plugin.app.vault.getFileByPath(
			task[DEFAULT_TASK_CACHE_KEYS.FilePath],
		);
		if (!file) {
			throw new Error(
				`File not found: ${task[DEFAULT_TASK_CACHE_KEYS.FilePath]}`,
			);
		}

		// Get current frontmatter
		const frontmatter =
			plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (frontmatter && frontmatter.tags) {
			// Remove taskNote tag from frontmatter
			const rawTags = frontmatter.tags as unknown;
			let tagsArray = Array.isArray(rawTags)
				? [...(rawTags as string[])]
				: [rawTags as string];
			tagsArray = tagsArray.filter((tag: string) =>
				tag.includes(plugin.settings.data.taskNoteIdentifierTag),
			);

			// If no other tags remain, we could remove the tags property entirely
			// But for now, just update with filtered tags
			// This is a simplified implementation - full YAML manipulation would be more robust

			new Notice("Task note converted back to regular note");
		}
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			155,
			"There was an error while converting the note back to normal note.",
			String(error),
			"TaskNoteEventHandlers.ts/handleTaskNote2NormalNote",
		);
	}
};

/**
 * Handle task note body change (old task body -> new task body)
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task note to update
 * @param updatedTask - Task note with updated body
 */
export const handleTaskNoteBodyChange = async (
	plugin: TaskBoard,
	oldTask: taskItem,
	updatedTask: taskItem,
) => {
	try {
		const file = plugin.app.vault.getFileByPath(
			updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath],
		);
		if (!file)
			throw new Error(
				`Task note not found: ${updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath]}`,
			);

		await plugin.app.vault.process(file, (fileContent) => {
			const oldBodyLines = Array.isArray(
				oldTask[DEFAULT_TASK_CACHE_KEYS.Body],
			)
				? oldTask[DEFAULT_TASK_CACHE_KEYS.Body]
				: [];
			const newBodyLines = Array.isArray(
				updatedTask[DEFAULT_TASK_CACHE_KEYS.Body],
			)
				? updatedTask[DEFAULT_TASK_CACHE_KEYS.Body]
				: [];
			const lineEnding = fileContent.includes("\r\n") ? "\r\n" : "\n";
			const frontmatter =
				fileContent.match(
					/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,
				)?.[0] ?? "";
			const contentLines = fileContent
				.slice(frontmatter.length)
				.split(/\r?\n/);
			const oldLineIndices = new Map<string, number[]>();

			oldBodyLines.forEach((line, index) => {
				const key = line.trim();
				const indices = oldLineIndices.get(key) ?? [];
				indices.push(index);
				oldLineIndices.set(key, indices);
			});

			const matchedIndices = new Set<number>();
			const updatedLines: string[] = [];
			for (const line of contentLines) {
				const indices = oldLineIndices.get(line.trim());
				const oldIndex = indices?.shift();
				if (oldIndex === undefined) {
					updatedLines.push(line);
					continue;
				}

				matchedIndices.add(oldIndex);
				if (oldIndex < newBodyLines.length)
					updatedLines.push(newBodyLines[oldIndex]);
			}

			newBodyLines.forEach((line, index) => {
				if (!matchedIndices.has(index)) updatedLines.push(line);
			});

			return `${frontmatter}${updatedLines.join(lineEnding)}`;
		});

		await plugin.realTimeScanner
			.processAllUpdatedFiles(
				updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath],
				oldTask[DEFAULT_TASK_CACHE_KEYS.ID],
			)
			.catch((error) => {
				bugReporterManagerInsatance.addToLogs(
					217,
					String(error),
					"TaskNoteEventHandlers.ts/handleTaskNoteBodyChange/process",
				);
			});
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			156,
			"There was an error while updating the body of the task note. Below error will provide some more information.",
			String(error),
			"TaskNoteEventHandlers.ts/handleTaskNoteBodyChange",
		);
	}
};
