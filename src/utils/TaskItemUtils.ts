// /src/utils/TaskItemUtils.ts

import { cleanTaskTitle, taskContentFormatter } from "./TaskContentFormatter";
import {
	loadTasksJsonFromDisk,
	writeTasksJsonToDisk,
} from "./JsonFileOperations";
import { taskItem, tasksJson } from "src/interfaces/TaskItem";
import {
	readDataOfVaultFiles,
	writeDataToVaultFiles,
} from "./MarkdownFileOperations";

import { App, Notice, TFile } from "obsidian";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { CommunityPlugins } from "src/services/CommunityPlugins";
import { ScanningVault } from "./ScanningVault";
import { TasksApi } from "src/services/tasks-plugin/api";
import { bugReporter } from "src/services/OpenModals";

export const moveFromPendingToCompleted = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const allTasks = await loadTasksJsonFromDisk(plugin);

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
		await writeTasksJsonToDisk(plugin, allTasks);
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
		const allTasks = await loadTasksJsonFromDisk(plugin);

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
		await writeTasksJsonToDisk(plugin, allTasks);
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
	const filePath = task.filePath;

	try {
		// Step 1: Read the file content
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		// Step 3: Split the file content into lines
		const lines = fileContent.split("\n");
		const taskLines: string[] = [];
		let isTaskFound = false;
		let taskStartIndex = -1;

		// Step 4: Locate the main task line and subsequent lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check for the task starting line (e.g., "- [ ] Title...")
			if (
				!isTaskFound &&
				line.match(/^- \[.{1}\]/) &&
				line.includes(task.title)
			) {
				isTaskFound = true;
				taskStartIndex = i;
				taskLines.push(line);
				continue;
			}

			// If task is found, keep adding non-empty lines
			if (isTaskFound) {
				if (line.trim() === "") break; // Stop at the first empty line
				taskLines.push(line);
			}
		}

		// Step 5: Replace the found task block with the new one
		if (isTaskFound && taskStartIndex !== -1) {
			const taskBlock = taskLines.join("\n");

			// Replace the old task block with the updated content
			const newContent = fileContent.replace(taskBlock, "");

			// Step 6: Write the updated content back to the file
			await writeDataToVaultFiles(plugin, filePath, newContent);
		} else {
			bugReporter(
				plugin,
				"Looks like the task you are trying to delete is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
				"deleteTaskFromFile : Task not found in file content.",
				"TaskItemUtils.ts/deleteTaskFromFile"
			);
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error deleting task from file. Following the error message might help you to find the issue.",
			String(error),
			"TaskItemUtils.ts/deleteTaskFromFile"
		);
	}
};

export const deleteTaskFromJson = async (plugin: TaskBoard, task: taskItem) => {
	try {
		const allTasks = await loadTasksJsonFromDisk(plugin);

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

		await writeTasksJsonToDisk(plugin, allTasks);

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

export const archiveTask = async (plugin: TaskBoard, task: taskItem) => {
	// THis function will first going to read the value of plugin.setting.data.globalsetting.archivedTasksFile. If this settings contains the path of the file, then it will simply remove that task from its original file and put it into this new archived file at the top of the content. If the setting do not contains any file path, then it will add '%%' at the beginning and end of the task content and then paste in the same original file.
	const archivedFilePath =
		plugin.settings.data.globalSettings.archivedTasksFilePath;
	if (archivedFilePath) {
		try {
			// Read the content of the file where archived tasks will be stored
			const archivedFileContent = await readDataOfVaultFiles(
				plugin,
				archivedFilePath
			);

			// Prepare the task content to be archived
			const completeTask = taskContentFormatter(plugin, task);

			if (completeTask === "")
				throw "taskContentFormatter returned empty string";

			// Add the task to the top of the archived file content
			const newArchivedContent = `> Archived at ${new Date().toLocaleString()}\n${completeTask}\n\n${archivedFileContent}`;

			// Write the updated content back to the archived file
			await writeDataToVaultFiles(
				plugin,
				archivedFilePath,
				newArchivedContent
			);

			// Now delete the task from its original file
			await deleteTaskFromFile(plugin, task);
			await deleteTaskFromJson(plugin, task);
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
		const completeTask = taskContentFormatter(plugin, task);
		if (completeTask === "")
			throw "taskContentFormatter returned empty string";
		const filePath = task.filePath;
		try {
			// Read the file content
			const fileContent = await readDataOfVaultFiles(plugin, filePath);

			const newContet = fileContent.replace(
				completeTask,
				`%%${completeTask}%%`
			);

			// Write the updated content back to the file
			await writeDataToVaultFiles(plugin, filePath, newContet);
			await deleteTaskFromJson(plugin, task);
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
	}
};

// For handleEditTask and for handleSubTasksChange, when task is edited from Modal

export const updateTaskInFile = async (
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldTask: taskItem
) => {
	const filePath = updatedTask.filePath;

	try {
		// Step 1: Read the file content
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		// Step 2: Prepare the updated task block
		const completeTask = taskContentFormatter(plugin, updatedTask);
		if (completeTask === "")
			throw "taskContentFormatter returned empty string";

		// Step 3: Split the file content into lines
		const lines = fileContent.split("\n");
		const taskLines: string[] = [];
		let isTaskFound = false;
		let taskStartIndex = -1;

		// Step 4: Locate the main task line and subsequent lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check for the task starting line (e.g., "- [ ] Title...")
			if (
				!isTaskFound &&
				line.match(/^- \[.{1}\]/) &&
				line.includes(oldTask.title)
			) {
				isTaskFound = true;
				taskStartIndex = i;
				taskLines.push(line);
				continue;
			}

			// If task is found, keep adding non-empty lines
			if (isTaskFound) {
				if (line.startsWith("\t") || line.startsWith("    ")) {
					taskLines.push(line);
				} else {
					break; // Stop at the first line which is either empty or doesn't start with a tab
				}
			}
		}

		// Step 5: Replace the found task block with the new one
		if (isTaskFound && taskStartIndex !== -1) {
			const taskBlock = taskLines.join("\n");

			// Replace the old task block with the updated content
			const newContent = fileContent.replace(taskBlock, completeTask);

			// Step 6: Write the updated content back to the file
			await writeDataToVaultFiles(plugin, filePath, newContent);
		} else {
			bugReporter(
				plugin,
				"Looks like the task you are trying to update is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
				"updateTaskInFile : Task not found in file content.",
				"TaskItemUtils.ts/updateTaskInFile"
			);
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error updating task in file. Following the error message might help you to find the issue.",
			String(error),
			"TaskItemUtils.ts/updateTaskInFile"
		);
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
// 		const fileContent = await readDataOfVaultFiles(plugin, filePath);
// 		console.log("updateTaskInFile : Old file content :\n", fileContent);

// 		console.log("updateTaskInFile : updatedTask :\n", updatedTask);
// 		const completeTask = taskContentFormatter(plugin, updatedTask);
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
// 			await writeDataToVaultFiles(plugin, filePath, newContent);
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
		const allTasks = await loadTasksJsonFromDisk(plugin);

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
		const updatedData: tasksJson = {
			Pending: updatedPendingTasks,
			Completed: updatedCompletedTasks,
		};
		// Write the updated data back to the JSON file using the new function
		await writeTasksJsonToDisk(plugin, updatedData);

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

export const updateRecurringTaskInFile = async (
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldTask: taskItem
) => {
	const filePath = updatedTask.filePath;

	try {
		// Read the file content
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		// Prepare the updated task block
		const completeOldTaskContent = taskContentFormatter(plugin, oldTask);
		if (completeOldTaskContent === "")
			throw "taskContentFormatter returned empty string";

		// Split the file content into lines
		const lines = fileContent.split("\n");
		let isTaskFound = false;
		let taskStartIndex = -1;

		// Locate the main task line and subsequent lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (
				!isTaskFound &&
				line.match(/^- \[.{1}\]/) &&
				line.includes(oldTask.title)
			) {
				isTaskFound = true;
				taskStartIndex = i;
				break;
			}
		}

		if (isTaskFound && taskStartIndex !== -1) {
			const taskPlugin = new TasksApi(plugin);
			if (taskPlugin.isTasksPluginEnabled()) {
				const tasksPluginApiOutput =
					await taskPlugin.executeToggleTaskDoneCommand(
						`- [${oldTask.status}] ${oldTask.title}`,
						oldTask.filePath
					);

				const twoTaskTitles = tasksPluginApiOutput.split("\n");
				// console.log(
				// 	"updateRecurringTaskInFile : tasksPluginApiOutput :\n",
				// 	tasksPluginApiOutput,
				// 	"\n| first line :",
				// 	twoTaskTitles[0],
				// 	"\n| second line :",
				// 	twoTaskTitles[1]
				// );
				let newContent = "";
				if ((twoTaskTitles.length = 1)) {
					newContent = tasksPluginApiOutput;
				} else if ((twoTaskTitles.length = 2)) {
					if (twoTaskTitles[1].trim().startsWith("- [x]")) {
						newContent = `${twoTaskTitles[0]}${
							updatedTask.body.length > 0
								? `\n${updatedTask.body.join("\n")}`
								: ""
						}\n${twoTaskTitles[1]}${
							oldTask.body.length > 0
								? `\n${oldTask.body.join("\n")}`
								: ""
						}`;
					} else if (twoTaskTitles[0].trim().startsWith("- [x]")) {
						newContent = `${twoTaskTitles[0]}${
							oldTask.body.length > 0
								? `\n${oldTask.body.join("\n")}`
								: ""
						}\n${twoTaskTitles[1]}${
							updatedTask.body.length > 0
								? `\n${updatedTask.body.join("\n")}`
								: ""
						}`;
					}
				} else {
					bugReporter(
						plugin,
						"Unexpected output from tasks plugin API. Please report this issue.",
						`tasksPluginApiOutput: ${tasksPluginApiOutput}`,
						"TaskItemUtils.ts/updateRecurringTaskInFile"
					);
					return;
				}
				const newFileContent = fileContent.replace(
					completeOldTaskContent,
					newContent
				);

				await writeDataToVaultFiles(plugin, filePath, newFileContent);

				// Just to scan the file after updating.
				plugin.fileUpdatedUsingModal = "";
				const scannVault = new ScanningVault(plugin.app, plugin);
				const file = plugin.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile)
					scannVault.updateTasksFromFiles([file]);
				eventEmitter.emit("REFRESH_COLUMN");
			} else {
				//fallback to normal function
				updateTaskInFile(plugin, updatedTask, oldTask);
			}
		} else {
			bugReporter(
				plugin,
				"Looks like the recurring task you are trying to update is not present in the file. Or the plugin is not able to find the correct match, because the task must have been edited in such a way that the title is not present in the file.",
				"updateRecurringTaskInFile : Task not found in file content.",
				"TaskItemUtils.ts/updateRecurringTaskInFile"
			);
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error updating recurring task in file. Following the error message might help you to find the issue.",
			String(error),
			"TaskItemUtils.ts/updateRecurringTaskInFile"
		);
	}
};

// For Adding New Task from Modal

// Generate a unique ID for each task
export const generateTaskId = (): number => {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0];
};

export const addTaskInJson = async (plugin: TaskBoard, newTask: taskItem) => {
	const allTasks = await loadTasksJsonFromDisk(plugin);

	const newTaskWithId = {
		...newTask,
		id: generateTaskId(),
		filePath: newTask.filePath,
		completed: "", // This will be updated when task is marked as complete
	};

	// Update the task list (assuming it's a file-based task structure)
	if (!allTasks.Pending[newTask.filePath]) {
		allTasks.Pending[newTask.filePath] = [];
	}

	allTasks.Pending[newTask.filePath].push(newTaskWithId);

	await writeTasksJsonToDisk(plugin, allTasks);

	eventEmitter.emit("REFRESH_COLUMN");
};

export const addTaskInNote = async (
	app: App,
	plugin: TaskBoard,
	newTask: taskItem,
	editorActive: boolean,
	cursorPosition?: { line: number; ch: number } | undefined
) => {
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
		const completeTask = taskContentFormatter(plugin, newTask);
		if (completeTask === "")
			throw "taskContentFormatter returned empty string";

		// Read the file content
		const fileContent = await readDataOfVaultFiles(plugin, filePath);
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
			await writeDataToVaultFiles(plugin, filePath, newContent);
		} else {
			// Join the lines back into a single string
			newContent = fileContent.concat("\n\n", completeTask);
			await writeDataToVaultFiles(plugin, filePath, newContent);
		}
		cursorPosition = undefined;
		return true;
	} catch (error) {
		bugReporter(
			plugin,
			"Error adding task in note. Following the error message might help you to find the issue.",
			String(error),
			"TaskItemUtils.ts/addTaskInNote"
		);
	}
};

// Function to parse due date correctly
export const parseDueDate = (dueStr: string): Date | null => {
	// Regular expression to check if dueStr starts with a two-digit day
	const ddMmYyyyPattern = /^\d{2}-\d{2}-\d{4}$/;

	if (ddMmYyyyPattern.test(dueStr)) {
		// Convert "DD-MM-YYYY" → "YYYY-MM-DD"
		const [day, month, year] = dueStr.split("-");
		dueStr = `${year}-${month}-${day}`;
	}

	// Parse the date
	const parsedDate = new Date(dueStr);
	return isNaN(parsedDate.getTime()) ? null : parsedDate;
};
