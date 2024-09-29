// /src/utils/refreshBoards.ts

import { loadBoardsData, saveBoardsData } from "./SettingsOperations";

import { Board } from "../interfaces/KanbanBoard";

// Function to refresh the board data
export const refreshBoardData = async (
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>,
	callback: () => void // Add this callback
) => {
	console.log("------ Inside the refreshBoardData function -----");
	try {
		const data = await loadBoardsData(); // Fetch updated board data
		setBoards(data); // Update the state with the new data
		callback(); // Call the callback after boards are set
	} catch (err) {
		console.error("Failed to refresh boards data:", err);
	}
};

// Function to handle saving boards
export const handleUpdateBoards = async (
	updatedBoards: Board[],
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>
) => {
	setBoards(updatedBoards);
	await saveBoardsData(updatedBoards);
	await refreshBoardData(setBoards, () => {}); 
};
