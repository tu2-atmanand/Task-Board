// src/components/KanbanBoard.tsx --------- V3

import { App, Notice } from "obsidian";
import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
import React, { useEffect, useState } from "react";
import { handleUpdateBoards, refreshBoardData } from "../utils/BoardOperations";
import { loadBoardsData, loadTasksProcessed } from "src/utils/JsonFileOperations";
import { openAddNewTaskModal, openBoardConfigModal } from "../services/OpenModals";
import { taskItem, taskJsonMerged, tasksJson } from "src/interfaces/TaskItemProps";

import { Board } from "../interfaces/BoardConfigs";
import Column from "./Column";
import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import fs from "fs";
import { t } from "src/utils/lang/helper";

const KanbanBoard: React.FC<{ app: App, plugin: TaskBoard }> = ({ app, plugin }) => {
	const [tasks, setTasks] = useState<taskItem[]>([]);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [boards, setBoards] = useState<Board[]>([]);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
	const [refreshCount, setRefreshCount] = useState(0); // Use a counter to track refreshes

	// Load tasks only once when the board is refreshed
	useEffect(() => {
		console.log("KanbanBoard.tsx: Refreshing board and tasks...");
		// const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		// let data = plugin.app.vault.adapter.read(path);
		// const tempData = loadTasksUsingObsidianMethod(plugin);

		// const tasksData = loadJustTheData(plugin);

		// console.log("What is the value of this.app.vault.adapter.read(yourFolderPath) : ", tasksData);

		refreshBoardData(setBoards, async () => {
			try {
				const data = await loadBoardsData(plugin); // Fetch updated board data
				setBoards(data); // Update the state with the new data
				// Since loadTasksProcessed is async, await its result
				const allTasks = await loadTasksProcessed(plugin);
				// console.log("THE DATA I HAVE RECEIVED : ", allTasks);
				if (allTasks) {
					setAllTasks(allTasks);  // Set the tasks if not undefined
				}
			} catch (error) {
				console.error("Error loading tasks:", error);
			}
		});
	}, [refreshCount]);

	// Pub Sub method similar to Kafka to read events/messages.
	useEffect(() => {
		const refreshBoardListener = () => {
			console.log("KanbanBoard.tsx : REFRESH_BOARD mssgs received...");
			// Clear the tasks array
			setTasks([]);
			// sleep(30);
			setRefreshCount((prev) => prev + 1);
		};

		const refreshColumnListener = async () => {
			console.log("KanbanBoard.tsx : REFRESH_COLUMN mssgs received...");
			try {
				const allTasks = await loadTasksProcessed(plugin);
				setAllTasks(allTasks);
			} catch (error) {
				console.error("Error loading tasks:", error);
			}
		};

		// For some reason, the things i am doing inside `refreshBoardListener` is not working.
		eventEmitter.on('REFRESH_BOARD', refreshBoardListener);
		eventEmitter.on('REFRESH_COLUMN', refreshColumnListener);

		// Clean up the listener when component unmounts
		return () => {
			eventEmitter.off('REFRESH_BOARD', refreshBoardListener);
			eventEmitter.off('REFRESH_COLUMN', refreshColumnListener);
		};
	}, []);

	// const RefreshTasksInsideColumns = () => {
	// 	const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksProcessed();
	// 	// Trigger renderColumns after the boards are refreshed
	// 	boards.forEach((board, index) => {
	// 		board.columns.forEach((column) => {
	// 			renderColumns(setTasks, index, column.colType, column.data, pendingTasks, completedTasks);
	// 		});
	// 	});
	// };

	// Function to handle saving boards
	const AddNewTaskIn = () => {
		const activeFile = app.workspace.getActiveFile();

		if (activeFile) {

			openAddNewTaskModal(app, plugin, activeFile);
		} else {
			new Notice(t(6));
		}
	};

	const refreshBoardButton = () => {
		// refreshKanbanBoard(app);

		// If the user complaints that the pressing the refreshing button does bullshit and jump the Task Board from one place to another, then simply, disable the above line and enable below line.

		eventEmitter.emit("REFRESH_BOARD");
		// eventEmitter.emit("REFRESH_COLUMN");
		// const boardsData = loadBoardConfigs();
		// // Trigger renderColumns after the boards are refreshed
		// boardsData.forEach((board: Board, index: number) => {
		// 	board.columns.forEach((column) => {
		// 		renderColumns(setTasks, index, column.colType, column.data);
		// 	});
		// });
	}

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
					<button className="addTaskBtn" style={{ backgroundColor: "none" }} onClick={AddNewTaskIn}>
						<CirclePlus size={20} />
					</button>
					<button
						className="ConfigureBtn"
						onClick={() => openBoardConfigModal(app, plugin, boards, activeBoardIndex, (updatedBoards) =>
							handleUpdateBoards(plugin, updatedBoards, setBoards)
						)}
					>
						<Bolt size={20} />
					</button>
					<button className="RefreshBtn" onClick={refreshBoardButton}>
						<RefreshCcw size={20} />
					</button>
				</div>
			</div>
			<div className="columnsContainer">
				{boards[activeBoardIndex]?.columns
					.filter((column) => column.active)
					.map((column, index) => (
						<Column
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

export default KanbanBoard;
