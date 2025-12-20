import TaskBoard from "main";
import { Notice } from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import { colType } from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";
import { updateTaskItemTags } from "src/utils/UserTaskEvents";

/**
 * DragDropTasksManager - A singleton manager class that handles drag and drop functionality
 * for task items between columns in the Kanban board view.
 */
class DragDropTasksManager {
	private static instance: DragDropTasksManager;

	// Hold the current drag payload so dragover handlers can access it reliably
	private currentDragData: any | null = null;
	private plugin: TaskBoard | null = null;

	private constructor() {
		// Private constructor to enforce singleton pattern
	}

	/**
	 * Gets the singleton instance of DragDropTasksManager
	 * @returns {DragDropTasksManager} The singleton instance
	 */
	static getInstance(): DragDropTasksManager {
		if (!DragDropTasksManager.instance) {
			DragDropTasksManager.instance = new DragDropTasksManager();
		}
		return DragDropTasksManager.instance;
	}

	/**
	 * Set the plugin instance for use in drag/drop operations
	 * Should be called once during plugin initialization
	 */
	setPlugin(plugin: TaskBoard): void {
		this.plugin = plugin;
	}

	/**
	 * Dims the dragged task item in the sourceColumnContainer to provide visual feedback
	 * This also helps when the drop operation has failed and in this case the sourceContainer is not refreshed unnecessarily. Only the dim effect is removed.
	 *
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element
	 */
	dimDraggedTaskItem(draggedTaskItem: HTMLDivElement): void {
		draggedTaskItem.classList.add("task-item-dragging-dimmed");
	}

	/**
	 * Removes the dim effect from the dragged task item
	 *
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element
	 */
	removeDimFromDraggedTaskItem(draggedTaskItem: HTMLDivElement): void {
		draggedTaskItem.classList.remove("task-item-dragging-dimmed");
	}

	/**
	 * Clears all drag-related styling from all task items and columns
	 *
	 * @param {HTMLDivElement[]} allColumnContainers - Array of all column DOM containers
	 */
	clearAllDragStyling(allColumnContainers: HTMLDivElement[]): void {
		allColumnContainers.forEach((container) => {
			container.classList.remove(
				"drag-over-allowed",
				"drag-over-not-allowed"
			);
		});
		// Also clear dimming from all task items
		const allTaskItems = Array.from(
			document.querySelectorAll(".taskItem")
		) as HTMLDivElement[];
		allTaskItems.forEach((item) => {
			item.classList.remove("task-item-dragging-dimmed");
		});
	}

	/**
	 * Checks if a task is allowed to be dropped in the target column
	 * Rules:
	 * - If source and target column types are the same, allow drop
	 * - If target column type is 'completed', allow drop
	 *
	 * @param {ColumnData} sourceColumnData - The source column data
	 * @param {ColumnData} targetColumnData - The target column data
	 * @returns {boolean} True if drop is allowed, false otherwise
	 */
	isTaskDropAllowed(
		sourceColumnData: ColumnData,
		targetColumnData: ColumnData
	): boolean {
		// Allow drop if source and target column types are the same
		if (sourceColumnData.colType === targetColumnData.colType) {
			return true;
		}

		// Allow drop if target column type is 'completed'
		if (targetColumnData.colType === "completed") {
			return true;
		}

		// Otherwise, drop is not allowed
		return false;
	}

	/**
	 * Store current drag payload (called from dragstart)
	 */
	setCurrentDragData(data: any) {
		this.currentDragData = data;
	}

	/**
	 * Read current drag payload
	 */
	getCurrentDragData() {
		return this.currentDragData;
	}

	/**
	 * Clear current drag payload (called from dragend / drop)
	 */
	clearCurrentDragData() {
		this.currentDragData = null;
	}

	/**
	 * Updates the tags of a task when moved between columns of type colType.namedTag
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 * @returns Updated task with modified tags
	 */
	handleTaskMove_namedTag_to_namedTag = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		// Create a modified copy of the task
		// const updatedTask: taskItem = { ...task };
		let newTags: string[] = task.tags;

		// Remove the source column tag if it exists
		if (sourceColumn.coltag) {
			const sourceTag = sourceColumn.coltag;
			newTags = task.tags.filter(
				(tag: string) =>
					tag.replace("#", "") !== sourceTag.replace("#", "")
			);
		}

		// Add the target column tag if it doesn't exist
		if (targetColumn.coltag) {
			const targetTag = targetColumn.coltag.startsWith("#")
				? targetColumn.coltag
				: `#${targetColumn.coltag}`;
			// Make sure we don't have duplicates
			if (!task.tags.includes(targetTag)) {
				newTags.push(targetTag);
			}
		}

		// Before updating the task, first check if this target column has "manualOrder" sorting criteria.
		// If yes, we need to update the tasksIdManualOrder array to include this task's id whereever user has dropped it.
		// This will ensure that the task appears in the correct order in the target column after the move.
		if (
			targetColumn?.sortCriteria && targetColumn.sortCriteria.length > 0 &&
			targetColumn.sortCriteria[0].criteria === "manualOrder"
		) {
			// Update tasksIdManualOrder array
			if (!targetColumn.tasksIdManualOrder) {
				targetColumn.tasksIdManualOrder = [];
			}
			// Add the task id to the end of the manual order array
			if (!targetColumn.tasksIdManualOrder.includes(task.id)) {
				targetColumn.tasksIdManualOrder.push(task.id);
			}
		}

		// Finally, update the task in the note which will refresh the view.
		updateTaskItemTags(plugin, task, newTags);
	};

	/**
	 * Updates the date of a task when moved between dated columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 */
	handleTaskMove_dated_to_dated = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemDate } = await import('src/utils/UserTaskEvents');
		
		// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
		const dateType = (sourceColumn.datedBasedColumn?.dateType as 'startDate' | 'scheduledDate' | 'due') || 'due';
		const currentDate = (task as any)[dateType] || '';
		
		// For dated columns, we'll keep the same date from source
		if (currentDate) {
			updateTaskItemDate(plugin, task, dateType, currentDate);
		}
	};

	/**
	 * Updates the priority of a task when moved between priority columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 */
	handleTaskMove_priority_to_priority = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemPriority } = await import('src/utils/UserTaskEvents');
		
		// Extract the priority value from the source column
		const sourcePriority = (sourceColumn.taskPriority as number) || 0;
		
		updateTaskItemPriority(plugin, task, sourcePriority);
	};

	/**
	 * Updates the status of a task when moved between status columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 */
	handleTaskMove_status_to_status = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import('src/utils/UserTaskEvents');
		
		// Extract the status value from the source column
		const sourceStatus = (sourceColumn.taskStatus as string) || '';
		
		if (sourceStatus) {
			updateTaskItemStatus(plugin, task, sourceStatus);
		}
	};

	/**
	 * Marks a task as completed when moved to the completed column
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data (completed column)
	 */
	handleTaskMove_to_completed = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import('src/utils/UserTaskEvents');
		
		// Mark task as completed - typically with status symbol 'x'
		const completedStatus = 'x';
		
		updateTaskItemStatus(plugin, task, completedStatus);
	};

	/**
	 * Adds a date to a task when moved to a dated column from a different column type
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target dated column data
	 */
	handleTaskMove_to_dated = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemDate } = await import('src/utils/UserTaskEvents');
		
		// Determine which date type the target column uses
		const dateType = (targetColumn.datedBasedColumn?.dateType as 'startDate' | 'scheduledDate' | 'due') || 'due';
		
		// Use today's date if no date is currently set
		const today = new Date().toISOString().split('T')[0];
		const dateToSet = (task as any)[dateType] || today;
		
		updateTaskItemDate(plugin, task, dateType, dateToSet);
	};

	/**
	 * Adds a tag to a task when moved to a namedTag column from a different column type
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target namedTag column data
	 */
	handleTaskMove_to_namedTag = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		let newTags: string[] = [...task.tags];
		
		// Add the target column tag if it doesn't already exist
		if (targetColumn.coltag) {
			const targetTag = targetColumn.coltag.startsWith("#")
				? targetColumn.coltag
				: `#${targetColumn.coltag}`;
			
			if (!newTags.includes(targetTag)) {
				newTags.push(targetTag);
			}
		}
		
		updateTaskItemTags(plugin, task, newTags);
	};

	/**
	 * Sets the priority of a task when moved to a priority column from a different column type
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target priority column data
	 */
	handleTaskMove_to_priority = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemPriority } = await import('src/utils/UserTaskEvents');
		
		// Extract the priority value from the target column
		const targetPriority = (targetColumn.taskPriority as number) || 0;
		
		updateTaskItemPriority(plugin, task, targetPriority);
	};

	/**
	 * Sets the status of a task when moved to a status column from a different column type
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target status column data
	 */
	handleTaskMove_to_status = async (
		plugin: TaskBoard,
		task: taskItem,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import('src/utils/UserTaskEvents');
		
		// Extract the status value from the target column
		const targetStatus = (targetColumn.taskStatus as string) || '';
		
		if (targetStatus) {
			updateTaskItemStatus(plugin, task, targetStatus);
		}
	};

	/**
	 * Handles reordering of tasks within the same column with manualOrder sorting
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param column The column data with manualOrder sorting
	 */
	handleTasksOrderChange = (
		plugin: TaskBoard,
		task: taskItem,
		column: ColumnData
	): void => {
		// This operation is handled by the Column component's drag handlers
		// The Column component manages the local state reordering and updates tasksIdManualOrder
		// This is a placeholder to maintain consistency with the blueprint pattern
		console.log("Task order change handled by Column component for task:", task.id);
	};

	/**
	 * Handles the drag over event and applies CSS styling to the target column container
	 * based on whether the task is allowed to be dropped
	 *
	 * @param {DragEvent} e - The drag event object
	 * @param {ColumnData} sourceColumnData - The source column data
	 * @param {HTMLDivElement} sourceColumnContainer - The source column DOM container
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	handleDragOver(
		e: DragEvent,
		sourceColumnData: ColumnData,
		sourceColumnContainer: HTMLDivElement,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement
	): void {
		e.preventDefault();

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(
			sourceColumnData,
			targetColumnData
		);
		console.log("isDropAllowed", isDropAllowed);

		if (isDropAllowed) {
			// Apply CSS styling for allowed drop
			targetColumnContainer.classList.add("drag-over-allowed");
			targetColumnContainer.classList.remove("drag-over-not-allowed");
			e.dataTransfer!.dropEffect = "move";
		} else {
			// Apply CSS styling for not allowed drop
			targetColumnContainer.classList.add("drag-over-not-allowed");
			targetColumnContainer.classList.remove("drag-over-allowed");
			e.dataTransfer!.dropEffect = "none";
		}
	}

	/**
	 * Handles the drop event and performs required operations to update task properties
	 * based on source and target column data
	 *
	 * @param {DragEvent} e - The drop event object
	 * @param {ColumnData} sourceColumnData - The source column data
	 * @param {HTMLDivElement} sourceColumnContainer - The source column DOM container
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	handleDrop(
		e: DragEvent,
		sourceColumnData: ColumnData,
		sourceColumnContainer: HTMLDivElement,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement
	): void {
		e.preventDefault();

		// Remove drag-over styling from target
		targetColumnContainer.classList.remove(
			"drag-over-allowed",
			"drag-over-not-allowed"
		);

		// Remove dim from source column
		sourceColumnContainer.classList.remove("drag-source-dimmed");

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(
			sourceColumnData,
			targetColumnData
		);

		if (!isDropAllowed) {
			console.warn(
				"Task drop not allowed from column:",
				sourceColumnData.name,
				"to column:",
				targetColumnData.name
			);
			new Notice(
				`Task drop not allowed from column: ${sourceColumnData.name} to column: ${targetColumnData.name}`
			);
			return;
		}

		// Perform required operations to update task properties
		// This is where the actual task update logic will be implemented
		console.log("Task drop allowed. Updating task properties...");
		console.log("Source column:", sourceColumnData);
		console.log("Target column:", targetColumnData);

		if (targetColumnData.colType === sourceColumnData.colType) {
			if (targetColumnData.id === sourceColumnData.id) {
				// This means user wants to change the order of the tasks in the same column
				// But we need to check first if this column has sorting.criteria = "manualOrder".
				// If not will show a notice.
				if (
					sourceColumnData?.sortCriteria && sourceColumnData.sortCriteria.length > 0 &&
					sourceColumnData.sortCriteria[0].criteria === "manualOrder"
				) {
					this.handleTasksOrderChange(
						this.plugin!,
						this.currentDragData,
						sourceColumnData
					);
				} else {
					new Notice(
						"This current column doesnt have sorting criteria set to 'manualOrder'. You can't change the order of tasks in this column."
					);
				}
			} else if (targetColumnData.colType === colType.namedTag) {
				this.handleTaskMove_namedTag_to_namedTag(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData
				);
			} else if (targetColumnData.colType === colType.dated) {
				this.handleTaskMove_dated_to_dated(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData
				);
			} else if (targetColumnData.colType === colType.taskPriority) {
				this.handleTaskMove_priority_to_priority(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData
				);
			} else if (targetColumnData.colType === colType.taskStatus) {
				this.handleTaskMove_status_to_status(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData
				);
			} else {
				new Notice(
					"This operation is not possible in the current version. Please request this idea to the developer."
				);
			}
		} else if (targetColumnData.colType === colType.completed) {
			// This means user is moving task to completed column from any other type of column.
			// This operation should basically mark the task as completed
			this.handleTaskMove_to_completed(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData
			);
		} else if (targetColumnData.colType === colType.dated) {
			// This means user is moving task to a dated column from any other type of column.
			// This operation should basically add a date property to the task based on the target column's dateType
			this.handleTaskMove_to_dated(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData
			);
		} else if (targetColumnData.colType === colType.namedTag) {
			// This means user is moving task to a namedTag column from any other type of column.
			// This operation should basically add the target column's tag to the task
			this.handleTaskMove_to_namedTag(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData
			);
		} else if (targetColumnData.colType === colType.taskPriority) {
			// This means user is moving task to a priority column from any other type of column.
			// This operation should basically update the task's priority based on the target column's taskPriority
			this.handleTaskMove_to_priority(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData
			);
		} else if (targetColumnData.colType === colType.taskStatus) {
			// This means user is moving task to a status column from any other type of column.
			// This operation should basically update the task's status based on the target column's taskStatus
			this.handleTaskMove_to_status(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData
			);
		} else {
			new Notice(
				"This operation is not possible in the current version. Please request this idea to the developer."
			);
		}
	}
}

// Export the singleton instance for easy access
export const dragDropTasksManagerInsatance = DragDropTasksManager.getInstance();
