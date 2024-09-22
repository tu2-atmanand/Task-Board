import { Task } from "src/interfaces/Column";
import fs from "fs";
import { loadGlobalSettings } from "./SettingsOperations";
import path from "path";
import { priorityEmojis } from "src/interfaces/TaskItem";
import { tasksPath } from "src/interfaces/TaskBoardGlobalValues";

// utils/TaskItemUtils.ts

export const loadTasksFromJson = (): {
	allTasksWithStatus: Task[];
	pendingTasks: Task[];
	completedTasks: Task[];
} => {
	try {
		if (fs.existsSync(tasksPath)) {
			const tasksData = fs.readFileSync(tasksPath, "utf8");
			const allTasks = JSON.parse(tasksData);

			const pendingTasks: Task[] = [];
			const completedTasks: Task[] = [];

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

export const moveFromPendingToCompleted = (task: Task) => {
	const updatedTask = {
		...task,
		completed: new Date().toISOString().slice(0, 16),
	}; // e.g., '2024-09-21T12:20'

	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);

		// Move task from Pending to Completed
		if (allTasks.Pending[updatedTask.filePath]) {
			console.log(
				"moveFromPendingToCompleted : All tasks inside allTasks.Pending[updatedTask.filePath] : ",
				allTasks.Pending[updatedTask.filePath]
			);
			allTasks.Pending[updatedTask.filePath] = allTasks.Pending[
				updatedTask.filePath
			].filter((task: any) => task.id !== updatedTask.id);
			console.log(
				"Lets see what is going in allTasks.Pending[updatedTask.filePath] = ",
				allTasks.Pending[updatedTask.filePath]
			);
			if (!allTasks.Completed[updatedTask.filePath]) {
				allTasks.Completed[updatedTask.filePath] = [];
			}
			allTasks.Completed[updatedTask.filePath].push(updatedTask);
		}

		// Write the updated data back to the JSON file
		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}
};

export const moveFromCompletedToPending = (task: Task) => {
	// Toggle the completed state
	const updatedTask = { ...task, completed: !task.completed };

	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);

		// Move task from Completed to Pending
		if (allTasks.Completed[updatedTask.filePath]) {
			allTasks.Completed[updatedTask.filePath] = allTasks.Completed[
				updatedTask.filePath
			].filter((task: any) => task.id !== updatedTask.id);
			console.log(
				"Lets see what is going in allTasks.Completed[updatedTask.filePath] = ",
				allTasks.Completed[updatedTask.filePath]
			);
			if (!allTasks.Pending[updatedTask.filePath]) {
				allTasks.Pending[updatedTask.filePath] = [];
			}
			allTasks.Pending[updatedTask.filePath].push(updatedTask);
		}

		// Write the updated data back to the JSON file
		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	} catch (error) {
		console.error("Error updating task in tasks.json:", error);
	}
};

export const markTaskCompleteInFile = (task: Task) => {
	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, task.filePath);

	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
		let newContent = "";

		if (task.completed) {
			// Mark the task as incomplete
			const completedTaskRegex = new RegExp(
				`^- \\[x\\] ${task.body} \\|.*`,
				"gm"
			);
			newContent = fileContent.replace(completedTaskRegex, (match) =>
				match.replace("[x]", "[ ]")
			);
		} else {
			// Mark the task as complete
			const taskRegex = new RegExp(`^- \\[ \\] ${task.body} \\|.*`, "gm");
			newContent = fileContent.replace(taskRegex, (match) =>
				match.replace("[ ]", "[x]")
			);
		}

		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error marking task in file:", error);
	}
};

// For handleDeleteTask

export const deleteTaskFromFile = (task: Task) => {
	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, task.filePath);

	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
		// Updated regex to match the task body ending with '|'
		const taskRegex = new RegExp(`^- \\[ \\] ${task.body} \\|.*`, "gm");
		const newContent = fileContent.replace(taskRegex, ""); // Remove the matched line from the file
		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error deleting task from file:", error);
	}
};

export const deleteTaskFromJson = (task: Task) => {
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

export const updateTaskInFile = (updatedTask: Task, oldTask: Task) => {
	console.log(
		"updatedTask i am received in Column.tsx file -2 : ",
		updatedTask
	);
	console.log("oldTask i am received in Column.tsx file -2 : ", oldTask);
	const basePath = (window as any).app.vault.adapter.basePath;
	const filePath = path.join(basePath, updatedTask.filePath);
	// console.log("The File Path which needs to be updated : ", filePath);
	let globalSettings = loadGlobalSettings(); // Load the globalSettings to check dayPlannerPlugin status
	globalSettings = globalSettings.data.globalSettings;
	const dayPlannerPlugin = globalSettings?.dayPlannerPlugin;
	const dueDateWithEmo = updatedTask.due ? ` 📅 ${updatedTask.due}` : "";
	const timeWithEmo = updatedTask.time ? ` ⏰ [${updatedTask.time}]` : "";

	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
		const taskRegex = new RegExp(`^- \\[ \\] .*?${oldTask.body}.*$`, "gm");
		console.log(
			"The line which i am going to replace, found from file : ",
			taskRegex
		);

		let newContent = " ";
		if (dayPlannerPlugin) {
			newContent = fileContent.replace(
				taskRegex,
				`- [ ] ${updatedTask.time ? `${updatedTask.time} ` : ""}${
					updatedTask.body
				} |${dueDateWithEmo} ${
					updatedTask.priority > 0
						? priorityEmojis[updatedTask.priority as number]
						: ""
				} ${updatedTask.tag}`
			);
			console.log(
				"New content i am writing in the file after Edit Task Modal : ",
				newContent
			);
			console.log(
				"What the fuck wrong in this, this line should print emoji : ",
				priorityEmojis[updatedTask.priority as number]
			);
		} else {
			newContent = fileContent.replace(
				taskRegex,
				`- [ ] ${updatedTask.body} |${timeWithEmo}${dueDateWithEmo} ${
					updatedTask.priority > 0
						? priorityEmojis[updatedTask.priority as number]
						: ""
				} ${updatedTask.tag}`
			);
			console.log(
				"New content i am writing in the file after Edit Task Modal : ",
				newContent
			);
			console.log(
				"What the fuck wrong in this, this line should print emoji : ",
				priorityEmojis[updatedTask.priority as number]
			);
		}

		fs.writeFileSync(filePath, newContent);
	} catch (error) {
		console.error("Error updating task in file:", error);
	}
};

export const updateTaskInJson = (updatedTask: Task) => {
	try {
		const tasksData = fs.readFileSync(tasksPath, "utf8");
		const allTasks = JSON.parse(tasksData);
		console.log("The file of Tasks.json which I am updating: ", allTasks);

		// Function to update a task in a given task category (Pending or Completed)
		const updateTasksInCategory = (taskCategory: any) => {
			return Object.entries(taskCategory).reduce(
				(acc: any, [filePath, tasks]: [string, any[]]) => {
					acc[filePath] = tasks.map((task: any) =>
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

		console.log(
			"All updated Pending Tasks to be written in Tasks.json: ",
			updatedPendingTasks
		);
		console.log(
			"All updated Completed Tasks to be written in Tasks.json: ",
			updatedCompletedTasks
		);

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
