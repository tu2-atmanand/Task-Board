// /src/utils/TaskNoteUtils.ts

import { TFile, App } from "obsidian";
import { taskItem } from "src/interfaces/TaskItem";
import TaskBoard from "main";
import { extractFrontmatter } from "./ScanningVault";
import { readDataOfVaultFiles, writeDataToVaultFiles } from "./MarkdownFileOperations";

/**
 * Check if a note is a Task Note by looking for #taskNote tag in frontmatter
 * @param frontmatter - The frontmatter object from a file
 * @returns boolean - True if the note contains #taskNote tag
 */
export function isTaskNote(frontmatter: any): boolean {
	if (!frontmatter || !frontmatter.tags) {
		return false;
	}

	let tags: string[] = [];
	
	if (Array.isArray(frontmatter.tags)) {
		tags = frontmatter.tags.map((tag: any) => String(tag).trim());
	} else if (typeof frontmatter.tags === "string") {
		tags = frontmatter.tags.split(",").map((tag: string) => tag.trim());
	}

	// Check for #taskNote tag (with or without #)
	return tags.some(tag => 
		tag === "taskNote" || tag === "#taskNote"
	);
}

/**
 * Extract task note properties from frontmatter
 * @param frontmatter - The frontmatter object
 * @param filePath - The file path
 * @returns Partial taskItem with properties mapped from frontmatter
 */
export function extractTaskNoteProperties(frontmatter: any, filePath: string): Partial<taskItem> {
	if (!frontmatter) {
		return {};
	}

	return {
		title: frontmatter.title || "",
		description: frontmatter.description || "",
		createdDate: frontmatter["created-date"] || frontmatter.created || "",
		startDate: frontmatter["start-date"] || frontmatter.start || "",
		scheduledDate: frontmatter["schedule-date"] || frontmatter.scheduled || "",
		due: frontmatter["due-date"] || frontmatter.due || "",
		cancelledDate: frontmatter["cancelled-date"] || frontmatter.cancelled || "",
		completion: frontmatter["completion-date"] || frontmatter.completed || "",
		priority: mapPriorityFromFrontmatter(frontmatter.priority),
		status: mapStatusFromFrontmatter(frontmatter.status),
		reminder: frontmatter.reminder || "",
		isTaskNote: true,
		filePath: filePath
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
		case "🔺": return 1; // Highest
		case "⏫": return 2; // High
		case "🔼": return 3; // Medium
		case "🔽": return 4; // Low
		case "⏬": return 5; // Lowest
		default: return 0;  // None
	}
}

/**
 * Map status symbol from frontmatter to status string
 * @param statusValue - Status value from frontmatter
 * @returns string - Status symbol
 */
export function mapStatusFromFrontmatter(statusValue: any): string {
	if (!statusValue) return " ";
	
	const statusStr = String(statusValue).trim();
	
	// Handle both symbol and name formats
	const statusMap: { [key: string]: string } = {
		// Symbols
		" ": " ",
		"x": "x",
		"X": "X",
		"-": "-",
		">": ">",
		"<": "<",
		"D": "D",
		"?": "?",
		"/": "/",
		// Names (lowercase)
		"unchecked": " ",
		"completed": "x",
		"checked": "X",
		"dropped": "-",
		"forward": ">",
		"migrated": "<",
		"date": "D",
		"question": "?",
		"in progress": "/",
		"half-done": "/",
	};
	
	return statusMap[statusStr.toLowerCase()] || statusStr;
}

/**
 * Update frontmatter properties from task item
 * @param plugin - TaskBoard plugin instance
 * @param task - Task item with updated properties
 * @returns Promise<void>
 */
export async function updateTaskNoteFrontmatter(plugin: TaskBoard, task: taskItem): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(task.filePath);
		if (!file) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		const fileContent = await readDataOfVaultFiles(plugin, task.filePath);
		const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
		
		if (!frontmatterMatch) {
			// No frontmatter exists, create new one
			const newFrontmatter = createFrontmatterFromTask(task);
			const newContent = `---\n${newFrontmatter}\n---\n\n${fileContent}`;
			await writeDataToVaultFiles(plugin, task.filePath, newContent);
			return;
		}

		// Parse existing frontmatter and update properties
		const existingFrontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter || {};
		const updatedFrontmatter = updateFrontmatterProperties(existingFrontmatter, task);
		
		// Reconstruct the file content with updated frontmatter
		const frontmatterYaml = createYamlFromObject(updatedFrontmatter);
		const contentAfterFrontmatter = fileContent.replace(/^---\n[\s\S]*?\n---\n/, "");
		const newContent = `---\n${frontmatterYaml}\n---\n${contentAfterFrontmatter}`;
		
		await writeDataToVaultFiles(plugin, task.filePath, newContent);
	} catch (error) {
		console.error("Error updating task note frontmatter:", error);
		throw error;
	}
}

/**
 * Create frontmatter YAML string from task item
 * @param task - Task item
 * @returns string - YAML frontmatter content
 */
function createFrontmatterFromTask(task: taskItem): string {
	const frontmatterObj: any = {
		tags: ["taskNote"],
	};

	if (task.title) frontmatterObj.title = task.title;
	if (task.description) frontmatterObj.description = task.description;
	if (task.createdDate) frontmatterObj["created-date"] = task.createdDate;
	if (task.startDate) frontmatterObj["start-date"] = task.startDate;
	if (task.scheduledDate) frontmatterObj["schedule-date"] = task.scheduledDate;
	if (task.due) frontmatterObj["due-date"] = task.due;
	if (task.cancelledDate) frontmatterObj["cancelled-date"] = task.cancelledDate;
	if (task.completion) frontmatterObj["completion-date"] = task.completion;
	if (task.priority && task.priority > 0) {
		frontmatterObj.priority = getPriorityEmoji(task.priority);
	}
	if (task.status && task.status !== " ") {
		frontmatterObj.status = task.status;
	}
	if (task.reminder) frontmatterObj.reminder = task.reminder;

	return createYamlFromObject(frontmatterObj);
}

/**
 * Update existing frontmatter object with task properties
 * @param existingFrontmatter - Existing frontmatter object
 * @param task - Task item with updated properties
 * @returns object - Updated frontmatter object
 */
function updateFrontmatterProperties(existingFrontmatter: any, task: taskItem): any {
	const updated = { ...existingFrontmatter };

	// Ensure taskNote tag exists
	if (!updated.tags) {
		updated.tags = ["taskNote"];
	} else if (Array.isArray(updated.tags)) {
		if (!updated.tags.some((tag: string) => tag === "taskNote" || tag === "#taskNote")) {
			updated.tags.push("taskNote");
		}
	}

	// Update properties
	if (task.title !== undefined) updated.title = task.title;
	if (task.description !== undefined) updated.description = task.description;
	if (task.createdDate !== undefined) updated["created-date"] = task.createdDate;
	if (task.startDate !== undefined) updated["start-date"] = task.startDate;
	if (task.scheduledDate !== undefined) updated["schedule-date"] = task.scheduledDate;
	if (task.due !== undefined) updated["due-date"] = task.due;
	if (task.cancelledDate !== undefined) updated["cancelled-date"] = task.cancelledDate;
	if (task.completion !== undefined) updated["completion-date"] = task.completion;
	if (task.priority !== undefined) {
		if (task.priority > 0) {
			updated.priority = getPriorityEmoji(task.priority);
		} else {
			delete updated.priority;
		}
	}
	if (task.status !== undefined && task.status !== " ") {
		updated.status = task.status;
	} else if (task.status === " ") {
		delete updated.status;
	}
	if (task.reminder !== undefined) {
		if (task.reminder) {
			updated.reminder = task.reminder;
		} else {
			delete updated.reminder;
		}
	}

	return updated;
}

/**
 * Get priority emoji from priority number
 * @param priority - Priority number (1-5)
 * @returns string - Priority emoji
 */
function getPriorityEmoji(priority: number): string {
	const priorityEmojis: { [key: number]: string } = {
		1: "🔺", // Highest
		2: "⏫", // High  
		3: "🔼", // Medium
		4: "🔽", // Low
		5: "⏬", // Lowest
	};
	return priorityEmojis[priority] || "";
}

/**
 * Create YAML string from object (simple implementation)
 * @param obj - Object to convert to YAML
 * @returns string - YAML string
 */
function createYamlFromObject(obj: any): string {
	const lines: string[] = [];
	
	for (const [key, value] of Object.entries(obj)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${item}`);
			}
		} else if (typeof value === "string") {
			// Escape quotes and handle multiline
			const escapedValue = value.includes("\n") || value.includes('"') 
				? `"${value.replace(/"/g, '\\"')}"` 
				: value;
			lines.push(`${key}: ${escapedValue}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	
	return lines.join("\n");
}