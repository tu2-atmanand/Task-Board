// /src/utils/TaskItemUtils.ts

import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "./TaskContentFormatter";
import { taskItem } from "src/interfaces/TaskItem";
import {
	readDataOfVaultFile,
	writeDataToVaultFile,
} from "../MarkdownFileOperations";

import { normalizePath, Notice } from "obsidian";
import TaskBoard from "main";
import { TasksPluginApi } from "src/services/tasks-plugin/api";
import { openDiffContentCompareModal } from "src/services/OpenModals";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { isTheContentDiffAreOnlySpaces_V2 } from "src/modals/DiffContentCompareModal";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

/**
 * This function will simpy check if the task title contains the recurring tag:
 * If the task title contains the recurring tag, it will return true.
 * If the task title does not contain the recurring tag, it will return false.
 * @param taskTitle - The title of the task to check.
 * @returns Returns true if the task title contains the recurring tag, otherwise false.
 */
export const isTaskRecurring = (taskTitle: string): boolean => {
	// This function will simly check if the task title contatins the recurring tag: 🔁
	const recurringTagRegex = /🔁/u;
	if (recurringTagRegex.test(taskTitle)) {
		return true;
	}
	// If the recurring tag is not found, return false
	return false;
};

/**
 * Adds a new task to a note file.
 * @param {plugin} plugin - plugin instance
 * @param {newTask} newTask - taskItem object that needs to be added to the file
 * @param {boolean} editorActive - Whether to add the task to the file active or not
 * @param {cursorPosition} cursorPosition - The position at which the task should be added
 * @returns A promise that resolves with a string representing the ID of the task
 */
export const addTaskInNote = async (
	plugin: TaskBoard,
	newTask: taskItem,
	editorActive: boolean,
	cursorPosition?: { line: number; ch: number } | undefined,
): Promise<string | undefined> => {
	const filePath = newTask.filePath.endsWith("md")
		? newTask.filePath
		: `${newTask.filePath}.md`;

	try {
		// Clean the task title to ensure it doesn't contain any special characters
		if (!(await plugin.fileExists(filePath))) {
			new Notice(
				`New note created since it does not exists : "${filePath}"`,
				5000,
			);
			const normalizedPath = normalizePath(filePath);
			// Check if the directory exists, create if not
			const parts = normalizedPath.split("/");
			if (parts.length > 1) {
				const dirPath = parts.slice(0, -1).join("/").trim();
				if (!(await plugin.app.vault.adapter.exists(dirPath))) {
					await plugin.app.vault.createFolder(dirPath);
				}
			}

			// Create a new file if it doesn't exist
			await plugin.app.vault.create(normalizedPath, "");

			await sleep(200);
		}

		let completeTask = await getFormattedTaskContent(newTask);
		const { formattedTaskContent, newId } = await addIdToTaskContent(
			plugin,
			completeTask,
		);
		completeTask = formattedTaskContent;
		if (completeTask === "")
			throw "getSanitizedTaskContent returned empty string";

		// Read the file content
		const fileContent = await readDataOfVaultFile(plugin, filePath, true);
		if (fileContent == null) return;

		let newContent = fileContent;

		if (editorActive) {
			// Split file content into an array of lines
			const fileLines = fileContent.split("\n");
			if (cursorPosition && cursorPosition.line > 0) {
				// Insert the new task at the cursor line position
				fileLines.splice(cursorPosition.line, 0, completeTask);
				// Join the lines back into a single string
				newContent = fileLines.join("\n");
			} else {
				newContent = fileContent.concat("\n\n", completeTask);
			}

			// Write the updated content back to the file
			await writeDataToVaultFile(plugin, filePath, newContent);
		} else {
			// Join the lines back into a single string
			newContent = fileContent.concat("\n\n", completeTask);
			await writeDataToVaultFile(plugin, filePath, newContent);
		}
		cursorPosition = undefined;
		return newId;
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			47,
			"Error while adding the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/addTaskInNote",
		);
	}
};

/**
 * Replaces an old task in a file with new task content.
 * If the new task content is an empty string, it deletes the old task from the file.
 * If there are differences in whitespace only, it prompts the user for confirmation before proceeding.
 * @param {plugin} plugin - The Taskboard plugin instance.
 * @param {taskItem} updatedTask - The updated task item.
 * @param {taskItem} oldTask - The old task item to update.
 * @param {boolean} forceAddId - Whether to add the updated task to the file content.
 * @returns A promise that resolves to the ID of the updated task if successful, undefined otherwise.
 */
export const updateTaskInFile = async (
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldTask: taskItem,
	forceAddId?: boolean,
): Promise<string | undefined> => {
	try {
		const oldTaskContent = await getFormattedTaskContent(oldTask);
		if (oldTaskContent === "")
			bugReporterManagerInsatance.showNotice(
				48,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile",
			);

		let updatedTaskContent = await getFormattedTaskContent(updatedTask);
		const { formattedTaskContent, newId } = await addIdToTaskContent(
			plugin,
			updatedTaskContent,
			forceAddId,
		);
		updatedTaskContent = formattedTaskContent;
		if (updatedTaskContent === "")
			bugReporterManagerInsatance.showNotice(
				49,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile",
			);

		const result = await replaceOldTaskWithNewTask(
			plugin,
			oldTask,
			oldTaskContent,
			updatedTaskContent,
		);

		if (result) {
			return newId;
		} else {
			return undefined;
		}

		// // Step 1: Read the file content
		// const fileContent = await readDataOfVaultFile(plugin, filePath);
		// // Step 3: Split the file content into lines
		// const lines = fileContent.split("\n");
		// const taskLines: string[] = [];
		// let isTaskFound = false;
		// let taskStartIndex = -1;

		// // Step 4: Locate the main task line and subsequent lines
		// for (let i = 0; i < lines.length; i++) {
		// 	const line = lines[i];

		// 	// Check for the task starting line (e.g., "- [ ] Title...")
		// 	if (
		// 		!isTaskFound &&
		// 		line.match(/^- \[.{1}\]/) &&
		// 		line.includes(oldTask.title)
		// 	) {
		// 		isTaskFound = true;
		// 		taskStartIndex = i;
		// 		taskLines.push(line);
		// 		continue;
		// 	}

		// 	// If task is found, keep adding non-empty lines
		// 	if (isTaskFound) {
		// 		if (line.startsWith("\t") || line.startsWith("    ")) {
		// 			taskLines.push(line);
		// 		} else {
		// 			break; // Stop at the first line which is either empty or doesn't start with a tab
		// 		}
		// 	}
		// }

		// // Step 5: Replace the found task block with the new one
		// if (isTaskFound && taskStartIndex !== -1) {
		// 	const taskBlock = taskLines.join("\n");

		// 	// Replace the old task block with the updated content
		// 	const newContent = fileContent.replace(taskBlock, completeTask);

		// 	// Step 6: Write the updated content back to the file
		// 	await writeDataToVaultFile(plugin, filePath, newContent);
		// } else {
		// 	bugReporterManagerInsatance.showNotice(
		// 		50,
		// 		"Looks like the task you are trying to update is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
		// 		"updateTaskInFile : Task not found in file content.",
		// 		"TaskItemUtils.ts/updateTaskInFile"
		// 	);
		// }
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			51,
			"Error while updating the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/updateTaskInFile",
		);
		return undefined;
	}
};

/**
 * Use the Tasks plugin to update the task in the file.
 *
 * @param {plugin} plugin - plugin instance
 * @param {tasksPlugin} tasksPlugin - tasks plugin instance
 * @param {oldTask} oldTask - the original task item object
 * @returns A promise that resolves with no value when the task is successfully updated in the file.
 */
export const useTasksPluginToUpdateInFile = async (
	plugin: TaskBoard,
	tasksPlugin: TasksPluginApi,
	oldTask: taskItem,
): Promise<void> => {
	try {
		// Prepare the updated task block
		const completeOldTaskContent = await getFormattedTaskContent(oldTask);
		if (completeOldTaskContent === "")
			throw "getSanitizedTaskContent returned empty string";

		if (tasksPlugin.isTasksPluginEnabled()) {
			const { formattedTaskContent, newId } = await addIdToTaskContent(
				plugin,
				oldTask.title,
			);
			const oldTaskTitleWithId = formattedTaskContent;
			const tasksPluginApiOutput =
				tasksPlugin.executeToggleTaskDoneCommand(
					oldTaskTitleWithId,
					oldTask.filePath,
				);

			// if (!tasksPluginApiOutput) {
			// 	bugReporterManagerInsatance.showNotice(
			// 		52,
			// 		"Tasks plugin API did not return any output.",
			// 		"Tasks plugin API did not return any output.",
			// 		"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
			// 	);
			// 	return;
			// }

			const twoTaskTitles = tasksPluginApiOutput.split("\n");
			// console.log(
			// 	"useTasksPluginToUpdateInFile : tasksPluginApiOutput :\n",
			// 	tasksPluginApiOutput,
			// 	"\n| first line :",
			// 	twoTaskTitles[0],
			// 	"\n| second line :",
			// 	twoTaskTitles[1],
			// 	"\n| Old task :",
			// 	completeOldTaskContent
			// );
			let newContent = "";
			if (tasksPluginApiOutput === "") {
				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent,
				);
			} else if ((twoTaskTitles.length = 1)) {
				const { formattedTaskContent, newId } =
					await addIdToTaskContent(plugin, tasksPluginApiOutput);
				const tasksPluginApiOutputWithId = formattedTaskContent;
				newContent = `${tasksPluginApiOutputWithId}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}`;
				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent,
				);
			} else if ((twoTaskTitles.length = 2)) {
				// if (twoTaskTitles[1].trim().startsWith("- [x]")) {
				newContent = `${twoTaskTitles[0]}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}\n${twoTaskTitles[1]}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}`;

				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent,
				);
				// } else if (twoTaskTitles[0].trim().startsWith("- [x]")) {
				// 	newContent = `${twoTaskTitles[0]}${
				// 		oldTask.body.length > 0
				// 			? `\n${oldTask.body.join("\n")}`
				// 			: ""
				// 	}\n${twoTaskTitles[1]}${
				// 		oldTask.body.length > 0
				// 			? `\n${oldTask.body.join("\n")}`
				// 			: ""
				// 	}`;

				// 	await replaceOldTaskWithNewTask(
				// 		plugin,
				// 		oldTask,
				// 		completeOldTaskContent,
				// 		newContent
				// 	);
				// }
			} else {
				bugReporterManagerInsatance.showNotice(
					53,
					"Unexpected output from tasks plugin API. Since the task you are trying to update is a recurring task, Task Board cannot handle recurring tasks as of now and Tasks plugin didnt returned an expected output. Please report this issue so developers can enhance the integration.",
					`tasksPluginApiOutput: ${tasksPluginApiOutput}`,
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile",
				);
				return;
			}
			// const newFileContent = fileContent.replace(
			// 	completeOldTaskContent,
			// 	newContent
			// );

			// await writeDataToVaultFile(plugin, filePath, newFileContent);

			// Just to scan the file after updating.
			// plugin.fileUpdatedUsingModal = "";
			// const scannVault = new vaultScanner(plugin.app, plugin);
			// const file = plugin.app.vault.getAbstractFileByPath(filePath);
			// if (file && file instanceof TFile)
			// 	scannVault.refreshTasksFromFiles([file]);
			// eventEmitter.emit("REFRESH_COLUMN");
		} else {
			//fallback to normal function
			// await updateTaskInFile(plugin, updatedTask, oldTask);

			bugReporterManagerInsatance.showNotice(
				54,
				"Tasks plugin is must for handling recurring tasks. Since the task you are trying to update is a recurring task and Task Board cannot handle recurring tasks as of now. Hence the plugin has not updated your content.",
				`Tasks plugin installed and enabled: ${tasksPlugin.isTasksPluginEnabled()}`,
				"TaskItemUtils.ts/useTasksPluginToUpdateInFile",
			);
		}
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			55,
			"Error while updating the recurring task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/useTasksPluginToUpdateInFile",
		);
		throw error;
	}
};

/**
 * Deletes a task from a file.
 *
 * @param plugin - The Taskboard plugin instance used to access settings and perform file operations.
 * @param task - The taskItem object representing the task to be deleted.
 * @returns A promise that resolves with a boolean indicating whether the task was successfully deleted from the file.
 */
export const deleteTaskFromFile = async (
	plugin: TaskBoard,
	task: taskItem,
): Promise<boolean> => {
	try {
		const oldTaskContent = await getFormattedTaskContent(task);
		if (oldTaskContent === "")
			bugReporterManagerInsatance.showNotice(
				56,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile",
			);

		await replaceOldTaskWithNewTask(
			plugin,
			task,
			oldTaskContent,
			"", // Empty string indicates deletion
		);

		// // Step 1: Read the file content
		// const fileContent = await readDataOfVaultFile(plugin, filePath);

		// // Step 3: Split the file content into lines
		// const lines = fileContent.split("\n");
		// const taskLines: string[] = [];
		// let isTaskFound = false;
		// let taskStartIndex = -1;

		// // Step 4: Locate the main task line and subsequent lines
		// for (let i = 0; i < lines.length; i++) {
		// 	const line = lines[i];

		// 	// Check for the task starting line (e.g., "- [ ] Title...")
		// 	if (
		// 		!isTaskFound &&
		// 		line.match(/^- \[.{1}\]/) &&
		// 		line.includes(task.title)
		// 	) {
		// 		isTaskFound = true;
		// 		taskStartIndex = i;
		// 		taskLines.push(line);
		// 		continue;
		// 	}

		// 	// If task is found, keep adding non-empty lines
		// 	if (isTaskFound) {
		// 		if (line.trim() === "") break; // Stop at the first empty line
		// 		taskLines.push(line);
		// 	}
		// }

		// // Step 5: Replace the found task block with the new one
		// if (isTaskFound && taskStartIndex !== -1) {
		// 	const taskBlock = taskLines.join("\n");

		// 	// Replace the old task block with the updated content
		// 	const newContent = fileContent.replace(taskBlock, "");

		// 	// Step 6: Write the updated content back to the file
		// 	await writeDataToVaultFile(plugin, filePath, newContent);
		// } else {
		// 	bugReporterManagerInsatance.showNotice(
		// 		plugin,
		// 		"Looks like the task you are trying to delete is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
		// 		"deleteTaskFromFile : Task not found in file content.",
		// 		"TaskItemUtils.ts/deleteTaskFromFile"
		// 	);
		// }
		return true;
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			57,
			"Error deleting task from file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/deleteTaskFromFile",
		);
		return false;
	}
};

/**
 * Archives a task by moving it to a specified archived tasks file or marking it as archived in the same file.
 *
 * This function first checks the value of `plugin.settings.data.globalSettings.archivedTasksFilePath`.
 * If this setting contains the path of the file, it removes the task from its original file and adds it
 * to the top of the specified archived file with a timestamp. If the setting does not contain a file path,
 * it marks the task as archived in the original file by surrounding the task content with '%%'.
 *
 * @param plugin - The TaskBoard plugin instance used to access settings and perform file operations.
 * @param task - The taskItem object representing the task to be archived.
 *
 * @throws Will throw an error if the getSanitizedTaskContent returns an empty string or if there are issues
 *         reading or writing to the files.
 */
export const archiveTask = async (
	plugin: TaskBoard,
	task: taskItem,
): Promise<void> => {
	const archivedFilePath =
		plugin.settings.data.globalSettings.archivedTasksFilePath;
	// Prepare the task content to be archived
	const oldTaskContent = await getFormattedTaskContent(task);
	if (oldTaskContent === "")
		throw "getSanitizedTaskContent returned empty string";

	if (archivedFilePath) {
		try {
			// Ensure the archived file exists. If not, create it.
			if (!(await plugin.fileExists(archivedFilePath))) {
				new Notice(
					`New Archived file created since it did not exist at path: "${archivedFilePath}"`,
					0,
				);
				// Ensure all folders in the path exist before creating the file
				const lastSlash = archivedFilePath.lastIndexOf("/");
				if (lastSlash !== -1) {
					const folderPath = archivedFilePath.substring(0, lastSlash);
					const parts = folderPath.split("/").filter(Boolean);
					let currentPath = "";
					for (const part of parts) {
						currentPath = currentPath
							? `${currentPath}/${part}`
							: part;

						const existing =
							plugin.app.vault.getAbstractFileByPath(currentPath);
						if (!existing) {
							// createFolder will create the single folder at currentPath
							try {
								await plugin.app.vault.createFolder(
									currentPath,
								);
							} catch (error) {
								if (String(error).contains("already exists"))
									continue;
							}
						} else {
							// If a file exists where a folder is expected, report and abort
							// (this is unlikely but safer to surface)
							// existing.type may not be available in all builds, so just check truthiness and skip create
							if (
								(existing as any).path &&
								!(existing as any).children
							) {
								bugReporterManagerInsatance.showNotice(
									58,
									`A file exists where a folder is expected: ${currentPath}`,
									`Unexpected file at folder path: ${currentPath}`,
									"TaskItemUtils.ts/archiveTask",
								);
							}
						}
					}
				}
				// Now create the archived file
				await plugin.app.vault.create(archivedFilePath, "");
			}

			// Read the content of the file where archived tasks will be stored
			const archivedFileContent = await readDataOfVaultFile(
				plugin,
				archivedFilePath,
				true
			);

			// Add the task to the top of the archived file content
			const newArchivedContent = `> Archived at ${new Date().toLocaleString()}\n${oldTaskContent}\n\n${archivedFileContent}`;

			// Write the updated content back to the archived file
			await writeDataToVaultFile(
				plugin,
				archivedFilePath,
				newArchivedContent,
			);

			// Now delete the task from its original file
			await deleteTaskFromFile(plugin, task).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(task.filePath);
			});

			// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
			// await deleteTaskFromJson(plugin, task);
		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				59,
				"Error archiving task",
				error as string,
				"TaskItemUtils.ts/archiveTask",
			);
		}
	} else if (archivedFilePath === "") {
		// If the archived file path is empty, just mark the task as archived in the same file
		try {
			await replaceOldTaskWithNewTask(
				plugin,
				task,
				oldTaskContent,
				`%%${oldTaskContent}%%`,
			).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(task.filePath);
			});

			// const newContet = fileContent.replace(
			// 	completeTask,
			// 	`%%${completeTask}%%`
			// );

			// // Write the updated content back to the file
			// await writeDataToVaultFile(plugin, filePath, newContet).then(
			// 	() => {
			// 		const currentFile = plugin.app.vault.getFileByPath(
			// 			task.filePath
			// 		);
			// 		plugin.realTimeScanner.processAllUpdatedFiles(currentFile);
			// 	}
			// );

			// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
			// await deleteTaskFromJson(plugin, task);
		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				60,
				"Error archiving task in the same file. Either the task is not present in the file or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
				error as string,
				"TaskItemUtils.ts/archiveTask",
			);
		}
	} else {
		bugReporterManagerInsatance.showNotice(
			61,
			"Error archiving task. The below error message might help you to find the issue.",
			"Archived file path is not set in the plugin settings.",
			"TaskItemUtils.ts/archiveTask",
		);
	}
};

/**
 * Replaces an old task in a file with new task content.
 *
 * If the new task content is an empty string, it deletes the old task from the file.
 * If there are differences in whitespace only, it prompts the user for confirmation before proceeding.
 *
 * @param plugin - The Taskboard plugin instance used to access settings and perform file operations.
 * @param updatedTask - The taskItem object representing the task to be replaced.
 * @param oldTaskContent - The original content of the task to be replaced.
 * @param newTaskContent - The new content to replace the old task with. If empty, the old task will be deleted.
 * @throws Will throw an error if the task is not found in the file.
 */
export const replaceOldTaskWithNewTask = async (
	plugin: TaskBoard,
	oldTask: taskItem,
	oldTaskContent: string,
	newTaskContent: string,
): Promise<boolean> => {
	const filePath = allowedFileExtensionsRegEx.test(oldTask.filePath)
		? oldTask.filePath
		: `${oldTask.filePath}.md`;

	// console.log(
	// 	"replaceOldTaskWithNewTask : filePath : ",
	// 	filePath,
	// 	"\n\n\nNew Task Content : ",
	// 	newTaskContent,
	// 	"\n\n\nOld Task Content : ",
	// 	oldTaskContent
	// );

	try {
		// Step 1: Read the file content
		const fileContent = await readDataOfVaultFile(plugin, filePath, true);
		if (fileContent == null) return false;

		const lines = fileContent.split("\n");

		const { startLine, startCharIndex, endLine, endCharIndex } =
			oldTask.taskLocation;

		// Step 2: Check that the starting line is a task checkbox line
		const startLineText = lines[startLine - 1];
		if (
			!startLineText
				.trim()
				.startsWith(oldTask.title.trim().substring(0, 5))
		) {
			// console.log(
			// 	"\n\nOldTask location :",
			// 	oldTask.taskLocation,
			// 	"\n\nNewTask location :",
			// 	newTask.taskLocation,
			// 	"\n\nLine in the file at the oldTask.startLine: ",
			// 	startLineText
			// );
			bugReporterManagerInsatance.showNotice(
				62,
				`Task board couldnt able to find the task which you are trying to edit inside the file ${oldTask.filePath} at the line number : ${oldTask.taskLocation.startLine} . Looks like the file must have been edited in the absence of Task Board and the task location was misplaced. Please scan the file again using the file menu option and see if that fixes this issue.\n\nThis was actually a normal bug, but recently few users were facing this specific issue and the developers are uncertain about the exact cause of this issue. Hence will request to kindly report this issue to the developer and please metion the steps in detail which led to this issue to occur, since its not possible to find the exact cause of it by simply reading this report.`,
				`\n\nOldTask location :${JSON.stringify(
					oldTask.taskLocation,
				)}\n\nOldTask content inside task-board-cache :${
					oldTask.title
				}\n\nAt present the content inside file at line number ${
					oldTask.taskLocation.startLine
				} is: ${startLineText}`,
				"TaskItemUtils.ts/replaceOldTaskWithNewTask",
			);
			return false;
		}

		// Step 3: Extract the old task content from file using char indexes
		const linesBefore = lines.slice(0, startLine - 1);
		const taskLines = lines.slice(startLine - 1, endLine);

		// Adjust the first and last lines by slicing at char indexes
		taskLines[0] = taskLines[0].slice(startCharIndex);
		taskLines[taskLines.length - 1] = taskLines[taskLines.length - 1].slice(
			0,
			endCharIndex,
		);

		const oldTaskContentFromFile = taskLines.join("\n");

		const joinFinalNoteContent = (
			before: string,
			newTaskContent: string,
			after: string,
		) => {
			if (newTaskContent.trim() === "") {
				return `${before}${
					after ? (after.endsWith(`\n`) ? after : `${after}\n`) : "\n"
				}`;
			}

			return `${before}\n${newTaskContent}${
				after
					? newTaskContent.endsWith("\n") || after.startsWith("\n")
						? after
						: `\n${after}`
					: newTaskContent.endsWith("\n")
						? ""
						: `\n`
			}`;
		};

		// Step 4: Match with oldTaskContent
		if (oldTaskContentFromFile === oldTaskContent) {
			// Safe to replace directly
			const before = linesBefore.join("\n");
			const after = lines
				.slice(endLine - 1)
				.join("\n")
				.slice(endCharIndex);
			const newContent = joinFinalNoteContent(
				before,
				newTaskContent,
				after,
			);
			await writeDataToVaultFile(plugin, filePath, newContent);
		} else if (
			isTheContentDiffAreOnlySpaces_V2(
				oldTaskContent,
				oldTaskContentFromFile,
			)
		) {
			// If the content is only spaces, we can safely replace it
			const before = linesBefore.join("\n");
			const after = lines
				.slice(endLine - 1)
				.join("\n")
				.slice(endCharIndex);
			const newContent = joinFinalNoteContent(
				before,
				newTaskContent,
				after,
			);
			// Replace the old task block with the updated content
			await writeDataToVaultFile(plugin, filePath, newContent);
		} else {
			if (plugin.settings.data.globalSettings.safeGuardFeature) {
				// Ask user to choose between old and new content
				openDiffContentCompareModal(
					plugin,
					oldTaskContent,
					newTaskContent,
					oldTaskContentFromFile,
					async (userChoice) => {
						if (userChoice === "old") {
							const before = linesBefore.join("\n");
							const after = lines
								.slice(endLine - 1)
								.join("\n")
								.slice(endCharIndex);
							const newContent = joinFinalNoteContent(
								before,
								newTaskContent,
								after,
							);
							// Replace the old task block with the updated content
							await writeDataToVaultFile(
								plugin,
								filePath,
								newContent,
							);
						}
						// If user chooses "new", do nothing
					},
				);
			} else {
				// If safeguard feature has been disabled by the user. We will by-pass this check and instead of asking the user will directly go-ahead and replace the old content with the new content user has edited.
				const before = linesBefore.join("\n");
				const after = lines
					.slice(endLine - 1)
					.join("\n")
					.slice(endCharIndex);
				const newContent = joinFinalNoteContent(
					before,
					newTaskContent,
					after,
				);
				// Replace the old task block with the updated content
				await writeDataToVaultFile(plugin, filePath, newContent);
			}
		}

		return true; // Indicate success
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			63,
			"Error while updating the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/replaceOldTaskWithNewTask",
		);
		return false;
	}
};
