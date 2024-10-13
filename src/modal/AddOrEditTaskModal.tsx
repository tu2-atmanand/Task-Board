// /src/modal/AddOrEditTaskModal.tsx

import { App, Component, HoverParent, HoverPopover, MarkdownPreviewView, MarkdownRenderer, Modal, TFile } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM, { Root } from "react-dom/client";
import { priorityEmojis, priorityOptions, taskItem } from "src/interfaces/TaskItemProps";

import CodeMirrorEditor from "src/components/MarkdownEditor";
import { FaTrash } from 'react-icons/fa';
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import TaskBoard from "main";
import { hookMarkdownLinkMouseEventHandlers } from "src/services/MarkdownHoverPreview";
import { loadGlobalSettings } from "src/utils/JsonFileOperations";
import { taskElementsFormatter } from "src/utils/TaskItemUtils";

// Functional React component for the modal content
const EditTaskContent: React.FC<{ app: App, plugin: TaskBoard, root: HTMLElement, task?: taskItem, taskExists?: boolean, filePath: string; onSave: (updatedTask: taskItem) => void; onClose: () => void }> = ({ app, plugin, root, task = {}, taskExists, filePath, onSave, onClose }) => {
	const [title, setTitle] = useState(task.title || '');
	const [due, setDue] = useState(task.due || '');
	const [tag, setTag] = useState(task.tag || '');
	const [startTime, setStartTime] = useState(task.time ? task.time.split(' - ')[0] : '');
	const [endTime, setEndTime] = useState(task.time ? task.time.split(' - ')[1] || '' : '');
	const [newTime, setNewTime] = useState(task.time || '');
	const [priority, setPriority] = useState(task.priority || 0);
	const [bodyContent, setBodyContent] = useState(task.body ? task.body.filter(line => !line.startsWith('- [ ]') && !line.startsWith('- [x]')).join('\n') : '');
	const [subTasks, setSubTasks] = useState(
		task.body ? task.body.filter(line => line.startsWith('- [ ]') || line.startsWith('- [x]')) : []
	);
	const fileContentRef = useRef<HTMLDivElement>(null);

	// Automatically update end time if only start time is provided
	useEffect(() => {
		if (startTime) {
			const [hours, minutes] = startTime.split(':');
			const newEndTime = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`;
			setEndTime(newEndTime);
			const newTime = `${startTime} - ${newEndTime}`;
			setNewTime(newTime);
		}
	}, [startTime, endTime]);

	// Function to toggle subtask completion
	const toggleSubTaskCompletion = (index: number) => {
		const updatedSubTasks = [...subTasks];
		updatedSubTasks[index] = updatedSubTasks[index].startsWith('- [x]')
			? updatedSubTasks[index].replace('- [x]', '- [ ]')
			: updatedSubTasks[index].replace('- [ ]', '- [x]');
		setSubTasks(updatedSubTasks);
	};

	const removeSubTask = (index: number) => {
		const updatedSubTasks = subTasks.filter((_, idx) => idx !== index);
		setSubTasks(updatedSubTasks);
	};

	// Function to add a new subtask
	const addNewSubTask = () => {
		setSubTasks([...subTasks, '- [ ] ']);
	};

	// Function to update subtask content
	const updateSubTaskContent = (index: number, value: string) => {
		const updatedSubTasks = [...subTasks];
		updatedSubTasks[index] = updatedSubTasks[index].replace(/- \[.\] .*/, `- [ ] ${value}`);
		setSubTasks(updatedSubTasks);
	};

	// Function to handle saving the updated task
	const handleSave = () => {
		const updatedTask = {
			...task,
			title,
			body: [
				...bodyContent.split('\n'),
				...subTasks,
			],
			due,
			tag,
			time: newTime,
			priority,
			filePath: filePath,
		};
		onSave(updatedTask);
		onClose();
	};


	let formatedContent = '';
	const newTaskContent: taskItem = {
		...task,
		title: title,
		body: [
			...bodyContent.split('\n'),
			...subTasks,
		],
		due: due,
		tag: tag,
		time: newTime,
		priority: priority,
		filePath: '',
	};
	// Reference to the HTML element where markdown will be rendered

	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = new Component();
		componentRef.current.load();

		return () => {
			// Cleanup the component on unmount
			componentRef.current?.unload();
		};
	}, []);

	const previewContainerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		formatedContent = taskElementsFormatter(plugin, newTaskContent);
		console.log("Content received from the formatter function :\n", formatedContent);
		if (previewContainerRef.current) {
			// Clear previous content before rendering new markdown
			previewContainerRef.current.innerHTML = '';

			MarkdownUIRenderer.renderTaskDisc(
				app,
				formatedContent,
				previewContainerRef.current,
				filePath,
				componentRef.current
			);

			hookMarkdownLinkMouseEventHandlers(app, previewContainerRef.current, filePath, filePath);
		}
	}, [newTaskContent]); // Re-render when newTaskContent changes


	const [isCtrlPressed, setIsCtrlPressed] = useState(false);  // Track CTRL/CMD press
	// Key press listeners for CTRL/CMD
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey) {
				setIsCtrlPressed(true);
			}
		};

		const handleKeyUp = () => {
			setIsCtrlPressed(false);
		};

		root.addEventListener('keydown', handleKeyDown);
		root.addEventListener('keyup', handleKeyUp);

		return () => {
			root.removeEventListener('keydown', handleKeyDown);
			root.removeEventListener('keyup', handleKeyUp);
		};
	}, []);

	return (
		<div className="EditTaskModalHome">
			{taskExists ?
				<div className="EditTaskModalHome-title">Edit Task</div> : <div className="EditTaskModalHome-title">Add New Task</div>
			}
			<div className="EditTaskModalHomeBody">
				<div className="EditTaskModalHomeLeftSec">
					<label className="EditTaskModalHomeFieldTitle">Task Title</label>
					<input type="text" className="EditTaskModalHome-taskBody" value={title} onChange={(e) => setTitle(e.target.value)} />
					{/* Body Content */}
					<label className="EditTaskModalHomeFieldTitle">Task Description</label>
					<textarea
						className="EditTaskModalBodyDescription"
						value={bodyContent}
						onChange={(e) => setBodyContent(e.target.value)}
						placeholder="Body content"
					/>
					{/* Subtasks */}
					<label className="EditTaskModalHomeFieldTitle">Sub Tasks</label>
					<div className="EditTaskModalsubTasksContainer">
						{subTasks.map((subTask: string, index: number) => (
							<div key={index} className="EditTaskModalsubTaskItem">
								<input
									type="checkbox"
									checked={subTask.startsWith('- [x]')}
									onChange={() => toggleSubTaskCompletion(index)}
								/>
								<input
									className="EditTaskModalsubTaskItemInput"
									type="text"
									value={subTask.replace(/- \[.\] /, '')}
									onChange={(e) => updateSubTaskContent(index, e.target.value)}
								/>
								<FaTrash
									size={15}
									enableBackground={0}
									opacity={0.7}
									style={{ marginInlineStart: '0.8em' }}
									title="Delete Sub-Task"
									onClick={() => removeSubTask(index)}
									cursor={'pointer'}
								/>
							</div>
						))}
						<button style={{ width: 'fit-content', alignSelf: 'end' }} onClick={addNewSubTask}>Add new Sub-Task</button>
					</div>
					{/* Live File Preview */}
					<div className="EditTaskModalHomePreview">
						<h3 style={{ margin: 0 }}>File Preview</h3>
						<div className="EditTaskModalHomePreviewContainer" ref={fileContentRef}>
							<div className="EditTaskModalHomePreviewHeader">
								<h6>Parent File Location : {filePath}</h6>
								<button className="EditTaskModalHomeOpenFileBtn"
									id="EditTaskModalHomeOpenFileBtn"
									// onMouseEnter={handleMouseEnter}
									// onMouseOver={handleMouseEnter}
									// onClick={() => app.workspace.openLinkText(task.filePath, "")}
									onClick={() => isCtrlPressed ? app.workspace.openLinkText('', filePath, 'window') : app.workspace.openLinkText('', filePath, false)}
								>Open File</button>
							</div>
							<div className="EditTaskModalHomePreviewBody" ref={previewContainerRef}>
								{/* The markdown content will be rendered here */}
							</div>
						</div>
					</div>
				</div>
				<div className="EditTaskModalHomeRightSec">
					{/* Task Time Input */}
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task Start Time</label>
						<input className="EditTaskModalHomeTimeInput" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
					</div>
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task End Time</label>
						<input className="EditTaskModalHomeTimeInput" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
					</div>

					{/* Task Due Date */}
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task Due Date</label>
						<input className="EditTaskModalHomeDueInput" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
					</div>

					{/* Task Priority */}
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task Priority</label>
						<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => setPriority(e.target.value)}>
							{priorityOptions.map((option) => (
								<option key={option.value} value={option.value}>{option.text}</option>
							))}
						</select>
					</div>

					{/* Task Tag */}
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task Tag</label>
						<input className="EditTaskModalHome-tagValue" type="text" value={tag} onChange={(e) => setTag(`#${e.target.value.replace('#', '').trim()}`)} />
					</div>
				</div>
			</div>
			<button className="EditTaskModalHomeSaveBtn" onClick={handleSave}>Save</button>
		</div>
	);
};

// Class component extending Modal for Obsidian
export class AddOrEditTaskModal extends Modal {
	app: App;
	plugin: TaskBoard;
	task: taskItem;
	filePath: string;
	taskExist: boolean = false;
	onSave: (updatedTask: taskItem) => void;

	constructor(app: App, plugin: TaskBoard, onSave: (updatedTask: taskItem) => void, filePath: string, task?: taskItem) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.filePath = filePath;
		this.onSave = onSave;
		if (task) {
			this.task = task;
			this.taskExist = true;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<EditTaskContent
			app={this.app}
			plugin={this.plugin}
			root={contentEl}
			task={this.task}
			taskExists={this.taskExist}
			filePath={this.filePath}
			onSave={this.onSave}
			onClose={() => this.close()}
		/>);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
















// // /src/components/EditTaskModal.tsx  --- V1 - WOrking

// import { App, Modal } from "obsidian";
// import React, { useState } from "react";

// import ReactDOM from "react-dom/client";

// // Functional React component for the modal content
// const EditTaskContent: React.FC<{ task: any; onSave: (updatedTask: any) => void; onClose: () => void }> = ({ task, onSave, onClose }) => {
// 	const [body, setBody] = useState(task.body);
// 	const [due, setDue] = useState(task.due);
// 	const [tag, setTag] = useState(task.tag);
// 	const [time, setTime] = useState(task.time);
// 	const [priority, setPriority] = useState(task.priority);

// 	const handleSave = () => {
// 		const updatedTask = {
// 			...task,
// 			body,
// 			due,
// 			tag,
// 			time,
// 			priority,
// 		};
// 		onSave(updatedTask);
// 		onClose();
// 	};

// 	return (
// 		<div className="EditTaskModalHome">
// 			<div className="EditTaskModalHome-title">Edit Task</div>
// 			<textarea className="EditTaskModalHome-taskBody" value={body} onChange={(e) => setBody(e.target.value)} />
// 			<div className="EditTaskModalHomeTime">
// 				<h3>Task Due Time : </h3> <div>⏰ [{time}]</div>
// 				<div>Start Time : <input className="EditTaskModalHomeTimeInput" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
// 				<div>End Time : <input className="EditTaskModalHomeTimeInput" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
// 			</div>
// 			<table>
// 				<tbody>
// 					<tr>
// 						<td>
// 							<div className="EditTaskModalHomeFieldTitle">Task Due Date : </div>
// 						</td>
// 						<td className="EditTaskModalHome-tableValues">
// 							<input className="EditTaskModalHome-dueValue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
// 						</td>
// 						<td>
// 							📅{due}
// 						</td>
// 					</tr>
// 					<tr>
// 						<td>
// 							<div className="EditTaskModalHomeFieldTitle">Task Priority : </div>
// 						</td>
// 						<td className="EditTaskModalHome-tableValues">
// 							<input className="EditTaskModalHome-priorityValue" type="dropdown" value={tag} onChange={(e) => setTag(e.target.value)} />
// 						</td>
// 						<td>
// 							{tag}
// 						</td>
// 					</tr>
// 					<tr>
// 						<td>
// 							<div className="EditTaskModalHomeFieldTitle">Task Tag : </div>
// 						</td>
// 						<td className="EditTaskModalHome-tableValues">
// 							<input className="EditTaskModalHome-tagValue" type="text" value={tag} onChange={(e) => setTag(e.target.value)} />
// 						</td>
// 						<td>
// 							{tag}
// 						</td>
// 					</tr>
// 				</tbody>
// 			</table>
// 			<h6>Preview</h6>
// 			<div className="previewBox">
// 				- [ ] {body} | 📅{due} {tag}
// 			</div>
// 			<button className="EditTaskModalHome-saveBtn" onClick={handleSave}>Save</button>
// 		</div>
// 	);
// };

// // Class component extending Modal for Obsidian
// export class EditTaskModal extends Modal {
// 	task: any;
// 	onSave: (updatedTask: any) => void;

// 	constructor(app: App, task: any, onSave: (updatedTask: any) => void) {
// 		super(app);
// 		this.task = task;
// 		this.onSave = onSave;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		const container = document.createElement("div");
// 		contentEl.appendChild(container);

// 		const root = ReactDOM.createRoot(this.contentEl);

// 		root.render(<EditTaskContent
// 			task={this.task}
// 			onSave={this.onSave}
// 			onClose={() => this.close()}
// 		/>)
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }
