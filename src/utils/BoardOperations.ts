// /src/utils/BoardOperations.ts

import { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import { saveBoardsData } from "./JsonFileOperations";

// Function to refresh the board data
export const refreshBoardData = async (
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>,
	callback: () => void // Add this callback
) => {
	console.log(
		"refreshBoardData : Loading the boarConfigData and setting it to setBoards"
	);
	callback();
};

// Function to handle saving boards
export const handleUpdateBoards = async (
	updatedBoards: Board[],
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>
) => {
	setBoards(updatedBoards);
	saveBoardsData(updatedBoards);
	await refreshBoardData(setBoards, () => {});
};
