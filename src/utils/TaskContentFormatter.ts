import { priorityEmojis, taskItem } from "src/interfaces/TaskItemProps";

import TaskBoard from "main";
import { extractPriority } from "./ScanningVault";
import { globalSettingsData } from "src/interfaces/GlobalSettings";

export const taskContentFormatter = (
	plugin: TaskBoard,
	updatedTask: taskItem
): string => {
	if (updatedTask.title === "") {
		return "";
	}

	const globalSettings = plugin.settings.data.globalSettings;
	const checkBoxStat = `- [${updatedTask.status}]`;

	// TODO : Sanitizations not only correcting the format and replacing the old content with the latest one, but also very important is to clean if any old properties are there.

	// Sanitize all the properties from the task title
	let updatedTitle = updatedTask.title;
	updatedTitle = sanitizePriority(
		updatedTitle,
		updatedTask.priority,
		globalSettings
	);

	updatedTitle = sanitizeTime(updatedTitle, updatedTask.time, globalSettings);

	updatedTitle = sanitizeDueDate(globalSettings, updatedTitle, updatedTask);

	updatedTitle = sanitizeTags(updatedTitle, updatedTask.tags);

	updatedTitle = sanitizeCompletionDate(
		globalSettings,
		updatedTitle,
		updatedTask
	);

	// Build the formatted string for the main task
	let formattedTask = `${checkBoxStat} ${updatedTitle}`;

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = updatedTask.body
		.map((line: string) => {
			if (line.startsWith("\t")) {
				return line;
			} else {
				return `\t${line}`;
			}
		})
		.join("\n");

	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Function to sanitize the due date inside the task title.
 */
const sanitizeDueDate = (
	globalSettings: globalSettingsData,
	title: string,
	updatedTask: taskItem
): string => {
	const dueDateRegex =
		/📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::\s*?\d{4}-\d{2}-\d{2}\]|@due\(\d{4}-\d{2}-\d{2}\)/;
	const extractedDueDateMatch = title.match(dueDateRegex);
	// console.log("extractedDueDateMatch", extractedDueDateMatch);

	// If user has removed the due date, remove it from the title inside the note.
	if (!updatedTask.due) {
		if (extractedDueDateMatch) {
			// If due date is empty, remove any existing due date
			return title.replace(extractedDueDateMatch[0], "").trim();
		}
		return title;
	}

	let dueDateWithFormat: string = "";
	if (updatedTask.due) {
		if (globalSettings?.taskCompletionFormat === "1") {
			dueDateWithFormat = updatedTask.due ? `📅${updatedTask.due}` : "";
		} else if (globalSettings?.taskCompletionFormat === "2") {
			dueDateWithFormat = updatedTask.due ? `📅 ${updatedTask.due}` : "";
		} else if (globalSettings?.taskCompletionFormat === "3") {
			dueDateWithFormat = updatedTask.due
				? `[due:: ${updatedTask.due}]`
				: "";
		} else {
			dueDateWithFormat = updatedTask.due
				? `@due(${updatedTask.due})`
				: "";
		}
	}

	if (!extractedDueDateMatch) {
		// No existing due date found, append new one at the end
		return `${title} ${dueDateWithFormat}`;
	}

	const extractedDueDate = extractedDueDateMatch[0];

	if (extractedDueDate.includes(dueDateWithFormat)) {
		// If extracted due date matches the new one, no need to change
		return title;
	}

	// Replace the old due date with the updated one
	return title.replace(dueDateRegex, dueDateWithFormat);
};

/**
 * Function to sanitize the completion date inside the task title.
 */
const sanitizeCompletionDate = (
	globalSettings: globalSettingsData,
	title: string,
	updatedTask: taskItem
): string => {
	const completionDateRegex =
		/\[completion::[^\]]+\]|\@completion\(.*?\)|✅\s*.*?(?=\s|$)/;
	const extractedCompletionDateMatch = title.match(completionDateRegex);

	if (!updatedTask.completion) {
		// If completion date is empty, remove any existing completion date
		if (extractedCompletionDateMatch) {
			return title.replace(extractedCompletionDateMatch[0], "").trim();
		}
		return title;
	}

	let completedWitFormat: string = "";
	if (updatedTask.due || updatedTask.completion) {
		if (globalSettings?.taskCompletionFormat === "1") {
			completedWitFormat = updatedTask.completion
				? `✅${updatedTask.completion} `
				: "";
		} else if (globalSettings?.taskCompletionFormat === "2") {
			completedWitFormat = updatedTask.completion
				? `✅ ${updatedTask.completion} `
				: "";
		} else if (globalSettings?.taskCompletionFormat === "3") {
			completedWitFormat = updatedTask.completion
				? `[completion:: ${updatedTask.completion}] `
				: "";
		} else {
			completedWitFormat = updatedTask.completion
				? `@completion(${updatedTask.completion}) `
				: "";
		}
	}

	if (!extractedCompletionDateMatch) {
		// No existing completion date found, append new one at the end
		return `${title} ${completedWitFormat}`;
	}

	const extractedCompletionDate = extractedCompletionDateMatch[0];

	if (extractedCompletionDate.includes(completedWitFormat)) {
		// If extracted completion date matches the new one, no need to change
		return title;
	}

	// Replace the old completion date with the updated one
	return title.replace(completionDateRegex, completedWitFormat);
};

/**
 * Function to sanitize the time inside the task title.
 */
const sanitizeTime = (
	title: string,
	newTime: string,
	globalSettings: globalSettingsData
): string => {
	const timeAtStartRegex = /^\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/;
	const timeFormatsRegex = /\s*(⏰\s*\[.*?\]|\[time::.*?\]|@time\(.*?\))/g; // Match all three formats

	if (globalSettings.dayPlannerPlugin) {
		const timeAtStartMatch = title.match(timeAtStartRegex);
		if (timeAtStartMatch) {
			// If time is at the start of the title, replace it
			return title.replace(timeAtStartMatch[0], newTime);
		}

		const timeFormatMatch = title.match(timeFormatsRegex);
		if (timeFormatMatch) {
			// If time is present in any format, move it to the start
			title = title.replace(timeFormatsRegex, "").trim();
			return `${newTime} ${title}`;
		}

		// If no time is present, add it at the start
		return `${newTime} ${title}`;
	} else {
		const timeAtStartMatch = title.match(timeAtStartRegex);
		const timeFormatMatch = title.match(timeFormatsRegex);

		if (newTime === "") {
			if (timeAtStartMatch) {
				return title.replace(timeAtStartMatch[0], "").trim();
			}

			if (timeFormatMatch) {
				return title.replace(timeFormatMatch[0], "").trim();
			}

			return title;
		}

		if (timeAtStartMatch) {
			// If time is at the start of the title, move it to the end with emoji format
			title = title.replace(timeAtStartMatch[0], "").trim();
			if (globalSettings.taskCompletionFormat === "1") {
				return `${title} ⏰[${newTime}]`;
			} else if (globalSettings.taskCompletionFormat === "2") {
				return `${title} ⏰ [${newTime}]`;
			} else if (globalSettings.taskCompletionFormat === "3") {
				return `${title} [time:: ${newTime}]`;
			} else {
				return `${title} @time(${newTime})`;
			}
		}

		if (timeFormatMatch) {
			// If time is present in any format, replace it with the new time
			if (globalSettings.taskCompletionFormat === "1") {
				return title.replace(timeFormatsRegex, `⏰[${newTime}]`);
			} else if (globalSettings.taskCompletionFormat === "2") {
				return title.replace(timeFormatsRegex, `⏰ [${newTime}]`);
			} else if (globalSettings.taskCompletionFormat === "3") {
				return title.replace(timeFormatsRegex, `[time:: ${newTime}]`);
			} else {
				return title.replace(timeFormatsRegex, `@time(${newTime})`);
			}
		}

		// If no time is present, add it at the end
		if (globalSettings.taskCompletionFormat === "1") {
			return `${title} ⏰[${newTime}]`;
		} else if (globalSettings.taskCompletionFormat === "2") {
			return `${title} ⏰ [${newTime}]`;
		} else if (globalSettings.taskCompletionFormat === "3") {
			return `${title} [time:: ${newTime}]`;
		} else {
			return `${title} @time(${newTime})`;
		}
	}
};

// TODO : This is the only thing remaining, I might have to avoid sanitizing this, as it might create duplicates. Just adding it as the property of the task which will be only visible in the task board.
/**
 * Function to sanitize the priority inside the task title.
 */
const sanitizePriority = (
	title: string,
	newPriority: number,
	globalSettings: globalSettingsData
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

	const extractedPriorityMatch = extractPriority(title);

	if (extractedPriorityMatch === 0) {
		if (newPriority > 0) {
			if (globalSettings?.taskCompletionFormat === "3") {
				return `${title} [priority:: ${newPriority}]`;
			} else if (globalSettings?.taskCompletionFormat === "4") {
				return `${title} @priority(${newPriority})`;
			} else {
				return `${title} ${priorityEmojis[newPriority]}`;
			}
		}
		return title;
	}

	let match = title.match(
		new RegExp(`\\[priority::\\s*${extractedPriorityMatch}\\s*\\]`)
	);
	if (match) {
		return newPriority > 0
			? title.replace(match[0], `[priority:: ${newPriority}]`)
			: title.replace(match[0], "");
	}

	match = title.match(
		new RegExp(`@priority\\(\\s*${extractedPriorityMatch}\\s*\\)`)
	);
	if (match) {
		return newPriority > 0
			? title.replace(match[0], `@priority(${newPriority})`)
			: title.replace(match[0], "");
	}

	if (extractedPriorityMatch === newPriority) {
		return title;
	} else {
		return title.replace(
			priorityEmojis[extractedPriorityMatch],
			priorityEmojis[newPriority]
		);
	}
};

/**
 * Function to sanitize the tags inside the task title.
 */
const sanitizeTags = (title: string, newTags: string[]): string => {
	const tagsRegex = /#[^\s]+/g;
	const extractedTagsMatch = title.match(tagsRegex) || [];

	// Create a set for quick lookup of newTags
	const newTagsSet = new Set(newTags);

	if (newTagsSet.size === 0) {
		// If no tags are present, remove all existing tags
		extractedTagsMatch.forEach((tag) => {
			title = title.replace(tag, "").trim();
		});
		return title;
	}

	// Remove tags from the title that are not in newTags
	let updatedTitle = title;
	for (const tag of extractedTagsMatch) {
		if (!newTagsSet.has(tag)) {
			updatedTitle = updatedTitle.replace(tag, "").trim();
		}
	}

	// Append tags from newTags that are not already in the title
	const updatedTagsMatch =
		updatedTitle.match(tagsRegex)?.map((tag) => tag.trim()) || [];
	const updatedTagsSet = new Set(updatedTagsMatch);

	for (const tag of newTags) {
		if (!updatedTagsSet.has(tag)) {
			updatedTitle += ` ${tag}`;
		}
	}

	return updatedTitle.trim();
};

// export const taskContentFormatter = (
// 	plugin: TaskBoard,
// 	updatedTask: taskItem
// ): string => {
// 	if (updatedTask.title === "") {
// 		return "";
// 	}

// 	const dayPlannerPlugin =
// 		plugin.settings.data.globalSettings.dayPlannerPlugin;
// 	const globalSettings = plugin.settings.data.globalSettings;

// 	let dueDateWithFormat: string = "";
// 	let completedWitFormat: string = "";
// 	if (updatedTask.due || updatedTask.completion) {
// 		if (globalSettings?.taskCompletionFormat === "1") {
// 			dueDateWithFormat = updatedTask.due ? ` 📅${updatedTask.due}` : "";
// 			completedWitFormat = updatedTask.completion
// 				? ` ✅${updatedTask.completion} `
// 				: "";
// 		} else if (globalSettings?.taskCompletionFormat === "2") {
// 			dueDateWithFormat = updatedTask.due ? ` 📅 ${updatedTask.due}` : "";
// 			completedWitFormat = updatedTask.completion
// 				? ` ✅ ${updatedTask.completion} `
// 				: "";
// 		} else if (globalSettings?.taskCompletionFormat === "3") {
// 			dueDateWithFormat = updatedTask.due
// 				? ` [due:: ${updatedTask.due}]`
// 				: "";
// 			completedWitFormat = updatedTask.completion
// 				? ` [completion:: ${updatedTask.completion}] `
// 				: "";
// 		} else {
// 			dueDateWithFormat = updatedTask.due
// 				? ` @due(${updatedTask.due})`
// 				: "";
// 			completedWitFormat = updatedTask.completion
// 				? ` @completion(${updatedTask.completion}) `
// 				: "";
// 		}
// 	}

// 	const timeWithEmo = updatedTask.time ? ` ⏰[${updatedTask.time}]` : "";
// 	const checkBoxStat = `- [${updatedTask.status}]`;

// 	// Combine priority emoji if it exists
// 	const priorityWithEmo =
// 		updatedTask.priority > 0
// 			? priorityEmojis[updatedTask.priority as number]
// 			: "";

// 	// Build the formatted string for the main task
// 	let formattedTask = "";
// 	if (
// 		updatedTask.time !== "" ||
// 		timeWithEmo !== "" ||
// 		priorityWithEmo !== "" ||
// 		dueDateWithFormat !== "" ||
// 		completedWitFormat !== "" ||
// 		updatedTask.tags.length > 0
// 	) {
// 		if (dayPlannerPlugin) {
// 			formattedTask = `${checkBoxStat} ${
// 				updatedTask.time ? `${updatedTask.time} ` : ""
// 			}${
// 				updatedTask.title
// 			} | ${priorityWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
// 				" "
// 			)}${completedWitFormat}`;
// 		} else {
// 			formattedTask = `${checkBoxStat} ${
// 				updatedTask.title
// 			} |${priorityWithEmo}${timeWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
// 				" "
// 			)}${completedWitFormat}`;
// 		}
// 	} else {
// 		formattedTask = `${checkBoxStat} ${updatedTask.title}`;
// 	}
// 	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
// 	const bodyLines = updatedTask.body
// 		.map((line: string) => {
// 			if (line.startsWith("\t")) {
// 				return line;
// 			} else {
// 				return `\t${line}`;
// 			}
// 		})
// 		.join("\n");

// 	const completeTask = `${formattedTask}${
// 		bodyLines.trim() ? `\n${bodyLines}` : ""
// 	}`;

// 	return completeTask;
// };

// For handleCheckboxChange

export const cleanTaskTitle = (plugin: TaskBoard, task: taskItem): string => {
	if (!plugin.settings.data.globalSettings.showTaskWithoutMetadata) {
		return task.title;
	}

	let cleanedTitle = task.title;

	// Remove tags
	task.tags.forEach((tag) => {
		const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
		const tagsMatch = cleanedTitle.match(tagRegex);
		if (tagsMatch) {
			cleanedTitle = cleanedTitle.replace(tagsMatch[0], "");
		}
	});

	// Remove time (handles both formats)
	if (task.time) {
		const timeRegex =
			/\s*(⏰\s*\[\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\]|\b\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\b|\[time::.*?\]|\@time\(.*?\))/g;
		const timeMatch = cleanedTitle.match(timeRegex);
		if (timeMatch) {
			cleanedTitle = cleanedTitle.replace(timeMatch[0], "");
		}
	}

	// Remove due date in various formats
	if (task.due) {
		const dueDateRegex =
			/\s*(📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::.*?\]|@due\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(dueDateRegex, "");
	}

	// Remove completion date in various formats
	if (task.completion) {
		const completionRegex =
			/\s*(✅\s*.*?(?=\s|$)|\[completion::.*?\]|@completion\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(completionRegex, "");
	}

	if (task.priority > 0) {
		let match = cleanedTitle.match(/\[priority::\s*(\d{1,2})\]/);
		if (match) {
			cleanedTitle = cleanedTitle.replace(match[0], "");
		}

		match = cleanedTitle.match(/@priority\(\s*(\d{1,2})\s*\)/);
		if (match) {
			cleanedTitle = cleanedTitle.replace(match[0], "");
		}

		const priorityIcon = priorityEmojis[task.priority];

		if (priorityIcon) {
			// Create a regex pattern to match any priority emoji in text
			const priorityRegex = new RegExp(
				`(${Object.values(priorityEmojis)
					.map((emoji) => `\\s*${emoji}\\s*`)
					.join("|")})`,
				"g"
			);

			// Replace the first valid priority emoji found
			cleanedTitle = cleanedTitle.replace(priorityRegex, (match) => {
				return match.trim() === priorityIcon ? "" : match;
			});
		}
	}

	// console.log("cleanedTitle", cleanedTitle.trim());

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};
