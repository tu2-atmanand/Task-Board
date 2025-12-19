import { ColumnData } from 'src/interfaces/BoardConfigs';

/**
 * DragDropTasksManager - A singleton manager class that handles drag and drop functionality
 * for task items between columns in the Kanban board view.
 */
class DragDropTasksManager {
	private static instance: DragDropTasksManager;

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

		// Remove drag-over styling
		targetColumnContainer.classList.remove('drag-over-allowed', 'drag-over-not-allowed');

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
