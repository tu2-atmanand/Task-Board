// /src/components/Column.tsx -------- V3

import React, { useEffect, useState } from 'react';
import TaskItem from './TaskItem';
import fs from 'fs';
import path from 'path';
import { Modal, App } from 'obsidian';
import { EditTaskModal } from './EditTaskModal';
import { loadTasksFromJson } from 'src/utils/RefreshColumns';
import { ColumnProps, Task } from '../interfaces/Column';
import { DeleteConfirmationModal } from '../utils/DeleteConfirmationModal'; // Import the Delete Modal

const Column: React.FC<ColumnProps> = ({ tag, data }) => {
	const [tasks, setTasks] = useState<Task[]>([]);

	// Load tasks from tasks.json file
	useEffect(() => {
		const loadTasks = async () => {
			const { allTasksWithStatus, pendingTasks, completedTasks } = loadTasksFromJson();
			const filteredTasks = filterTasksByColumn(allTasksWithStatus, pendingTasks, completedTasks);
			setTasks(filteredTasks);
		};

		loadTasks();
	}, [tag, data]);

	// Function to filter tasks based on the column's tag and properties
	const filterTasksByColumn = (allTasks: Task[], pendingTasks: Task[], completedTasks: Task[]) => {
		const today = new Date();
		let tasksToDisplay: Task[] = [];

		// console.log("All Completed Tasks : ", completedTasks);

		if (tag === "undated") {
			tasksToDisplay = pendingTasks.filter(task => !task.due);
			console.log("Tasks Under UnDated Columns : ", tasksToDisplay);
		} else if (data.range) {
			const { from, to } = data.range.rangedata;
			tasksToDisplay = pendingTasks.filter(task => {
				if (!task.due) return false;
				const dueDate = new Date(task.due);
				const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
				console.log("Today : ", today.getDate(), "Due Date : ", dueDate.getDate(), " | The Difference in Due an Today date : ", diffDays);

				if (from < 0 && to === 0) {
					return diffDays < 0;
				} else if (from === 0 && to === 0) {
					return diffDays === 0;
				} else if (from === 1 && to === 1) {
					return diffDays === 1;
				} else if (from === 2 && to === 0) {
					return diffDays >= 2;
				}

				return false;
			});
			console.log("Tasks Under Dated Columns : ", tasksToDisplay);
		} else if (tag === "untagged") {
			tasksToDisplay = pendingTasks.filter(task => !task.tag);
			console.log("Tasks Under Untagged Columns : ", tasksToDisplay);
		} else if (tag === "namedTag") {
			tasksToDisplay = pendingTasks.filter(task => task.tag === data.coltag);
			console.log("Tasks Under Tagged Columns : ", tasksToDisplay);
		} else if (tag === "otherTags") {
			tasksToDisplay = pendingTasks.filter(task => task.tag && task.tag !== data.coltag);
			console.log("Tasks Under OtherTag Columns : ", tasksToDisplay);
		} else if (tag === "completed") {
			// console.log("Completed Tasks : ", completedTasks);
			tasksToDisplay = completedTasks;
		}

		return tasksToDisplay;
	};

	const handleDeleteTask = (task: Task) => {
		const app = (window as any).app as App;
		const deleteModal = new DeleteConfirmationModal(app, {
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

	const deleteTaskFromFile = (task: Task) => {
		const basePath = (window as any).app.vault.adapter.basePath;
		const filePath = path.join(basePath, task.filePath);

		try {
			const fileContent = fs.readFileSync(filePath, 'utf8');
			// Updated regex to match the task body ending with '|'
			const taskRegex = new RegExp(`^- \\[ \\] ${task.body} \\|.*`, 'gm');
			const newContent = fileContent.replace(taskRegex, ''); // Remove the matched line from the file
			fs.writeFileSync(filePath, newContent);
		} catch (error) {
			console.error("Error deleting task from file:", error);
		}
	};


	const deleteTaskFromJson = (task: Task) => {
		const basePath = (window as any).app.vault.adapter.basePath;
		const tasksPath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'tasks.json');

		try {
			const tasksData = fs.readFileSync(tasksPath, 'utf8');
			const allTasks = JSON.parse(tasksData);

			// Remove task from Pending or Completed in tasks.json
			if (allTasks.Pending[task.filePath]) {
				allTasks.Pending[task.filePath] = allTasks.Pending[task.filePath].filter((t: any) => t.id !== task.id);
			}
			if (allTasks.Completed[task.filePath]) {
				allTasks.Completed[task.filePath] = allTasks.Completed[task.filePath].filter((t: any) => t.id !== task.id);
			}

			// Write the updated data back to the JSON file
			fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
		} catch (error) {
			console.error("Error deleting task from tasks.json:", error);
		}
	};

	const handleEditTask = (task: Task) => {
		const app = (window as any).app as App;
		const editModal = new EditTaskModal(app, task, (updatedTask) => {
			updatedTask.filePath = task.filePath;
			// Update the task in the file and JSON
			updateTaskInFile(updatedTask);
			updateTaskInJson(updatedTask);

			// Refresh tasks state after update
			setTasks((prevTasks) => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
		});
		editModal.open();
	};

	const updateTaskInFile = (updatedTask: Task) => {
		console.log("updatedTask i am received in Column.tsx file -2 : ", updatedTask);
		const basePath = (window as any).app.vault.adapter.basePath;
		const filePath = path.join(basePath, updatedTask.filePath);
		// console.log("The File Path which needs to be updated : ", filePath);

		try {
			const fileContent = fs.readFileSync(filePath, 'utf8');
			const taskRegex = new RegExp(`^- \\[ \\] .*?${updatedTask.tag}`, 'gm');
			const newContent = fileContent.replace(taskRegex, `- [ ] ${updatedTask.body} | 📅 ${updatedTask.due} #${updatedTask.tag}`);
			fs.writeFileSync(filePath, newContent);
		} catch (error) {
			console.error("Error updating task in file:", error);
		}
	};

	const updateTaskInJson = (updatedTask: Task) => {
		const basePath = (window as any).app.vault.adapter.basePath;
		const tasksPath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'tasks.json');

		try {
			const tasksData = fs.readFileSync(tasksPath, 'utf8');
			const allTasks = JSON.parse(tasksData);
			console.log("The file of Tasks.json which I am updating: ", allTasks);

			// Function to update a task in a given task category (Pending or Completed)
			const updateTasksInCategory = (taskCategory: any) => {
				return Object.entries(taskCategory).reduce((acc: any, [filePath, tasks]: [string, any[]]) => {
					acc[filePath] = tasks.map((task: any) =>
						task.id === updatedTask.id ? updatedTask : task
					);
					return acc;
				}, {});
			};

			// Update tasks in both Pending and Completed categories
			const updatedPendingTasks = updateTasksInCategory(allTasks.Pending);
			const updatedCompletedTasks = updateTasksInCategory(allTasks.Completed);

			console.log("All updated Pending Tasks to be written in Tasks.json: ", updatedPendingTasks);
			console.log("All updated Completed Tasks to be written in Tasks.json: ", updatedCompletedTasks);

			// Create the updated data object with both updated Pending and Completed tasks
			const updatedData = {
				Pending: updatedPendingTasks,
				Completed: updatedCompletedTasks
			};

			// Write the updated data back to the JSON file
			console.log("The new data to be updated in tasks.json: ", updatedData);
			fs.writeFileSync(tasksPath, JSON.stringify(updatedData, null, 2));
		} catch (error) {
			console.error("Error updating task in tasks.json:", error);
		}
	};

	return (
		<div className="kanbanColumn">
			<div className="columnHeaderBar">
				<div className="columnTitle">{data.name}</div>
				<div className="columnDragIcon"></div>
			</div>
			<div className="tasksContainer">
				{tasks.length > 0 ? (
					tasks.map((task, index) => (
						<TaskItem
							key={index}
							task={task}
							onEdit={() => handleEditTask(task)}
							onDelete={() => handleDeleteTask(task)}
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
// 		<div className="kanbanColumn">
// 			<div className="columnHeaderBar">
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
// 		<div className="kanbanColumn">
// 			<div className="columnHeaderBar">
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
