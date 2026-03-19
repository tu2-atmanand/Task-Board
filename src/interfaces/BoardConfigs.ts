import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";
import { colTypeNames, defaultTaskStatuses, viewTypeNames } from "./Enums";

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

export type viewPortType = {
	x: number;
	y: number;
	zoom: number;
};

export type nodePositionWidth = {
	x: number;
	y: number;
	width: number;
};

export type nodeDataType = {
	[taskID: string]: nodePositionWidth;
};

/**
 * Interface for the Task Board view. It will store the data specific to a particular view created by user inside the board.
 */
export interface View {
	viewId: string;
	viewName: string;
	viewType: string;
	description?: string;
	showFilteredTags: boolean;
	viewFilter: RootFilterState;
	taskCount: {
		pending: number;
		completed: number;
	};

	// All configurations specific to the kanban view
	kanbanView?: {
		columns: ColumnData[];
		showColumnTags: boolean;
		hideEmptyColumns: boolean;
		swimlanes: swimlaneConfigs;
	};

	// All configurations specific to the map view
	mapView?: {
		viewPortData: viewPortType;
		nodesData: nodeDataType;
	};

	// More views will be added in the future
}

export interface Board {
	id: string;
	name: string;
	description?: string;
	filterConfig?: FilterConfigSettings;

	views: View[];
	lastViewId: string;

	// TODO : Below two settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	filters?: string[];
	filterPolarity?: string;
}

// A single board is a single project, inside a board user will create multiple types of views to visualize their tasks in different ways. Hence, when user will install this plugin for the first time, will only going to have a single board to which will be enought show the capabilities of this plugin and later user can easily create more boards.
export const DEFAULT_BOARD: Board = {
	id: "3103563481",
	name: "My Project",
	description:
		"This is my personal project. This is a default board created by Task Board for you to kick start your journey with Task Board. Feel free to edit or create new boards.",
	lastViewId: "view-3103563481-1",
	views: [
		{
			viewId: "view-3103563481-1",
			viewName: "Time Based Kanban",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
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
			},
		},
		{
			viewId: "view-3103563481-2",
			viewName: "Tag Based Kanban",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
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
			},
		},
		{
			viewId: "view-3103563481-3",
			viewName: "Status Based Kanban",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
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
			},
		},
	],
};
