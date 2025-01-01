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
import { t } from "src/utils/lang/helper";
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
	filePath: "",
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
	const [bodyContent, setBodyContent] = useState(task.body?.join('\n') || '');

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
		const updatedBodyContent = bodyContent.split('\n');
		updatedBodyContent[index] = updatedBodyContent[index].startsWith('- [x]')
			? updatedBodyContent[index].replace('- [x]', '- [ ]')
			: updatedBodyContent[index].replace('- [ ]', '- [x]');
		setBodyContent(updatedBodyContent.join('\n'));
	};

	// Function to remove a subtask
	const removeSubTask = (index: number) => {
		const updatedSubTasks = bodyContent.split('\n').filter((_, idx) => idx !== index);
		setBodyContent(updatedSubTasks.join('\n'));
	};

	// Function to add a new subtask (blank input)
	const addNewSubTask = () => {
		const updatedBodyContent = bodyContent.split('\n');
		setBodyContent([`\t- [ ] `, ...updatedBodyContent].join('\n'));
	};

	const updateSubTaskContent = (index: number, value: string) => {
		const updatedBodyContent = bodyContent.split('\n');
		updatedBodyContent[index] = `\t- [ ] ${value}`; // Change task state to incomplete upon editing
		setBodyContent(updatedBodyContent.join('\n'));
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
		let newDue = due;
		if (plugin.settings.data.globalSettings.autoAddDue) {
			newDue = new Date().toISOString().split('T')[0];
		}
		const updatedTask = {
			...task,
			title,
			body: [
				...bodyContent.split('\n'),
			],
			due: newDue,
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
		componentRef.current = plugin.view;
	}, []);

	const previewContainerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const formatedContent = taskElementsFormatter(plugin, modifiedTask);
		if (previewContainerRef.current && formatedContent !== "") {
			// Clear previous content before rendering new markdown
			previewContainerRef.current.empty();

			MarkdownUIRenderer.renderTaskDisc(
				app,
				formatedContent,
				previewContainerRef.current,
				filePath,
				componentRef.current
			);

			hookMarkdownLinkMouseEventHandlers(app, plugin, previewContainerRef.current, filePath, filePath);
		}
	}, [modifiedTask]); // Re-render when modifiedTask changes


	const [isCtrlPressed, setIsCtrlPressed] = useState(false);  // Track CTRL/CMD press
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
	};

	return (
		<>
			<div className="EditTaskModalHome">
				<div className="EditTaskModalHomeTitle">
					{taskExists ? t("edit-task") : t("add-new-task")}
				</div>
				<div className="EditTaskModalHomeBody">
					<div className="EditTaskModalHomeLeftSec">
						<div className="EditTaskModalHomeLeftSecScrollable">
							<label className="EditTaskModalHomeFieldTitle">{t("task-title")}</label>
							<input type="text" className="EditTaskModalHomeFieldTitleInput" value={title} onChange={(e) => setTitle(e.target.value)} />

							{/* Subtasks */}
							<label className="EditTaskModalHomeFieldTitle">{t("sub-tasks")}</label>
							<div className="EditTaskModalsubTasksContainer">
								{bodyContent.split('\n').map((bodyLine: string, bodyLineIndex: number) => {
									// Filter only the lines that start with the task patterns
									if (bodyLine.startsWith('\t- [ ]') || bodyLine.startsWith('\t- [x]')) {
										return (
											<div key={bodyLineIndex} className="EditTaskModalsubTaskItem">
												<input
													type="checkbox"
													checked={bodyLine.trim().startsWith('- [x]')}
													onChange={() => toggleSubTaskCompletion(bodyLineIndex)}
												/>
												<input
													className="EditTaskModalsubTaskItemInput"
													type="text"
													value={bodyLine.replace(/\t- \[(.)\] /, '')}
													onChange={(e) => updateSubTaskContent(bodyLineIndex, e.target.value)}
												/>
												<FaTrash
													size={15}
													enableBackground={0}
													opacity={0.7}
													style={{ marginInlineStart: '0.8em' }}
													title={"delete-sub-task"}
													onClick={() => removeSubTask(bodyLineIndex)}
													cursor={'pointer'}
												/>
											</div>
										);
									}
									// Return null if the line doesn't match the subtask pattern
									return null;
								})}
								<button className="EditTaskModalsubTaskAddButton" onClick={addNewSubTask}>{t("add-sub-task")}</button>
							</div>

							<div className="EditTaskModalTabHeader">
								<div onClick={() => handleTabSwitch('preview')} className={`EditTaskModalTabHeaderBtn${activeTab === 'preview' ? '-active' : ''}`}>{t("preview")}</div>
								<div onClick={() => handleTabSwitch('editor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'editor' ? '-active' : ''}`}>{t("editor")}</div>
							</div>

							{/* Conditional rendering based on active tab */}
							<div className={`EditTaskModalTabContent ${activeTab === 'preview' ? 'show' : 'hide'}`}>
								{/* Preview Section */}
								<div className="EditTaskModalHomePreview" style={{ display: activeTab === 'preview' ? 'block' : 'none' }}>
									<div className="EditTaskModalHomePreviewContainer">
										<div className="EditTaskModalHomePreviewHeader">
											<div className="EditTaskModalHomePreviewHeaderFilenameLabel">{t("file-path")} : <div className="EditTaskModalHomePreviewHeaderFilenameValue">{filePath}</div></div>
											<button className="EditTaskModalHomeOpenFileBtn"
												id="EditTaskModalHomeOpenFileBtn"
												aria-label={t("hold-ctrl-button-to-open-in-new-window")}
												onClick={() => isCtrlPressed ? app.workspace.openLinkText('', filePath, 'window') : app.workspace.openLinkText('', filePath, false)}
											>{t("open-file")}</button>
										</div>
										<div className="EditTaskModalHomePreviewBody" ref={previewContainerRef}>
											{/* The markdown content will be rendered here */}
										</div>
									</div>
								</div>
							</div>
							<div className={`EditTaskModalTabContent ${activeTab === 'editor' ? 'show' : 'hide'}`}>
								<div className="EditTaskModalHomePreviewHeader">{t("task-description-texarea-placeholder")}</div>
								{/* Editor Section */}
								<textarea
									className="EditTaskModalBodyDescription"
									value={bodyContent}
									onChange={handleTextareaChange}
									placeholder={t("body-content")}
									style={{ display: activeTab === 'editor' ? 'block' : 'none', width: '100%' }}
								/>
							</div>
						</div>

						<button className="EditTaskModalHomeSaveBtn" onClick={handleSave}>{t("save")}</button>
					</div>
					<div className="EditTaskModalHomeRightSec">
						{/* Task Time Input */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("start-time")}</label>
							<input className="EditTaskModalHomeTimeInput" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
						</div>
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("end-time")}</label>
							<input className="EditTaskModalHomeTimeInput" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
						</div>

						{/* Task Due Date */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("due-date")}</label>
							<input className="EditTaskModalHomeDueInput" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
						</div>

						{/* Task Priority */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("priority")}</label>
							<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
								{priorityOptions.map((option) => (
									<option key={option.value} value={option.value}>{option.text}</option>
								))}
							</select>
						</div>

						{/* Task Tag */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("tag")}</label>
							<input
								className="EditTaskModalHome-tagValue"
								type="text"
								placeholder={t("hit-enter-after-typing-tag")}
								onKeyDown={handleTagInput}  // Call handleTagInput on change
							/>
							{/* Render tags with cross icon */}
							<div className="EditTaskModalHome-taskItemTags">
								{tags.map((tag: string) => {
									const customTagColor = plugin.settings.data.globalSettings.tagColors[tag.replace('#', '')];
									const tagColor = customTagColor || defaultTagColor;
									const backgroundColor = customTagColor ? hexToRgba(customTagColor, 0.1) : `var(--tag-background)`;
									const borderColor = customTagColor ? hexToRgba(tagColor, 0.5) : `var(--tag-color-hover)`;
									return (
										<div
											key={tag}
											className="EditTaskModalHome-taskItemTagsPreview"
											style={{
												color: tagColor,
												border: `1px solid ${borderColor}`,
												backgroundColor: backgroundColor,
											}}
										>
											{tag}
											<FaTimes
												style={{ marginLeft: '8px', cursor: 'pointer', verticalAlign: 'text-bottom' }}
												onClick={() => removeTag(tag)}
											/>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div >
		</>
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

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

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
