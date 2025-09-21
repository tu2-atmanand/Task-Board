// /src/modal/AddOrEditTaskModal.tsx

import { App, Component, Keymap, Modal, Notice, Platform, TFile, UserEvent, debounce, normalizePath } from "obsidian";
import { FaLinkedin, FaTimes } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import { priorityOptions, taskItem, taskStatuses } from "src/interfaces/TaskItem";

import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import ReactDOM from "react-dom/client";
import TaskBoard from "main";
import { updateRGBAOpacity } from "src/utils/UIHelpers";
import { t } from "src/utils/lang/helper";
import { cleanTaskTitleLegacy, cursorLocation, getFormattedTaskContent, getFormattedTaskContentSync, sanitizeCreatedDate, sanitizeDependsOn, sanitizeDueDate, sanitizePriority, sanitizeReminder, sanitizeScheduledDate, sanitizeStartDate, sanitizeTags, sanitizeTime } from "src/utils/TaskContentFormatter";
import { EmbeddableMarkdownEditor, createEmbeddableMarkdownEditor } from "src/services/MarkdownEditor";
import { buildTaskFromRawContent, generateTaskId } from "src/utils/VaultScanner";
import { DeleteIcon, EditIcon, FileInput, Network, RefreshCcw } from "lucide-react";
import { MultiSuggest, getFileSuggestions, getPendingTasksSuggestions, getQuickAddPluginChoices, getTagSuggestions } from "src/services/MultiSuggest";
import { CommunityPlugins } from "src/services/CommunityPlugins";
import { DEFAULT_SETTINGS, NotificationService, UniversalDateOptions } from "src/interfaces/GlobalSettings";
import { bugReporter, openEditTaskModal, openEditTaskNoteModal } from "src/services/OpenModals";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import { getObsidianIndentationSetting, isTaskLine } from "src/utils/CheckBoxUtils";
import { formatTaskNoteContent, isTaskNotePresentInTags } from "src/utils/TaskNoteUtils";
import { readDataOfVaultFile } from "src/utils/MarkdownFileOperations";
import { getLocalDateTimeString } from "src/utils/TimeCalculations";
import { applyIdToTaskInNote, getTaskFromId } from "src/utils/TaskItemUtils";
import { eventEmitter } from "src/services/EventEmitter";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";

const taskItemEmpty: taskItem = {
	id: 0,
	legacyId: "",
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
	plugin: TaskBoard,
	root: HTMLElement,
	activeNote: boolean,
	filePath: string;
	isTaskNote: boolean;
	noteContent: string;
	task?: taskItem,
	taskExists?: boolean,
	onSave: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}> = ({ plugin, root, isTaskNote, noteContent, task = taskItemEmpty, taskExists, activeNote, filePath, onSave, onClose, setIsEdited }) => {
	const [title, setTitle] = useState(
		task.title
			? task.title
			: isTaskNote ? "" : "- [ ] "
	);
	const [bodyContent, setBodyContent] = useState(isTaskNote ? noteContent : task.body?.join('\n') || '');
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
	const [dependsOn, setDependsOn] = useState<string[]>(task?.dependsOn || []);
	const [childTasks, setChildTasks] = useState<taskItem[]>([]);

	const [formattedTaskContent, setFormattedTaskContent] = useState<string>(isTaskNote ? noteContent : getFormattedTaskContentSync(task));
	const [newFilePath, setNewFilePath] = useState<string>(filePath);
	const [quickAddPluginChoice, setQuickAddPluginChoice] = useState<string>(plugin.settings.data.globalSettings.quickAddPluginDefaultChoice || '');

	const [markdownEditor, setMarkdownEditor] = useState<EmbeddableMarkdownEditor | null>(null);
	const [isEditorContentChanged, setIsEditorContentChanged] = useState<Boolean>(false);
	const cursorLocationRef = useRef<cursorLocation | null>(null);

	const indentationString = getObsidianIndentationSetting(plugin);

	const [isRightSecVisible, setIsRightSecVisible] = useState(false);
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

	// ------------ Handle task property values changes ------------
	const titleComponentRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (isTaskNote) return;

		const cleanedTaskTitle = cleanTaskTitleLegacy(plugin, modifiedTask);
		// setFormattedTaskContent(cleanedTaskTitle);
		if (titleComponentRef.current && cleanedTaskTitle !== "") {
			// Clear previous content before rendering new markdown
			titleComponentRef.current.empty();

			MarkdownUIRenderer.renderTaskDisc(
				plugin.app,
				cleanedTaskTitle,
				titleComponentRef.current,
				filePath,
				componentRef.current
			);
		}
	}, [title]); // Re-render when modifiedTask changes
	const handleTaskTitleChange = (value: string) => {
		// This function will be called only in the case of Task Notes
		setTitle(value);
		setIsEdited(true);

		const newFormattedTaskNoteContent = formattedTaskContent.replace(/title: .*/, `title: ${value}`);
		console.log("Updated formattedTaskContent after title change:", newFormattedTaskNoteContent);
		updateEmbeddableMarkdownEditor(newFormattedTaskNoteContent);
		setFormattedTaskContent(newFormattedTaskNoteContent);

		// setNewFilePath(normalizePath(value.trim() === "" ? filePath : value.endsWith(".md") ? value : `${value}.md`));
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
		setIsEditorContentChanged(true);
	}

	const handleCreatedDateChange = (value: string) => {
		setCreatedDate(value);

		if (!isTaskNote) {
			const newTitle = sanitizeCreatedDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handleStartDateChange = (value: string) => {
		setStartDate(value);

		if (!isTaskNote) {
			const newTitle = sanitizeStartDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handleScheduledDateChange = (value: string) => {
		setScheduledDate(value);

		if (!isTaskNote) {
			const newTitle = sanitizeScheduledDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handleDueDateChange = (value: string) => {
		setDue(value);

		if (!isTaskNote) {
			const newTitle = sanitizeDueDate(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handleReminderChange = (value: string) => {
		setReminder(value);
		// if (value) {
		// 	setTitle(`${title} (@${due} ${startTime})`);
		// } else {
		// 	const reminderRegex = /(\(@\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?\))/;
		// 	setTitle(title.replace(reminderRegex, ""));
		// }
		if (!isTaskNote) {
			const newTitle = sanitizeReminder(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handlePriorityChange = (value: number) => {
		setPriority(value);

		if (!isTaskNote) {
			const newTitle = sanitizePriority(plugin.settings.data.globalSettings, title, value, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	// Automatically update end time if only start time is provided
	useEffect(() => {
		let newTime = '';
		if (startTime && !endTime) {
			const [hours, minutes] = startTime.split(':');
			const newEndTime = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`;
			setEndTime(newEndTime);
			newTime = `${startTime} - ${newEndTime}`;
			setNewTime(newTime);
		} else if (startTime && endTime) {
			newTime = `${startTime} - ${endTime}`;
			setNewTime(newTime);
		}

		if (!isTaskNote) {
			const newTitle = sanitizeTime(plugin.settings.data.globalSettings, title, newTime, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}
	}, [startTime, endTime]);

	const handleStartTimeChange = (startTime: string) => {
		setStartTime(startTime);
		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handleEndTimeChange = (endTime: string) => {
		setEndTime(endTime);
		setIsEdited(true);
		setIsEditorContentChanged(true);
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

	// Tags input
	const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const input = e.currentTarget.value.trim().startsWith("#") ? e.currentTarget.value.trim() : `#${e.currentTarget.value.trim()}`;

			if (!isTaskNote) {
				const newTitle = sanitizeTags(title, tags, input, cursorLocationRef.current ?? undefined);
				setTitle(newTitle);
			}

			if (!tags.includes(input)) {
				setTags(prevTags => [...prevTags, input]);
				e.currentTarget.value = '';
				setIsEdited(true);
				setIsEditorContentChanged(true);
			}
		}
	};
	const tagsInputFieldRef = useRef<HTMLInputElement>(null);
	// NEW refs to always track the latest value of title and tags
	const titleRef = useRef(title);
	const tagsRef = useRef(tags);

	// Keep refs updated on each render
	useEffect(() => {
		titleRef.current = title;
		tagsRef.current = tags;
	}, [title, tags]);
	useEffect(() => {
		if (!tagsInputFieldRef.current) return;

		const suggestionContent = getTagSuggestions(plugin.app);
		const onSelectCallback = (choice: string) => {
			const currentTitle = titleRef.current;
			const currentTags = tagsRef.current;

			if (!isTaskNote) {
				const newTitle = sanitizeTags(currentTitle, currentTags, choice, cursorLocationRef.current ?? undefined);
				setTitle(newTitle);
			}

			if (!currentTags.includes(choice)) {
				setTags(prevTags => [...prevTags, choice]);
			}
			setIsEdited(true);
			setIsEditorContentChanged(true);

			tagsInputFieldRef.current?.setText('');
		};
		new MultiSuggest(tagsInputFieldRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);
	}, [plugin.app]);
	// Function to remove a tag
	const removeTag = (tagToRemove: string) => {
		const newTags = tags.filter(tag => tag !== tagToRemove);
		setTags(newTags);

		if (!isTaskNote) {
			const newTitle = sanitizeTags(title, newTags, '', cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	};


	// ------------ Handle save task ------------

	// Function to handle saving the updated task
	const handleSave = () => {
		if (isTaskNote) {
			handleSaveAsTaskNote();
		} else {
			handleSaveAsTaskLine();
		}
	};

	const handleSaveAsTaskLine = () => {
		let newDue = due;
		let newStartDate = startDate;
		let newScheduledDate = scheduledDate;

		if (plugin.settings.data.globalSettings.autoAddUniversalDate && !taskExists) {
			const universalDateType = plugin.settings.data.globalSettings.universalDate;
			if (universalDateType === UniversalDateOptions.dueDate && !due) {
				newDue = new Date().toISOString().split('T')[0];
			} else if (universalDateType === UniversalDateOptions.startDate && !startDate) {
				newStartDate = new Date().toISOString().split('T')[0];
			} else if (universalDateType === UniversalDateOptions.scheduledDate && !scheduledDate) {
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

		onSave(updatedTask, quickAddPluginChoice);
		// onClose();
	}

	// Function to handle saving as task note
	const handleSaveAsTaskNote = () => {
		let newDue = due;
		let newStartDate = startDate;
		let newScheduledDate = scheduledDate;

		if (plugin.settings.data.globalSettings.autoAddUniversalDate && !taskExists) {
			const universalDateType = plugin.settings.data.globalSettings.universalDate;
			if (universalDateType === UniversalDateOptions.dueDate && !due) {
				newDue = new Date().toISOString().split('T')[0];
			} else if (universalDateType === UniversalDateOptions.startDate && !startDate) {
				newStartDate = new Date().toISOString().split('T')[0];
			} else if (universalDateType === UniversalDateOptions.scheduledDate && !scheduledDate) {
				newScheduledDate = new Date().toISOString().split('T')[0];
			}
		}

		let newCreatedDate = createdDate;
		if (plugin.settings.data.globalSettings.autoAddCreatedDate && !taskExists) {
			newCreatedDate = new Date().toISOString().split('T')[0];
		}

		// Determine file path for task note
		let taskNoteFilePath = allowedFileExtensionsRegEx.test(newFilePath) ? newFilePath : `${newFilePath}.md`;
		taskNoteFilePath = normalizePath(taskNoteFilePath);

		const taskNoteItem: taskItem = {
			...modifiedTask,
			title: title,
			body: formattedTaskContent ? formattedTaskContent.split('\n').filter(line => isTaskLine(line)) : [],
			createdDate: newCreatedDate,
			startDate: newStartDate,
			scheduledDate: newScheduledDate,
			due: newDue,
			tags: [...tags, '#taskNote'], // Add taskNote tag
			time: newTime,
			priority: modifiedTask.priority,
			filePath: taskNoteFilePath,
			taskLocation: modifiedTask.taskLocation,
			cancelledDate: modifiedTask.cancelledDate || '',
			status: modifiedTask.status,
			reminder: modifiedTask.reminder,
		};

		console.log("Task Note Item to be saved:", taskNoteItem);

		// Call onSave with the task note item
		onSave(taskNoteItem, quickAddPluginChoice, formattedTaskContent ? formattedTaskContent : undefined);
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
		tags: tags,
		time: newTime,
		priority: priority,
		filePath: newFilePath,
		status: status,
		reminder: reminder,
		taskLocation: task.taskLocation,
		completion: task.completion || '',
		cancelledDate: task.cancelledDate || '',
	};


	// ------------------ Tab Switching and other components ------------------
	const [activeTab, setActiveTab] = useState<'liveEditor' | 'rawEditor'>('liveEditor');
	const handleTabSwitch = (tab: 'liveEditor' | 'rawEditor') => setActiveTab(tab);

	const filePathRef = useRef<HTMLInputElement>(null);
	const communityPlugins = new CommunityPlugins(plugin);
	useEffect(() => {
		if (!filePathRef.current) return;

		if (communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists) {
			const suggestionContent = getQuickAddPluginChoices(
				plugin.app,
				communityPlugins.quickAddPlugin
			);
			const onSelectCallback = (choice: string) => {
				setQuickAddPluginChoice(choice);
				// setNewFilePath(selectedPath);
			};
			new MultiSuggest(filePathRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);
		} else {
			const suggestionContent = getFileSuggestions(plugin.app);
			const onSelectCallback = (selectedPath: string) => {
				setNewFilePath(selectedPath);
			};
			new MultiSuggest(filePathRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);
		}
	}, [plugin.app]);

	const handleOpenTaskInMapView = () => {
		if (!plugin.settings.data.globalSettings.experimentalFeatures) {
			new Notice(t("enable-experimental-features-message"));
			return;
		}

		applyIdToTaskInNote(plugin, task).then((newId) => { // Somehow the newId is not passed by the async functions. I always get undefined here. Need to check.
			console.log("Task after ensuring it has an ID:", newId);

			plugin.settings.data.globalSettings.lastViewHistory.viewedType = 'map';
			plugin.settings.data.globalSettings.lastViewHistory.taskId = newId ? String(newId) : (task.legacyId ? task.legacyId : String(plugin.settings.data.globalSettings.uniqueIdCounter));

			console.log("Preparing to open task in kanban view. Current file path:", newFilePath, "\nTask ID:", task.id, "\nLegacy ID:", task.legacyId, "\nnewId:", newId);

			plugin.realTimeScanning.processAllUpdatedFiles(filePath).then(() => {
				onClose();
				sleep(2000).then(() => {
					console.log("Emitting SWITCH_VIEW event for map view, 2000ms after closing the modal.");
					eventEmitter.emit("SWITCH_VIEW", 'map');
				});
			});

			console.log("Opening task in map view:", newFilePath);
		});

		// const file = plugin.app.vault.getAbstractFileByPath(newFilePath);
		// if (file && file instanceof TFile) {
		// 	plugin.app.workspace.openLinkText('', newFilePath, 'map');
		// } else {
		// 	new Notice(t("file-not-found"));
		// }
		// onClose();
	};

	const [isCtrlPressed, setIsCtrlPressed] = useState(false);
	useEffect(() => {
		if (!Platform.isMobile) {
			markdownEditor?.editor?.focus();
		}
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
			// plugin.app.workspace.openLinkText('', newFilePath, 'window')
			const leaf = plugin.app.workspace.getLeaf('window');
			const file = plugin.app.vault.getAbstractFileByPath(newFilePath);
			if (file && file instanceof TFile) {
				await leaf.openFile(file, { eState: { line: task.taskLocation.startLine - 1 } });
			} else {
				bugReporter(plugin, "File not found", `The file at path ${newFilePath} could not be found.`, "AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked");
			}
		} else {
			// await plugin.app.workspace.openLinkText('', newFilePath, false);
			// const activeEditor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
			// console.log("Note View:", activeEditor);
			// activeEditor?.scrollIntoView({
			// 	from: { line: 5, ch: 0 },
			// 	to: { line: 5, ch: 5 },
			// }, true);

			const leaf = plugin.app.workspace.getLeaf(Keymap.isModEvent(evt));
			const file = plugin.app.vault.getAbstractFileByPath(newFilePath);

			if (file && file instanceof TFile) {
				await leaf.openFile(file, { eState: { line: task.taskLocation.startLine - 1 } });
			} else {
				bugReporter(plugin, "File not found", `The file at path ${newFilePath} could not be found.`, "AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked");
			}
		}
		onClose();
	}
	// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


	// ------------- Handle Live markdown editor integration ------------

	const componentRef = useRef<Component | null>(null); // Reference to the HTML element where markdown will be rendered
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = plugin.view;
	}, []);

	// TODO : This function should be optimized to avoid excessive parsing on every keystroke.
	const handleTaskEditedThroughEditors = debounce((value: string) => {
		if (isTaskNote) return;

		const updatedTask = buildTaskFromRawContent(value, indentationString);

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
	}, 50);

	// // This useEffect is used to get the formatted content of the updated task, which will be rendered in the editor(s).
	// useEffect(() => {
	// 	const formatedContent = getSanitizedTaskContent(plugin, modifiedTask);
	// 	console.log("formattedTaskContent : ", formatedContent);
	// 	setFormattedTaskContent(formatedContent);
	// }, [modifiedTask]); // Re-render when modifiedTask changes

	const markdownEditorEmbeddedContainer = useRef<HTMLElement>(null);
	const updateEmbeddableMarkdownEditor = (formattedTaskContent: string) => {
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
				console.log("Creating new embedded markdown editor with content:", formattedTaskContent);
				markdownEditorEmbeddedContainer.current.empty();
				const fullMarkdownEditor = createEmbeddableMarkdownEditor(
					plugin.app,
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
						},
						onBlur: (editor) => {
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
				// 	// setIsEditorContentChanged(true);
				// 	// setCursorLocation({
				// 	// 	lineNumber: 1,
				// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
				// 	// });
				// }

				// Only this one worked.
				fullMarkdownEditor.activeCM.contentDOM.onblur = () => {
					// setIsEditorContentChanged(true);
					const cursor = fullMarkdownEditor.editor.editor?.getCursor();
					cursorLocationRef.current = {
						lineNumber: (cursor ? cursor.line + 1 : 0),
						charIndex: (cursor ? (cursor?.ch < 0 ? 0 : cursor?.ch) : formattedTaskContent.split("\n")[0].length),
					};
				}

				// fullMarkdownEditor.containerEl.onblur = () => {
				// 	console.log("3. onBlur event triggered in the embedded markdown editor's container.");
				// 	// setIsEditorContentChanged(true);
				// 	// setCursorLocation({
				// 	// 	lineNumber: 1,
				// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
				// 	// });
				// }

				// fullMarkdownEditor.editorEl.onblur = () => {
				// 	console.log("4. onBlur event triggered in the embedded markdown editor's editor element.");
				// 	// setIsEditorContentChanged(true);
				// 	// setCursorLocation({
				// 	// 	lineNumber: 1,
				// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
				// 	// });
				// }

				// fullMarkdownEditor.editorEl.addEventListener("blur", () => {
				// 	console.log("5. onBlur event triggered in the embedded markdown editor's editor element's event listener.");
				// 	// setIsEditorContentChanged(true);
				// 	// setCursorLocation({
				// 	// 	lineNumber: 1,
				// 	// 	charIndex: fullMarkdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
				// 	// });
				// });

				// fullMarkdownEditor.editor.editorEl.addEventListener("blur", (event: FocusEvent) => {
				// 	console.log("6. onBlur event triggered in the embedded markdown editor's editor element's editor element.");
				// 	// setIsEditorContentChanged(true);
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

				// if (markdownEditor && markdownEditor.editorEl) {
				// 	markdownEditor.editorEl.onblur = () => {
				// 		// setIsEditorContentChanged(true);
				// 		// setCursorLocation({
				// 		// 	lineNumber: 1,
				// 		// 	charIndex: markdownEditor?.editor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
				// 		// });
				// 	};
				// }
			}
		}
	}
	useEffect(() => {
		console.log("Task.Body :", task.body);
		if (isTaskNote) {
			const newFormattedTaskNoteContent = formatTaskNoteContent(plugin, modifiedTask, formattedTaskContent);
			console.log("Formatted Task Note Content:", newFormattedTaskNoteContent);
			updateEmbeddableMarkdownEditor(newFormattedTaskNoteContent);
			setFormattedTaskContent(newFormattedTaskNoteContent);
			setIsEditorContentChanged(false);
		}
		else {
			const newFormattedTaskNoteContent = getFormattedTaskContentSync(modifiedTask);
			updateEmbeddableMarkdownEditor(newFormattedTaskNoteContent);
			setFormattedTaskContent(newFormattedTaskNoteContent);
			setIsEditorContentChanged(false);
		}
	}, [isEditorContentChanged]);

	// Not focusing on mobile as it brings up the keyboard everytime this modal is opened. Which is a little distrubing.
	// Also if its a TaskNote, then dont focus inside the Live editor, instead focus on the title input field.
	useEffect(() => {
		if (markdownEditor) {
			if (!Platform.isMobile && !isTaskNote) {
				markdownEditor?.editor.focus();
			}
		}
	}, [markdownEditor]);


	// ------------------ Child Tasks Management -----------------

	const childTaskInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (!childTaskInputRef.current) return;

		const pendingTaskItems = getPendingTasksSuggestions(
			plugin
		);
		const suggestionContent = pendingTaskItems.filter(t => t.title !== title).map(t => t.title && t.title !== undefined ? t.title : ""); // Exclude self from suggestions
		const onSelectCallback = (choice: string) => {
			console.log("Selected child task:", choice);
			let selectedTask = pendingTaskItems.find(t => t.title === choice);
			if (!selectedTask) {
				bugReporter(plugin, "Selected task not found", `The selected task with title ${choice} was not found in pending tasks.`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect");
				return;
			}
			applyIdToTaskInNote(plugin, selectedTask).then((newId) => {
				console.log("Selected Task after applying ID:", selectedTask);

				const getUpdatedDependsOnIds = (prev: string[]) => {
					console.log("Previous depends on values :", prev);
					if (!prev.includes(task.legacyId ? task.legacyId : String(task.id))) {
						if (newId === undefined && !selectedTask?.legacyId) {
							bugReporter(plugin, "Both newId and legacyId are undefined", `Both newId and legacyId are undefined for the selected task titled ${selectedTask.title}.`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect/getUpdatedDependsOnIds");
							return [...prev, String(plugin.settings.data.globalSettings.uniqueIdCounter)];
						} else if (newId === undefined) {
							return [...prev, selectedTask.legacyId];
						} else if (newId) {
								return [...prev, String(newId)];
						}
					}
					return prev;
				};
				// const updatedDependsOnIds = getUpdatedDependsOnIds(dependsOn);
				// console.log("Updated dependsOn IDs:", updatedDependsOnIds);
				setDependsOn(prev => {
					const updated = getUpdatedDependsOnIds(prev);
					if (!isTaskNote) {
						const newTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, title, updated, cursorLocationRef.current ?? undefined);
						console.log("New Title:", newTitle);
						setTitle(newTitle);
					}

					selectedTask.legacyId = selectedTask.legacyId ? selectedTask.legacyId : (newId ? String(newId) : String(plugin.settings.data.globalSettings.uniqueIdCounter));
					setChildTasks(prevChildTasks => {
						// Avoid adding duplicates
						if (!prevChildTasks.find(t => t.id === selectedTask.id)) {
							return [...prevChildTasks, selectedTask];
						}
						return prevChildTasks;
					});

					setIsEdited(true);
					setIsEditorContentChanged(true);
					return updated;
				});
			}).catch(err => {
				bugReporter(plugin, "Error updating task in file", `An error occurred while updating the task in file: ${err.message}`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect");
			});
		};
		new MultiSuggest(childTaskInputRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);

	}, [plugin.app]);

	const childTaskTitleRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	console.log("Is childTaskTitleRefs getting initialized to empty object after a new child task has been added :", childTaskTitleRefs.current, "\ndependsOn: ", dependsOn);
	// This should run only on the first render to fetch child tasks based on dependsOn IDs
	useEffect(() => {
		if (childTasks.length === 0 && dependsOn.length > 0) {
			Promise.all(dependsOn.map(id => getTaskFromId(plugin, id)))
				.then(tasks => {
					const validTasks = tasks.filter(Boolean) as taskItem[];
					setChildTasks(validTasks);
				})
				.catch(err => {
					console.error("Error fetching child tasks:", err);
				});
		}
	}, []);

	// Render child task titles when childTasks changes
	useEffect(() => {
		childTasks.forEach((childTask, index) => {
			const element = childTaskTitleRefs.current[childTask.legacyId ? childTask.legacyId : String(childTask.id)];
			if (!element) return;

			// Clear previous content before rendering
			if (element.empty) element.empty();
			else element.innerHTML = "";

			const childTaskTitle = childTask.title;
			MarkdownUIRenderer.renderSubtaskText(
				plugin.app,
				childTaskTitle,
				element,
				task.filePath,
				componentRef.current
			);
		});
	}, [childTasks]);

	const handleOpenChildTaskModal = async (taskId: string) => {
		const childTask = childTasks.find(t => String(t.id) === taskId);
		if (!childTask) {
			bugReporter(plugin, "Child task not found", `The child task with ID ${taskId} was not found in pending tasks.`, "AddOrEditTaskModal.tsx/EditTaskContent/handleOpenChildTaskModal");
			return;
		}

		// Will need to open the AddOrEditTaskModal modal for child task in a new window, until i come up with a better solution.
		// const leaf = plugin.app.workspace.getLeaf('window');
		// await leaf.setViewState({ type: 'empty', active: true });
		// // Clear existing children in the leaf
		// await leaf.open(new AddOrEditTaskModal(plugin, childTask, onSave, onClose, true, activeNote));

		//For now will simply open it in a new modal.
		console.log("Output of isTaskNotePresentInTags(plugin, childTask.tags): ", isTaskNotePresentInTags(plugin, childTask.tags));
		if (isTaskNotePresentInTags(plugin, childTask.tags)) {
			plugin.app.workspace.openPopoutLeaf(); // This is temporary solution for now. Later we can open it as a new tab in a new window.
			await sleep(50);
			openEditTaskNoteModal(plugin, childTask);
		} else {
			plugin.app.workspace.openPopoutLeaf();
			await sleep(50);
			openEditTaskModal(plugin, childTask);
		}
	}

	const handleRemoveChildTask = (taskId: string) => {
		console.log("Removing child task with ID:", taskId);
		const newDependsOn = dependsOn.filter(id => id !== taskId);
		setDependsOn(newDependsOn);
		if (!isTaskNote) {
			const newTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, title, newDependsOn, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}
		setIsEdited(true);
		setIsEditorContentChanged(true);
	};

	// ------------------ Rendering the component ------------------

	return (
		<>
			<div className="EditTaskModalHome">
				<div className="EditTaskModalHomeBody">
					<div className="EditTaskModalHomeLeftSec">
						<div className="EditTaskModalHomeLeftSecScrollable">
							{!isTaskNote ? (
								<div className="EditTaskModalHomeModalTitle" ref={titleComponentRef}></div>
							) : (
								<input
									className="EditTaskModalHomeModalTitleInput"
									type="text"
									value={title}
									onChange={e => handleTaskTitleChange(e.target.value)}
									placeholder={t("task-note-title-placeholder")}
								/>
							)}

							{/* Editor tab switcher */}
							<div className="EditTaskModalTabHeader">
								<div className="EditTaskModalTabHeaderLeftBtnSec">
									<div onClick={() => handleTabSwitch('liveEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'liveEditor' ? '-active' : ''}`}>{t("liveEditor")}</div>
									<div onClick={() => handleTabSwitch('rawEditor')} className={`EditTaskModalTabHeaderBtn${activeTab === 'rawEditor' ? '-active' : ''}`}>{t("rawEditor")}</div>
								</div>
								<div className="EditTaskModalTabHeaderRightBtnSec">
									{taskExists && (
										<div className="EditTaskModalTabHeaderOpenMapBtn" onClick={handleOpenTaskInMapView} aria-placeholder={t("open-in-map-view")}>
											<Network height={16} />
										</div>
									)}
								</div>
							</div>
							<div className="EditTaskModalHomePreviewHeader">
								<div className="EditTaskModalHomePreviewHeaderFilenameLabel">{(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !isTaskNote && !activeNote) ? t("quickadd-plugin-choice") : t("file")}:
									<input
										type="text"
										ref={filePathRef}
										className="EditTaskModalHomePreviewHeaderFilenameValue"
										value={(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) ? quickAddPluginChoice : newFilePath}
										onChange={(e) => {
											setIsEdited(true);
											if (communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !isTaskNote && !activeNote) {
												setQuickAddPluginChoice(e.target.value);
												// setNewFilePath(e.target.value); // Don't set file path if it's a QuickAdd choice
											} else {
												setNewFilePath(e.target.value);
											}
											// Optionally propagate the change:
											// props.onFilePathChange?.(e.target.value);
										}}
										placeholder={(communityPlugins.isQuickAddPluginIntegrationEnabled() && !taskExists && !activeNote) ? "Select the QuickAdd choice" : "Select file path"}
									/>
								</div>
								<div className="EditTaskModalHomePreviewHeaderBtnSec">
									<button className="EditTaskModalHomeLiveEditorRefreshBtn"
										id="EditTaskModalHomeLiveEditorRefreshBtn"
										aria-label="Refresh the live editor"
										onClick={() => setIsEditorContentChanged(true)}>
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
										<span
											className="EditTaskModalLiveEditor"
											ref={markdownEditorEmbeddedContainer}
											onClick={() => {
												if (markdownEditor) {
													cursorLocationRef.current = {
														lineNumber: formattedTaskContent.length - 1,
														charIndex: formattedTaskContent.split("\n")[formattedTaskContent.length - 1]?.length - 1,
													};
													markdownEditor.editor.focus();
												}
											}}
										></span>
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
										setIsEditorContentChanged(true);
									}}
									placeholder={t("body-content")}
									style={{ display: activeTab === 'rawEditor' ? 'block' : 'none', width: '100%' }}
								/>
							</div>

							{/* Child Tasks */}
							<label className="EditTaskModalHomeFieldTitle">{t("child-tasks-depends-on")}</label>
							<div className="EditTaskModalChildTasksContainer">
								<input
									type="text"
									ref={childTaskInputRef}
									className="EditTaskModalChildTaskInput"
									placeholder={t("search-for-task")}
									value={''}
									onChange={(e) => { e.preventDefault(); }}
								/>
								{/* Here I want to show all the depends on tasks */}
								<div className="EditTaskModalChildTasksList">
									{dependsOn.map((taskId) => (
										<div key={taskId} className="EditTaskModalChildTasksListItem">
											<div className="EditTaskModalChildTasksListItemFooter">
												<div className="EditTaskModalChildTasksListItemIdSec">
													<div className="EditTaskModalChildTasksListItemIdLabel">Task Id : </div>
													<span className="EditTaskModalChildTasksListItemIdValue">{taskId}</span>
												</div>
												<div className="EditTaskModalChildTasksListItemFooterBtns">
													<button className="EditTaskModalChildTasksListItemEditBtn" onClick={() => handleOpenChildTaskModal(taskId)} aria-label="Edit Child Task"><EditIcon size={17} /></button>
													<button className="EditTaskModalChildTasksListItemDeleteBtn" onClick={() => handleRemoveChildTask(taskId)}><DeleteIcon size={20} /></button>
												</div>
											</div>
											<div className="EditTaskModalChildTasksListItemTitle" ref={(el) => { childTaskTitleRefs.current[taskId] = el; }}></div>
										</div>
									))}
								</div>
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
										if (!reminder || reminder === "") {
											const dateToUse = startDate || scheduledDate || due;
											const timeToUse = startTime || "09:00";
											if (dateToUse) {
												setReminder(`${dateToUse}T${timeToUse}`);
												setIsEdited(true);
												setIsEditorContentChanged(true);
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
								onKeyDown={(e) => handleTagInput(e)}  // Call handleTagInput on change
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
	plugin: TaskBoard;
	task: taskItem = taskItemEmpty;
	filePath: string;
	taskExists: boolean;
	isEdited: boolean;
	isTaskNote: boolean;
	activeNote: boolean;
	saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void;

	// public waitForClose: Promise<string>;
	// private resolvePromise: (input: string) => void;
	// private rejectPromise: (reason?: unknown) => void;

	public waitForClose: Promise<string>;
	private resolvePromise: (input: string) => void = (input: string) => { };
	private rejectPromise: (reason?: unknown) => void = (reason?: unknown) => { };

	constructor(plugin: TaskBoard, saveTask: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => void, isTaskNote: boolean, activeNote: boolean, taskExists: boolean, task?: taskItem, filePath?: string) {
		super(plugin.app);
		this.plugin = plugin;
		this.filePath = filePath ? filePath : "";
		this.taskExists = taskExists;
		this.saveTask = saveTask;
		if (taskExists && task) {
			this.task = task;
		}
		this.isEdited = false;
		this.isTaskNote = isTaskNote;
		this.activeNote = activeNote;

		console.log("AddOrEditTaskModal | isTaskNote: ", isTaskNote, " | activeNote: ", activeNote, " | taskExists: ", taskExists, " | task: ", this.task, " | filePath: ", this.filePath);

		this.waitForClose = new Promise<string>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

		const root = ReactDOM.createRoot(this.contentEl);

		this.setTitle(this.taskExists ? t("edit-task") : t("add-new-task"));

		if (!this.isTaskNote && this.plugin.settings.data.globalSettings.autoAddUniqueID && (!this.taskExists || !this.task.id || this.task.id === 0)) {
			this.task.id = generateTaskId(this.plugin);
			this.task.legacyId = String(this.task.id);
		}

		// Some processing, if this is a Task-Note
		let noteContent: string = "";
		if (this.isTaskNote) {
			if (this.filePath) {
				noteContent = await readDataOfVaultFile(this.plugin, this.filePath);
			} else {
				noteContent = "---\ntitle: \n---\n";

				const defaultLocation = this.plugin.settings.data.globalSettings.taskNoteDefaultLocation || 'TaskNotes';
				const noteName = this.task.title || getLocalDateTimeString();
				// Sanitize filename
				const sanitizedName = noteName.replace(/[<>:"/\\|?*]/g, '_');
				this.filePath = normalizePath(`${defaultLocation}/${sanitizedName}.md`);
			}

			if (!this.task.title) this.task.title = this.filePath.split('/').pop()?.replace(allowedFileExtensionsRegEx, "") ?? "Untitled";

			if (this.plugin.settings.data.globalSettings.autoAddUniqueID && (!this.taskExists || !this.task.id || this.task.id === 0)) {
				this.task.id = generateTaskId(this.plugin);
			}
		}

		root.render(<EditTaskContent
			plugin={this.plugin}
			root={contentEl}
			isTaskNote={this.isTaskNote}
			noteContent={noteContent}
			task={this.task}
			taskExists={this.taskExists}
			activeNote={this.activeNote}
			filePath={this.filePath}
			onSave={async (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => {
				console.log("AddOrEditTaskModal | onSave called with updatedTask:", updatedTask, " | quickAddPluginChoice:", quickAddPluginChoice, " | updatedNoteContent:", updatedNoteContent);
				this.isEdited = false;
				const formattedContent = await getFormattedTaskContent(updatedTask);
				this.resolvePromise(formattedContent);
				this.saveTask(updatedTask, quickAddPluginChoice, updatedNoteContent);
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

	// handleSave() {
	// 	// Trigger save functionality if required before closing
	// 	this.saveTask(this.task, 'temp choice');
	// 	this.isEdited = false;
	// 	this.close();
	// }

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
