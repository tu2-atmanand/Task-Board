// /src/utils/TaskItemUtils.ts

import { App, Notice, TFile } from "obsidian";
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

import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";

export const taskElementsFormatter = (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	const dayPlannerPlugin =
		plugin.settings.data.globalSettings.dayPlannerPlugin;
	const globalSettings = plugin.settings.data.globalSettings;

	let dueDateWithFormat = "";
	let completedWitFormat = "";
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
		} |${priorityWithEmo}${timeWithEmo}${dueDateWithFormat} ${priorityWithEmo} ${updatedTask.tags.join(" ")}${completedWitFormat}`;
	}

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = updatedTask.body
		.map((line: string) => `${line}`)
		.join("\n");

	// // Add the sub-tasks without additional indentation
	// const subTasksWithTab = updatedTask.body
	// 	.filter(
	// 		(line: string) =>
	// 			line.startsWith("- [ ]") || line.startsWith("- [x]")
	// 	)
	// 	.map((Line: string) => `\t${Line}`)
	// 	.join("\n")
	// 	.trim();

	// console.log("If i there is not subTask to the file and there was no line in the Description, then here there shouldnt be anything if i have added a fresh bullete point in the Desc : ", subTasksWithTab);

	// Combine all parts: main task, body, and sub-tasks
	// const completeTask = `${formattedTask}\n${bodyLines}\n${subTasksWithTab}`;
	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	// console.log(
	// 	"taskElementsFormatter : To render in the HTML :\n",
	// 	completeTask
	// );

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
			console.log(
				"moveFromPendingToCompleted : All tasks inside allTasks.Pending[updatedTask.filePath] : ",
				allTasks.Pending[task.filePath]
			);
			allTasks.Pending[task.filePath] = allTasks.Pending[
				task.filePath
			].filter((t: taskItem) => t.id !== task.id);
			// console.log(
			// 	"Lets see what is going in allTasks.Pending[updatedTask.filePath] = ",
			// 	allTasks.Pending[updatedTask.filePath]
			// );
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
	// Toggle the completed state
	// const updatedTask = { ...task, completed: "" };

	try {
		const allTasks = await loadTasksJsonFromSS(plugin);

		// Move task from Completed to Pending
		if (allTasks.Completed[task.filePath]) {
			allTasks.Completed[task.filePath] = allTasks.Completed[
				task.filePath
			].filter((t: taskItem) => t.id !== task.id);
			// console.log(
			// 	"Lets see what is going in allTasks.Completed[updatedTask.filePath] = ",
			// 	allTasks.Completed[updatedTask.filePath]
			// );
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
		// Updated regex to match the task body ending with '|'
		// const taskRegex = new RegExp(`^- \\[ \\] ${task.body} \\|.*`, "gm");
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
		console.log(
			"----- THE content i will be deleting from the file : ",
			taskRegex
		);
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

		// Write the updated data back to the JSON file
		// fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 4));
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
	console.log(
		"updateTaskInFile : oldTask to be replaced in MD file : ",
		oldTask
	);
	console.log(
		"updateTaskInFile : NewTask to be replaced in MD file : ",
		updatedTask
	);

	const filePath = updatedTask.filePath;
	// const data = plugin.app.vault.read(plugin.app.vault.getFileByPath(updatedTask.filePath));

	try {
		// Read the file content using Obsidian's API
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		const completeTask = taskElementsFormatter(plugin, updatedTask);
		let taskRegex = "";
		// Create a regex to match the old task by its body content for replacement
		// const taskRegex = new RegExp(
		// 	`^- \\[ \\] .*?${oldTask.title}.*$(?:[\s\S]*?\n\n)`,
		// 	"gm"
		// );

		// A more reliable approach would be to use a regex to find the starting line, and then iterate through the lines until an empty line is detected:
		// const taskRegex = new RegExp(^- \\[ \\] .*?${oldTask.title}.*$, "gm");

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
		console.log(
			"Following is the Old Content, That i am going to update :\n",
			taskRegex
		);

		// Replace the old task with the updated formatted task in the file
		const newContent = fileContent.replace(taskRegex, completeTask);
		console.log(
			"Following is the New Content, which you will see after update :\n",
			completeTask
		);

		// Write the updated content back to the file using Obsidian's API
		await writeDataToVaultFiles(plugin, filePath, newContent);
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};

export const updateTaskInJson = async (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	console.log(
		"updateTaskInJson : NewTask to be replaced/updated in data.json/sessionStorage : ",
		updatedTask
	);
	try {
		const allTasks = await loadTasksJsonFromSS(plugin);
		// console.log("The file of Tasks.json which I am updating: ", allTasks);

		// Function to update a task in a given task category (Pending or Completed)
		const updateTasksInCategory = (taskCategory: any) => {
			return Object.entries(taskCategory).reduce(
				(acc: any, [filePath, tasks]: [string, taskItem[]]) => {
					acc[filePath] = tasks.map((task: taskItem) =>
						task.id === updatedTask.id ? updatedTask : task
					);
					return acc;
				},
				{}
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

		console.log(
			"updateTaskInJson : Data before sending to the tasksCache file function to write to sessionStorage : ",
			updatedData
		);

		// Write the updated data back to the JSON file
		console.log("The new data to be updated in tasks.json: ", updatedData);
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
	console.log("The random value generated : ", array[0]);
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
	console.log("New task which i will going to add : ", newTaskWithId);

	allTasks.Pending[newTask.filePath].push(newTaskWithId);

	await writeTasksJsonToSS(plugin, allTasks);

	eventEmitter.emit("REFRESH_COLUMN");
};

export const addTaskInActiveEditor = async (
	app: App,
	plugin: TaskBoard,
	newTask: taskItem
) => {
	console.log("New Task i have received: ", newTask);

	const filePath = newTask.filePath;

	try {
		const completeTask = taskElementsFormatter(plugin, newTask);

		// Get the active editor and the current cursor position
		const activeEditor = app.workspace.activeEditor?.editor;
		if (!activeEditor) {
			throw new Error("No active editor found. Please place your cursor in markdown file");
			new Notice("No active editor found. Please place your cursor in markdown file");
		}

		const cursorPosition = activeEditor.getCursor();

		// Read the file content
		const fileContent = await readDataOfVaultFiles(plugin, filePath);

		// Split file content into an array of lines
		const fileLines = fileContent.split("\n");

		// Insert the new task at the cursor line position
		fileLines.splice(cursorPosition.line, 0, completeTask);

		// Join the lines back into a single string
		const newContent = fileLines.join("\n");

		console.log(
			"addTaskInActiveEditor : Following is the New Content, which you will see after update:\n",
			completeTask
		);

		// Write the updated content back to the file
		await writeDataToVaultFiles(plugin, filePath, newContent);
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};
