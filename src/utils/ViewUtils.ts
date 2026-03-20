/**
 * @name ViewUtils.ts
 * @path /src/utils/ViewUtils.ts
 * Utility functions for managing multiple views within a board
 */

import { Board, View } from "src/interfaces/BoardConfigs";
import {
	colTypeNames,
	defaultTaskStatuses,
	viewTypeNames,
} from "src/interfaces/Enums";
import { generateRandomTempTaskId } from "./TaskItemUtils";

/**
 * Get the index of a view within a board by its viewId
 * @param board The board containing the view
 * @param viewId The viewId to search for
 * @returns The index of the view, or -1 if not found
 */
export function getViewIndex(board: Board, viewId: string): number {
	return board.views.findIndex((v) => v.viewId === viewId);
}

/**
 * Get a specific view from a board by its viewId
 * @param board The board containing the view
 * @param viewId The viewId to retrieve
 * @returns The view object, or undefined if not found
 */
export function getViewById(board: Board, viewId: string): View | undefined {
	return board.views.find((v) => v.viewId === viewId);
}

/**
 * Get the first view of a specific type from a board
 * @param board The board to search
 * @param viewType The type of view to find (e.g., 'kanban', 'map')
 * @returns The view object, or undefined if not found
 */
export function getViewByType(
	board: Board,
	viewType: string,
): View | undefined {
	return board.views.find((v) => v.viewType === viewType);
}

/**
 * Get all views of a specific type from a board
 * @param board The board to search
 * @param viewType The type of views to find
 * @returns Array of views matching the type
 */
export function getViewsByType(board: Board, viewType: string): View[] {
	return board.views.filter((v) => v.viewType === viewType);
}

/**
 * Add a new view to a board
 * @param board The board to add the view to
 * @param viewType The type of view to create ('kanban' or 'map')
 * @param viewName The name of the new view
 * @returns The updated board with the new view added
 */
export function addViewToBoard(
	board: Board,
	viewType: string,
	viewName: string,
): Board {
	const newViewId = generateRandomTempTaskId();

	// Create base view structure
	const newView: View = {
		viewId: newViewId,
		viewName: viewName,
		viewType: viewType,
		showFilteredTags: true,
		viewFilter: {
			rootCondition: "any",
			filterGroups: [],
		},
		taskCount: {
			pending: 0,
			completed: 0,
		},
	};

	// Add default columns if it's a kanban view
	if (viewType === viewTypeNames.kanban) {
		newView.kanbanView = {
			columns: [],
			showColumnTags: false,
			hideEmptyColumns: false,
			swimlanes: {
				enabled: false,
				hideEmptySwimlanes: false,
				property: "tags",
				sortCriteria: "asc",
				minimized: [],
				maxHeight: "300px",
				verticalHeaderUI: false,
			},
		};
	} else if (viewType === viewTypeNames.map) {
		newView.mapView = {
			viewPortData: {
				x: 0,
				y: 0,
				zoom: 0.5,
			},
			nodesData: {},
		};
	}

	board.views.push(newView);
	return board;
}

/**
 * Delete a view from a board by index
 * @param board The board to remove the view from
 * @param viewIndex The index of the view to delete
 * @returns true if view was deleted, false if nothing was deleted
 */
export function deleteViewFromBoard(board: Board, viewIndex: number): boolean {
	if (viewIndex >= 0 && viewIndex < board.views.length) {
		board.views.splice(viewIndex, 1);
		return true;
	}
	return false;
}

/**
 * Duplicate a view in a board
 * @param board The board containing the view to duplicate
 * @param viewIndex The index of the view to duplicate
 * @returns true if view was duplicated, false if nothing was duplicated
 */
export function duplicateViewInBoard(board: Board, viewIndex: number): boolean {
	if (viewIndex < 0 || viewIndex >= board.views.length) {
		return false;
	}

	const originalView = board.views[viewIndex];
	const newView: View = JSON.parse(JSON.stringify(originalView));

	// Generate new view ID
	newView.viewId = generateRandomTempTaskId();
	newView.viewName = `${originalView.viewName} (Copy)`;

	board.views.push(newView);
	return true;
}

/**
 * Reorder views within a board
 * @param board The board containing the views
 * @param fromIndex The current index of the view
 * @param toIndex The new index for the view
 * @returns true if views were reordered, false if nothing changed
 */
export function reorderViews(
	board: Board,
	fromIndex: number,
	toIndex: number,
): boolean {
	if (
		fromIndex < 0 ||
		fromIndex >= board.views.length ||
		toIndex < 0 ||
		toIndex >= board.views.length ||
		fromIndex === toIndex
	) {
		return false;
	}

	const [movedView] = board.views.splice(fromIndex, 1);
	board.views.splice(toIndex, 0, movedView);
	return true;
}

/**
 * Update view properties
 * @param board The board containing the view
 * @param viewIndex The index of the view to update
 * @param updates Partial view object with properties to update
 * @returns true if view was updated, false if nothing was updated
 */
export function updateView(
	board: Board,
	viewIndex: number,
	updates: Partial<View>,
): boolean {
	if (viewIndex < 0 || viewIndex >= board.views.length) {
		return false;
	}

	const view = board.views[viewIndex];
	Object.assign(view, updates);
	return true;
}

/**
 * Create default Kanban columns for a new view
 * @returns Array of default column configurations
 */
function createDefaultKanbanColumns() {
	return [
		{
			id: generateRandomTempTaskId() as any,
			colType: colTypeNames.undated,
			active: true,
			collapsed: false,
			name: "Undated",
			index: 1,
			datedBasedColumn: {
				dateType: "due",
				from: 0,
				to: 0,
			},
		},
		{
			id: generateRandomTempTaskId() as any,
			colType: colTypeNames.completed,
			active: true,
			collapsed: false,
			limit: 20,
			name: "Completed",
			index: 2,
		},
	];
}

/**
 * Get the total number of views in a board
 * @param board The board to count views in
 * @returns The number of views
 */
export function getTotalViewCount(board: Board): number {
	return board.views.length;
}

/**
 * Check if a board has any views of the specified type
 * @param board The board to check
 * @param viewType The view type to check for
 * @returns true if board has at least one view of the specified type
 */
export function boardHasViewType(board: Board, viewType: string): boolean {
	return board.views.some((v) => v.viewType === viewType);
}
