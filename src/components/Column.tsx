// /src/components/Column.tsx -------- V3

import { App, Modal } from 'obsidian';
import React, { useEffect, useState } from 'react';
import { RxDotsVertical, RxDragHandleDots2 } from "react-icons/rx";
import { deleteTaskFromFile, deleteTaskFromJson, updateTaskInFile, updateTaskInJson } from 'src/utils/TaskItemUtils';
import { moveFromCompletedToPending, moveFromPendingToCompleted } from 'src/utils/TaskItemUtils';
import { taskItem, taskJsonMerged, tasksJson } from 'src/interfaces/TaskItemProps';

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { CSSProperties } from 'react';
import { ColumnProps } from '../interfaces/ColumnProps';
import { DeleteConfirmationModal } from '../modal/DeleteConfirmationModal';
import TaskItem from './TaskItem';
import { eventEmitter } from 'src/services/EventEmitter';
import { renderColumns } from 'src/utils/RenderColumns'; // Import the renderColumns function
import { t } from 'src/utils/lang/helper';

type CustomCSSProperties = CSSProperties & {
	'--column-width': string;
};

interface ColumnPropsWithSetBoards extends ColumnProps {
	setBoards: React.Dispatch<React.SetStateAction<any[]>>; // Extend ColumnProps to include setBoards
}

const Column: React.FC<ColumnPropsWithSetBoards> = ({
	app,
	plugin,
	columnIndex,
	activeBoardIndex,
	colType,
	data,
	tasks: externalTasks,
	allTasks: allTasksExternal
}) => {
	// Local tasks state, initially set from external tasks
	const [tasks, setTasks] = useState<taskItem[]>(externalTasks);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>(allTasksExternal);
	// let globalSettings = loadGlobalSettings(); // Load the globalSettings to check dayPlannerPlugin status
	// globalSettings = globalSettings.data.globalSettings;
	const globalSettings = plugin.settings.data.globalSettings;
	// console.log("Now even after user makes any changes from the Setting Tab, it should reflect in the following setting data i am reading using plugin.settings : ", globalSettings);

	// Sync local tasks state with external tasks when they change
	useEffect(() => {
		setTasks(externalTasks);
	}, [externalTasks]);

	// Render tasks using the tasks passed from KanbanBoard
	useEffect(() => {
		// setTasks([]);
		// console.log("FROM COLUMN.TSX : Data i will be sending to renderColumns function : ", allTasksExternal);
		if (allTasksExternal.Pending.length > 0 || allTasksExternal.Completed.length > 0) {
			renderColumns(plugin, setTasks, activeBoardIndex, colType, data, allTasksExternal);
		}
	}, [colType, data, allTasksExternal]);

	const handleCheckboxChange = (updatedTask: taskItem) => {
		const moment = require("moment");

		// NOTE : The following two lines removes the task which has been marked as completed or vice-versa, but only the TaskTitle disappers, if that task has a body, then what you see on the board is, the body of this updated task gets appeded to the task either above or below. This most probably will be due to worst way of rendering. I am not sure about this or if in future Svelte going to solve it or not.
		const updatedTasks = tasks.filter(t => t.id !== updatedTask.id);
		setTasks(updatedTasks); // Update state to remove completed task

		// Check if the task is completed
		if (updatedTask.completed) {
			const taskWithCompleted = { ...updatedTask, completed: "" };
			// Move from Completed to Pending
			moveFromCompletedToPending(plugin, taskWithCompleted);
			updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
		} else {
			console.log("The format give by user for completion date : ", globalSettings?.taskCompletionDateTimePattern, " | The date-time i have got from the moment library : ", moment().format(globalSettings?.taskCompletionDateTimePattern));
			const taskWithCompleted = { ...updatedTask, completed: moment().format(globalSettings?.taskCompletionDateTimePattern), };
			// Move from Pending to Completed
			moveFromPendingToCompleted(plugin, taskWithCompleted);
			updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
		}
		// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the moveFromPendingToCompleted and moveFromCompletedToPending functions, because if i add that here, then all the things are getting executed parallely instead of sequential.
	};

	const handleSubTasksChange = (updatedTask: taskItem) => {
		// const moment = require("moment");
		// Remove task from the current state
		// const updatedTasks = tasks;
		// console.log("The task i recieved in Columns.tsx which i have marked completed=True : ", updatedTask);
		// console.log("The tasks which has been filtered : ", updatedTasks);
		// setTasks(updatedTasks); // Update state to remove completed task
		// console.log("The new task which i have received and which i am going to put in the taks.json : ", updatedTask);
		updateTaskInJson(plugin, updatedTask);
		updateTaskInFile(plugin, updatedTask, updatedTask);
	};

	const handleDeleteTask = (app: App, task: taskItem) => {
		const deleteModal = new DeleteConfirmationModal(app, {
			app, // Add app here
			onConfirm: () => {
				deleteTaskFromFile(plugin, task);
				deleteTaskFromJson(plugin, task);
				// Remove the task from state after deletion
				setTasks((prevTasks) => prevTasks.filter(t => t.id !== task.id));
			},
			onCancel: () => {
				console.log('Task deletion canceled');
			}
		});
		deleteModal.open();
	};

	const handleEditTask = (task: taskItem) => {
		const editModal = new AddOrEditTaskModal(
			app,
			plugin,
			(updatedTask) => {
				updatedTask.filePath = task.filePath;
				// Update the task in the file and JSON
				updateTaskInFile(plugin, updatedTask, task);
				updateTaskInJson(plugin, updatedTask);
				// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
			},
			task.filePath,
			task);
		editModal.open();
	};

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	return (
		<div className="TaskBoardColumnsSection" style={{ '--column-width': columnWidth } as CustomCSSProperties}>
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					{/* <button className="columnDragIcon" aria-label='More Column Options' ><RxDragHandleDots2 /></button> */}
					<div className="columnTitle">{data.name}</div>
				</div>
				{/* <RxDotsVertical /> */}
			</div>
			<div className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}>
				{tasks.length > 0 ? (
					tasks.map((task, index = task.id) => {
						const shouldRenderTask = parseInt(activeBoardSettings.filterPolarity || "0") === 1 &&
							task.tags.some((tag: string) => activeBoardSettings.filters?.includes(tag));

						if (shouldRenderTask || parseInt(activeBoardSettings.filterPolarity || "0") === 0) {
							return ( // Ensure that TaskItem is returned
								<TaskItem
									key={index}
									app={app}
									plugin={plugin}
									taskKey={index}
									task={task}
									columnIndex={columnIndex}
									activeBoardSettings={activeBoardSettings}
									onEdit={() => handleEditTask(task)}
									onDelete={() => handleDeleteTask(app, task)}
									onCheckboxChange={() => handleCheckboxChange(task)}
									onSubTasksChange={(updatedTask) => handleSubTasksChange(updatedTask)}
								/>
							);
						}

						return null; // Return null if the condition is false, to avoid undefined behavior.
					})
				) : (
					<p>{t(7)}</p>
				)}
			</div>
		</div>
	);

};

export default Column;
