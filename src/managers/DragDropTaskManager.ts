// /src/utils/DragDropTaskManager.ts

import { ColumnData } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { taskItem } from "src/interfaces/TaskItem";

/**
 * Updates the tags of a task when moved between columns of type "namedTag"
 * @param plugin TaskBoard plugin instance
 * @param task The task being moved
 * @param sourceColumn Source column data
 * @param targetColumn Target column data
 * @returns Updated task with modified tags
 */
export const updateTaskTagsForColumnMove = async (
	plugin: TaskBoard,
	task: taskItem,
	sourceColumn: ColumnData,
	targetColumn: ColumnData
): Promise<taskItem> => {
	// Only handle tag updates if both columns are of type "namedTag"
	if (
		sourceColumn.colType !== "namedTag" ||
		targetColumn.colType !== "namedTag"
	) {
		return task;
	}

	// Create a modified copy of the task
	const updatedTask: taskItem = { ...task };

	// Remove the source column tag if it exists
	if (sourceColumn.coltag) {
		const sourceTag = sourceColumn.coltag.startsWith("#")
			? sourceColumn.coltag
			: `#${sourceColumn.coltag}`;
		updatedTask.tags = updatedTask.tags.filter(
			(tag: string) => tag !== sourceTag
		);
	}

	// Add the target column tag if it doesn't exist
	if (targetColumn.coltag) {
		const targetTag = targetColumn.coltag.startsWith("#")
			? targetColumn.coltag
			: `#${targetColumn.coltag}`;
		// Make sure we don't have duplicates
		if (!updatedTask.tags.includes(targetTag)) {
			updatedTask.tags.push(targetTag);
		}
	}

	return updatedTask;
};

/**
 * Updates the task in the file after drag and drop
 * @param plugin TaskBoard plugin instance
 * @param updatedTask The modified task
 * @param originalTask The original task before modification
 */
export const updateTaskAfterDragDrop = async (
	plugin: TaskBoard,
	updatedTask: taskItem,
	originalTask: taskItem
): Promise<void> => {
	try {
		console.log("Updating task after drag and drop...");
		console.log("Updated Task:", updatedTask);
		console.log("Original Task:", originalTask);
		// // Update the task in tasks.json
		// await updateTaskInJson(plugin, updatedTask);

		// // Update the task in the markdown file
		// await updateTaskInMarkdownFile(plugin, updatedTask, originalTask);

		eventEmitter.emit("REFRESH_BOARD");
	} catch (error) {
		console.error("Error updating task after drag and drop:", error);
	}
};

// /**
//  * Updates a task in tasks.json
//  */
// const updateTaskInJson = async (
//     plugin: TaskBoard,
//     updatedTask: taskItem
// ): Promise<void> => {
//     try {
//         const allTasks = await loadTasksJsonFromDisk(plugin);

//         // Update in Pending tasks
//         if (allTasks.Pending[updatedTask.filePath]) {
//             allTasks.Pending[updatedTask.filePath] = allTasks.Pending[updatedTask.filePath].map(
//                 (task: taskItem) => task.id === updatedTask.id ? updatedTask : task
//             );
//         }

//         // Update in Completed tasks
//         if (allTasks.Completed[updatedTask.filePath]) {
//             allTasks.Completed[updatedTask.filePath] = allTasks.Completed[updatedTask.filePath].map(
//                 (task: taskItem) => task.id === updatedTask.id ? updatedTask : task
//             );
//         }

//         // Write changes back to disk
//         await writeTasksJsonToDisk(plugin, allTasks);
//     } catch (error) {
//         console.error("Error updating task in tasks.json:", error);
//         throw error;
//     }
// };

// /**
//  * Updates the task in the original markdown file
//  */
// const updateTaskInMarkdownFile = async (
//     plugin: TaskBoard,
//     updatedTask: taskItem,
//     originalTask: taskItem
// ): Promise<void> => {
//     try {
//         const filePath = updatedTask.filePath;
//         const fileContent = await readDataOfVaultFiles(plugin, filePath);

//         // Split content into lines
//         const lines = fileContent.split("\n");

//         const titleWithoutTags = originalTask.title.split('#')[0].trim();

//         // Find the task line by its core title content and checkbox
//         for (let i = 0; i < lines.length; i++) {
//             const line = lines[i];

//             // Check if this is the task line by looking for the checkbox pattern and the core title
//             if (line.match(/^- \[.{1}\]/) && line.includes(titleWithoutTags)) {
//                 // Update tags in this line
//                 const originalTags = originalTask.tags.map(tag =>
//                     tag.startsWith('#') ? tag : `#${tag}`
//                 );
//                 const updatedTags = updatedTask.tags.map(tag =>
//                     tag.startsWith('#') ? tag : `#${tag}`
//                 );

//                 let updatedLine = line;

//                 // Remove old tags from line
//                 originalTags.forEach(tag => {
//                     // Make sure we're removing the tag as a word, not part of another word
//                     const tagRegex = new RegExp(`\\s${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
//                     updatedLine = updatedLine.replace(tagRegex, ' ');
//                 });

//                 // Add new tags at the end
//                 updatedLine = updatedLine.trim();
//                 updatedTags.forEach(tag => {
//                     if (!updatedLine.includes(tag)) {
//                         updatedLine = `${updatedLine} ${tag}`;
//                     }
//                 });

//                 // Update the line in the array
//                 lines[i] = updatedLine;

//                 // Write the updated content back to the file
//                 await writeDataToVaultFiles(plugin, filePath, lines.join("\n"));
//                 return;
//             }
//         }

//         console.warn("Task not found in the markdown file");

//     } catch (error) {
//         console.error("Error updating task in markdown file:", error);
//         throw error;
//     }
// };

/**
 * Persists the new order of tasks in a column in tasks.json
 */
// export const updateTaskOrderInColumn = async (
//     plugin: TaskBoard,
//     columnData: any,
//     newOrderedTasks: any[]
// ): Promise<void> => {
//     try {
//         const allTasks = await loadTasksJsonFromDisk(plugin);
//         // We only support columns of type namedTag and Pending
//         if (columnData.colType === 'namedTag') {
//             // Find the filePath of the tasks (all must be from the same file)
//             if (newOrderedTasks.length === 0) return;
//             const filePath = newOrderedTasks[0].filePath;
//             if (allTasks.Pending[filePath]) {
//                 // Filter only the tasks in this column
//                 const idsInColumn = newOrderedTasks.map(t => t.id);
//                 // Maintain the order of tasks in the column and then those not in the column
//                 allTasks.Pending[filePath] = [
//                     ...newOrderedTasks,
//                     ...allTasks.Pending[filePath].filter(t => !idsInColumn.includes(t.id))
//                 ];
//                 await writeTasksJsonToDisk(plugin, allTasks);
//                 eventEmitter.emit("REFRESH_COLUMN");
//             }
//         }
//     } catch (error) {
//         console.error("Error updating task order in column:", error);
//     }
// };
