import TaskBoard from "main";
import { Notice, Platform } from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import { colTypeNames, statusTypeNames } from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";
import {
	updateTaskItemProperty,
	updateTaskItemTags,
} from "src/utils/UserTaskEvents";
import { eventEmitter } from "src/services/EventEmitter";
import { swimlaneDataProp } from "src/components/KanbanView/TaskItem";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "src/utils/taskNote/TaskNoteUtils";
import { sanitizeStatus } from "src/utils/taskLine/TaskContentFormatter";
import { updateTaskInFile } from "src/utils/taskLine/TaskLineUtils";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { getAllDatesInRelativeRange } from "src/utils/DateTimeCalculations";
import { bugReporterManagerInsatance } from "./BugReporter";
import { openDateInputModal } from "src/services/OpenModals";

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;
type DragImageOffset = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function calculateDragImageOffset(
	rect: RectLike,
	clientX: number,
	clientY: number,
): DragImageOffset {
	return {
		x: clamp(clientX - rect.left, 0, Math.max(0, rect.width)),
		y: clamp(clientY - rect.top, 0, Math.max(0, rect.height)),
	};
}

export interface currentDragDataPayload {
	task: taskItem;
	taskIndex: string;
	sourceColumnData: ColumnData;
	currentBoardIndex: number;
	swimlaneData: swimlaneDataProp | undefined;
}

/**
 * DragDropTasksManager - A singleton manager class that handles drag and drop functionality
 * for task items between columns in the Kanban board view.
 */
class DragDropTasksManager {
	private static instance: DragDropTasksManager;
	private plugin: TaskBoard | null = null;

	// Hold the current drag payload so dragover handlers can access it reliably
	private currentDragData: currentDragDataPayload | null = null;
	private desiredDropIndex: number | null = null;
	// private clonedDraggedElement: HTMLElement | null = null;
	// private dropIndicator: HTMLElement | null = null; // deprecated
	private targetColumnData: ColumnData | null = null;
	private targetColumnContainer: HTMLDivElement | null = null;

	// Auto-scroll state (unified for desktop + touch)
	private autoScrollRAFId: number | null = null;
	private autoScrollLastX: number = 0;
	private autoScrollLastY: number = 0;
	private autoScrollActive: boolean = false;
	private isAutoScrolling: boolean = false;
	private autoScrollDragOverHandler: ((e: DragEvent) => void) | null = null;

	// Touch drag state
	private touchDragActive: boolean = false;
	private touchDragGhost: HTMLElement | null = null;
	private touchDragElement: HTMLElement | null = null;
	private touchStartX: number = 0;
	private touchStartY: number = 0;
	private longPressTimer: number | null = null;
	private readonly LONG_PRESS_DELAY: number = 350;
	private readonly TOUCH_MOVE_THRESHOLD: number = 10;
	private boundContextMenuBlocker = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
	};

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
		this.stopAutoScroll();
	}

	/**
	 * Creates an improved drag image by cloning the source element and setting
	 * it as the native drag image. This produces a full-card preview instead of
	 * the browser's default thumbnail.
	 */
	setElementDragImage(
		event: DragEvent,
		sourceElement: HTMLElement,
		className?: string,
	): HTMLElement | null {
		const dataTransfer = event.dataTransfer;
		if (!dataTransfer || typeof dataTransfer.setDragImage !== "function") {
			return null;
		}

		const doc = sourceElement.ownerDocument;
		const body = doc.body;
		if (!body) return null;

		const rect = sourceElement.getBoundingClientRect();
		const dragImage = sourceElement.cloneNode(true) as HTMLElement;
		dragImage.classList.add("taskboard-drag-image");
		if (className) dragImage.classList.add(className);
		dragImage.style.width = `${Math.max(0, rect.width)}px`;
		dragImage.style.height = `${Math.max(0, rect.height)}px`;

		body.appendChild(dragImage);

		const offset = calculateDragImageOffset(
			rect,
			event.clientX,
			event.clientY,
		);
		dataTransfer.setDragImage(dragImage, offset.x, offset.y);

		(doc.defaultView ?? window).setTimeout(() => {
			dragImage.remove();
		}, 0);

		return dragImage;
	}

	/**
	 * Whether touch-based drag should be enabled on this device.
	 */
	shouldEnableTouchDrag(): boolean {
		if (!this.plugin?.settings.data.globalSettings.enableDragnDropTouch)
			return false;

		if (Platform.isMobile) return true;
		if (
			typeof navigator?.maxTouchPoints === "number" &&
			navigator.maxTouchPoints > 0
		)
			return true;

		return Boolean(
			window?.matchMedia?.("(any-pointer: coarse)")?.matches ||
			window?.matchMedia?.("(pointer: coarse)")?.matches,
		);
	}

	// --------------------------------------
	// Auto-scroll functionality (unified for desktop + touch)
	// Uses a single requestAnimationFrame loop, pointer position tracked
	// at document level (capture) to avoid stopPropagation blocking.
	// --------------------------------------

	/**
	 * Start auto-scroll for native HTML5 drag (desktop).
	 * Tracks mouse position via document-level dragover (capture phase)
	 * so it cannot be blocked by stopPropagation in child handlers.
	 */
	startAutoScroll(): void {
		if (this.isAutoScrolling) return;
		this.isAutoScrolling = true;
		this.autoScrollActive = true;

		const trackPosition = (e: DragEvent) => {
			this.autoScrollLastX = e.clientX;
			this.autoScrollLastY = e.clientY;
		};
		this.autoScrollDragOverHandler = trackPosition;
		document.addEventListener(
			"dragover",
			trackPosition as EventListener,
			true,
		);

		// Auto-cleanup on drag end
		document.addEventListener("dragend", () => this.stopAutoScroll(), {
			once: true,
		});

		this.startAutoScrollLoop();
	}

	/**
	 * Stop auto-scroll for native HTML5 drag (desktop).
	 */
	stopAutoScroll(): void {
		this.isAutoScrolling = false;
		this.autoScrollActive = false;
		if (this.autoScrollDragOverHandler) {
			document.removeEventListener(
				"dragover",
				this.autoScrollDragOverHandler as EventListener,
				true,
			);
			this.autoScrollDragOverHandler = null;
		}
		this.stopAutoScrollLoop();
	}

	/**
	 * Start auto-scroll for touch drag.
	 * Position is fed directly from touchmove events into autoScrollLastX/Y.
	 */
	startTouchAutoScroll(): void {
		this.autoScrollActive = true;
		this.startAutoScrollLoop();
	}

	/**
	 * Stop auto-scroll for touch drag.
	 */
	stopTouchAutoScroll(): void {
		this.autoScrollActive = false;
		this.stopAutoScrollLoop();
	}

	/**
	 * Unified requestAnimationFrame loop that checks the last known pointer
	 * position against the board edges and scrolls the appropriate containers.
	 *
	 * DOM layout reference:
	 *   Normal: .kanbanBoard > .columnsContainer (overflow-x) > .TaskBoardColumnsSection
	 *   Swimlanes: .kanbanBoard (overflow-x) > .swimlanesContainer (overflow-y) > .swimlaneRow > ...
	 *
	 * Scroll targets:
	 *   - .columnsContainer — horizontal scroll in normal columns layout
	 *   - .kanbanBoard — horizontal scroll in swimlanes / fallback
	 *   - .swimlanesContainer — vertical scroll across swimlane rows
	 */
	private startAutoScrollLoop(): void {
		if (this.autoScrollRAFId !== null) return;

		const step = () => {
			if (!this.autoScrollActive) {
				this.stopAutoScrollLoop();
				return;
			}

			const boardEl = document.querySelector(".kanbanBoard");
			if (!boardEl) {
				this.autoScrollRAFId = window.requestAnimationFrame(step);
				return;
			}

			const rect = boardEl.getBoundingClientRect();
			const edgePercent =
				this.plugin?.settings.data.globalSettings
					.dragAutoScrollEdgePercent || 20;
			const edgeWidth = rect.width * (edgePercent / 100);
			const edgeHeight = rect.height * (edgePercent / 100);
			const scrollSpeed = 8;

			let scrollX = 0;
			let scrollY = 0;

			if (this.autoScrollLastX < rect.left + edgeWidth) {
				scrollX = -scrollSpeed;
			} else if (this.autoScrollLastX > rect.right - edgeWidth) {
				scrollX = scrollSpeed;
			}

			if (this.autoScrollLastY < rect.top + edgeHeight) {
				scrollY = -scrollSpeed;
			} else if (this.autoScrollLastY > rect.bottom - edgeHeight) {
				scrollY = scrollSpeed;
			}

			if (scrollX !== 0 || scrollY !== 0) {
				// Gather all plausible scroll containers (safe to try all — out-of-range scroll is a no-op)
				const scrollTargets: HTMLElement[] = [];

				const columnsContainer = document.querySelector(
					".columnsContainer",
				) as HTMLElement;
				if (columnsContainer) scrollTargets.push(columnsContainer);

				const swimlanesContainer = document.querySelector(
					".swimlanesContainer",
				) as HTMLElement;
				if (swimlanesContainer) scrollTargets.push(swimlanesContainer);

				const kanbanBoard = boardEl as HTMLElement;
				if (scrollTargets.indexOf(kanbanBoard) === -1)
					scrollTargets.push(kanbanBoard);

				for (const el of scrollTargets) {
					if (scrollX !== 0) {
						el.scrollLeft = Math.max(
							0,
							Math.min(
								el.scrollLeft + scrollX,
								el.scrollWidth - el.clientWidth,
							),
						);
					}
					if (scrollY !== 0) {
						el.scrollTop = Math.max(
							0,
							Math.min(
								el.scrollTop + scrollY,
								el.scrollHeight - el.clientHeight,
							),
						);
					}
				}
			}

			this.autoScrollRAFId = window.requestAnimationFrame(step);
		};

		this.autoScrollRAFId = window.requestAnimationFrame(step);
	}

	private stopAutoScrollLoop(): void {
		if (this.autoScrollRAFId !== null) {
			window.cancelAnimationFrame(this.autoScrollRAFId);
			this.autoScrollRAFId = null;
		}
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
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
				plugin.settings.data.globalSettings,
			);
			eventEmitter.emit("UPDATE_TASK", {
				taskID: oldTask.id,
				state: true,
			});

			const isThisTaskNote = isTaskNotePresentInTags(
				plugin.settings.data.globalSettings.taskNoteIdentifierTag,
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (
			sourceColumn.coltag == undefined ||
			targetColumn.coltag == undefined
		) {
			bugReporterManagerInsatance.addToLogs(
				132,
				`coltag of either source or target column is undefined.\nSource=${sourceColumn.coltag}\nTarget=${targetColumn.coltag}`,
				"DragDropTasksManager.ts/handleTaskMove_namedTag_to_namedTag",
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
		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

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
		newTags.push(targetTag.startsWith("#") ? targetTag : `#${targetTag}`);
		newTags = Array.from(new Set(newTags));

		// newTask.tags = newTags;
		// newTask = await updateTaskItemProperty(
		// 	oldTask,
		// 	plugin.settings.data.globalSettings,
		// 	"tags",
		// 	oldTask.tags,
		// 	newTask.tags
		// );

		// -----------------------------------------------
		// STEP 4 - Finally update the task in the note, so that its automatically scanned again. Which will trigger screen refresh.
		// -----------------------------------------------
		updateTaskItemTags(plugin, oldTask, newTask, newTags);

		// eventEmitter.emit("UPDATE_TASK", { taskID: oldTask.id, state: true });

		// const isThisTaskNote = isTaskNotePresentInTags(
		// 	plugin.settings.data.globalSettings.taskNoteIdentifierTag,
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!currentDragData || !targetColumn.datedBasedColumn) {
			bugReporterManagerInsatance.addToLogs(
				133,
				`No current drag data available for reordering.\ncurrentDragData=${JSON.stringify(currentDragData)}\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_dated_to_dated",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from ===
				targetColumn.datedBasedColumn.to
		) {
			// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
			const dateType = targetColumn.datedBasedColumn.dateType;
			// const oldDateValueOfTheTask = newTask[dateType] || "";

			const newDateValue = getAllDatesInRelativeRange(
				targetColumn.datedBasedColumn?.from,
				targetColumn.datedBasedColumn?.to,
			)[0];

			// newTask[dateType] = newDateValue;

			updateTaskItemDate(
				plugin,
				oldTask,
				newTask,
				dateType,
				newDateValue,
			);
		} else if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from <=
				targetColumn.datedBasedColumn.to
		) {
			const dateType = targetColumn.datedBasedColumn.dateType;

			// Call the date input modal, to take new date from user.
			// const datePicker = new DatePickerModal(plugin, dateType);
			// datePicker.onDateSelected = async (date: string | null) => {};

			openDateInputModal(
				plugin,
				dateType,
				async (date: string | null) => {
					if (date) {
						// newTask[dateType] = date;
						updateTaskItemDate(
							plugin,
							oldTask,
							newTask,
							dateType,
							date,
						);
					}
				},
			);

			// datePicker.open();
		} else {
			// This code-block should technically not run, since we are not allowing to drop task in dated type column with a range of dates.
			bugReporterManagerInsatance.showNotice(
				30,
				"The column configurations are currupted. Configurations are not valid for this operation. The value of 'from' should be always lower or equal to value of 'to'. Kindly verify the column configuration in which you just dropped the task.",
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!targetColumn.taskPriority) {
			bugReporterManagerInsatance.addToLogs(
				134,
				`The priority value not found in the target column configuration.\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_priority_to_priority",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		// Extract the priority value from the source column
		const targetColumnPrioirty = (targetColumn.taskPriority as number) || 0;

		updateTaskItemPriority(plugin, oldTask, newTask, targetColumnPrioirty);
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!targetColumn.taskStatus) {
			bugReporterManagerInsatance.addToLogs(
				135,
				`The status value not found in the target column configuration.\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_status_to_status",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		// Extract the status value from the source column
		const targetColumnStatusValue =
			(targetColumn.taskStatus as string) || "";

		updateTaskItemStatus(plugin, oldTask, newTask, targetColumnStatusValue);
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
				plugin.settings.data.globalSettings.taskNoteIdentifierTag,
				task.tags,
			)
		) {
			newTask.title = sanitizeStatus(
				plugin.settings.data.globalSettings,
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!currentDragData || !targetColumn.datedBasedColumn) {
			bugReporterManagerInsatance.addToLogs(
				136,
				`No current drag data available for reordering.\ncurrentDragData=${JSON.stringify(currentDragData)}\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_dated_to_dated",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from ===
				targetColumn.datedBasedColumn.to
		) {
			// Determine the date type (startDate, scheduledDate, or due) from datedBasedColumn
			const dateType = targetColumn.datedBasedColumn?.dateType;

			const newDateValue = getAllDatesInRelativeRange(
				targetColumn.datedBasedColumn?.from,
				targetColumn.datedBasedColumn?.to,
			)[0];

			// newTask[dateType] = newDateValue;

			updateTaskItemDate(
				plugin,
				oldTask,
				newTask,
				dateType,
				newDateValue,
			);
		} else if (
			targetColumn.datedBasedColumn &&
			targetColumn.datedBasedColumn.from <=
				targetColumn.datedBasedColumn.to
		) {
			const dateType = targetColumn.datedBasedColumn?.dateType;

			// Call the date input modal, to take new date from user.
			// const datePicker = new DatePickerModal(plugin, dateType);
			// datePicker.onDateSelected = async (date: string | null) => {
			// 	if (date) {
			// 		// newTask[dateType] = date;
			// 		updateTaskItemDate(
			// 			plugin,
			// 			oldTask,
			// 			newTask,
			// 			dateType,
			// 			date,
			// 		);
			// 	}
			// };
			// datePicker.open();

			openDateInputModal(
				plugin,
				dateType,
				async (date: string | null) => {
					if (date) {
						// newTask[dateType] = date;
						updateTaskItemDate(
							plugin,
							oldTask,
							newTask,
							dateType,
							date,
						);
					}
				},
			);
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!targetColumn?.coltag) {
			bugReporterManagerInsatance.addToLogs(
				137,
				`coltag is undefined in the target column.\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_to_namedTag",
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
		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// STEP 3 - Add the target column tag if it doesn't already exist
		let newTags = newTask.tags ?? [];
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!targetColumn.taskPriority) {
			bugReporterManagerInsatance.addToLogs(
				138,
				`The priority value not found in the target column configuration.\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_to_priority",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// Extract the priority value from the source column
		const targetColumnPrioirty = (targetColumn.taskPriority as number) || 0;

		updateTaskItemPriority(plugin, oldTask, newTask, targetColumnPrioirty);
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): Promise<void> => {
		if (!targetColumn.taskStatus) {
			bugReporterManagerInsatance.addToLogs(
				139,
				`The status value not found in the target column configuration.\ntargetColumn=${JSON.stringify(targetColumn)}`,
				"DragDropTasksManager.ts/handleTaskMove_to_status",
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

		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		if (sourceColumn.colType === colTypeNames.completed) {
			newTask = this.handleTaskMove_DONE_to_TODO(plugin, newTask);
		}

		// Extract the status value from the source column
		const targetColumnStatusValue =
			(targetColumn.taskStatus as string) || "";

		updateTaskItemStatus(plugin, oldTask, newTask, targetColumnStatusValue);
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
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
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
		newTask = await this.updateTaskItemOnSwimlaneChange(
			newTask,
			sourceColumnSwimlaneData,
			targetColumnSwimlaneData,
			plugin.settings.data.globalSettings,
		);

		const newStatus =
			plugin.settings.data.globalSettings.customStatuses.find(
				(status) => status.type === statusTypeNames.DONE,
			);

		// FINALLY - Update the task in the note.
		updateTaskItemStatus(
			plugin,
			oldTask,
			newTask,
			newStatus?.symbol ?? "x",
		);
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
		desiredIndex: number | null,
	): void => {
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

		let newSettings = plugin.settings;
		newSettings.data.boardConfigs[
			currentDragData.currentBoardIndex
		].columns[targetColumnData.index - 1] = targetColumnData;

		// Persist settings and refresh the board
		plugin.saveSettings(newSettings);
	};

	/**
	 * Handles reordering of tasks within the same column with swimlane sorting
	 * @param task The task being moved
	 * @param targetColumnData The column data with swimlane sorting
	 * @param desiredIndex The desired index to insert the task at
	 */
	updateTaskItemOnSwimlaneChange = async (
		task: taskItem,
		sourceColumnSwimlaneData: swimlaneDataProp | undefined,
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
		globalSettings: globalSettingsData,
	): Promise<taskItem> => {
		if (!targetColumnSwimlaneData) return task;

		const property = targetColumnSwimlaneData.property;
		const newValue = targetColumnSwimlaneData.value;
		let newTask: taskItem = { ...task };

		if (property === "tags") {
			const oldTags = task.tags ?? [];
			let newTags: string[] = oldTags;
			// Remove old tag of source swimlane
			if (sourceColumnSwimlaneData) {
				const oldValue = sourceColumnSwimlaneData.value;
				if (oldValue !== "All rest") {
					newTags = newTags.filter(
						(tag) =>
							tag.replace("#", "").toLowerCase() !==
							oldValue.replace("#", "").toLowerCase(),
					);
				}
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
				newTags,
			);
		} else {
			newTask = await updateTaskItemProperty(
				newTask,
				globalSettings,
				property,
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
		// draggedTaskItem.classList.add("task-item-dragging-dimmed");

		// Add dragging class after a small delay to not affect the drag image
		requestAnimationFrame(() => {
			// e.dataTransfer?.setDragImage(draggedTaskItem, 0, 0);
			draggedTaskItem.classList.add("task-item-dragging");
		});
	}

	/**
	 * Removes the dim effect from the dragged task item
	 *
	 * @param {HTMLDivElement} draggedTaskItem - The dragged task item DOM element
	 */
	removeDimFromDraggedTaskItem(draggedTaskItem: HTMLDivElement): void {
		draggedTaskItem.classList.remove("task-item-dragging-dimmed");
		draggedTaskItem.classList.remove("task-item-dragging");
	}

	/**
	 * Show a card drop indicator (above or below a card element)
	 *
	 * @param {HTMLElement} cardEl - The card element
	 * @param {boolean} isAbove - True if the indicator should be shown above the card, false otherwise
	 *
	 */
	// * @deprecated - This approach has been deprecated. Will show the indicator directly inside the column component.
	// showCardDropIndicator(cardEl: HTMLElement, isAbove: boolean): void {
	// 	if (!this.plugin) return;
	// 	if (!cardEl || !cardEl.parentElement) return;

	// 	// Create indicator if not already created
	// 	if (!this.dropIndicator) {
	// 		this.dropIndicator = document.createElement("div");
	// 		this.dropIndicator.className =
	// 			"taskboard-drop-indicator is-visible";
	// 		this.dropIndicator.style.position = "absolute";
	// 		this.dropIndicator.style.pointerEvents = "none";
	// 		this.dropIndicator.style.zIndex = "9999";
	// 		this.dropIndicator.style.background =
	// 			"var(--interactive-accent, #5b8cff)";
	// 		this.dropIndicator.style.borderRadius = "4px";
	// 		// default height; adjusted below
	// 		this.dropIndicator.style.height = "4px";
	// 	}

	// 	const rect = cardEl.getBoundingClientRect();
	// 	const parentRect = cardEl.parentElement.getBoundingClientRect();
	// 	const topPos = isAbove
	// 		? `${rect.top - parentRect.top - 6}px`
	// 		: `${rect.bottom - parentRect.top + 2}px`;

	// 	// A proof of concept to show a box instead of a simple line and to move the adjacent cards up or down.
	// 	// cardEl.style.marginBottom = "0px";
	// 	// cardEl.style.marginTop = "0px";
	// 	// if (isAbove) {
	// 	// 	cardEl.style.marginTop = "40px";
	// 	// } else {
	// 	// 	cardEl.style.marginBottom = "40px";
	// 	// }

	// 	this.dropIndicator.style.width = `${rect.width}px`;
	// 	this.dropIndicator.style.left = `${rect.left - parentRect.left}px`;
	// 	this.dropIndicator.style.top = topPos;

	// 	cardEl.parentElement.appendChild(this.dropIndicator);
	// }

	/**
	 * Clears all drag-related styling from all columns
	 *
	 */
	clearAllDragStyling(): void {
		// For column we can do this kind of heavy DOM traversing,
		// since there will be less columns, so querySelecting them all is not so big issue.
		const allColumnContainers = Array.from(
			document.querySelectorAll(".tasksContainer"),
		) as HTMLDivElement[];
		allColumnContainers.forEach((container) => {
			container.classList.remove(
				"drag-over-allowed",
				"drag-over-not-allowed",
			);
		});

		// Remove the dim styling from the dragged components

		// @deprecated - This approach is no longer used.
		// Removes the drop indicator, if the target column had manualOrder sorting and if the dropIndicator was visible.
		// if (this.dropIndicator && this.dropIndicator.parentElement) {
		// 	this.dropIndicator.parentElement.removeChild(this.dropIndicator);
		// }

		// TODO : This feels like overkill, because I am only dimming the single .taskItem which I will be dragging. Optimize this later.
		// Also clear dimming from all task items
		// const allTaskItems = Array.from(
		// 	document.querySelectorAll(".taskItem")
		// ) as HTMLDivElement[];
		// allTaskItems.forEach((item) => {
		// 	item.classList.remove("task-item-dragging-dimmed");
		// });
	}

	/**
	 * Clear column dragover feedback classes from all columns and swimlane columns.
	 */
	private clearDragoverFeedback(): void {
		document
			.querySelectorAll(".tasksContainer.drag-over-allowed")
			.forEach((el) => {
				el.classList.remove("drag-over-allowed");
			});
		document
			.querySelectorAll(".tasksContainer.drag-over-not-allowed")
			.forEach((el) => {
				el.classList.remove("drag-over-not-allowed");
			});
		document
			.querySelectorAll(".TaskBoardColumnsSection.drag-over-allowed")
			.forEach((el) => {
				el.classList.remove("drag-over-allowed");
			});
	}

	// --------------------------------------
	// Touch drag support for mobile / touch devices
	// --------------------------------------

	/**
	 * Attach touch event handlers to a card element for touch-based drag support.
	 * Called from React component's useEffect.
	 * Returns a cleanup function to remove the listeners.
	 */
	setupCardTouchHandlers(
		cardWrapper: HTMLElement,
		dragData: currentDragDataPayload,
	): () => void {
		const cleanup = () => {};

		if (!this.shouldEnableTouchDrag()) return cleanup;

		const handleTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 1) return;
			const touch = e.touches[0];
			this.touchStartX = touch.clientX;
			this.touchStartY = touch.clientY;
			this.longPressTimer = window.setTimeout(() => {
				this.initiateTouchDrag(
					cardWrapper,
					dragData,
					touch.clientX,
					touch.clientY,
				);
			}, this.LONG_PRESS_DELAY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 1) return;
			const touch = e.touches[0];

			if (!this.touchDragActive && this.longPressTimer) {
				const dx = Math.abs(touch.clientX - this.touchStartX);
				const dy = Math.abs(touch.clientY - this.touchStartY);
				if (
					dx > this.TOUCH_MOVE_THRESHOLD ||
					dy > this.TOUCH_MOVE_THRESHOLD
				) {
					window.clearTimeout(this.longPressTimer);
					this.longPressTimer = null;
				}
				return;
			}

			if (this.touchDragActive) {
				e.preventDefault();
				this.autoScrollLastX = touch.clientX;
				this.autoScrollLastY = touch.clientY;
				this.updateTouchDragGhost(touch.clientX, touch.clientY);
				// this.clearDragoverFeedback();

				// @todo - BUG : The below function is not able to find the correct column container at the cusor position. As well as, it adds a little lagginess providing a bad experience. If we dont do the below thing, that the dragging experience is much smoother.
				// this.updateTouchDropTargetFeedback(
				// 	touch.clientX,
				// 	touch.clientY,
				// );
			}
		};

		const handleTouchEnd = (e: TouchEvent) => {
			if (this.longPressTimer) {
				window.clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}

			if (!this.touchDragActive) return;

			const touch = e.changedTouches[0];
			if (touch) {
				this.handleTouchDrop(touch.clientX, touch.clientY);
			}

			this.clearTouchDragState();
		};

		const handleTouchCancel = () => {
			this.clearTouchDragState();
		};

		cardWrapper.addEventListener("touchstart", handleTouchStart, {
			passive: true,
		});
		cardWrapper.addEventListener("touchmove", handleTouchMove, {
			passive: false,
		});
		cardWrapper.addEventListener("touchend", handleTouchEnd);
		cardWrapper.addEventListener("touchcancel", handleTouchCancel);

		return () => {
			cardWrapper.removeEventListener("touchstart", handleTouchStart);
			cardWrapper.removeEventListener("touchmove", handleTouchMove);
			cardWrapper.removeEventListener("touchend", handleTouchEnd);
			cardWrapper.removeEventListener("touchcancel", handleTouchCancel);
		};
	}

	private initiateTouchDrag(
		cardWrapper: HTMLElement,
		dragData: currentDragDataPayload,
		x: number,
		y: number,
	): void {
		this.touchDragActive = true;
		this.touchDragElement = cardWrapper;
		this.setCurrentDragData(dragData);

		document.addEventListener(
			"contextmenu",
			this.boundContextMenuBlocker,
			true,
		);
		document.body.classList.add("taskboard-touch-dragging");

		cardWrapper.classList.add("task-item-dragging");
		this.touchDragGhost = this.createTouchDragGhost(cardWrapper, x, y);
		navigator.vibrate?.(50);
		this.startTouchAutoScroll();
	}

	private createTouchDragGhost(
		sourceEl: HTMLElement,
		x: number,
		y: number,
	): HTMLElement {
		const ghost = sourceEl.cloneNode(true) as HTMLElement;
		ghost.classList.add("taskboard-touch-ghost");
		ghost.style.cssText = `
			position: fixed;
			left: ${x}px;
			top: ${y}px;
			width: ${sourceEl.offsetWidth}px;
			pointer-events: none;
			z-index: 10000;
			opacity: 0.85;
			transform: translate(-50%, -50%) rotate(3deg);
			box-shadow: 0 8px 24px rgba(0,0,0,0.3);
		`;
		const doc = sourceEl.ownerDocument;
		doc.body.appendChild(ghost);
		return ghost;
	}

	private updateTouchDragGhost(x: number, y: number): void {
		if (this.touchDragGhost) {
			this.touchDragGhost.style.left = `${x}px`;
			this.touchDragGhost.style.top = `${y}px`;
		}
	}

	private removeTouchDragGhost(): void {
		if (this.touchDragGhost) {
			this.touchDragGhost.remove();
			this.touchDragGhost = null;
		}
	}

	private clearTouchDragState(): void {
		this.touchDragActive = false;
		document.removeEventListener(
			"contextmenu",
			this.boundContextMenuBlocker,
			true,
		);
		document.body.classList.remove("taskboard-touch-dragging");
		this.removeTouchDragGhost();
		this.stopTouchAutoScroll();

		if (this.longPressTimer) {
			window.clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}

		this.clearDragoverFeedback();

		if (this.touchDragElement) {
			this.touchDragElement.classList.remove("task-item-dragging");
			this.touchDragElement = null;
		}

		this.clearAllDragStyling();
		this.clearCurrentDragData();
	}

	/**
	 * Update column drop target feedback based on touch coordinates.
	 */
	private updateTouchDropTargetFeedback(x: number, y: number): void {
		this.clearDragoverFeedback();

		// const elementUnder = document.elementFromPoint(x, y);
		// if (!elementUnder) return;

		// const columnEl = (elementUnder as HTMLElement).closest(
		// 	".TaskBoardColumnsSection",
		// ) as HTMLElement | null;
		// if (!columnEl) return;

		// const tasksContainer = columnEl.querySelector(
		// 	".tasksContainer",
		// ) as HTMLElement | null;
		// if (!tasksContainer) return;

		// const columnId = columnEl.getAttribute("data-column-id");
		// if (!columnId) return;
		// const targetColumnData = boardConfigs[currentDragData.currentBoardIndex]?.columns.find(c => String(c.id) === columnId);

		const currentDragData = this.getCurrentDragData();
		if (!currentDragData) return;
		const boardConfigs = this.plugin?.settings.data.boardConfigs;
		if (!boardConfigs) return;

		if (!this.targetColumnData) return;

		const isDropAllowed = this.isTaskDropAllowed(
			currentDragData.sourceColumnData,
			this.targetColumnData,
		);

		if (!this.targetColumnContainer) return;

		if (isDropAllowed) {
			this.targetColumnContainer.classList.add("drag-over-allowed");
			this.targetColumnContainer.classList.remove(
				"drag-over-not-allowed",
			);
		} else {
			this.targetColumnContainer.classList.add("drag-over-not-allowed");
			this.targetColumnContainer.classList.remove("drag-over-allowed");
		}
	}

	/**
	 * Handle the drop action at the end of a touch drag.
	 */
	private handleTouchDrop(x: number, y: number): void {
		const elementUnder = document.elementFromPoint(x, y);
		if (!elementUnder) return;

		const columnEl = (elementUnder as HTMLElement).closest(
			".TaskBoardColumnsSection",
		) as HTMLElement | null;
		if (!columnEl) return;

		const tasksContainer = columnEl.querySelector(
			".tasksContainer",
		) as HTMLElement | null;
		if (!tasksContainer) return;

		const currentDragData = this.getCurrentDragData();
		if (!currentDragData) return;

		const columnId = columnEl.getAttribute("data-column-id");
		if (!columnId) return;

		const boardConfigs = this.plugin?.settings.data.boardConfigs;
		if (!boardConfigs) return;

		const targetColumnData = boardConfigs[
			currentDragData.currentBoardIndex
		]?.columns.find((c) => String(c.id) === columnId);
		if (!targetColumnData) return;

		// Determine swimlane data from DOM
		let targetSwimlane: swimlaneDataProp | undefined;
		const swimlaneContainer = columnEl.closest(
			"[data-swimlane]",
		) as HTMLElement | null;
		if (swimlaneContainer) {
			const swimlaneName =
				swimlaneContainer.getAttribute("data-swimlane") ?? undefined;
			const swimlaneProperty =
				swimlaneContainer.getAttribute("data-swimlane-property") ?? "";
			if (swimlaneName) {
				targetSwimlane = {
					value: swimlaneName,
					property: swimlaneProperty,
				};
			}
		}

		// Find insertion index if hovering over a task card
		const taskCardEl = (elementUnder as HTMLElement).closest(
			"[data-taskitem-index]",
		) as HTMLElement | null;
		if (
			taskCardEl &&
			targetColumnData.sortCriteria?.some(
				(c) => c.criteria === "manualOrder",
			)
		) {
			const rect = taskCardEl.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			const idx = parseInt(
				taskCardEl.getAttribute("data-taskitem-index") ?? "0",
				10,
			);
			const insertAt = y < midpoint ? idx : idx + 1;
			this.setDesiredDropIndex(insertAt);
		} else {
			this.clearDesiredDropIndex();
		}

		// Call the existing drop handler
		this.handleDropEvent(
			new DragEvent("drop"),
			targetColumnData,
			tasksContainer as HTMLDivElement,
			targetSwimlane,
		);

		this.clearDesiredDropIndex();
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
	 */
	public handleDragStartEvent(
		e: DragEvent,
		draggedTaskItem: HTMLDivElement,
		currentDragData: currentDragDataPayload,
	): void {
		if (!e.dataTransfer) return;

		this.setCurrentDragData(currentDragData);

		this.startAutoScroll();

		e.dataTransfer.effectAllowed = "move";

		// Set improved drag image (full card clone instead of browser default thumbnail)
		this.setElementDragImage(e, draggedTaskItem, "taskboard-drag-image");

		// Visual dim / dragging class
		this.dimDraggedTaskItem(draggedTaskItem);
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
		// if (
		// 	this.currentDragData &&
		// 	cardEl.getAttribute("data-taskitem-id") ===
		// 		this.currentDragData.task.id
		// ) {
		// 	return;
		// }

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
	 *
	 * @returns - true if drop is allowed in the hovered column, else false.
	 */
	public handleColumnDragOverEvent(
		e: DragEvent,
		targetColumnData: ColumnData,
		targetColumnContainer: HTMLDivElement,
	): boolean {
		console.log("DragDropTasksManager : handleDragOver called...");
		e.preventDefault();
		console.log("DragDropTasksManager : For phone...");

		const sourceColumnData = this.currentDragData
			? this.currentDragData.sourceColumnData
			: null;
		if (!sourceColumnData) {
			bugReporterManagerInsatance.addToLogs(
				141,
				`No source column data available for dragover.\nSourceColumn=${JSON.stringify(sourceColumnData)}`,
				"DragDropTasksManager.ts/handleColumnDragOverEvent",
			);
			return false;
		}

		this.targetColumnData = targetColumnData;
		this.targetColumnContainer = targetColumnContainer;

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
		// if (this.dropIndicator && this.dropIndicator.parentElement) {
		// 	this.dropIndicator.parentElement.removeChild(this.dropIndicator);
		// }
		// this.dropIndicator = null;

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
		targetColumnSwimlaneData: swimlaneDataProp | undefined,
	): void {
		e.preventDefault();

		this.targetColumnData = targetColumnData;
		this.targetColumnContainer = targetColumnContainer;

		// All checks before proceeding with the calculations...
		if (!this.currentDragData) {
			bugReporterManagerInsatance.addToLogs(
				142,
				`No current drag data available for drop operation.\currentDragData=${JSON.stringify(this.currentDragData)}`,
				"DragDropTasksManager.ts/handleDropEvent",
			);
			return;
		}

		const sourceColumnData = this.currentDragData.sourceColumnData;
		const sourceColumnSwimlaneData = this.currentDragData.swimlaneData;
		if (!sourceColumnData) {
			bugReporterManagerInsatance.addToLogs(
				143,
				`There was an error while capturing the source column data.\sourceColumnData=${JSON.stringify(sourceColumnData)}`,
				"DragDropTasksManager.ts/handleDropEvent",
			);
			return;
		}

		// Remove drag-over styling from target
		targetColumnContainer.classList.remove(
			"drag-over-allowed",
			"drag-over-not-allowed",
		);
		this.clearAllDragStyling();

		// Check if drop is allowed
		const isDropAllowed = this.isTaskDropAllowed(
			sourceColumnData,
			targetColumnData,
		);

		if (!isDropAllowed) {
			new Notice(
				`Task drop not allowed from column type: ${sourceColumnData.colType} to column type: ${targetColumnData.colType}`,
			);
			return;
		}

		// Perform required operations to update task properties
		// This is where the actual task update logic will be implemented
		// console.log("Task drop allowed. Updating task properties...");
		// console.log("Source column:", sourceColumnData);
		// console.log("Target column:", targetColumnData);
		// console.log("Current drag data:", this.currentDragData);
		// console.log("Current drag index:", this.desiredDropIndex);
		// console.log("targetSwimilaneData", targetColumnSwimlaneData);

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
