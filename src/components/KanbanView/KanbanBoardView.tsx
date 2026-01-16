// src/components/KanbanBoard.tsx

import { Board } from "../../interfaces/BoardConfigs";
import React, { memo } from "react";
import { taskItem, taskJsonMerged } from "src/interfaces/TaskItem";

import { App } from "obsidian";
import Column from "./Column";
import LazyColumn from "./LazyColumn";
import KanbanSwimlanesContainer from "./KanbanSwimlanesContainer";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";

interface KanbanBoardProps {
	app: App;
	plugin: TaskBoard;
	board: Board;
	allTasks: taskJsonMerged | undefined;
	tasksPerColumn: taskItem[][];
	loading: boolean;
	freshInstall: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ plugin, board, allTasks, tasksPerColumn, loading, freshInstall }) => {
	// Check if lazy loading is enabled
	const lazyLoadingEnabled = plugin.settings.data.globalSettings.kanbanView?.lazyLoadingEnabled ?? false;
	const ColumnComponent = lazyLoadingEnabled ? LazyColumn : Column;

	return (
		<div className="kanbanBoard">
			<div className="columnsContainer">
				{loading ? (
					<div className="loadingContainer">
						{freshInstall ? (
							<h2 className="initializationMessage">
								{t("fresh-install-1")}
								<br />
								<br />
								{t("fresh-install-2")}
								<br />
								<br />
								{t("fresh-install-3")}
							</h2>
						) : (
							<>
								<div className="spinner"></div>
								<p>{t("loading-tasks")}</p>
							</>
						)}
					</div>
				) : board?.columns?.length === 0 ? (
					<div className="emptyBoardMessage">
						Create columns on this board using the board config modal from top right corner button.
					</div>
				) : board?.swimlanes?.enabled ? (
					<KanbanSwimlanesContainer
						plugin={plugin}
						board={board}
						allTasks={allTasks}
						tasksPerColumn={tasksPerColumn}
						lazyLoadingEnabled={lazyLoadingEnabled}
					/>
				) : (
					board?.columns
						.filter((column) => column.active)
						.map((column, index) => (
							<MemoizedColumn
								key={index}
								plugin={plugin}
								columnIndex={column.index}
								activeBoardData={board}
								columnData={column}
								tasksForThisColumn={tasksPerColumn[index]}
								Component={ColumnComponent}
							/>
						))
				)}
			</div>
		</div>
	);
};

const MemoizedColumn = memo<{
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardData: Board;
	columnData: any;
	tasksForThisColumn: taskItem[];
	Component: typeof Column | typeof LazyColumn;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.Component === nextProps.Component
	);
});

export default memo(KanbanBoard);










// // src/components/KanbanBoard.tsx - V1

// import { Board, ColumnData } from "../interfaces/BoardConfigs";
// import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
// import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
// import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
// import { taskJsonMerged } from "src/interfaces/TaskItem";

// import { App } from "obsidian";
// import Column from "./Column";
// import type TaskBoard from "main";
// import debounce from "debounce";
// import { eventEmitter } from "src/services/EventEmitter";
// import { handleUpdateBoards } from "../utils/BoardOperations";
// import { bugReporter, openAddNewTaskModal, openBoardConfigModal } from "../services/OpenModals";
// import { columnSegregator } from 'src/utils/RenderColumns';
// import { t } from "src/utils/lang/helper";

// const KanbanBoard: React.FC<{ app: App, plugin: TaskBoard, boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
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
// 				// bugReporterManagerInsatance.showNotice(2, "Error loading boards or tasks data", error as string, "KanbanBoard.tsx/useEffect");
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
// 					columnSegregator(plugin, activeBoardIndex, column, allTasks)
// 				);
// 		}
// 		return [];
// 	}, [allTasks, boards, activeBoardIndex]);

// 	useEffect(() => {
// 		if (allTasksArrangedPerColumn.length > 0) {
// 			setLoading(false);
// 		}
// 	}, [allTasksArrangedPerColumn]);


// 	// // Load tasks only once when the board is refreshed
// 	// useEffect(() => {
// 	// 	refreshBoardData(setBoards, async () => {
// 	// 		try {
// 	// 			const data = await loadBoardsData(plugin); // Fetch updated board data
// 	// 			setBoards(data); // Update the state with the new data
// 	// 			const allTasks = await loadTasksAndMerge(plugin);
// 	// 			console.log("KanbanBoard.tsx : Data in allTasks :", allTasks);
// 	// 			if (allTasks) {
// 	// 				setAllTasks(allTasks);
// 	// 			}
// 	// 		} catch (error) {
// 	// 			console.error("refreshBoardData : Error loading tasks:", error);
// 	// 		}
// 	// 	});
// 	// }, []);

// 	// useEffect(() => {
// 	// 	if (allTasks && boards[activeBoardIndex]) {
// 	// 		const columns = boards[activeBoardIndex].columns;
// 	// 		const arrangedTasks = columns.map((column: ColumnData) => {
// 	// 			return columnSegregator(plugin, activeBoardIndex, column, allTasks);
// 	// 		});
// 	// 		console.log("KanbanBoard.tsx : Data in setAllTasksArrangedPerColumn:", arrangedTasks);
// 	// 		setAllTasksArrangedPerColumn(arrangedTasks);
// 	// 	}
// 	// }, [allTasks, boards, activeBoardIndex]);

// 	const debouncedRefreshColumn = useCallback(debounce(async () => {
// 		try {
// 			const allTasks = await loadTasksAndMerge(plugin);
// 			setAllTasks(allTasks);
// 		} catch (error) {
// 			bugReporterManagerInsatance.showNotice(3, "Error loading tasks on column refresh", error as string, "KanbanBoard.tsx/debouncedRefreshColumn");
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
// 		if (plugin.settings.data.globalSettings.realTimeScanner) {
// 			eventEmitter.emit("REFRESH_BOARD");
// 		} else {
// 			if (
// 				localStorage.getItem(PENDING_SCAN_FILE_STACK)?.at(0) !== undefined
// 			) {
// 				await plugin.realTimeScanner.processAllUpdatedFiles();
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
// 			<div className="columnsContainer">
// 				{loading ? (
// 					<div className="loadingContainer">
// 						{freshInstall ? (
// 							<h2 className="initializationMessage">
// 								{t("fresh-install-1")}
// 								<br />
// 								<br />
// 								{t("fresh-install-2")}
// 								<br />
// 								<br />
// 								{t("fresh-install-3")}
// 							</h2>
// 						) : (
// 							<>
// 								<div className="spinner"></div>
// 								<p>{t('loading-tasks')}</p>
// 							</>
// 						)}
// 					</div>
// 				) : (
// 					boards[activeBoardIndex]?.columns
// 						.filter((column) => column.active)
// 						.map((column, index) => (
// 							<MemoizedColumn
// 								key={index}
// 								plugin={plugin}
// 								columnIndex={column.index}
// 								activeBoardIndex={activeBoardIndex}
// 								columnData={column}
// 								tasksForThisColumn={allTasksArrangedPerColumn[index]}
// 							/>
// 						))
// 				)}
// 			</div>
// 		</div>
// 	);
// };

// // Wrap Column in React.memo
// const MemoizedColumn = memo(Column, (prevProps, nextProps) => {
// 	return (
// 		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
// 		prevProps.columnData === nextProps.columnData
// 	);
// });

// export default memo(KanbanBoard);
