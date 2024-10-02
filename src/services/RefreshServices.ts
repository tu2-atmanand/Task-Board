// /src/services/RefreshServices.ts

import { Dispatch, SetStateAction } from "react";

import { App } from "obsidian";
import { KanbanView } from "src/views/KanbanView";
import TaskBoard from "main";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/GlobalVariables";
import { loadTasksFromJson } from "src/utils/TaskItemUtils";
import { refreshBoardData } from "src/utils/BoardOperations";
import { renderColumns } from "src/utils/RenderColumns";
import { taskItem } from "src/interfaces/TaskItem";

export function refreshKanbanBoard(app: App) {
	app: App;

	console.log(
		"refreshKanbanBoard : From Main.ts : Running the function to refresh the whole KanbanBoard.tsx component..."
	);
	try {
		const leaf = app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD)[0];
		if (leaf) {
			leaf.detach(); // Detach the current KanbanView
			app.workspace
				.getLeaf(true)
				.setViewState({ type: VIEW_TYPE_TASKBOARD, active: true }); // Recreate the view
		}
	} catch (err) {
		console.info(err);
	}
}

// Create a function that clears tasks and refreshes the board
export const updateTasksAndRefreshBoard = (
	setTasks: Dispatch<SetStateAction<taskItem[]>>,
	setBoards: React.Dispatch<React.SetStateAction<any[]>>,
	activeBoard: number,
	colType: string,
	data: any
) => {
	console.log(
		"updateTasksAndRefreshBoard : I hope this is running only once"
	);
	// Clear the tasks array
	setTasks([]);
	sleep(10);
	// const { allTasksWithStatus, pendingTasks, completedTasks } =
	// 	loadTasksFromJson();

	// Refresh board and tasks
	refreshBoardData(setBoards, () => {
		console.log(
			"updateTasksAndRefreshBoard : Inside the emtpy callBack function ..."
		);
		// renderColumns(
		// 	setTasks,
		// 	activeBoard,
		// 	colType,
		// 	data,
		// 	pendingTasks,
		// 	completedTasks
		// );
		// console.warn(
		// 	"JUst now ran the renderColumn function, but i think it is running only once, but it should have ran 6 times, since there are 6 columns."
		// );
	});
};


// Create a function that clears tasks and refreshes the board
export const loadDataTosetBoards = (
	setTasks: Dispatch<SetStateAction<taskItem[]>>,
	setBoards: React.Dispatch<React.SetStateAction<any[]>>
) => {
	console.log(
		"updateTasksAndRefreshBoard : I hope this is running only once"
	);
	// Clear the tasks array
	setTasks([]);
	sleep(10);
	// const { allTasksWithStatus, pendingTasks, completedTasks } =
	// 	loadTasksFromJson();

	// Refresh board and tasks
	refreshBoardData(setBoards, () => {
		console.log(
			"updateTasksAndRefreshBoard : Inside the emtpy callBack function ..."
		);
		// renderColumns(
		// 	setTasks,
		// 	activeBoard,
		// 	colType,
		// 	data,
		// 	pendingTasks,
		// 	completedTasks
		// );
		// console.warn(
		// 	"JUst now ran the renderColumn function, but i think it is running only once, but it should have ran 6 times, since there are 6 columns."
		// );
	});
};

// This will clear out the tasks and will refreshes the tasks under the column, whose tasks has been updated just now, from the board.
export const updateTasksAndRefreshColumn = (
	setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeBoard: number,
	colType: string,
	data: any
) => {
	// Clear the tasks array
	setTasks([]);
	sleep(10);
	// Refresh board and tasks
	const { allTasksWithStatus, pendingTasks, completedTasks } =
		loadTasksFromJson();
	console.log("updateTasksAndRefreshColumn : Tasks and board refreshed...");
	renderColumns(
		setTasks,
		activeBoard,
		colType,
		data,
		pendingTasks,
		completedTasks
	);
};
