// /src/utils/ScanningVaults.ts

import { App, Notice, TFile, moment as _moment, debounce } from "obsidian";
import {
	extractCheckboxSymbol,
	getObsidianIndentationSetting,
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
import {
	extractTaskNoteProperties,
	isTaskNotePresentInFrontmatter,
} from "./TaskNoteUtils";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { readDataOfVaultFile } from "./MarkdownFileOperations";
import {
	UniversalDateOptions,
	scanFilters,
} from "src/interfaces/GlobalSettings";
import {
	TaskRegularExpressions,
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
} from "../regularExpressions/TasksPluginRegularExpr";
import { DATAVIEW_PLUGIN_DEFAULT_SYMBOLS } from "src/regularExpressions/DataviewPluginRegularExpr";
import {
	extractFrontmatterFromFile,
	extractFrontmatterTags,
} from "./FrontmatterOperations";
import { t } from "./lang/helper";
import {
	allowedFileExtensionsRegEx,
	notAllowedFileExtensionsRegEx,
} from "src/regularExpressions/MiscelleneousRegExpr";
import { bugReporter } from "src/services/OpenModals";

/**
 * Creates a vault scanner mechanism and holds the latest tasksCache inside RAM.
 * @param app The Obsidian app instance
 * @param plugin The TaskBoard plugin instance
 * @description Initializes the vaultScanner with the app and plugin instances, and sets up the initial tasks cache.
 */
export default class vaultScanner {
	app: App;
	plugin: TaskBoard;
	tasksCache: jsonCacheData;
	TaskDetected: boolean;
	indentationString: string;

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
		this.indentationString = getObsidianIndentationSetting(plugin);
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
			if (
				scanFilterForFilesNFoldersNFrontmatter(
					this.plugin,
					file,
					scanFilters
				)
			) {
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
		const fileContent = await readDataOfVaultFile(
			this.plugin,
			fileNameWithPath
		);
		const lines = fileContent.split("\n");

		this.tasksCache.Pending[fileNameWithPath] = [];
		this.tasksCache.Completed[fileNameWithPath] = [];

		// Extract frontmatter from the file
		const frontmatter = extractFrontmatterFromFile(this.plugin, file);
		console.log(
			"FrontmatterCache extracted : ",
			frontmatter,
			"\nFor file:",
			fileNameWithPath,
			"\nValue of first tag:",
			frontmatter?.tags?.[0]
		);
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

		// This code is to detect if the reminder property is present in the frontmatter. If present, then add this file in the tasks.Notes list. This is specifically for Notifian integration and for other plugins which might want to use this reminder property for notes.
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

		// Task Note Detection: Check if this note is marked as a task note
		if (
			this.plugin.settings.data.globalSettings.experimentalFeatures &&
			frontmatter &&
			isTaskNotePresentInFrontmatter(this.plugin, frontmatter)
		) {
			this.TaskDetected = true;

			// Extract properties from frontmatter
			const taskNoteProperties = extractTaskNoteProperties(
				frontmatter,
				fileNameWithPath
			);

			// Extract sub-tasks from the note content (excluding frontmatter)
			const contentWithoutFrontmatter = fileContent.replace(
				/^---[\s\S]*?---\n?/,
				""
			);
			const contentLines = contentWithoutFrontmatter.split("\n");
			const subTasks: string[] = [];

			// Find tasks within the note content to use as sub-tasks
			for (
				let lineIndex = 0;
				lineIndex < contentLines.length;
				lineIndex++
			) {
				const line = contentLines[lineIndex];
				if (isTaskLine(line)) {
					// Add this task line as a sub-task
					subTasks.push(line);
				}
			}

			// Create task item for the task note
			const taskNoteItem: taskItem = {
				id: Number(taskNoteProperties.id)
					? Number(taskNoteProperties.id)
					: generateRandomTempTaskId(),
				legacyId: taskNoteProperties.id
					? String(taskNoteProperties.id)
					: "", // Storing the legacyId for backward compatibility
				title: taskNoteProperties.title || file.basename,
				body: subTasks, // Store sub-tasks in body
				createdDate: taskNoteProperties.createdDate || "",
				startDate: taskNoteProperties.startDate || "",
				scheduledDate: taskNoteProperties.scheduledDate || "",
				due: taskNoteProperties.due || "",
				tags: taskNoteProperties.tags || [],
				frontmatterTags: [],
				time: "", // Task notes don't have time ranges
				priority: taskNoteProperties.priority || 0,
				dependsOn: taskNoteProperties.dependsOn || [],
				status: taskNoteProperties.status || " ", // Default to unchecked
				filePath: fileNameWithPath,
				taskLocation: {
					startLine: 1,
					startCharIndex: 0,
					endLine: lines.length,
					endCharIndex: lines[lines.length - 1]?.length || 0,
				},
				completion: taskNoteProperties.completion || "",
				cancelledDate: taskNoteProperties.cancelledDate || "",
				reminder: taskNoteProperties.reminder || "",
			};

			console.log("Task Note Item Created:", taskNoteItem);

			// Add to appropriate cache based on completion status
			const isTaskNoteCompleted =
				taskNoteItem.status === "unchecked" || taskNoteItem.status === "pending";
			if (isTaskNoteCompleted) {
				// this.tasksCache.Completed[fileNameWithPath].push(taskNoteItem);
				const completed = this.tasksCache.Completed;
				if (completed) {
					delete completed[fileNameWithPath];
					this.tasksCache.Completed = {
						[fileNameWithPath]: [taskNoteItem],
						...completed,
					};
				}
			} else {
				// this.tasksCache.Pending[fileNameWithPath].push(taskNoteItem);
				const pending = this.tasksCache.Pending;
				if (pending) {
					// Remove and re-insert at the top
					// const tasks = pending[fileNameWithPath];
					delete pending[fileNameWithPath];
					this.tasksCache.Pending = {
						[fileNameWithPath]: [taskNoteItem],
						...pending,
					};
				}
			}
		} else {
			// Else, proceed with normal task line detection inside the file content.
			for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
				const line = lines[lineIndex];
				if (isTaskLine(line)) {
					const tags = extractTags(line);
					if (scanFilterForTags(tags, scanFilters)) {
						this.TaskDetected = true;
						const legacyId = extractTaskId(line);
						const taskStatus = extractCheckboxSymbol(line);
						const isTaskCompleted = isCompleted(line);
						// const title = extractTitle(line);
						const title = line; // we will be storing the taskLine as it is inside the title property
						const time = extractTime(line);
						const createdDate = extractCreatedDate(line);
						let startDate = extractStartDate(line);
						let scheduledDate = extractScheduledDate(line);
						let dueDate = extractDueDate(line);
						const priority = extractPriority(line);
						const dependsOn = extractDependsOn(line)[1];
						const reminder = extractReminder(
							line,
							startDate,
							scheduledDate,
							dueDate
						);
						const completionDate = extractCompletionDate(line);
						const cancelledDate = extractCancelledDate(line);
						const bodyLines = extractBody(
							lines,
							lineIndex + 1,
							this.indentationString
						);

						if (
							this.plugin.settings.data.globalSettings
								.dailyNotesPluginComp &&
							((this.plugin.settings.data.globalSettings
								.universalDate ===
								UniversalDateOptions.dueDate &&
								dueDate === "") ||
								(this.plugin.settings.data.globalSettings
									.universalDate ===
									UniversalDateOptions.startDate &&
									startDate === "") ||
								(this.plugin.settings.data.globalSettings
									.universalDate ===
									UniversalDateOptions.scheduledDate &&
									scheduledDate === ""))
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
							frontmatterTags =
								extractFrontmatterTags(frontmatter);
						}

						const task: taskItem = {
							id: Number(legacyId)
								? Number(legacyId)
								: generateRandomTempTaskId(),
							legacyId: legacyId, // Storing the legacyId for backward compatibility
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
							dependsOn: dependsOn
								? dependsOn.split(",").map((d) => d.trim())
								: [],
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

						console.log("Task Item Created:", task);

						if (isTaskCompleted) {
							this.tasksCache.Completed[fileNameWithPath].push(
								task
							);
						} else {
							this.tasksCache.Pending[fileNameWithPath].push(
								task
							);
						}
						lineIndex = lineIndex + bodyLines.length; // Move the lineIndex forward by the number of body lines
					} else {
						// console.log("The tasks is not allowed...");
					}
				}
			}

			if (this.tasksCache.Pending[fileNameWithPath]?.length === 0) {
				delete this.tasksCache.Pending[fileNameWithPath];
			} else {
				// Moving the fileNameWithPath object to be placed at the top inside this.tasksCache.Pending, so that its shown at top inside columns as a default sorting criteria to show latest modified tasks on top.
				const pending = this.tasksCache.Pending;
				if (pending && pending[fileNameWithPath]) {
					// Remove and re-insert at the top
					const tasks = pending[fileNameWithPath];
					delete pending[fileNameWithPath];
					this.tasksCache.Pending = {
						[fileNameWithPath]: tasks,
						...pending,
					};
				}
			}

			if (this.tasksCache.Completed[fileNameWithPath]?.length === 0) {
				delete this.tasksCache.Completed[fileNameWithPath];
			} else {
				const completed = this.tasksCache.Completed;
				if (completed && completed[fileNameWithPath]) {
					// Remove and re-insert at the top
					const tasks = completed[fileNameWithPath];
					delete completed[fileNameWithPath];
					this.tasksCache.Completed = {
						[fileNameWithPath]: tasks,
						...completed,
					};
				}
			}
		}

		this.saveTasksToJsonCache(); // TODO : This function call can be moved to the place where I am calling extractTasksFromFile for each file. No need to call this function after each file scan.
	}

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async refreshTasksFromFiles(files: (TFile | null)[], showNotice: boolean) {
		if (!files || files.length === 0) {
			return;
		}

		const scanFilters =
			this.plugin.settings.data.globalSettings.scanFilters;
		for (const file of files) {
			if (
				file !== null &&
					fileTypeAllowedForScanning(this.plugin, file) &&
				scanFilterForFilesNFoldersNFrontmatter(
					this.plugin,
					file,
					scanFilters
				)
			) {
				// TODO : Try testing if removing the await from the below line will going to speed up the process.
				await this.extractTasksFromFile(file, scanFilters).then(() => {
					if (showNotice) {
						new Notice("tasks-refreshed-successfully");
					}
				});

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
				// 				const frontmatter = extractFrontmatterFromFile(
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
				if (showNotice) {
					new Notice(t("not-valid-file-type-for-scanning"), 5000);
				}
			}
		}
	}

	// Debounced saveTasksToJsonCache function
	private saveTasksToJsonCacheDebounced = debounce(async () => {
		if (!this.TaskDetected) return;

		this.tasksCache.Modified_at = new Date().toISOString();
		await writeJsonCacheDataFromDisk(this.plugin, this.tasksCache);
		this.plugin.saveSettings();
		if (
			this.plugin.settings.data.globalSettings.realTimeScanning &&
			(Object.values(this.tasksCache.Pending).flat().length > 0 ||
				Object.values(this.tasksCache.Completed).flat().length > 0)
		) {
			eventEmitter.emit("REFRESH_COLUMN");
			this.TaskDetected = false;
		}
	}, 500);

	// Save tasks to JSON file
	saveTasksToJsonCache() {
		this.saveTasksToJsonCacheDebounced();
	}
}

export function fileTypeAllowedForScanning(
	plugin: TaskBoard,
	file: TFile | TAbstractFile
): boolean {
	if (
		notAllowedFileExtensionsRegEx.test(file.path) ||
		file.path ===
			plugin.settings.data.globalSettings.archivedTasksFilePath ||
		allowedFileExtensionsRegEx.test(file.path) === false
	) {
		return false;
	}

	return true;
}

// Generate a unique ID for each task
export function generateRandomTempTaskId(): number {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0];
}

// Generate a unique ID for each task
export function generateTaskId(plugin: TaskBoard): number {
	plugin.settings.data.globalSettings.uniqueIdCounter =
		plugin.settings.data.globalSettings.uniqueIdCounter + 1 || 0;

	console.log(
		"Generated unique ID:",
		plugin.settings.data.globalSettings.uniqueIdCounter
	);
	// Save the updated uniqueIdCounter back to settings
	// plugin.saveSettings();
	// Return the current counter value and then increment it for the next ID
	return plugin.settings.data.globalSettings.uniqueIdCounter;
}

/**
 * Function to build a task from raw content
 * @param rawTaskContent - The raw content of the task ONLY.
 * @param filePath - Optional file path where the task is located
 * @returns A partial taskItem object with extracted properties
 */
export function buildTaskFromRawContent(
	rawTaskContent: string,
	indentationString: string,
	filePath?: string
): Partial<taskItem> {
	const lines = rawTaskContent.split("\n");
	const taskStatus = extractCheckboxSymbol(lines[0]);
	const title = lines[0]; // extractTitle(lines[0]);
	const time = extractTime(lines[0]);
	const createdDate = extractCreatedDate(lines[0]);
	const startDate = extractStartDate(lines[0]);
	const scheduledDate = extractScheduledDate(lines[0]);
	const due = extractDueDate(lines[0]);
	const priority = extractPriority(lines[0]);
	const tags = extractTags(lines[0]);
	const completionDate = extractCompletionDate(lines[0]);
	const cancelledDate = extractCancelledDate(lines[0]);
	const body = extractBody(lines, 1, indentationString);

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

export function extractTaskId(text: string): string {
	let idMatch = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex
	);
	console.log("ID Match using emoji regex:", idMatch);
	if (idMatch && idMatch[1]) {
		return idMatch[1].trim();
	}

	idMatch = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex
	);
	if (idMatch && idMatch[1]) {
		return idMatch[1].trim();
	}

	idMatch = text.match(/\@id\(\s*(.*?)\)/);
	if (idMatch && idMatch[1]) {
		return idMatch[1].trim();
	}

	return "";
}

// New function to extract task body
export function extractBody(
	lines: string[],
	startLineIndex: number,
	indentationString: string
): string[] {
	const bodyLines = [];
	let bodyStartIndex = startLineIndex;
	const prevLine = lines[bodyStartIndex - 1];
	for (bodyStartIndex; bodyStartIndex < lines.length; bodyStartIndex++) {
		const line = lines[bodyStartIndex];
		// Using regex for faster matching/removal of leading '>' or '> '
		const sanitizedLine = line.replace(/^>\s?/, "");

		if (sanitizedLine.trim() === "") {
			break;
		}

		let n = 0;
		if (prevLine.startsWith(indentationString)) {
			console.log("Previous line has indentation\nLine:", prevLine);
			let tempLine = prevLine;
			while (tempLine.startsWith(indentationString)) {
				n++;
				tempLine = tempLine.slice(indentationString.length);
			}
			const requiredIndent = indentationString.repeat(n + 1);
			if (!sanitizedLine.startsWith(requiredIndent)) {
				return [];
			}
		}

		// console.log(
		// 	"Line:",
		// 	line,
		// 	"\nSanitized line:",
		// 	sanitizedLine,
		// 	"\nIndentation String:'",
		// 	indentationString,
		// 	"'",
		// 	"\nLenth of indentationString:",
		// 	indentationString.length,
		// 	"\nsanitizedLine starts with indentationString:",
		// 	sanitizedLine.startsWith(indentationString),
		// 	"\nSanitized line starts with tab:",
		// 	sanitizedLine.startsWith("\t")
		// );
		// If the line has one level of indentation, consider it part of the body
		if (
			sanitizedLine.startsWith(indentationString) ||
			sanitizedLine.startsWith("\t")
		) {
			bodyLines.push(line);
		} else {
			// TODO : Initially i tried considering the next line without any indentation also as the body of the task, but if user has added multiple tasks right one after another then those should be different tasks.
			// bodyLines.push(`\t${line}`);
			break;
		}
	}

	return bodyLines.at(0)?.trim() === "" ? [] : bodyLines;
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
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.createdDateRegex
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
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.startDateRegex
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
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.scheduledDateRegex
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
		match = text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.dueDateRegex
		);
	}

	if (!match) {
		match = text.match(/\@due\(\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\)/);
	}

	return match ? match[1] : "";
}

// Extract priority from task title using RegEx
export function extractPriority(text: string): number {
	let match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.priorityRegex
	);
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
	const matches = text.match(TaskRegularExpressions.hashTagsRegex);
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

	// This will be enabled, after Tasks plugin will support the reminder property.
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

export function extractDependsOn(text: string): string[] {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.dependsOnRegex
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\[depends on::\s*(.*?)\]/);
	if (match && match[1]) {
		return match[1]
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
	}

	match = text.match(/\@dependsOn\(\s*(.*?)\s*\)/);
	if (match && match[1]) {
		return match[1]
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
	}

	return [];
}

// Extract completion date-time value
export function extractCompletionDate(text: string): string {
	let match = text.match(/✅\s*.*?(?=\s|$)/);

	// If not found, try to match the [completion:: 2024-09-28] format
	if (!match) {
		match = text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.doneDateRegex
		);
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
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.cancelledDateRegex
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
