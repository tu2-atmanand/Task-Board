// Define the structure of Board, Column, and the Data read from JSON

// Filter operator types for advanced filters
export type FilterOperator = 
	| "is" 
	| "is not" 
	| "contains" 
	| "does not contain" 
	| "starts with" 
	| "ends with" 
	| "is empty" 
	| "is not empty"
	| ">="
	| "<="
	| "="
	| ">"
	| "<";

// Filter property types
export type FilterProperty = 
	| "priority" 
	| "status" 
	| "due date" 
	| "created date"
	| "scheduled date"
	| "start date"
	| "completion date"
	| "file path"
	| "tags";

// Individual filter definition
export type TaskFilter = {
	id: string;
	property: FilterProperty;
	operator: FilterOperator;
	value: string;
	logicalOperator: "AND" | "OR"; // Operator to combine with next filter
};

// Filter group containing multiple filters
export type FilterGroup = {
	id: string;
	matchType: "All" | "Any"; // Match all filters (AND) or any filter (OR)
	filters: TaskFilter[];
	logicalOperator?: "AND" | "OR"; // Operator to combine with next group
};

// Advanced filters structure
export type AdvancedFilters = {
	enabled: boolean;
	matchType: "All" | "Any"; // Match all groups (AND) or any group (OR)
	groups: FilterGroup[];
};

export type ColumnData = {
	id: number;
	index: number;
	colType: string;
	active: boolean;
	collapsed?: boolean;
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
	sort?: {
		criteria: string;
		order: boolean; // Ascending = 0 AND Descending = 1
	};
	range?: { // Keep it for few versions, this is required while settings migrations
		tag: string;
		rangedata: {
			from: number;
			to: number;
		};
	};
};

export type Board = {
	name: string;
	index: number;
	columns: ColumnData[];
	hideEmptyColumns: boolean;
	filters: string[]; // Legacy tag filters
	filterPolarity: string;
	filterScope: string;
	showColumnTags: boolean;
	showFilteredTags: boolean;
	advancedFilters?: AdvancedFilters; // New advanced filters
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
