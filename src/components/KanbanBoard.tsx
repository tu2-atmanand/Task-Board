// src/components/KanbanBoard.tsx

import { Board, ColumnData } from "../interfaces/BoardConfigs";
import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
import { taskJsonMerged } from "src/interfaces/TaskItem";

import { App } from "obsidian";
import Column from "./Column";
import type TaskBoard from "main";
import debounce from "debounce";
import { eventEmitter } from "src/services/EventEmitter";
import { handleUpdateBoards } from "../utils/BoardOperations";
import { bugReporter, openAddNewTaskModal, openBoardConfigModal } from "../services/OpenModals";
import { renderColumns } from 'src/utils/RenderColumns';
import { t } from "src/utils/lang/helper";

const KanbanBoard: React.FC<{ app: App, plugin: TaskBoard, boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
	const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	// const [allTasksArrangedPerColumn, setAllTasksArrangedPerColumn] = useState<taskItem[][]>([]);
	const [refreshCount, setRefreshCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [freshInstall, setFreshInstall] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await loadBoardsData(plugin);
				setBoards(data);

				const allTasks = await loadTasksAndMerge(plugin);
				// console.log("KanbanBoard.tsx : Data in allTasks :", allTasks);
				if (allTasks) {
					setAllTasks(allTasks);
					setFreshInstall(false);
				}
			} catch (error) {
				setFreshInstall(true);
				// bugReporter(plugin, "Error loading boards or tasks data", error as string, "KanbanBoard.tsx/useEffect");
			}
		};

		fetchData();
		// fetchData().finally(() => setLoading(false));
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


	// // Load tasks only once when the board is refreshed
	// useEffect(() => {
	// 	refreshBoardData(setBoards, async () => {
	// 		try {
	// 			const data = await loadBoardsData(plugin); // Fetch updated board data
	// 			setBoards(data); // Update the state with the new data
	// 			const allTasks = await loadTasksAndMerge(plugin);
	// 			console.log("KanbanBoard.tsx : Data in allTasks :", allTasks);
	// 			if (allTasks) {
	// 				setAllTasks(allTasks);
	// 			}
	// 		} catch (error) {
	// 			console.error("refreshBoardData : Error loading tasks:", error);
	// 		}
	// 	});
	// }, []);

	// useEffect(() => {
	// 	if (allTasks && boards[activeBoardIndex]) {
	// 		const columns = boards[activeBoardIndex].columns;
	// 		const arrangedTasks = columns.map((column: ColumnData) => {
	// 			return renderColumns(plugin, activeBoardIndex, column, allTasks);
	// 		});
	// 		console.log("KanbanBoard.tsx : Data in setAllTasksArrangedPerColumn:", arrangedTasks);
	// 		setAllTasksArrangedPerColumn(arrangedTasks);
	// 	}
	// }, [allTasks, boards, activeBoardIndex]);

	const debouncedRefreshColumn = useCallback(debounce(async () => {
		try {
			const allTasks = await loadTasksAndMerge(plugin);
			setAllTasks(allTasks);
		} catch (error) {
			bugReporter(plugin, "Error loading tasks on column refresh", error as string, "KanbanBoard.tsx/debouncedRefreshColumn");
		}
	}, 300), [plugin]);

	useEffect(() => {
		eventEmitter.on('REFRESH_COLUMN', debouncedRefreshColumn);
		return () => {
			eventEmitter.off('REFRESH_COLUMN', debouncedRefreshColumn);
		};
	}, [debouncedRefreshColumn]);

	// Pub Sub method similar to Kafka to read events/messages.
	useEffect(() => {
		const refreshBoardListener = () => {
			// Clear the tasks array
			// setAllTasks(undefined);
			setRefreshCount((prev) => prev + 1);
		};

		// const refreshColumnListener = async () => {
		// 	try {
		// 		const allTasks = await loadTasksAndMerge(plugin);
		// 		// setAllTasksArrangedPerColumn([]);
		// 		setAllTasks(allTasks);
		// 	} catch (error) {
		// 		console.error("Error loading tasks:", error);
		// 	}
		// };

		eventEmitter.on('REFRESH_BOARD', refreshBoardListener);
		// eventEmitter.on('REFRESH_COLUMN', refreshColumnListener);

		// Clean up the listener when component unmounts
		return () => {
			eventEmitter.off('REFRESH_BOARD', refreshBoardListener);
			// eventEmitter.off('REFRESH_COLUMN', refreshColumnListener);
		};
	}, []);

	// Memoized refreshBoardButton to avoid re-creating the function on every render
	const refreshBoardButton = useCallback(() => {
		if (plugin.settings.data.globalSettings.realTimeScanning) {
			eventEmitter.emit("REFRESH_BOARD");
		} else {
			if (
				localStorage.getItem("taskBoardFileStack")?.at(0) !== undefined
			) {
				plugin.realTimeScanning.processStack();
			}
			eventEmitter.emit("REFRESH_BOARD");
		}
	}, [plugin]);

	function handleOpenAddNewTaskModal() {
		openAddNewTaskModal(app, plugin);
	}

	// const isLoading = !boards[activeBoardIndex]?.columns.every(
	// 	(_, index) => allTasksArrangedPerColumn[index]?.length > 0
	// );

	// // If you prefer a more robust check that verifies whether the data is not only populated but also corresponds correctly to the columns:
	// const isLoading =
	// 	allTasksArrangedPerColumn.length !== boards[activeBoardIndex]?.columns.length ||
	// 	allTasksArrangedPerColumn.some((tasks) => tasks.length === 0);

	return (
		<div className="kanbanBoard">
			<div className="kanbanHeader">
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
				<div className="kanbanHeaderBtns">
					<Tally1 className="kanbanHeaderBtnsSeparator" />
					{/* <button className="addTaskBtn" style={{ backgroundColor: "none" }} onClick={AddNewTaskIn}>
						<CirclePlus size={20} />
					</button> */}
					<button className="AddNewTaskBtn" aria-label={t("add-new-task")} onClick={handleOpenAddNewTaskModal}>
						<CirclePlus size={18} />
					</button>
					<button
						className="ConfigureBtn"
						aria-label={t("board-configure-button")}
						onClick={() => openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
							handleUpdateBoards(plugin, updatedBoards, setBoards)
						)}
					>
						<Bolt size={18} />
					</button>
					<button className="RefreshBtn" aria-label={t("refresh-board-button")} onClick={refreshBoardButton}>
						<RefreshCcw size={18} />
					</button>
				</div>
			</div>
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
								<p>{t('loading-tasks')}</p>
							</>
						)}
					</div>
				) : (
					boards[activeBoardIndex]?.columns
						.filter((column) => column.active)
						.map((column, index) => (
							<MemoizedColumn
								key={index}
								plugin={plugin}
								columnIndex={column.index}
								activeBoardIndex={activeBoardIndex}
								columnData={column}
								tasksForThisColumn={allTasksArrangedPerColumn[index]}
							/>
						))
				)}
			</div>
		</div>
	);
};

// Wrap Column in React.memo
const MemoizedColumn = memo(Column, (prevProps, nextProps) => {
	return (
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.columnData === nextProps.columnData
	);
});

export default memo(KanbanBoard);
