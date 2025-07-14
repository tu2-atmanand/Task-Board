// /src/modal/AddOrEditTaskModal.tsx

import { App, Component, Keymap, MarkdownView, Modal, Notice, TFile, UserEvent, debounce, getAllTags } from "obsidian";
import { FaTimes } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import { checkboxStateSwitcher, extractCheckboxSymbol, isTaskLine } from "src/utils/CheckBoxUtils";
import { priorityOptions, taskItem, taskStatuses } from "src/interfaces/TaskItem";

import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import ReactDOM from "react-dom/client";
import TaskBoard from "main";
import { updateRGBAOpacity } from "src/utils/UIHelpers";
import { t } from "src/utils/lang/helper";
import { cleanTaskTitle, cursorLocation, getFormattedTaskContent, sanitizeCreatedDate, sanitizeDueDate, sanitizePriority, sanitizeReminder, sanitizeScheduledDate, sanitizeStartDate, sanitizeTags, sanitizeTime } from "src/utils/TaskContentFormatter";
import { EmbeddableMarkdownEditor, createEmbeddableMarkdownEditor } from "src/services/markdownEditor";
import { buildTaskFromRawContent } from "src/utils/ScanningVault";
import { FileInput, RefreshCcw } from "lucide-react";
import { MultiSuggest, getFileSuggestions, getQuickAddPluginChoices, getTagSuggestions } from "src/services/MultiSuggest";
import { CommunityPlugins } from "src/services/CommunityPlugins";
import { NotificationService, UniversalDateOptions } from "src/interfaces/GlobalSettings";
import { bugReporter } from "src/services/OpenModals";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";

const taskItemEmpty: taskItem = {
	id: 0,
	title: "",
	body: [],
	createdDate: "",
	startDate: "",
	scheduledDate: "",
	due: "",
	tags: [],
	frontmatterTags: [],
	time: "",
	priority: 0,
	reminder: "",
	completion: "",
	cancelledDate: "",
	filePath: "",
	taskLocation: {
		startLine: 0,
		startCharIndex: 0,
		endLine: 0,
		endCharIndex: 0,
	},
	status: taskStatuses.unchecked,
};

export interface filterOptions {
	value: string;
	text: string;
}

// Functional React component for the modal content
const EditTaskContent: React.FC<{
	app: App,
	plugin: TaskBoard,
	root: HTMLElement,
	task?: taskItem,
	taskExists?: boolean,
	activeNote: boolean,
	filePath: string;
	onSave: (updatedTask: taskItem, quickAddPluginChoice: string) => void;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}> = ({ app, plugin, root, task = taskItemEmpty, taskExists, activeNote, filePath, onSave, onClose, setIsEdited }) => {
	const [title, setTitle] = useState(task.title || ' ');
	const [createdDate, setCreatedDate] = useState(task.createdDate || '');
	const [startDate, setStartDate] = useState(task.startDate || '');
	const [scheduledDate, setScheduledDate] = useState(task.scheduledDate || '');
	const [due, setDue] = useState(task.due || '');
	const [tags, setTags] = useState<string[]>(task.tags || []);
	const [startTime, setStartTime] = useState(task.time ? task?.time?.split('-')[0]?.trim() || '' : "");
	const [endTime, setEndTime] = useState(task.time ? task?.time?.split('-')[1]?.trim() || '' : "");
	const [newTime, setNewTime] = useState(task.time || '');
	const [priority, setPriority] = useState(task.priority || 0);
	const [status, setStatus] = useState(task.status || '');
	const [reminder, setReminder] = useState(task?.reminder || "");
	const [bodyContent, setBodyContent] = useState(task.body?.join('\n') || '');
	const [formattedTaskContent, setFormattedTaskContent] = useState<string>('');
	const [newFilePath, setNewFilePath] = useState<string>(filePath);
	const [quickAddPluginChoice, setQuickAddPluginChoice] = useState<string>(plugin.settings.data.globalSettings.quickAddPluginDefaultChoice || '');

	const [isRightSecVisible, setIsRightSecVisible] = useState(false);
	const [markdownEditor, setMarkdownEditor] = useState<EmbeddableMarkdownEditor | null>(null);
	const [updateEditorContent, setUpdateEditorContent] = useState<Boolean>(false);
	const cursorLocationRef = useRef<cursorLocation | null>(null);

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

		const newTitle = sanitizeTime(plugin.settings.data.globalSettings, title, newTime, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);
	}, [startTime, endTime]);

	// const handleTaskTitleChange = (value: string) => {
	// 	setTitle(value);
	// 	setIsEdited(true);
	// }

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

	const handleCreatedDateChange = (value: string) => {
		setCreatedDate(value);
		const newTitle = sanitizeCreatedDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleStartDateChange = (value: string) => {
		setStartDate(value);
		const newTitle = sanitizeStartDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleScheduledDateChange = (value: string) => {
		setScheduledDate(value);
		const newTitle = sanitizeScheduledDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleDueDateChange = (value: string) => {
		setDue(value);
		const newTitle = sanitizeDueDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handleReminderChange = (value: string) => {
		setReminder(value);
		// if (value) {
		// 	setTitle(`${title} (@${due} ${startTime})`);
		// } else {
		// 	const reminderRegex = /(\(@\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?\))/;
		// 	setTitle(title.replace(reminderRegex, ""));
		// }
		const newTitle = sanitizeReminder(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

		setIsEdited(true);
		setUpdateEditorContent(true);
	}

	const handlePriorityChange = (value: number) => {
		setPriority(value);
		const newTitle = sanitizePriority(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
		setTitle(newTitle);

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

	// // Function to toggle subtask completion
	// const toggleSubTaskCompletion = (index: number) => {
	// 	const updatedBodyContent = bodyContent.split('\n');

	// 	// Check if the line is a task and toggle its state
	// 	if (isTaskLine(updatedBodyContent[index].trim())) {
	// 		const symbol = extractCheckboxSymbol(updatedBodyContent[index]);
	// 		const nextSymbol = checkboxStateSwitcher(plugin, symbol);

	// 		updatedBodyContent[index] = updatedBodyContent[index].replace(`- [${symbol}]`, `- [${nextSymbol}]`);

	// 	}

	// 	setBodyContent(updatedBodyContent.join('\n'));
	// 	setIsEdited(true);
	// };


	// // Function to remove a subtask	
	// const removeSubTask = (index: number) => {
	// 	const updatedSubTasks = bodyContent.split('\n').filter((_, idx) => idx !== index);
	// 	setBodyContent(updatedSubTasks.join('\n'));
	// 	setIsEdited(true);
	// };

	// // Function to add a new subtask (blank input)
	// const addNewSubTask = () => {
	// 	const updatedBodyContent = bodyContent.split('\n');
	// 	setBodyContent([...updatedBodyContent, `\t- [ ] `].join('\n'));
	// 	setIsEdited(true);
	// };

	// const updateSubTaskContent = (index: number, value: string) => {
	// 	const updatedBodyContent = bodyContent.split('\n');
	// 	updatedBodyContent[index] = `\t- [ ] ${value}`; // Change task state to incomplete upon editing
	// 	setBodyContent(updatedBodyContent.join('\n'));
	// 	setIsEdited(true);
	// };

	// Function to handle textarea changes
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		// setBodyContent(e.target.value);
		setFormattedTaskContent(e.target.value);
		handleTaskEditedThroughEditors(e.target.value);
	};

	useEffect(() => {
		console.log("Cursor Location in useEffect:", cursorLocationRef.current);
	}, [cursorLocationRef.current]);

	// Tags input
	const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const input = e.currentTarget.value.trim();
			console.log("Cursor Location in handleTagInput:", cursorLocationRef.current);
			const newTitle = sanitizeTags(title, tags, input, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);

			if (!tags.includes(input)) {
				setTags(prevTags => [...prevTags, input.startsWith("#") ? input : `#${input}`]);
				e.currentTarget.value = '';
				setIsEdited(true);
				setUpdateEditorContent(true);
			}
		}
	};
	const tagsInputFieldRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (!tagsInputFieldRef.current) return;

		const suggestionContent = getTagSuggestions(app);
		const onSelectCallback = (choice: string) => {
			handleTagInput({
				key: 'Enter',
				currentTarget: { value: choice },
			} as React.KeyboardEvent<HTMLInputElement>);
			// setNewFilePath(selectedPath);
		};
		new MultiSuggest(tagsInputFieldRef.current, new Set(suggestionContent), onSelectCallback, app);
	}, [app]);
	// Function to remove a tag
	const removeTag = (tagToRemove: string) => {
		setTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
		setIsEdited(true);
		setUpdateEditorContent(true);
	};

	const [isCtrlPressed, setIsCtrlPressed] = useState(false);
	useEffect(() => {
		markdownEditor?.editor?.focus();
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
	const onOpenFilBtnClicked = async (evt: UserEvent, newWindow: boolean) => {
		if (newWindow) {
			// app.workspace.openLinkText('', newFilePath, 'window')
			const leaf = app.workspace.getLeaf('window');
			const file = plugin.app.vault.getAbstractFileByPath(newFilePath);
			if (file && file instanceof TFile) {
				await leaf.openFile(file, { eState: { line: task.taskLocation.startLine - 1 } });
			} else {
				new Notice(t("file-not-found"));
			}
		} else {
			// await app.workspace.openLinkText('', newFilePath, false);
			// const activeEditor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
			// console.log("Note View:", activeEditor);
			// activeEditor?.scrollIntoView({
			// 	from: { line: 5, ch: 0 },
			// 	to: { line: 5, ch: 5 },
			// }, true);

			const leaf = app.workspace.getLeaf(Keymap.isModEvent(evt));
			const file = plugin.app.vault.getAbstractFileByPath(newFilePath);

			if (file && file instanceof TFile) {
				await leaf.openFile(file, { eState: { line: task.taskLocation.startLine - 1 } });
			} else {
				bugReporter(plugin, "File not found", `The file at path ${newFilePath} could not be found.`, "AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked");
			}
		}
		onClose();
	}

	// Function to handle saving the updated task
	const handleSave = () => {
		let newDue = due;
		let newStartDate = startDate;
		let newScheduledDate = scheduledDate;

		if (plugin.settings.data.globalSettings.autoAddUniversalDate && !taskExists) {
			if (plugin.settings.data.globalSettings.universalDate === UniversalDateOptions.dueDate && !due) {
				newDue = new Date().toISOString().split('T')[0];
			} else if (plugin.settings.data.globalSettings.universalDate === UniversalDateOptions.startDate && !startDate) {
				newStartDate = new Date().toISOString().split('T')[0];
			} else if (plugin.settings.data.globalSettings.universalDate === UniversalDateOptions.scheduledDate && !scheduledDate) {
				newScheduledDate = new Date().toISOString().split('T')[0];
			}
		}

		let newCreatedDate = createdDate;
		if (plugin.settings.data.globalSettings.autoAddCreatedDate && !taskExists) {
			newCreatedDate = new Date().toISOString().split('T')[0];
		}
		const updatedTask = {
			...task,
			title,
			body: [
				...bodyContent.split('\n'),
			],
			createdDate: newCreatedDate,
			startDate: newStartDate,
			scheduledDate: newScheduledDate,
			due: newDue,
			tags,
			time: newTime,
			priority,
			filePath: newFilePath,
			taskLocation: task.taskLocation,
			cancelledDate: task.cancelledDate || '',
			status,
			reminder,
		};
		console.log("Updated Task:", updatedTask);
		onSave(updatedTask, quickAddPluginChoice);
		// onClose();
	};

	const modifiedTask: taskItem = {
		...task,
		title: title,
		body: [
			...bodyContent.split('\n'),
		],
		createdDate: createdDate,
		startDate: startDate,
		scheduledDate: scheduledDate,
		due: due,
		completion: task.completion || '',
		cancelledDate: task.cancelledDate || '',
		tags: tags,
		time: newTime,
		priority: priority,
		filePath: newFilePath,
		taskLocation: task.taskLocation,
		status,
		reminder,
	};

	// Reference to the HTML element where markdown will be rendered
	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = plugin.view;
	}, []);

	const titleComponentRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const cleanedTaskTitle = cleanTaskTitle(plugin, modifiedTask);
		// setFormattedTaskContent(cleanedTaskTitle);
		if (titleComponentRef.current && cleanedTaskTitle !== "") {
			// Clear previous content before rendering new markdown
			titleComponentRef.current.empty();

			MarkdownUIRenderer.renderTaskDisc(
				app,
				cleanedTaskTitle,
				titleComponentRef.current,
				filePath,
				componentRef.current
			);
		}
	}, [title]); // Re-render when modifiedTask changes


	const handleTaskEditedThroughEditors = debounce((value: string) => {
		const updatedTask = buildTaskFromRawContent(value);

		setTitle(updatedTask.title || '');
		setBodyContent(updatedTask.body?.join('\n') || '');
		setCreatedDate(updatedTask.createdDate || '');
		setStartDate(updatedTask.startDate || '');
		setScheduledDate(updatedTask.scheduledDate || '');
		setDue(updatedTask.due || '');
		setTags(updatedTask.tags || []);
		setStartTime(updatedTask.time ? updatedTask.time?.split('-')[0].trim() || '' : "");
		setEndTime(updatedTask.time ? updatedTask.time?.split('-')[1]?.trim() || '' : "");
		setNewTime(updatedTask.time ? updatedTask.time : "");
		setPriority(updatedTask.priority || 0);
		setStatus(updatedTask.status || '');
		setReminder(updatedTask.reminder || '');

		setIsEdited(true);
	}, 50);


	// // This useEffect is used to get the formatted content of the updated task, which will be rendered in the editor(s).
	// useEffect(() => {
	// 	const formatedContent = getSanitizedTaskContent(plugin, modifiedTask);
	// 	console.log("formattedTaskContent : ", formatedContent);
	// 	setFormattedTaskContent(formatedContent);
	// }, [modifiedTask]); // Re-render when modifiedTask changes

	const markdownEditorEmbeddedContainer = useRef<HTMLElement>(null);
	useEffect(() => {
		getFormattedTaskContent(modifiedTask).then((formattedTaskContent) => {
			if (markdownEditorEmbeddedContainer.current) {

				// const formattedTaskContent = getSanitizedTaskContent(plugin, modifiedTask);
				// let formattedTaskContent = "";
				// const fetchFormattedTaskContent = async () => {
				// 	const output = getFormattedTaskContent(modifiedTask);
				// 	const resolvedFormattedTaskContent = await output;
				// 	formattedTaskContent = resolvedFormattedTaskContent;
				// 	setFormattedTaskContent(resolvedFormattedTaskContent);
				// };

				// fetchFormattedTaskContent();


				if (!markdownEditor) {
					markdownEditorEmbeddedContainer.current.empty();
					const fullMarkdownEditor = createEmbeddableMarkdownEditor(
						app,
						markdownEditorEmbeddedContainer.current,
						{
							placeholder: "Start typing your task in this editor and use the various input fields to add the properties.",
							value: formattedTaskContent,
							cls: "addOrEditTaskModal-markdown-editor-embed",
							cursorLocation: {
								anchor: formattedTaskContent.split("\n")[0].length,
								head: formattedTaskContent.split("\n")[0].length,
							},

							onEnter: (editor, mod, shift) => {
								// if (mod) {
								// 	// Submit on Cmd/Ctrl+Enter
								// 	handleSave();
								// }
								// // Allow normal Enter key behavior
								return false;
							},

							// onEscape: (editor) => {
							// 	onClose();
							// },

							onSubmit: (editor) => {
								handleSave();
							},

							onChange: (update) => {
								setIsEdited(true);
								const capturedContent = fullMarkdownEditor?.value || "";
								setFormattedTaskContent(capturedContent);
								handleTaskEditedThroughEditors(capturedContent);

								// setCursorLocation({
								// 	lineNumber: 1,
								// 	charIndex: editor?.obsidianEditor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
								// });
								console.log("Editor cursor location updated:",
									"\nCursorLocation : ", fullMarkdownEditor.editor.editor?.getCursor()
								);
							},
							onBlur: (editor) => {
								console.log("onBlue inside Editor:",
									"\nCursorLocation : ", fullMarkdownEditor.editor.editor?.getCursor()
								);
								// setCursorLocation({
								// 	lineNumber: 1,
								// 	charIndex: editor.options.cursorLocation?.head || formattedTaskContent.split("\n")[0].length,
								// });
							}
						}
					)
					setMarkdownEditor(fullMarkdownEditor);
					// const cursorLocation = fullMarkdownEditor.options.cursorLocation;
					// console.log("Cursor Location:", cursorLocation);
					// setCursorLocation({
					// 	lineNumber: fullMarkdownEditor?.editor. || 0,
					// 	charIndex: formattedTaskContent.length,
					// });

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

					// Finding the best approach to trigger onBlur event.
					// fullMarkdownEditor.onBlur = () => {
					// 	console.log("1. onBlur event triggered in the embedded markdown editor.");
					// 	// setUpdateEditorContent(true);
					// 	// setCursorLocation({
					// 	// 	lineNumber: 1,
					// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
					// 	// });
					// }

					// Only this one worked.
					fullMarkdownEditor.activeCM.contentDOM.onblur = () => {
						console.log("2. onBlur event triggered in the embedded markdown editor's content DOM.");
						// setUpdateEditorContent(true);
						const cursor = fullMarkdownEditor.editor.editor?.getCursor();
						console.log("Cursor Location in activeCM.contentDOM.onblur:", cursor);
						cursorLocationRef.current = {
							lineNumber: (cursor ? cursor.line + 1 : 0),
							charIndex: (cursor ? (cursor?.ch - 6 < 0 ? 0 : cursor?.ch - 6) : formattedTaskContent.split("\n")[0].length),
						};
						console.log("Updated cursorLocationRef:", cursorLocationRef.current);
					}

					// fullMarkdownEditor.containerEl.onblur = () => {
					// 	console.log("3. onBlur event triggered in the embedded markdown editor's container.");
					// 	// setUpdateEditorContent(true);
					// 	// setCursorLocation({
					// 	// 	lineNumber: 1,
					// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
					// 	// });
					// }

					// fullMarkdownEditor.editorEl.onblur = () => {
					// 	console.log("4. onBlur event triggered in the embedded markdown editor's editor element.");
					// 	// setUpdateEditorContent(true);
					// 	// setCursorLocation({
					// 	// 	lineNumber: 1,
					// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
					// 	// });
					// }

					// fullMarkdownEditor.editorEl.addEventListener("blur", () => {
					// 	console.log("5. onBlur event triggered in the embedded markdown editor's editor element's event listener.");
					// 	// setUpdateEditorContent(true);
					// 	// setCursorLocation({
					// 	// 	lineNumber: 1,
					// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
					// 	// });
					// });

					// fullMarkdownEditor.editor.editorEl.addEventListener("blur", (event: FocusEvent) => {
					// 	console.log("6. onBlur event triggered in the embedded markdown editor's editor element's editor element.");
					// 	// setUpdateEditorContent(true);
					// 	// setCursorLocation({
					// 	// 	lineNumber: 1,
					// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
					// 	// });
					// 	return true; // Ensure a valid return type
					// });

					// if (targetFileEl) {
					// 	fullMarkdownEditor?.scope.register(
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
					// fullMarkdownEditor?.editor?.focus();
				} else {
					// If the editor already exists, just update its content
					markdownEditor.set(formattedTaskContent, false);

					if (markdownEditor && markdownEditor.editorEl) {
						markdownEditor.editorEl.onblur = () => {
							console.log("onBlur event triggered in the embedded markdown editor.");
							// setUpdateEditorContent(true);
							// setCursorLocation({
							// 	lineNumber: 1,
							// 	charIndex: markdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
							// });
						};
					}
				}
			}
		});
		setUpdateEditorContent(false);
		console.log("I hope this useEffect is not going in loop, because I am setting the updateEditorContent to false at the end of this useEffect.");
	}, [updateEditorContent]);

	useEffect(() => {
		if (markdownEditor) {
			markdownEditor.editor.focus();
		}
	}, [markdownEditor]);
	// markdownEditor?.editor?.focus();

	// Tab Switching
	const [activeTab, setActiveTab] = useState<'liveEditor' | 'rawEditor'>('liveEditor');
	const handleTabSwitch = (tab: 'liveEditor' | 'rawEditor') => setActiveTab(tab);

	const filePathRef = useRef<HTMLInputElement>(null);
	const communityPlugins = new CommunityPlugins(plugin);
	useEffect(() => {
		if (!filePathRef.current) return;

		if (communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists) {
			const suggestionContent = getQuickAddPluginChoices(
				app,
				communityPlugins.quickAddPlugin
			);
			const onSelectCallback = (choice: string) => {
				setQuickAddPluginChoice(choice);
				// setNewFilePath(selectedPath);
			};
			new MultiSuggest(filePathRef.current, new Set(suggestionContent), onSelectCallback, app);
		} else {
			const suggestionContent = getFileSuggestions(app);
			const onSelectCallback = (selectedPath: string) => {
				setNewFilePath(selectedPath);
			};
			new MultiSuggest(filePathRef.current, new Set(suggestionContent), onSelectCallback, app);
		}
	}, [app]);

	return (
		<>
			<div className="EditTaskModalHome">
				<div className="EditTaskModalHomeBody">
					<div className="EditTaskModalHomeLeftSec">
						<div className="EditTaskModalHomeLeftSecScrollable">
							<div className="EditTaskModalHomeModalTitle" ref={titleComponentRef}></div>

							{/* Editor tab switcher */}
							<div className="EditTaskModalTabHeader">
								<div onClick={() => handleTabSwitch('liveEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'liveEditor' ? '-active' : ''}`}>{t("liveEditor")}</div>
								<div onClick={() => handleTabSwitch('rawEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'rawEditor' ? '-active' : ''}`}>{t("rawEditor")}</div>
							</div>
							<div className="EditTaskModalHomePreviewHeader">
								<div className="EditTaskModalHomePreviewHeaderFilenameLabel">{(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) ? t("quickadd-plugin-choice") : t("file")}:
									<input
										type="text"
										ref={filePathRef}
										className="EditTaskModalHomePreviewHeaderFilenameValue"
										value={(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) ? quickAddPluginChoice : newFilePath}
										onChange={(e) => {
											setIsEdited(true);
											if (communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) {
												setQuickAddPluginChoice(e.target.value);
												// setNewFilePath(e.target.value); // Don't set file path if it's a QuickAdd choice
											} else {
												setNewFilePath(e.target.value);
											}
											// Optionally propagate the change:
											// props.onFilePathChange?.(e.target.value);
										}}
										placeholder={(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) ? "Select the QuickAdd choice" : "Select file path..."}
									/>
								</div>
								<div className="EditTaskModalHomePreviewHeaderBtnSec">
									<button className="EditTaskModalHomeLiveEditorRefreshBtn"
										id="EditTaskModalHomeLiveEditorRefreshBtn"
										aria-label="Refresh the live editor"
										onClick={() => setUpdateEditorContent(true)}>
										<RefreshCcw height={20} />
									</button>
									{taskExists && <button className="EditTaskModalHomeOpenFileBtn"
										id="EditTaskModalHomeOpenFileBtn"
										aria-label={t("hold-ctrl-button-to-open-in-new-window")}
										onClick={(event) => isCtrlPressed ? onOpenFilBtnClicked(event.nativeEvent, true) : onOpenFilBtnClicked(event.nativeEvent, false)}
									>
										<FileInput height={20} />
									</button>}
								</div>
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
									onBlur={() => {
										setUpdateEditorContent(true);
										console.log("On focus lost from the text area");
									}}
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

						{/* Task Created Date */}
						{!plugin.settings.data.globalSettings.autoAddCreatedDate &&
							<div className="EditTaskModalHomeField">
								<label className="EditTaskModalHomeFieldTitle">{t("created-date")}</label>
								<input className="EditTaskModalHomeDueInput" type="date" value={createdDate} onChange={(e) => handleCreatedDateChange(e.target.value)} />
							</div>
						}

						{/* Task Start Date */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("start-date")}</label>
							<input className="EditTaskModalHomeDueInput" type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
						</div>

						{/* Task Scheduled Date */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("scheduled-date")}</label>
							<input className="EditTaskModalHomeDueInput" type="date" value={scheduledDate} onChange={(e) => handleScheduledDateChange(e.target.value)} />
						</div>

						{/* Task Due Date */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("due-date")}</label>
							<input className="EditTaskModalHomeDueInput" type="date" value={due} onChange={(e) => handleDueDateChange(e.target.value)} />
						</div>

						{/* Task reminder date-time selector */}
						{plugin.settings.data.globalSettings.notificationService !== NotificationService.None && (
							<div className="EditTaskModalHomeField">
								<label className="EditTaskModalHomeFieldTitle">{t("reminder-label")}</label>
								<input
									className="EditTaskModalHomeReminderInput"
									type="datetime-local"
									value={reminder}
									onFocus={() => {
										console.log("On focusing the date-time selector...\nreminder : ", reminder);
										if (!reminder || reminder === "") {
											const dateToUse = startDate || scheduledDate || due;
											const timeToUse = startTime || "09:00";
											if (dateToUse) {
												setReminder(`${dateToUse}T${timeToUse}`);
												setIsEdited(true);
												setUpdateEditorContent(true);
											}
										}
									}}
									onChange={(e) => handleReminderChange(e.target.value)}
								/>
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

						{/* Task Body */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("tag")}</label>
							<input
								ref={tagsInputFieldRef}
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
									const tagColor = customTagData?.color;
									const backgroundColor = tagColor ? updateRGBAOpacity(plugin, tagColor, 0.1) : `var(--tag-background)`;
									const borderColor = tagColor ? updateRGBAOpacity(plugin, tagColor, 0.5) : `var(--tag-color-hover)`;
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
	activeNote: boolean;
	saveTask: (updatedTask: taskItem, quickAddPluginChoice: string) => void;

	// public waitForClose: Promise<string>;
	// private resolvePromise: (input: string) => void;
	// private rejectPromise: (reason?: unknown) => void;

	public waitForClose: Promise<string>;
	private resolvePromise: (input: string) => void = (input: string) => { };
	private rejectPromise: (reason?: unknown) => void = (reason?: unknown) => { };

	constructor(app: App, plugin: TaskBoard, saveTask: (updatedTask: taskItem, quickAddPluginChoice: string) => void, activeNote: boolean, taskExists: boolean, task?: taskItem, filePath?: string) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.filePath = filePath ? filePath : "";
		this.taskExists = taskExists;
		this.saveTask = saveTask;
		if (taskExists && task) {
			this.task = task;
		}
		this.isEdited = false;
		this.activeNote = activeNote;

		this.waitForClose = new Promise<string>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

		const root = ReactDOM.createRoot(this.contentEl);

		this.setTitle(this.taskExists ? t("edit-task") : t("add-new-task"));

		root.render(<EditTaskContent
			app={this.app}
			plugin={this.plugin}
			root={contentEl}
			task={this.task}
			taskExists={this.taskExists}
			activeNote={this.activeNote}
			filePath={this.filePath}
			onSave={async (updatedTask, quickAddPluginChoice) => {
				this.isEdited = false;
				const formattedContent = await getFormattedTaskContent(updatedTask);
				this.resolvePromise(formattedContent);
				this.saveTask(updatedTask, quickAddPluginChoice);
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
				this.rejectPromise("Task was not submitted.")
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
		this.saveTask(this.task, 'temp choice');
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
			this.rejectPromise("Task was not submitted.")
			this.onClose();
			super.close();
		}
	}
}
