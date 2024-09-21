// /src/modal/EditTaskModal.tsx

import { App, Modal } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import { priorityEmojis, priorityOptions } from "src/interfaces/TaskItem";

import ReactDOM from "react-dom/client";
import { loadGlobalSettings } from "src/utils/SettingsOperations";

// Functional React component for the modal content
const EditTaskContent: React.FC<{ app: App, task: any, dayPlannerPlugin: boolean; onSave: (updatedTask: any) => void; onClose: () => void }> = ({ task, onSave, onClose, dayPlannerPlugin }) => {
	const [body, setBody] = useState(task.body);
	const [due, setDue] = useState(task.due);
	const [tag, setTag] = useState(task.tag); // Prepend # to tag
	const [startTime, setStartTime] = useState(task.time ? task.time.split(' - ')[0] : '');
	const [endTime, setEndTime] = useState(task.time ? task.time.split(' - ')[1] || '' : '');
	const [newTime, setNewTime] = useState(task.time);
	const [priority, setPriority] = useState(task.priority);
	const fileContentRef = useRef<HTMLDivElement>(null);

	// Automatically update end time if only start time is provided
	useEffect(() => {
		if (startTime && !endTime) {
			const [hours, minutes] = startTime.split(':');
			const newEndTime = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`;
			setEndTime(newEndTime);
			const newTime = `${startTime} - ${endTime}`;
			console.log("EditTaskModa : New time freshly added : ", newTime);
			setNewTime(newTime);
		}
	}, [startTime, endTime]);

	// Function to handle saving the updated task
	const handleSave = () => {
		const updatedTask = {
			...task,
			body,
			due,
			tag,
			time: newTime,
			priority,
		};
		onSave(updatedTask);
		onClose();
	};

	// Function to scroll to task's position in the file
	// useEffect(() => {
	// 	if (fileContentRef.current) {
	// 		const taskElement = fileContentRef.current.querySelector(`[data-task-id="${task.id}"]`);
	// 		if (taskElement) {
	// 			taskElement.scrollIntoView({ behavior: "smooth", block: "center" });
	// 		}
	// 	}
	// }, [fileContentRef]);

	// Unnecessary below memory and CPU wastage, just for the Live Preview thing, you can remove this and create the actual display of the file content, or else, you can keep this as it also, no issues : 
	let newTaskContent = ''
	if (dayPlannerPlugin) {
		newTaskContent = `- [ ] ${startTime ? `${startTime} - ${endTime} ` : ''}${body} |${due ? ` 📅${due}` : ''} ${priority > 0 ? priorityEmojis[priority] : ''} ${tag} `;
	} else {
		newTaskContent = `- [] ${body} |${startTime ? ` ⏰[${startTime} - ${endTime}]` : ''}${due ? ` 📅${due}` : ''} ${priority > 0 ? priorityEmojis[priority] : ''} ${tag} `;
	}

	return (
		<div className="EditTaskModalHome">
			<div className="EditTaskModalHome-title">Edit Task</div>
			<textarea className="EditTaskModalHome-taskBody" value={body} onChange={(e) => setBody(e.target.value)} />

			{/* Task Time Input */}
			<div className="EditTaskModalHomeField">
				<label className="EditTaskModalHomeFieldTitle">Task Start Time:</label>
				<input className="EditTaskModalHomeTimeInput" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
			</div>
			<div className="EditTaskModalHomeField">
				<label className="EditTaskModalHomeFieldTitle">Task End Time:</label>
				<input className="EditTaskModalHomeTimeInput" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
			</div>

			{/* Task Due Date */}
			<div className="EditTaskModalHomeField">
				<label className="EditTaskModalHomeFieldTitle">Task Due Date:</label>
				<input className="EditTaskModalHomeDueInput" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
			</div>

			{/* Task Priority */}
			<div className="EditTaskModalHomeField">
				<label className="EditTaskModalHomeFieldTitle">Task Priority:</label>
				<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => setPriority(e.target.value)}>
					{priorityOptions.map((option) => (
						<option key={option.value} value={option.value}>{option.text}</option>
					))}
				</select>
			</div>

			{/* Task Tag */}
			<div className="EditTaskModalHomeField">
				<label className="EditTaskModalHomeFieldTitle">Task Tag:</label>
				{/* <input className="EditTaskModalHome-tagValue" type="text" value={tag} onChange={(e) => setTag(`#${ e.target.value.replace('#', '').trim() }`)} /> */}
				<input className="EditTaskModalHome-tagValue" type="text" value={tag} onChange={(e) => setTag(e.target.value)} />
			</div>

			{/* Live File Preview */}
			<div className="EditTaskModalHomePreview">
				<h3 style={{ margin: 0 }}>File Preview</h3>
				<div className="fileContentContainer" ref={fileContentRef}>
					<h6>File Modified : {task.filePath}</h6>
					<div className="fileContent">
						{newTaskContent}
						{/* Insert code to read and display the file's content here */}
						{/* Example: Display file content with scrollTo logic */}

					</div>
					<button className="EditTaskModalHomeOpenFileBtn" onClick={() => app.workspace.openLinkText(task.filePath, "")}>Open File</button>
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
			app={this.app}
			task={this.task}
			dayPlannerPlugin={dayPlannerPlugin}
			onSave={this.onSave}
			onClose={() => this.close()}
		/>)
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
