// /src/components/Column.tsx -------- V3

import { App, Modal } from 'obsidian';
import React, { useEffect, useState } from 'react';
import { RxDotsVertical, RxDragHandleDots2 } from "react-icons/rx";
import { deleteTaskFromFile, deleteTaskFromJson, updateTaskInFile, updateTaskInJson } from 'src/utils/TaskItemUtils';
import { moveFromCompletedToPending, moveFromPendingToCompleted } from 'src/utils/TaskItemUtils';
import { taskItem, taskJsonMerged, tasksJson } from 'src/interfaces/TaskItemProps';

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { ColumnProps } from '../interfaces/ColumnProps';
import { DeleteConfirmationModal } from '../modal/DeleteConfirmationModal';
import TaskItem from './TaskItem';
import { eventEmitter } from 'src/services/EventEmitter';
import { renderColumns } from 'src/utils/RenderColumns'; // Import the renderColumns function

interface ColumnPropsWithSetBoards extends ColumnProps {
	setBoards: React.Dispatch<React.SetStateAction<any[]>>; // Extend ColumnProps to include setBoards
}

const Column: React.FC<ColumnPropsWithSetBoards> = ({
	app,
	plugin,
	activeBoard,
	colType,
	data,
	tasks: externalTasks,
	allTasks: allTasksExternal
	// pendingTasks,  // New props for pending tasks
	// completedTasks // New props for completed tasks
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
			renderColumns(plugin, setTasks, activeBoard, colType, data, allTasksExternal);
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

	return (
		<div className="TaskBoardColumnsSection" style={{ '--column-width': columnWidth }} >
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					{/* <button className="columnDragIcon"><RxDragHandleDots2 /></button> */}
					<div className="columnTitle">{data.name}</div>
				</div>
				<RxDotsVertical />
			</div>
			<div className="tasksContainer">
				{tasks.length > 0 ? (
					tasks.map((task, index) => (
						<TaskItem
							app={app}
							plugin={plugin}
							key={index}
							task={task}
							onEdit={() => handleEditTask(task)}
							onDelete={() => handleDeleteTask(app, task)}
							onCheckboxChange={() => handleCheckboxChange(task)}
							onSubTasksChange={(updatedTask) => handleSubTasksChange(updatedTask)}
						/>
					))
				) : (
					<p>No tasks available</p>
				)}
			</div>
		</div>
	);
};

export default Column;















// /src/components/Column.tsx -------- V2 - WORKING

// import React, { useEffect, useState } from 'react';
// import TaskItem from './TaskItem';
// import fs from 'fs';
// import path from 'path';

// interface ColumnProps {
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

// const Column: React.FC<ColumnProps> = ({ tag, data }) => {
// 	const [tasks, setTasks] = useState<any[]>([]);

// 	// Load tasks from tasks.json file
// 	useEffect(() => {
// 		const loadTasks = async () => {

// 			const basePath = (window as any).app.vault.adapter.basePath;
// 			const tasksPath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'tasks.json');

// 			try {
// 				if (fs.existsSync(tasksPath)) {
// 					const tasksData = fs.readFileSync(tasksPath, 'utf8');
// 					const allTasks = JSON.parse(tasksData);
// 					const filteredTasks = filterTasksByColumn(allTasks);
// 					setTasks(filteredTasks);
// 				} else {
// 					console.warn("tasks.json file not found.");
// 				}
// 			} catch (error) {
// 				console.error("Error reading tasks.json:", error);
// 			}
// 		};

// 		loadTasks();
// 	}, [tag, data]);

// 	// Function to filter tasks based on the column's tag and properties
// 	const filterTasksByColumn = (allTasks: any) => {
// 		const today = new Date();
// 		const pendingTasks = allTasks.Pending || [];
// 		const completedTasks = allTasks.Completed || [];
// 		let tasksToDisplay: any[] = [];

// 		if (tag === "undated") {
// 			tasksToDisplay = pendingTasks.filter(task => !task.due);
// 		} else if (data.range) {
// 			const { from, to } = data.range.rangedata;
// 			tasksToDisplay = pendingTasks.filter(task => {
// 				if (!task.due) return false;
// 				const dueDate = new Date(task.due);
// 				const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

// 				if (from < 0 && to < 0) {
// 					return diffDays < 0;
// 				} else if (from === 0 && to === 0) {
// 					return diffDays === 0;
// 				} else if (from === 1 && to === 1) {
// 					return diffDays === 1;
// 				} else if (from === 1 && to === 2) {
// 					return diffDays === 2;
// 				}

// 				return false;
// 			});
// 		} else if (tag === "untagged") {
// 			tasksToDisplay = pendingTasks.filter(task => !task.tag);
// 		} else if (tag === "nameTag") {
// 			tasksToDisplay = pendingTasks.filter(task => task.tag === data.coltag);
// 			console.log(task.tag);
// 		} else if (tag === "otherTag") {
// 			tasksToDisplay = pendingTasks.filter(task => task.tag && task.tag !== data.coltag);
// 		} else if (tag === "completed") {
// 			tasksToDisplay = completedTasks;
// 		}

// 		return tasksToDisplay;
// 	};

// 	return (
// 		<div className="TaskBoardColumnsSection">
// 			<div className="taskBoardColumnSecHeader">
// 				<div className="columnTitle">{data.name}</div>
// 				<div className="columnDragIcon"></div>
// 			</div>
// 			<div className="tasksContainer">
// 				{tasks.length > 0 ? (
// 					tasks.map((task, index) => <TaskItem key={index} task={task} />)
// 				) : (
// 					<p>No tasks available</p>
// 				)}
// 			</div>
// 		</div>
// 	);
// };

// export default Column;














// // src/components/Column.tsx  -------  Before Adding Logic - WORKING
// import React from 'react';
// import TaskItem from './TaskItem';
// // import "../styles/Column.css"; // CSS file specific to the column styling

// interface ColumnProps {
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

// // Add some dummy tasks to display in the columns
// const dummyTasks = [
// 	{ id: 1, title: "Create a Photo with White Background.", dueDate: "Every day", tag: "Urgent", column: "Over Due" },
// 	{ id: 2, title: "Create Medical Certificate: Format", dueDate: "Tomorrow", tag: "Urgent", column: "Over Due" },
// 	{ id: 3, title: "Delete the Videos .", dueDate: "29-08-2024", tag: "Urgent", column: "Over Due" },
// 	{ id: 4, title: "Videos you have downloaded, once you finish them.", dueDate: "29-08-2024", tag: "Urgent", column: "Over Due" },
// 	{ id: 5, title: "ownloaded, once you finish them.", dueDate: "29-08-2024", tag: "Urgen", column: "Over Due" },
// 	{ id: 6, title: "Delete the Videos you have downloaded, once you finish them.", dueDate: "29-08-2024", tag: "Urgent", column: "Over Due" },
// 	{ id: 7, title: "once you finish them.", dueDate: "29-08-2024", tag: "Urgent", column: "Over Due" },
// ];

// const Column: React.FC<ColumnProps> = ({ tag, data }) => {
// 	// const tasks = []; // Fetch and map your tasks from the vault
// 	const tasks = dummyTasks;

// 	// console.log(tag);
// 	// console.log(data);

// 	return (
// 		<div className="TaskBoardColumnsSection">
// 			<div className="taskBoardColumnSecHeader">
// 				<div className="columnTitle">{data.name}</div>
// 				<div className="columnDragIcon"></div>
// 			</div>
// 			<div className="tasksContainer">
// 				{tasks.length > 0 ? (
// 					tasks.map((task, index) => <TaskItem key={index} task={task} />)
// 				) : (
// 					<p>No tasks available</p>
// 				)}
// 			</div>
// 		</div>
// 	);
// };

// export default Column;
