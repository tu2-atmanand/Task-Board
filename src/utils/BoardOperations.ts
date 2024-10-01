// /src/utils/BoardOperations.ts

import { loadBoardsData, saveBoardsData } from "./SettingsOperations";

import { Board } from "../interfaces/KanbanBoard";

// Function to refresh the board data
export const refreshBoardData = async (
	setBoards: React.Dispatch<React.SetStateAction<Board[]>>,
	callback: () => void // Add this callback
) => {
	console.log("------ refreshBoardData function : I wont make use of the callback function, will simply load the data.json for structure of the board -----");
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
	saveBoardsData(updatedBoards);
	await refreshBoardData(setBoards, () => {});
};
