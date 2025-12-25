import TaskBoard from "main";
import { Notice } from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import { colType } from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";
import { updateTaskItemTags } from "src/utils/UserTaskEvents";
import { eventEmitter } from "src/services/EventEmitter";

export interface currentDragDataPayload {
	task: taskItem;
	sourceColumnData: ColumnData;
	currentBoardIndex: number;
}

/**
 * DragDropTasksManager - A singleton manager class that handles drag and drop functionality
 * for task items between columns in the Kanban board view.
 */
class DragDropTasksManager {
	private static instance: DragDropTasksManager;

	// Hold the current drag payload so dragover handlers can access it reliably
	private currentDragData: currentDragDataPayload | null = null;
	private desiredDropIndex: number | null = null;
	private dropIndicator: HTMLElement | null = null;
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
	 */
	clearAllDragStyling(): void {
		const allColumnContainers = Array.from(
			document.querySelectorAll(".TaskBoardColumnsSection")
		) as HTMLDivElement[];
		allColumnContainers.forEach((container) => {
			container.classList.remove(
				"drag-over-allowed",
				"drag-over-not-allowed"
			);
		});

		// TODO : This feels like overkill, because I am only dimming the single .taskItem which I will be dragging. Optimize later.
		// Also clear dimming from all task items
		// const allTaskItems = Array.from(
		// 	document.querySelectorAll(".taskItem")
		// ) as HTMLDivElement[];
		// allTaskItems.forEach((item) => {
		// 	item.classList.remove("task-item-dragging-dimmed");
		// });
	}

	setDesiredDropIndex(index: number | null) {
		this.desiredDropIndex = index;
	}

	getDesiredDropIndex(): number | null {
		return this.desiredDropIndex;
	}

	clearDesiredDropIndex() {
		this.desiredDropIndex = null;
	}

	/**
	 * Store current drag payload (called from dragstart)
	 */
	setCurrentDragData(data: currentDragDataPayload) {
		console.log("setCurrentDragData", data);
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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const task = currentDragData.task;
		// Create a modified copy of the task
		// const updatedTask: taskItem = { ...task };
		let newTags: string[] = task.tags;

		// Remove the source column tag if it exists
		if (sourceColumn.coltag) {
			const sourceTag = sourceColumn.coltag;
			console.log(
				"handleTaskMove_namedTag_to_namedTag...\nsourceTag=",
				sourceTag,
				"\ntask=",
				task
			);
			newTags = task.tags.filter(
				(tag: string) =>
					tag.replace("#", "").toLowerCase() !==
					sourceTag.replace("#", "").toLowerCase()
			);
		}

		// Add the target column tag if it doesn't exist
		if (targetColumn.coltag) {
			const targetTag = targetColumn.coltag.startsWith("#")
				? targetColumn.coltag
				: `#${targetColumn.coltag}`;
			// Make sure we don't have duplicates
			newTags.push(targetTag);
			newTags = Array.from(new Set(newTags));
		}

		// Before updating the task, first check if this target column has "manualOrder" sorting criteria.
		// If yes, we need to update the tasksIdManualOrder array to include this task's id whereever user has dropped it.
		// This will ensure that the task appears in the correct order in the target column after the move.
		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex
		);

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
		currentDragData: currentDragDataPayload | null,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		if (!currentDragData) {
			console.error("No current drag data available for reordering.");
			return;
		}
		const task = currentDragData.task;

		const { updateTaskItemDate } = await import("src/utils/UserTaskEvents");

		// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
		const dateType =
			(sourceColumn.datedBasedColumn?.dateType as
				| "startDate"
				| "scheduledDate"
				| "due") || "due";
		const currentDate = (task as taskItem)[dateType] || "";

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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemPriority } = await import(
			"src/utils/UserTaskEvents"
		);

		const task = currentDragData.task;

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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import(
			"src/utils/UserTaskEvents"
		);

		const task = currentBoardData.task;

		// Extract the status value from the source column
		const sourceStatus = (sourceColumn.taskStatus as string) || "";

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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import(
			"src/utils/UserTaskEvents"
		);

		const task = currentBoardData.task;

		// Mark task as completed - typically with status symbol 'x'
		const completedStatus = "x";

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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemDate } = await import("src/utils/UserTaskEvents");

		const task = currentBoardData.task;

		// Determine which date type the target column uses
		const dateType =
			(targetColumn.datedBasedColumn?.dateType as
				| "startDate"
				| "scheduledDate"
				| "due") || "due";

		// Use today's date if no date is currently set
		const today = new Date().toISOString().split("T")[0];
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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const task = currentBoardData.task;
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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemPriority } = await import(
			"src/utils/UserTaskEvents"
		);

		const task = currentBoardData.task;

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
		currentBoardData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData
	): Promise<void> => {
		const { updateTaskItemStatus } = await import(
			"src/utils/UserTaskEvents"
		);

		const task = currentBoardData.task;

		// Extract the status value from the target column
		const targetStatus = (targetColumn.taskStatus as string) || "";

		if (targetStatus) {
			updateTaskItemStatus(plugin, task, targetStatus);
		}
	};

	/**
	 * Handles reordering of tasks within the same column with manualOrder sorting
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param targetColumnData The column data with manualOrder sorting
	 * @param desiredIndex The desired index to insert the task at
	 */
	handleTasksOrderChange = (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		targetColumnData: ColumnData,
		desiredIndex: number | null
	): void => {
		console.log(
			"handleTasksOrderChange called...\ncurrentDragData=",
			currentDragData,
			"\ntargetColumnData=",
			targetColumnData,
			"\ndesiredIndex=",
			desiredIndex
		);
		if (
			!(
				targetColumnData?.sortCriteria &&
				targetColumnData.sortCriteria.length > 0 &&
				targetColumnData.sortCriteria[0].criteria === "manualOrder"
			)
		)
			return; // If not manualOrder sorting, exit

		const task = currentDragData.task;

		// Ensure manual order array exists
		if (!targetColumnData.tasksIdManualOrder) {
			targetColumnData.tasksIdManualOrder = [];
		}

		// Remove any existing occurrence of the task id
		targetColumnData.tasksIdManualOrder =
			targetColumnData.tasksIdManualOrder.filter((id) => id !== task.id);

		// Insert at desired index or push to end
		if (
			typeof desiredIndex === "number" &&
			desiredIndex >= 0 &&
			desiredIndex <= targetColumnData.tasksIdManualOrder.length
		) {
			targetColumnData.tasksIdManualOrder.splice(
				desiredIndex,
				0,
				task.id
			);
		} else {
			targetColumnData.tasksIdManualOrder.push(task.id);
		}

		let newSettings = plugin.settings;
		newSettings.data.boardConfigs[
			currentDragData.currentBoardIndex
		].columns[targetColumnData.index] = targetColumnData;

		// Persist settings and refresh the board
		try {
			plugin.saveSettings(newSettings);
			// No need to refresh here, the view will auto-refresh on task update
			// eventEmitter.emit("REFRESH_BOARD");
		} catch (err) {
			console.error("Error saving settings after task reorder:", err);
		}
	};

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
	 * Handle card drag start called from React components.
	 * Sets current drag payload, dims the source element and prepares dataTransfer payload.
	 */
	public handleCardDragStartEvent(
		e: DragEvent,
		draggedTaskItem: HTMLDivElement,
		currentDragData: currentDragDataPayload,
		dragIndex: number
	): void {
		if (!e.dataTransfer) return;

		// prevent column drag from also starting
		e.stopPropagation();

		this.setCurrentDragData(currentDragData);

		e.dataTransfer.effectAllowed = "move";

		// TODO : I probably wont need this anymore since I am using the singleton manager to hold the current drag data.
		// provide a JSON payload so drop handlers can inspect
		try {
			e.dataTransfer.setData(
				"application/json",
				JSON.stringify({
					taskId: currentDragData.task.id,
					sourceColumnId: currentDragData.sourceColumnData?.id,
					sourceIndex: dragIndex,
				})
			);
		} catch (err) {
			// some browsers may throw on setData for complex types
			console.warn("Could not set JSON dataTransfer payload", err);
			try {
				e.dataTransfer.setData("text/plain", currentDragData.task.id);
			} catch {}
		}

		// Visual dim / dragging class
		this.dimDraggedTaskItem(draggedTaskItem);
		// draggedTaskItem.classList.add('task-item-dragging');
	}

	/**
	 * Show a card drop indicator (above or below a card element)
	 */
	public showCardDropIndicator(cardEl: HTMLElement, isAbove: boolean): void {
		if (!this.plugin) return;
		if (!cardEl || !cardEl.parentElement) return;

		// Create indicator if not already created
		if (!this.dropIndicator) {
			this.dropIndicator = document.createElement("div");
			this.dropIndicator.className =
				"taskboard-drop-indicator is-visible";
			this.dropIndicator.style.position = "absolute";
			this.dropIndicator.style.pointerEvents = "none";
			this.dropIndicator.style.zIndex = "9999";
			this.dropIndicator.style.background =
				"var(--interactive-accent, #5b8cff)";
			this.dropIndicator.style.borderRadius = "4px";
			// default height; adjusted below
			this.dropIndicator.style.height = "4px";
		}

		const rect = cardEl.getBoundingClientRect();
		const parentRect = cardEl.parentElement.getBoundingClientRect();
		const topPos = isAbove
			? `${rect.top - parentRect.top - 6}px`
			: `${rect.bottom - parentRect.top + 2}px`;

		this.dropIndicator.style.width = `${rect.width}px`;
		this.dropIndicator.style.left = `${rect.left - parentRect.left}px`;
		this.dropIndicator.style.top = topPos;

		cardEl.parentElement.appendChild(this.dropIndicator);
	}

	/**
	 * Handle dragover events when hovering a card element
	 */
	public handleCardDragOverEvent(
		e: DragEvent,
		cardEl: HTMLElement,
		columnContainerEl: HTMLDivElement,
		ColumnData: ColumnData
	): void {
		if (!this.getCurrentDragData() || this.getCurrentDragData() === null)
			return;
		e.preventDefault();
		e.stopPropagation();

		// From here we should call below function to handle dragover styling on the column container.
		// The below function will return true or false based on whether drop is allowed or not.
		const dropAllowed = this.handleDragOver(
			e,
			ColumnData,
			columnContainerEl
		);

		if (!dropAllowed) return;

		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

		const rect = cardEl.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		const isAbove = (e.clientY || 0) < midY;
		this.showCardDropIndicator(cardEl, isAbove);
	}

	/**
	 * Handles the drag over event and applies CSS styling to the target column container
	 * based on whether the task is allowed to be dropped
	 *
	 * @param {DragEvent} e - The drag event object
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	handleDragOver(
		e: DragEvent,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement
	): boolean {
		// console.log("DragDropTasksManager : handleDragOver called...");
		e.preventDefault();

		const sourceColumnData = this.currentDragData
			? this.currentDragData.sourceColumnData
			: null;
		if (!sourceColumnData) {
			console.error("No source column data available for dragover.");
			return false;
		}

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(
			sourceColumnData,
			targetColumnData
		);
		// console.log("isDropAllowed", isDropAllowed);

		if (isDropAllowed) {
			console.log(
				"Task drop allowed from column:",
				sourceColumnData.name
			);
			// Apply CSS styling for allowed drop
			targetColumnContainer.classList.add("drag-over-allowed");
			targetColumnContainer.classList.remove("drag-over-not-allowed");
			e.dataTransfer!.dropEffect = "move";
			return true;
		} else {
			console.log(
				"Task drop not allowed from column:",
				sourceColumnData.name
			);
			// Apply CSS styling for not allowed drop
			targetColumnContainer.classList.add("drag-over-not-allowed");
			targetColumnContainer.classList.remove("drag-over-allowed");
			e.dataTransfer!.dropEffect = "none";
			return false;
		}
	}

	/**
	 * Handles the drop event and performs required operations to update task properties
	 * based on source and target column data
	 *
	 * @param {DragEvent} e - The drop event object
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	handleDrop(
		e: DragEvent,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement
	): void {
		console.log("DragDropTasksManager : handleDrop called...");
		e.preventDefault();

		const sourceColumnData = this.currentDragData
			? this.currentDragData.sourceColumnData
			: null;
		if (!sourceColumnData) {
			console.error("No source column data available for drop.");
			return;
		}

		// Remove drag-over styling from target
		targetColumnContainer.classList.remove(
			"drag-over-allowed",
			"drag-over-not-allowed"
		);

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
		console.log("Current drag data:", this.currentDragData);

		if (!this.currentDragData) {
			console.error("No current drag data available for drop operation.");
			return;
		}

		// Determine the operation based on source and target column types

		if (targetColumnData.colType === sourceColumnData.colType) {
			if (targetColumnData.id === sourceColumnData.id) {
				// This means user wants to change the order of the tasks in the same column
				// But we need to check first if this column has sorting.criteria = "manualOrder".
				this.handleTasksOrderChange(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					this.desiredDropIndex
				);

				eventEmitter.emit("REFRESH_BOARD");
				return;
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

	/**
	 * Handle leaving a drop area - clear indicators and styling
	 */
	public handleDragLeaveEvent(columnContainerEl: HTMLDivElement): void {
		this.clearDesiredDropIndex();
		// remove indicator if present
		if (this.dropIndicator && this.dropIndicator.parentElement) {
			this.dropIndicator.parentElement.removeChild(this.dropIndicator);
		}
		this.dropIndicator = null;

		columnContainerEl.classList.remove(
			"drag-over-allowed",
			"drag-over-not-allowed"
		);

		// Clear drag-over styling from all columns
		// const allColumnContainers = Array.from(
		// 	document.querySelectorAll(".TaskBoardColumnsSection")
		// ) as HTMLDivElement[];
		// allColumnContainers.forEach((container) => {
		// 	container.classList.remove(
		// 		"drag-over-allowed",
		// 		"drag-over-not-allowed"
		// 	);
		// });

		// clear dimming from any dragged items
		// const allTaskItems = Array.from(document.querySelectorAll('.taskItem.task-item-dragging')) as HTMLDivElement[];
		// allTaskItems.forEach((item) => {
		// 	item.classList.remove('task-item-dragging');
		// 	this.removeDimFromDraggedTaskItem(item);
		// });
	}
}

// Export the singleton instance for easy access
export const dragDropTasksManagerInsatance = DragDropTasksManager.getInstance();
