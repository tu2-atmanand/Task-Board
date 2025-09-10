// /src/utils/TaskNoteUtils.ts

import { taskItem, taskStatuses } from "src/interfaces/TaskItem";
import TaskBoard from "main";
import {
	readDataOfVaultFile,
	writeDataToVaultFile,
} from "./MarkdownFileOperations";
import {
	createFrontmatterFromTask,
	updateFrontmatterProperties,
	createYamlFromObject,
	customFrontmatterCache,
} from "./FrontmatterOperations";
import { FrontMatterCache } from "obsidian";

/**
 * Check if a note is a Task Note by looking for #taskNote tag in frontmatter
 * @param frontmatter - The frontmatter object from a file
 * @returns boolean - True if the note contains #taskNote tag
 */
export function isTaskNotePresentInFrontmatter(
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

	// Check for #taskNote tag (with or without #)
	return tags.some((tag) => tag === "taskNote" || tag === "#taskNote");
}

/**
 * Check if a note is a Task Note by looking for #taskNote tag in tags
 * @param tags - The tags array from a file
 * @returns boolean - True if the note contains #taskNote tag
 */
export function isTaskNotePresentInTags(tags: string[]): boolean {
	return tags.includes("taskNote") || tags.includes("#taskNote");
}

/**
 * Extract task note properties from frontmatter
 * @param frontmatter - The frontmatter object
 * @param filePath - The file path
 * @returns Partial taskItem with properties mapped from frontmatter
 */
export function extractTaskNoteProperties(
	frontmatter: any,
	filePath: string
): Partial<taskItem> {
	if (!frontmatter) {
		return {};
	}

	return {
		id: frontmatter.id || "",
		title: frontmatter.title || "",
		tags: frontmatter?.tags || [],
		createdDate: frontmatter["created-date"] || frontmatter?.created || "",
		startDate: frontmatter["start-date"] || frontmatter?.start || "",
		scheduledDate:
			frontmatter["schedule-date"] || frontmatter?.scheduled || "",
		due: frontmatter["due-date"] || frontmatter?.due || "",
		cancelledDate:
			frontmatter["cancelled-date"] || frontmatter?.cancelled || "",
		completion:
			frontmatter["completion-date"] || frontmatter?.completed || "",
		priority: mapPriorityFromFrontmatter(frontmatter?.priority),
		status: mapStatusFromFrontmatter(frontmatter?.status),
		dependsOn: frontmatter?.dependsOn || frontmatter?.depends_on || [],
		reminder: frontmatter?.reminder || "",
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
	task: taskItem,
	bodyContent: string
): string {
	console.log("formatTaskNoteContent called with:", task, bodyContent);
	try {
		const frontmatterMatch = bodyContent.match(/^---\n([\s\S]*?)\n---/);
		// No frontmatter exists, create new one
		const newFrontmatter = createFrontmatterFromTask(task);
		const contentWithoutFrontmatter = frontmatterMatch
			? bodyContent.replace(frontmatterMatch[0], "")
			: bodyContent;
		const newContent = `---\n${newFrontmatter}\n---${
			contentWithoutFrontmatter || ""
		}`;
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
export async function updateTaskNoteFrontmatter(
	plugin: TaskBoard,
	task: taskItem
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(task.filePath);
		if (!file) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		const fileContent = await readDataOfVaultFile(plugin, task.filePath);
		const existingFrontmatter =
			plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		// const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

		if (!existingFrontmatter) {
			// No frontmatter exists, create new one
			const newFrontmatter = createFrontmatterFromTask(task);
			const newContent = `---\n${newFrontmatter}\n---\n${fileContent}`;
			await writeDataToVaultFile(plugin, task.filePath, newContent);
			return;
		}

		// Parse existing frontmatter and update properties
		const updatedFrontmatter = updateFrontmatterProperties(
			existingFrontmatter,
			task
		);

		// Reconstruct the file content with updated frontmatter
		const frontmatterYaml = createYamlFromObject(updatedFrontmatter);
		const contentAfterFrontmatter = fileContent.replace(
			/^---\n[\s\S]*?\n---\n/,
			""
		);
		const newContent = `---\n${frontmatterYaml}\n---\n${contentAfterFrontmatter}`;

		await writeDataToVaultFile(plugin, task.filePath, newContent);
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
