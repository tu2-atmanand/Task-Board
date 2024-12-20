// src/components/KanbanBoard.tsx

import { Bolt, RefreshCcw, Tally1 } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { handleUpdateBoards, refreshBoardData } from "../utils/BoardOperations";
import { loadBoardsData, loadTasksProcessed } from "src/utils/JsonFileOperations";
import { taskItem, taskJsonMerged } from "src/interfaces/TaskItemProps";

import { App } from "obsidian";
import { Board } from "../interfaces/BoardConfigs";
import Column from "./Column";
import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { openBoardConfigModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";

const KanbanBoard: React.FC<{ app: App, plugin: TaskBoard, boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
	const [tasks, setTasks] = useState<taskItem[]>([]);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
	const [refreshCount, setRefreshCount] = useState(0);
	
	// Load tasks only once when the board is refreshed
	useEffect(() => {
		refreshBoardData(setBoards, async () => {
			try {
				const data = await loadBoardsData(plugin); // Fetch updated board data
				setBoards(data); // Update the state with the new data
				const allTasks = await loadTasksProcessed(plugin);
				if (allTasks) {
					setAllTasks(allTasks);
				}
			} catch (error) {
				console.error("refreshBoardData : Error loading tasks:", error);
			}
		});
	}, [refreshCount]);

	// Pub Sub method similar to Kafka to read events/messages.
	useEffect(() => {
		const refreshBoardListener = () => {
			// Clear the tasks array
			setTasks([]);
			setRefreshCount((prev) => prev + 1);
		};

		const refreshColumnListener = async () => {
			try {
				const allTasks = await loadTasksProcessed(plugin);
				setTasks([]);
				setAllTasks(allTasks);
			} catch (error) {
				console.error("Error loading tasks:", error);
			}
		};

		eventEmitter.on('REFRESH_BOARD', refreshBoardListener);
		eventEmitter.on('REFRESH_COLUMN', refreshColumnListener);

		// Clean up the listener when component unmounts
		return () => {
			eventEmitter.off('REFRESH_BOARD', refreshBoardListener);
			eventEmitter.off('REFRESH_COLUMN', refreshColumnListener);
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
					<button
						className="ConfigureBtn"
						aria-label={t(145)}
						onClick={() => openBoardConfigModal(app, plugin, boards, activeBoardIndex, (updatedBoards) =>
							handleUpdateBoards(plugin, updatedBoards, setBoards)
						)}
					>
						<Bolt size={20} />
					</button>
					<button className="RefreshBtn" aria-label={t(146)} onClick={refreshBoardButton}>
						<RefreshCcw size={20} />
					</button>
				</div>
			</div>
			<div className="columnsContainer">
				{boards[activeBoardIndex]?.columns
					.filter((column) => column.active)
					.map((column, index) => (
						<Column
							key={index}
							app={app}
							plugin={plugin}
							columnIndex={index}
							activeBoardIndex={activeBoardIndex}
							colType={column.colType}
							data={column.data}
							tasks={tasks}
							allTasks={allTasks || { Pending: [], Completed: [] }}
							setBoards={setBoards}
						/>
					))}

			</div>
		</div>
	);
};

export default memo(KanbanBoard);
