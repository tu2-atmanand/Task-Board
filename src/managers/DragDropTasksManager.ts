import { ColumnData } from 'src/interfaces/BoardConfigs';

/**
 * DragDropTasksManager - A singleton manager class that handles drag and drop functionality
 * for task items between columns in the Kanban board view.
 */
class DragDropTasksManager {
	private static instance: DragDropTasksManager;
 
 	// Hold the current drag payload so dragover handlers can access it reliably
 	private currentDragData: any | null = null;

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
	 * Dims the dragged task item to provide visual feedback
	 *
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element
	 */
	dimDraggedTaskItem(draggedTaskItem: HTMLDivElement): void {
		draggedTaskItem.classList.add('task-item-dragging-dimmed');
	}

	/**
	 * Removes the dim effect from the dragged task item
	 *
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element
	 */
	removeDimFromDraggedTaskItem(draggedTaskItem: HTMLDivElement): void {
		draggedTaskItem.classList.remove('task-item-dragging-dimmed');
	}

	/**
	 * Clears all drag-related styling from all task items and columns
	 *
	 * @param {HTMLDivElement[]} allColumnContainers - Array of all column DOM containers
	 */
	clearAllDragStyling(allColumnContainers: HTMLDivElement[]): void {
		allColumnContainers.forEach((container) => {
			container.classList.remove('drag-over-allowed', 'drag-over-not-allowed');
		});
		// Also clear dimming from all task items
		const allTaskItems = Array.from(document.querySelectorAll('.taskItem')) as HTMLDivElement[];
		allTaskItems.forEach((item) => {
			item.classList.remove('task-item-dragging-dimmed');
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
	isTaskDropAllowed(sourceColumnData: ColumnData, targetColumnData: ColumnData): boolean {
		// Allow drop if source and target column types are the same
		if (sourceColumnData.colType === targetColumnData.colType) {
			return true;
		}

		// Allow drop if target column type is 'completed'
		if (targetColumnData.colType === 'completed') {
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
		const isDropAllowed = this.isTaskDropAllowed(sourceColumnData, targetColumnData);
		console.log('isDropAllowed', isDropAllowed);

		if (isDropAllowed) {
			// Apply CSS styling for allowed drop
			targetColumnContainer.classList.add('drag-over-allowed');
			targetColumnContainer.classList.remove('drag-over-not-allowed');
			e.dataTransfer!.dropEffect = 'move';
		} else {
			// Apply CSS styling for not allowed drop
			targetColumnContainer.classList.add('drag-over-not-allowed');
			targetColumnContainer.classList.remove('drag-over-allowed');
			e.dataTransfer!.dropEffect = 'none';
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
		targetColumnContainer.classList.remove('drag-over-allowed', 'drag-over-not-allowed');

		// Remove dim from source column
		sourceColumnContainer.classList.remove('drag-source-dimmed');

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(sourceColumnData, targetColumnData);

		if (!isDropAllowed) {
			console.warn('Task drop not allowed from column:', sourceColumnData.name, 'to column:', targetColumnData.name);
			return;
		}

		// Perform required operations to update task properties
		// This is where the actual task update logic will be implemented
		console.log('Task drop allowed. Updating task properties...');
		console.log('Source column:', sourceColumnData);
		console.log('Target column:', targetColumnData);

		// TODO: Implement actual task property update logic based on source and target column data
	}
}

// Export the singleton instance for easy access
export const dragDropTasksManagerInsatance = DragDropTasksManager.getInstance();
