// /src/modal/AddOrEditTaskModal.tsx

import { App, Component, Modal, debounce } from "obsidian";
import { FaTimes, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import { checkboxStateSwitcher, extractCheckboxSymbol, isTaskLine } from "src/utils/CheckBoxUtils";
import { priorityOptions, taskItem, taskStatuses } from "src/interfaces/TaskItemProps";

import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import ReactDOM from "react-dom/client";
import TaskBoard from "main";
import { updateRGBAOpacity } from "src/utils/UIHelpers";
import { hookMarkdownLinkMouseEventHandlers } from "src/services/MarkdownHoverPreview";
import { t } from "src/utils/lang/helper";
import { taskContentFormatter } from "src/utils/TaskContentFormatter";
import { EmbeddableMarkdownEditor, createEmbeddableMarkdownEditor } from "src/services/markdownEditor";
import { buildTaskFromRawContent } from "src/utils/ScanningVault";
import { RefreshCcw } from "lucide-react";

const taskItemEmpty = {
	id: 0,
	title: "",
	body: [],
	due: "",
	tags: [],
	time: "",
	priority: 0,
	completion: "",
	filePath: "",
	status: taskStatuses.unchecked,
};

export interface filterOptions {
	value: string;
	text: string;
}

// function setupMarkdownEditor(app: App, container: HTMLElement, targetFileEl?: HTMLElement) {
// 	// Create the markdown editor with our EmbeddableMarkdownEditor
// 	setTimeout(() => {
// 		this.markdownEditor = createEmbeddableMarkdownEditor(
// 			app,
// 			container,
// 			{
// 				placeholder: "Temp",

// 				onEnter: (editor, mod, shift) => {
// 					if (mod) {
// 						// Submit on Cmd/Ctrl+Enter
// 						this.handleSubmit();
// 						return true;
// 					}
// 					// Allow normal Enter key behavior
// 					return false;
// 				},

// 				onEscape: (editor) => {
// 					// Close the modal on Escape
// 					this.close();
// 				},

// 				onSubmit: (editor) => {
// 					this.handleSubmit();
// 				},

// 				onChange: (update) => {
// 					// Handle changes if needed
// 					this.capturedContent = this.markdownEditor?.value || "";

// 					if (this.updatePreview) {
// 						this.updatePreview();
// 					}
// 				},
// 			}
// 		);

// 		this.markdownEditor?.scope.register(
// 			["Alt"],
// 			"c",
// 			(e: KeyboardEvent) => {
// 				e.preventDefault();
// 				if (!this.markdownEditor) return false;
// 				if (this.markdownEditor.value.trim() === "") {
// 					this.close();
// 					return true;
// 				} else {
// 					this.handleSubmit();
// 				}
// 				return true;
// 			}
// 		);

// 		if (targetFileEl) {
// 			this.markdownEditor?.scope.register(
// 				["Alt"],
// 				"x",
// 				(e: KeyboardEvent) => {
// 					e.preventDefault();
// 					targetFileEl.focus();
// 					return true;
// 				}
// 			);
// 		}

// 		// Focus the editor when it's created
// 		this.markdownEditor?.editor?.focus();
// 	}, 50);
// }

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
	setIsEdited: (value: boolean) => void;
}> = ({ app, plugin, root, task = taskItemEmpty, taskExists, filePath, onSave, onClose, setIsEdited }) => {
	const [title, setTitle] = useState(task.title || ' ');
	const [due, setDue] = useState(task.due || '');
	const [tags, setTags] = useState<string[]>(task.tags || []);
	const [startTime, setStartTime] = useState(task?.time?.split('-')[0]?.trim() || '');
	const [endTime, setEndTime] = useState(task?.time?.split('-')[1]?.trim() || '');
	const [newTime, setNewTime] = useState(task.time || '');
	const [priority, setPriority] = useState(task.priority || 0);
	const [status, setStatus] = useState(task.status || '');
	const [reminder, setReminder] = useState(task.title.contains("(@") || false);
	const [bodyContent, setBodyContent] = useState(task.body?.join('\n') || '');
	const [formattedTaskContent, setFormattedTaskContent] = useState<string>('');

	const [isRightSecVisible, setIsRightSecVisible] = useState(false);
	const [markdownEditor, setMarkdownEditor] = useState<EmbeddableMarkdownEditor | null>(null);
	const [updateEditorContent, setUpdateEditorContent] = useState<Boolean>(false);

	const rightSecRef = useRef<HTMLDivElement>(null);
	const toggleRightSec = () => setIsRightSecVisible(!isRightSecVisible);

	const handleClickOutside = (event: MouseEvent) => {
		if (rightSecRef.current && !rightSecRef.current.contains(event.target as Node)) {
			setIsRightSecVisible(false);
		}
	};

	useEffect(() => {
		if (isRightSecVisible) {
			document.addEventListener("mousedown", handleClickOutside);
		} else {
			document.removeEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isRightSecVisible]);

	// Load statuses dynamically
	let filteredStatusesDropdown: filterOptions[] = [];

	// Check if tasksPluginCustomStatuses is available and use it
	if (plugin.settings.data.globalSettings.tasksPluginCustomStatuses?.length > 0) {
		filteredStatusesDropdown = plugin.settings.data.globalSettings.tasksPluginCustomStatuses.map((customStatus) => ({
			value: customStatus.symbol,
			text: `${customStatus.name} [${customStatus.symbol}]`,
		}));
	}
	// Fallback to customStatuses if tasksPluginCustomStatuses is empty
	else if (plugin.settings.data.globalSettings.customStatuses?.length > 0) {
		filteredStatusesDropdown = plugin.settings.data.globalSettings.customStatuses.map((customStatus) => ({
			value: customStatus.symbol,
			text: `${customStatus.name} [${customStatus.symbol}]`,
		}));
	}

	// Automatically update end time if only start time is provided
	useEffect(() => {
		if (startTime && !endTime) {
			const [hours, minutes] = startTime.split(':');
			const newEndTime = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`;
			setEndTime(newEndTime);
			const newTime = `${startTime} - ${newEndTime}`;
			setNewTime(newTime);
		} else if (startTime && endTime) {
			const newTime = `${startTime} - ${endTime}`;
			setNewTime(newTime);
		}
	}, [startTime, endTime]);

	const handleTaskTitleChange = (value: string) => {
		setTitle(value);
		setIsEdited(true);
	}

	// // Function to toggle subtask completion
	// const toggleSubTaskCompletion = (index: number) => {
	// 	const updatedBodyContent = bodyContent.split('\n');
	// 	updatedBodyContent[index] = updatedBodyContent[index].startsWith('- [x]')
	// 		? updatedBodyContent[index].replace('- [x]', '- [ ]')
	// 		: updatedBodyContent[index].replace('- [ ]', '- [x]');
	// 	setBodyContent(updatedBodyContent.join('\n'));
	// 	setIsEdited(true);
	// };

	const handleStatusChange = (symbol: string) => {
		setStatus(symbol);
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleDueDateChange = (value: string) => {
		setDue(value);
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleReminderChange = (value: boolean) => {
		setReminder(value);
		if (value) {
			setTitle(`${title} (@${due} ${startTime})`);
		} else {
			const reminderRegex = /(\(@\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?\))/;
			setTitle(title.replace(reminderRegex, ""));
		}
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handlePriorityChange = (value: number) => {
		setPriority(value);
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleStartTimeChange = (startTime: string) => {
		setStartTime(startTime);
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleEndTimeChange = (endTime: string) => {
		setEndTime(endTime);
		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	// Function to toggle subtask completion
	const toggleSubTaskCompletion = (index: number) => {
		const updatedBodyContent = bodyContent.split('\n');

		// Check if the line is a task and toggle its state
		if (isTaskLine(updatedBodyContent[index].trim())) {
			const symbol = extractCheckboxSymbol(updatedBodyContent[index]);
			const nextSymbol = checkboxStateSwitcher(plugin, symbol);

			updatedBodyContent[index] = updatedBodyContent[index].replace(`- [${symbol}]`, `- [${nextSymbol}]`);

		}

		setBodyContent(updatedBodyContent.join('\n'));
		setIsEdited(true);
	};


	// Function to remove a subtask	
	const removeSubTask = (index: number) => {
		const updatedSubTasks = bodyContent.split('\n').filter((_, idx) => idx !== index);
		setBodyContent(updatedSubTasks.join('\n'));
		setIsEdited(true);
	};

	// Function to add a new subtask (blank input)
	const addNewSubTask = () => {
		const updatedBodyContent = bodyContent.split('\n');
		setBodyContent([...updatedBodyContent, `\t- [ ] `].join('\n'));
		setIsEdited(true);
	};

	const updateSubTaskContent = (index: number, value: string) => {
		const updatedBodyContent = bodyContent.split('\n');
		updatedBodyContent[index] = `\t- [ ] ${value}`; // Change task state to incomplete upon editing
		setBodyContent(updatedBodyContent.join('\n'));
		setIsEdited(true);
	};

	// Function to handle textarea changes
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		// setBodyContent(e.target.value);
		handleTaskEditedThroughEditors(e.target.value);
		// setIsEdited(true);
	};

	// Tags input
	const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const input = e.currentTarget.value.trim();
			if (!tags.includes(input)) {
				setTags(prevTags => [...prevTags, input.startsWith("#") ? input : `#${input}`]);
				e.currentTarget.value = '';
				setIsEdited(true);
				setUpdateEditorContent(true);
			}
		}
	};

	// Function to remove a tag
	const removeTag = (tagToRemove: string) => {
		setTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
		setIsEdited(true);
		setUpdateEditorContent(true);
	};

	const onOpenFilBtnClicked = (newWindow: boolean) => {
		if (newWindow) {
			app.workspace.openLinkText('', filePath, 'window')
		} else {
			app.workspace.openLinkText('', filePath, false)
		}
		onClose();
	}

	// Function to handle saving the updated task
	const handleSave = () => {
		let newDue = due;
		if (plugin.settings.data.globalSettings.autoAddDue && !taskExists && due === "") {
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
			status,
		};
		onSave(updatedTask);
		// onClose();
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
		status,
	};
	// Reference to the HTML element where markdown will be rendered

	// const componentRef = useRef<Component | null>(null);
	// useEffect(() => {
	// 	// Initialize Obsidian Component on mount
	// 	componentRef.current = plugin.view;
	// }, []);

	// const previewContainerRef = useRef<HTMLDivElement>(null);
	// useEffect(() => {
	// 	const formatedContent = taskContentFormatter(plugin, modifiedTask);
	// 	setFormattedTaskContent(formatedContent);
	// 	if (previewContainerRef.current && formatedContent !== "") {
	// 		// Clear previous content before rendering new markdown
	// 		previewContainerRef.current.empty();

	// 		MarkdownUIRenderer.renderTaskDisc(
	// 			app,
	// 			formatedContent,
	// 			previewContainerRef.current,
	// 			filePath,
	// 			componentRef.current
	// 		);

	// 		hookMarkdownLinkMouseEventHandlers(app, plugin, previewContainerRef.current, filePath, filePath);
	// 	}
	// }, [modifiedTask]); // Re-render when modifiedTask changes


	const handleTaskEditedThroughEditors = debounce((value: string) => {
		const updatedTask = buildTaskFromRawContent(value);
		setTitle(updatedTask.title || '');
		setBodyContent(updatedTask.body?.join('\n') || '');
		setDue(updatedTask.due || '');
		setTags(updatedTask.tags || []);
		setStartTime(updatedTask.time?.split('-')[0].trim() || '');
		setEndTime(updatedTask.time?.split('-')[1].trim() || '');
		setPriority(updatedTask.priority || 0);
		setStatus(updatedTask.status || '');
		setIsEdited(true);
	}, 50);


	// // This useEffect is used to get the formatted content of the updated task, which will be rendered in the editor(s).
	// useEffect(() => {
	// 	const formatedContent = taskContentFormatter(plugin, modifiedTask);
	// 	console.log("formattedTaskContent : ", formatedContent);
	// 	setFormattedTaskContent(formatedContent);
	// }, [modifiedTask]); // Re-render when modifiedTask changes

	// I think this useEffect should be called only once and not again and again, it initializes the editor.
	const markdownEditorEmbeddedContainer = useRef<HTMLElement>(null);
	useEffect(() => {
		if (markdownEditorEmbeddedContainer.current) {
			if (markdownEditor) {
				markdownEditor.destroy();
			}
			setTimeout(() => {
				if (markdownEditorEmbeddedContainer.current) {
					markdownEditorEmbeddedContainer.current.empty();

					const formattedTaskContent = taskContentFormatter(plugin, modifiedTask);
					setFormattedTaskContent(formattedTaskContent);
					console.log("formattedTaskContent : ", formattedTaskContent);

					const fullMarkdownEditor = createEmbeddableMarkdownEditor(
						app,
						markdownEditorEmbeddedContainer.current,
						{
							placeholder: "Start entering your task in the various input fields or directly in this editor.",
							value: formattedTaskContent,
							cls: "addOrEditTaskModal-markdown-editor-embed",
							cursorLocation: {
								anchor: formattedTaskContent.split("\n")[0].length,
								head: formattedTaskContent.split("\n")[0].length,
							},

							onEnter: (editor, mod, shift) => {
								if (mod) {
									// Submit on Cmd/Ctrl+Enter
									// this.handleSubmit();
									handleSave();
									// return true;
								}
								// Allow normal Enter key behavior
								return false;
							},

							onEscape: (editor) => {
								// Close the modal on Escape
								// this.close();
								onClose();
							},

							onSubmit: (editor) => {
								// this.handleSubmit();
								handleSave();
							},

							onChange: (update) => {
								// Handle changes if needed
								const capturedContent = fullMarkdownEditor?.value || "";
								handleTaskEditedThroughEditors(capturedContent);
								// console.log("Captured content:", fullMarkdownEditor?.value);
								// setFormattedTaskContent(capturedContent);

								// if (this.updatePreview) {
								// 	this.updatePreview();
								// }
							},
						}
					)
					setMarkdownEditor(fullMarkdownEditor);

					fullMarkdownEditor?.scope.register(
						["Alt"],
						"c",
						(e: KeyboardEvent) => {
							e.preventDefault();
							if (!fullMarkdownEditor) return false;
							if (fullMarkdownEditor.value.trim() === "") {
								// this.close();
								onClose();
								return true;
							} else {
								// this.handleSubmit();
								handleSave();
							}
							return true;
						}
					);

					// if (targetFileEl) {
					// 	markdownEditor?.scope.register(
					// 		["Alt"],
					// 		"x",
					// 		(e: KeyboardEvent) => {
					// 			e.preventDefault();
					// 			targetFileEl.focus();
					// 			return true;
					// 		}
					// 	);
					// }

					// Focus the editor when it's created
					// markdownEditor?.editor?.focus();
					console.log("Markdown editor initialized");
				}
			}, 50);
		}
		setUpdateEditorContent(false);
	}, [updateEditorContent]);

	markdownEditor?.editor?.focus();

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
	const [activeTab, setActiveTab] = useState<'liveEditor' | 'rawEditor'>('liveEditor');
	const handleTabSwitch = (tab: 'liveEditor' | 'rawEditor') => setActiveTab(tab);

	const defaultTagColor = 'var(--tag-color)';

	return (
		<>
			<div className="EditTaskModalHome">
				<div className="EditTaskModalHomeTitle">
					{taskExists ? t("edit-task") : t("add-new-task")}
				</div>
				<div className="EditTaskModalHomeBody">
					<div className="EditTaskModalHomeLeftSec">
						<div className="EditTaskModalHomeLeftSecScrollable">
							<label className="EditTaskModalHomeModalTitle">{title || "Task title"}</label>

							{/* Editor tab switcher */}
							<div className="EditTaskModalTabHeader">
								<div onClick={() => handleTabSwitch('liveEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'liveEditor' ? '-active' : ''}`}>{t("liveEditor")}</div>
								<div onClick={() => handleTabSwitch('rawEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'rawEditor' ? '-active' : ''}`}>{t("rawEditor")}</div>
							</div>
							<div className="EditTaskModalHomePreviewHeader">
								<div className="EditTaskModalHomePreviewHeaderFilenameLabel">{t("file-path")} : <div className="EditTaskModalHomePreviewHeaderFilenameValue">{filePath}</div></div>
								<button className="EditTaskModalHomeLiveEditorRefreshBtn"
									id="EditTaskModalHomeLiveEditorRefreshBtn"
									aria-label="Refresh the live editor"
									onClick={() => setUpdateEditorContent(true)}><RefreshCcw /></button>
								<button className="EditTaskModalHomeOpenFileBtn"
									id="EditTaskModalHomeOpenFileBtn"
									aria-label={t("hold-ctrl-button-to-open-in-new-window")}
									onClick={() => isCtrlPressed ? onOpenFilBtnClicked(true) : onOpenFilBtnClicked(false)}
								>{t("open-file")}</button>
							</div>

							{/* Conditional rendering based on active tab */}
							{/* liveEditor Section */}
							<div className={`EditTaskModalTabContent ${activeTab === 'liveEditor' ? 'show' : 'hide'}`}>
								<div className="EditTaskModalHomePreview" style={{ display: activeTab === 'liveEditor' ? 'block' : 'none' }}>
									<div className="EditTaskModalHomePreviewContainer">
										<span className="EditTaskModalLiveEditor" ref={markdownEditorEmbeddedContainer}></span>
									</div>
								</div>
							</div>

							{/* Raw text rawEditor */}
							<div className={`EditTaskModalTabContent ${activeTab === 'rawEditor' ? 'show' : 'hide'}`}>
								<textarea
									className="EditTaskModalBodyDescription"
									value={formattedTaskContent}
									onChange={handleTextareaChange}
									placeholder={t("body-content")}
									style={{ display: activeTab === 'rawEditor' ? 'block' : 'none', width: '100%' }}
								/>
							</div>

							{/* Child Tasks */}
							<label className="EditTaskModalHomeFieldTitle">{t("child-tasks")}</label>
							<div className="EditTaskModalChildTasksContainer">
								Coming soon...
							</div>
						</div>


						<div className="EditTaskModalHomeFooterBtnSec">
							<button className="EditTaskModalHomeSaveBtn" onClick={handleSave}>{t("save")}</button>
							<button className="EditTaskModalHomeToggleBtn" onClick={toggleRightSec} aria-label="Toggle Details">
								☰
							</button>
						</div>
					</div>
					<div
						ref={rightSecRef}
						className={`EditTaskModalHomeRightSec ${isRightSecVisible ? "visible" : ""}`}
					>
						{/* Task Status */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("task-status")}</label>
							<select className="EditTaskModalHome-taskStatusValue" value={status} onChange={(e) => handleStatusChange(e.target.value)}>
								{filteredStatusesDropdown.map((option) => (
									<option key={`${option.value}-${Math.floor(1000 + Math.random() * 9000)}`} value={option.value}>{option.text}</option>
								))}
							</select>
						</div>

						{/* Task Time Input */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("start-time")}</label>
							<input className="EditTaskModalHomeTimeInput" type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
						</div>
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("end-time")}</label>
							<input className="EditTaskModalHomeTimeInput" type="time" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
						</div>

						{/* Task Due Date */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("due-date")}</label>
							<input className="EditTaskModalHomeDueInput" type="date" value={due} onChange={(e) => handleDueDateChange(e.target.value)} />
						</div>

						{/* Task reminder checkbox */}
						{plugin.settings.data.globalSettings.compatiblePlugins.reminderPlugin && (
							<div className="EditTaskModalHomeField">
								<label className="EditTaskModalHomeFieldTitle">{t("reminder-label")}</label>
								<input className="EditTaskModalHomeReminderInput" type="checkbox" checked={reminder} disabled={due === ""} onChange={(e) => handleReminderChange(e.target.checked)} />
							</div>
						)}

						{/* Task Priority */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("priority")}</label>
							<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => handlePriorityChange(parseInt(e.target.value))}>
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
									const tagName = tag.replace('#', '');
									const customTagData = plugin.settings.data.globalSettings.tagColors.find(t => t.name === tagName);
									const tagColor = customTagData?.color || defaultTagColor;
									const backgroundColor = customTagData ? updateRGBAOpacity(plugin, tagColor, 0.1) : `var(--tag-background)`;
									const borderColor = customTagData ? updateRGBAOpacity(plugin, tagColor, 0.5) : `var(--tag-color-hover)`;
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
	taskExists: boolean;
	isEdited: boolean;
	onSave: (updatedTask: taskItem) => void;

	constructor(app: App, plugin: TaskBoard, onSave: (updatedTask: taskItem) => void, filePath: string, taskExists: boolean, task?: taskItem) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.filePath = filePath;
		this.taskExists = taskExists;
		this.onSave = onSave;
		if (taskExists && task) {
			this.task = task;
		}
		this.isEdited = false;
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
			taskExists={this.taskExists}
			filePath={this.filePath}
			onSave={(updatedTask) => {
				this.isEdited = false;
				this.onSave(updatedTask);
				this.close();
			}}
			onClose={() => this.close()}
			setIsEdited={(value: boolean) => { this.isEdited = value; }}
		/>);
	}

	handleCloseAttempt() {
		// Open confirmation modal
		const mssg = t("edit-task-modal-close-confirm-mssg");
		const closeConfirmModal = new ClosePopupConfrimationModal(this.app, {
			app: this.app,
			mssg,
			onDiscard: () => {
				this.isEdited = false;
				this.close();
			},
			onGoBack: () => {
				// Do nothing
			}
		});
		closeConfirmModal.open();
	}

	handleSave() {
		// Trigger save functionality if required before closing
		this.onSave(this.task);
		this.isEdited = false;
		this.close();
	}

	// onCloseRequested(event: Event) {
	// 	event.stopImmediatePropagation();
	// 	this.handleCloseAttempt();
	// }

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	public close(): void {
		if (this.isEdited) {
			this.handleCloseAttempt();
		} else {
			this.onClose();
			super.close();
		}
	}
}
