import { RootFilterState } from "src/components/BoardFilters/ViewTaskFilter";

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
}

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

export type Board = {
	name: string;
	description?: string;
	index: number;
	columns: ColumnData[];
	hideEmptyColumns: boolean;
	showColumnTags: boolean;
	showFilteredTags: boolean;
	filterConfig?: FilterConfigSettings;
	boardFilter?: RootFilterState;
};

export type BoardConfigs = Board[];

export const columnTypeAndNameMapping: { [key: string]: string } = {
	undated: "Undated",
	dated: "Dated",
	namedTag: "Tagged",
	untagged: "Untagged",
	otherTags: "Other Tags",
	taskStatus: "Status",
	taskPriority: "Priority",
	pathFiltered: "Path filtered",
	completed: "Completed",
};

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
