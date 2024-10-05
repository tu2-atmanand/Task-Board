// src/components/KanbanBoard.tsx --------- V3

import { App, Notice } from "obsidian";
import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
import React, { useEffect, useState } from "react";
import { handleUpdateBoards, refreshBoardData } from "../utils/BoardOperations";

import { AddTaskModal } from "../modal/AddTaskModal";
import { Board } from "../interfaces/KanbanBoard";
import Column from "./Column";
import TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import fs from "fs";
import { loadTasksFromJson } from "src/utils/TaskItemUtils";
import { openBoardConfigModal } from "../services/OpenModals";
import path from "path";
import { refreshKanbanBoard } from "src/services/RefreshServices";
import { renderColumns } from "src/utils/RenderColumns"; // Adjust the path accordingly
import { taskItem } from "src/interfaces/TaskItem";

const KanbanBoard: React.FC<{ app: App, plugin: TaskBoard }> = ({ app, plugin }) => {
	const [tasks, setTasks] = useState<taskItem[]>([]);
	const [boards, setBoards] = useState<Board[]>([]);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);
	const [pendingTasks, setPendingTasks] = useState<taskItem[]>([]);
	const [completedTasks, setCompletedTasks] = useState<taskItem[]>([]);
	const [refreshCount, setRefreshCount] = useState(0); // Use a counter to track refreshes

	// Load tasks only once when the board is refreshed
	useEffect(() => {
		console.log("KanbanBoard.tsx: Refreshing board and tasks...");
		refreshBoardData(setBoards, () => {
			const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();
			setPendingTasks(pendingTasks);
			setCompletedTasks(completedTasks);
		});
	}, [refreshCount]); // Empty dependency array ensures this runs only once on component mount

	// Pub Sub method similar to Kafka to read events/messages.
	useEffect(() => {
		const refreshBoardListener = () => {
			console.log("KanbanBoard.tsx : REFRESH_BOARD mssgs received...");
			// Clear the tasks array
			setTasks([]);
			// sleep(30);
			setRefreshCount((prev) => prev + 1);
		};

		const refreshColumnListener = () => {
			console.log("KanbanBoard.tsx : REFRESH_COLUMN mssgs received...");
			const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();
			setPendingTasks(pendingTasks);
			setCompletedTasks(completedTasks);
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
	// 	const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();
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
			new AddTaskModal(app, {
				app,
				filePath: activeFile.path,
				onTaskAdded: () => {
					// Call refresh board data when a new task is added
					// refreshBoardData(setBoards, () => {
					// 	console.log("AddTaskModal : New task has been added, now will first remove all the taks and then will load it from the json file...");
					// 	// // RefreshTasksInsideColumns();
					// });

					eventEmitter.emit("REFRESH_COLUMN");
				},
			}).open();
		} else {
			new Notice("No active file found to add a task.");
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
						onClick={() => openBoardConfigModal(app, boards, activeBoardIndex, (updatedBoards) =>
							handleUpdateBoards(updatedBoards, setBoards)
						)}
					>
						<Bolt size={20} />
					</button>
					{/* <button className="RefreshBtn" onClick={() => refreshBoardData(setBoards, () => {
						RefreshTasksInsideColumns();
					})}>
						<RefreshCcw size={20} />
					</button> */}
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
							key={index}
							activeBoard={activeBoardIndex}
							colType={column.colType}
							data={column.data}
							setBoards={setBoards}
							tasks={tasks} // Pass tasks as a prop to the Column component
							pendingTasks={pendingTasks} // Pass the pending tasks
							completedTasks={completedTasks} // Pass the completed tasks
						/>
					))}
			</div>
		</div>
	);
};

export default KanbanBoard;














// // src/components/KanbanBoard.tsx ---------- V3 - Working

// import { App, Notice } from "obsidian";
// import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
// import React, { useEffect, useState } from "react";
// import { handleUpdateBoards, refreshBoardData } from "../utils/refreshBoard"; // Import utility functions

// import { AddTaskModal } from "../modal/AddTaskModal";
// import { Board } from "../interfaces/KanbanBoard";
// import Column from "./Column";
// import fs from "fs";
// import { openBoardConfigModal } from "../services/OpenColumnConfig";
// import path from "path";

// const KanbanBoard: React.FC<{ app: App }> = ({ app }) => {
// 	const [boards, setBoards] = useState<Board[]>([]);
// 	const [activeBoardIndex, setActiveBoardIndex] = useState(0);

// 	useEffect(() => {
// 		refreshBoardData(setBoards); // Use utility function to load boards
// 	}, []);

// 	// Function to handle saving boards
// 	const AddNewTaskIn = () => {
// 		const activeFile = app.workspace.getActiveFile();

// 		if (activeFile) {
// 			new AddTaskModal(app, {
// 				app,
// 				filePath: activeFile.path,
// 				onTaskAdded: () => {
// 					// Call refresh board data when a new task is added
// 					refreshBoardData(setBoards);
// 				},
// 			}).open();
// 		} else {
// 			new Notice("No active file found to add a task.");
// 		}
// 	};

// 	return (
// 		<div className="kanbanBoard">
// 			<div className="kanbanHeader">
// 				<div className="boardTitles">
// 					{boards.map((board, index) => (
// 						<button
// 							key={index}
// 							className={`boardTitleButton${index === activeBoardIndex ? "Active" : ""
// 								}`}
// 							onClick={() => setActiveBoardIndex(index)}
// 						>
// 							{board.name}
// 						</button>
// 					))}
// 				</div>
// 				<div className="kanbanHeaderBtns">
// 					<Tally1 className="kanbanHeaderBtnsSeparator" />
// 					<button className="addTaskBtn" style={{backgroundColor: "none"}} onClick={() => AddNewTaskIn }>
// 						<CirclePlus size={20} />
// 					</button>
// 					<button
// 						className="ConfigureBtn"
// 						onClick={() => openBoardConfigModal(app, boards, activeBoardIndex, (updatedBoards) =>
// 							handleUpdateBoards(updatedBoards, setBoards)
// 						)}
// 					>
// 						<Bolt size={20} />
// 					</button>
// 					<button className="RefreshBtn" onClick={() => refreshBoardData(setBoards)}>
// 						<RefreshCcw size={20} />
// 					</button>
// 				</div>
// 			</div>
// 			<div className="columnsContainer">
// 				{boards[activeBoardIndex]?.columns.map((column, index) => (
// 					<Column
// 						key={index}
// 						colType={column.colType}
// 						data={column.data}
// 						setBoards={setBoards} // Pass setBoards to the Column component
// 					/>
// 				))}
// 			</div>
// 		</div>
// 	);
// };

// export default KanbanBoard;













// // src/components/KanbanBoard.tsx   ----- V2 - WORKING
// import React, { useEffect, useState } from 'react';
// import Column from './Column';
// import fs from 'fs';
// import path from 'path';

// // Define the structure of Board, Column, and the Data read from JSON
// interface ColumnData {
// 	tag: string;
// 	data: {
// 		collapsed: boolean;
// 		name: string;
// 		coltag: string;
// 		range?: {
// 			tag: string;
// 			rangedata: {
// 				from: number;
// 				to: number;
// 			};
// 		};
// 		index?: number;
// 		limit?: number;
// 	};
// }

// interface Board {
// 	name: string;
// 	columns: ColumnData[];
// }

// interface BoardConfig {
// 	boardConfigs: Board[];
// }

// // File path to the JSON data

// const basePath = (window as any).app.vault.adapter.basePath;
// const dataFilePath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'data.json');

// // const dataFilePath = path.join('D:/Personal_Projects_Hub/IDE_Wise_Projects/Obsidian/TemplateToDevelopPlugin/.obsidian/plugins/Task-Board/', 'data.json');

// const KanbanBoard: React.FC = () => {
// 	const [boards, setBoards] = useState<Board[]>([]);
// 	const [activeBoardIndex, setActiveBoardIndex] = useState(0);

// 	// Load data from JSON when component mounts
// 	useEffect(() => {
// 		loadDataFromFile();
// 	}, []);

// 	// Function to load data from the JSON file
// 	const loadDataFromFile = () => {
// 		fs.readFile(dataFilePath, 'utf8', (err, data) => {
// 			if (err) {
// 				console.error('Error reading data file:', err);
// 				return;
// 			}
// 			const jsonData: BoardConfig = JSON.parse(data).data; // Adjust this to match the exact JSON structure
// 			setBoards(jsonData.boardConfigs);
// 		});
// 	};

// 	// Function to save data to the JSON file
// 	const saveDataToFile = (updatedBoards: Board[]) => {
// 		const newData = { version: "0.13.0", data: { boardConfigs: updatedBoards } }; // Keep other fields as needed
// 		fs.writeFile(dataFilePath, JSON.stringify(newData, null, 2), (err) => {
// 			if (err) {
// 				console.error('Error writing to data file:', err);
// 			}
// 		});
// 	};

// 	// Function to add a new column to the active board
// 	const addColumn = () => {
// 		const updatedBoards = [...boards];
// 		updatedBoards[activeBoardIndex].columns.push({
// 			tag: 'custom',
// 			data: { collapsed: false, name: `Column ${updatedBoards[activeBoardIndex].columns.length + 1}` },
// 		});
// 		setBoards(updatedBoards);
// 		saveDataToFile(updatedBoards);
// 	};

// 	// Function to add a new board
// 	const addBoard = () => {
// 		const newBoard: Board = { name: `Board ${boards.length + 1}`, columns: [] };
// 		const updatedBoards = [...boards, newBoard];
// 		setBoards(updatedBoards);
// 		setActiveBoardIndex(updatedBoards.length - 1); // Set the new board as the active one
// 		saveDataToFile(updatedBoards);
// 	};

// 	// Function to switch between boards
// 	const switchBoard = (index: number) => {
// 		setActiveBoardIndex(index);
// 	};

// 	return (
// 		<div className="kanbanBoard">
// 			<div className="kanbanHeader">
// 				<div className="boardTitles">
// 					{boards.map((board, index) => (
// 						<button
// 							key={index}
// 							className={`boardTitleButton ${index === activeBoardIndex ? 'active' : ''}`}
// 							onClick={() => switchBoard(index)}
// 						>
// 							{board.name}
// 						</button>
// 					))}
// 				</div>
// 				<button className="AddBoardBtn" onClick={addBoard}>+ Add Board</button>
// 				<button className="AddColBtn" onClick={addColumn}>+ Add Column</button>
// 			</div>
// 			<div className="columnsContainer">
// 				{boards[activeBoardIndex]?.columns.map((column, index) => (
// 					<Column key={index} tag={column.tag} data={column.data} />
// 				))}
// 			</div>
// 		</div>
// 	);
// };

// export default KanbanBoard;










// // src/components/KanbanBoard.tsx  ------- OLD CODE
// import React, { useState } from 'react';
// import Column from './Column';
// // import "../styles/KanbanView.css";

// const KanbanBoard: React.FC = () => {
// 	const [columns, setColumns] = useState<string[]>(['Undated', 'Over Due', 'Today']);

// 	const addColumn = () => {
// 		const newColumnName = `Column ${columns.length + 1}`;
// 		setColumns([...columns, newColumnName]);
// 	};

// 	return (
// 		<div className="kanbanBoard">
// 			<div className="kanbanHeader">
// 				<h1>Task Board</h1>
// 				<button className="AddColBtn" onClick={addColumn}>+ Add Column</button>
// 			</div>
// 			<div className="columnsContainer">
// 				{columns.map((column, index) => (
// 					<Column key={index} title={column} />
// 				))}
// 			</div>
// 		</div>
// 	);
// };

// export default KanbanBoard;
