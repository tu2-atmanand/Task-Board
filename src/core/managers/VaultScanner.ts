// /src/utils/ScanningVaults.ts

import { App, Notice, TAbstractFile, TFile, TFolder } from "obsidian";
import { t } from "i18next";
import type TaskBoard from "../../../main.js";
import { UniversalDateOptions } from "../../interfaces/Enums.js";
import {
	DEFAULT_SETTINGS,
	globalSettingsData,
} from "../../interfaces/GlobalSettings.js";
import {
	jsonCacheData,
	taskItem,
	taskItemWithCustomProperties,
} from "../../interfaces/TaskItem.js";
import { allowedFileExtensionsRegEx } from "../../utils/regular_expressions/MiscelleneousRegExpr.js";
import { eventEmitter } from "../../services/EventEmitter.js";
import {
	scanFilterForTags,
	scanFilterForFilesNFoldersNFrontmatter,
} from "../algorithms/ScanningFilterer.js";
import {
	getObsidianIndentationSetting,
	isTaskLine,
	isTaskCompleted,
	extractCheckboxSymbol,
} from "../../utils/CheckBoxUtils.js";
import {
	getCurrentLocalDateTimeString,
	parseDateOnlyValue,
} from "../../utils/DateTimeCalculations.js";
import {
	loadJsonCacheDataFromDisk,
	writeJsonCacheDataToDisk,
} from "../../utils/JsonFileOperations.js";
import { readDataOfVaultFile } from "../../utils/MarkdownFileOperations.js";
import { generateRandomStringId } from "../../utils/TaskItemUtils.js";
import {
	extractFrontmatterFromFile,
	extractFrontmatterTags,
} from "../../utils/task_note/FrontmatterOperations.js";
import {
	isTaskNotePresentInFrontmatter,
	extractTaskNoteProperties,
} from "../../utils/task_note/TaskNoteUtils.js";
import { bugReporterManagerInsatance } from "./BugReporter.js";
import type { VaultScannnerFilters } from "../../interfaces/GlobalSettings.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../interfaces/Enums.js";
import {
	extractBody,
	extractTags,
	extractTaskId,
	extractTaskPropertiesAllTYpe,
	extractTaskPropertiesOfSingleFormat,
} from "../../utils/task_line/PropertiesParsing.js";
import { defaultTaskStatuses } from "../../interfaces/Mapping.js";

/**
 * Creates a vault scanner mechanism and holds the latest tasksCache inside RAM.
 * @param app The Obsidian app instance
 * @param plugin The TaskBoard plugin instance
 * @description Initializes the vaultScanner with the app and plugin instances, and sets up the initial tasks cache.
 */
export default class VaultScanner {
	app: App;
	plugin: TaskBoard;
	public tasksCache: jsonCacheData;
	tasksDetectedOrUpdated: boolean;
	indentationString: string;
	supportedChecklistSymbols: string[];

	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.tasksCache = {
			VaultName: this.plugin.app?.vault.getName(),
			Modified_at: getCurrentLocalDateTimeString(),
			Pending: {},
			Completed: {},
		}; // Reset task structure
		this.tasksDetectedOrUpdated = false;

		// Some recursively used constants
		this.indentationString = getObsidianIndentationSetting(plugin);
		this.supportedChecklistSymbols = [];
		this.plugin.settings.data.customStatuses.forEach((status) => {
			this.supportedChecklistSymbols.push(status.symbol);
		});
	}

	private get globalSettings(): globalSettingsData {
		return this.plugin.settings.data;
	}

	async initializeTasksCache() {
		try {
			// Load existing tasks from JSON cache
			this.tasksCache = await loadJsonCacheDataFromDisk(this.plugin);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				145,
				`No need to worry if this is appearing on the fresh install.\n${String(error)}`,
				"RealTimeScanner.ts/initializeTasksCache",
			);
			this.tasksCache = {
				VaultName: this.plugin?.app.vault.getName(),
				Modified_at: getCurrentLocalDateTimeString(),
				Pending: {},
				Completed: {},
			};
		}
	}

	/**
	 * Scans a single file to extract inline-tasks or if its a task-note.
	 * The scanned tasks will be stored inside memory of the VaultScanner.
	 * You will need to call the function {@link saveTasksToJsonCache}
	 * to save the updated cache to disk.
	 *
	 * @param file A single file of type TFile
	 * @param scanFilters The scanning filters configured by user.
	 * @returns A string error or success code :
	 * - "true" - If the operation was successful.
	 * - "false" - If the file is empty or there was error encountered during scanning the file.
	 */
	async extractTasksFromFile(
		file: TFile,
		scanFilters: VaultScannnerFilters,
	): Promise<string> {
		try {
			const userConfiguredDateFormat =
				this.plugin.settings.data.dateFormat;
			const fileNameWithPath = file.path;
			const fileContent = await readDataOfVaultFile(
				this.plugin,
				fileNameWithPath,
				false,
			);
			if (fileContent == null) return "false";

			const lines = fileContent.split("\n");

			const oldPendingFileCache =
				this.tasksCache.Pending[fileNameWithPath];
			const oldCompletedFileCache =
				this.tasksCache.Completed[fileNameWithPath];

			this.tasksCache.Pending[fileNameWithPath] = [];
			this.tasksCache.Completed[fileNameWithPath] = [];

			// Extract frontmatter from the file
			const frontmatter = extractFrontmatterFromFile(this.plugin, file);

			/**
			 * @deprecated v1.9.0
			 * @note - Below feature has been removed now, since users can simply convert any note into a task-note. So, it doesnt make sense to store simply the note name inside the cache seperately. Also, this note, to which user has added a 'reminder' will not appear on the Task Board. Hence this feature will not be used anymore.
			 *
			 */
			// Below code is to detect if the reminder property is present in the frontmatter. If present, then add this file in the tasks.Notes list. This is specifically for Notifian integration and for other plugins which might want to use this reminder property for notes.
			// if (
			// 	this.plugin.settings.data
			// 		.frontmatterPropertyForReminder &&
			// 	frontmatter &&
			// 	frontmatter[
			// 		this.plugin.settings.data
			// 			.frontmatterPropertyForReminder
			// 	]
			// ) {
			// 	const note: noteItem = {
			// 		filePath: fileNameWithPath,
			// 		frontmatter: frontmatter,
			// 		reminder:
			// 			frontmatter[
			// 				this.plugin.settings.data
			// 					.frontmatterPropertyForReminder
			// 			],
			// 	};

			// 	// Check if the note already exists
			// 	const existingNoteIndex = this.tasksCache.Notes.findIndex(
			// 		(n) => n.filePath === fileNameWithPath
			// 	);
			// 	if (existingNoteIndex !== -1) {
			// 		// Replace the existing note
			// 		this.tasksCache.Notes[existingNoteIndex] = note;
			// 	} else {
			// 		// Add the new note
			// 		this.tasksCache.Notes.push(note);
			// 	}
			// }

			// Task Note Detection: Check if this note is marked as a task note
			if (
				frontmatter &&
				isTaskNotePresentInFrontmatter(
					this.plugin.settings.data.taskNoteIdentifierTag,
					frontmatter,
					this.plugin.settings.data.taskProperties.find(
						(property) =>
							property.key === DEFAULT_TASK_CACHE_KEYS.Tags,
					)?.id,
				)
			) {
				// Extract properties from frontmatter
				const taskNoteProperties = extractTaskNoteProperties(
					frontmatter,
					this.plugin.settings,
				);
				if (
					scanFilterForTags(
						taskNoteProperties?.[DEFAULT_TASK_CACHE_KEYS.Tags] ||
							[],
						scanFilters,
					)
				) {
					this.tasksDetectedOrUpdated = true;

					// Extract sub-tasks from the note content (excluding frontmatter)
					const contentWithoutFrontmatter = fileContent.replace(
						/^---[\s\S]*?---\n?/,
						"",
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
					const taskNoteItem: taskItemWithCustomProperties = {
						...taskNoteProperties,
						id: taskNoteProperties?.[DEFAULT_TASK_CACHE_KEYS.ID]
							? taskNoteProperties[DEFAULT_TASK_CACHE_KEYS.ID]
							: generateRandomStringId(),
						legacyId: taskNoteProperties?.[
							DEFAULT_TASK_CACHE_KEYS.ID
						]
							? taskNoteProperties[DEFAULT_TASK_CACHE_KEYS.ID]
							: "", // Storing the legacyId for backward compatibility
						status:
							taskNoteProperties?.[
								DEFAULT_TASK_CACHE_KEYS.Status
							] || defaultTaskStatuses.unchecked,
						title:
							taskNoteProperties?.[
								DEFAULT_TASK_CACHE_KEYS.Title
							] || file.basename,
						body: subTasks, // Store sub-tasks in body
						filePath: fileNameWithPath,
						taskLocation: {
							startLine: 1,
							startCharIndex: 0,
							endLine: lines.length,
							endCharIndex: lines[lines.length - 1]?.length || 0,
						},
					};

					// Add to appropriate cache based on completion status
					const isTaskNoteCompleted = isTaskCompleted(
						taskNoteProperties[DEFAULT_TASK_CACHE_KEYS.Status] ||
							" ",
						true,
						this.plugin.settings,
					);
					if (isTaskNoteCompleted) {
						// this.tasksCache.Completed[fileNameWithPath].push(taskNoteItem);
						const completed = this.tasksCache.Completed;
						if (completed) {
							delete completed[fileNameWithPath];
						}

						this.tasksCache.Completed = {
							[fileNameWithPath]: [taskNoteItem],
							...(completed || {}),
						};

						if (this.tasksCache.Pending[fileNameWithPath])
							delete this.tasksCache.Pending[fileNameWithPath];
					} else {
						// this.tasksCache.Pending[fileNameWithPath].push(taskNoteItem);
						const pending = this.tasksCache.Pending;
						if (pending) {
							// Remove and re-insert at the top
							// const tasks = pending[fileNameWithPath];
							delete pending[fileNameWithPath];
						}
						this.tasksCache.Pending = {
							[fileNameWithPath]: [taskNoteItem],
							...pending,
						};

						if (this.tasksCache.Completed[fileNameWithPath])
							delete this.tasksCache.Completed[fileNameWithPath];
					}

					const pendingCacheCompare = await this.compareFileCache(
						this.tasksCache.Pending[fileNameWithPath],
						oldPendingFileCache,
					);
					const completedCacheCompare = await this.compareFileCache(
						this.tasksCache.Completed[fileNameWithPath],
						oldCompletedFileCache,
					);
					if (pendingCacheCompare && completedCacheCompare) {
						this.tasksDetectedOrUpdated = false;
					}
				}

				// Cleanup the file-object if it doesnt contain any taskItem.
				if (this.tasksCache.Pending[fileNameWithPath]?.length === 0) {
					delete this.tasksCache.Pending[fileNameWithPath];
				}
				if (this.tasksCache.Completed[fileNameWithPath]?.length === 0) {
					delete this.tasksCache.Completed[fileNameWithPath];
				}

				return "true";
			} else {
				// Else, proceed with inline-tasks(checklists) detection inside the file content.
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];
					if (isTaskLine(line)) {
						const taskStatus = extractCheckboxSymbol(line);
						const bodyLines = extractBody(
							lines,
							lineIndex + 1,
							this.indentationString,
						);

						// Since v1.10.0 - Read this ticket : https://github.com/tu2-atmanand/Task-Board/issues/737
						if (
							!this.supportedChecklistSymbols.includes(taskStatus)
						) {
							lineIndex = lineIndex + bodyLines.length;
							continue; // We will going to skip storing this task inside the cache.
						}

						const tags = extractTags(line);
						if (scanFilterForTags(tags, scanFilters)) {
							this.tasksDetectedOrUpdated = true;
							const legacyId = extractTaskId(
								line,
								this.globalSettings.taskProperties,
								this.globalSettings.scanForAllFormat
									? undefined
									: this.globalSettings.taskPropertyFormat,
							);
							const isThisCompletedTask = isTaskCompleted(
								line,
								false,
								this.plugin.settings,
							);
							const title = line.trimEnd(); // we will be storing the taskLine as it is inside the title property

							const allExtractedProperties: Partial<taskItem> =
								this.globalSettings.scanForAllFormat
									? extractTaskPropertiesAllTYpe(
											line,
											this.globalSettings,
										)
									: extractTaskPropertiesOfSingleFormat(
											line,
											this.globalSettings,
										);

							if (
								this.plugin.settings.data.dailyNotesPluginComp
							) {
								const basename = file.basename;

								// Check if the basename matches the date format
								// const parsed = parse(
								// 	basename,
								// 	universalDateFormat,
								// 	this.testDate,
								// );
								const parsed = parseDateOnlyValue(
									basename,
									userConfiguredDateFormat,
								);
								if (parsed) {
									const universalDateConfig =
										this.plugin.settings.data.universalDate;

									if (
										universalDateConfig ===
											UniversalDateOptions.dueDate &&
										!allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS.DueDate
										]
									) {
										allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS.DueDate
										] = parsed.getTime();
									} else if (
										universalDateConfig ===
											UniversalDateOptions.startDate &&
										!allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS.StartDate
										]
									) {
										allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS.StartDate
										] = parsed.getTime();
									} else if (
										universalDateConfig ===
											UniversalDateOptions.scheduledDate &&
										!allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS
												.ScheduledDate
										]
									) {
										allExtractedProperties[
											DEFAULT_TASK_CACHE_KEYS.ScheduledDate
										] = parsed.getTime();
									}
								}
							}

							let frontmatterTags: string[] = []; // Initialize frontmatterTags
							if (
								this.plugin.settings.data
									.showFrontmatterTagsOnCards
							) {
								// Extract frontmatter tags
								frontmatterTags =
									extractFrontmatterTags(frontmatter);
							}

							const task: taskItemWithCustomProperties = {
								...allExtractedProperties,
								id: legacyId
									? (legacyId[1] ?? "")
									: generateRandomStringId(),
								legacyId: legacyId ? legacyId[1] : "", // Storing the legacyId for backward compatibility
								status: taskStatus,
								title: title,
								body: bodyLines,
								tags: tags,
								frontmatterTags: frontmatterTags,
								filePath: fileNameWithPath,
								taskLocation: {
									startLine: lineIndex + 1,
									startCharIndex: 0,
									endLine: lineIndex + 1 + bodyLines.length,
									endCharIndex:
										bodyLines.length > 0
											? bodyLines[bodyLines.length - 1]
													.length
											: line.length,
								},
							};

							if (isThisCompletedTask) {
								this.tasksCache.Completed[
									fileNameWithPath
								].push(task);
							} else {
								this.tasksCache.Pending[fileNameWithPath].push(
									task,
								);
							}
							lineIndex = lineIndex + bodyLines.length; // Move the lineIndex forward by the number of body lines
						} else {
							// console.log("The tasks is not allowed...");
						}
					}
				}

				const pendingCacheCompare = await this.compareFileCache(
					this.tasksCache.Pending[fileNameWithPath],
					oldPendingFileCache,
				);
				const completedCacheCompare = await this.compareFileCache(
					this.tasksCache.Completed[fileNameWithPath],
					oldCompletedFileCache,
				);

				if (pendingCacheCompare) {
					this.tasksDetectedOrUpdated = false;
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

					// Moving the completed file cache to the top.
					// TODO : For now will keep this disabled, since in the Completed column the sorting should be based on the completion date-time value.
					// const completed = this.tasksCache.Completed;
					// if (completed && completed[fileNameWithPath]) {
					// 	// Remove and re-insert at the top
					// 	const tasks = completed[fileNameWithPath];
					// 	delete completed[fileNameWithPath];
					// 	this.tasksCache.Completed = {
					// 		[fileNameWithPath]: tasks,
					// 		...completed,
					// 	};
					// }
				}

				if (!completedCacheCompare) this.tasksDetectedOrUpdated = true;

				// Cleanup the file-object if it doesnt contain any taskItem.
				if (
					this.tasksCache.Pending[fileNameWithPath]?.length === 0 &&
					oldPendingFileCache
				) {
					// const secondCondition =
					// 	oldPendingFileCache.length !== 0 ||
					// 	// First sub-condition is whether the olderCache was non empty
					// 	// The second sub-condition is to check if the older file was a task-note. This second sub-condition is required in the case when user simply removes the taskNoteIdentifierTag from the frontmatter of the note, so its not longer a task-note now and also if the note doesnt have any tasks in its content, then this task-note cache should be removed.
					// 	(oldPendingFileCache.length === 1 &&
					// 		isTaskNotePresentInTags(
					// 			this.plugin.settings.data
					// 				.taskNoteIdentifierTag,
					// 			oldPendingFileCache[0].tags
					// 		));
					// if (secondCondition) {
					// }

					delete this.tasksCache.Pending[fileNameWithPath];
					this.tasksDetectedOrUpdated = true;
				}

				// secondCondition =
				// 	(oldCompletedFileCache &&
				// 		oldCompletedFileCache.length !== 0) ||
				// 	(oldCompletedFileCache &&
				// 		oldCompletedFileCache.length === 1 &&
				// 		isTaskNotePresentInTags(
				// 			this.plugin.settings.data
				// 				.taskNoteIdentifierTag,
				// 			oldCompletedFileCache[0].tags
				// 		));

				if (
					this.tasksCache.Completed[fileNameWithPath]?.length === 0 &&
					oldCompletedFileCache
				) {
					delete this.tasksCache.Completed[fileNameWithPath];
					this.tasksDetectedOrUpdated = true;
				}

				return "true";
			}
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				146,
				String(error),
				"VaultScanner.ts/extractTasksFromFile",
			);
			return "false";
		}
	}

	/**
	 * Scans all the files and extracts inline-tasks or if the file itself is a task-note. This function will pass the files and inline-tasks through the scanning filters.
	 *
	 * @param files - List of TFile objects to be scanned.
	 * @param showNotice Whether to show notice for successful or failed operations. If this function is invoked by user, then notice will be shown as an feedback.
	 * @returns - True - If the operation was successful and all files were scanned without any issues.
	 * - False - If there was some issue while scanning the files.
	 */
	async refreshTasksFromFiles(
		files: (TFile | null)[],
		showNotice: boolean,
	): Promise<boolean> {
		if (!files || files.length === 0) {
			return true;
		}

		try {
			const scanFilters = this.plugin.settings.data.scanFilters;
			let isFileScanned: string = "";
			for (const file of files) {
				if (
					file !== null &&
					scanFilterForFilesNFoldersNFrontmatter(
						this.plugin,
						file,
						scanFilters,
					)
				) {
					// TODO : Try testing if removing the await from the below line will going to speed up the process.
					isFileScanned = await this.extractTasksFromFile(
						file,
						scanFilters,
					);
				} else {
					if (showNotice) {
						new Notice(t("not-valid-file-type-for-scanning"), 5000);
					}
				}
			}

			if (isFileScanned === "true") {
				if (showNotice) {
					new Notice(t("tasks-refreshed-successfully"));
				}

				if (this.tasksDetectedOrUpdated) {
					let result = await this.saveTasksToJsonCache();
					if (!result) {
						throw new Error(
							"There was an error while saving the tasks cache.",
						);
					}
				}

				return true;
			}

			return false;
		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				33,
				`There was an error while scanning tasks from the file(s): ${files
					.map((f) => f?.path)
					.join("\n")}`,
				error as string,
				"VaultScanner.tsx/refreshTasksFromFiles",
			);
			return false;
		}
	}

	async deleteCacheForFiles(filepaths: string[]) {
		const { Pending, Completed } = this.tasksCache;
		[Pending, Completed].forEach((cache) => {
			if (cache && typeof cache === "object") {
				filepaths.forEach((filePath: string) => {
					if (cache[filePath]) {
						delete cache[filePath];
					}
				});
			}
		});

		this.tasksCache.Pending = Pending;
		this.tasksCache.Completed = Completed;
	}

	/**
	 * Compares two file cache arrays (taskItem[]) to determine if they are identical
	 * @param newCache - The newly scanned cache array for a specific file
	 * @param oldCache - The previous cache array for the same file
	 * @returns Promise<boolean> - Returns true if caches are identical, false if different or if oldCache is undefined
	 * @description This function performs a fast comparison of task arrays using JSON serialization
	 */
	async compareFileCache(
		newCache: taskItem[] | undefined,
		oldCache: taskItem[] | undefined,
	): Promise<boolean> {
		try {
			// Quick null/undefined checks
			if (!oldCache && !newCache) return true;
			// if (!oldCache && newCache?.length === 0) return true;
			if (oldCache && !newCache) return oldCache.length === 0;
			if (newCache && !oldCache) return newCache.length === 0;

			// Quick length check before expensive serialization
			if (newCache && oldCache && newCache.length !== oldCache.length)
				return false;
			if (newCache && newCache.length === 0) return true;

			// Fast JSON string comparison - significantly faster than property-by-property comparison
			// This approach is optimal for most use cases as task arrays are typically small to medium sized
			return JSON.stringify(newCache) === JSON.stringify(oldCache);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				147,
				String(error),
				"VaultScanner.ts/compareFileCache",
			);
			// In case of error, assume they're different to trigger a refresh
			return false;
		}
	}

	// Debounced saveTasksToJsonCache function
	// private saveTasksToJsonCacheDebounced = debounce(
	// 	async (): Promise<boolean> => {
	// 		this.tasksCache.Modified_at = new Date().toISOString();
	// 		const result = await writeJsonCacheDataToDisk(
	// 			this.plugin,
	// 			this.tasksCache
	// 		);
	// 		// this.plugin.saveSettings(); // This was to save the uniqueIdCounter in settings, but moved that to be saved immediately when the ID is generated.
	// 		if (
	// 			this.plugin.settings.data.realTimeScanner &&
	// 			(Object.values(this.tasksCache.Pending).flat().length > 0 ||
	// 				Object.values(this.tasksCache.Completed).flat().length > 0)
	// 		) {
	// 			eventEmitter.emit("SOFT_REFRESH");
	// 			this.tasksDetectedOrUpdated = false;
	// 		}

	// 		return result;
	// 	},
	// 	500
	// );

	// Save tasks to JSON file
	async saveTasksToJsonCache() {
		// if (!this.tasksDetectedOrUpdated) return;

		this.tasksCache.Modified_at = getCurrentLocalDateTimeString();
		const result = await writeJsonCacheDataToDisk(
			this.plugin,
			this.tasksCache,
		);

		window.setTimeout(() => {
			eventEmitter.emit("SOFT_REFRESH");
			// 	if (this.plugin.settings.data.searchQuery) {
			// 		console.log(
			// 			"Refreshing the board now after saving...\nSetting : ",
			// 			this.plugin.settings.data.searchQuery
			// 		);
			// 		eventEmitter.emit("REFRESH_BOARD");
			// 	} else {
			// 		eventEmitter.emit("SOFT_REFRESH");
			// 	}
		}, 100);
		this.tasksDetectedOrUpdated = false;

		return result;

		// const result = this.saveTasksToJsonCacheDebounced();
	}

	/**
	 * Retrieves a task from the TaskBoard plugin's task cache using its ID.
	 * @param plugin - The TaskBoard plugin instance.
	 * @param id - The ID of the task to retrieve. Can be a string (legacyId) or a number (id).
	 * @returns The task item if found, or null if not found.
	 */
	async getTaskFromID(id: string): Promise<taskItem | undefined> {
		try {
			let foundTask: taskItem | undefined;

			// Search in Pending tasks
			const pendingTasksObj = this.tasksCache?.Pending ?? {};
			for (const tasks of Object.values(pendingTasksObj)) {
				if (id) {
					foundTask = tasks.find(
						(task) =>
							task[DEFAULT_TASK_CACHE_KEYS.LegacyID] === id ||
							task[DEFAULT_TASK_CACHE_KEYS.ID] === id,
					);
				}
				if (foundTask) return foundTask;
			}

			// Search in Completed tasks
			const completedTasksObj = this.tasksCache?.Completed ?? {};
			for (const tasks of Object.values(completedTasksObj)) {
				if (id) {
					foundTask = tasks.find(
						(task) =>
							task[DEFAULT_TASK_CACHE_KEYS.LegacyID] === id ||
							task[DEFAULT_TASK_CACHE_KEYS.ID] === id,
					);
				}
				if (foundTask) return foundTask;
			}

			return; // Return undefined if the task is not found
		} catch (error) {
			bugReporterManagerInsatance.showNotice(
				192,
				"Error retrieving task from tasksCache using ID",
				String(error),
				"VaultScanner.ts/getTaskFromId",
			);
			return;
		}
	}
}

/**
 * Checks if the file is allowed for scanning based on its extension and plugin settings.
 * It also checks if the file is not the archived tasks file or inside the archived TB notes folder.
 * Additionally, it excludes .taskboard files from scanning as they are board configuration files.
 * @param globalSettings - The global settings from the plugin
 * @param file - The file to check (TFile or TAbstractFile)
 * @returns boolean - True if the file is allowed for scanning, false otherwise
 */
export function fileTypeAllowedForScanning(
	globalSettings: globalSettingsData,
	file: TFile | TAbstractFile,
): boolean {
	const filePath = file.path.toLocaleLowerCase();
	const isFileInArchivedTaskNotesFolder =
		globalSettings.archivedTBNotesFolderPath.trim() !== "" &&
		filePath.startsWith(
			globalSettings.archivedTBNotesFolderPath.toLowerCase(),
		);

	if (
		file instanceof TFolder ||
		isFileInArchivedTaskNotesFolder ||
		// notAllowedFileExtensionsRegEx.test(file.path) ||
		!allowedFileExtensionsRegEx.test(file.path) ||
		filePath === globalSettings.archivedTasksFilePath.toLowerCase()
	) {
		return false;
	}

	return true;
}
