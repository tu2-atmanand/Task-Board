// /src/utils/ScanningVaults.ts

import { App, TFile, moment as _moment } from "obsidian";
import {
	extractCheckboxSymbol,
	isCompleted,
	isTaskLine,
} from "./CheckBoxUtils";
import {
	loadTasksJsonFromDisk,
	writeTasksJsonToDisk,
} from "./JsonFileOperations";
import {
	priorityEmojis,
	taskItem,
	tasksJson,
} from "src/interfaces/TaskItemProps";
import {
	scanFilterForFilesNFolders,
	scanFilterForTags,
} from "./FiltersVerifier";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { readDataOfVaultFiles } from "./MarkdownFileOperations";
import { scanFilters } from "src/interfaces/GlobalSettings";

export class ScanningVault {
	app: App;
	plugin: TaskBoard;
	tasks: any = { Pending: {}, Completed: {} };
	TaskDetected: boolean;

	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.TaskDetected = false;
	}

	async scanVaultForTasks() {
		const files = this.app.vault.getMarkdownFiles();
		this.tasks = { Pending: {}, Completed: {} }; // Reset task structure

		for (const file of files) {
			const scanFilters =
				this.plugin.settings.data.globalSettings.scanFilters;
			if (scanFilterForFilesNFolders(file, scanFilters)) {
				await this.extractTasksFromFile(file, this.tasks, scanFilters);
			}
		}

		this.saveTasksToFile();
		// Emit the event
		eventEmitter.emit("REFRESH_BOARD");
	}

	// Extract tasks from a specific file
	async extractTasksFromFile(
		file: TFile,
		tasks: tasksJson,
		scanFilters: scanFilters
	) {
		const fileNameWithPath = file.path;
		const fileContent = await readDataOfVaultFiles(
			this.plugin,
			fileNameWithPath
		);
		const lines = fileContent.split("\n");

		tasks.Pending[fileNameWithPath] = [];
		tasks.Completed[fileNameWithPath] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (isTaskLine(line)) {
				const tags = extractTags(line);
				if (scanFilterForTags(tags, scanFilters)) {
					this.TaskDetected = true;
					const taskStatus = extractCheckboxSymbol(line);
					const isTaskCompleted = isCompleted(line);
					const title = extractTitle(line);
					const time = extractTime(line);
					const due = extractDueDate(line);
					const priority = extractPriority(line);
					const completionDate = extractCompletionDate(line);
					const body = extractBody(lines, i + 1);

					const task = {
						id: this.generateTaskId(),
						status: taskStatus,
						title,
						body,
						time,
						due,
						tags,
						priority,
						filePath: fileNameWithPath,
						completion: completionDate,
					};

					if (isTaskCompleted) {
						tasks.Completed[fileNameWithPath].push(task);
					} else {
						tasks.Pending[fileNameWithPath].push(task);
					}
				} else {
					// console.log("The tasks is not allowed...");
				}
			}
		}
	}

	// Generate a unique ID for each task
	generateTaskId(): number {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return array[0];
	}

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async updateTasksFromFiles(files: (TFile | null)[]) {
		// Load the existing tasks from tasks.json once
		const oldTasks = await loadTasksJsonFromDisk(this.plugin);
		const scanFilters =
			this.plugin.settings.data.globalSettings.scanFilters;

		for (const file of files) {
			if (file !== null) {
				const fileNameWithPath = file.path;
				const fileContent = await this.app.vault.cachedRead(file);
				const lines = fileContent.split("\n");
				const newPendingTasks: any[] = [];
				const newCompletedTasks: any[] = [];

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (isTaskLine(line)) {
						const tags = extractTags(line);
						if (scanFilterForTags(tags, scanFilters)) {
							this.TaskDetected = true;
							const taskStatus = extractCheckboxSymbol(line);
							const isTaskCompleted = isCompleted(line);
							const title = extractTitle(line);
							const time = extractTime(line);
							const priority = extractPriority(line);
							const completionDate = extractCompletionDate(line);
							const body = extractBody(lines, i + 1);
							let due = extractDueDate(line);
							if (
								!due &&
								this.plugin.settings.data.globalSettings
									.dailyNotesPluginComp
							) {
								const dueFormat =
									this.plugin.settings.data.globalSettings
										.dueDateFormat;
								const basename = file.basename;

								// Check if the basename matches the dueFormat using moment
								const moment =
									_moment as unknown as typeof _moment.default;
								if (
									moment(basename, dueFormat, true).isValid()
								) {
									due = basename; // If the basename matches the dueFormat, assign it to due
								} else {
									due = ""; // If not, assign an empty string
								}
							}

							const task = {
								id: this.generateTaskId(),
								status: taskStatus,
								title,
								body,
								time,
								due,
								tags,
								priority,
								filePath: fileNameWithPath,
								completion: completionDate,
							};

							if (isTaskCompleted) {
								newCompletedTasks.push(task);
							} else {
								newPendingTasks.push(task);
							}
						} else {
							// console.log("The tasks is not allowed...");
						}
					}
				}

				// Only replace the tasks for the specific file
				this.tasks.Pending = {
					...oldTasks.Pending, // Keep the existing tasks for other files
					[fileNameWithPath]: newPendingTasks, // Update only the tasks for the current file
				};

				this.tasks.Completed = {
					...oldTasks.Completed, // Keep the existing tasks for other files
					[fileNameWithPath]: newCompletedTasks, // Update only the tasks for the current file
				};
			} else {
				console.warn("File is not valid...");
			}
		}

		this.saveTasksToFile();
	}

	// Save tasks to JSON file
	async saveTasksToFile() {
		await writeTasksJsonToDisk(this.plugin, this.tasks);

		// Refresh the board only if any task has be extracted from the updated file.
		if (
			this.TaskDetected &&
			this.plugin.settings.data.globalSettings.realTimeScanning
		) {
			eventEmitter.emit("REFRESH_COLUMN");
			this.TaskDetected = false;
		}
	}
}

export function buildTaskFromRawContent(
	rawContent: string,
	filePath?: string,
): Partial<taskItem> {
	const lines = rawContent.split("\n");
	const taskStatus = extractCheckboxSymbol(lines[0]);
	const title = extractTitle(lines[0]);
	const time = extractTime(lines[0]);
	const due = extractDueDate(lines[0]);
	const priority = extractPriority(lines[0]);
	const tags = extractTags(lines[0]);
	const completionDate = extractCompletionDate(lines[0]);
	const body = extractBody(lines, 1);

	return {
		status: taskStatus,
		title,
		body,
		time,
		due,
		tags,
		priority,
		completion: completionDate,
	};
}

// // Extract title from task line
// export function extractTitle(text: string): string {
// 	const timeAtStartMatch = text.match(
// 		/^- \[.\]\s*\d{2}:\d{2} - \d{2}:\d{2}/
// 	);

// 	if (timeAtStartMatch) {
// 		// If time is at the start, extract title after the time and till the pipe symbol
// 		return text
// 			.replace(/^- \[.\]\s*\d{2}:\d{2} - \d{2}:\d{2}\s*/, "")
// 			.split("|")[0]
// 			.trim();
// 	} else {
// 		// Default case: no time at start, extract title till the pipe symbol
// 		return text.includes("|")
// 			? text
// 					.split("|")[0]
// 					.replace(/^- \[.\]\s*/, "")
// 					.trim()
// 			: text.replace(/^- \[.\]\s*/, "").trim();
// 	}
// }

// Extract title from task line
export function extractTitle(text: string): string {
	return text.replace(/^- \[.\]\s*/, "").trim();
}

// New function to extract task body
export function extractBody(lines: string[], startLineIndex: number): string[] {
	const bodyLines = [];
	for (let i = startLineIndex; i < lines.length; i++) {
		const line = lines[i];

		if (line.trim() === "") {
			break;
		}

		// If the line has one level of indentation, consider it part of the body
		if (line.startsWith("\t") || line.startsWith("    ")) {
			//TODO : YOu cannot simply put hardcoded 4 spaces here for tab, it should be taken from the settings, how many spaces for one tab
			bodyLines.push(line);
		} else {
			// TODO : Initially i tried considering the next line without any indentation also as the body of the task, but if user has added multiple tasks right one after another then those should be different tasks.
			// bodyLines.push(`\t${line}`);
			break;
		}
	}
	return bodyLines.at(0) === "" ? [] : bodyLines;
}

// Extract time from task line
export function extractTime(text: string): string {
	let match = text.match(/\[time::\s*(.*?)\]/);
	if (match) {
		return match[1];
	}

	match = text.match(/@time\((.*?)\)/);
	if (match) {
		return match[1];
	}

	match = text.match(/⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/)
	if (match) {
		return match[1];
	}

	// Check if time is at the start of the task
	const timeAtStartMatch = text.match(
		/^- \[.\]\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/
	);

	if (timeAtStartMatch) {
		// If time is at the start, extract it
		return timeAtStartMatch[1];
	}

	// Otherwise, look for time elsewhere in the line
	const timeIntitleMatch = text.match(/⏰\s*\[(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\]/);
	return timeIntitleMatch ? timeIntitleMatch[1] : "";
}

// Extract date from task title
export function extractDueDate(text: string): string {
	let match = text.match(/📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);

	if (!match) {
		match = text.match(/\[due::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/);
	}

	if (!match) {
		match = text.match(/\@due\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/);
	}

	return match ? match[1] : "";
}

// Extract priority from task title using RegEx
export function extractPriority(text: string): number {
	let match = text.match(/\[priority::\s*(\d{1,2})\]/);
	if (match) {
		return parseInt(match[1]);
	}

	match = text.match(/@priority\(\s*(\d{1,2})\s*\)/);
	if (match) {
		return parseInt(match[1]);
	}

	// Create a regex pattern to match any priority emoji
	const emojiPattern = new RegExp(
		`(${Object.values(priorityEmojis)
			.map((emoji) => `\\s*${emoji}\\s*`)
			.join("|")})`,
		"g"
	);

	// Execute the regex to find all priority emoji matches
	const matches = text.match(emojiPattern) || [];

	// Filter out any empty or incorrect values
	const validMatches = matches
		.map((match) => match.trim()) // Trim spaces
		.filter((match) => match.length > 0 && match !== "0"); // Remove empty or zero values

	// Find the first match in the priorityEmojis mapping
	for (const emoji of validMatches) {
		const priorityMatch = Object.entries(priorityEmojis).find(
			([, value]) => value === emoji
		);
		if (priorityMatch) {
			return parseInt(priorityMatch[0]); // Return the first matching priority
		}
	}

	// Default priority if no emoji is found
	return 0;
}

// Extract tags from task title
export function extractTags(text: string): string[] {
	text = text.replace(/<(mark|font).*?>/g, "");

	const matches = text.match(/\s+#([^\s;@()\[\]{}<>]{1,20})/g);
	return matches ? matches.map((tag) => tag.trim()) : [];
}

// Extract completion date-time value
export function extractCompletionDate(text: string): string {
	let match = text.match(/✅\s*.*?(?=\s|$)/);

	// If not found, try to match the [completion:: 2024-09-28] format
	if (!match) {
		match = text.match(/\[completion::\s*(.*?)\]/);
		if (match) {
			return match
				? match[0].replace("[completion::", "").replace("]", "").trim()
				: "";
		}
	}

	if (!match) {
		match = text.match(/\@completion\(\s*(.*?)\s*\)/);
		if (match) {
			return match
				? match[0].replace("@completion(", "").replace(")", "").trim()
				: "";
		}
	}
	// Return the matched date or date-time, or an empty string if no match
	return match ? match[0].replace("✅", "").trim() : "";
}
