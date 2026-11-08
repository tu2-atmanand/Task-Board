import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TFile, Notice } from "obsidian";
import Sortable from "sortablejs";
import { GripVertical } from "lucide-react";
import TaskBoard from "../../../../main.js";
import { Board, TaskBoardViewType, TableView as TableViewConfig } from "../../../interfaces/BoardConfigs.js";
import { DEFAULT_TASK_CACHE_KEYS, statusTypeNames } from "../../../interfaces/Enums.js";
import { taskItemKeyToNameMapping, getPriorityOptionsForDropdown } from "../../../interfaces/Mapping.js";
import { taskJsonMerged, taskItem } from "../../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../../managers/BugReporter.js";
import { sanitizeTags, sanitizeStatus, sanitizePriority, sanitizeTime, sanitizeCreatedDate, sanitizeStartDate, sanitizeScheduledDate, sanitizeDueDate, sanitizeReminder, sanitizeCompletionDate, sanitizeCancelledDate, sanitizeDependsOn } from "../../../utils/taskLine/TaskContentFormatter.js";
import { updateTaskInFile } from "../../../utils/taskLine/TaskLineUtils.js";
import { handleTaskNoteBodyChange } from "../../../utils/taskNote/TaskNoteEventHandlers.js";
import { isTaskNotePresentInTags, updateFrontmatterInMarkdownFile } from "../../../utils/taskNote/TaskNoteUtils.js";

interface TableViewProps {
	plugin: TaskBoard;
	currentBoardData: Board;
	currentView: TaskBoardViewType;
	currentViewIndex: number;
	filteredAndSearchedTasks: taskJsonMerged;
}

type TableColumnKey = keyof taskItem | "dateModified";

const INITIAL_TASK_COUNT = 50;
const TASKS_PER_BATCH = 20;
const LOAD_MORE_THRESHOLD = 400;
const MIN_COLUMN_WIDTH = 80;

const tableColumns = Object.keys(taskItemKeyToNameMapping) as TableColumnKey[];

const columnVisibilityProperty: Partial<Record<TableColumnKey, DEFAULT_TASK_CACHE_KEYS[]>> = {
	id: [DEFAULT_TASK_CACHE_KEYS.ID],
	title: [DEFAULT_TASK_CACHE_KEYS.Title],
	body: [DEFAULT_TASK_CACHE_KEYS.SubTasks, DEFAULT_TASK_CACHE_KEYS.SubTasksMinimized],
	status: [DEFAULT_TASK_CACHE_KEYS.Status],
	priority: [DEFAULT_TASK_CACHE_KEYS.Priority],
	tags: [DEFAULT_TASK_CACHE_KEYS.Tags],
	frontmatterTags: [DEFAULT_TASK_CACHE_KEYS.Tags],
	time: [DEFAULT_TASK_CACHE_KEYS.Time],
	reminder: [DEFAULT_TASK_CACHE_KEYS.Reminder],
	createdDate: [DEFAULT_TASK_CACHE_KEYS.CreatedDate],
	startDate: [DEFAULT_TASK_CACHE_KEYS.StartDate],
	scheduledDate: [DEFAULT_TASK_CACHE_KEYS.ScheduledDate],
	due: [DEFAULT_TASK_CACHE_KEYS.DueDate],
	dependsOn: [DEFAULT_TASK_CACHE_KEYS.Dependencies],
	completion: [DEFAULT_TASK_CACHE_KEYS.CompletionDate],
	cancelledDate: [DEFAULT_TASK_CACHE_KEYS.CancelledDate],
	filePath: [DEFAULT_TASK_CACHE_KEYS.FilePath],
};

const editableColumns = new Set<TableColumnKey>([
	"title", "body", "status", "priority", "tags", "time", "reminder",
	"createdDate", "startDate", "scheduledDate", "due", "dependsOn",
	"completion", "cancelledDate",
]);

const defaultColumnWidth = (column: TableColumnKey): number => {
	if (column === "title") return 260;
	if (column === "body") return 220;
	return 150;
};

const TableView: React.FC<TableViewProps> = ({
	plugin,
	currentBoardData,
	currentView,
	currentViewIndex,
	filteredAndSearchedTasks,
}) => {
	const [tableViewData, setTableViewData] = useState<TableViewConfig>(() => currentView.tableView ?? {});
	const [visibleTaskCount, setVisibleTaskCount] = useState(INITIAL_TASK_COUNT);
	const [editingCell, setEditingCell] = useState<{ task: taskItem; column: TableColumnKey; value: string } | null>(null);
	const tableContainerRef = useRef<HTMLDivElement>(null);
	const headerRowRef = useRef<HTMLTableRowElement>(null);
	const tableViewDataRef = useRef(tableViewData);
	const visibleTaskCountRef = useRef(visibleTaskCount);
	const isLoadingMoreRef = useRef(false);
	const resizeCleanupRef = useRef<(() => void) | null>(null);

	const visiblePropertyKeys = (plugin.settings.data.propertiesVisibleInUI ?? []).join("\u0000");
	const visibleColumns = useMemo(() => {
		const visibleProperties = new Set(visiblePropertyKeys.split("\u0000"));
		const orderedColumns = tableColumns.filter((column) => (tableViewData.columnOrder ?? []).includes(column));
		const completeColumnOrder = [...orderedColumns, ...tableColumns.filter((column) => !orderedColumns.includes(column))];
		return completeColumnOrder.filter((column) =>
			(columnVisibilityProperty[column] ?? []).some((property) => visibleProperties.has(property)),
		);
	}, [visiblePropertyKeys, tableViewData.columnOrder]);

	const allTasks = useMemo(
		() => [...filteredAndSearchedTasks.Pending, ...filteredAndSearchedTasks.Completed],
		[filteredAndSearchedTasks],
	);

	useEffect(() => {
		const viewData = currentView.tableView ?? {};
		tableViewDataRef.current = viewData;
		setTableViewData(viewData);
	}, [currentBoardData.id, currentView.viewId, currentView.tableView]);

	useEffect(() => {
		visibleTaskCountRef.current = visibleTaskCount;
	}, [visibleTaskCount]);

	useEffect(() => {
		setVisibleTaskCount(INITIAL_TASK_COUNT);
		visibleTaskCountRef.current = INITIAL_TASK_COUNT;
		if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
	}, [allTasks]);

	useEffect(() => () => {
		resizeCleanupRef.current?.();
	}, []);

	const updateTableViewData = useCallback((updates: Partial<TableViewConfig>, save: boolean) => {
		const updatedTableViewData = { ...tableViewDataRef.current, ...updates };
		tableViewDataRef.current = updatedTableViewData;
		setTableViewData(updatedTableViewData);

		if (save) {
			const updatedViews = [...currentBoardData.views];
			updatedViews[currentViewIndex] = {
				...updatedViews[currentViewIndex],
				tableView: updatedTableViewData,
			};
			plugin.taskBoardFileManager.debouncedSaveBoard({
				...currentBoardData,
				views: updatedViews,
			});
		}
	}, [currentBoardData, currentViewIndex, plugin]);

	useEffect(() => {
		const headerRow = headerRowRef.current;
		if (!headerRow) return;

		const sortable = Sortable.create(headerRow, {
			animation: 150,
			direction: "horizontal",
			draggable: "th[data-column-key]",
			handle: ".taskBoardTableDragHandle",
			onEnd: () => {
				const columnOrder = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th[data-column-key]"))
					.map((header) => header.dataset.columnKey)
					.filter((column): column is string => column !== undefined);
				updateTableViewData({ columnOrder }, true);
			},
		});
		return () => sortable.destroy();
	}, [visibleColumns, updateTableViewData]);

	const getCellValue = useCallback((task: taskItem, column: TableColumnKey): string | number => {
		if (column === "dateModified") {
			const file = plugin.app.vault.getAbstractFileByPath(task.filePath);
			return file instanceof TFile ? file.stat.mtime : "";
		}

		const value = task[column];
		if (value === undefined || value === null) return "";
		if (Array.isArray(value)) return value.join(column === "body" ? "\n" : ", ");
		if (typeof value === "object") {
			if (column === "taskLocation" && "startLine" in value && "endLine" in value) {
				return `${value.startLine + 1}:${value.startCharIndex + 1}-${value.endLine + 1}:${value.endCharIndex + 1}`;
			}
			return JSON.stringify(value);
		}
		return value;
	}, [plugin]);

	const sortedTasks = useMemo(() => {
		if (!tableViewData.sortColumn) return allTasks;

		const sortColumn = tableViewData.sortColumn as TableColumnKey;
		const direction = tableViewData.sortDirection === "desc" ? -1 : 1;
		return allTasks
			.map((task, index) => ({ task, index, value: getCellValue(task, sortColumn) }))
			.sort((first, second) => {
				const firstValue = first.value;
				const secondValue = second.value;
				if (firstValue === "" && secondValue !== "") return 1;
				if (secondValue === "" && firstValue !== "") return -1;
				if (typeof firstValue === "number" && typeof secondValue === "number") {
					return (firstValue - secondValue) * direction || first.index - second.index;
				}
				return String(firstValue).localeCompare(String(secondValue), undefined, {
					numeric: true,
					sensitivity: "base",
				}) * direction || first.index - second.index;
			})
			.map(({ task }) => task);
	}, [allTasks, getCellValue, tableViewData.sortColumn, tableViewData.sortDirection]);

	const visibleTasks = sortedTasks.slice(0, visibleTaskCount);

	const handleScroll = useCallback(() => {
		const container = tableContainerRef.current;
		if (!container || isLoadingMoreRef.current || visibleTaskCountRef.current >= sortedTasks.length) return;

		const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
		if (distanceToBottom <= LOAD_MORE_THRESHOLD) {
			isLoadingMoreRef.current = true;
			setVisibleTaskCount((count) => Math.min(count + TASKS_PER_BATCH, sortedTasks.length));
			window.setTimeout(() => {
				isLoadingMoreRef.current = false;
			}, 100);
		}
	}, [sortedTasks.length]);

	const handleSort = (column: TableColumnKey) => {
		const isSameColumn = tableViewData.sortColumn === column;
		updateTableViewData({
			sortColumn: column,
			sortDirection: isSameColumn && tableViewData.sortDirection !== "desc" ? "desc" : "asc",
		}, true);
		setVisibleTaskCount(INITIAL_TASK_COUNT);
		visibleTaskCountRef.current = INITIAL_TASK_COUNT;
		if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
	};

	const handleResizeStart = (column: TableColumnKey, event: React.PointerEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.stopPropagation();
		resizeCleanupRef.current?.();

		const startX = event.clientX;
		const startWidth = tableViewDataRef.current.columnWidths?.[column] ?? defaultColumnWidth(column);
		let nextWidth = startWidth;
		const handlePointerMove = (moveEvent: PointerEvent) => {
			nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
			const columnWidths = {
				...tableViewDataRef.current.columnWidths,
				[column]: nextWidth,
			};
			updateTableViewData({ columnWidths }, false);
		};
		const cleanup = () => {
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
			document.body.classList.remove("taskBoardTableResizing");
			resizeCleanupRef.current = null;
		};
		const handlePointerUp = () => {
			cleanup();
			updateTableViewData({
				columnWidths: {
					...tableViewDataRef.current.columnWidths,
					[column]: nextWidth,
				},
			}, true);
		};

		document.body.classList.add("taskBoardTableResizing");
		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);
		resizeCleanupRef.current = cleanup;
	};

	const handleResizeKeyDown = (column: TableColumnKey, event: React.KeyboardEvent<HTMLSpanElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		const currentWidth = tableViewDataRef.current.columnWidths?.[column] ?? defaultColumnWidth(column);
		const widthAdjustment = event.key === "ArrowRight" ? 16 : -16;
		updateTableViewData({
			columnWidths: {
				...tableViewDataRef.current.columnWidths,
				[column]: Math.max(MIN_COLUMN_WIDTH, currentWidth + widthAdjustment),
			},
		}, true);
	};

	const renderCellValue = (task: taskItem, column: TableColumnKey): string => {
		const value = getCellValue(task, column);
		if (value === "") return "—";
		if (column === "dateModified" && typeof value === "number") {
			return new Date(value).toLocaleString();
		}
		return String(value);
	};

	const beginCellEdit = (task: taskItem, column: TableColumnKey) => {
		if (!editableColumns.has(column)) return;
		setEditingCell({ task, column, value: renderCellValue(task, column) === "—" ? "" : renderCellValue(task, column) });
	};

	const saveCellEdit = async () => {
		if (!editingCell) return;
		const { task, column, value } = editingCell;
		setEditingCell(null);
		if (value === renderCellValue(task, column)) return;

		try {
			const isTaskNote = isTaskNotePresentInTags(plugin.settings.data.taskNoteIdentifierTag, task.tags);
			const updatedTask: taskItem = { ...task };

			switch (column) {
				case "title":
					updatedTask.title = value;
					break;
				case "body":
					updatedTask.body = value ? value.split(/\r?\n/) : [];
					break;
				case "status":
					updatedTask.status = value;
					break;
				case "priority":
					updatedTask.priority = Number(value);
					break;
				case "tags":
					updatedTask.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean)
						.map((tag) => tag.startsWith("#") ? tag : `#${tag}`);
					break;
				case "time":
					updatedTask.time = value;
					break;
				case "reminder":
					updatedTask.reminder = value;
					break;
				case "createdDate":
					updatedTask.createdDate = value;
					break;
				case "startDate":
					updatedTask.startDate = value;
					break;
				case "scheduledDate":
					updatedTask.scheduledDate = value;
					break;
				case "due":
					updatedTask.due = value;
					break;
				case "dependsOn":
					updatedTask.dependsOn = value.split(",").map((id) => id.trim()).filter(Boolean);
					break;
				case "completion":
					updatedTask.completion = value;
					break;
				case "cancelledDate":
					updatedTask.cancelledDate = value;
					break;
				default:
					throw new Error(`Editing ${column} is not supported.`);
			}

			if (!isTaskNote) {
				if (column === "tags") {
					updatedTask.title = sanitizeTags(task.title, updatedTask.tags);
				} else if (column === "status") {
					updatedTask.title = sanitizeStatus(
						plugin.settings.data,
						task.title,
						value,
						plugin.settings.data.customStatuses.find((status) => status.symbol === value)?.type ?? statusTypeNames.TODO,
					);
				} else if (column === "priority") {
					updatedTask.title = sanitizePriority(plugin.settings.data, task.title, Number(value));
				} else if (column === "time") {
					updatedTask.title = sanitizeTime(plugin.settings.data, task.title, value);
				} else if (column === "createdDate") {
					updatedTask.title = sanitizeCreatedDate(plugin.settings.data, task.title, value);
				} else if (column === "startDate") {
					updatedTask.title = sanitizeStartDate(plugin.settings.data, task.title, value);
				} else if (column === "scheduledDate") {
					updatedTask.title = sanitizeScheduledDate(plugin.settings.data, task.title, value);
				} else if (column === "due") {
					updatedTask.title = sanitizeDueDate(plugin.settings.data, task.title, value);
				} else if (column === "reminder") {
					updatedTask.title = sanitizeReminder(plugin.settings.data, task.title, value);
				} else if (column === "completion") {
					updatedTask.title = sanitizeCompletionDate(plugin.settings.data, task.title, value);
				} else if (column === "cancelledDate") {
					updatedTask.title = sanitizeCancelledDate(plugin.settings.data, task.title, value);
				} else if (column === "dependsOn") {
					updatedTask.title = sanitizeDependsOn(plugin.settings.data, task.title, updatedTask.dependsOn ?? []);
				}
			}

			if (isTaskNote) {
				if (column === "body") {
					await handleTaskNoteBodyChange(plugin, task, updatedTask);
				} else {
					await updateFrontmatterInMarkdownFile(plugin, updatedTask);
					await plugin.realTimeScanner.processAllUpdatedFiles(task.filePath, task.id);
				}
			} else {
				const updated = await updateTaskInFile(plugin, updatedTask, task);
				if (!updated) throw new Error(`Could not update task ${task.id} in ${task.filePath}`);
				await plugin.realTimeScanner.processAllUpdatedFiles(task.filePath, task.id);
			}
		} catch (error) {
			new Notice(`Could not update ${taskItemKeyToNameMapping[column]}: ${String(error)}`);
			bugReporterManagerInsatance.addToLogs(
				240,
				String(error),
				"TableView.tsx/saveCellEdit",
			);
		}
	};

	const renderCellEditor = (task: taskItem, column: TableColumnKey) => {
		const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
			if (event.key === "Enter") {
				if (column === "body" && event.shiftKey) return;
				event.preventDefault();
				void saveCellEdit();
			} else if (event.key === "Escape") {
				setEditingCell(null);
			}
		};
		if (column === "priority") {
			return (
				<select className="taskBoardEditableCellSelect" autoFocus value={editingCell?.value ?? ""} onChange={(event) => {
					setEditingCell((current) => current ? { ...current, value: event.target.value } : current);
				}} onKeyDown={onKeyDown}>
					{getPriorityOptionsForDropdown().map((option) => (
						<option key={option.value} value={option.value}>{option.text}</option>
					))}
				</select>
			);
		}
		if (column === "status") {
			return (
				<select className="taskBoardEditableCellSelect" autoFocus value={editingCell?.value ?? ""} onChange={(event) => {
					setEditingCell((current) => current ? { ...current, value: event.target.value } : current);
				}} onKeyDown={onKeyDown}>
					{!plugin.settings.data.customStatuses.some((status) => status.symbol === editingCell?.value) && (
						<option value={editingCell?.value ?? ""}>{editingCell?.value || " "}</option>
					)}
					{plugin.settings.data.customStatuses.map((status) => (
						<option key={status.symbol} value={status.symbol}>{status.name}</option>
					))}
				</select>
			);
		}
		if (column === "body") {
			return (
				<textarea
					autoFocus
					className="taskBoardEditableCellInput"
					value={editingCell?.value ?? ""}
					onChange={(event) => setEditingCell((current) => current ? { ...current, value: event.target.value } : current)}
					onKeyDown={onKeyDown}
					aria-label={`Edit ${taskItemKeyToNameMapping[column]} for ${task.title}`}
				/>
			);
		}
		return (
			<input
				autoFocus
				className="taskBoardEditableCellInput"
				type="text"
				value={editingCell?.value ?? ""}
				onChange={(event) => setEditingCell((current) => current ? { ...current, value: event.target.value } : current)}
				onKeyDown={onKeyDown}
				aria-label={`Edit ${taskItemKeyToNameMapping[column]} for ${task.title}`}
			/>
		);
	};

	return (
		<div className={`taskBoardTableView${tableViewData.wrapText === false ? " taskBoardTableView--noWrap" : ""}`}>
			<div className="taskBoardTableViewScrollContainer" ref={tableContainerRef} onScroll={handleScroll}>
				<table className="taskBoardTable">
					<colgroup>
						{visibleColumns.map((column) => (
							<col
								key={column}
								style={{ width: `${tableViewData.columnWidths?.[column] ?? defaultColumnWidth(column)}px` }}
							/>
						))}
					</colgroup>
					<thead>
						<tr ref={headerRowRef}>
							{visibleColumns.map((column) => (
								<th key={column} data-column-key={column} aria-sort={tableViewData.sortColumn === column
									? tableViewData.sortDirection === "desc" ? "descending" : "ascending"
									: "none"}>
									<GripVertical className="taskBoardTableDragHandle" size={14} aria-label={`Reorder ${taskItemKeyToNameMapping[column]} column`} />
									<button type="button" className="taskBoardTableSortButton" onClick={() => handleSort(column)}>
										{taskItemKeyToNameMapping[column]}
										{tableViewData.sortColumn === column && (
											<span aria-hidden="true">{tableViewData.sortDirection === "desc" ? " ↓" : " ↑"}</span>
										)}
									</button>
									<span
										className="taskBoardTableResizeHandle"
										role="separator"
										aria-orientation="vertical"
										aria-label={`Resize ${taskItemKeyToNameMapping[column]} column`}
										aria-valuemin={MIN_COLUMN_WIDTH}
										aria-valuenow={tableViewData.columnWidths?.[column] ?? defaultColumnWidth(column)}
										tabIndex={0}
										onPointerDown={(event) => handleResizeStart(column, event)}
										onKeyDown={(event) => handleResizeKeyDown(column, event)}
									/>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{visibleTasks.map((task, index) => (
							<tr key={`${task.id}-${index}`}>
								{visibleColumns.map((column) => (
									<td
										key={column}
										title={renderCellValue(task, column)}
										onDoubleClick={() => beginCellEdit(task, column)}
										className={editableColumns.has(column) ? "taskBoardTableEditableCell" : ""}
									>
										{editingCell?.task.id === task.id && editingCell.column === column
											? renderCellEditor(task, column)
											: renderCellValue(task, column)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{visibleTaskCount < sortedTasks.length && (
					<div className="taskBoardTableLoadingMore" aria-live="polite">
						Showing {visibleTasks.length} of {sortedTasks.length} tasks
					</div>
				)}
				{sortedTasks.length === 0 && <div className="taskBoardTableEmpty">No tasks to display.</div>}
			</div>
		</div>
	);
};

export default memo(TableView);
