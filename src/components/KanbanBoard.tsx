// src/components/KanbanBoard.tsx

import { App, Notice } from "obsidian"; // Import App from Obsidian
import { Board, BoardConfig, ColumnData } from "../interfaces/KanbanBoard";
import { Bolt, CirclePlus, RefreshCcw, Tally1 } from 'lucide-react';
import React, { useEffect, useState } from "react";
import { loadBoardsData, openConfigModal, saveBoardsData } from "../services/OpenColumnConfig";

import { AddTaskModal } from "../modal/AddTaskModal";
import Column from "./Column";
import ConfigModal from "../settings/BoardModal";
import fs from "fs";
import path from "path";

const KanbanBoard: React.FC<{ app: App }> = ({ app }) => {
	const [boards, setBoards] = useState<Board[]>([]);
	const [activeBoardIndex, setActiveBoardIndex] = useState(0);

	useEffect(() => {
		loadBoards();
	}, []);

	// Function to load boards data
	const loadBoards = async () => {
		try {
			const data = await loadBoardsData();
			setBoards(data);
		} catch (err) {
			console.error("Failed to load boards data:", err);
		}
	};

	// Function to handle saving boards
	const handleUpdateBoards = (updatedBoards: Board[]) => {
		setBoards(updatedBoards);
		saveBoardsData(updatedBoards);
		loadBoards();
	};

	const AddNewTaskIn = () => {
		// const app = app;
		const activeFile = app.workspace.getActiveFile();

		if (activeFile) {
			new AddTaskModal(app, {
				app,
				filePath: activeFile.path,
				onTaskAdded: () => {
					// Refresh tasks or perform necessary actions after task is added
					// console.log("Task added successfully!");
				},
			}).open();
		} else {
			new Notice("No active file found to add a task.");
		}
	}

	return (
		<div className="kanbanBoard">
			<div className="kanbanHeader">
				<div className="boardTitles">
					{boards.map((board, index) => (
						<button
							key={index}
							className={`boardTitleButton${index === activeBoardIndex ? "Active" : ""
								}`}
							onClick={() => setActiveBoardIndex(index)}
						>
							{board.name}
						</button>
					))}
				</div>
				<div className="kanbanHeaderBtns">
					<Tally1 className="kanbanHeaderBtnsSeparator" />
					<button className="addTaskBtn" style={{backgroundColor: "none"}} onClick={() => AddNewTaskIn() }>
						<CirclePlus size={20} />
					</button>
					<button className="ConfigureBtn" onClick={() => openConfigModal(app, boards, activeBoardIndex, handleUpdateBoards)}>
						<Bolt size={20} />
					</button>
					<button className="RefreshBtn" onClick={loadBoards}>
						<RefreshCcw size={20} />
					</button>
				</div>
			</div>
			<div className="columnsContainer">
				{boards[activeBoardIndex]?.columns.map((column, index) => (
					<Column key={index} tag={column.tag} data={column.data} />
				))}
			</div>
		</div>
	);
};

export default KanbanBoard;













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
// const dataFilePath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'plugindata.json');

// // const dataFilePath = path.join('D:/Personal_Projects_Hub/IDE_Wise_Projects/Obsidian/TemplateToDevelopPlugin/.obsidian/plugins/Task-Board/', 'plugindata.json');

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
