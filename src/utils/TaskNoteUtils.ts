// /src/utils/TaskNoteUtils.ts

import { taskItem, taskStatuses } from "src/interfaces/TaskItem";
import TaskBoard from "main";
import {
	updateFrontmatterProperties,
	customFrontmatterCache,
	extractFrontmatter,
	createYamlFromObject,
} from "./FrontmatterOperations";
import { resolve } from "path";
import {
	TASK_NOTE_FRONTMATTER_KEYS,
	TASK_NOTE_IDENTIFIER_TAG,
} from "src/types/uniqueIdentifiers";

/**
 * Check if a note is a Task Note by looking for TASK_NOTE_IDENTIFIER_TAG tag in frontmatter
 * @param frontmatter - The frontmatter object from a file
 * @returns boolean - True if the note contains TASK_NOTE_IDENTIFIER_TAG tag
 */
export function isTaskNotePresentInFrontmatter(
	plugin: TaskBoard,
	frontmatter: Partial<customFrontmatterCache> | undefined
): boolean {
	if (!frontmatter || !frontmatter.tags) {
		return false;
	}

	let tags: string[] = [];

	if (Array.isArray(frontmatter.tags)) {
		tags = frontmatter.tags.map((tag: any) => String(tag).trim());
	} else if (typeof frontmatter.tags === "string") {
		tags = frontmatter.tags.split(",").map((tag: string) => tag.trim());
	}

	console.log("isTaskNotePresentInFrontmatter - Tags extracted:", tags);

	// Check for TASK_NOTE_IDENTIFIER_TAG tag (with or without #)
	return tags.some((tag) =>
		tag.includes(plugin.settings.data.globalSettings.taskNoteIdentifierTag)
	);
}

/**
 * Check if a note is a Task Note by looking for #TASK_NOTE_IDENTIFIER_TAG tag in tags
 * @param tags - The tags array from a file
 * @returns boolean - True if the note contains #TASK_NOTE_IDENTIFIER_TAG tag
 */
export function isTaskNotePresentInTags(
	plugin: TaskBoard,
	tags: string[]
): boolean {
	console.log("isTaskNotePresentInTags - Tags provided:", tags);
	return tags
		? tags.some((tag) =>
				tag.includes(
					plugin.settings.data.globalSettings.taskNoteIdentifierTag
				)
		  )
		: false;
}

/**
 * Extract task note properties from frontmatter
 * @param frontmatter - The frontmatter object
 * @param filePath - The file path
 * @returns Partial taskItem with properties mapped from frontmatter
 */
export function extractTaskNoteProperties(
	frontmatter: Partial<customFrontmatterCache> | undefined,
	filePath: string
): Partial<taskItem> {
	if (!frontmatter) {
		return {};
	}

	return {
		id: frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.id] || "",
		title: frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.title] || "",
		tags: Array.isArray(frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.tags])
			? frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.tags]
			: typeof frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.tags] === "string"
			? frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.tags]
					.split(",")
					.map((tag: string) => tag.trim())
			: [],
		createdDate:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.createdDate] ||
			frontmatter?.created ||
			"",
		startDate:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.startDate] ||
			frontmatter?.start ||
			"",
		scheduledDate:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.scheduledDate] ||
			frontmatter?.scheduled ||
			"",
		due:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.dueDate] ||
			frontmatter?.due ||
			"",
		cancelledDate:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.cancelledDate] ||
			frontmatter?.cancelled ||
			"",
		completion:
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.completionDate] ||
			frontmatter?.completed ||
			"",
		priority: mapPriorityFromFrontmatter(
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.priority]
		),
		status: mapStatusFromFrontmatter(
			frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.status]
		),
		dependsOn: frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.dependsOn] || [],
		reminder: frontmatter?.[TASK_NOTE_FRONTMATTER_KEYS.reminder] || "",
		filePath: filePath,
	};
}

/**
 * Map priority emoji from frontmatter to priority number
 * @param priorityValue - Priority value from frontmatter
 * @returns number - Priority number (0-5)
 */
export function mapPriorityFromFrontmatter(priorityValue: any): number {
	if (!priorityValue) return 0;

	const priorityStr = String(priorityValue).trim();

	// Map emojis to priority numbers
	switch (priorityStr) {
		case "🔺":
			return 1; // Highest
		case "⏫":
			return 2; // High
		case "🔼":
			return 3; // Medium
		case "🔽":
			return 4; // Low
		case "⏬":
			return 5; // Lowest
		default:
			return 0; // None
	}
}

/**
 * Map status symbol from frontmatter to status string
 * @param statusValue - Status value from frontmatter
 * @returns string - Status symbol
 */
export function mapStatusFromFrontmatter(
	statusValue: string | undefined
): string {
	if (!statusValue) return " ";

	const statusStr = String(statusValue).trim();

	// Handle both symbol and name formats
	if (
		Object.prototype.hasOwnProperty.call(
			taskStatuses,
			statusStr.toLowerCase()
		)
	) {
		return (taskStatuses as Record<string, string>)[
			statusStr.toLowerCase()
		];
	}
	return " ";
}

export function formatTaskNoteContent(
	plugin: TaskBoard,
	task: taskItem,
	bodyContent: string
): string {
	console.log("formatTaskNoteContent called with:", task, bodyContent);
	try {
		const frontmatterMatch = bodyContent.match(/^---\n([\s\S]*?)\n---/);
		// No frontmatter exists, create new one
		const newFrontmatter = createFrontmatterFromTask(plugin, task);
		const contentWithoutFrontmatter = frontmatterMatch
			? bodyContent.replace(frontmatterMatch[0], "")
			: bodyContent;
		const newContent = `---\n${newFrontmatter}---${
			contentWithoutFrontmatter || ""
		}`; // I hope the content returned from the stringifyYaml API will always have a newline at the end.
		return newContent;
	} catch (error) {
		console.error("Error updating task note frontmatter:", error);
		throw error;
	}
}

/**
 * Update frontmatter properties from task item
 * @param plugin - TaskBoard plugin instance
 * @param task - Task item with updated properties
 * @returns Promise<void>
 */
export async function updateFrontmatterInMarkdownFile(
	plugin: TaskBoard,
	task: taskItem
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(task.filePath);
		if (!file) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		// Method 1 - Using Obsidian's filemanager API.
		await plugin.app.fileManager.processFrontMatter(file, (existing) => {
			const updated = updateFrontmatterProperties(plugin, existing, task);
			for (const key of Object.keys(updated)) {
				existing[key] = updated[key];
			}
		});

		return;

		// METHOD 2 - Using custom logic

		// const fileContent = await readDataOfVaultFile(plugin, task.filePath);
		// const existingFrontmatter =
		// 	plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		// // const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

		// if (!existingFrontmatter) {
		// 	// No frontmatter exists, create new one
		// 	const newFrontmatter = createFrontmatterFromTask(plugin, task);
		// 	const newContent = `---\n${newFrontmatter}\n---\n${fileContent}`;
		// 	await writeDataToVaultFile(plugin, task.filePath, newContent);
		// 	return;
		// }

		// // Parse existing frontmatter and update properties
		// const updatedFrontmatter = updateFrontmatterProperties(
		// 	plugin,
		// 	existingFrontmatter,
		// 	task
		// );

		// // Reconstruct the file content with updated frontmatter
		// const frontmatterYaml = createYamlFromObject(updatedFrontmatter);
		// const contentAfterFrontmatter = fileContent.replace(
		// 	/^---\n[\s\S]*?\n---\n/,
		// 	""
		// );
		// const newContent = `---\n${frontmatterYaml}\n---\n${contentAfterFrontmatter}`;

		// await writeDataToVaultFile(plugin, task.filePath, newContent);
	} catch (error) {
		console.error("Error updating task note frontmatter:", error);
		throw error;
	}
}

/**
 * Get priority emoji from priority number
 * @param priority - Priority number (1-5)
 * @returns string - Priority emoji
 */
// function getPriorityEmoji(priority: number): string {
// 	const priorityEmojis: { [key: number]: string } = {
// 		1: "🔺", // Highest
// 		2: "⏫", // High
// 		3: "🔼", // Medium
// 		4: "🔽", // Low
// 		5: "⏬", // Lowest
// 	};
// 	return priorityEmojis[priority] || "";
// }
