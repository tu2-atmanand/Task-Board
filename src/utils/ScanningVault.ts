// /src/utils/ScanningVaults.ts

import { App, TFile, moment as _moment } from "obsidian";
import {
	extractCheckboxSymbol,
	isCompleted,
	isTaskLine,
} from "./CheckBoxUtils";
import {
	loadJsonCacheDataFromDisk,
	writeJsonCacheDataFromDisk,
} from "./JsonFileOperations";
import {
	jsonCacheData,
	noteItem,
	priorityEmojis,
	taskItem,
} from "src/interfaces/TaskItem";
import {
	scanFilterForFilesNFoldersNFrontmatter,
	scanFilterForTags,
} from "./FiltersVerifier";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { readDataOfVaultFiles } from "./MarkdownFileOperations";
import {
	UniversalDateOptions,
	scanFilters,
} from "src/interfaces/GlobalSettings";

export default class ScanningVault {
	app: App;
	plugin: TaskBoard;
	tasksCache: jsonCacheData;
	TaskDetected: boolean;

	/**
	 * Constructor for ScanningVault
	 * @param app The Obsidian app instance
	 * @param plugin The TaskBoard plugin instance
	 * @description Initializes the ScanningVault with the app and plugin instances, and sets up the initial tasks cache.
	 */
	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.tasksCache = {
			VaultName: this.plugin.app?.vault.getName(),
			Modified_at: new Date().toISOString(),
			Pending: {},
			Completed: {},
			Notes: [],
		}; // Reset task structure
		this.TaskDetected = false;
	}

	// Generate a unique ID for each task
	generateTaskId(): number {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return array[0];
	}

	async initializeTasksCache() {
		try {
			// Load existing tasks from JSON cache
			this.tasksCache = await loadJsonCacheDataFromDisk(this.plugin);
		} catch (error) {
			console.error(
				"Error loading tasks cache from disk\nIf this is appearing on a fresh install then no need to worry.\n",
				error
			);
			this.tasksCache = {
				VaultName: this.plugin?.app.vault.getName(),
				Modified_at: new Date().toISOString(),
				Pending: {},
				Completed: {},
				Notes: [],
			};
		}
	}

	async scanVaultForTasks() {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const scanFilters =
				this.plugin.settings.data.globalSettings.scanFilters;
			if (scanFilterForFilesNFoldersNFrontmatter(this.plugin, file, scanFilters)) {
				await this.extractTasksFromFile(file, scanFilters);
			}
		}

		this.saveTasksToJsonCache();
		// Emit the event
		eventEmitter.emit("REFRESH_BOARD");
	}

	// Extract tasks from a specific file
	async extractTasksFromFile(file: TFile, scanFilters: scanFilters) {
		const fileNameWithPath = file.path;
		const fileContent = await readDataOfVaultFiles(
			this.plugin,
			fileNameWithPath
		);
		const lines = fileContent.split("\n");

		this.tasksCache.Pending[fileNameWithPath] = [];
		this.tasksCache.Completed[fileNameWithPath] = [];

		// First checking if the file contains the reminder property as entered by using in the settings.frontmatterPropertyForReminder. If it contains, then this file needs to be appended in the tasks.Notes list.
		// Extract frontmatter from the file
		const frontmatter = extractFrontmatter(this.plugin, file);
		// console.log(
		// 	"Frontmatter extracted:",
		// 	frontmatter,
		// 	"\nfile:",
		// 	fileNameWithPath,
		// 	"\nvalue of frontmatterPropertyForReminder:",
		// 	this.plugin.settings.data.globalSettings
		// 		.frontmatterPropertyForReminder,
		// 	"\nvalue of frontmatter for the key:",
		// 	frontmatter[
		// 		this.plugin.settings.data.globalSettings
		// 			.frontmatterPropertyForReminder
		// 	],
		// 	"Condition : ",
		// 	this.plugin.settings.data.globalSettings
		// 		.frontmatterPropertyForReminder &&
		// 		frontmatter &&
		// 		frontmatter[
		// 			this.plugin.settings.data.globalSettings
		// 				.frontmatterPropertyForReminder
		// 		]
		// );
		if (
			this.plugin.settings.data.globalSettings
				.frontmatterPropertyForReminder &&
			frontmatter &&
			frontmatter[
				this.plugin.settings.data.globalSettings
					.frontmatterPropertyForReminder
			]
		) {
			const note: noteItem = {
				filePath: fileNameWithPath,
				frontmatter: frontmatter,
				reminder:
					frontmatter[
						this.plugin.settings.data.globalSettings
							.frontmatterPropertyForReminder
					],
			};

			// Check if the note already exists
			const existingNoteIndex = this.tasksCache.Notes.findIndex(
				(n) => n.filePath === fileNameWithPath
			);
			if (existingNoteIndex !== -1) {
				// Replace the existing note
				this.tasksCache.Notes[existingNoteIndex] = note;
			} else {
				// Add the new note
				this.tasksCache.Notes.push(note);
			}
		}

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			if (isTaskLine(line)) {
				const tags = extractTags(line);
				if (scanFilterForTags(tags, scanFilters)) {
					this.TaskDetected = true;
					const taskStatus = extractCheckboxSymbol(line);
					const isTaskCompleted = isCompleted(line);
					const title = extractTitle(line);
					const time = extractTime(line);
					const createdDate = extractCreatedDate(line);
					let startDate = extractStartDate(line);
					let scheduledDate = extractScheduledDate(line);
					let dueDate = extractDueDate(line);
					const priority = extractPriority(line);
					const reminder = extractReminder(
						line,
						startDate,
						scheduledDate,
						dueDate
					);
					const completionDate = extractCompletionDate(line);
					const cancelledDate = extractCancelledDate(line);
					const bodyLines = extractBody(lines, lineIndex + 1);

					if (
						this.plugin.settings.data.globalSettings
							.dailyNotesPluginComp
					) {
						const universalDateFormat =
							this.plugin.settings.data.globalSettings
								.universalDateFormat;
						const basename = file.basename;

						// Check if the basename matches the dueFormat using moment
						const moment =
							_moment as unknown as typeof _moment.default;
						if (
							moment(
								basename,
								universalDateFormat,
								true
							).isValid()
						) {
							if (
								this.plugin.settings.data.globalSettings
									.universalDate ===
								UniversalDateOptions.dueDate
							) {
								dueDate = basename; // If the basename matches the dueFormat, assign it to due
							} else if (
								this.plugin.settings.data.globalSettings
									.universalDate ===
								UniversalDateOptions.startDate
							) {
								startDate = basename; // If the basename matches the dueFormat, assign it to startDate
							} else if (
								this.plugin.settings.data.globalSettings
									.universalDate ===
								UniversalDateOptions.scheduledDate
							) {
								scheduledDate = basename; // If the basename matches the dueFormat, assign it to scheduledDate
							}
						}
					}

					let frontmatterTags: string[] = []; // Initialize frontmatterTags
					if (
						this.plugin.settings.data.globalSettings
							.showFrontmatterTagsOnCards
					) {
						// Extract frontmatter tags
						frontmatterTags = extractFrontmatterTags(frontmatter);
					}

					const task: taskItem = {
						id: this.generateTaskId(),
						status: taskStatus,
						title: title,
						body: bodyLines,
						time: time,
						createdDate: createdDate,
						startDate: startDate,
						scheduledDate: scheduledDate,
						due: dueDate,
						tags: tags,
						frontmatterTags: frontmatterTags,
						priority: priority,
						filePath: fileNameWithPath,
						taskLocation: {
							startLine: lineIndex + 1,
							startCharIndex: 0,
							endLine: lineIndex + 1 + bodyLines.length,
							endCharIndex:
								bodyLines.length > 0
									? bodyLines[bodyLines.length - 1].length
									: line.length,
						},
						completion: completionDate,
						cancelledDate: cancelledDate,
						reminder: reminder,
					};

					if (isTaskCompleted) {
						this.tasksCache.Completed[fileNameWithPath].push(task);
					} else {
						this.tasksCache.Pending[fileNameWithPath].push(task);
					}
				} else {
					// console.log("The tasks is not allowed...");
				}
			}
		}
		if (this.tasksCache.Pending[fileNameWithPath]?.length === 0)
			delete this.tasksCache.Pending[fileNameWithPath];

		if (this.tasksCache.Completed[fileNameWithPath]?.length === 0)
			delete this.tasksCache.Completed[fileNameWithPath];

		this.saveTasksToJsonCache();
	}

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async refreshTasksFromFiles(files: (TFile | null)[]) {
		if (!files || files.length === 0) {
			return;
		}

		const scanFilters =
			this.plugin.settings.data.globalSettings.scanFilters;
		for (const file of files) {
			if (
				file !== null &&
				scanFilterForFilesNFoldersNFrontmatter(this.plugin, file, scanFilters)
			) {
				// TODO : Try testing if removing the await from the below line will going to speed up the process.
				await this.extractTasksFromFile(file, scanFilters).then(
					() => {}
				);

				// const fileNameWithPath = file.path;
				// const fileContent = await this.app.vault.cachedRead(file);
				// const lines = fileContent.split("\n");
				// const newPendingTasks: taskItem[] = [];
				// const newCompletedTasks: taskItem[] = [];

				// for (let i = 0; i < lines.length; i++) {
				// 	const line = lines[i];
				// 	if (isTaskLine(line)) {
				// 		const tags = extractTags(line);
				// 		if (scanFilterForTags(tags, scanFilters)) {
				// 			this.TaskDetected = true;
				// 			const taskStatus = extractCheckboxSymbol(line);
				// 			const isTaskCompleted = isCompleted(line);
				// 			const title = extractTitle(line);
				// 			const time = extractTime(line);
				// 			const createdDate = extractCreatedDate(line);
				// 			const startDate = extractStartDate(line);
				// 			const scheduledDate = extractScheduledDate(line);
				// 			const priority = extractPriority(line);
				// 			const completionDate = extractCompletionDate(line);
				// 			const cancelledDate = extractCancelledDate(line);
				// 			const body = extractBody(lines, i + 1);
				// 			let due = extractDueDate(line);
				// 			if (
				// 				!due &&
				// 				this.plugin.settings.data.globalSettings
				// 					.dailyNotesPluginComp
				// 			) {
				// 				const dueFormat =
				// 					this.plugin.settings.data.globalSettings
				// 						.universalDateFormat;
				// 				const basename = file.basename;

				// 				// Check if the basename matches the dueFormat using moment
				// 				const moment =
				// 					_moment as unknown as typeof _moment.default;
				// 				if (
				// 					moment(basename, dueFormat, true).isValid()
				// 				) {
				// 					due = basename; // If the basename matches the dueFormat, assign it to due
				// 				} else {
				// 					due = ""; // If not, assign an empty string
				// 				}
				// 			}

				// 			let frontmatterTags: string[] = []; // Initialize frontmatterTags
				// 			if (
				// 				this.plugin.settings.data.globalSettings
				// 					.showFrontmatterTagsOnCards
				// 			) {
				// 				// Extract frontmatter from the file
				// 				const frontmatter = extractFrontmatter(
				// 					this.plugin,
				// 					file
				// 				);
				// 				// Extract frontmatter tags
				// 				frontmatterTags =
				// 					extractFrontmatterTags(frontmatter);
				// 			}

				// 			const task: taskItem = {
				// 				id: this.generateTaskId(),
				// 				status: taskStatus,
				// 				title,
				// 				body,
				// 				time,
				// 				createdDate,
				// 				startDate,
				// 				scheduledDate,
				// 				due,
				// 				tags,
				// 				frontmatterTags,
				// 				priority,
				// 				filePath: fileNameWithPath,
				// 				lineNumber: i + 1,
				// 				completion: completionDate,
				// 				cancelledDate: cancelledDate,
				// 			};

				// 			if (isTaskCompleted) {
				// 				newCompletedTasks.push(task);
				// 			} else {
				// 				newPendingTasks.push(task);
				// 			}
				// 		} else {
				// 			// console.log("The tasks is not allowed...");
				// 		}
				// 	}
				// }

				// // Only replace the tasks for the specific file
				// this.tasksCache.Pending = {
				// 	...oldTasks.Pending, // Keep the existing tasks for other files
				// 	[fileNameWithPath]: newPendingTasks, // Update only the tasks for the current file
				// };

				// this.tasksCache.Completed = {
				// 	...oldTasks.Completed, // Keep the existing tasks for other files
				// 	[fileNameWithPath]: newCompletedTasks, // Update only the tasks for the current file
				// };
			} else {
				console.warn("File is not valid...");
			}
		}
	}

	// Save tasks to JSON file
	async saveTasksToJsonCache() {
		await writeJsonCacheDataFromDisk(this.plugin, this.tasksCache);

		// Refresh the board only if any task has be extracted from the updated file.
		if (
			this.TaskDetected &&
			this.plugin.settings.data.globalSettings.realTimeScanning &&
			(Object.values(this.tasksCache.Pending).flat().length > 0 ||
				Object.values(this.tasksCache.Completed).flat().length > 0)
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
		title: title,
		status: taskStatus,
		body: body,
		time: time,
		createdDate: createdDate,
		startDate: startDate,
		scheduledDate: scheduledDate,
		due: due,
		tags: tags,
		priority: priority,
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
	return text.replace(/^- \[.\]\s*/, "");
}

// New function to extract task body
export function extractBody(lines: string[], startLineIndex: number): string[] {
	const bodyLines = [];
	let bodyStartIndex = startLineIndex;
	for (bodyStartIndex; bodyStartIndex < lines.length; bodyStartIndex++) {
		const line = lines[bodyStartIndex];

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

export function extractReminder(
	text: string,
	startDate?: string,
	scheduledDate?: string,
	dueDate?: string
): string {
	let match = text.match(/\[reminder::\s*(.*?)\]/);
	if (match) {
		return match[1].replace(` `, "T").trim();
	}

	match = text.match(/@reminder\(\s*(.*?)\s*\)/);
	if (match) {
		return match[1].replace(` `, "T").trim();
	}

	// match = text.match(/🔔\s*(.*?)(?=\s|$)/);
	// if (match) {
	// 	return match[0].replace("🔔", "").trim();
	// }

	// New patterns
	match = text.match(/\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/);
	if (match) {
		const dateStr = match[1];
		if (dateStr.includes(" ")) {
			const [date, time] = dateStr.split(" ");
			return `${date}T${time}`;
		} else {
			return `${dateStr}T09:00`;
		}
	}

	match = text.match(/\(\@(\d{2}:\d{2})\)/);
	if (match) {
		const baseDate = startDate || scheduledDate || dueDate;
		if (baseDate) {
			return `${baseDate}T${match[1]}`;
		}
	}

	return "";
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
