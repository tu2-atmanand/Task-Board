// /src/modal/EditTaskModal.tsx

import { App, HoverParent, HoverPopover, MarkdownPreviewView, MarkdownRenderer, Modal, TFile } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import { priorityEmojis, priorityOptions } from "src/interfaces/TaskItem";

import { FaTrash } from 'react-icons/fa';
import ReactDOM from "react-dom/client";
import { loadGlobalSettings } from "src/utils/SettingsOperations";

// Functional React component for the modal content
const EditTaskContent: React.FC<{ container: any, app: App, task: any, dayPlannerPlugin: boolean; onSave: (updatedTask: any) => void; onClose: () => void }> = ({ container, app, task, onSave, onClose, dayPlannerPlugin }) => {
	const [title, setTitle] = useState(task.title);
	const [due, setDue] = useState(task.due);
	const [tag, setTag] = useState(task.tag); // Prepend # to tag
	const [startTime, setStartTime] = useState(task.time ? task.time.split(' - ')[0] : '');
	const [endTime, setEndTime] = useState(task.time ? task.time.split(' - ')[1] || '' : '');
	const [newTime, setNewTime] = useState(task.time);
	const [priority, setPriority] = useState(task.priority);
	const [bodyContent, setBodyContent] = useState(task.body.filter((line: string) => !line.startsWith('- [ ]') && !line.startsWith('- [x]')).join('\n'));
	const [subTasks, setSubTasks] = useState(
		task.body.filter((line: string) => line.startsWith('- [ ]') || line.startsWith('- [x]'))
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
		};
		onSave(updatedTask);
		onClose();
	};

	// Unnecessary below memory and CPU wastage, just for the Live Preview thing, you can remove this and create the actual display of the file content, or else, you can keep this as it also, no issues : 
	let newTaskContent = ''
	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	// const bodyLines = bodyContent
	// 	.map((line: string) => `\t${line}`)
	// 	.split('\n');

	// Add the sub-tasks without additional indentation
	const subTasksWithTab = subTasks
		.map((Line: string) => `\n\t${Line}`)

	// Code to render the content of the Task in a Obsidian Markdown view.
	if (dayPlannerPlugin) {
		newTaskContent = `- [ ] ${startTime ? `${startTime} - ${endTime} ` : ''}${title} |${due ? ` 📅${due}` : ''} ${priority > 0 ? priorityEmojis[priority as number] : ''} ${tag}\n\t${bodyContent}\n${subTasksWithTab}`;
	} else {
		newTaskContent = `- [] ${title} |${startTime ? ` ⏰[${startTime} - ${endTime}]` : ''}${due ? ` 📅${due}` : ''} ${priority > 0 ? priorityEmojis[priority as number] : ''} ${tag}\n\t${bodyContent}${subTasksWithTab}`;
	}
	// Reference to the HTML element where markdown will be rendered
	const previewContainerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (previewContainerRef.current) {
			// Clear previous content before rendering new markdown
			previewContainerRef.current.innerHTML = '';

			// Use the MarkdownRenderer.render() method
			MarkdownRenderer.render(
				app,                   // The app object
				newTaskContent,         // The markdown content
				previewContainerRef.current, // The element to append to
				task.filePath,                     // Source path (leave empty if not needed)
				container                    // The parent component (this modal instance)
			);
		}
	}, [newTaskContent]); // Re-render when newTaskContent changes

	// console.log("The difference between, task.filePath : ", task.filePath, " | And app.vault.getAbstractFileByPath(task.filePath) : ", app.vault.getAbstractFileByPath(task.filePath));
	// const data = app.vault.getFileByPath(task.filePath);
	// console.log("The content of file : ", data);


	// // FOR THE FILE PREVIEW FUNCTIONALITY
	// const [isCtrlPressed, setIsCtrlPressed] = useState(false);  // Track CTRL/CMD press
	// const [isPreviewVisible, setIsPreviewVisible] = useState(false);  // Track popup visibility
	// // Key press listeners for CTRL/CMD
	// useEffect(() => {
	// 	const handleKeyDown = (e: KeyboardEvent) => {
	// 		if (e.ctrlKey || e.metaKey) {
	// 			setIsCtrlPressed(true);
	// 		}
	// 	};

	// 	const handleKeyUp = () => {
	// 		setIsCtrlPressed(false);
	// 	};

	// 	window.addEventListener('keydown', handleKeyDown);
	// 	window.addEventListener('keyup', handleKeyUp);

	// 	return () => {
	// 		window.removeEventListener('keydown', handleKeyDown);
	// 		window.removeEventListener('keyup', handleKeyUp);
	// 	};
	// }, []);
	
	// Reference to the HTML element where the hover preview will be rendered
	// const hoverPopoverRef = useRef<HTMLDivElement>(null);

	// const handleMouseEnter = async () => {
	// 	if (!isCtrlPressed) return;  // Only open popup if CTRL/CMD is pressed
	// 	const file = app.vault.getAbstractFileByPath(task.filePath);

	// 	console.log("Mouse entered on the Open File Button...");

	// 	if (file instanceof TFile) {
	// 		try {
	// 			// Read the content of the file
	// 			const fileContent = await app.vault.read(file);

	// 			// Clear the previous content if necessary (optional)
	// 			if (hoverPopoverRef.current) {
	// 				hoverPopoverRef.current.innerHTML = ''; // Optional: clear previous content
	// 			}

	// 			// const markdownPreviewHover = new MarkdownPreviewView(container);
	// 			const parent: HoverParent = HTMLElement;
	// 			const markdownPreviewHover = new HoverPopover(parent, hoverPopoverRef, 1);
	// 			// hoverPopoverRef.hoverPopover = markdownPreviewHover.hoverPopover;

	// 			// Render the file content as a markdown preview
	// 			MarkdownPreviewView.render(
	// 				app,
	// 				fileContent,              // File content as markdown
	// 				hoverPopoverRef.current,   // HTML element to render preview
	// 				task.filePath,             // File path for reference
	// 				container                  // Modal/container element
	// 			);
	// 		} catch (error) {
	// 			console.error("Error reading file content:", error);
	// 		}
	// 	}
	// };

	// TODO : This feature is not working, since the popup is not coming on the top of the 
	const handleMouseEnter = async (event: React.MouseEvent) => {
		const element = document.getElementById('EditTaskModalHomeOpenFileBtn');
		if (element) {
			app.workspace.trigger('hover-link', {
				event,                    // The original mouse event
				source: "EditTaskModalHome",      // Source of the hover
				hoverParent: element,      // The element that triggered the hover
				targetEl: element,         // The element to be hovered (same as parent in this case)
				linktext: task.filePath,   // The file path to preview
				sourcePath: task.filePath  // The source path (same as file path here)
			});
		}
	};


	// const handleMouseLeave = () => {
	// 	if (hoverPopoverRef.current) {
	// 		console.log("Mouse entered on the Open File Button...");
	// 		hoverPopoverRef.current.hide();
	// 	}
	// };

	// const handleMouseLeave = () => {
	// 	setIsPreviewVisible(false);  // Hide the popup when mouse leaves
	// };

	return (
		<div className="EditTaskModalHome">
			<div className="EditTaskModalHome-title">Edit Task</div>
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
						{subTasks.map((subTask, index) => (
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
						<div className="fileContentContainer" ref={fileContentRef}>
							<h6>Parent File Location : {task.filePath}</h6>
							<div className="EditTaskModalHomePreview" ref={previewContainerRef}>
								{/* The markdown content will be rendered here */}
							</div>
							
							<button className="EditTaskModalHomeOpenFileBtn"
								id="EditTaskModalHomeOpenFileBtn"
								onMouseEnter={handleMouseEnter}
								// onMouseOver={handleMouseEnter}
								onClick={() => app.workspace.openLinkText(task.filePath, "")}
							>Open File</button>
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
export class EditTaskModal extends Modal {
	task: any;
	onSave: (updatedTask: any) => void;

	constructor(app: App, task: any, onSave: (updatedTask: any) => void) {
		super(app);
		this.app = app;
		this.task = task;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		let globalSettings = loadGlobalSettings();
		globalSettings = globalSettings.data.globalSettings;
		console.log("The global setting i have loaded : ", globalSettings);
		const dayPlannerPlugin = globalSettings?.dayPlannerPlugin;

		root.render(<EditTaskContent
			container={container}
			app={this.app}
			task={this.task}
			dayPlannerPlugin={dayPlannerPlugin}
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
