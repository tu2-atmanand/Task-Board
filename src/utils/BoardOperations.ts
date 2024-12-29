// /src/utils/BoardOperations.ts

import { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import { saveBoardsData } from "./JsonFileOperations";

// Function to refresh the board data
export const refreshBoardData = async (
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>,
	callback: () => void // Add this callback
) => {
	callback();
};

// Function to handle saving boards
export const handleUpdateBoards = async (
	plugin: TaskBoard,
	updatedBoards: Board[],
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>
) => {
	setBoards(updatedBoards);
	saveBoardsData(plugin, updatedBoards);
	await refreshBoardData(setBoards, () => {}); // this wont work anymore, use some different way to refresh the whole shit, maybe load the everything again from KanbanView.tsx.
};
