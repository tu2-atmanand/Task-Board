// src/components/TaskBoardViewContent.tsx

import { Board, ColumnData } from "../interfaces/BoardConfigs";
import { Bolt, Bot, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
import { taskJsonMerged } from "src/interfaces/TaskItem";

import { App } from "obsidian";
import type TaskBoard from "main";
import debounce from "debounce";
import { eventEmitter } from "src/services/EventEmitter";
import { handleUpdateBoards } from "../utils/BoardOperations";
import { bugReporter, openAddNewTaskModal, openBoardConfigModal } from "../services/OpenModals";
import { renderColumns } from 'src/utils/RenderColumns';
import { t } from "src/utils/lang/helper";
import KanbanBoard from "./KanbanBoard";
import CanvasView from "./CanvasView";

type ViewType = "kanban" | "list" | "table" | "canvas";

const TaskBoardViewContent: React.FC<{ app: App; plugin: TaskBoard; boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
	const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [refreshCount, setRefreshCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [freshInstall, setFreshInstall] = useState(false);
	const [viewType, setViewType] = useState<ViewType>("kanban");

	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await loadBoardsData(plugin);
				setBoards(data);

				const allTasks = await loadTasksAndMerge(plugin);
				if (allTasks) {
					setAllTasks(allTasks);
					setFreshInstall(false);
				}
			} catch (error) {
				setFreshInstall(true);
			}
		};

		fetchData();
	}, [refreshCount]);

	const allTasksArrangedPerColumn = useMemo(() => {
		if (allTasks && boards[activeBoardIndex]) {
			return boards[activeBoardIndex].columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					renderColumns(plugin, activeBoardIndex, column, allTasks)
				);
		}
		return [];
	}, [allTasks, boards, activeBoardIndex]);

	useEffect(() => {
		if (allTasksArrangedPerColumn.length > 0) {
			setLoading(false);
		}
	}, [allTasksArrangedPerColumn]);

	const debouncedRefreshColumn = useCallback(
		debounce(async () => {
			try {
				const allTasks = await loadTasksAndMerge(plugin);
				setAllTasks(allTasks);
			} catch (error) {
				bugReporter(plugin, "Error loading tasks on column refresh", String(error), "TaskBoardViewContent.tsx/debouncedRefreshColumn");
			}
		}, 300),
		[plugin]
	);

	useEffect(() => {
		eventEmitter.on("REFRESH_COLUMN", debouncedRefreshColumn);
		return () => eventEmitter.off("REFRESH_COLUMN", debouncedRefreshColumn);
	}, [debouncedRefreshColumn]);

	useEffect(() => {
		const refreshBoardListener = () => setRefreshCount((prev) => prev + 1);
		eventEmitter.on("REFRESH_BOARD", refreshBoardListener);
		return () => eventEmitter.off("REFRESH_BOARD", refreshBoardListener);
	}, []);

	const refreshBoardButton = useCallback(async () => {
		if (plugin.settings.data.globalSettings.realTimeScanning) {
			eventEmitter.emit("REFRESH_BOARD");
		} else {
			if (localStorage.getItem("taskBoardFileStack")?.at(0)) {
				await plugin.realTimeScanning.processAllUpdatedFiles();
			}
			eventEmitter.emit("REFRESH_BOARD");
		}
	}, [plugin]);

	function handleOpenAddNewTaskModal() {
		openAddNewTaskModal(app, plugin);
	}

	return (
		<div className="taskBoardView">
			<div className="taskBoardHeader">
				<div className="boardTitles">
					{boards.map((board, index) => (
						<button
							key={index}
							className={`boardTitleButton${index === activeBoardIndex ? "Active" : ""}`}
							onClick={() => setActiveBoardIndex(index)}
						>
							{board.name}
						</button>
					))}
				</div>
				<div className="taskBoardHeaderBtns">
					<select
						className="taskBoardViewDropdown"
						value={viewType}
						onChange={(e) => setViewType(e.target.value as ViewType)}
					>
						<option value="kanban">Kanban</option>
						<option value="list">List</option>
						<option value="table">Table</option>
						<option value="canvas">Canvas</option>
					</select>

					<button className="AddNewTaskBtn" aria-label={t("add-new-task")} onClick={handleOpenAddNewTaskModal}>
						<CirclePlus size={18} />
					</button>
					<button
						className="ConfigureBtn"
						aria-label={t("board-configure-button")}
						onClick={() =>
							openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
								handleUpdateBoards(plugin, updatedBoards, setBoards)
							)
						}
					>
						<Bolt size={18} />
					</button>
					<button className="taskboardActionshBtn" aria-label={t("task-board-actions-button")} onClick={openTaskBoardActionsModal}>
						<Bot size={18} />
					</button>
					<button className="RefreshBtn" aria-label={t("refresh-board-button")} onClick={refreshBoardButton}>
						<RefreshCcw size={18} />
					</button>
				</div>
			</div>

			<div className="taskBoardViewSection">
				{viewType === "kanban" && (
					<KanbanBoard
						app={app}
						plugin={plugin}
						board={boards[activeBoardIndex]}
						allTasks={allTasks}
						tasksPerColumn={allTasksArrangedPerColumn}
						loading={loading}
						freshInstall={freshInstall}
					/>
				)}

				{viewType === 'canvas' && (
					<CanvasView
						plugin={plugin}
						boards={boards}
						activeBoardIndex={activeBoardIndex}
						allTasksArranged={allTasksArrangedPerColumn}
					/>
				)}

				{/* Placeholder: You can insert List, Table, Canvas view rendering here later */}
			</div>
		</div>
	);
};

export default TaskBoardViewContent;









// // src/components/TaskBoardViewContent.tsx - V1

// import { Board, ColumnData } from "../interfaces/BoardConfigs";
// import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
// import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
// import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
// import { taskJsonMerged } from "src/interfaces/TaskItem";

// import { App } from "obsidian";
// import type TaskBoard from "main";
// import debounce from "debounce";
// import { eventEmitter } from "src/services/EventEmitter";
// import { handleUpdateBoards } from "../utils/BoardOperations";
// import { bugReporter, openAddNewTaskModal, openBoardConfigModal } from "../services/OpenModals";
// import { renderColumns } from 'src/utils/RenderColumns';
// import { t } from "src/utils/lang/helper";

// const TaskBoardViewContent: React.FC<{ app: App, plugin: TaskBoard, boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
// 	const [boards, setBoards] = useState<Board[]>(boardConfigs);
// 	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
// 	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
// 	// const [allTasksArrangedPerColumn, setAllTasksArrangedPerColumn] = useState<taskItem[][]>([]);
// 	const [refreshCount, setRefreshCount] = useState(0);
// 	const [loading, setLoading] = useState(true);
// 	const [freshInstall, setFreshInstall] = useState(false);

// 	useEffect(() => {
// 		const fetchData = async () => {
// 			try {
// 				const data = await loadBoardsData(plugin);
// 				setBoards(data);

// 				const allTasks = await loadTasksAndMerge(plugin);
// 				// console.log("KanbanBoard.tsx : Data in allTasks :", allTasks);
// 				if (allTasks) {
// 					setAllTasks(allTasks);
// 					setFreshInstall(false);
// 				}
// 			} catch (error) {
// 				setFreshInstall(true);
// 				// bugReporter(plugin, "Error loading boards or tasks data", error as string, "KanbanBoard.tsx/useEffect");
// 			}
// 		};

// 		fetchData();
// 		// fetchData().finally(() => setLoading(false));
// 	}, [refreshCount]);

// 	const allTasksArrangedPerColumn = useMemo(() => {
// 		if (allTasks && boards[activeBoardIndex]) {
// 			return boards[activeBoardIndex].columns
// 				.filter((column) => column.active)
// 				.map((column: ColumnData) =>
// 					renderColumns(plugin, activeBoardIndex, column, allTasks)
// 				);
// 		}
// 		return [];
// 	}, [allTasks, boards, activeBoardIndex]);

// 	useEffect(() => {
// 		if (allTasksArrangedPerColumn.length > 0) {
// 			setLoading(false);
// 		}
// 	}, [allTasksArrangedPerColumn]);

// 	const debouncedRefreshColumn = useCallback(debounce(async () => {
// 		try {
// 			const allTasks = await loadTasksAndMerge(plugin);
// 			setAllTasks(allTasks);
// 		} catch (error) {
// 			bugReporter(plugin, "Error loading tasks on column refresh", error as string, "KanbanBoard.tsx/debouncedRefreshColumn");
// 		}
// 	}, 300), [plugin]);

// 	useEffect(() => {
// 		eventEmitter.on('REFRESH_COLUMN', debouncedRefreshColumn);
// 		return () => {
// 			eventEmitter.off('REFRESH_COLUMN', debouncedRefreshColumn);
// 		};
// 	}, [debouncedRefreshColumn]);

// 	// Pub Sub method similar to Kafka to read events/messages.
// 	useEffect(() => {
// 		const refreshBoardListener = () => {
// 			// Clear the tasks array
// 			// setAllTasks(undefined);
// 			setRefreshCount((prev) => prev + 1);
// 		};

// 		// const refreshColumnListener = async () => {
// 		// 	try {
// 		// 		const allTasks = await loadTasksAndMerge(plugin);
// 		// 		// setAllTasksArrangedPerColumn([]);
// 		// 		setAllTasks(allTasks);
// 		// 	} catch (error) {
// 		// 		console.error("Error loading tasks:", error);
// 		// 	}
// 		// };

// 		eventEmitter.on('REFRESH_BOARD', refreshBoardListener);
// 		// eventEmitter.on('REFRESH_COLUMN', refreshColumnListener);

// 		// Clean up the listener when component unmounts
// 		return () => {
// 			eventEmitter.off('REFRESH_BOARD', refreshBoardListener);
// 			// eventEmitter.off('REFRESH_COLUMN', refreshColumnListener);
// 		};
// 	}, []);

// 	// Memoized refreshBoardButton to avoid re-creating the function on every render
// 	const refreshBoardButton = useCallback(async () => {
// 		if (plugin.settings.data.globalSettings.realTimeScanning) {
// 			eventEmitter.emit("REFRESH_BOARD");
// 		} else {
// 			if (
// 				localStorage.getItem("taskBoardFileStack")?.at(0) !== undefined
// 			) {
// 				await plugin.realTimeScanning.processAllUpdatedFiles();
// 			}
// 			eventEmitter.emit("REFRESH_BOARD");
// 		}
// 	}, [plugin]);

// 	function handleOpenAddNewTaskModal() {
// 		openAddNewTaskModal(app, plugin);
// 	}

// 	// const isLoading = !boards[activeBoardIndex]?.columns.every(
// 	// 	(_, index) => allTasksArrangedPerColumn[index]?.length > 0
// 	// );

// 	// // If you prefer a more robust check that verifies whether the data is not only populated but also corresponds correctly to the columns:
// 	// const isLoading =
// 	// 	allTasksArrangedPerColumn.length !== boards[activeBoardIndex]?.columns.length ||
// 	// 	allTasksArrangedPerColumn.some((tasks) => tasks.length === 0);

// 	return (
// 		<div className="kanbanBoard">
// 			<div className="kanbanHeader">
// 				<div className="boardTitles">
// 					{boards.map((board, index) => (
// 						<button
// 							key={index}
// 							className={`boardTitleButton${index === activeBoardIndex ? "Active" : ""}`}
// 							onClick={() => setActiveBoardIndex(index)}
// 						>
// 							{board.name}
// 						</button>
// 					))}
// 				</div>
// 				<div className="kanbanHeaderBtns">
// 					<button className="AddNewTaskBtn" aria-label={t("add-new-task")} onClick={handleOpenAddNewTaskModal}>
// 						<CirclePlus size={18} />
// 					</button>
// 					<button
// 						className="ConfigureBtn"
// 						aria-label={t("board-configure-button")}
// 						onClick={() => openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
// 							handleUpdateBoards(plugin, updatedBoards, setBoards)
// 						)}
// 					>
// 						<Bolt size={18} />
// 					</button>
// 					<button className="RefreshBtn" aria-label={t("refresh-board-button")} onClick={refreshBoardButton}>
// 						<RefreshCcw size={18} />
// 					</button>
// 				</div>
// 			</div>
// 			{/* Here the respective component will be rendered, based on the selected view */}
// 		</div>
// 	);
// };

// export default memo(TaskBoardViewContent);
