import { colTypeNames, defaultTaskStatuses } from "./Enums";

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
		| "manualOrder"
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
	workLimit?: number;
	limit?: number;
	sortCriteria?: columnSortingCriteria[];
	tasksIdManualOrder?: string[];
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

export interface swimlaneConfigs {
	enabled: boolean;
	hideEmptySwimlanes: boolean;
	maxHeight: string;
	property: string; // e.g., 'tags', 'priority'
	customValue?: string; // This is only if user selects "custom" as the property. This is also only applicable in case of dataview format properties or for task-notes, where user can use their custom key-value from frontmatter.
	sortCriteria: string; // e.g., 'asc', 'desc', 'custom'
	customSortOrder?: {
		value: string;
		index: number;
	}[]; // This is only if user selects "custom" as the sort criteria.
	groupAllRest?: boolean; // This will be only visible for customSortOrder. It will help user to decide if they want to group all the rest of the task below the custom sort order.
	verticalHeaderUI: boolean; // This is a temporary setting for user telemetry. Later will remove it based on user feedback.
	minimized: string[]; // This will store the names of the minimized swimlanes.
}

export type Board = {
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
	swimlanes: swimlaneConfigs;
	// TODO : Below two settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	filters?: string[];
	filterPolarity?: string;
};

export type BoardConfigs = Board[];

export const DEFAULT_BOARDS: BoardConfigs = [
	{
		columns: [
			{
				id: 1,
				colType: colTypeNames.undated,
				active: true,
				collapsed: false,
				name: "Undated Tasks",
				index: 1,
				datedBasedColumn: {
					dateType: "due",
					from: 0,
					to: 0,
				},
			},
			{
				id: 2,
				colType: colTypeNames.dated,
				active: true,
				collapsed: false,
				name: "Over Due",
				index: 2,
				datedBasedColumn: {
					dateType: "due",
					from: -300,
					to: -1,
				},
			},
			{
				id: 3,
				colType: colTypeNames.dated,
				active: true,
				collapsed: false,
				name: "Today",
				index: 3,
				datedBasedColumn: {
					dateType: "due",
					from: 0,
					to: 0,
				},
			},
			{
				id: 4,
				colType: colTypeNames.dated,
				active: true,
				collapsed: false,
				name: "Tomorrow",
				index: 4,
				datedBasedColumn: {
					dateType: "due",
					from: 1,
					to: 1,
				},
			},
			{
				id: 5,
				colType: colTypeNames.dated,
				active: true,
				collapsed: false,
				name: "Future",
				index: 5,
				datedBasedColumn: {
					dateType: "due",
					from: 2,
					to: 300,
				},
			},
			{
				id: 6,
				colType: colTypeNames.completed,
				active: true,
				collapsed: false,
				limit: 20,
				name: "Completed",
				index: 6,
			},
		],
		name: "Time Based Workflow",
		index: 0,
		showColumnTags: false,
		showFilteredTags: true,
		hideEmptyColumns: false,
		boardFilter: {
			rootCondition: "any",
			filterGroups: [],
		},
		swimlanes: {
			enabled: false,
			hideEmptySwimlanes: false,
			property: "tags",
			sortCriteria: "asc",
			minimized: [],
			maxHeight: "300px",
			verticalHeaderUI: false,
		},
	},
	{
		columns: [
			{
				id: 7,
				colType: colTypeNames.untagged,
				active: true,
				collapsed: false,
				name: "Backlogs",
				index: 1,
			},
			{
				id: 8,
				colType: colTypeNames.namedTag,
				active: true,
				collapsed: false,
				name: "Important",
				index: 2,
				coltag: "important",
			},
			{
				id: 9,
				colType: colTypeNames.namedTag,
				active: true,
				collapsed: false,
				name: "WIP",
				index: 3,
				coltag: "wip",
			},
			{
				id: 11,
				colType: colTypeNames.namedTag,
				active: true,
				collapsed: false,
				name: "In Review",
				index: 5,
				coltag: "review",
			},
			{
				id: 12,
				colType: colTypeNames.completed,
				active: true,
				collapsed: false,
				index: 6,
				limit: 20,
				name: "Completed",
			},
		],
		name: "Tag Based Workflow",
		index: 1,
		showColumnTags: false,
		showFilteredTags: true,
		hideEmptyColumns: false,
		boardFilter: {
			rootCondition: "any",
			filterGroups: [],
		},
		swimlanes: {
			enabled: false,
			hideEmptySwimlanes: false,
			property: "tags",
			sortCriteria: "asc",
			minimized: [],
			maxHeight: "300px",
			verticalHeaderUI: false,
		},
	},
	{
		columns: [
			{
				id: 7,
				colType: colTypeNames.taskStatus,
				taskStatus: defaultTaskStatuses.unchecked,
				active: true,
				collapsed: false,
				name: "Backlogs",
				index: 1,
			},
			{
				id: 8,
				colType: colTypeNames.taskStatus,
				taskStatus: defaultTaskStatuses.scheduled,
				active: true,
				collapsed: false,
				name: "Ready to start",
				index: 2,
			},
			{
				id: 9,
				colType: colTypeNames.taskStatus,
				taskStatus: defaultTaskStatuses.inprogress,
				active: true,
				collapsed: false,
				name: "In Progress",
				index: 3,
			},
			{
				id: 11,
				colType: colTypeNames.taskStatus,
				taskStatus: defaultTaskStatuses.question,
				active: true,
				collapsed: false,
				name: "In Review",
				index: 5,
			},
			{
				id: 12,
				colType: colTypeNames.completed,
				active: true,
				collapsed: false,
				index: 6,
				limit: 20,
				name: "Completed",
			},
			{
				id: 13,
				colType: colTypeNames.taskStatus,
				taskStatus: defaultTaskStatuses.dropped,
				active: true,
				collapsed: false,
				name: "Cancelled",
				index: 7,
			},
		],
		name: "Status Based Workflow",
		index: 2,
		showColumnTags: false,
		showFilteredTags: true,
		hideEmptyColumns: false,
		boardFilter: {
			rootCondition: "any",
			filterGroups: [],
		},
		swimlanes: {
			enabled: false,
			hideEmptySwimlanes: false,
			property: "tags",
			sortCriteria: "asc",
			minimized: [],
			maxHeight: "300px",
			verticalHeaderUI: false,
		},
	},
];
