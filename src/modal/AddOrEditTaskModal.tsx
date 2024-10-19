// /src/modal/AddOrEditTaskModal.tsx

import { App, Component, HoverParent, HoverPopover, MarkdownPreviewView, MarkdownRenderer, Modal, TFile } from "obsidian";
import { FaTimes, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import ReactDOM, { Root } from "react-dom/client";
import { extractBody, extractCompletionDate, extractDueDate, extractPriority, extractTags, extractTime, extractTitle } from "src/utils/ScanningVault";
import { priorityOptions, taskItem } from "src/interfaces/TaskItemProps";

import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import TaskBoard from "main";
import { hookMarkdownLinkMouseEventHandlers } from "src/services/MarkdownHoverPreview";
import { taskElementsFormatter } from "src/utils/TaskItemUtils";

const taskItemEmpty = {
	id: 0,
	title: "",
	body: [],
	due: "",
	tags: [],
	time: "",
	priority: 0,
	completed: "",
	filePath: "", // Include filePath since it's in the tasks
};

// Functional React component for the modal content
const EditTaskContent: React.FC<{
	app: App,
	plugin: TaskBoard,
	root: HTMLElement,
	task?: taskItem,
	taskExists?: boolean,
	filePath: string;
	onSave: (updatedTask: taskItem) => void;
	onClose: () => void;
}> = ({ app, plugin, root, task = taskItemEmpty, taskExists, filePath, onSave, onClose }) => {
	const [title, setTitle] = useState(task.title || '');
	const [due, setDue] = useState(task.due || '');
	const [tags, setTags] = useState<string[]>(task.tags || []);
	const [startTime, setStartTime] = useState(task.time?.split(' - ')[0] || '');
	const [endTime, setEndTime] = useState(task.time?.split(' - ')[1] || '');
	const [newTime, setNewTime] = useState(task.time || '');
	const [priority, setPriority] = useState(task.priority || 0);
	const [bodyContent, setBodyContent] = useState(task.body?.filter(line => !line.trim().startsWith('- [ ]')).join('\n') || '');
	const [subTasks, setSubTasks] = useState(
		task.body?.filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) || []
	);
	const [taskContent, setTaskContent] = useState<string>('');

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


	// Function to handle tag input and split by space or comma
	// const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
	// 	const input = e.target.value;
	// 	const parsedTags = input.split(/[\s,]+/).filter(tag => tag.startsWith("#")); // Split by space or comma, only keep valid tags
	// 	setTags(parsedTags);
	// };

	// Function to toggle subtask completion
	const toggleSubTaskCompletion = (index: number) => {
		const updatedSubTasks = [...subTasks];
		updatedSubTasks[index] = updatedSubTasks[index].startsWith('- [x]')
			? updatedSubTasks[index].replace('- [x]', '- [ ]')
			: updatedSubTasks[index].replace('- [ ]', '- [x]');
		setSubTasks(updatedSubTasks);
	};

	// Function to remove a subtask
	const removeSubTask = (index: number) => {
		const updatedSubTasks = subTasks.filter((_, idx) => idx !== index);
		setSubTasks(updatedSubTasks);
	};

	// Function to add a new subtask (blank input)
	const addNewSubTask = () => {
		setSubTasks([...subTasks, '']);
	};

	// Update subtask content
	const updateSubTaskContent = (index: number, value: string) => {
		const updatedSubTasks = [...subTasks];
		updatedSubTasks[index] = `- [ ] ${value}`;
		setSubTasks(updatedSubTasks);
	};

	// Tags input
	const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const input = e.currentTarget.value.trim();
			if (!tags.includes(input)) {
				setTags(prevTags => [...prevTags, input.startsWith("#") ? input : `#${input}`]);
				e.currentTarget.value = '';
			}
		}
	};

	// Function to remove a tag
	const removeTag = (tagToRemove: string) => {
		setTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
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
			tags,
			time: newTime,
			priority,
			filePath: filePath,
		};
		onSave(updatedTask);
		onClose();
	};


	const modifiedTask: taskItem = {
		...task,
		title: title,
		body: [
			...bodyContent.split('\n'),
			...subTasks,
		],
		due: due,
		tags: tags,
		time: newTime,
		priority: priority,
		filePath: filePath,
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
		// setUpdatedTask(modifiedTask);
		const formatedContent = taskElementsFormatter(plugin, modifiedTask);
		setTaskContent(formatedContent);
		// console.log("Content received from the formatter function :\n", formatedContent);
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
	}, [modifiedTask]); // Re-render when modifiedTask changes


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

	// Tab Switching
	const [activeTab, setActiveTab] = useState<'preview' | 'editor'>('preview');
	const handleTabSwitch = (tab: 'preview' | 'editor') => setActiveTab(tab);

	// Helper function to convert a hex color to an RGBA string with the specified opacity
	const hexToRgba = (hex: string, opacity: number): string => {
		let r = 0, g = 0, b = 0;

		if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		} else if (hex.length === 7 || hex.length === 9) {
			r = parseInt(hex[1] + hex[2], 16);
			g = parseInt(hex[3] + hex[4], 16);
			b = parseInt(hex[5] + hex[6], 16);
		}

		return `rgba(${r},${g},${b},${opacity})`;
	};
	const defaultTagColor = 'var(--tag-color)';

	// Function to parse the textarea content back to task properties
	const parseTaskContent = (content: string) => {
		// Simulate extracting task properties like due, priority, etc.
		const updatedTask = {
			...task,
			title: extractTitle(content),
			body: extractBody(content.split("\n"), 1),
			due: extractDueDate(content),
			tags: extractTags(content),
			time: extractTime(content),
			priority: extractPriority(content),
			completed: extractCompletionDate(content),
			filePath: task.filePath,
		};
		return updatedTask;
	};

	// Function to handle textarea changes
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setBodyContent(e.target.value);
		// const updatedContent = e.target.value;
		// setTaskContent(updatedContent);
		// const extractedTaskFromTextBox = parseTaskContent(updatedContent);
		// setUpdatedTask(extractedTaskFromTextBox);
	};

	return (
		<div className="EditTaskModalHome">
			<div className="EditTaskModalHomeTitle">
				{taskExists ? 'Edit Task' : 'Add New Task'}
			</div>
			<div className="EditTaskModalHomeBody">
				<div className="EditTaskModalHomeLeftSec">
					<label className="EditTaskModalHomeFieldTitle">Task Title</label>
					<input type="text" className="EditTaskModalHomeFieldTitleInput" value={title} onChange={(e) => setTitle(e.target.value)} />

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
									value={subTask.trim().replace(/- \[.\] /, '')}
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

					<div className="EditTaskModalTabHeader">
						<div onClick={() => handleTabSwitch('preview')} className={`EditTaskModalTabHeaderBtn${activeTab === 'preview' ? '-active' : ''}`}>Preview</div>
						<div onClick={() => handleTabSwitch('editor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'editor' ? '-active' : ''}`}>Editor</div>
					</div>

					{/* Conditional rendering based on active tab */}
					<div className={`EditTaskModalTabContent ${activeTab === 'preview' ? 'show' : 'hide'}`}>
						{/* Preview Section */}
						<div className="EditTaskModalHomePreview" style={{ display: activeTab === 'preview' ? 'block' : 'none' }}>
							<div className="EditTaskModalHomePreviewContainer">
								<div className="EditTaskModalHomePreviewHeader">
									<div style={{ fontWeight: '400' }}>{filePath}</div>
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
					<div className={`EditTaskModalTabContent ${activeTab === 'editor' ? 'show' : 'hide'}`}>
						<div className="EditTaskModalHomePreviewHeader">Directly Edit any value or add more sub tasks and description for this task.</div>
						{/* Editor Section */}
						<textarea
							className="EditTaskModalBodyDescription"
							value={bodyContent}
							onChange={handleTextareaChange}
							placeholder="Body content"
							style={{ display: activeTab === 'editor' ? 'block' : 'none', width: '100%' }}
						/>
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
						<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
							{priorityOptions.map((option) => (
								<option key={option.value} value={option.value}>{option.text}</option>
							))}
						</select>
					</div>

					{/* Task Tag */}
					<div className="EditTaskModalHomeField">
						<label className="EditTaskModalHomeFieldTitle">Task Tag</label>
						<input
							className="EditTaskModalHome-tagValue"
							type="text"
							onKeyDown={handleTagInput}  // Call handleTagInput on change
						/>
						{/* Render tags with cross icon */}
						<div className="EditTaskModalHome-taskItemTags">
							{tags.map((tag: string) => {
								const customTagColor = plugin.settings.data.globalSettings.tagColors[tag.replace('#', '')];
								const tagColor = customTagColor || defaultTagColor;
								const backgroundColor = customTagColor ? hexToRgba(customTagColor, 0.1) : `var(--tag-background)`;
								return (
									<div
										key={tag}
										className="EditTaskModalHome-taskItemTagsPreview"
										style={{
											color: tagColor,
											border: `1px solid ${tagColor}`,
											backgroundColor: backgroundColor,
											borderRadius: '1em',
											padding: '2px 8px',
											marginRight: '2px',
											display: 'inline-block',
											whiteSpace: 'nowrap',
											fontSize: 'small'
										}}
									>
										{tag}
										<FaTimes
											style={{ marginLeft: '8px', cursor: 'pointer' }}
											onClick={() => removeTag(tag)}
										/>
									</div>
								);
							})}
						</div>
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
	task: taskItem = taskItemEmpty;
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
