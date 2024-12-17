// /src/utils/TaskItemUtils.ts

import { loadTasksJsonFromSS, writeTasksJsonToSS } from "./tasksCache";
import {
	priorityEmojis,
	taskItem,
	tasksJson,
} from "src/interfaces/TaskItemProps";
import {
	readDataOfVaultFiles,
	writeDataToVaultFiles,
} from "./MarkdownFileOperations";

import { App } from "obsidian";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";

export const taskElementsFormatter = (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	if (updatedTask.title === "") {
		return;
	}

	const dayPlannerPlugin =
		plugin.settings.data.globalSettings.dayPlannerPlugin;
	const globalSettings = plugin.settings.data.globalSettings;

	let dueDateWithFormat: string = "";
	let completedWitFormat: string = "";
	if (updatedTask.due || updatedTask.completed) {
		if (globalSettings?.taskCompletionFormat === "1") {
			dueDateWithFormat = updatedTask.due ? ` 📅${updatedTask.due}` : "";
			completedWitFormat = updatedTask.completed
				? ` ✅${updatedTask.completed} `
				: "";
		} else if (globalSettings?.taskCompletionFormat === "2") {
			dueDateWithFormat = updatedTask.due ? ` 📅 ${updatedTask.due}` : "";
			completedWitFormat = updatedTask.completed
				? ` ✅ ${updatedTask.completed} `
				: "";
		} else if (globalSettings?.taskCompletionFormat === "3") {
			dueDateWithFormat = updatedTask.due
				? ` [due:: ${updatedTask.due}]`
				: "";
			completedWitFormat = updatedTask.completed
				? ` [completion:: ${updatedTask.completed}] `
				: "";
		} else {
			dueDateWithFormat = updatedTask.due
				? ` @due(${updatedTask.due})`
				: "";
			completedWitFormat = updatedTask.completed
				? ` @completion(${updatedTask.completed}) `
				: "";
		}
	}

	const timeWithEmo = updatedTask.time ? ` ⏰[${updatedTask.time}]` : "";
	const checkBoxStat = updatedTask.completed ? "- [x]" : "- [ ]";

	// Combine priority emoji if it exists
	const priorityWithEmo =
		updatedTask.priority > 0
			? priorityEmojis[updatedTask.priority as number]
			: "";

	// Build the formatted string for the main task
	let formattedTask = "";
	if (
		updatedTask.time !== "" ||
		timeWithEmo !== "" ||
		priorityWithEmo !== "" ||
		dueDateWithFormat !== "" ||
		completedWitFormat !== "" ||
		updatedTask.tags.length > 0
	) {
		if (dayPlannerPlugin) {
			formattedTask = `${checkBoxStat} ${
				updatedTask.time ? `${updatedTask.time} ` : ""
			}${
				updatedTask.title
			} | ${priorityWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
				" "
			)}${completedWitFormat}`;
		} else {
			formattedTask = `${checkBoxStat} ${
				updatedTask.title
			} |${priorityWithEmo}${timeWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
				" "
			)}${completedWitFormat}`;
		}
	} else {
		formattedTask = `${checkBoxStat} ${updatedTask.title}`;
	}
	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = updatedTask.body
		.map((line: string) => {
			if (line.startsWith("\t")) {
				return line;
			} else {
				return `\t${line}`;
			}
		})
		.join("\n");

	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

// For handleCheckboxChange

export const moveFromPendingToCompleted = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const allTasks = await loadTasksJsonFromSS(plugin);

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
		await writeTasksJsonToSS(plugin, allTasks);
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}

	eventEmitter.emit("REFRESH_COLUMN");
};

export const moveFromCompletedToPending = async (
	plugin: TaskBoard,
	task: taskItem
) => {
	try {
		const allTasks = await loadTasksJsonFromSS(plugin);

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
		await writeTasksJsonToSS(plugin, allTasks);
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}

	eventEmitter.emit("REFRESH_COLUMN");
};

// For handleDeleteTask

export const deleteTaskFromFile = async (plugin: TaskBoard, task: taskItem) => {
	const filePath = task.filePath;

	try {
		const fileContent = await readDataOfVaultFiles(plugin, filePath);
		let taskRegex = "";
		const startRegex = new RegExp(`^- \\[ \\] .*?${task.title}.*$`, "gm");
		const startIndex = fileContent.search(startRegex);

		if (startIndex !== -1) {
			const lines = fileContent.substring(startIndex).split("\n");
			const taskContent = [];

			for (const line of lines) {
				if (line.trim() === "") {
					break;
				}
				taskContent.push(line);
			}

			taskRegex = taskContent.join("\n");
		}
		const newContent = fileContent.replace(taskRegex, ""); // Remove the matched line from the file

		await writeDataToVaultFiles(plugin, filePath, newContent);
	} catch (error) {
		console.error("Error deleting task from file:", error);
	}
};

export const deleteTaskFromJson = async (plugin: TaskBoard, task: taskItem) => {
	try {
		const allTasks = await loadTasksJsonFromSS(plugin);

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

		await writeTasksJsonToSS(plugin, allTasks);
	} catch (error) {
		console.error("Error deleting task from tasks.json:", error);
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
		// Read the file content using Obsidian's API
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		const completeTask = taskElementsFormatter(plugin, updatedTask);
		if (completeTask) {
			let taskRegex = "";

			const startRegex = new RegExp(
				`^- \\[.{1}\\] .*?${oldTask.title}.*$`,
				"gm"
			);
			const startIndex = fileContent.search(startRegex);

			if (startIndex !== -1) {
				const lines = fileContent.substring(startIndex).split("\n");
				const taskContent = [];

				for (const line of lines) {
					if (line.trim() === "") {
						break;
					}
					taskContent.push(line);
				}

				taskRegex = taskContent.join("\n");
			}

			// Replace the old task with the updated formatted task in the file
			const newContent = fileContent.replace(taskRegex, completeTask);

			// Write the updated content back to the file using Obsidian's API
			await writeDataToVaultFiles(plugin, filePath, newContent);
		}
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};

export const updateTaskInJson = async (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	try {
		const allTasks = await loadTasksJsonFromSS(plugin);

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
		await writeTasksJsonToSS(plugin, updatedData);

		eventEmitter.emit("REFRESH_COLUMN");
	} catch (error) {
		console.error(
			"updateTaskInJson : Error updating task in tasks.json:",
			error
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
	const allTasks = await loadTasksJsonFromSS(plugin);

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

	await writeTasksJsonToSS(plugin, allTasks);

	eventEmitter.emit("REFRESH_COLUMN");
};

export const addTaskInActiveEditor = async (
	app: App,
	plugin: TaskBoard,
	newTask: taskItem
) => {
	const filePath = newTask.filePath;

	try {
		const completeTask = taskElementsFormatter(plugin, newTask);

		// Get the active editor and the current cursor position
		const activeEditor = app.workspace.activeEditor?.editor;
		if (!activeEditor) {
			console.error(
				"No active editor found. Please place your cursor in markdown file"
			);
		}

		if (completeTask && activeEditor) {
			const cursorPosition = activeEditor.getCursor();

			// Read the file content
			const fileContent = await readDataOfVaultFiles(plugin, filePath);

			// Split file content into an array of lines
			const fileLines = fileContent.split("\n");

			// Insert the new task at the cursor line position
			fileLines.splice(cursorPosition.line, 0, completeTask);

			// Join the lines back into a single string
			const newContent = fileLines.join("\n");

			// Write the updated content back to the file
			await writeDataToVaultFiles(plugin, filePath, newContent);
		}
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};
