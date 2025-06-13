// /src/utils/DragDropTaskManager.ts

import { ColumnData } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { taskItem } from "src/interfaces/TaskItemProps";
import { loadTasksJsonFromDisk, writeTasksJsonToDisk } from "./JsonFileOperations";
import { readDataOfVaultFiles, writeDataToVaultFiles } from "./MarkdownFileOperations";

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
    // Only handle tag updates if target column is of type "namedTag"
    // Source column can be any type (including "untagged")
    if (targetColumn.colType !== "namedTag") {
        return task;
    }

    // Create a modified copy of the task
    const updatedTask: taskItem = { ...task };    // Remove the source column tag if it exists and if source column is of type "namedTag"
    if (sourceColumn.colType === "namedTag" && sourceColumn.coltag) {
        let sourceTag = sourceColumn.coltag.startsWith('#') ? sourceColumn.coltag : `#${sourceColumn.coltag}`;
        
        // If the source column tag ends with '/', we need to handle the special matching logic
        // This matches the logic in RenderColumns.ts where tags ending with '/' are treated specially
        if (sourceTag.endsWith('/')) {
            const tagWithoutSlash = sourceTag.slice(0, -1);
            // Remove tags that match exactly without '/' OR that start with the tag with '/'
            updatedTask.tags = updatedTask.tags.filter(tag => 
                tag !== tagWithoutSlash && !tag.startsWith(sourceTag)
            );
        } else {
            // Standard exact match removal
            updatedTask.tags = updatedTask.tags.filter(tag => tag !== sourceTag);        }
    }

    // Add the target column tag if it doesn't exist
    if (targetColumn.coltag) {
        let targetTag = targetColumn.coltag.startsWith('#') ? targetColumn.coltag : `#${targetColumn.coltag}`;
        
        // If the target column tag ends with '/', we should add the tag WITHOUT the '/'
        // This matches the logic in RenderColumns.ts where tags ending with '/' are treated specially
        if (targetTag.endsWith('/')) {
            targetTag = targetTag.slice(0, -1);
        }
        
        // Make sure we don't have duplicates
        if (!updatedTask.tags.includes(targetTag)) {
            updatedTask.tags.push(targetTag);
        }
    }

    return updatedTask;
};

/**
 * Updates the task in both the tasks.json file and the original markdown file
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
        // Update the task in tasks.json
        await updateTaskInJson(plugin, updatedTask);
        
        // Update the task in the markdown file
        await updateTaskInMarkdownFile(plugin, updatedTask, originalTask);
    
        eventEmitter.emit("REFRESH_BOARD");
    } catch (error) {
        console.error("Error updating task after drag and drop:", error);
    }
};

/**
 * Updates a task in tasks.json
 */
const updateTaskInJson = async (
    plugin: TaskBoard,
    updatedTask: taskItem
): Promise<void> => {
    try {
        const allTasks = await loadTasksJsonFromDisk(plugin);

        // Update in Pending tasks
        if (allTasks.Pending[updatedTask.filePath]) {
            allTasks.Pending[updatedTask.filePath] = allTasks.Pending[updatedTask.filePath].map(
                (task: taskItem) => task.id === updatedTask.id ? updatedTask : task
            );
        }

        // Update in Completed tasks
        if (allTasks.Completed[updatedTask.filePath]) {
            allTasks.Completed[updatedTask.filePath] = allTasks.Completed[updatedTask.filePath].map(
                (task: taskItem) => task.id === updatedTask.id ? updatedTask : task
            );
        }

        // Write changes back to disk
        await writeTasksJsonToDisk(plugin, allTasks);
    } catch (error) {
        console.error("Error updating task in tasks.json:", error);
        throw error;
    }
};

/**
 * Updates the task in the original markdown file
 */
const updateTaskInMarkdownFile = async (
    plugin: TaskBoard,
    updatedTask: taskItem,
    originalTask: taskItem
): Promise<void> => {
    try {
        const filePath = updatedTask.filePath;
        const fileContent = await readDataOfVaultFiles(plugin, filePath);
        
        // Split content into lines
        const lines = fileContent.split("\n");

        const titleWithoutTags = originalTask.title.split('#')[0].trim();
        
        // Find the task line by its core title content and checkbox 
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this is the task line by looking for the checkbox pattern and the core title
            if (line.match(/^- \[.{1}\]/) && line.includes(titleWithoutTags)) {
                // Update tags in this line
                const originalTags = originalTask.tags.map(tag => 
                    tag.startsWith('#') ? tag : `#${tag}`
                );
                const updatedTags = updatedTask.tags.map(tag => 
                    tag.startsWith('#') ? tag : `#${tag}`
                );
                
                let updatedLine = line;
                
                // Remove old tags from line
                originalTags.forEach(tag => {
                    // Make sure we're removing the tag as a word, not part of another word
                    const tagRegex = new RegExp(`\\s${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
                    updatedLine = updatedLine.replace(tagRegex, ' ');
                });
                
                // Add new tags at the end
                updatedLine = updatedLine.trim();
                updatedTags.forEach(tag => {
                    if (!updatedLine.includes(tag)) {
                        updatedLine = `${updatedLine} ${tag}`;
                    }
                });
                
                // Update the line in the array
                lines[i] = updatedLine;
                
                // Write the updated content back to the file
                await writeDataToVaultFiles(plugin, filePath, lines.join("\n"));
                return;
            }
        }
        
        console.warn("Task not found in the markdown file");
        
    } catch (error) {
        console.error("Error updating task in markdown file:", error);
        throw error;
    }
};

/**
 * Persists the new order of tasks in a column in tasks.json
 */
export const updateTaskOrderInColumn = async (
    plugin: TaskBoard,
    columnData: any,
    newOrderedTasks: any[]
): Promise<void> => {
    try {
        const allTasks = await loadTasksJsonFromDisk(plugin);
        // We only support columns of type namedTag and Pending
        if (columnData.colType === 'namedTag') {
            if (newOrderedTasks.length === 0) return;
            
            // Group tasks by their file paths
            const tasksByFilePath: { [filePath: string]: taskItem[] } = {};
            
            // Collect all task IDs by filePath for tracking
            const taskIdsByFilePath: { [filePath: string]: number[] } = {};
            
            // Organize ordered tasks by file path
            newOrderedTasks.forEach(task => {
                if (!tasksByFilePath[task.filePath]) {
                    tasksByFilePath[task.filePath] = [];
                    taskIdsByFilePath[task.filePath] = [];
                }
                tasksByFilePath[task.filePath].push(task);
                taskIdsByFilePath[task.filePath].push(task.id);
            });
            
            // Now update each file's tasks while preserving the order within the file
            Object.keys(tasksByFilePath).forEach(filePath => {
                if (allTasks.Pending[filePath]) {
                    // For each filePath, maintain the order of tasks from newOrderedTasks
                    // and then include those not in the reordered tasks
                    allTasks.Pending[filePath] = [
                        ...tasksByFilePath[filePath],
                        ...allTasks.Pending[filePath].filter(t => !taskIdsByFilePath[filePath].includes(t.id))
                    ];
                }
            });
            
            await writeTasksJsonToDisk(plugin, allTasks);
            eventEmitter.emit("REFRESH_COLUMN");
        }
    } catch (error) {
        console.error("Error updating task order in column:", error);
    }
};