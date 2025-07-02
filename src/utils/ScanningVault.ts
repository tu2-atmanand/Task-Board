// /src/utils/ScanningVaults.ts

import { App, TFile, moment as _moment, getFrontMatterInfo } from "obsidian";
// import * as yaml from "js-yaml";
import {
	extractCheckboxSymbol,
	isCompleted,
	isTaskLine,
} from "./CheckBoxUtils";
import {
	loadTasksJsonFromDisk,
	writeTasksJsonToDisk,
} from "./JsonFileOperations";
import { priorityEmojis, taskItem, tasksJson } from "src/interfaces/TaskItem";
import {
	scanFilterForFilesNFolders,
	scanFilterForTags,
} from "./FiltersVerifier";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { readDataOfVaultFiles } from "./MarkdownFileOperations";
import { scanFilters } from "src/interfaces/GlobalSettings";

// Function to extract frontmatter from file content
export function extractFrontmatter(plugin: TaskBoard, file: TFile): any {
	// Method 1 - Find the frontmatter using delimiters
	// // Check if the file starts with frontmatter delimiter
	// if (!fileContent.startsWith("---\n")) {
	// 	return null;
	// }

	// // Find the end of frontmatter
	// const secondDelimiterIndex = fileContent.indexOf("\n---\n", 4);
	// if (secondDelimiterIndex === -1) {
	// 	return null;
	// }

	// // Extract the YAML content between delimiters
	// const yamlContent = fileContent.substring(4, secondDelimiterIndex);

	// try {
	// 	// Parse the YAML content
	// 	const frontmatter = yaml.load(yamlContent);
	// 	return frontmatter;
	// } catch (error) {
	// 	console.warn("Failed to parse frontmatter:", error);
	// 	return null;
	// }

	// Method 2 - Get frontmatter using Obsidian API
	try {
		// API-1 : Get fronmatter as a string
		// const fileContent = await this.app.vault.cachedRead(file);
		// const frontmatterAsString =
		// 	getFrontMatterInfo(fileContent).frontmatter;

		// API-2 : Get frontmatter as an object
		const frontmatterAsObject =
			plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		console.log("Frontmatter extracted as an object:", frontmatterAsObject);

		return frontmatterAsObject;
	} catch (error) {
		// console.warn("Failed to parse frontmatter:", error);
		return null;
	}
}

// Function to extract tags from frontmatter
export function extractFrontmatterTags(frontmatter: any): string[] {
	if (!frontmatter) {
		return [];
	}

	let tags: string[] = [];

	// Check if there's a 'tags' property in frontmatter
	if (frontmatter.tags) {
		if (Array.isArray(frontmatter.tags)) {
			// If tags is an array, process each tag
			tags = frontmatter.tags.map((tag: any) => {
				const tagStr = String(tag).trim();
				// Ensure tags start with # if they don't already
				return tagStr.startsWith("#") ? tagStr : `#${tagStr}`;
			});
		} else if (typeof frontmatter.tags === "string") {
			// If tags is a string, split by commas and process
			tags = frontmatter.tags
				.split(",")
				.map((tag: string) => {
					const tagStr = tag.trim();
					return tagStr.startsWith("#") ? tagStr : `#${tagStr}`;
				})
				.filter((tag: string) => tag.length > 1); // Filter out empty tags
		}
	}

	return tags;
}

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

	// Generate a unique ID for each task
	generateTaskId(): number {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return array[0];
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
					const createdDate = extractCreatedDate(line);
					const startDate = extractStartDate(line);
					const scheduledDate = extractScheduledDate(line);
					const due = extractDueDate(line);
					const priority = extractPriority(line);
					const completionDate = extractCompletionDate(line);
					const cancelledDate = extractCancelledDate(line);
					const body = extractBody(lines, i + 1);

					let frontmatterTags: string[] = []; // Initialize frontmatterTags
					if (
						this.plugin.settings.data.globalSettings
							.showFrontmatterTagsOnCards
					) {
						// Extract frontmatter from the file
						const frontmatter = extractFrontmatter(
							this.plugin,
							file
						);
						// Extract frontmatter tags
						frontmatterTags = extractFrontmatterTags(frontmatter);
					}

					const task: taskItem = {
						id: this.generateTaskId(),
						status: taskStatus,
						title,
						body,
						time,
						createdDate,
						startDate,
						scheduledDate,
						due,
						tags,
						frontmatterTags,
						priority,
						filePath: fileNameWithPath,
						lineNumber: i + 1,
						completion: completionDate,
						cancelledDate: cancelledDate,
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
				const newPendingTasks: taskItem[] = [];
				const newCompletedTasks: taskItem[] = [];

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
							const createdDate = extractCreatedDate(line);
							const startDate = extractStartDate(line);
							const scheduledDate = extractScheduledDate(line);
							const priority = extractPriority(line);
							const completionDate = extractCompletionDate(line);
							const cancelledDate = extractCancelledDate(line);
							const body = extractBody(lines, i + 1);
							let due = extractDueDate(line);
							if (
								!due &&
								this.plugin.settings.data.globalSettings
									.dailyNotesPluginComp
							) {
								const dueFormat =
									this.plugin.settings.data.globalSettings
										.universalDateFormat;
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

							let frontmatterTags: string[] = []; // Initialize frontmatterTags
							if (
								this.plugin.settings.data.globalSettings
									.showFrontmatterTagsOnCards
							) {
								// Extract frontmatter from the file
								const frontmatter = extractFrontmatter(
									this.plugin,
									file
								);
								// Extract frontmatter tags
								frontmatterTags =
									extractFrontmatterTags(frontmatter);
							}

							const task: taskItem = {
								id: this.generateTaskId(),
								status: taskStatus,
								title,
								body,
								time,
								createdDate,
								startDate,
								scheduledDate,
								due,
								tags,
								frontmatterTags,
								priority,
								filePath: fileNameWithPath,
								lineNumber: i + 1,
								completion: completionDate,
								cancelledDate: cancelledDate,
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

/**
 * Function to build a task from raw content
 * @param rawTaskContent - The raw content of the task ONLY.
 * @param filePath - Optional file path where the task is located
 * @returns A partial taskItem object with extracted properties
 */
export function buildTaskFromRawContent(
	rawTaskContent: string,
	filePath?: string
): Partial<taskItem> {
	const lines = rawTaskContent.split("\n");
	const taskStatus = extractCheckboxSymbol(lines[0]);
	const title = extractTitle(lines[0]);
	const time = extractTime(lines[0]);
	const createdDate = extractCreatedDate(lines[0]);
	const startDate = extractStartDate(lines[0]);
	const scheduledDate = extractScheduledDate(lines[0]);
	const due = extractDueDate(lines[0]);
	const priority = extractPriority(lines[0]);
	const tags = extractTags(lines[0]);
	const completionDate = extractCompletionDate(lines[0]);
	const cancelledDate = extractCancelledDate(lines[0]);
	const body = extractBody(lines, 1);

	return {
		title,
		status: taskStatus,
		body,
		time,
		createdDate,
		startDate,
		scheduledDate,
		due,
		tags,
		priority,
		completion: completionDate,
		cancelledDate: cancelledDate,
		filePath: filePath || "",
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

	match = text.match(/⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);
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
	const timeIntitleMatch = text.match(
		/⏰\s*\[(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\]/
	);
	return timeIntitleMatch ? timeIntitleMatch[1] : "";
}

// Extract Created date from task title
export function extractCreatedDate(text: string): string {
	let match = text.match(/➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);

	if (!match) {
		match = text.match(
			/\[created::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/
		);
	}

	if (!match) {
		match = text.match(
			/\@created\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/
		);
	}

	return match ? match[1] : "";
}

// Extract Start date from task title
export function extractStartDate(text: string): string {
	let match = text.match(/🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);

	if (!match) {
		match = text.match(
			/\[start::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/
		);
	}

	if (!match) {
		match = text.match(
			/\@start\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/
		);
	}

	return match ? match[1] : "";
}

// Extract Scheduled date from task title
export function extractScheduledDate(text: string): string {
	let match = text.match(/⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);

	if (!match) {
		match = text.match(
			/\[scheduled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/
		);
	}

	if (!match) {
		match = text.match(
			/\@scheduled\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/
		);
	}

	return match ? match[1] : "";
}

// Extract Due date from task title
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
	const matches = text.match(
		/\s+#([^\s!@#$%^&*()+=;:'"?<>{}[\]-]+)(?=\s|$)/g
	);
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

export function extractCancelledDate(text: string): string {
	let match = text.match(/❌\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);

	// If not found, try to match the [cancelled:: 2024-09-28] format
	if (!match) {
		match = text.match(
			/\[cancelled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/
		);
	}

	if (!match) {
		match = text.match(
			/\@cancelled\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/
		);
	}
	// Return the matched date or date-time, or an empty string if no match
	return match ? match[0].trim() : "";
}
