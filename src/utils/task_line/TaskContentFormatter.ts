// /src/utils/TaskContentFormatter.ts

import TaskBoard from "../../../main.js";
import {
	taskPropertyFormatOptions,
	statusTypeNames,
	NotificationService,
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
} from "../../interfaces/Enums.js";
import {
	getPropertiesHiddenInNotes,
	globalSettingsData,
	type SupportedPropertiesConfig,
} from "../../interfaces/GlobalSettings.js";
import { priorityEmojis } from "../../interfaces/Mapping.js";
import {
	cursorLocationInterface,
	taskItem,
} from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import {
	TaskRegularExpressions,
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
} from "../regular_expressions/TasksPluginRegularExpr.js";
import { isTaskLine } from "../CheckBoxUtils.js";
import {
	getCurrentLocalDateTimeString,
	formatDateStringAsPerSettings,
	formatDateTimeAsPerSettings,
} from "../DateTimeCalculations.js";
import { generateTaskId } from "../TaskItemUtils.js";
import {
	extractTaskId,
	extractPriority,
	escapeRegExp,
	getTaskProperty,
} from "./PropertiesParsing.js";

/**
 * Matches titles that contain nothing but a time (optionally a time range),
 * e.g. "09:54" or "09:54 - 10:30". Such titles are common in journal/daily notes
 * where the actual task text lives in the indented body lines.
 */
const timeOnlyTitleRegex = /^\d{1,2}:\d{2}(\s*[-–~]\s*\d{1,2}:\d{2})?$/;

/**
 * Checks whether the task title carries no text besides a time.
 * @param task - The task item to check.
 * @returns True when the cleaned title is empty or only a time.
 */
export const isTaskTitleWithoutText = (
	task: taskItem,
	usePipeSymboltoSeparate: boolean,
	globalSettings: globalSettingsData,
): boolean => {
	const title = cleanTaskTitleLegacy(
		task,
		usePipeSymboltoSeparate,
		globalSettings,
	).trim();
	return title === "" || timeOnlyTitleRegex.test(title);
};

/**
 * Use this function for rendering only. It temporarily hides the properties
 * in the plugin UI which user has configured to be hidden inside the notes.
 *
 * @note - This function has not been used from a long time and hence the code
 * inside this is little old. Need to update it before usage.
 *
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The task item to clean.
 * @returns The cleaned task title without metadata.
 */
export const cleanTaskTitleSelectively = (
	globalSetting: globalSettingsData,
	task: taskItem,
): string => {
	// Get the list of properties to hide
	const hiddenProperties = getPropertiesHiddenInNotes(
		globalSetting.taskProperties,
	);

	// If no properties are configured to hide and the legacy setting is false, return original title
	if (
		hiddenProperties.length === 0 &&
		!globalSetting.showTaskWithoutMetadata
	) {
		return task[DEFAULT_TASK_CACHE_KEYS.Title];
	}

	let cleanedTitle = task[DEFAULT_TASK_CACHE_KEYS.Title];

	// Remove the initial indentation and checkbox markdown
	cleanedTitle = cleanedTitle
		.replace(
			new RegExp(TaskRegularExpressions.indentationAndCheckboxRegex, "u"),
			"",
		)
		.trim();

	// // If legacy showTaskWithoutMetadata is enabled, hide all properties (backward compatibility)
	// if (plugin.settings.data.showTaskWithoutMetadata) {
	// 	return cleanTaskTitleLegacy(task);
	// }

	// Hide only selected properties
	hiddenProperties.forEach((property) => {
		switch (property) {
			case DEFAULT_TASK_CACHE_KEYS.Tags:
				// Remove tags
				(task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? []).forEach((tag) => {
					const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
					const tagsMatch = cleanedTitle.match(tagRegex);
					if (tagsMatch) {
						cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
					}
				});
				break;

			case DEFAULT_TASK_CACHE_KEYS.Time:
				// Remove time (handles both formats)
				if (task[DEFAULT_TASK_CACHE_KEYS.Time]) {
					const timeRegex =
						/\s*(⏰\s*\[\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\]|\b\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\b|⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})|\[time::.*?\]|@time\(.*?\))/g;
					const timeMatch = cleanedTitle.match(timeRegex);
					if (timeMatch) {
						cleanedTitle = cleanedTitle.replace(timeMatch[0], "");
					}
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.DueDate:
				// Remove due date in various formats
				if (task[DEFAULT_TASK_CACHE_KEYS.DueDate]) {
					const dueDateRegex =
						/\s*(📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::.*?\]|@due\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(dueDateRegex, "");
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.CreatedDate:
				// Remove Created date in various formats
				if (task[DEFAULT_TASK_CACHE_KEYS.CreatedDate]) {
					const createdDateRegex =
						/\s*(➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[created::.*?\]|@created\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(createdDateRegex, "");
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.StartDate:
				// Remove start date in various formats
				if (task[DEFAULT_TASK_CACHE_KEYS.StartDate]) {
					const startDateRegex =
						/\s*(🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[start::.*?\]|@start\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(startDateRegex, "");
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.ScheduledDate:
				// Remove scheduled date in various formats
				if (task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate]) {
					const scheduledDateRegex =
						/\s*(⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[scheduled::.*?\]|@scheduled\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(scheduledDateRegex, "");
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.CompletionDate:
				// Remove completion date in various formats
				if (task[DEFAULT_TASK_CACHE_KEYS.CompletionDate]) {
					const completionRegex =
						/\s*(✅\s*.*?(?=\s|$)|\[completion::.*?\]|@completion\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(completionRegex, "");
				}
				break;

			case DEFAULT_TASK_CACHE_KEYS.Priority:
				// Remove priority in various formats
				if ((task[DEFAULT_TASK_CACHE_KEYS.Priority] ?? 0) > 0) {
					let match = cleanedTitle.match(
						/\[priority::\s*(\d{1,2})\]/,
					);
					if (match) {
						cleanedTitle = cleanedTitle.replace(match[0], "");
					}

					match = cleanedTitle.match(/@priority\(\s*(\d{1,2})\s*\)/);
					if (match) {
						cleanedTitle = cleanedTitle.replace(match[0], "");
					}

					const priorityIcon =
						priorityEmojis[
							task[DEFAULT_TASK_CACHE_KEYS.Priority] ?? 0
						];

					if (priorityIcon) {
						// Create a regex pattern to match any priority emoji in text
						const priorityRegex = new RegExp(
							`(${Object.values(priorityEmojis)
								.map((emoji) => `\\s*${emoji}\\s*`)
								.join("|")})`,
							"g",
						);

						// Replace the first valid priority emoji found
						cleanedTitle = cleanedTitle.replace(
							priorityRegex,
							(match) => {
								return match.trim() === priorityIcon
									? " "
									: match;
							},
						);
					}
				}
				break;
		}
	});

	// Remove reminder if it's in the hidden properties list
	if (
		hiddenProperties.includes(DEFAULT_TASK_CACHE_KEYS.Dependencies) ||
		globalSetting.showTaskWithoutMetadata
	) {
		const reminderRegex =
			/\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/;
		const reminderMatch = cleanedTitle.match(reminderRegex);
		if (reminderMatch) {
			cleanedTitle = cleanedTitle.replace(reminderMatch[0], "").trim();
		}
	}

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};

/**
 * Use this function for rendering only. It temporarily hides all the properties in
 * the plugin UI which user has configured inside the setting and if its present inside the task.title.
 *
 * To improve the rendering performance a new setting has been introduced to hide all the content after
 * pipe symbol(|) which user will use to separate the properties from the main task title.
 *
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The task item to clean.
 * @returns The cleaned task title without metadata.
 *
 * @todo Improve the performance of this function as its called at extermely high rate.
 */
export const cleanTaskTitleLegacy = (
	task: taskItem,
	usePipeSymboltoSeparate: boolean = false,
	globalSettings: globalSettingsData,
): string => {
	let cleanedTitle = task[DEFAULT_TASK_CACHE_KEYS.Title];

	// Remove the indentation and the status checkbox
	cleanedTitle = cleanedTitle
		.replace(
			new RegExp(TaskRegularExpressions.indentationAndCheckboxRegex, "u"),
			"",
		)
		.trim();

	// A new feature for better performance.
	if (usePipeSymboltoSeparate && cleanedTitle.contains(" | ")) {
		return cleanedTitle.slice(0, cleanedTitle.indexOf(" | ")).trim();
	}

	// First remove all the user configured properties.
	// Rest of the special default properties are handled below.
	if (globalSettings) {
		// Remove time property
		cleanedTitle = removeTimeProperty(
			cleanedTitle,
			globalSettings.taskProperties,
		);

		for (const property of globalSettings.taskProperties) {
			if (
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Title) ||
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Body) ||
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Status) ||
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Tags) ||
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.FilePath) ||
				isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Time)
			) {
				continue;
			}

			const match = findTaskPropertyMatch(cleanedTitle, property);
			if (match) {
				cleanedTitle = removeTaskPropertyMatch(cleanedTitle, match);
			}
		}
	}

	// Remove tags
	(task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? []).forEach((tag) => {
		const tagRegex = new RegExp(`\\s*#${tag}\\s*`, "g");
		const tagsMatch = cleanedTitle.match(tagRegex);
		if (tagsMatch) {
			cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
		}
	});

	// Remove Priority emoji format
	if ((task[DEFAULT_TASK_CACHE_KEYS.Priority] ?? 0) > 0) {
		const legacyPriority = extractPriority(cleanedTitle);
		if (legacyPriority.parsedString) {
			cleanedTitle = cleanedTitle.replace(
				legacyPriority.parsedString,
				"",
			);
		}
	}

	// A special format of reminder property from compatible notification apps.
	// TODO : Remove this once Task Board supports the notification feature.
	const reminderMatch = cleanedTitle.match(
		/\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/,
	);
	if (reminderMatch) {
		cleanedTitle = cleanedTitle.replace(reminderMatch[0], "").trim();
	}

	// These properties are not supported by Task Board, hence cannot remove
	// them from the title.
	// cleanedTitle = cleanedTitle
	// 	.replace(
	// 		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
	// 			.recurrenceRegex,
	// 		"",
	// 	)
	// 	.trim();
	// cleanedTitle = cleanedTitle
	// 	.replace(
	// 		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
	// 			.onCompletionRegex,
	// 		"",
	// 	)
	// 	.trim();

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};

/**
 * Removes the common leading indentation shared by all non-blank lines of a task body.
 * Task bodies are stored exactly as they appear in the note, i.e. indented one level
 * deeper than the task line. Rendering them as standalone markdown without dedenting
 * turns tab/4-space indented paragraphs into code blocks.
 * @param bodyLines - The raw body lines of a task.
 * @returns The body lines with the shared indentation prefix removed.
 */
export const dedentTaskBodyLines = (bodyLines: string[]): string[] => {
	const nonBlankLines = bodyLines.filter((line) => line.trim() !== "");
	if (nonBlankLines.length === 0) return bodyLines;

	let commonIndent = nonBlankLines[0].match(/^[\t ]*/)?.[0] ?? "";
	for (const line of nonBlankLines.slice(1)) {
		const lineIndent = line.match(/^[\t ]*/)?.[0] ?? "";
		let commonLength = 0;
		while (
			commonLength < commonIndent.length &&
			commonLength < lineIndent.length &&
			commonIndent[commonLength] === lineIndent[commonLength]
		) {
			commonLength++;
		}
		commonIndent = commonIndent.slice(0, commonLength);
		if (commonIndent === "") break;
	}

	if (commonIndent === "") return bodyLines;

	return bodyLines.map((line) =>
		line.startsWith(commonIndent) ? line.slice(commonIndent.length) : line,
	);
};

/**
 * Add a unique ID to the task content if it doesn't already have one.
 * This function will check if the task content already has an ID. If it does,
 * it will return the same formatted task content.
 * If it doesn't, it will generate a new ID and add it to the task content
 * based on the task format user has configured and return the new formatted task content.
 *
 * @param Plugin - The Taskboard plugin instance.
 * @param formattedTaskContent - The formatted task content to add the ID to.
 * @param forceAddId - If true, force the addition of a new ID even if the task content already has one.
 * @returns A promise that resolves with an object containing the formatted task content and the new ID.
 */
export const addIdToTaskContent = async (
	Plugin: TaskBoard,
	formattedTaskContent: string,
	forcefullyAddId?: boolean,
): Promise<{ formattedTaskContent: string; newId: string | undefined }> => {
	const taskId = extractTaskId(
		formattedTaskContent,
		Plugin.settings.data.taskProperties,
		Plugin.settings.data.taskPropertyFormat,
	);
	let newId = taskId?.[1];
	if (
		(taskId === null && Plugin.settings.data.autoAddUniqueID) ||
		forcefullyAddId
	) {
		newId = generateTaskId(Plugin);
		const format = Plugin.settings.data.taskPropertyFormat;
		switch (format) {
			case taskPropertyFormatOptions.tasksPlugin:
			case taskPropertyFormatOptions.default:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 🆔 ${newId} $2`,
				);
				break;

			case taskPropertyFormatOptions.dataviewPlugin:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 [id:: ${newId}] $2`,
				);
				break;

			case taskPropertyFormatOptions.obsidianNative:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 @id(${newId}) $2`,
				);
				break;

			default:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 🆔 ${newId} $2`,
				);
				break;
		}
	}
	return { formattedTaskContent, newId };
};

/**
 * Returns a formatted task content as a string.
 * If the task is null or has no title, returns an empty string.
 * Replaces the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
 * Adds the body content, indent each line with a tab (or 4 spaces) for proper formatting.
 * @param task - The taskItem object representing the task to format.
 * @returns A string containing the formatted task content.
 */
export const getFormattedTaskContentSync = (task: taskItem): string => {
	if (!task || !task[DEFAULT_TASK_CACHE_KEYS.Title]) {
		return "";
	}

	// const checkBoxStat = `- [${task.status}]`;
	// let taskLine = `${checkBoxStat} ${task.title}`;

	// Replace the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
	let taskLine = task[DEFAULT_TASK_CACHE_KEYS.Title].replace(
		/\[(.)\]/,
		`[${task[DEFAULT_TASK_CACHE_KEYS.Status]}]`,
	);

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = (task[DEFAULT_TASK_CACHE_KEYS.Body] ?? [])
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${taskLine}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Function to get the formatted task content. The content will look similar to how it goes into your notes.
 * @param task - The task item to format.
 * @returns The formatted task content as a string.
 */
export const getFormattedTaskContent = async (
	task: taskItem,
): Promise<string> => {
	if (!task || !task[DEFAULT_TASK_CACHE_KEYS.Title]) {
		return "";
	}

	// const checkBoxStat = `- [${task.status}]`;
	// let taskLine = `${checkBoxStat} ${task.title}`;

	// Replace the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
	let taskLine = task[DEFAULT_TASK_CACHE_KEYS.Title].replace(
		/\[(.)\]/,
		`[${task[DEFAULT_TASK_CACHE_KEYS.Status]}]`,
	);

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = (task[DEFAULT_TASK_CACHE_KEYS.Body] ?? [])
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${taskLine}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Function to get the sanitized task content.
 * This function will format the task content based on the latest properties of the task.
 * It will also ensure that the task content is in the correct format and does not contain any old or invalid properties.
 * Do not use this function in batches. It does a lot of regex operations and can be slow for large number of tasks at once.
 * @param globalSettings - Plugin level settings.
 * @param updatedTask - The updated task item.
 * @return The sanitized task content as a string.
 */
export const getSanitizedTaskContent = (
	globalSettings: globalSettingsData,
	updatedTask: taskItem,
): string => {
	// if (updatedTask.title === "") {
	// 	return "";
	// }
	const checkBoxStat = `- [${updatedTask[DEFAULT_TASK_CACHE_KEYS.Status]}]`;

	// TODO : Sanitizations not only correcting the format and replacing the old content with the latest one, but also very important is to clean if any old properties are there.

	// Sanitize all the properties from the task title
	let updatedTitle = updatedTask[DEFAULT_TASK_CACHE_KEYS.Title];
	updatedTitle = sanitizePriority(
		globalSettings,
		updatedTitle,
		updatedTask[DEFAULT_TASK_CACHE_KEYS.Priority] ?? 0,
	);

	updatedTitle = sanitizeTime(
		globalSettings,
		updatedTitle,
		updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] ?? "",
	);

	for (const property of globalSettings.taskProperties) {
		if (
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Title) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Body) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Status) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Tags) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.FilePath) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Time) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Priority) ||
			isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.Reminder)
		) {
			continue;
		}
		const value = isTaskPropertyKey(property, DEFAULT_TASK_CACHE_KEYS.ID)
			? updatedTask[DEFAULT_TASK_CACHE_KEYS.LegacyID]
			: updatedTask[property.key];
		updatedTitle = sanitizeTaskProperty(
			globalSettings,
			updatedTitle,
			property.key,
			value,
		);
	}

	updatedTitle = sanitizeTags(
		updatedTitle,
		updatedTask[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	updatedTitle = sanitizeReminder(
		globalSettings,
		updatedTitle,
		updatedTask?.[DEFAULT_TASK_CACHE_KEYS.Reminder] || "",
	);

	// Build the formatted string for the main task
	let formattedTask = `${checkBoxStat} ${updatedTitle}`;

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = (updatedTask[DEFAULT_TASK_CACHE_KEYS.Body] ?? [])
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Sanitizes the status value of a task by replacing the old status value with a new one.
 * If there is an issue with extracting the old status value, the old title value is returned as it is.
 *
 * @param {string} oldTitle - The old task title.
 * @param {string} newStatusSymbol - The new status value to replace with.
 * @param {string} newStatusType - Based on this type, will decide whether to add a completion and cancelled date or remove it from the title.
 * @returns {string} The sanitized task title with the new status value.
 */
export const sanitizeStatus = (
	globalSettings: globalSettingsData,
	oldTitle: string,
	newStatusSymbol: string,
	newStatusType: statusTypeNames,
): string => {
	const oldStatusValuematch = oldTitle.match(/\[(.)\]/); // Extract the symbol inside [ ]
	let newTitle = oldTitle;
	if (!oldStatusValuematch || oldStatusValuematch.length < 2) {
		bugReporterManagerInsatance.addToLogs(
			106,
			`Status symbol not found in the following oldTtitle : ${oldTitle}`,
			"TaskContentFormatter.ts/sanitizeStatus",
		);
		return oldTitle;
	}

	newTitle = oldTitle.replace(oldStatusValuematch[0], `[${newStatusSymbol}]`);

	if (newStatusType === statusTypeNames.DONE) {
		if (globalSettings.autoAddCompletedDate) {
			const currentDateValue = getCurrentLocalDateTimeString(
				globalSettings.dateTimeFormat,
			);
			newTitle = sanitizeCompletionDate(
				globalSettings,
				newTitle,
				currentDateValue,
			);
		}
	} else if (newStatusType === statusTypeNames.CANCELLED) {
		if (globalSettings.autoAddCancelledDate) {
			const currentDateValue = getCurrentLocalDateTimeString(
				globalSettings.dateTimeFormat,
			);
			newTitle = sanitizeCancelledDate(
				globalSettings,
				newTitle,
				currentDateValue,
			);
		}
	} else {
		newTitle = sanitizeCancelledDate(globalSettings, newTitle, "");
		newTitle = sanitizeCompletionDate(globalSettings, newTitle, "");
	}

	return newTitle;
};

/**
 * Function to sanitize tags inside the task title.
 * @param title - The title of the task.
 * @param newTagsList - The updated list of tags that should exist (with #).
 * @param cursorLocation - (Optional) Cursor location for insertion.
 * @returns The sanitized title with correct tags.
 */
export const sanitizeTags = (
	title: string,
	newTagsList: string[],
	cursorLocation?: cursorLocationInterface,
): string => {
	// Remove <mark> and <font> tags before processing
	let updatedTitle = title;
	const tempTitle = title.replace(/<(mark|font).*?>/g, "");

	// Regex to extract tags from title
	const extractedTags = (
		tempTitle.match(TaskRegularExpressions.hashTagsRegex) || []
	).map((t) => t.trim());

	// const oldTagSet = new Set(oldTagsList.map((t) => t.trim()));
	// TODO : Soon, will update the tags management mechanism to store the tags without the `#`
	// in the tasks cache. And here will directly apply the '#' to the newTagSet
	// and reduce the below computations.
	const newTagSet = new Set(
		newTagsList.map((t) => {
			let sTag = t.trim();
			sTag = sTag.startsWith("#") ? sTag : `#${sTag}`;
			return sTag;
			// return t.trim();
		}),
	);
	const extractedTagsSet = new Set(extractedTags.map((t) => t.trim()));

	// --------------------------------------------------
	// 1. REMOVE TAGS THAT NO LONGER EXIST
	// --------------------------------------------------
	for (const tag of extractedTags) {
		if (!newTagSet.has(tag)) {
			updatedTitle = updatedTitle.replace(tag, "").trimEnd();
		}
	}

	// --------------------------------------------------
	// 2. FIND TAGS THAT NEED TO BE ADDED
	// --------------------------------------------------
	const tagsToAdd: string[] = [];
	for (const tag of newTagSet) {
		if (!extractedTagsSet.has(tag)) {
			tagsToAdd.push(tag);
		}
	}

	// --------------------------------------------------
	// 3. INSERT / APPEND NEW TAGS
	// --------------------------------------------------
	if (tagsToAdd.length > 0) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert at cursor position (preserves your original behavior)
			const before = updatedTitle
				.slice(0, cursorLocation.charIndex)
				.trimEnd();
			const after = updatedTitle.slice(cursorLocation.charIndex).trim();

			updatedTitle = [before, ...tagsToAdd, after]
				.filter(Boolean)
				.join(" ");
		} else {
			// Append all new tags at the end
			for (const tag of tagsToAdd) {
				if (!updatedTitle.includes(tag)) {
					updatedTitle += ` ${tag}`;
				}
			}
		}
	}

	// Sanitize the title by reducing two or more spaces into one space.
	return updatedTitle.replace(/ {2,}/g, " ").trimEnd();
};

/**
 * Function to sanitize the priority inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newPriority - The new priority to be sanitized and added to the title.
 * @param cursorLocation - (Optional) The cursor location to insert the priority at a specific position.
 * @returns The sanitized priority string to be used in the task title.
 *
 * @todo This is the only thing remaining, I might have to avoid sanitizing this, as it might create duplicates. Just adding it as the property of the task which will be only visible in the task board.
 */
export const sanitizePriority = (
	globalSettings: globalSettingsData,
	title: string,
	newPriority: number,
	cursorLocation?: cursorLocationInterface,
): string => {
	// // Create a regex pattern to match any priority emoji
	// const emojiPattern = new RegExp(
	// 	`(${Object.values(priorityEmojis)
	// 		.map((emoji) => `\\s*${emoji}\\s*`)
	// 		.join("|")})`,
	// 	"g"
	// );

	// // Execute the regex to find all emojis in the text
	// const extractedPriorityMatch = title.match(emojiPattern);
	// console.log("extractedPriorityMatch", extractedPriorityMatch);

	// // If no priority emoji exists, append the new priority at the end
	// if (!extractedPriorityMatch) {
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // Check if all extracted values are zero ("0")
	// const allZero = extractedPriorityMatch.every((item) => item.trim() === "0");

	// if (allZero) {
	// 	// If all elements are zero, append new priority emoji at the end
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // Find the first **non-zero** valid priority emoji from extracted matches
	// const extractedPriority = extractedPriorityMatch.find((emoji) =>
	// 	Object.values(priorityEmojis).includes(emoji.trim())
	// );
	// console.log(
	// 	"extractedPriority : first **non-zero** valid priority emoji",
	// 	extractedPriority
	// );

	// // If no valid priority emoji is found, append the new one
	// if (!extractedPriority) {
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // If extracted priority matches the new one, return the title as is
	// if (extractedPriority.trim() === priorityEmojis[newPriority]) {
	// 	return title;
	// }

	// // Replace the old priority emoji with the new one
	// return title
	// 	.replace(
	// 		extractedPriority,
	// 		newPriority > 0 ? priorityEmojis[newPriority] : ""
	// 	)
	// 	.trim();

	const extractedPriorityMatch = extractPriority(
		title,
		globalSettings.taskProperties,
		globalSettings.customPriorities,
	);

	if (extractedPriorityMatch.value === 0) {
		if (newPriority > 0) {
			let priorityWithFormat: string = "";
			if (
				globalSettings?.taskPropertyFormat ===
				taskPropertyFormatOptions.dataviewPlugin
			) {
				priorityWithFormat = `[priority:: ${newPriority}]`;
			} else if (
				globalSettings?.taskPropertyFormat ===
				taskPropertyFormatOptions.obsidianNative
			) {
				priorityWithFormat = `@priority(${newPriority})`;
			} else {
				priorityWithFormat =
					globalSettings.customPriorities.find(
						(priority) => priority.rank === newPriority,
					)?.emoji ?? priorityEmojis[newPriority];
			}

			if (cursorLocation?.lineNumber === 1) {
				// Insert priorityWithFormat at the specified charIndex with spaces
				const spaceBefore =
					title.slice(0, cursorLocation.charIndex).trimEnd() + " ";
				const spaceAfter =
					" " + title.slice(cursorLocation.charIndex).trim();
				return `${spaceBefore}${priorityWithFormat}${spaceAfter}`;
			}

			return `${title} ${priorityWithFormat}`;
		}
		return title;
	}

	// let match = title.match(
	// 	new RegExp(`\\[priority::\\s*${extractedPriorityMatch}\\s*\\]`),
	// );
	if (extractedPriorityMatch.parsedString.startsWith("[")) {
		return newPriority > 0
			? title.replace(
					extractedPriorityMatch.parsedString,
					`[priority:: ${newPriority}]`,
				)
			: title.replace(extractedPriorityMatch.parsedString, "");
	}

	if (extractedPriorityMatch.parsedString.startsWith("@")) {
		return newPriority > 0
			? title.replace(
					extractedPriorityMatch.parsedString,
					`@priority(${newPriority})`,
				)
			: title.replace(extractedPriorityMatch.parsedString, "");
	}

	// match = title.match(
	// 	new RegExp(`@priority\\(\\s*${extractedPriorityMatch}\\s*\\)`),
	// );
	// if (match) {
	// 	return newPriority > 0
	// 		? title.replace(match[0], `@priority(${newPriority})`)
	// 		: title.replace(match[0], "");
	// }

	// This part is where only the last left format of emojies will be handled.
	if (extractedPriorityMatch.value === newPriority) {
		return title;
	} else {
		const newPriorityEmoji =
			globalSettings.customPriorities.find(
				(priority) => priority.rank === newPriority,
			)?.emoji ?? priorityEmojis[newPriority];
		return title.replace(
			extractedPriorityMatch.parsedString,
			newPriorityEmoji,
		);
	}
};

/**
 * Function to sanitize the time inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newTime - The new time to be sanitized and added to the title.
 * @param cursorLocation - (Optional) The cursor location to insert the time at a specific position.
 * @returns The sanitized title with updated time value.
 */
export const sanitizeTime = (
	globalSettings: globalSettingsData,
	title: string,
	newTime: string,
	cursorLocation?: cursorLocationInterface,
): string => {
	const timePropertyConfig = getTaskProperty(
		globalSettings.taskProperties,
		DEFAULT_TASK_CACHE_KEYS.Time,
	);
	let timePropertyId = "time";
	let timePropertyEmoji = TASKS_PLUGIN_DEFAULT_SYMBOLS.duration;
	if (timePropertyConfig) {
		timePropertyId = timePropertyConfig.id;
		timePropertyEmoji = timePropertyConfig.emoji;
	}

	const timeAtStartRegex = /]\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/;
	const timeFormatsRegex = new RegExp(
		`\\s*(${escapeRegExp(timePropertyEmoji)}\\s*(\\[.*?\\]|(\\d{2}:\\d{2}\\s*-\\s*\\d{2}:\\d{2}))|\\[${escapeRegExp(timePropertyId)}::(.*?)\\]|@${escapeRegExp(timePropertyId)}\\((.*?)\\))`,
		"g",
	);
	// Match all three formats

	// Match both the time formats
	const timeAtStartMatch = title.match(timeAtStartRegex);
	// const timeFormatMatch = title.match(timeFormatsRegex);

	let timeFormatMatch: string[] | null = null;
	let match = timeFormatsRegex.exec(title);
	if (match) {
		timeFormatMatch = [];
		timeFormatMatch.push(match[0].trim()); // original match
		timeFormatMatch.push(match[3] || match[4] || match[5]); // extracted time range
	}

	// If newtime is empty, that means, either time was not present from initially, or it has been removed now in the modal.
	if (newTime === "") {
		if (timeAtStartMatch) {
			return title.replace(timeAtStartMatch[1], "").trimEnd();
		}

		if (timeFormatMatch) {
			return title.replace(timeFormatMatch[0], "").trimEnd();
		}

		return title;
	}

	// If dayPlanner plugin compatibility is enabled then place the time value at the start of the title only.
	if (globalSettings.compatiblePlugins.dayPlannerPlugin) {
		if (timeAtStartMatch) {
			// If time is at the start of the title, replace it
			return title.replace(timeAtStartMatch[1], newTime);
		}

		if (timeFormatMatch) {
			// If time is present in any format, remove it and add this new time at the start
			title = title.replace(timeFormatsRegex, "").trimEnd();
		}

		// If no time is present, add it at the start
		// const beforePosition = title.slice(0, 5).trimEnd();
		// const afterPosition = title.slice(5).trim();
		const newTitle = title.replace("]", `] ${newTime}`);
		return newTitle;
	} else {
		let newTimeWithFormat: string = "";
		if (
			globalSettings.taskPropertyFormat ===
			taskPropertyFormatOptions.default
		) {
			newTimeWithFormat = `${timePropertyEmoji}${newTime.replaceAll(" ", "")}`;
		} else if (
			globalSettings.taskPropertyFormat ===
			taskPropertyFormatOptions.tasksPlugin
		) {
			newTimeWithFormat = `${timePropertyEmoji} ${newTime}`;
		} else if (
			globalSettings.taskPropertyFormat ===
			taskPropertyFormatOptions.dataviewPlugin
		) {
			newTimeWithFormat = `[${timePropertyId}:: ${newTime}]`;
		} else {
			newTimeWithFormat = `@${timePropertyId}(${newTime})`;
		}

		// Remove the time from the beginning of the title
		if (timeAtStartMatch) {
			title.replace(timeAtStartMatch[1], "");
		}

		if (timeFormatMatch) {
			return title.replace(timeFormatMatch[0], newTimeWithFormat);
		}

		if (cursorLocation?.lineNumber === 1) {
			const titleWithStar =
				title.slice(0, cursorLocation.charIndex) +
				"*" +
				title.slice(cursorLocation.charIndex);
			// Insert newTimeWithFormat at the specified charIndex with spaces
			const spaceBefore = title
				.slice(0, cursorLocation.charIndex)
				.trimEnd();
			const spaceAfter = title.slice(cursorLocation.charIndex).trim();

			return `${spaceBefore} ${newTimeWithFormat} ${spaceAfter}`;
		}

		// If no time is present, append it at the end
		return `${title} ${newTimeWithFormat} `;
	}
};

export const removeTimeProperty = (
	title: string,
	taskPropertiesConfig: SupportedPropertiesConfig[],
): string => {
	const timePropertyConfig = getTaskProperty(
		taskPropertiesConfig,
		DEFAULT_TASK_CACHE_KEYS.Time,
	);
	let timePropertyId = "time";
	let timePropertyEmoji = TASKS_PLUGIN_DEFAULT_SYMBOLS.duration;
	if (timePropertyConfig) {
		timePropertyId = timePropertyConfig.id;
		timePropertyEmoji = timePropertyConfig.emoji;
	}

	const timeAtStartRegex = /^(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\s+/;
	const timeAtStartMatch = title.match(timeAtStartRegex);
	if (timeAtStartMatch) {
		return title.replace(timeAtStartMatch[1], "").trimEnd();
	}

	// Match all three formats
	const timeFormatsRegex = new RegExp(
		`\\s*(${escapeRegExp(timePropertyEmoji)}\\s*(\\[.*?\\]|(\\d{2}:\\d{2}\\s*-\\s*\\d{2}:\\d{2}))|\\[${escapeRegExp(timePropertyId)}::(.*?)\\]|@${escapeRegExp(timePropertyId)}\\((.*?)\\))`,
		"g",
	);
	let timeFormatMatch: string[] | null = null;
	let match = timeFormatsRegex.exec(title);
	if (match) {
		timeFormatMatch = [];
		timeFormatMatch.push(match[0].trim()); // original match
		timeFormatMatch.push(match[3] || match[4] || match[5]); // extracted time range
	}

	if (timeFormatMatch) {
		return title.replace(timeFormatMatch[0], "").trimEnd();
	}

	return title;
};

// ==========================================================================================
// The specialized priority, time, and tag sanitizers above remain for their
// plugin-specific behavior. Other configured properties use sanitizeTaskProperty.
// ==========================================================================================

interface TaskPropertyMatch {
	start: number;
	end: number;
	text: string;
}

function isEmptyTaskPropertyValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		(typeof value === "string" && value.trim() === "") ||
		(Array.isArray(value) && value.length === 0)
	);
}

function isTaskPropertyKey(
	property: SupportedPropertiesConfig,
	key: DEFAULT_TASK_CACHE_KEYS,
): boolean {
	return property.key === String(key);
}

function escapeTaskPropertyRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the first occurrence of a configured property in any supported
 * inline-task format. The returned range excludes surrounding whitespace.
 */
function findTaskPropertyMatch(
	title: string,
	property: SupportedPropertiesConfig | undefined,
): TaskPropertyMatch | null {
	if (!property) return null;
	const matches: TaskPropertyMatch[] = [];

	if (property.id) {
		const escapedId = escapeTaskPropertyRegex(property.id);
		const patterns = [
			new RegExp(`\\[${escapedId}\\s*::\\s*[^\\]]*\\]`),
			new RegExp(`@${escapedId}\\([^)]*\\)`),
		];
		for (const pattern of patterns) {
			const match = pattern.exec(title);
			if (match && typeof match.index === "number") {
				matches.push({
					start: match.index,
					end: match.index + match[0].length,
					text: match[0],
				});
			}
		}
	}

	if (property.emoji) {
		const pattern = new RegExp(
			`(^|\\s)${escapeTaskPropertyRegex(property.emoji)}\\uFE0F? ?[^\\s]+`,
		);
		const match = pattern.exec(title);
		if (match && typeof match.index === "number") {
			const start = match.index + match[1].length;
			matches.push({
				start,
				end: match.index + match[0].length,
				text: title.slice(start, match.index + match[0].length),
			});
		}
	}

	return (
		matches.sort(
			(left, right) =>
				left.start - right.start ||
				right.text.length - left.text.length,
		)[0] ?? null
	);
}

function removeTaskPropertyMatch(
	title: string,
	match: TaskPropertyMatch,
): string {
	const before = title.slice(0, match.start);
	let after = title.slice(match.end);
	if (/[ \t]$/.test(before) && /^[ \t]/.test(after)) {
		after = after.replace(/^[ \t]+/, "");
	}
	return `${before}${after}`.trimEnd();
}

function formatTaskPropertyValue(
	globalSettings: globalSettingsData,
	property: SupportedPropertiesConfig,
	value: unknown,
): string {
	if (property.type === PropertyTypeConfig.date) {
		value =
			formatDateStringAsPerSettings(
				value instanceof Date ||
					typeof value === "number" ||
					typeof value === "string"
					? value
					: String(value),
				globalSettings.dateFormat,
			) || value;
	} else if (property.type === PropertyTypeConfig.dateTime) {
		value =
			formatDateTimeAsPerSettings(
				value instanceof Date ||
					typeof value === "number" ||
					typeof value === "string"
					? value
					: String(value),
				globalSettings.dateTimeFormat,
			) || value;
	}

	if (Array.isArray(value)) {
		return value
			.map(String)
			.join(
				globalSettings.taskPropertyFormat ===
					taskPropertyFormatOptions.default ||
					globalSettings.taskPropertyFormat ===
						taskPropertyFormatOptions.tasksPlugin
					? ","
					: ", ",
			);
	}
	return String(value);
}

function formatTaskProperty(
	globalSettings: globalSettingsData,
	property: SupportedPropertiesConfig,
	value: unknown,
): string {
	const formattedValue = formatTaskPropertyValue(
		globalSettings,
		property,
		value,
	);
	switch (globalSettings.taskPropertyFormat) {
		case taskPropertyFormatOptions.dataviewPlugin:
			return `[${property.id}:: ${formattedValue}]`;
		case taskPropertyFormatOptions.obsidianNative:
			return `@${property.id}(${formattedValue})`;
		case taskPropertyFormatOptions.tasksPlugin:
			return property.emoji ? `${property.emoji} ${formattedValue}` : "";
		default:
			return property.emoji ? `${property.emoji}${formattedValue}` : "";
	}
}

/**
 * Adds, updates, or removes a configured inline-task property in a title.
 */
export const sanitizeTaskProperty = (
	globalSettings: globalSettingsData,
	taskTitle: string,
	propertyKey: string,
	newValue: unknown,
	cursorLocation?: cursorLocationInterface,
): string => {
	const property = globalSettings.taskProperties.find(
		(candidate) => candidate.key === propertyKey,
	);
	if (!property) return taskTitle;

	const existingMatch = findTaskPropertyMatch(taskTitle, property);
	if (isEmptyTaskPropertyValue(newValue)) {
		return existingMatch
			? removeTaskPropertyMatch(taskTitle, existingMatch)
			: taskTitle;
	}

	const formattedProperty = formatTaskProperty(
		globalSettings,
		property,
		newValue,
	);
	if (!formattedProperty) return taskTitle;
	if (existingMatch?.text === formattedProperty) return taskTitle;

	if (existingMatch) {
		return (
			taskTitle.slice(0, existingMatch.start) +
			formattedProperty +
			taskTitle.slice(existingMatch.end)
		);
	}

	if (cursorLocation?.lineNumber === 1) {
		const insertionIndex = Math.max(
			0,
			Math.min(cursorLocation.charIndex, taskTitle.length),
		);
		const before = taskTitle.slice(0, insertionIndex).trimEnd();
		const after = taskTitle.slice(insertionIndex).trim();
		return [before, formattedProperty, after].filter(Boolean).join(" ");
	}

	return `${taskTitle.trimEnd()} ${formattedProperty}`;
};

// ==========================================================
//                 ALL DEPRECATED FUNCTIONS
// ==========================================================
/**
 * @deprecated Use {@link sanitizeTaskProperty} with the CreatedDate property key.
 * @param globalSettings - The global settings data.
 * @param title  - The title of the task.
 * @param createdDate - The new created date. Only single format supported right now. (yyyy-MM-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the created date at a specific position.
 * @returns The sanitized created date string to be used in the task title.
 */
export const sanitizeCreatedDate = (
	globalSettings: globalSettingsData,
	title: string,
	createdDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.CreatedDate,
		createdDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the StartDate property key.
 * @param globalSettings - The global settings data.
 * @param title  - The title of the task.
 * @param startDate - The start date of the task.
 * @param cursorLocation - (Optional) The cursor location to insert the start date at a specific position.
 * @returns The sanitized start date string to be used in the task title.
 */
export const sanitizeStartDate = (
	globalSettings: globalSettingsData,
	title: string,
	startDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.StartDate,
		startDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the ScheduledDate property key.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param scheduledDate - The scheduled date of the task.
 * @param cursorLocation - (Optional) The cursor location to insert the scheduled date at a specific position.
 * @returns The sanitized scheduled date string to be used in the task title.
 */
export const sanitizeScheduledDate = (
	globalSettings: globalSettingsData,
	title: string,
	scheduledDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
		scheduledDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the DueDate property key.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param dueDate - The due date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the due date at a specific position.
 * @returns The sanitized due date string to be used in the task title.
 */
export const sanitizeDueDate = (
	globalSettings: globalSettingsData,
	title: string,
	dueDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.DueDate,
		dueDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the CompletionDate property key.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param completionDate - The completion date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the completion date at a specific position.
 * @returns The sanitized completion date string to be used in the task title.
 */
export const sanitizeCompletionDate = (
	globalSettings: globalSettingsData,
	title: string,
	completionDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.CompletionDate,
		completionDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the CancelledDate property key.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param cancelledDate - The cancellation date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the cancellation date at a specific position.
 * @returns The sanitized cancellation date string to be used in the task title.
 */
export const sanitizeCancelledDate = (
	globalSettings: globalSettingsData,
	title: string,
	cancelledDate: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.CancelledDate,
		cancelledDate,
		cursorLocation,
	);
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} for task-property formats. This
 * adapter remains for reminder-plugin compatibility syntax.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newReminder - The new reminder to be sanitized and added to the title. Must be in the format "yyyy-MM-ddTHH:mm".
 * @param cursorLocation - (Optional) The cursor location to insert the reminder at a specific position.
 * @returns The sanitized reminder string to be used in the task title.
 */
export const sanitizeReminder = (
	globalSettings: globalSettingsData,
	title: string,
	newReminder: string | number,
	cursorLocation?: cursorLocationInterface,
): string => {
	const formatReminder = (reminder: string | number) => {
		const date = new Date(reminder);
		if (
			globalSettings.notificationService ===
				NotificationService.ReminderPlugin ||
			globalSettings.notificationService ===
				NotificationService.NotifianApp
		) {
			return `(@${date.getFullYear().toString().padStart(4, "0")}-${(
				date.getMonth() + 1
			)
				.toString()
				.padStart(2, "0")}-${date
				.getDate()
				.toString()
				.padStart(2, "0")} ${date
				.getHours()
				.toString()
				.padStart(2, "0")}:${date
				.getMinutes()
				.toString()
				.padStart(2, "0")})`;
		} else if (
			globalSettings.notificationService === NotificationService.ObsidApp
		) {
			return `(@${date.getHours().toString().padStart(2, "0")}:${date
				.getMinutes()
				.toString()
				.padStart(2, "0")})`;
		}
		return "";
	};

	const reminderRegex =
		globalSettings.notificationService === NotificationService.ObsidApp
			? /\(@\d{2}:\d{2}\)/
			: /\(@\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)/;

	if (!newReminder) {
		return title.replace(reminderRegex, "").trimEnd();
	}

	const formattedReminder = formatReminder(newReminder);
	if (title.includes(formattedReminder)) {
		return title;
	}

	const existingReminderMatch = title.match(reminderRegex);
	if (existingReminderMatch) {
		return title.replace(reminderRegex, formattedReminder);
	}

	if (cursorLocation?.lineNumber === 1) {
		// Insert formattedReminder at the specified charIndex with spaces
		const spaceBefore =
			title.slice(0, cursorLocation.charIndex).trimEnd() + " ";
		const spaceAfter = " " + title.slice(cursorLocation.charIndex).trim();
		return `${spaceBefore}${formattedReminder}${spaceAfter}`;
	}
	// If no existing reminder found, append new one at the end
	return `${title} ${formattedReminder}`;
};

/**
 * @deprecated Use {@link sanitizeTaskProperty} with the Dependencies property key.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param dependesOnIds - The IDs of the tasks that this task depends on.
 * @param cursorLocation - (Optional) The cursor location to insert the dependsOn at a specific position.
 * @returns The sanitized title string with the updated "dependsOn" section.
 */
export const sanitizeDependsOn = (
	globalSettings: globalSettingsData,
	title: string,
	dependesOnIds: string[],
	cursorLocation?: cursorLocationInterface,
): string => {
	return sanitizeTaskProperty(
		globalSettings,
		title,
		DEFAULT_TASK_CACHE_KEYS.Dependencies,
		dependesOnIds,
		cursorLocation,
	);
};
