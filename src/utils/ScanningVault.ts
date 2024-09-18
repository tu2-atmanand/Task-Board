// /src/utils/ScanningVaults.ts

import { App, Notice, TFile } from "obsidian";

import fs from "fs";
import path from "path";
import { priorityEmojis } from "src/interfaces/TaskItem";
import { tasksPath } from "src/interfaces/TaskBoardGlobalValues";

export class ScanningVault {
	app: App;
	tasks: any = { Pending: {}, Completed: {} };

	constructor(app: App) {
		this.app = app;
	}

	// Scan all markdown files for tasks
	async scanVaultForTasks() {
		const files = this.app.vault.getMarkdownFiles();
		this.tasks = { Pending: {}, Completed: {} }; // Reset task structure

		for (const file of files) {
			await this.extractTasksFromFile(file, this.tasks);
		}

		this.saveTasksToFile();
	}

	// Extract tasks from a specific file
	async extractTasksFromFile(file: TFile, tasks: any) {
		const fileContent = await this.app.vault.read(file);
		const lines = fileContent.split("\n");
		const fileNameWithPath = file.path;

		tasks.Pending[fileNameWithPath] = [];
		tasks.Completed[fileNameWithPath] = [];

		for (const line of lines) {
			if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
				const isCompleted = line.startsWith("- [x]");
				const body = this.extractBody(line);
				const time = this.extractTime(line);
				const due = this.extractDate(line);
				const priority = this.extractPriority(line);
				const tag = this.extractTag(line);

				const task = {
					id: this.generateTaskId(),
					body,
					time,
					due,
					tag,
					priority,
					filePath: fileNameWithPath,
					completed: isCompleted,
				};

				if (isCompleted) {
					tasks.Completed[fileNameWithPath].push(task);
				} else {
					tasks.Pending[fileNameWithPath].push(task);
				}
			}
		}
	}

	// Generate a unique ID for each task
	generateTaskId(): number {
		return Date.now();
	}

	// Helper function to load the existing tasks from the tasks.json file
	async loadTasksFromFile() {
		if (fs.existsSync(tasksPath)) {
			const data = fs.readFileSync(tasksPath, "utf8");
			return JSON.parse(data);
		}
		return { Pending: {}, Completed: {} }; // Return an empty object if no file exists
	}

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async updateTasksFromFiles(files: TFile[]) {
		console.log("Following files have been received for scanning: ", files);

		// Load the existing tasks from tasks.json once
		const oldTasks = await this.loadTasksFromFile();
		console.log(
			"Following Old data has been loaded from tasks.json: ",
			oldTasks
		);

		for (const file of files) {
			const fileNameWithPath = file.path;
			const fileContent = await this.app.vault.read(file);
			const lines = fileContent.split("\n");
			const newPendingTasks: any[] = [];
			const newCompletedTasks: any[] = [];

			for (const line of lines) {
				if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
					const isCompleted = line.startsWith("- [x]");
					const body = this.extractBody(line);
					const time = this.extractTime(line);
					const due = this.extractDate(line);
					const priority = this.extractPriority(line);
					const tag = this.extractTag(line);

					const task = {
						id: this.generateTaskId(),
						body,
						time,
						due,
						tag,
						priority,
						filePath: fileNameWithPath,
						completed: isCompleted,
					};

					if (isCompleted) {
						newCompletedTasks.push(task);
					} else {
						newPendingTasks.push(task);
					}
				}
			}

			console.log("Tasks extracted from the file: ", {
				newPendingTasks,
				newCompletedTasks,
			});

			// Only replace the tasks for the specific file
			this.tasks.Pending = {
				...oldTasks.Pending, // Keep the existing tasks for other files
				[fileNameWithPath]: newPendingTasks, // Update only the tasks for the current file
			};

			this.tasks.Completed = {
				...oldTasks.Completed, // Keep the existing tasks for other files
				[fileNameWithPath]: newCompletedTasks, // Update only the tasks for the current file
			};
		}

		// Save the updated tasks back to tasks.json after processing all files
		this.saveTasksToFile();
	}

	// Save tasks to JSON file
	saveTasksToFile() {
		fs.writeFileSync(tasksPath, JSON.stringify(this.tasks, null, 2));
		console.log(
			"The following data saved in the tasks.json : ",
			this.tasks
		);
		new Notice("Tasks saved to tasks.json");
	}

	// Extract body from task line
	extractBody(text: string): string {
		const timeAtStartMatch = text.match(
			/^- \[[x ]\]\s*\d{2}:\d{2} - \d{2}:\d{2}/
		);

		if (timeAtStartMatch) {
			// If time is at the start, extract body after the time and till the pipe symbol
			return text
				.replace(/^- \[[x ]\]\s*\d{2}:\d{2} - \d{2}:\d{2}\s*/, "")
				.split("|")[0]
				.trim();
		} else {
			// Default case: no time at start, extract body till the pipe symbol
			return text.includes("|")
				? text
						.split("|")[0]
						.replace(/^- \[[x ]\]\s*/, "")
						.trim()
				: text.replace(/^- \[[x ]\]\s*/, "").trim();
		}
	}

	// Extract time from task line
	extractTime(text: string): string {
		// Check if time is at the start of the task
		const timeAtStartMatch = text.match(
			/^- \[[x ]\]\s*(\d{2}:\d{2} - \d{2}:\d{2})/
		);

		if (timeAtStartMatch) {
			// If time is at the start, extract it
			return timeAtStartMatch[1];
		}

		// Otherwise, look for time elsewhere in the line
		const timeInBodyMatch = text.match(
			/⏰\s*\[(\d{2}:\d{2} - \d{2}:\d{2})\]/
		);
		return timeInBodyMatch ? timeInBodyMatch[1] : "";
	}

	// Extract date from task body
	extractDate(text: string): string {
		const match = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
		return match ? match[1] : "";
	}

	// Extract priority from task body
	extractPriority(text: string): string {
		const priorityMatch = Object.entries(priorityEmojis).find(
			([key, emoji]) => text.includes(emoji)
		);
		// console.log(
		// 	"This is what has been extracted as emoji : ",
		// 	priorityMatch,
		// 	" Of the task : ",
		// 	text
		// );
		// console.log([...text].map((char) => char.codePointAt(0).toString(16)));
		return priorityMatch?.[0] || "0";
	}

	// Extract tag from task body
	extractTag(text: string): string {
		const match = text.match(/#(\w+)/);
		return match ? `#${match[1]}` : "";
	}
}
