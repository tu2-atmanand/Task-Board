// /src/utils/TaskItemUtils.ts

import { priorityEmojis, taskItem } from "src/interfaces/TaskItem";

import fs from "fs";
import { loadGlobalSettings } from "./SettingsOperations";
import path from "path";
import { tasksPath } from "src/interfaces/GlobalVariables";

// utils/TaskItemUtils.ts

export const loadTasksFromJson = (): {
	allTasksWithStatus: taskItem[];
	pendingTasks: taskItem[];
	completedTasks: taskItem[];
} => {
	console.log(
		"loadTasksFromJson : I hope this is getting loaded only at once -----------------  "
	);
	try {
		if (fs.existsSync(tasksPath)) {
			const tasksData = fs.readFileSync(tasksPath, "utf8");
			const allTasks = JSON.parse(tasksData);

			const pendingTasks: taskItem[] = [];
			const completedTasks: taskItem[] = [];

			// Separate pending tasks
			for (const [filePath, tasks] of Object.entries(
				allTasks.Pending || {}
			)) {
				tasks.forEach((task: any) =>
					pendingTasks.push({ ...task, filePath })
				);
			}

			// Separate completed tasks
			for (const [filePath, tasks] of Object.entries(
				allTasks.Completed || {}
			)) {
				tasks.forEach((task: any) =>
					completedTasks.push({ ...task, filePath })
				);
			}

			// Combine both pending and completed tasks
			const allTasksWithStatus = [...pendingTasks, ...completedTasks];
			return { allTasksWithStatus, pendingTasks, completedTasks };
		} else {
			console.warn("tasks.json file not found.");
			return {
				allTasksWithStatus: [],
				pendingTasks: [],
				completedTasks: [],
			};
		}
	} catch (error) {
		console.error("Error reading tasks.json:", error);
		return { allTasksWithStatus: [], pendingTasks: [], completedTasks: [] };
	}
};

// For handleCheckboxChange

export const moveFromPendingToCompleted = (task: taskItem) => {
	const moment = require("moment");
	// const completed = moment().format("YYYY-MM-DDTHH:mm");
	// console.log(
	// 	"The time generated by the 'moment' library : ",
	// 	moment().format("YYYY-MM-DDTHH:mm")
	// );

	// const updatedTask = {
	// 	...task,
	// 	completed: moment().format("YYYY-MM-DDTHH:mm"),
	// }; // e.g., '2024-09-21T12:20'

	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);

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
		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}
};

export const moveFromCompletedToPending = (task: taskItem) => {
	// Toggle the completed state
	// const updatedTask = { ...task, completed: "" };

	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);

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
		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}
};

/*
export const markTaskCompleteInFile = (task: taskItem) => {
	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, task.filePath);

	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
		let newContent = "";

		// Create a regex to match the task line based on the task title
		const taskRegex = new RegExp(
			`^- \\[([ x])\\] .*?${task.title}.*$`,
			"m"
		);

		// Replace the checkbox based on the task.completed status
		if (task.completed) {
			// Mark the task as incomplete
			newContent = fileContent.replace(taskRegex, (match, checkbox) =>
				match.replace("[x]", "[ ]")
			);
		} else {
			// Mark the task as complete
			newContent = fileContent.replace(taskRegex, (match, checkbox) =>
				match.replace("[ ]", "[x]")
			);
		}

		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error marking task in file:", error);
	}
};
*/

// For handleDeleteTask

export const deleteTaskFromFile = (task: taskItem) => {
	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, task.filePath);

	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
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
		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error deleting task from file:", error);
	}
};

export const deleteTaskFromJson = (task: taskItem) => {
	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);

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
		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	} catch (error) {
		console.error("Error deleting task from tasks.json:", error);
	}
};

// For handleEditTask

export const updateTaskInFile = (updatedTask: taskItem, oldTask: taskItem) => {
	console.log("oldTask i have received for updating in md file : ", oldTask);
	console.log("updatedTask i have received : ", updatedTask);

	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, updatedTask.filePath);
	let globalSettings = loadGlobalSettings(); // Load the globalSettings to check dayPlannerPlugin status
	globalSettings = globalSettings.data.globalSettings;
	const dayPlannerPlugin = globalSettings?.dayPlannerPlugin;

	let dueDateWithFormat = "";
	let completedWitFormat = "";
	if (updatedTask.due || updatedTask.completed) {
		if (globalSettings?.taskCompletionFormat === "1") {
			dueDateWithFormat = updatedTask.due ? ` 📅${updatedTask.due}` : "";
			completedWitFormat = updatedTask.completed ? ` ✅${updatedTask.completed} `: "";
		} else if (globalSettings?.taskCompletionFormat === "2") {
			dueDateWithFormat = updatedTask.due ? ` 📅 ${updatedTask.due}` : "";
			completedWitFormat = updatedTask.completed ? ` ✅ ${updatedTask.completed} ` : "";
		} else if (globalSettings?.taskCompletionFormat === "3") {
			dueDateWithFormat = updatedTask.due ? ` [due:: ${updatedTask.due}]` : "";
			completedWitFormat = updatedTask.completed ? ` [completion:: ${updatedTask.completed}] ` : "";
		} else {
			dueDateWithFormat = updatedTask.due ? ` @due(${updatedTask.due})` : "";
			completedWitFormat = updatedTask.completed ? ` @completion(${updatedTask.completed}) ` : "";
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
		}${updatedTask.title} |${dueDateWithFormat} ${priorityWithEmo} ${
			updatedTask.tag
		}${completedWitFormat}`;
	} else {
		formattedTask = `${checkBoxStat} ${updatedTask.title} |${timeWithEmo}${dueDateWithFormat} ${priorityWithEmo} ${updatedTask.tag}${completedWitFormat}`;
	}

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = updatedTask.body
		.filter(
			(line: string) =>
				!line.startsWith("- [ ]") && !line.startsWith("- [x]")
		)
		.map((line: string) => `\t${line}`)
		.join("\n");

	// Add the sub-tasks without additional indentation
	const subTasksWithTab = updatedTask.body
		.filter(
			(line: string) =>
				line.startsWith("- [ ]") || line.startsWith("- [x]")
		)
		.map((Line: string) => `\t${Line}`)
		.join("\n");

	// console.log("If i there is not subTask to the file and there was no line in the Description, then here there shouldnt be anything if i have added a fresh bullete point in the Desc : ", subTasksWithTab);

	// Combine all parts: main task, body, and sub-tasks
	// const completeTask = `${formattedTask}\n${bodyLines}\n${subTasksWithTab}`;
	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}\n${subTasksWithTab}`;

	try {
		// Read the file content
		const fileContent = fs.readFileSync(filePath, "utf8");
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

		// Write the updated content back to the file
		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};

export const updateTaskInJson = (updatedTask: taskItem) => {
	console.log(
		"The new task which i have received and which i am going to put in the taks.json : ",
		updatedTask
	);
	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);
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

		// console.log(
		// 	"All updated Pending Tasks to be written in Tasks.json: ",
		// 	updatedPendingTasks
		// );
		// console.log(
		// 	"All updated Completed Tasks to be written in Tasks.json: ",
		// 	updatedCompletedTasks
		// );

		// Create the updated data object with both updated Pending and Completed tasks
		const updatedData = {
			Pending: updatedPendingTasks,
			Completed: updatedCompletedTasks,
		};

		// Write the updated data back to the JSON file
		console.log("The new data to be updated in tasks.json: ", updatedData);
		fs.writeFileSync(tasksPath, JSON.stringify(updatedData, null, 2));
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}
};
