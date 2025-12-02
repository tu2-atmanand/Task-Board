import { KanbanBoardType } from "./Enums";

export interface columnSortingCriteria {
	criteria:
		| "status"
		| "completed"
		| "priority"
		| "dueDate"
		| "startDate"
		| "scheduledDate"
		| "createdDate"
		| "completedDate"
		| "content"
		| "tags"
		| "project"
		| "context"
		| "time"
		| "recurrence"
		| "filePath"
		| "lineNumber"
		| "id"; // Fields to sort by
	order: "asc" | "desc"; // Sort order
	priority: number;
	uid: string;
}

// --- Interfaces (from focus.md and example HTML) ---
// (Using 'any' for property types for now, will refine based on focus.md property list)
export interface Filter {
	id: string;
	property: string; // e.g., 'content', 'dueDate', 'priority'
	condition: string; // e.g., 'isSet', 'equals', 'contains'
	value?: any;
}

export interface FilterGroup {
	id: string;
	groupCondition: "all" | "any" | "none"; // How filters within this group are combined
	filters: Filter[];
}

export interface RootFilterState {
	rootCondition: "all" | "any" | "none"; // How filter groups are combined
	filterGroups: FilterGroup[];
}

// Represents a single filter condition UI row from focus.md
export interface FilterConditionItem {
	property: string; // e.g., 'content', 'dueDate', 'priority', 'tags.myTag'
	operator: string; // e.g., 'contains', 'is', '>=', 'isEmpty'
	value?: any; // Value for the condition, type depends on property and operator
}

// Represents a group of filter conditions in the UI from focus.md
export interface FilterGroupItem {
	logicalOperator: "AND" | "OR"; // How conditions/groups within this group are combined
	items: (FilterConditionItem | FilterGroupItem)[]; // Can contain conditions or nested groups
}

// Top-level filter configuration from the UI from focus.md
export type FilterConfig = FilterGroupItem;

// Define the structure of Board, Column, and the Data read from JSON
export type ColumnData = {
	id: number;
	index: number;
	colType: string;
	active: boolean;
	collapsed?: boolean;
	minimized?: boolean;
	name: string;
	coltag?: string;
	filePaths?: string;
	datedBasedColumn?: {
		dateType: string; // e.g., "due", "created", "scheduled"
		from: number;
		to: number;
	};
	taskStatus?: string;
	taskPriority?: number;
	limit?: number;
	sortCriteria?: columnSortingCriteria[];
	filters?: RootFilterState;
	range?: {
		// Keep it for few versions, this is required while settings migrations
		tag: string;
		rangedata: {
			from: number;
			to: number;
		};
	};
};

export type ColumnGroupData = {
	status: ColumnData[];
	time: ColumnData[];
}

// Define saved filter configuration interface
export interface SavedFilterConfig {
	id: string;
	name: string;
	description?: string;
	filterState: RootFilterState;
	createdAt: string;
	updatedAt: string;
}

// Define filter configuration settings
export interface FilterConfigSettings {
	enableSavedFilters: boolean;
	savedConfigs: SavedFilterConfig[];
}

// Legacy Board type - kept for migration purposes
export type BoardLegacy = {
	name: string;
	description?: string;
	index: number;
	columns: ColumnData[];
	hideEmptyColumns: boolean;
	showColumnTags: boolean;
	showFilteredTags: boolean;
	boardFilter: RootFilterState;
	filterConfig?: FilterConfigSettings;
	taskCount?: {
		pending: number;
		completed: number;
	};
	// TODO : Below two settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	filters?: string[];
	filterPolarity?: string;
};

export type Board = {
	name: string;
	description?: string;
	index: number;
	boardType: KanbanBoardType;
	columns: ColumnGroupData;
	hideEmptyColumns: boolean;
	showColumnTags: boolean;
	showFilteredTags: boolean;
	boardFilter: RootFilterState;
	filterConfig?: FilterConfigSettings;
	taskCount?: {
		pending: number;
		completed: number;
	};
	// TODO : Below two settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	filters?: string[];
	filterPolarity?: string;
};

export type BoardConfigs = Board[];

// Helper function to get active columns based on board type (defaults to status)
export function getActiveColumns(board: Board | null | undefined): ColumnData[] {
	if (!board || !board.columns) {
		return [];
	}
	if (board.boardType === KanbanBoardType.timeBoard) {
		return board.columns.time || [];
	}
	return board.columns.status || [];
}

// Helper function to get the active column key based on board type
export function getActiveColumnKey(board: Board | null | undefined): 'status' | 'time' {
	if (!board || board.boardType === KanbanBoardType.timeBoard) {
		return board?.boardType === KanbanBoardType.timeBoard ? 'time' : 'status';
	}
	return 'status';
}
