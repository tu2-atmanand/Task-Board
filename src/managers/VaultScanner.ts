// /src/utils/ScanningVaults.ts

import {
	App,
	Notice,
	TAbstractFile,
	TFile,
	TFolder,
	// moment as _moment,
} from "obsidian";
import {
	extractCheckboxSymbol,
	getObsidianIndentationSetting,
	isTaskCompleted,
	isTaskLine,
} from "../utils/CheckBoxUtils";
import {
	loadJsonCacheDataFromDisk,
	writeJsonCacheDataToDisk,
} from "../utils/JsonFileOperations";
import { jsonCacheData, taskItem, IdInjectionResult } from "src/interfaces/TaskItem";
import {
	extractTaskNoteProperties,
	getCustomFrontmatterKey,
	isTaskNotePresentInFrontmatter,
} from "../utils/taskNote/TaskNoteUtils";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { readDataOfVaultFile } from "../utils/MarkdownFileOperations";
import { globalSettingsData, scanFilters } from "src/interfaces/GlobalSettings";
import {
	TaskRegularExpressions,
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
} from "../regularExpressions/TasksPluginRegularExpr";
import { DATAVIEW_PLUGIN_DEFAULT_SYMBOLS } from "src/regularExpressions/DataviewPluginRegularExpr";
import {
	extractFrontmatterFromFile,
	extractFrontmatterTags,
} from "../utils/taskNote/FrontmatterOperations";
import { t } from "../utils/lang/helper";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { priorityEmojis } from "src/interfaces/Mapping";
import { UniversalDateOptions } from "src/interfaces/Enums";
import {
	scanFilterForFilesNFoldersNFrontmatter,
	scanFilterForTags,
} from "src/utils/algorithms/ScanningFilterer";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";
import { appendTaskIdToContent } from "src/utils/taskLine/TaskIdFormatter";
import { bugReporterManagerInsatance } from "./BugReporter";
import { getCurrentLocalDateTimeString } from "src/utils/DateTimeCalculations";
import { parse } from "date-fns/parse";
import { isValid } from "date-fns";

/**
 * Creates a vault scanner mechanism and holds the latest tasksCache inside RAM.
 * @param app The Obsidian app instance
 * @param plugin The TaskBoard plugin instance
 * @description Initializes the vaultScanner with the app and plugin instances, and sets up the initial tasks cache.
 */
export default class VaultScanner {
	app: App;
	plugin: TaskBoard;
	tasksCache: jsonCacheData;
	tasksDetectedOrUpdated: boolean;
	indentationString: string;
	testDate: Date;
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
		this.testDate = new Date(2026, 1, 18); // Fixed reference date: Feb 18, 2026
		this.supportedChecklistSymbols = [];
		const customStatuses =
			this.plugin.settings.data.globalSettings?.customStatuses ?? [];
		customStatuses.forEach((status) => {
			this.supportedChecklistSymbols.push(status.symbol);
		});
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

	// Extract tasks from a specific file
	async extractTasksFromFile(
		file: TFile,
		scanFilters: scanFilters,
	): Promise<string> {
		try {
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
					this.plugin.settings.data.globalSettings
						.taskNoteIdentifierTag,
					frontmatter,
				)
			) {
				// Extract properties from frontmatter
				const taskNoteProperties = extractTaskNoteProperties(
					frontmatter,
					this.plugin.settings,
				);
				if (
					scanFilterForTags(
						taskNoteProperties?.tags || [],
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
					const taskNoteItem: taskItem = {
						id: taskNoteProperties?.id
							? taskNoteProperties.id
							: generateRandomTempTaskId(),
						legacyId: taskNoteProperties?.id
							? taskNoteProperties.id
							: "", // Storing the legacyId for backward compatibility
						title: taskNoteProperties?.title || file.basename,
						body: subTasks, // Store sub-tasks in body
						createdDate: taskNoteProperties?.createdDate || "",
						startDate: taskNoteProperties?.startDate || "",
						scheduledDate: taskNoteProperties?.scheduledDate || "",
						due: taskNoteProperties?.due || "",
						tags: taskNoteProperties?.tags || [],
						frontmatterTags: [],
						time: taskNoteProperties?.time || "",
						priority: taskNoteProperties?.priority || 0,
						dependsOn: taskNoteProperties?.dependsOn || [],
						status: taskNoteProperties?.status || " ", // Default to unchecked
						filePath: fileNameWithPath,
						taskLocation: {
							startLine: 1,
							startCharIndex: 0,
							endLine: lines.length,
							endCharIndex: lines[lines.length - 1]?.length || 0,
						},
						completion: taskNoteProperties?.completion || "",
						cancelledDate: taskNoteProperties?.cancelledDate || "",
						reminder: taskNoteProperties?.reminder || "",
					};

					// Add to appropriate cache based on completion status
					const isTaskNoteCompleted = isTaskCompleted(
						taskNoteProperties.status || "",
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

					const pendingCacheCompare = await compareFileCache(
						this.tasksCache.Pending[fileNameWithPath],
						oldPendingFileCache,
					);
					const completedCacheCompare = await compareFileCache(
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

						// Since v1.10.0 - Read this ticket : https://github.com/tu2-atmanand/Task-Board/issues/737
						if (
							!this.supportedChecklistSymbols.includes(taskStatus)
						) {
							const bodyLines = extractBody(
								lines,
								lineIndex + 1,
								this.indentationString,
							);
							lineIndex = lineIndex + bodyLines.length;
							continue; // We will going to skip storing this task inside the cache.
						}

						const tags = extractTags(line);
						if (scanFilterForTags(tags, scanFilters)) {
							this.tasksDetectedOrUpdated = true;
							const legacyId = extractTaskId(line);
							const isThisCompletedTask = isTaskCompleted(
								line,
								false,
								this.plugin.settings,
							);
							const title = line.trimEnd(); // we will be storing the taskLine as it is inside the title property
							const time = extractTime(line);
							const createdDate =
								extractCreatedDate(line)?.[1] ?? "";
							let startDate: RegExpMatchArray | null | string =
								extractStartDate(line)?.[1] ?? "";
							let scheduledDate:
								| RegExpMatchArray
								| null
								| string =
								extractScheduledDate(line)?.[1] ?? "";
							let dueDate: RegExpMatchArray | null | string =
								extractDueDate(line)?.[1] ?? "";
							const priority = extractPriority(line);
							const dependsOn = extractDependsOn(line);
							const reminder = extractReminder(
								line,
								startDate ? startDate[1] : "",
								scheduledDate ? scheduledDate[1] : "",
								dueDate ? dueDate[1] : "",
							);
							const completionDate =
								extractCompletionDate(line)?.[1] ?? "";
							const cancelledDate =
								extractCancelledDate(line)?.[1] ?? "";
							const bodyLines = extractBody(
								lines,
								lineIndex + 1,
								this.indentationString,
							);

							if (
								this.plugin.settings.data.globalSettings
									.dailyNotesPluginComp
							) {
								const universalDateFormat =
									this.plugin.settings.data.globalSettings
										.dateFormat;
								const basename = file.basename;

								// Check if the basename matches the date format
								const parsed = parse(
									basename,
									universalDateFormat,
									this.testDate,
								);
								if (isValid(parsed)) {
									const universalDateConfig =
										this.plugin.settings.data.globalSettings
											.universalDate;

									if (
										universalDateConfig ===
											UniversalDateOptions.dueDate &&
										!dueDate
									) {
										dueDate = basename; // If the basename matches the dueFormat, assign it to due
									} else if (
										universalDateConfig ===
											UniversalDateOptions.startDate &&
										!startDate
									) {
										startDate = basename; // If the basename matches the dueFormat, assign it to startDate
									} else if (
										universalDateConfig ===
											UniversalDateOptions.scheduledDate &&
										!scheduledDate
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
								id: legacyId
									? (legacyId[1] ?? "")
									: generateRandomTempTaskId(),
								legacyId: legacyId ? legacyId[1] : "", // Storing the legacyId for backward compatibility
								status: taskStatus,
								title: title,
								body: bodyLines,
								time: time ? time[1] : "",
								createdDate: createdDate ? createdDate : "",
								startDate: startDate ? startDate : "",
								scheduledDate: scheduledDate
									? scheduledDate
									: "",
								due: dueDate ? dueDate : "",
								tags: tags,
								frontmatterTags: frontmatterTags,
								priority: priority.value,
								dependsOn: dependsOn
									? dependsOn[1]
											.split(",")
											.map((id) => id.trim())
									: [],
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
								completion: completionDate
									? completionDate
									: "",
								cancelledDate: cancelledDate
									? cancelledDate
									: "",
								reminder: reminder.value,
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

				const pendingCacheCompare = await compareFileCache(
					this.tasksCache.Pending[fileNameWithPath],
					oldPendingFileCache,
				);
				const completedCacheCompare = await compareFileCache(
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

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async refreshTasksFromFiles(
		files: (TFile | null)[],
		showNotice: boolean,
		addMissingIds: boolean = false,
	): Promise<boolean> {
		if (!files || files.length === 0) {
			return false;
		}

		try {
			const scanFilters =
				this.plugin.settings.data.globalSettings.scanFilters;
			let isFileScanned: string = "";
			const scannedFilePaths: string[] = [];
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
					scannedFilePaths.push(file.path);
				} else {
					if (showNotice) {
						new Notice(t("not-valid-file-type-for-scanning"), 5000);
					}
				}
			}

			if (addMissingIds && scannedFilePaths.length > 0) {
				const idResult = await this.addMissingIdsToTasks(
					this.getTasksForFilePaths(scannedFilePaths),
				);
				if (
					idResult.tasksUpdated > 0 ||
					idResult.filesFailed.length > 0
				) {
					if (idResult.tasksUpdated > 0) {
						// The re-scan below compares against the already updated
						// objects, so force the cache to be persisted.
						this.tasksDetectedOrUpdated = true;
					}
					new Notice(
						`${t("scan-tasks-ids-added")} : ${idResult.tasksUpdated}\n${t("scan-files-updated")} : ${idResult.filesUpdated.length}\n${t("scan-files-failed")} : ${idResult.filesFailed.length}`,
						8000,
					);
				}
			}

			let result = false;
			if (isFileScanned === "true") {
				if (showNotice) {
					new Notice(t("tasks-refreshed-successfully"));
				}

				if (this.tasksDetectedOrUpdated) {
					result = await this.saveTasksToJsonCache();
				}

				return result;
			} else {
				// throw new Error(
				// 	`extractTasksFromFile returned following error : ${isFileScanned}`
				// );

				return result;
			}
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

	/**
	 * Collects the cached tasks that belong to the given file paths.
	 */
	getTasksForFilePaths(filePaths: string[]): taskItem[] {
		const tasks: taskItem[] = [];
		filePaths.forEach((filePath) => {
			if (this.tasksCache.Pending[filePath]) {
				tasks.push(...this.tasksCache.Pending[filePath]);
			}
			if (this.tasksCache.Completed[filePath]) {
				tasks.push(...this.tasksCache.Completed[filePath]);
			}
		});
		return tasks;
	}

	/**
	 * Recalculates the unique ID counter from the currently cached tasks.
	 * The counter is never lowered, so IDs which were already issued (even to
	 * files that are excluded by the scan filters) are never reused.
	 */
	async calibrateUniqueIdCounter(): Promise<void> {
		let maxId = 0;
		[this.tasksCache.Pending, this.tasksCache.Completed].forEach((cache) => {
			Object.values(cache).forEach((tasks) => {
				tasks.forEach((task) => {
					const parsedId = task.legacyId
						? parseInt(String(task.legacyId), 10)
						: NaN;
					if (!isNaN(parsedId) && parsedId > maxId) {
						maxId = parsedId;
					}
				});
			});
		});

		const globalSettings = this.plugin.settings.data.globalSettings;
		const currentCounter = Number(globalSettings.uniqueIdCounter) || 0;
		const nextCounter = Math.max(currentCounter, maxId + 1);
		if (nextCounter !== currentCounter) {
			globalSettings.uniqueIdCounter = nextCounter;
			await this.plugin.saveSettings();
		}
	}

	/**
	 * Reserves the next `count` IDs and persists the counter once. Mirrors the
	 * semantics of `generateTaskId` (increment first, then return), without
	 * persisting the settings on every single ID.
	 */
	private async allocateTaskIds(count: number): Promise<string[]> {
		const globalSettings = this.plugin.settings.data.globalSettings;
		const start = Number(globalSettings.uniqueIdCounter) || 0;
		const allocatedIds: string[] = [];
		for (let offset = 1; offset <= count; offset++) {
			allocatedIds.push(String(start + offset));
		}
		globalSettings.uniqueIdCounter = start + count;
		// Persist right away so an interrupted run never reuses the reserved range.
		await this.plugin.saveSettings();
		return allocatedIds;
	}

	/**
	 * Writes a unique ID to every given task which does not have one yet.
	 * Inline tasks are rewritten file by file (single read/single write), while
	 * task notes only get the ID key in their frontmatter.
	 * Callers stay responsible for persisting the task cache.
	 */
	async addMissingIdsToTasks(tasks: taskItem[]): Promise<IdInjectionResult> {
		const result: IdInjectionResult = {
			tasksUpdated: 0,
			filesUpdated: [],
			filesFailed: [],
		};

		const globalSettings = this.plugin.settings.data.globalSettings;
		if (
			globalSettings.autoAddUniqueID !== true ||
			globalSettings.addIdDuringScan !== true
		) {
			return result;
		}
		if (!tasks || tasks.length === 0 || this.plugin.isAddingTaskIds) {
			return result;
		}

		// De-duplicate and keep only tasks which do not have an ID yet.
		const uniqueTasks = new Map<string, taskItem>();
		tasks.forEach((task) => {
			if (!task?.filePath) return;
			if (task.legacyId && String(task.legacyId).trim() !== "") return;
			const key = `${task.filePath}:${task.taskLocation?.startLine ?? -1}`;
			if (!uniqueTasks.has(key)) {
				uniqueTasks.set(key, task);
			}
		});
		if (uniqueTasks.size === 0) {
			return result;
		}

		this.plugin.isAddingTaskIds = true;
		const taskNoteFiles = new Set<string>();
		try {
			await this.calibrateUniqueIdCounter();

			const tasksByFile = new Map<string, taskItem[]>();
			uniqueTasks.forEach((task) => {
				const fileTasks = tasksByFile.get(task.filePath) ?? [];
				fileTasks.push(task);
				tasksByFile.set(task.filePath, fileTasks);
			});

			const allocatedIds = await this.allocateTaskIds(
				uniqueTasks.size,
			);
			let idCursor = 0;

			for (const [filePath, fileTasks] of tasksByFile) {
				const fileIds = allocatedIds.slice(
					idCursor,
					idCursor + fileTasks.length,
				);
				idCursor += fileTasks.length;

				const file = this.plugin.app.vault.getFileByPath(filePath);
				if (!file) {
					bugReporterManagerInsatance.addToLogs(
						166,
						`File not found while adding missing task IDs: ${filePath}`,
						"VaultScanner.ts/addMissingIdsToTasks",
					);
					result.filesFailed.push(filePath);
					continue;
				}

				let updated = 0;
				let failed = 0;
				try {
					const frontmatter =
						this.plugin.app.metadataCache.getFileCache(file)
							?.frontmatter;
					if (
						isTaskNotePresentInFrontmatter(
							globalSettings.taskNoteIdentifierTag,
							frontmatter,
						)
					) {
						taskNoteFiles.add(filePath);
						const applied = await this.addIdToTaskNoteFile(
							file,
							fileTasks[0],
							fileIds[0],
						);
						updated = applied ? 1 : 0;
						failed = applied ? 0 : 1;
					} else {
						const attempt = await this.addIdsToInlineTasks(
							file,
							fileTasks,
							fileIds,
						);
						updated = attempt.updated;
						failed = attempt.failed;
					}
				} catch (error) {
					bugReporterManagerInsatance.addToLogs(
						166,
						`Failed to add missing task IDs in ${filePath}. ERROR : ${String(error)}`,
						"VaultScanner.ts/addMissingIdsToTasks",
					);
					failed = fileTasks.length;
				}

				if (updated > 0) {
					result.tasksUpdated += updated;
					result.filesUpdated.push(filePath);
				}
				if (failed > 0) {
					result.filesFailed.push(filePath);
				}
			}
		} finally {
			this.plugin.isAddingTaskIds = false;
		}

		// Rebuild the cache entries of the rewritten files so the cache and the
		// files never disagree about the IDs. Task notes are skipped on purpose:
		// their cache objects were already updated above and the metadata cache
		// may not reflect the freshly written frontmatter yet.
		const scanFilters = globalSettings.scanFilters;
		for (const filePath of result.filesUpdated) {
			if (taskNoteFiles.has(filePath)) continue;
			const file = this.plugin.app.vault.getFileByPath(filePath);
			if (file) {
				await this.extractTasksFromFile(file, scanFilters);
			}
		}

		return result;
	}

	/**
	 * Adds the ID key to the frontmatter of a task note, leaving every other
	 * frontmatter property untouched.
	 */
	private async addIdToTaskNoteFile(
		file: TFile,
		task: taskItem,
		id: string,
	): Promise<boolean> {
		const frontmatterFormatting =
			this.plugin.settings.data.globalSettings.frontmatterFormatting;
		const idKey = getCustomFrontmatterKey("id", frontmatterFormatting);
		const existingFrontmatter =
			this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (this.hasFrontmatterId(existingFrontmatter, idKey)) {
			return false;
		}

		let applied = false;
		await this.plugin.app.fileManager.processFrontMatter(
			file,
			(frontmatter) => {
				if (this.hasFrontmatterId(frontmatter, idKey)) {
					return;
				}
				frontmatter[idKey] = id;
				applied = true;
			},
		);

		if (applied) {
			task.id = id;
			task.legacyId = id;
		}
		return applied;
	}

	private hasFrontmatterId(
		frontmatter: Record<string, unknown> | undefined,
		idKey: string,
	): boolean {
		const value = frontmatter?.[idKey];
		return (
			value !== undefined &&
			value !== null &&
			String(value).trim() !== ""
		);
	}

	/**
	 * Returns the lines that can receive an ID, validating the task location
	 * against the latest file content (the scan may be a few moments old).
	 */
	private getInlineIdUpdateCandidates(
		lines: string[],
		tasks: taskItem[],
		ids: string[],
		format: string,
	): { lineIndex: number; taskIndex: number; newLine: string }[] {
		const candidates: {
			lineIndex: number;
			taskIndex: number;
			newLine: string;
		}[] = [];

		tasks.forEach((task, taskIndex) => {
			const lineIndex = (task.taskLocation?.startLine ?? 0) - 1;
			const line = lines[lineIndex];
			if (line === undefined) return;
			if (!isTaskLine(line) || extractTaskId(line)) return;

			// Guard against a stale task location: the first characters of the
			// title are stored inside the raw task line during scanning.
			const titlePrefix = task.title.trim().substring(0, 5);
			if (titlePrefix && !line.trim().startsWith(titlePrefix)) return;

			candidates.push({
				lineIndex,
				taskIndex,
				newLine: appendTaskIdToContent(line, ids[taskIndex], format),
			});
		});

		return candidates;
	}

	/**
	 * Writes IDs into inline tasks of a single file with one read and one write.
	 * The line count never changes, so the task locations remain valid.
	 */
	private async addIdsToInlineTasks(
		file: TFile,
		tasks: taskItem[],
		ids: string[],
	): Promise<{ updated: number; failed: number }> {
		const format =
			this.plugin.settings.data.globalSettings.taskPropertyFormat;

		// Cheap pre-check so a file whose tasks have gone stale is not rewritten.
		// The scan just read this file, so the cached content is warm; the
		// `process` callback below re-validates against the latest content.
		const currentContent = await this.plugin.app.vault.cachedRead(file);
		const previewCandidates = this.getInlineIdUpdateCandidates(
			currentContent.split("\n"),
			tasks,
			ids,
			format,
		);
		if (previewCandidates.length === 0) {
			return { updated: 0, failed: tasks.length };
		}

		const appliedTaskIndexes: number[] = [];
		await this.plugin.app.vault.process(file, (data) => {
			appliedTaskIndexes.length = 0;
			const lines = data.split("\n");
			const candidates = this.getInlineIdUpdateCandidates(
				lines,
				tasks,
				ids,
				format,
			);

			candidates.forEach(({ lineIndex, taskIndex, newLine }) => {
				lines[lineIndex] = newLine;
				appliedTaskIndexes.push(taskIndex);
			});

			return appliedTaskIndexes.length > 0 ? lines.join("\n") : data;
		});

		// Only touch the cache once the file has actually been written.
		appliedTaskIndexes.forEach((taskIndex) => {
			tasks[taskIndex].id = ids[taskIndex];
			tasks[taskIndex].legacyId = ids[taskIndex];
		});

		return {
			updated: appliedTaskIndexes.length,
			failed: tasks.length - appliedTaskIndexes.length,
		};
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
	// 			eventEmitter.emit("REFRESH_COLUMN");
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

		setTimeout(() => {
			eventEmitter.emit("REFRESH_COLUMN");
			// 	if (this.plugin.settings.data.searchQuery) {
			// 		console.log(
			// 			"Refreshing the board now after saving...\nSetting : ",
			// 			this.plugin.settings.data.searchQuery
			// 		);
			// 		eventEmitter.emit("REFRESH_BOARD");
			// 	} else {
			// 		eventEmitter.emit("REFRESH_COLUMN");
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
						(task) => task.legacyId === id || task.id === id,
					);
				}
				if (foundTask) return foundTask;
			}

			// Search in Completed tasks
			const completedTasksObj = this.tasksCache?.Completed ?? {};
			for (const tasks of Object.values(completedTasksObj)) {
				if (id) {
					foundTask = tasks.find(
						(task) => task.legacyId === id || task.id === id,
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

/**
 * Function to build a task from raw content
 * @param rawTaskContent - The raw content of the task ONLY.
 * @param filePath - Optional file path where the task is located
 * @returns A partial taskItem object with extracted properties
 */
export function buildTaskFromRawContent(
	rawTaskContent: string,
	indentationString: string,
	filePath?: string,
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
		status: taskStatus ?? " ",
		body: body,
		time: time?.[1] ?? "",
		createdDate: createdDate?.[1] ?? "",
		startDate: startDate?.[1] ?? "",
		scheduledDate: scheduledDate?.[1] ?? "",
		due: due?.[1] ?? "",
		tags: tags,
		priority: priority.value,
		completion: completionDate?.[1] ?? "",
		cancelledDate: cancelledDate?.[1] ?? "",
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

/**
 * Extracts the title from a task string by removing the time at the start (if exists).
 * @param {string} text - The task string.
 * @returns {string} The title of the task.
 */
export function extractTitle(text: string): string {
	return text.replace(/^- \[.\]\s*/, "");
}

/**
 * Extracts the task id from a task string by matching the id regex.
 * Supports both Task's plugin and Dataview plugin id formats.
 * @param {string} text - The task string.
 * @returns {RegExpMatchArray} A regular expression array, where [0] is the extracted string and [1] is the value of the id.
 */
export function extractTaskId(text: string): RegExpMatchArray | null {
	// const combinedIdRegex = new RegExp(
	// 	`(?:${TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex.source})|(?:${DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex.source})`,
	// 	"g" // add the 'g' flag if you want to match all occurrences
	// );
	// let idMatch = text.match(combinedIdRegex);
	// console.log("ID match while scanning :", idMatch);
	// if (idMatch && idMatch[1]) {
	// 	return idMatch;
	// }

	let idMatch = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex,
	);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	idMatch = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex,
	);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	idMatch = text.match(/\@id\(\s*(.*?)\)/);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	return null;
}

/**
 * Extracts the body of a task from an array of lines. The body is considered as the lines
 * that have indentation (either with '>' or '\t'), and the extraction stops when an empty line is encountered.
 * @param {string[]} lines - The array of lines to extract the body from.
 * @param {number} startLineIndex - The index of the line where the body starts.
 * @param {string} indentationString - The string used to indent the lines.
 * @returns {string[]} An array of strings representing the body of the task. If the body is empty, an empty array is returned.
 */
export function extractBody(
	lines: string[],
	startLineIndex: number,
	indentationString: string,
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
			break;
		}
	}

	return bodyLines.at(0)?.trim() === "" ? [] : bodyLines;
}

/**
 * Extracts the time from a task string.
 * Supports three formats: [time:: 12:00-13:00], @time(12:00-13:00) and ⏰ 12:00-13:00.
 * If time is at the start of the task, it is also extracted.
 * @param {string} text - The task string.
 * @returns {string} The extracted time string, or an empty string if no match.
 */
export function extractTime(text: string): RegExpMatchArray | null {
	let match = text.match(/\[time::\s*(.*?)\]/);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.durationRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@time\((.*?)\)/);
	if (match && match[1]) {
		return match;
	}

	// Check if time is at the start of the task
	const timeAtStartMatch = text
		.trim()
		.match(/^- \[.\]\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);

	if (timeAtStartMatch && timeAtStartMatch[1]) {
		// If time is at the start, extract it
		return timeAtStartMatch;
	}

	return null;
}

// Extract Created date from task title
export function extractCreatedDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.createdDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.createdDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@created\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Start date from task title
export function extractStartDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.startDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.startDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@start\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Scheduled date from task title
export function extractScheduledDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.scheduledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
			.scheduledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@scheduled\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Due date from task title
export function extractDueDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.dueDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.dueDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@due\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract priority from task title using RegEx
export function extractPriority(text: string): {
	parsedString: string;
	value: number;
} {
	// Execute the regex to find all priority emoji matches
	const matches =
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.priorityRegex,
		) || [];

	// Filter out any empty or incorrect values
	const validMatches = matches
		.map((match) => match.trim()) // Trim spaces
		.filter((match) => match.length > 0 && match !== "0"); // Remove empty or zero values

	// Find the first match in the priorityEmojis mapping
	for (const emoji of validMatches) {
		const priorityMatch = Object.entries(priorityEmojis).find(
			([, value]) => value === emoji,
		);
		if (priorityMatch) {
			return { parsedString: emoji, value: parseInt(priorityMatch[0]) }; // Return the first matching priority
		}
	}

	let match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.priorityRegex,
	);
	if (match) {
		return { parsedString: match[0], value: parseInt(match[1].trim()) };
	}

	match = text.match(/@priority\(\s*(\d{1,2})\s*\)/);
	if (match) {
		return { parsedString: match[0], value: parseInt(match[1].trim()) };
	}

	// Default priority if no emoji is found
	return { parsedString: "", value: 0 };
}

// Extract tags from task title
export function extractTags(text: string): string[] {
	text = text.replace(/<(mark|font).*?>/g, ""); // TODO : this might not required, try removing this.
	const matches = text.match(TaskRegularExpressions.hashTagsRegex);
	return matches ? matches.map((tag) => tag.trim()) : [];
}

export function extractReminder(
	text: string,
	startDate?: string,
	scheduledDate?: string,
	dueDate?: string,
): {
	parsedString: string;
	value: string;
} {
	let match = text.match(/\[reminder::\s*(.*?)\]/);
	if (match) {
		return { parsedString: match[0], value: match[1].trim() };
	}

	match = text.match(/@reminder\(\s*(.*?)\s*\)/);
	if (match) {
		return { parsedString: match[0], value: match[1].trim() };
	}

	// This will be enabled, after Tasks plugin will support the reminder property.
	// match = text.match(/🔔\s*(.*?)(?=\s|$)/);
	// if (match) {
	// 	return match[0].replace("🔔", "").trim();
	// }

	// New patterns
	// match = text.match(/\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/);
	// if (match) {
	// 	const dateStr = match[1];
	// 	if (dateStr.includes(" ")) {
	// 		const [date, time] = dateStr.split(" ");
	// 		return `${date}T${time}`;
	// 	} else {
	// 		return `${dateStr}T09:00`;
	// 	}
	// }

	match = text.match(/\(\@(\d{2}:\d{2})\)/);
	if (match) {
		const baseDate = startDate || scheduledDate || dueDate;
		if (baseDate) {
			return { parsedString: match[0], value: `${baseDate}T${match[1]}` };
		}
	}

	return { parsedString: "", value: "" };
}

/**
 * Extract the dependsOn value from the task title.
 * It will first try to match the regex defined in the Tasks plugin.
 * If not found, it will try to match the [dependsOn:: ...] format.
 * If not found, it will try to match the @dependsOn ... format.
 * If none of the above are found, it will return null.
 * @param {string} text - The task title from which to extract the dependsOn value.
 * @returns {RegExpMatchArray | null} - The extracted dependsOn value, or null if not found.
 */
export function extractDependsOn(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.dependsOnRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\[dependsOn::\s*(.*?)\]/);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@dependsOn\(\s*(.*?)\s*\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract completion date-time value
export function extractCompletionDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.doneDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.doneDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@completion\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

export function extractCancelledDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.cancelledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
			.cancelledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\@cancelled\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

/**
 * Compares two file cache arrays (taskItem[]) to determine if they are identical
 * @param newCache - The newly scanned cache array for a specific file
 * @param oldCache - The previous cache array for the same file
 * @returns Promise<boolean> - Returns true if caches are identical, false if different or if oldCache is undefined
 * @description This function performs a fast comparison of task arrays using JSON serialization
 */
export async function compareFileCache(
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
