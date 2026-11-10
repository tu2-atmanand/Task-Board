import { Component, Notice, View } from "obsidian";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { t } from "i18next";
import TaskBoard from "../../../../main.js";
import type { Board, ColumnData, InboxView as InboxViewConfig, TaskBoardViewType } from "../../../interfaces/BoardConfigs.js";
import { colTypeNames, HeaderTruncationOptions, HeaderUITypeOptions, viewTypeNames } from "../../../interfaces/Enums.js";
import { taskItem, taskJsonMerged } from "../../../interfaces/TaskItem.js";
import { ConfigureColumnSortingModal } from "../../modals/ConfigureColumnSortingModal.js";
import { ClosePopupConfrimationModal } from "../../modals/ClosePopupConfrimationModal.js";
import { eventEmitter } from "../../../services/EventEmitter.js";
import { TaskEditorRC } from "../../../components/TaskEditorRC.js";
import LazyColumn from "../KanbanView/LazyColumn.js";
import { isTaskNotePresentInTags, updateFrontmatterInMarkdownFile } from "../../../utils/task_note/TaskNoteUtils.js";
import { readDataOfVaultFile, writeDataToVaultFile } from "../../../utils/MarkdownFileOperations.js";
import { updateTaskInFile } from "../../../utils/task_line/TaskLineUtils.js";
import { columnSortingAlgorithm } from "../../../core/algorithms/ColumnSortingAlgorithm.js";

interface InboxViewProps {
	plugin: TaskBoard;
	parentComponent: Component | View;
	currentBoardData: Board;
	currentView: TaskBoardViewType;
	currentViewIndex: number;
	filteredTasks: taskJsonMerged;
}

const DEFAULT_LIST_WIDTH = 360;
const MIN_LIST_WIDTH = 220;
const DEFAULT_INBOX_CONFIG: InboxViewConfig = {
	column: {
		id: 0,
		index: 1,
		colType: colTypeNames.undated,
		active: true,
		name: "Inbox",
		sortCriteria: [],
		tasksIdManualOrder: [],
	},
	listWidth: DEFAULT_LIST_WIDTH,
};

const InboxView: React.FC<InboxViewProps> = ({
	plugin,
	parentComponent,
	currentBoardData,
	currentView,
	currentViewIndex,
	filteredTasks,
}) => {
	const [inboxConfig, setInboxConfig] = useState<InboxViewConfig>(() => currentView.inboxView ?? DEFAULT_INBOX_CONFIG);
	const columnData = inboxConfig.column;
	const [listWidth, setListWidth] = useState(inboxConfig?.listWidth ?? DEFAULT_LIST_WIDTH);
	const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(() => filteredTasks.Pending[0]?.id ?? filteredTasks.Completed[0]?.id);
	const [editorTask, setEditorTask] = useState<{ task: taskItem; noteContent: string }>();
	const [editorLoadError, setEditorLoadError] = useState<string>();
	const [editorVersion, setEditorVersion] = useState(0);
	const [isEditorEdited, setIsEditorEdited] = useState(false);
	const editorRootRef = useRef<HTMLDivElement>(null);
	const resizingRef = useRef(false);
	const resizeCleanupRef = useRef<(() => void) | null>(null);
	const migratedViewIdRef = useRef<string>();

	const tasks = useMemo(() => {
		const allTasks = [...filteredTasks.Pending, ...filteredTasks.Completed];
		const sortCriteria = columnData?.sortCriteria ?? [];
		const manualOrder = sortCriteria.some((criteria) => criteria.criteria === "manualOrder");

		if (!sortCriteria.length) return allTasks;
		if (manualOrder) {
			const taskById = new Map(allTasks.map((task) => [task.id, task]));
			const orderedTasks = (columnData?.tasksIdManualOrder ?? [])
				.map((id) => taskById.get(id))
				.filter((task): task is taskItem => task !== undefined);
			const orderedIds = new Set(orderedTasks.map((task) => task.id));
			return [...orderedTasks, ...allTasks.filter((task) => !orderedIds.has(task.id))];
		}

		return columnSortingAlgorithm(plugin.settings.data.defaultStartTime, allTasks, sortCriteria);
	}, [filteredTasks, columnData?.sortCriteria, columnData?.tasksIdManualOrder, plugin.settings.data.defaultStartTime]);

	const selectedTask = tasks.find((task) => task.id === selectedTaskId);
	const editorSelectedTask = selectedTask ?? (editorTask && editorTask.task.id === selectedTaskId ? editorTask.task : undefined);
	const isTaskNote = editorSelectedTask
		? isTaskNotePresentInTags(plugin.settings.data.taskNoteIdentifierTag, editorSelectedTask.tags)
		: false;

	useEffect(() => {
		if (!selectedTaskId || (!isEditorEdited && !tasks.some((task) => task.id === selectedTaskId))) {
			setSelectedTaskId(tasks[0]?.id);
		}
	}, [isEditorEdited, selectedTaskId, tasks]);

	useEffect(() => {
		let cancelled = false;
		if (!selectedTask && isEditorEdited) return;
		if (selectedTask && editorTask?.task.id === selectedTask.id) return;
		setEditorTask(undefined);
		setEditorLoadError(undefined);
		if (!selectedTask) return;

		const loadEditorTask = async () => {
			const noteContent = isTaskNote
				? await readDataOfVaultFile(plugin, selectedTask.filePath, true)
				: "";
			if (!cancelled) {
				if (isTaskNote && noteContent === null) {
					setEditorLoadError("Unable to load the selected task note.");
					return;
				}
				setEditorTask({ task: selectedTask, noteContent: noteContent ?? "" });
			}
		};

		void loadEditorTask();
		return () => {
			cancelled = true;
		};
	}, [selectedTask?.id, isTaskNote, isEditorEdited, editorTask?.task.id, plugin]);

	useEffect(() => {
		setListWidth(inboxConfig?.listWidth ?? DEFAULT_LIST_WIDTH);
	}, [currentView.viewId, inboxConfig?.listWidth]);

	useEffect(() => {
		setInboxConfig(currentView.inboxView ?? DEFAULT_INBOX_CONFIG);
	}, [currentView.viewId, currentView.inboxView]);

	useEffect(() => () => {
		resizeCleanupRef.current?.();
	}, []);

	const persistInboxView = useCallback(async (updatedInboxConfig: NonNullable<TaskBoardViewType["inboxView"]>) => {
		const updatedBoard: Board = {
			...currentBoardData,
			views: [...currentBoardData.views],
		};
		updatedBoard.views[currentViewIndex] = {
			...updatedBoard.views[currentViewIndex],
			inboxView: updatedInboxConfig,
		};

		try {
			const saved = await plugin.taskBoardFileManager.saveBoard(updatedBoard);
			if (!saved) throw new Error("The board configuration could not be saved.");
			setInboxConfig(updatedInboxConfig);
			setListWidth(updatedInboxConfig.listWidth);
			eventEmitter.emit("REFRESH_BOARD");
		} catch (error) {
			new Notice(`Unable to save Inbox settings: ${String(error)}`);
		}
	}, [currentBoardData, currentViewIndex, plugin]);

	useEffect(() => {
		if (!currentView.inboxView && migratedViewIdRef.current !== currentView.viewId) {
			migratedViewIdRef.current = currentView.viewId;
			void persistInboxView(DEFAULT_INBOX_CONFIG);
		}
	}, [currentView.inboxView, currentView.viewId, persistInboxView]);

	const openSortingModal = () => {
		if (!columnData || !inboxConfig) return;
		new ConfigureColumnSortingModal(
			plugin,
			columnData,
			(updatedColumn: ColumnData) => {
				void persistInboxView({ ...inboxConfig, column: updatedColumn });
			},
			() => undefined,
		).open();
	};

	const handleTaskSelect = (task: taskItem) => {
		if (task.id === selectedTaskId) return;
		if (isEditorEdited) {
			new ClosePopupConfrimationModal(plugin.app, {
				app: plugin.app,
				mssg: t("edit-task-modal-close-confirm-mssg"),
				onDiscard: () => {
					setIsEditorEdited(false);
					setSelectedTaskId(task.id);
				},
				onGoBack: () => undefined,
			}).open();
			return;
		}
		setSelectedTaskId(task.id);
	};

	const saveListWidth = (width: number) => {
		if (!inboxConfig) return;
		void persistInboxView({ ...inboxConfig, listWidth: width });
	};

	const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		resizingRef.current = true;
		const startX = event.clientX;
		const startWidth = listWidth;
		const container = event.currentTarget.parentElement;
		const maxWidth = Math.max(MIN_LIST_WIDTH, (container?.clientWidth ?? 900) - 320);

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (!resizingRef.current) return;
			setListWidth(Math.min(maxWidth, Math.max(MIN_LIST_WIDTH, startWidth + moveEvent.clientX - startX)));
		};
		const handlePointerUp = (upEvent: PointerEvent) => {
			if (!resizingRef.current) return;
			resizeCleanupRef.current?.();
			const width = Math.min(maxWidth, Math.max(MIN_LIST_WIDTH, startWidth + upEvent.clientX - startX));
			setListWidth(width);
			saveListWidth(width);
		};

		resizeCleanupRef.current = () => {
			resizingRef.current = false;
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			resizeCleanupRef.current = null;
		};
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	const handleSaveTask = async (
		updatedTask: taskItem,
		_quickAddPluginChoice: string,
		updatedNoteContent?: string,
	) => {
		if (!editorTask) return;
		const taskToSave = { ...updatedTask, filePath: editorTask.task.filePath };
		if (isTaskNote) {
			if (updatedNoteContent !== undefined) {
				await writeDataToVaultFile(plugin, taskToSave.filePath, updatedNoteContent);
			} else {
				await updateFrontmatterInMarkdownFile(plugin, taskToSave);
			}
		} else {
			await updateTaskInFile(plugin, taskToSave, editorTask.task);
		}
		await plugin.realTimeScanner.processAllUpdatedFiles(taskToSave.filePath);
		setEditorTask({
			task: taskToSave,
			noteContent: updatedNoteContent ?? editorTask.noteContent,
		});
		setIsEditorEdited(false);
		setEditorVersion((version) => version + 1);
	};

	return (
		<div className="taskBoardInboxView">
			<section className="taskBoardInboxList" style={{ width: `${listWidth}px` }}>
				<header className="taskBoardInboxListHeader">
					<span className="taskBoardInboxListTitle">{columnData.name}</span>
					<button
						type="button"
						className="taskBoardInboxSortButton"
						aria-label={t("configure-column-sorting")}
						title={t("configure-column-sorting")}
						onClick={openSortingModal}
					>
						<ArrowUpDown size={16} />
					</button>
					<span className="taskBoardInboxTaskCount">{tasks.length}</span>
				</header>
				<div className="taskBoardInboxListContent" role="listbox" aria-label="Inbox tasks">
					<LazyColumn
						plugin={plugin}
						parentComponent={parentComponent}
						activeBoardData={currentBoardData}
						currentViewIndex={currentViewIndex}
						kanbanViewData={{
							columns: [columnData],
							showColumnTags: false,
							hideEmptyColumns: false,
							swimlanes: {
								enabled: false,
								hideEmptySwimlanes: false,
								property: "tags",
								sortCriteria: "asc",
								minimized: [],
								maxHeight: "300px",
								headerUIType: HeaderUITypeOptions.horizontal,
								headerTruncation: HeaderTruncationOptions.middle,

							},
						}}
						columnData={columnData}
						tasksForThisColumn={tasks}
						hideColumnHeader
						activeViewType={viewTypeNames.inbox}
						selectedTaskId={selectedTaskId}
						onTaskSelect={handleTaskSelect}
					/>
				</div>
			</section>
			<div
				className="taskBoardInboxResizer"
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize Inbox task list"
				onPointerDown={handleResizeStart}
			/>
			<section className="taskBoardInboxEditor" ref={editorRootRef}>
				{editorTask && editorRootRef.current ? (
					<TaskEditorRC
						key={`${editorTask.task.id}-${editorVersion}`}
						plugin={plugin}
						root={editorRootRef.current}
						activeNote={false}
						filePath={editorTask.task.filePath}
						isTaskNote={isTaskNote}
						inboxView
						noteContent={editorTask.noteContent}
						task={editorTask.task}
						taskExists
						onSave={handleSaveTask}
						onClose={() => undefined}
						setIsEdited={setIsEditorEdited}
					/>
				) : (
					<div className="taskBoardInboxEditorEmpty">
						{editorLoadError ?? (selectedTask ? "Loading task..." : "Select a task to view and edit it.")}
					</div>
				)}
			</section>
		</div>
	);
};

export default InboxView;
