// /src/utils/TaskItemUtils.ts

import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "./TaskContentFormatter";
import {
	loadJsonCacheDataFromDisk,
	writeJsonCacheDataFromDisk,
} from "./JsonFileOperations";
import { jsonCacheData, taskItem } from "src/interfaces/TaskItem";
import {
	readDataOfVaultFile,
	writeDataToVaultFile,
} from "./MarkdownFileOperations";

import { Notice } from "obsidian";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { TasksApi } from "src/services/tasks-plugin/api";
import {
	bugReporter,
	openDiffContentCompareModal,
} from "src/services/OpenModals";
import { isTheContentDiffAreOnlySpaces } from "src/modal/DiffContentCompareModal";
import {
	extractFrontmatter,
	extractFrontmatterTags,
} from "./FrontmatterOperations";
import { generateTaskId } from "./VaultScanner";

export const moveFromPendingToCompleted = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Move task from Pending to Completed
		if (allTasks.Pending[task.filePath]) {
			allTasks.Pending[task.filePath] = allTasks.Pending[
				task.filePath
			].filter((t: taskItem) => t.id !== task.id);

			if (!allTasks.Completed[task.filePath]) {
				allTasks.Completed[task.filePath] = [];
			}
			allTasks.Completed[task.filePath].push(task);
		}

		// Write the updated data back to the JSON file
		await writeJsonCacheDataFromDisk(plugin, allTasks);
	} catch (error) {
		bugReporter(
			plugin,
			"Error updating task in tasks.json",
			error as string,
			"TaskItemUtils.ts/moveFromPendingToCompleted"
		);
	}

	eventEmitter.emit("REFRESH_COLUMN");
};

export const moveFromCompletedToPending = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Move task from Completed to Pending
		if (allTasks.Completed[task.filePath]) {
			allTasks.Completed[task.filePath] = allTasks.Completed[
				task.filePath
			].filter((t: taskItem) => t.id !== task.id);

			if (!allTasks.Pending[task.filePath]) {
				allTasks.Pending[task.filePath] = [];
			}
			allTasks.Pending[task.filePath].push(task);
		}

		// Write the updated data back to the JSON file
		await writeJsonCacheDataFromDisk(plugin, allTasks);
	} catch (error) {
		bugReporter(
			plugin,
			"Error updating task in tasks.json",
			error as string,
			"TaskItemUtils.ts/moveFromCompletedToPending"
		);
	}

	eventEmitter.emit("REFRESH_COLUMN");
};

// For handleDeleteTask

export const deleteTaskFromFile = async (plugin: TaskBoard, task: taskItem) => {
	try {
		const oldTaskContent = await getFormattedTaskContent(task);
		if (oldTaskContent === "")
			bugReporter(
				plugin,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile"
			);

		await replaceOldTaskWithNewTask(
			plugin,
			task,
			oldTaskContent,
			"" // Empty string indicates deletion
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
		// 	bugReporter(
		// 		plugin,
		// 		"Looks like the task you are trying to delete is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
		// 		"deleteTaskFromFile : Task not found in file content.",
		// 		"TaskItemUtils.ts/deleteTaskFromFile"
		// 	);
		// }
	} catch (error) {
		bugReporter(
			plugin,
			"Error deleting task from file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/deleteTaskFromFile"
		);
	}
};

export const deleteTaskFromJson = async (plugin: TaskBoard, task: taskItem) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Remove task from Pending or Completed in tasks.json
		if (allTasks.Pending[task.filePath]) {
			allTasks.Pending[task.filePath] = allTasks.Pending[
				task.filePath
			].filter((t: any) => t.id !== task.id);
		}
		if (allTasks.Completed[task.filePath]) {
			allTasks.Completed[task.filePath] = allTasks.Completed[
				task.filePath
			].filter((t: any) => t.id !== task.id);
		}

		await writeJsonCacheDataFromDisk(plugin, allTasks);

		eventEmitter.emit("REFRESH_COLUMN");
	} catch (error) {
		bugReporter(
			plugin,
			"Error deleting task from tasks.json",
			String(error),
			"TaskItemUtils.ts/deleteTaskFromJson"
		);
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
	task: taskItem
): Promise<void> => {
	const archivedFilePath =
		plugin.settings.data.globalSettings.archivedTasksFilePath;
	// Prepare the task content to be archived
	const oldTaskContent = await getFormattedTaskContent(task);
	if (oldTaskContent === "")
		throw "getSanitizedTaskContent returned empty string";

	if (archivedFilePath) {
		try {
			// Read the content of the file where archived tasks will be stored
			const archivedFileContent = await readDataOfVaultFile(
				plugin,
				archivedFilePath
			);

			// Add the task to the top of the archived file content
			const newArchivedContent = `> Archived at ${new Date().toLocaleString()}\n${oldTaskContent}\n\n${archivedFileContent}`;

			// Write the updated content back to the archived file
			await writeDataToVaultFile(
				plugin,
				archivedFilePath,
				newArchivedContent
			);

			// Now delete the task from its original file
			await deleteTaskFromFile(plugin, task).then(() => {
				plugin.realTimeScanning.processAllUpdatedFiles(task.filePath);
			});

			// await deleteTaskFromJson(plugin, task); // NOTE : No need to run any more as I am scanning the file after it has been updated.
			eventEmitter.emit("REFRESH_COLUMN");
		} catch (error) {
			bugReporter(
				plugin,
				"Error archiving task",
				error as string,
				"TaskItemUtils.ts/archiveTask"
			);
		}
	} else if (archivedFilePath === "") {
		// If the archived file path is empty, just mark the task as archived in the same file
		try {
			await replaceOldTaskWithNewTask(
				plugin,
				task,
				oldTaskContent,
				`%%${oldTaskContent}%%`
			);

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
			// 		plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
			// 	}
			// );

			// await deleteTaskFromJson(plugin, task); // NOTE : No need to run any more as I am scanning the file after it has been updated.
			eventEmitter.emit("REFRESH_COLUMN");
		} catch (error) {
			bugReporter(
				plugin,
				"Error archiving task in the same file. Either the task is not present in the file or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
				error as string,
				"TaskItemUtils.ts/archiveTask"
			);
		}
	} else {
		bugReporter(
			plugin,
			"Error archiving task. The below error message might help you to find the issue.",
			"Archived file path is not set in the plugin settings.",
			"TaskItemUtils.ts/archiveTask"
		);
		throw "Archived file path is not set in the plugin settings.";
	}
};

// For handleEditTask and for handleSubTasksChange, when task is edited from Modal

/*
 * Replaces an old task in a file with new task content.
 * If the new task content is an empty string, it deletes the old task from the file.
 * If there are differences in whitespace only, it prompts the user for confirmation before proceeding.
 *
 * @param plugin - The TaskBoard plugin instance used to access settings and perform file operations.
 * @param task - The taskItem object representing the task to be replaced.
 * @param oldTaskContent - The original content of the task to be replaced.
 * @param newTaskContent - The new content to replace the old task with. If empty, the old task will be deleted.
 *
 * @throws Will throw an error if there are issues reading or writing to the file.
 */
export const updateTaskInFile = async (
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldTask: taskItem
): Promise<number | undefined> => {
	try {
		console.log("updateTaskInFile : updatedTask :\n", updatedTask, oldTask);
		const oldTaskContent = await getFormattedTaskContent(oldTask);
		if (oldTaskContent === "")
			bugReporter(
				plugin,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile"
			);

		let updatedTaskContent = await getFormattedTaskContent(updatedTask);
		const { formattedTaskContent, newId } = await addIdToTaskContent(
			plugin,
			updatedTaskContent
		);
		updatedTaskContent = formattedTaskContent;
		if (updatedTaskContent === "")
			bugReporter(
				plugin,
				"getSanitizedTaskContent returned empty string for old task",
				"getSanitizedTaskContent returned empty string",
				"TaskItemUtils.ts/updateTaskInFile"
			);

		const result = await replaceOldTaskWithNewTask(
			plugin,
			oldTask,
			oldTaskContent,
			updatedTaskContent
		);

		if (result) {
			console.log(
				"updateTaskInFile : Just now finished updating the file"
			);
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
		// 	bugReporter(
		// 		plugin,
		// 		"Looks like the task you are trying to update is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
		// 		"updateTaskInFile : Task not found in file content.",
		// 		"TaskItemUtils.ts/updateTaskInFile"
		// 	);
		// }
	} catch (error) {
		bugReporter(
			plugin,
			"Error while updating the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/updateTaskInFile"
		);
		return undefined;
	}
};

// export const updateTaskInFile = async (
// 	plugin: TaskBoard,
// 	updatedTask: taskItem,
// 	oldTask: taskItem
// ) => {
// 	const filePath = updatedTask.filePath;

// 	try {
// 		// Read the file content using Obsidian's API
// 		const fileContent = await readDataOfVaultFile(plugin, filePath);
// 		console.log("updateTaskInFile : Old file content :\n", fileContent);

// 		console.log("updateTaskInFile : updatedTask :\n", updatedTask);
// 		const completeTask = getSanitizedTaskContent(plugin, updatedTask);
// 		console.log("updateTaskInFile : completeTask :\n", completeTask);

// 		if (completeTask) {
// 			let taskRegex = "";

// 			const startRegex = new RegExp(
// 				`^- \\[.{1}\\] .*?${oldTask.title}.*$`,
// 				"gm"
// 			);
// 			console.log("updateTaskInFile : startRegex :\n", startRegex);

// 			const startIndex = fileContent.search(startRegex);
// 			console.log("updateTaskInFile : startIndex :\n", startIndex);

// 			if (startIndex !== -1) {
// 				const lines = fileContent.substring(startIndex).split("\n");
// 				console.log("updateTaskInFile : lines :\n", lines);
// 				const taskContent = [];

// 				for (const line of lines) {
// 					if (line.trim() === "") {
// 						break;
// 					}
// 					taskContent.push(line);
// 				}

// 				taskRegex = taskContent.join("\n");
// 				console.log("updateTaskInFile : taskRegex :\n", taskRegex);
// 			}

// 			// Replace the old task with the updated formatted task in the file
// 			const newContent = fileContent.replace(taskRegex, completeTask);

// 			// Write the updated content back to the file using Obsidian's API
// 			await writeDataToVaultFile(plugin, filePath, newContent);
// 		}
// 	} catch (error) {
// 		console.error("Error updating task in file:", error);
// 	}
// };

export const updateTaskInJson = async (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Function to update a task in a given task category (Pending or Completed)
		const updateTasksInCategory = (taskCategory: {
			[filePath: string]: taskItem[];
		}) => {
			return Object.entries(taskCategory).reduce(
				(
					acc: { [filePath: string]: taskItem[] },
					[filePath, tasks]: [string, taskItem[]]
				) => {
					acc[filePath] = tasks.map((task: taskItem) =>
						task.id === updatedTask.id ? updatedTask : task
					);
					return acc;
				},
				{} as { [filePath: string]: taskItem[] } // Set the initial accumulator type
			);
		};

		// Update tasks in both Pending and Completed categories
		const updatedPendingTasks = updateTasksInCategory(allTasks.Pending);
		const updatedCompletedTasks = updateTasksInCategory(allTasks.Completed);

		// Create the updated data object with both updated Pending and Completed tasks
		const updatedData: jsonCacheData = {
			VaultName: plugin.app.vault.getName(),
			Modified_at: new Date().toISOString(),
			Pending: updatedPendingTasks,
			Completed: updatedCompletedTasks,
			Notes: allTasks.Notes,
		};
		// Write the updated data back to the JSON file using the new function
		await writeJsonCacheDataFromDisk(plugin, updatedData);

		eventEmitter.emit("REFRESH_COLUMN");
	} catch (error) {
		bugReporter(
			plugin,
			"Error updating task in tasks.json",
			String(error),
			"TaskItemUtils.ts/updateTaskInJson"
		);
	}
};

export const useTasksPluginToUpdateInFile = async (
	plugin: TaskBoard,
	tasksPlugin: TasksApi,
	oldTask: taskItem
): Promise<void> => {
	try {
		// Prepare the updated task block
		const completeOldTaskContent = await getFormattedTaskContent(oldTask);
		if (completeOldTaskContent === "")
			throw "getSanitizedTaskContent returned empty string";

		if (tasksPlugin.isTasksPluginEnabled()) {
			const { formattedTaskContent, newId } = await addIdToTaskContent(
				plugin,
				oldTask.title
			);
			const oldTaskTitleWithId = formattedTaskContent;
			const tasksPluginApiOutput =
				tasksPlugin.executeToggleTaskDoneCommand(
					oldTaskTitleWithId,
					oldTask.filePath
				);

			if (tasksPluginApiOutput === undefined) {
				bugReporter(
					plugin,
					"Tasks plugin API did not return any output.",
					"Tasks plugin API did not return any output.",
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
				);
				return;
			}

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
					newContent
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
					newContent
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
					newContent
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
				bugReporter(
					plugin,
					"Unexpected output from tasks plugin API. Since the task you are trying to update is a recurring task, Task Board cannot handle recurring tasks as of now and Tasks plugin didnt returned an expected output. Please report this issue so developers can enhance the integration.",
					`tasksPluginApiOutput: ${tasksPluginApiOutput}`,
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
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

			bugReporter(
				plugin,
				"Tasks plugin is must for handling recurring tasks. Since the task you are trying to update is a recurring task and Task Board cannot handle recurring tasks as of now. Hence the plugin has not updated your content.",
				`Tasks plugin installed and enabled: ${tasksPlugin.isTasksPluginEnabled()}`,
				"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
			);
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error while updating the recurring task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
		);
		throw error;
	}
};

export const applyIdToTaskInNote = async (
	plugin: TaskBoard,
	task: taskItem
): Promise<number | undefined> => {
	if (task.legacyId) {
		return;
	} else {
		await updateTaskInFile(plugin, task, task)
			.then((newId) => {
				return newId;
			})
			.catch((error) => {
				bugReporter(
					plugin,
					"Error while applying ID to the selected child task in its parent note. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
					String(error),
					"TaskItemUtils.ts/applyIdToTaskInNote"
				);
				return undefined;
			});
	}
};

// For Adding New Task from Modal

// // Generate a unique ID for each task
// export const generateTaskId = (): number => {
// 	const array = new Uint32Array(1);
// 	crypto.getRandomValues(array);
// 	return array[0];
// };

export const addTaskInJson = async (plugin: TaskBoard, newTask: taskItem) => {
	const allTasks = await loadJsonCacheDataFromDisk(plugin);

	const file = plugin.app.vault.getFileByPath(newTask.filePath);
	const frontmatter = file ? extractFrontmatter(plugin, file) : {};
	const frontmatterTags = extractFrontmatterTags(frontmatter);

	const newTaskWithId = {
		...newTask,
		id: generateTaskId(plugin),
		filePath: newTask.filePath,
		completed: "",
		frontmatterTags: frontmatterTags,
	};

	// Update the task list (assuming it's a file-based task structure)
	if (!allTasks.Pending[newTask.filePath]) {
		allTasks.Pending[newTask.filePath] = [];
	}

	allTasks.Pending[newTask.filePath].push(newTaskWithId);

	await writeJsonCacheDataFromDisk(plugin, allTasks);

	eventEmitter.emit("REFRESH_COLUMN");
};

export const addTaskInNote = async (
	plugin: TaskBoard,
	newTask: taskItem,
	editorActive: boolean,
	cursorPosition?: { line: number; ch: number } | undefined
): Promise<number | undefined> => {
	const filePath = newTask.filePath.endsWith(".md")
		? newTask.filePath
		: `${newTask.filePath}.md`;

	// Clean the task title to ensure it doesn't contain any special characters
	if (!(await plugin.fileExists(filePath))) {
		new Notice(
			`New note created since it does not exists : "${filePath}"`,
			5000
		);
		// Create a new file if it doesn't exist
		await plugin.app.vault.create(filePath, "");
	}

	try {
		let completeTask = await getFormattedTaskContent(newTask);
		const { formattedTaskContent, newId } = await addIdToTaskContent(
			plugin,
			completeTask
		);
		completeTask = formattedTaskContent;
		if (completeTask === "")
			throw "getSanitizedTaskContent returned empty string";

		// Read the file content
		const fileContent = await readDataOfVaultFile(plugin, filePath);
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
		bugReporter(
			plugin,
			"Error while adding the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/addTaskInNote"
		);
	}
};

// Function to parse due date correctly
export const parseUniversalDate = (dateStr: string): Date | null => {
	// Regular expression to check if dueStr starts with a two-digit day
	const ddMmYyyyPattern = /^\d{2}-\d{2}-\d{4}$/;

	if (ddMmYyyyPattern.test(dateStr)) {
		// Convert "DD-MM-YYYY" → "YYYY-MM-DD"
		const [day, month, year] = dateStr.split("-");
		dateStr = `${year}-${month}-${day}`;
	}

	// Parse the date
	const parsedDate = new Date(dateStr);
	return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

// Function to get all tags from a task (both line tags and frontmatter tags)
export const getAllTaskTags = (task: taskItem): string[] => {
	const lineTags = task.tags || [];
	const frontmatterTags = task.frontmatterTags || [];
	return [...lineTags, ...frontmatterTags];
};

export const replaceOldTaskWithNewTask = async (
	plugin: TaskBoard,
	oldTask: taskItem,
	oldTaskContent: string,
	newTaskContent: string
): Promise<boolean> => {
	const filePath = oldTask.filePath.endsWith(".md")
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
		const fileContent = await readDataOfVaultFile(plugin, filePath);
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
			bugReporter(
				plugin,
				`Task board couldnt able to find the task which you are trying to edit at the line : ${oldTask.taskLocation.startLine} . Looks like the file must have been edited in the absence of Task Board and the task location was misplaced. Please scan the file again using the file menu option.\n\nThis is a normal bug hence developer attention is not required. Just scan the file again. But if the issue persists, please report it.`,
				`\n\nOldTask location :${JSON.stringify(
					oldTask.taskLocation
				)}\n\nAt present the line at line number ${
					oldTask.taskLocation.startLine
				} is: ${startLineText}`,
				"TaskItemUtils.ts/replaceOldTaskWithNewTask"
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
			endCharIndex
		);

		const oldTaskContentFromFile = taskLines.join("\n");

		// Step 4: Match with oldTaskContent
		if (oldTaskContentFromFile === oldTaskContent) {
			// Safe to replace directly
			const before = linesBefore.join("\n");
			const after = lines
				.slice(endLine - 1)
				.join("\n")
				.slice(endCharIndex);
			const newContent = `${before}\n${newTaskContent}${
				after
					? newTaskContent.endsWith("\n") || after.startsWith("\n")
						? after
						: `\n${after}`
					: ""
			}`;
			await writeDataToVaultFile(plugin, filePath, newContent);
		} else if (
			isTheContentDiffAreOnlySpaces(
				oldTaskContent,
				oldTaskContentFromFile
			)
		) {
			// If the content is only spaces, we can safely replace it
			const before = linesBefore.join("\n");
			const after = lines
				.slice(endLine - 1)
				.join("\n")
				.slice(endCharIndex);
			const newContent = `${before}\n${newTaskContent}${
				after
					? newTaskContent.endsWith("\n") || after.startsWith("\n")
						? after
						: `\n${after}`
					: ""
			}`;
			await writeDataToVaultFile(plugin, filePath, newContent);
		} else {
			// Ask user to choose between old and new content
			openDiffContentCompareModal(
				plugin,
				oldTaskContent,
				oldTaskContentFromFile,
				async (userChoice) => {
					if (userChoice === "new") {
						const before = linesBefore.join("\n");
						const after = lines
							.slice(endLine - 1)
							.join("\n")
							.slice(endCharIndex);
						const newContent = `${before}\n${newTaskContent}${
							after
								? newTaskContent.endsWith("\n") ||
								  after.startsWith("\n")
									? after
									: `\n${after}`
								: ""
						}`;
						await writeDataToVaultFile(
							plugin,
							filePath,
							newContent
						);
					}
					// If user chooses "old", do nothing
				}
			);
		}

		console.log("Just now finished updating the file");
		return true; // Indicate success
	} catch (error) {
		bugReporter(
			plugin,
			"Error while updating the task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/replaceOldTaskWithNewTask"
		);
		return false;
	}
};

export const getTaskFromId = async (
	plugin: TaskBoard,
	id: string | number
): Promise<taskItem | null> => {
	try {
		let foundTask: taskItem | undefined;

		// Search in Pending tasks
		const pendingTasksObj = plugin.vaultScanner.tasksCache?.Pending ?? {};
		for (const tasks of Object.values(pendingTasksObj)) {
			if (typeof id === "string") {
				foundTask = tasks.find((task) => task.legacyId === id);
			} else if (typeof id === "number") {
				foundTask = tasks.find((task) => task.id === id);
			}
			if (foundTask) return foundTask;
		}

		// Search in Completed tasks
		const completedTasksObj =
			plugin.vaultScanner.tasksCache?.Completed ?? {};
		for (const tasks of Object.values(completedTasksObj)) {
			if (typeof id === "string") {
				foundTask = tasks.find((task) => task.legacyId === id);
			} else if (typeof id === "number") {
				foundTask = tasks.find((task) => task.id === id);
			}
			if (foundTask) return foundTask;
		}

		return null; // Return null if the task is not found
	} catch (error) {
		bugReporter(
			plugin,
			"Error retrieving task from tasksCache using ID",
			String(error),
			"TaskItemUtils.ts/getTaskFromId"
		);
		return null;
	}
};
