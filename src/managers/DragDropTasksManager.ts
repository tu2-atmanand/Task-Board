import TaskBoard from "main";
import { Notice } from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import {
	colTypeNames,
	statusTypeNames,
	UniversalDateOptions,
} from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";
import {
	updateTaskItemProperty,
	updateTaskItemTags,
} from "src/utils/UserTaskEvents";
import { eventEmitter } from "src/services/EventEmitter";
import { swimlaneDataProp } from "src/components/KanbanView/TaskItem";
import {
	getStatusNameFromStatusSymbol,
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "src/utils/taskNote/TaskNoteUtils";
import {
	sanitizeStatus,
	sanitizeTags,
} from "src/utils/taskLine/TaskContentFormatter";
import { updateTaskInFile } from "src/utils/taskLine/TaskLineUtils";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { getAllDatesInRelativeRange } from "src/utils/DateTimeCalculations";
import { bugReporter } from "src/services/OpenModals";
import { DatePickerModal } from "src/modals/date_picker";
import { bugReporterManagerInsatance } from "./BugReporter";

export interface currentDragDataPayload {
	task: taskItem;
	taskIndex: string;
	sourceColumnData: ColumnData;
	currentBoardIndex: number;
	swimlaneData: swimlaneDataProp | null | undefined;
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

	// --------------------------------------
	// Basic GET/SET functions
	// --------------------------------------

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
	getCurrentDragData(): currentDragDataPayload | null {
		return this.currentDragData;
	}

	/**
	 * Clear current drag payload (called from dragend / drop)
	 */
	clearCurrentDragData() {
		this.currentDragData = null;
	}

	// --------------------------------------
	// All utils to update task in the file, based on the column move action.
	// --------------------------------------

	/**
	 * Handles task move within the same column. It handles swimlane change, if enabled.
	 * And order change if the sort criteria is 'manualOrder'.
	 * @param plugin - The plugin instance
	 * @param currentDragData - The current drag data
	 * @param sourceColumnData - The source column data
	 * @param targetColumnData - The target column data
	 * @param sourceColumnSwimlaneData - The swimlane configs of the source column
	 * @param targetColumnSwimlaneData - The swimlane configs of the target column
	 */
	handleTaskMove_same_column = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumnData: ColumnData,
		targetColumnData: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		// This means, user either wants to change the order of the taskItems within the column or is changing the swimlanes.
		this.handleTasksOrderChange(
			this.plugin!,
			currentDragData,
			sourceColumnData,
			this.desiredDropIndex,
		);

		if (
			sourceColumnSwimlaneData &&
			targetColumnSwimlaneData &&
			sourceColumnSwimlaneData.value !== targetColumnSwimlaneData.value
		) {
			const oldTask = currentDragData.task;
			let newTask: taskItem = { ...oldTask };
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			eventEmitter.emit("UPDATE_TASK", {
				taskID: oldTask.id,
				state: true,
			});

			const isThisTaskNote = isTaskNotePresentInTags(
				plugin.settings.data.taskNoteIdentifierTag,
				oldTask.tags,
			);

			if (isThisTaskNote) {
				updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
					sleep(1000).then(() => {
						plugin.realTimeScanner.processAllUpdatedFiles(
							oldTask.filePath,
							oldTask.id,
						);
					});
				});
			} else {
				newTask.title = sanitizeTags(
					newTask.title,
					oldTask.tags,
					newTask.tags,
				);
				console.log("Sanitized title after tag update:", newTask.title);
				updateTaskInFile(plugin, newTask, oldTask).then(() => {
					plugin.realTimeScanner.processAllUpdatedFiles(
						oldTask.filePath,
						oldTask.id,
					);
				});
			}
		} else {
			setTimeout(() => {
				eventEmitter.emit("REFRESH_BOARD");
			}, 200);
		}
	};

	/**
	 * Updates the tags of a task when moved between columns of type colTypeNames.namedTag
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 * @param sourceColumnSwimlaneData - The swimlane configs of the source column
	 * @param targetColumnSwimlaneData - The swimlane configs of the target column
	 * @returns Void
	 */
	handleTaskMove_namedTag_to_namedTag = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (
			sourceColumn.coltag == undefined ||
			targetColumn.coltag == undefined
		) {
			console.error(
				"handleTaskMove_namedTag_to_namedTag: coltag undefined",
			);
			return;
		}

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		// -----------------------------------------------
		// STEP 1 - If the target column has "manualOrder" sorting criteria, update the task-order-config in the target column.
		// This is moved above STEP-1 because, the parent function is async.
		// ----------------------------------------------
		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		// -----------------------------------------------
		// STEP 2 - Update the task properties so that it moves from source swimlane to target swilane
		// -----------------------------------------------
		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		// -----------------------------------------------
		// STEP 3 - Will first update the properties of the task which should make it move from source column to target column.
		// -----------------------------------------------

		// Remove the source column tag if it exists
		const sourceTag = sourceColumn.coltag;
		let newTags = newTask.tags.filter(
			(tag: string) =>
				tag.replace("#", "").toLowerCase() !==
				sourceTag.replace("#", "").toLowerCase(),
		);

		// Add the target column tag if it doesn't exist
		const targetTag = targetColumn.coltag.replace("#", "");
		// Make sure we don't have duplicates
		newTags.push(targetTag);
		newTags = Array.from(new Set(newTags));

		// newTask.tags = newTags;
		// newTask = await updateTaskItemProperty(
		// 	oldTask,
		// 	plugin.settings.data,
		// 	"tags",
		// 	oldTask.tags,
		// 	newTask.tags
		// );

		console.log(
			"handleTaskMove_namedTag_to_namedTag...\nnewTask=",
			newTask,
		);

		// -----------------------------------------------
		// STEP 4 - Finally update the task in the note, so that its automatically scanned again. Which will trigger screen refresh.
		// -----------------------------------------------
		updateTaskItemTags(plugin, oldTask, newTask, newTags);

		// eventEmitter.emit("UPDATE_TASK", { taskID: oldTask.id, state: true });

		// const isThisTaskNote = isTaskNotePresentInTags(
		// 	plugin.settings.data.taskNoteIdentifierTag,
		// 	oldTask.tags
		// );

		// if (isThisTaskNote) {
		// 	updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
		// 		sleep(1000).then(() => {
		// 			plugin.realTimeScanner.processAllUpdatedFiles(
		// 				oldTask.filePath,
		// 				oldTask.id
		// 			);
		// 		});
		// 	});
		// } else {
		// 	newTask.title = sanitizeTags(
		// 		newTask.title,
		// 		oldTask.tags,
		// 		newTask.tags
		// 	);
		// 	console.log("Sanitized title :", newTask.title);
		// 	console.log("Sanitized title after tag update:", newTask.title);
		// 	updateTaskInFile(plugin, newTask, oldTask).then(() => {
		// 		plugin.realTimeScanner.processAllUpdatedFiles(
		// 			oldTask.filePath,
		// 			oldTask.id
		// 		);
		// 	});
		// }
	};

	/**
	 * Updates the date of a task when moved between dated columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 *
	 * @todo - This is a duplicate of handleTaskMove_to_priority. But both these functions have only one difference. So, not sure whether to remove this one or not.
	 */
	handleTaskMove_dated_to_dated = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!currentDragData || !targetColumn.datedBasedColumn) {
			console.error(
				"No current drag data available for reordering : ",
				JSON.stringify(currentDragData),
				"\nOr the target column data : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemDate } = await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from ===
				targetColumn.datedBasedColumn.to
		) {
			// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
			const dateType =
				(targetColumn.datedBasedColumn?.dateType as
					| UniversalDateOptions.startDate
					| UniversalDateOptions.scheduledDate
					| UniversalDateOptions.dueDate) ||
				UniversalDateOptions.dueDate;

			const oldDateValueOfTheTask = newTask[dateType] || "";

			const newDateValue = getAllDatesInRelativeRange(
				targetColumn.datedBasedColumn?.from,
				targetColumn.datedBasedColumn?.to,
			)[0];

			// newTask[dateType] = newDateValue;

			updateTaskItemDate(plugin, newTask, dateType, newDateValue);
		} else if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from <=
				targetColumn.datedBasedColumn.to
		) {
			const dateType =
				(targetColumn.datedBasedColumn?.dateType as
					| UniversalDateOptions.startDate
					| UniversalDateOptions.scheduledDate
					| UniversalDateOptions.dueDate) ||
				UniversalDateOptions.dueDate;

			// Call the date input modal, to take new date from user.
			const datePicker = new DatePickerModal(plugin.app, plugin);
			datePicker.onDateSelected = async (date: string | null) => {
				if (date) {
					// newTask[dateType] = date;
					updateTaskItemDate(plugin, newTask, dateType, date);
				}
			};

			datePicker.open();
		} else {
			// This code-block should technically not run, since we are not allowing to drop task in dated type column with a range of dates.
			bugReporterManagerInsatance.showNotice(
				30,
				"The column configurations are currupted. Configurations are not valid for this operation. Kindly verify the column configuration in which you just dropped the task.",
				`Column configuration :	${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_dated_to_dated",
			);
		}
	};

	/**
	 * Updates the priority of a task when moved between priority columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 *
	 * @todo - This is a duplicate of handleTaskMove_to_priority. But both these functions have only one difference. So, not sure whether to remove this one or not.
	 */
	handleTaskMove_priority_to_priority = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!targetColumn.taskPriority) {
			console.error(
				"The priority value not found in the target column configuration : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemPriority } =
			await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		// Extract the priority value from the source column
		const targetColumnPrioirty = (targetColumn.taskPriority as number) || 0;

		updateTaskItemPriority(plugin, newTask, targetColumnPrioirty);
	};

	/**
	 * Updates the status of a task when moved between status columns
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target column data
	 *
	 * @todo - This is a duplicate of handleTaskMove_to_priority. But both these functions have only one difference. So, not sure whether to remove this one or not.
	 */
	handleTaskMove_status_to_status = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!targetColumn.taskStatus) {
			console.error(
				"The status value not found in the target column configuration : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemStatus } =
			await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		// Extract the status value from the source column
		const targetColumnStatusValue =
			(targetColumn.taskStatus as string) || "";

		updateTaskItemStatus(plugin, newTask, targetColumnStatusValue);
	};

	handleTaskMove_DONE_to_TODO = (
		plugin: TaskBoard,
		task: taskItem,
	): taskItem => {
		const newTitle = task.title;
		let newTask: taskItem = {
			...task,
			status: " ",
			completion: "",
			cancelledDate: "",
		};
		if (
			!isTaskNotePresentInTags(
				plugin.settings.data.taskNoteIdentifierTag,
				task.tags,
			)
		) {
			newTask.title = sanitizeStatus(
				plugin.settings.data,
				task.title,
				" ",
				statusTypeNames.TODO,
			);
		}

		return newTask;
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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!currentDragData || !targetColumn.datedBasedColumn) {
			console.error(
				"No current drag data available for reordering : ",
				JSON.stringify(currentDragData),
				"\nOr the target column data : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemDate } = await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from ===
				targetColumn.datedBasedColumn.to
		) {
			// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
			const dateType =
				(targetColumn.datedBasedColumn?.dateType as
					| UniversalDateOptions.startDate
					| UniversalDateOptions.scheduledDate
					| UniversalDateOptions.dueDate) ||
				UniversalDateOptions.dueDate;

			const newDateValue = getAllDatesInRelativeRange(
				targetColumn.datedBasedColumn?.from,
				targetColumn.datedBasedColumn?.to,
			)[0];

			// newTask[dateType] = newDateValue;

			updateTaskItemDate(plugin, newTask, dateType, newDateValue);
		} else if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from <=
				targetColumn.datedBasedColumn.to
		) {
			const dateType =
				(targetColumn.datedBasedColumn?.dateType as
					| UniversalDateOptions.startDate
					| UniversalDateOptions.scheduledDate
					| UniversalDateOptions.dueDate) ||
				UniversalDateOptions.dueDate;

			// Call the date input modal, to take new date from user.
			const datePicker = new DatePickerModal(plugin.app, plugin);
			datePicker.onDateSelected = async (date: string | null) => {
				if (date) {
					// newTask[dateType] = date;
					updateTaskItemDate(plugin, newTask, dateType, date);
				}
			};

			datePicker.open();
		} else {
			// This code-block should technically not run, since we are not allowing to drop task in dated type column with a range of dates.
			bugReporterManagerInsatance.showNotice(
				31,
				"The column configurations are currupted. Configurations are not valid for this operation. Kindly verify the column configuration in which you just dropped the task.",
				`Column configuration :	${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_dated_to_dated",
			);
		}
	};

	/**
	 * Adds a tag to a task when moved to a namedTag column from a different column type.
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param sourceColumn Source column data
	 * @param targetColumn Target namedTag column data
	 */
	handleTaskMove_to_namedTag = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!targetColumn?.coltag) {
			console.error(
				"handleTaskMove_to_namedTag: coltag undefined in the target column configs",
			);
			return;
		}

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		// STEP 1 - Check if the target column has 'manualOrder' sorting criteria.
		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		// STEP 2 - Check if swimlanes are enabled and if user is moving from one swimlane to another.
		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		console.log("Should hit this one...");
		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// STEP 3 - Add the target column tag if it doesn't already exist
		let newTags = oldTask.tags ?? [];
		if (targetColumn.coltag) {
			const targetTag = targetColumn.coltag.startsWith("#")
				? targetColumn.coltag
				: `#${targetColumn.coltag}`;

			if (!newTags.includes(targetTag)) {
				newTags.push(targetTag);
			}
		}

		// FINALLY - Update the task in the note which will trigger to refresh the view.
		updateTaskItemTags(plugin, oldTask, newTask, newTags);
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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!targetColumn.taskPriority) {
			console.error(
				"The priority value not found in the target column configuration : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemPriority } =
			await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// Extract the priority value from the source column
		const targetColumnPrioirty = (targetColumn.taskPriority as number) || 0;

		updateTaskItemPriority(plugin, newTask, targetColumnPrioirty);
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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		if (!targetColumn.taskStatus) {
			console.error(
				"The status value not found in the target column configuration : ",
				JSON.stringify(targetColumn),
			);
			return;
		}

		const { updateTaskItemStatus } =
			await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// Extract the status value from the source column
		const targetColumnStatusValue =
			(targetColumn.taskStatus as string) || "";

		updateTaskItemStatus(plugin, newTask, targetColumnStatusValue);
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
		currentDragData: currentDragDataPayload,
		sourceColumn: ColumnData,
		targetColumn: ColumnData,
		sourceColumnSwimlaneData: swimlaneDataProp | null | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): Promise<void> => {
		const { updateTaskItemStatus } =
			await import("src/utils/UserTaskEvents");

		const oldTask = currentDragData.task;
		let newTask = { ...oldTask } as taskItem;

		// STEP 1 - Check if the target column has 'manualOrder' sorting criteria.
		this.handleTasksOrderChange(
			plugin,
			currentDragData,
			targetColumn,
			this.desiredDropIndex,
		);

		// STEP 2 - Check if swimlanes are enabled and if user is moving from one swimlane to another.
		if (sourceColumnSwimlaneData && targetColumnSwimlaneData) {
			newTask = await this.updateTaskItemOnSwimlaneChange(
				newTask,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
				plugin.settings.data,
			);
			console.log("newTask after swimlane change:", newTask);
		}

		const newStatus = plugin.settings.data.customStatuses.find(
			(status) => status.type === statusTypeNames.DONE,
		);

		// FINALLY - Update the task in the note.
		updateTaskItemStatus(plugin, newTask, newStatus?.symbol ?? "x");
	};

	/**
	 * Handles reordering of tasks within the same column with manualOrder sorting
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param targetColumnData The column data with manualOrder sorting
	 * @param desiredIndex The desired index to insert the task at
	 */
	handleTasksOrderChange = async (
		plugin: TaskBoard,
		currentDragData: currentDragDataPayload,
		targetColumnData: ColumnData,
		desiredIndex: number | null,
	) => {
		console.log(
			"handleTasksOrderChange called...\ncurrentDragData=",
			currentDragData,
			"\ntargetColumnData=",
			targetColumnData,
			"\ndesiredIndex=",
			desiredIndex,
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
				task.id,
			);
		} else {
			targetColumnData.tasksIdManualOrder.push(task.id);
		}

		let newBoardData =
			await this.plugin?.taskBoardFileManager.getCurrentBoardData();

		if (!newBoardData) {
			throw "Board data not found";
			return;
		}

		newBoardData!.columns[targetColumnData.index - 1] = targetColumnData;

		// Persist settings and refresh the board
		try {
			this.plugin?.taskBoardFileManager.saveBoard(newBoardData);
		} catch (err) {
			console.error("Error saving settings after task reorder:", err);
		}
	};

	/**
	 * Handles reordering of tasks within the same column with swimlane sorting
	 * @param plugin TaskBoard plugin instance
	 * @param task The task being moved
	 * @param targetColumnData The column data with swimlane sorting
	 * @param desiredIndex The desired index to insert the task at
	 */
	updateTaskItemOnSwimlaneChange = async (
		task: taskItem,
		sourceColumnSwimlaneData: swimlaneDataProp,
		targetColumnSwimlaneData: swimlaneDataProp,
		globalSettings: globalSettingsData,
	): Promise<taskItem> => {
		const property = sourceColumnSwimlaneData.property;
		const oldValue = sourceColumnSwimlaneData.value;
		const newValue = targetColumnSwimlaneData.value;

		let newTask: taskItem = { ...task };

		if (property === "tags") {
			const oldTags = task.tags ?? [];
			let newTags: string[] = oldTags;
			// Remove old tag of source swimlane
			if (oldValue !== "All rest") {
				newTags = newTags.filter(
					(tag) =>
						tag.replace("#", "").toLowerCase() !==
						oldValue.replace("#", "").toLowerCase(),
				);
			}

			// Add new tag of target swimlane
			if (newValue !== "All rest")
				newTags.push(
					newValue.startsWith("#") ? newValue : `#${newValue}`,
				);
			newTags = Array.from(new Set(newTags));

			newTask = await updateTaskItemProperty(
				newTask,
				globalSettings,
				property,
				oldTags,
				newTags,
			);
		} else {
			newTask = await updateTaskItemProperty(
				newTask,
				globalSettings,
				property,
				oldValue,
				newValue,
			);
		}

		return newTask;
	};

	/**
	 * This is the rule-checker of this drag and drop manager.
	 * Checks if a task is allowed to be dropped in the target column.
	 *
	 * Allow Drop Rules:
	 * - If source and target column types are the same
	 * - If target column type is "completed", allow drop
	 * - Docs pending...
	 *
	 * Dont Allow Drop Rules:
	 * - If the source column is of any other type, but the target column is of type dated and the 'to' and 'from' values are different.
	 * - If the source column is of any other type, but the target column is of type "undated".
	 * - If the source column is of any other type, but the target column is of type "untagged".
	 * - If the source column is of any other type, but the target column is of type "otherTags".
	 *
	 * @param {ColumnData} sourceColumnData - The source column data
	 * @param {ColumnData} targetColumnData - The target column data
	 * @returns {boolean} True if drop is allowed, false otherwise
	 */
	isTaskDropAllowed(
		sourceColumnData: ColumnData,
		targetColumnData: ColumnData,
	): boolean {
		// Since there are more positive rules then negative ones.
		// Hence this function will only mention the negative ones and return false.
		// For all other cases it will return true.

		switch (targetColumnData.colType) {
			// case colTypeNames.dated:
			// 	if (
			// 		targetColumnData.datedBasedColumn &&
			// 		targetColumnData.datedBasedColumn?.to !==
			// 			targetColumnData.datedBasedColumn?.from
			// 	) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			case colTypeNames.undated:
				return false;
			case colTypeNames.untagged:
				return false;
			case colTypeNames.otherTags:
				if (sourceColumnData.colType === colTypeNames.otherTags)
					return true;
				else return false;
			case colTypeNames.allPending:
				return false;
			default:
				return true;
		}
	}

	// --------------------------------------
	// Few utils to change the styling of the UI elements depending on the various drag and drop triggers.
	// --------------------------------------

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
	 * Show a card drop indicator (above or below a card element)
	 *
	 * @param {HTMLElement} cardEl - The card element
	 * @param {boolean} isAbove - True if the indicator should be shown above the card, false otherwise
	 */
	showCardDropIndicator(cardEl: HTMLElement, isAbove: boolean): void {
		if (!this.plugin) return;
		if (!cardEl || !cardEl.parentElement) return;

		console.log("cardEl", cardEl, "\nparentEl", cardEl.parentElement);

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

		// A proof of concept to show a box instead of a simple line and to move the adjacent cards up or down.
		// cardEl.style.marginBottom = "0px";
		// cardEl.style.marginTop = "0px";
		// if (isAbove) {
		// 	cardEl.style.marginTop = "40px";
		// } else {
		// 	cardEl.style.marginBottom = "40px";
		// }

		this.dropIndicator.style.width = `${rect.width}px`;
		this.dropIndicator.style.left = `${rect.left - parentRect.left}px`;
		this.dropIndicator.style.top = topPos;

		cardEl.parentElement.appendChild(this.dropIndicator);
	}

	/**
	 * Clears all drag-related styling from all task items and columns
	 *
	 */
	clearAllDragStyling(): void {
		// For column we can do this kind of heavy DOM traversing,
		// since there will be less columns, so querySelecting them all is not so big issue.
		const allColumnContainers = Array.from(
			document.querySelectorAll(".TaskBoardColumnsSection"),
		) as HTMLDivElement[];
		allColumnContainers.forEach((container) => {
			container.classList.remove(
				"drag-over-allowed",
				"drag-over-not-allowed",
			);
		});

		// Removes the drop indicator, if the target column had manualOrder sorting and if the dropIndicator was visible.
		if (this.dropIndicator && this.dropIndicator.parentElement) {
			this.dropIndicator.parentElement.removeChild(this.dropIndicator);
		}

		// TODO : This feels like overkill, because I am only dimming the single .taskItem which I will be dragging. Optimize this later.
		// Also clear dimming from all task items
		// const allTaskItems = Array.from(
		// 	document.querySelectorAll(".taskItem")
		// ) as HTMLDivElement[];
		// allTaskItems.forEach((item) => {
		// 	item.classList.remove("task-item-dragging-dimmed");
		// });
	}

	// --------------------------------------
	// Main manager functions to handle various drag and drop related triggers.
	// --------------------------------------

	/**
	 * Handle card drag start called from React components.
	 * Sets current drag payload, dims the source element and prepares dataTransfer payload.
	 *
	 * @param {DragEvent} e - The drag event.
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element.
	 * @param {currentDragDataPayload} currentDragData - The current drag data payload.
	 * @param {number} dragIndex (Optional) - The index of the task item being dragged.
	 *
	 */
	public handleDragStartEvent(
		e: DragEvent,
		draggedTaskItem: HTMLDivElement,
		currentDragData: currentDragDataPayload,
		dragIndex: number,
	): void {
		if (!e.dataTransfer) return;

		// prevent column drag from also starting
		e.stopPropagation();

		this.setCurrentDragData(currentDragData);

		e.dataTransfer.effectAllowed = "move";

		// TODO : I probably wont need this anymore since I am using the singleton manager to hold the current drag data.
		// provide a JSON payload so drop handlers can inspect
		// try {
		// 	e.dataTransfer.setData(
		// 		"application/json",
		// 		JSON.stringify({
		// 			taskId: currentDragData.task.id,
		// 			sourceColumnId: currentDragData.sourceColumnData?.id,
		// 			sourceIndex: dragIndex,
		// 		})
		// 	);
		// } catch (err) {
		// 	// some browsers may throw on setData for complex types
		// 	console.warn("Could not set JSON dataTransfer payload", err);
		// 	try {
		// 		e.dataTransfer.setData("text/plain", currentDragData.task.id);
		// 	} catch {}
		// }

		// Add dragging class after a small delay to not affect the drag image
		requestAnimationFrame(() => {
			e.dataTransfer?.setDragImage(draggedTaskItem, 0, 0);
			draggedTaskItem.classList.add("task-item-dragging");
		});

		// Visual dim / dragging class
		this.dimDraggedTaskItem(draggedTaskItem);
		// draggedTaskItem.classList.add('task-item-dragging');
	}

	/**
	 * Handles the drag over event and applies CSS styling to the target column container
	 * based on whether the task is allowed to be dropped.
	 *
	 * @param {DragEvent} e - The drag event.
	 * @param {HTMLElement} cardEl - The dragged task item DOM element.
	 * @param {HTMLDivElement} columnContainerEl - The target column container DOM element.
	 * @param {ColumnData} ColumnData - The column data for the target column.
	 */
	public handleCardDragOverEvent(
		e: DragEvent,
		cardEl: HTMLElement,
		columnContainerEl: HTMLDivElement,
		ColumnData: ColumnData,
	): void {
		if (!this.getCurrentDragData() || this.getCurrentDragData() === null)
			return;
		e.preventDefault();
		e.stopPropagation();

		// console.log(
		// 	"Value of the found attribute : ",
		// 	cardEl.getAttribute("data-taskitem-id")
		// );
		// Dont show the drop indicator for the same dragged task card.
		if (
			this.currentDragData &&
			cardEl.getAttribute("data-taskitem-id") ===
				this.currentDragData.task.id
		) {
			return;
		}

		// From here we should call below function to handle dragover styling on the column container.
		// The below function will return true or false based on whether drop is allowed or not.
		const dropAllowed = this.handleColumnDragOverEvent(
			e,
			ColumnData,
			columnContainerEl,
		);

		if (!dropAllowed) return;

		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

		// We are now showing a custom and better drop indicator in the LazyColumn component itself.
		// const rect = cardEl.getBoundingClientRect();
		// const midY = rect.top + rect.height / 2;
		// const isAbove = (e.clientY || 0) < midY;
		// this.showCardDropIndicator(cardEl, isAbove);
	}

	/**
	 * Handles the drag over event and applies CSS styling to the target column container
	 * based on whether the task is allowed to be dropped
	 *
	 * @param {DragEvent} e - The drag event object
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	public handleColumnDragOverEvent(
		e: DragEvent,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement,
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
			targetColumnData,
		);
		// console.log("isDropAllowed", isDropAllowed);

		if (isDropAllowed) {
			// Apply CSS styling for allowed drop
			targetColumnContainer.classList.add("drag-over-allowed");
			targetColumnContainer.classList.remove("drag-over-not-allowed");
			e.dataTransfer!.dropEffect = "move";
			return true;
		} else {
			console.log(
				"Task drop not allowed from column:",
				sourceColumnData.name,
			);
			// Apply CSS styling for not allowed drop
			targetColumnContainer.classList.add("drag-over-not-allowed");
			targetColumnContainer.classList.remove("drag-over-allowed");
			e.dataTransfer!.dropEffect = "none";
			return false;
		}
	}

	/**
	 * Handle drag leave event.
	 * Clear desired drop index, remove indicator if present, and clear drag-over styling from all columns.
	 * Also clear dimming from any dragged items.
	 * @param {HTMLDivElement} columnContainerEl - The column container element
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
			"drag-over-not-allowed",
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

	/**
	 * Handles the drop event and performs required operations to update task properties
	 * based on source and target column data
	 *
	 * @param {DragEvent} e - The drop event object
	 * @param {ColumnData} targetColumnData - The target column data
	 * @param {HTMLDivElement} targetColumnContainer - The target column DOM container
	 */
	public handleDropEvent(
		e: DragEvent,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement,
		targetColumnSwimlaneData: swimlaneDataProp | null | undefined,
	): void {
		console.log("DragDropTasksManager : handleDrop called...");
		e.preventDefault();

		// All checks before proceeding with the calculations...
		if (!this.currentDragData) {
			console.error("No current drag data available for drop operation.");
			return;
		}

		const sourceColumnData = this.currentDragData.sourceColumnData;
		const sourceColumnSwimlaneData = this.currentDragData.swimlaneData;
		if (!sourceColumnData) {
			console.error(
				"There was an error while capturing the source column data.",
			);
			return;
		}

		// Remove drag-over styling from target
		targetColumnContainer.classList.remove(
			"drag-over-allowed",
			"drag-over-not-allowed",
		);

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(
			sourceColumnData,
			targetColumnData,
		);

		if (!isDropAllowed) {
			console.warn(
				"Task drop not allowed from column:",
				sourceColumnData.name,
				"to column:",
				targetColumnData.name,
			);
			new Notice(
				`Task drop not allowed from column: ${sourceColumnData.name} to column: ${targetColumnData.name}`,
			);
			return;
		}

		// Perform required operations to update task properties
		// This is where the actual task update logic will be implemented
		console.log("Task drop allowed. Updating task properties...");
		console.log("Source column:", sourceColumnData);
		console.log("Target column:", targetColumnData);
		console.log("Current drag data:", this.currentDragData);
		console.log("Current drag index:", this.desiredDropIndex);
		console.log("targetSwimilaneData", targetColumnSwimlaneData);

		// Determine the operation based on source and target column types

		if (targetColumnData.colType === sourceColumnData.colType) {
			if (targetColumnData.id === sourceColumnData.id) {
				this.handleTaskMove_same_column(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData,
					sourceColumnSwimlaneData,
					targetColumnSwimlaneData,
				);
				return;
			} else if (targetColumnData.colType === colTypeNames.namedTag) {
				this.handleTaskMove_namedTag_to_namedTag(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData,
					sourceColumnSwimlaneData,
					targetColumnSwimlaneData,
				);
			} else if (targetColumnData.colType === colTypeNames.dated) {
				this.handleTaskMove_to_dated(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData,
					sourceColumnSwimlaneData,
					targetColumnSwimlaneData,
				);
			} else if (targetColumnData.colType === colTypeNames.taskPriority) {
				this.handleTaskMove_priority_to_priority(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData,
					sourceColumnSwimlaneData,
					targetColumnSwimlaneData,
				);
			} else if (targetColumnData.colType === colTypeNames.taskStatus) {
				this.handleTaskMove_status_to_status(
					this.plugin!,
					this.currentDragData,
					sourceColumnData,
					targetColumnData,
					sourceColumnSwimlaneData,
					targetColumnSwimlaneData,
				);
			} else {
				new Notice(
					"This operation is not possible in the current version. Please request this idea to the developer.",
				);
			}
		} else if (targetColumnData.colType === colTypeNames.completed) {
			// This means user is moving task to completed column from any other type of column.
			// This operation should basically mark the task as completed
			this.handleTaskMove_to_completed(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
			);
		} else if (targetColumnData.colType === colTypeNames.dated) {
			// This means user is moving task to a dated column from any other type of column.
			// This operation should basically add a date property to the task based on the target column's dateType
			this.handleTaskMove_to_dated(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
			);
		} else if (targetColumnData.colType === colTypeNames.namedTag) {
			// This means user is moving task to a namedTag column from any other type of column.
			// This operation should basically add the target column's tag to the task
			this.handleTaskMove_to_namedTag(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
			);
		} else if (targetColumnData.colType === colTypeNames.taskPriority) {
			// This means user is moving task to a priority column from any other type of column.
			// This operation should basically update the task's priority based on the target column's taskPriority
			this.handleTaskMove_to_priority(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
			);
		} else if (targetColumnData.colType === colTypeNames.taskStatus) {
			// This means user is moving task to a status column from any other type of column.
			// This operation should basically update the task's status based on the target column's taskStatus
			this.handleTaskMove_to_status(
				this.plugin!,
				this.currentDragData,
				sourceColumnData,
				targetColumnData,
				sourceColumnSwimlaneData,
				targetColumnSwimlaneData,
			);
		} else {
			new Notice(
				"This operation is not possible in the current version. Please request this idea to the developer.",
			);
		}
	}
}

// Export the singleton instance for easy access
export const dragDropTasksManagerInsatance = DragDropTasksManager.getInstance();
