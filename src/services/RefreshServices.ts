// /src/services/RefreshServices.ts

import { Dispatch, SetStateAction } from "react";

import { App } from "obsidian";
import { KanbanView } from "src/views/KanbanView";
import { Task } from "../interfaces/Column";
import TaskBoard from "main";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/GlobalVariables";
import { refreshBoardData } from "src/utils/refreshBoard";
import { refreshTasks } from "src/utils/RefreshColumns";

export function refreshKanbanBoard(app: App) {
	app: App;

	console.log(
		"RefreshKanbanBoard from Main.ts : Running the function to refresh the whole KanbanBoard.tsx component..."
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
