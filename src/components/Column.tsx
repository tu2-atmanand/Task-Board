// /src/components/Column.tsx -------- V3

import { App, Modal } from 'obsidian';
import React, { useEffect, useState } from 'react';
import { RxDotsVertical, RxDragHandleDots2 } from "react-icons/rx";
import { deleteTaskFromFile, deleteTaskFromJson, loadTasksFromJson, updateTaskInFile, updateTaskInJson } from 'src/utils/TaskItemUtils';
import { moveFromCompletedToPending, moveFromPendingToCompleted } from 'src/utils/TaskItemUtils';
import { updateTasksAndRefreshBoard, updateTasksAndRefreshColumn } from 'src/services/RefreshServices';

import { ColumnProps } from '../interfaces/Column';
import { DeleteConfirmationModal } from '../modal/DeleteConfirmationModal';
import { EditTaskModal } from '../modal/EditTaskModal';
import TaskItem from './TaskItem';
import { eventEmitter } from 'src/services/EventEmitter';
import { loadGlobalSettings } from 'src/utils/SettingsOperations';
import { refreshBoardData } from 'src/utils/BoardOperations';
import { renderColumns } from 'src/utils/RenderColumns'; // Import the renderColumns function
import { taskItem } from 'src/interfaces/TaskItem';

interface ColumnPropsWithSetBoards extends ColumnProps {
	setBoards: React.Dispatch<React.SetStateAction<any[]>>; // Extend ColumnProps to include setBoards
}

const Column: React.FC<ColumnPropsWithSetBoards> = ({
	activeBoard,
	colType,
	data,
	setBoards,
	tasks: externalTasks,
	pendingTasks,  // New props for pending tasks
	completedTasks // New props for completed tasks
}) => {
	// Local tasks state, initially set from external tasks
	const [tasks, setTasks] = useState<taskItem[]>(externalTasks);
	let globalSettings = loadGlobalSettings(); // Load the globalSettings to check dayPlannerPlugin status
	globalSettings = globalSettings.data.globalSettings;

	// Sync local tasks state with external tasks when they change
	useEffect(() => {
		setTasks(externalTasks);
	}, [externalTasks]);

	// Render tasks using the tasks passed from KanbanBoard
	useEffect(() => {
		setTasks([]);
		renderColumns(setTasks, activeBoard, colType, data, pendingTasks, completedTasks);
	}, [colType, data, pendingTasks, completedTasks]);

	const handleCheckboxChange = (updatedTask: taskItem) => {
		const moment = require("moment");
		// Remove task from the current state
		const updatedTasks = tasks.filter(t => t.id !== updatedTask.id);
		// console.log("The task i recieved in Columns.tsx which i have marked completed=True : ", updatedTask);
		// console.log("The tasks which has been filtered : ", updatedTasks);
		setTasks(updatedTasks); // Update state to remove completed task

		// Check if the task is completed
		if (updatedTask.completed) {
			const taskWithCompleted = { ...updatedTask, completed: "" };
			// Move from Completed to Pending
			moveFromCompletedToPending(taskWithCompleted);
			updateTaskInFile(taskWithCompleted, taskWithCompleted);
		} else {
			console.log("The format give by user for completion date : ", globalSettings?.taskCompletionDateTimePattern, " | The date-time i have got from the moment library : ", moment().format(globalSettings?.taskCompletionDateTimePattern));
			const taskWithCompleted = { ...updatedTask, completed: moment().format(globalSettings?.taskCompletionDateTimePattern), };
			// Move from Pending to Completed
			moveFromPendingToCompleted(taskWithCompleted);
			updateTaskInFile(taskWithCompleted, taskWithCompleted);
		}


		// Following are multiple method used for refresing only the columns and not the whole board : 

		// renderColumns(setTasks, colType, data);

		// // PLEASE NOTE : Keep the following lines as it is, when i check the box, without updating the whole board, the TaskItem Card moves from the Todays column into Completed column and vice-versa very smoothly.
		// refreshBoardData(setBoards, () => {
		// 	// renderColumns(setTasks, activeBoard, colType, data);
		// 	console.log("The below line is loading the tasks from tasks.json, hopefully this line will be running only once...");
		// 	const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();

		// 	// renderColumns(setTasks, activeBoard, colType, data, pendingTasks, completedTasks);
		// });

		// const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();
		// renderColumns(setTasks, activeBoard, colType, data, pendingTasks, completedTasks);


		// updateTasksAndRefreshColumn(setTasks, activeBoard, colType, data);

		// Since now i have change lot of things, the above methods wont work for Loading New tasks from tasks.json and refreshing all the columns.
		eventEmitter.emit("REFRESH_COLUMN");
	};

	const handleSubTasksChange = (updatedTask: taskItem) => {
		// const moment = require("moment");
		// Remove task from the current state
		// const updatedTasks = tasks;
		// console.log("The task i recieved in Columns.tsx which i have marked completed=True : ", updatedTask);
		// console.log("The tasks which has been filtered : ", updatedTasks);
		// setTasks(updatedTasks); // Update state to remove completed task
		// console.log("The new task which i have received and which i am going to put in the taks.json : ", updatedTask);
		updateTaskInJson(updatedTask);
		updateTaskInFile(updatedTask, updatedTask);
	};

	const handleDeleteTask = (task: taskItem) => {
		const app = (window as any).app as App; // Fetch the Obsidian app instance
		const deleteModal = new DeleteConfirmationModal(app, {
			app, // Add app here
			onConfirm: () => {
				deleteTaskFromFile(task);
				deleteTaskFromJson(task);
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
		const app = (window as any).app as App;
		const editModal = new EditTaskModal(app, task, (updatedTask) => {
			updatedTask.filePath = task.filePath;
			// Update the task in the file and JSON
			updateTaskInFile(updatedTask, task);
			updateTaskInJson(updatedTask);

			// TODO : OPTIMIZATION : Find out whether only body is changed. Because if only body is changed, then there is no need to update the whole board, you can just use the below one line of setTasks and only that specific task component can be updated. And for other filds like, tag or due, the whole board should be changed, since the task compoent has to disappear from one column and appear into another. Or find a  better approach to this.
			// Refresh tasks state after update
			// setTasks((prevTasks) => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));

			// Following are multiple method used for refresing only the columns and not the whole board : 

			// renderColumns(setTasks, tag, data);

			// --- MY METHOD ---------
			// const emptyTheTasks: Task[] = [];
			// setTasks(emptyTheTasks);
			// sleep(10);

			// setTasks([]);

			// THIS METHOD IS NOTE WORKING
			// refreshBoardData(setBoards, () => {
			// 	console.log("Task updated, running the Dispatch method of updating the board...");
			// 	renderColumns(setTasks, activeBoard, colType, data);
			// });

			// ONLY THIS BELOW METHOD IS WORKING, AND IT ONLY REFRESHES THE WHOLE COLUMN, YOU CAN SEE ALL THE TASKITEM FROM THIS COLUMN GETTING REFRESHED, REST COLUMNS REMAINS SILENT, BUT YOU KNOW OBVIOULSY THEY ARE ALSO GETTING ADDED FROM NEW TASKS.JSON DATA.
			// updateTasksAndRefreshBoard(setTasks, setBoards, activeBoard, colType, data);
			// updateTasksAndRefreshColumn(setTasks, activeBoard, colType, data);

			// Since now i have change lot of things, the above methods wont work for Loading New tasks from tasks.json and refreshing all the columns.
			eventEmitter.emit("REFRESH_COLUMN");
		});
		editModal.open();
	};


	return (
		<div className="TaskBoardColumnsSection">
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
							key={index}
							task={task}
							onEdit={() => handleEditTask(task)}
							onDelete={() => handleDeleteTask(task)}
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
