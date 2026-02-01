// /src/components/AddOrEditTaskRC.tsx
// React component for adding or editing tasks, usable in both modals and views

import { Component, Keymap, Notice, Platform, TFile, UserEvent, debounce, normalizePath } from "obsidian";
import { FaTimes, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import { cursorLocation, taskItem } from "src/interfaces/TaskItem";
import { moment as _moment } from "obsidian";
import TaskBoard from "main";
import { updateRGBAOpacity } from "src/utils/UIHelpers";
import { t } from "src/utils/lang/helper";
import { cleanTaskTitleLegacy, getFormattedTaskContentSync, sanitizeCreatedDate, sanitizeDependsOn, sanitizeDueDate, sanitizePriority, sanitizeReminder, sanitizeScheduledDate, sanitizeStartDate, sanitizeStatus, sanitizeTags, sanitizeTime } from "src/utils/taskLine/TaskContentFormatter";
import { buildTaskFromRawContent } from "src/managers/VaultScanner";
import { DeleteIcon, EditIcon, FileInput, Network, PanelRightOpenIcon } from "lucide-react";
import { MultiSuggest, getFileSuggestions, getPendingTasksSuggestions, getQuickAddPluginChoices, getTagSuggestions } from "src/services/MultiSuggest";
import { CommunityPlugins } from "src/services/CommunityPlugins";
import { openEditTaskView } from "src/services/OpenModals";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import { getObsidianIndentationSetting, isTaskLine } from "src/utils/CheckBoxUtils";
import { formatTaskNoteContent, isTaskNotePresentInTags } from "src/utils/taskNote/TaskNoteUtils";
import { eventEmitter } from "src/services/EventEmitter";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { markdownButtonHoverPreviewEvent } from "src/services/MarkdownHoverPreview";
import { ViewUpdate } from "@codemirror/view";
import { createEmbeddableMarkdownEditor, EmbeddableMarkdownEditor } from "src/services/MarkdownEditor";
import { UniversalDateOptions, EditButtonMode, NotificationService, statusTypeNames } from "src/interfaces/Enums";
import { getPriorityOptionsForDropdown, taskItemEmpty } from "src/interfaces/Mapping";
import { applyIdToTaskItem, getTaskFromId } from "src/utils/TaskItemUtils";
import { handleEditTask } from "src/utils/UserTaskEvents";
import { RxDragHandleHorizontal } from "react-icons/rx";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

export interface filterOptions {
	value: string;
	text: string;
}

// Functional React component for adding or editing tasks
export const AddOrEditTaskRC: React.FC<{
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
	const frontmatterContentRef = useRef<string>('');
	const [newFilePath, setNewFilePath] = useState<string>(filePath);
	const [quickAddPluginChoice, setQuickAddPluginChoice] = useState<string>(plugin.settings.data.globalSettings.quickAddPluginDefaultChoice || '');

	const [markdownEditor, setMarkdownEditor] = useState<EmbeddableMarkdownEditor | null>(null);
	const [isEditorContentChanged, setIsEditorContentChanged] = useState<Boolean>(true);
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

	// Fetch all the custom statuses and add them to the dropdown
	if (plugin.settings.data.globalSettings.customStatuses?.length > 0) {
		filteredStatusesDropdown = plugin.settings.data.globalSettings.customStatuses.map((customStatus) => ({
			value: customStatus.symbol,
			text: `${customStatus.name} [${customStatus.symbol}]`,
		}));
	} else {
		bugReporterManagerInsatance.addToLogs(
			129,
			`customStatuses are empty in the settings.`,
			"AddOrEditTaskRC.tsx",
		);
	}

	// ------------ Handle task property values changes ------------
	const titleComponentRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (isTaskNote) return;

		const cleanedTaskTitle = cleanTaskTitleLegacy(modifiedTask);
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

		const statusConfig =
			plugin.settings.data.globalSettings.customStatuses.find(
				(status) => status.symbol === symbol
			);
		const statusType = statusConfig ? statusConfig.type : statusTypeNames.TODO;
		// if (statusType === statusTypeNames.DONE) {
		// 	const globalSettings = plugin.settings.data.globalSettings;
		// 	const moment = _moment as unknown as typeof _moment.default;
		// 	const currentDateValue = moment().format(
		// 		globalSettings?.taskCompletionDateTimePattern
		// 	);
		// 	const newTitle = sanitizeCompletionDate(
		// 		globalSettings,
		// 		task.title,
		// 		currentDateValue
		// 	);
		// 	setTitle(newTitle);
		// } else if (statusType === statusTypeNames.CANCELLED) {
		// 	const globalSettings = plugin.settings.data.globalSettings;
		// 	const moment = _moment as unknown as typeof _moment.default;
		// 	const currentDateValue = moment().format(
		// 		globalSettings?.taskCompletionDateTimePattern
		// 	);
		// 	const newTitle = sanitizeCancelledDate(
		// 		globalSettings,
		// 		task.title,
		// 		currentDateValue
		// 	);
		// 	setTitle(newTitle);
		// } else {
		// 	let newTitle = task.title;
		// 	const globalSettings = plugin.settings.data.globalSettings;
		// 	newTitle = sanitizeCancelledDate(globalSettings, newTitle, "");
		// 	newTitle = sanitizeCompletionDate(globalSettings, newTitle, "");
		// 	setTitle(newTitle);
		// }

		const globalSettings = plugin.settings.data.globalSettings;
		const newTitle = sanitizeStatus(globalSettings, task.title, symbol, statusType);
		setTitle(newTitle);

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
	const handleCompleteTimeChange = (updatedStartTime: string, updatedEndTime: string) => {
		let newTime = '';
		if (!updatedStartTime) {
			setStartTime("");
			setEndTime("");
			setNewTime("");
		} else if (updatedStartTime && !updatedEndTime) {
			const [hours, minutes] = updatedStartTime.split(':');
			const newEndTime = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`;
			setEndTime(newEndTime);
			newTime = `${updatedStartTime} - ${newEndTime}`;
			setNewTime(newTime);
		} else if (updatedStartTime && updatedEndTime) {
			newTime = `${updatedStartTime} - ${updatedEndTime}`;
			setNewTime(newTime);
		}

		if (!isTaskNote) {
			const newTitle = sanitizeTime(plugin.settings.data.globalSettings, title, newTime, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}
		setIsEditorContentChanged(true);
	}


	const handleStartTimeChange = (updatedStartTime: string) => {
		setStartTime(updatedStartTime);
		setIsEdited(true);

		handleCompleteTimeChange(updatedStartTime, "");

		// setIsEditorContentChanged(true);
	}

	const handleEndTimeChange = (updatedEndTime: string) => {
		setEndTime(updatedEndTime);
		setIsEdited(true);

		handleCompleteTimeChange(startTime, updatedEndTime);

		// setIsEditorContentChanged(true);
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
			const newTagsList = tags.concat(input);

			if (!isTaskNote) {
				const newTitle = sanitizeTags(title, tags, newTagsList, cursorLocationRef.current ?? undefined);
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
				const newTagsList = currentTags.concat(choice);
				const newTitle = sanitizeTags(currentTitle, currentTags, newTagsList, cursorLocationRef.current ?? undefined);
				setTitle(newTitle);
			}

			if (!currentTags.includes(choice)) {
				setTags(prevTags => [...prevTags, choice]);
			}
			setIsEdited(true);
			setIsEditorContentChanged(true);

			// Clear the input field after MultiSuggest has finished processing
			setTimeout(() => {
				if (tagsInputFieldRef.current) {
					tagsInputFieldRef.current.value = '';
				}
			}, 0);
		};
		new MultiSuggest(tagsInputFieldRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);
	}, [plugin.app]);
	// Function to remove a tag
	const removeTag = (tagToRemove: string) => {
		const newTags = tags.filter(tag => tag !== tagToRemove);

		if (!isTaskNote) {
			const newTitle = sanitizeTags(title, tags, newTags, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}
		setTags(newTags);

		setIsEdited(true);
		setIsEditorContentChanged(true);
	};

	// const handleOnCompletionChange = (value: number) => {
	// 	task.onCompletion = value;
	// }


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
			title: title === "" ? taskNoteFilePath.split('/').pop() ?? "No title" : title,
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
			dependsOn: dependsOn,
		};

		// Call onSave with the task note item
		onSave(taskNoteItem, quickAddPluginChoice, formattedTaskContent ? formattedTaskContent : undefined);
	};

	let modifiedTask: taskItem = {
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
		dependsOn: dependsOn,
		completion: task.completion || '',
		cancelledDate: task.cancelledDate || '',
	};


	// ------------------ Tab Switching and other components ------------------

	const [activeTab, setActiveTab] = useState<'liveEditor' | 'rawEditor'>('liveEditor');
	const handleTabSwitch = (tab: 'liveEditor' | 'rawEditor') => {
		setActiveTab(tab);
		// setIsEditorContentChanged(true);
	};

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
		// if (!plugin.settings.data.globalSettings.experimentalFeatures) {
		// 	new Notice(t("enable-experimental-features-message"));
		// 	return;
		// }

		applyIdToTaskItem(plugin, task).then((newId) => {
			plugin.settings.data.globalSettings.lastViewHistory.viewedType = 'map';
			plugin.settings.data.globalSettings.lastViewHistory.taskId = newId ? String(newId) : (task.legacyId ? task.legacyId : String(plugin.settings.data.globalSettings.uniqueIdCounter));

			// console.log("Preparing to open task in kanban view. Current file path:", newFilePath, "\nTask ID:", task.id, "\nLegacy ID:", task.legacyId, "\nnewId:", newId);

			plugin.realTimeScanner.processAllUpdatedFiles(filePath).then(() => {
				onClose();
				sleep(1000).then(() => {
					eventEmitter.emit("SWITCH_VIEW", 'map');
				});
			});
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
				bugReporterManagerInsatance.showNotice(21, "File not found", `The file at path ${newFilePath} could not be found.`, "AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked");
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
				// bugReporterManagerInsatance.showNotice(22, "File not found", `The file at path ${newFilePath} could not be found.`, "AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked");
				new Notice(`The file at path ${newFilePath} could not be found. Maybe after you click on the save button, this file will be automatically created with the task you have entered.`, 7000);
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
				markdownEditorEmbeddedContainer.current.empty();
				// console.log("Finding where to place the cursor :", formattedTaskContent.split("\n")[0].length);
				const fullMarkdownEditor = createEmbeddableMarkdownEditor(
					plugin,
					markdownEditorEmbeddedContainer.current,
					{
						placeholder: "Start typing your task in this editor and use the various input fields to add the properties.",
						value: formattedTaskContent,
						cls: "addOrEditTaskModal-markdown-editor-embed",
						enableFrontmatterUI: isTaskNote, // Enable frontmatter UI for task notes
						cursorLocation: {
							anchor: isTaskNote ? 0 : formattedTaskContent.split("\n")[0].length,
							head: isTaskNote ? 0 : formattedTaskContent.split("\n")[0].length,
						},

						onEnter: (editor: EmbeddableMarkdownEditor, mod: boolean, shift: boolean) => {
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

						onSubmit: (editor: EmbeddableMarkdownEditor) => {
							handleSave();
						},

						onChange: (update: ViewUpdate) => {
							setIsEdited(true);
							const editorUpdatedContent = fullMarkdownEditor?.value || "";
							const fullFileContent = isTaskNote ? (frontmatterContentRef?.current ? `---\n${frontmatterContentRef.current}\n---\n` : "") + editorUpdatedContent : editorUpdatedContent;
							// console.log("Editor content changed.\neditor content :", editorUpdatedContent, " \nFull file content:", fullFileContent);
							setFormattedTaskContent(fullFileContent);
							handleTaskEditedThroughEditors(fullFileContent);

							// setCursorLocation({
							// 	lineNumber: 1,
							// 	charIndex: editor?.obsidianEditor?.getCursor().ch || formattedTaskContent.split("\n")[0].length,
							// });
						},
						onBlur: (editor: EmbeddableMarkdownEditor) => {
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
		if (isEditorContentChanged) {
			if (isTaskNote) {
				const { newContent, newFrontmatter, contentWithoutFrontmatter } = formatTaskNoteContent(plugin, modifiedTask, formattedTaskContent);
				const newFormattedTaskNoteContent = newContent;
				// console.log("Updating embedded markdown editor for task note with content:\n", newFormattedTaskNoteContent,
				// 	"\nFrontmatter:\n", newFrontmatter, "\nContent without frontmatter:\n", contentWithoutFrontmatter
				// );
				updateEmbeddableMarkdownEditor(newFormattedTaskNoteContent);
				setFormattedTaskContent(newFormattedTaskNoteContent);
				frontmatterContentRef.current = newFrontmatter;
				setIsEditorContentChanged(false);
			} else {
				const newFormattedTaskNoteContent = getFormattedTaskContentSync(modifiedTask);
				updateEmbeddableMarkdownEditor(newFormattedTaskNoteContent);
				setFormattedTaskContent(newFormattedTaskNoteContent);
				setIsEditorContentChanged(false);
			}
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
	const childTasksListRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!childTaskInputRef.current) return;

		const pendingTaskItems = getPendingTasksSuggestions(
			plugin
		);
		const suggestionContent = pendingTaskItems.filter(t => t.title !== title).map(t => t.title && t.title !== undefined ? t.title : ""); // Exclude self from suggestions
		const onSelectCallback = (choice: string) => {
			// Clear the input field after MultiSuggest has finished processing
			setTimeout(() => {
				if (childTaskInputRef.current) {
					childTaskInputRef.current.value = '';
				}
			}, 0);

			let selectedTask = pendingTaskItems.find(t => t.title === choice);
			if (!selectedTask) {
				bugReporterManagerInsatance.showNotice(23, "Selected task not found", `The selected task with title ${choice} was not found in pending tasks.`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect");
				return;
			}
			applyIdToTaskItem(plugin, selectedTask).then((newId) => {
				const getUpdatedDependsOnIds = (prev: string[]) => {
					if (!prev.includes(task.legacyId ? task.legacyId : task.id)) {
						if (newId === undefined && !selectedTask?.legacyId) {
							bugReporterManagerInsatance.showNotice(24, "Both newId and legacyId are undefined", `Both newId and legacyId are undefined for the selected task titled ${selectedTask.title}.`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect/getUpdatedDependsOnIds");
							return [...prev, String(plugin.settings.data.globalSettings.uniqueIdCounter)];
						} else if (newId === undefined) {
							return [...prev, selectedTask.legacyId];
						} else if (newId) {
							return [...prev, newId];
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
				bugReporterManagerInsatance.showNotice(25, "Error updating task in file", `An error occurred while updating the task in file: ${err.message}`, "AddOrEditTaskModal.tsx/EditTaskContent/childTaskInputRef useEffect");
			});
		};
		new MultiSuggest(childTaskInputRef.current, new Set(suggestionContent), onSelectCallback, plugin.app);

	}, [plugin.app]);

	const childTaskTitleRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	// This should run only on the first render to fetch child tasks based on dependsOn IDs
	useEffect(() => {
		if (childTasks.length === 0 && dependsOn.length > 0) {
			Promise.all(dependsOn.map(id => getTaskFromId(plugin, id)))
				.then(tasks => {
					const validTasks = tasks.filter(Boolean) as taskItem[];
					setChildTasks(validTasks);
				})
				.catch((err) => {
					bugReporterManagerInsatance.addToLogs(
						130,
						String(err),
						"AddOrEditTaskRC.tsx/fetching child-tasks useEffect",
					);
				});
		}
	}, []);

	// Render child task titles when childTasks changes
	useEffect(() => {
		childTasks.forEach((childTask, index) => {
			const element = childTaskTitleRefs.current[childTask.legacyId ? childTask.legacyId : childTask.id];
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

	const handleOpenChildTaskModal = async (event: React.MouseEvent, taskId: string) => {
		event.stopPropagation();
		const childTask = childTasks.find(t => t.legacyId === taskId);
		if (!childTask) {
			bugReporterManagerInsatance.showNotice(26, "Child task not found", `The child task with ID ${taskId} was not found in pending tasks.`, "AddOrEditTaskModal.tsx/EditTaskContent/handleOpenChildTaskModal");
			return;
		}

		// Will need to open the AddOrEditTaskModal modal for child task in a new window, until i come up with a better solution.
		// const leaf = plugin.app.workspace.getLeaf('window');
		// await leaf.setViewState({ type: 'empty', active: true });
		// // Clear existing children in the leaf
		// await leaf.open(new AddOrEditTaskModal(plugin, childTask, onSave, onClose, true, activeNote));

		const settingOption = plugin.settings.data.globalSettings.editButtonAction;
		switch (settingOption) {
			case EditButtonMode.NoteInSplit:
			case EditButtonMode.NoteInTab:
			case EditButtonMode.NoteInWindow:
				handleEditTask(plugin, task, settingOption);
				break;
			case EditButtonMode.NoteInHover:
				event.ctrlKey = true;
				markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
				event.ctrlKey = false;
				break;
			case EditButtonMode.Modal:
			case EditButtonMode.View:
			case EditButtonMode.TasksPluginModal:
			default:
				const isTaskNotePresent = isTaskNotePresentInTags(plugin.settings.data.globalSettings.taskNoteIdentifierTag, childTask.tags);
				openEditTaskView(plugin, isTaskNotePresent, false, true, childTask, childTask.filePath, "window");
				break;
		}

		// if (settingOption !== EditButtonMode.NoteInHover && settingOption !== EditButtonMode.Modal) {
		// 	handleEditTask(plugin, task, settingOption);
		// } else if (settingOption === EditButtonMode.Modal) {
		// 	//For now will simply open it in a new modal in a new window.
		// 	if (isTaskNotePresentInTags(plugin, childTask.tags)) {
		// 		// plugin.app.workspace.openPopoutLeaf(); // This is temporary solution for now. Later we can open it as a new tab in a new window.
		// 		// await sleep(50);
		// 		// openEditTaskNoteModal(plugin, childTask);

		// 		openEditTaskView(plugin, true, false, true, childTask, childTask.filePath, "window");
		// 	} else {
		// 		// plugin.app.workspace.openPopoutLeaf();
		// 		// await sleep(50);
		// 		// openEditTaskModal(plugin, childTask);

		// 		openEditTaskView(plugin, false, false, true, childTask, childTask.filePath, "window");
		// 	}
		// } else {
		// 	event.ctrlKey = true;
		// 	markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
		// 	event.ctrlKey = false;
		// }
	};

	const handleRemoveChildTask = (taskId: string) => {
		const newDependsOn = dependsOn.filter(id => id !== taskId);
		setDependsOn(newDependsOn);
		if (!isTaskNote) {
			const newTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, title, newDependsOn, cursorLocationRef.current ?? undefined);
			setTitle(newTitle);
		}
		setIsEdited(true);
		setIsEditorContentChanged(true);
	};

	// Initialize Sortable for child tasks reordering
	useEffect(() => {
		if (!childTasksListRef.current || dependsOn.length === 0) return;

		const sortable = Sortable.create(childTasksListRef.current, {
			animation: 150,
			handle: ".boardConfigModalColumnRowDragButton",
			ghostClass: "task-board-sortable-ghost",
			chosenClass: "task-board-sortable-chosen",
			dragClass: "task-board-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-board-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: (evt) => {
				try {
					console.log("Lets go...");
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					// Reorder the dependsOn array based on the drag and drop
					const updatedDependsOn = [...dependsOn];
					const [movedItem] = updatedDependsOn.splice(evt.oldIndex, 1);
					updatedDependsOn.splice(evt.newIndex, 0, movedItem);

					setDependsOn(updatedDependsOn);

					// Update the title with the new dependsOn order if not a task note
					if (!isTaskNote) {
						const newTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, title, updatedDependsOn, cursorLocationRef.current ?? undefined);
						setTitle(newTitle);
					}

					setIsEdited(true);
					setIsEditorContentChanged(true);
				} catch (error) {
					bugReporterManagerInsatance.showNotice(27, "Error in Sortable onSort for child tasks", error as string, "AddOrEditTaskRC.tsx/childTasksListRef useEffect");
				}
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [dependsOn, title, isTaskNote, plugin]);

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
								{/* <div className="EditTaskModalTabHeaderRightBtnSec">
									{taskExists && (
										<div className="EditTaskModalTabHeaderOpenMapBtn" onClick={handleOpenTaskInMapView} aria-placeholder={t("open-in-map-view")}>
											<Network height={17} />
										</div>
									)}
								</div> */}
							</div>
							<div className="EditTaskModalHomePreviewHeader">
								<div className="EditTaskModalHomePreviewHeaderFilenameLabel">
									<input
										type="text"
										disabled={taskExists || activeNote}
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
								{taskExists && (
									<div className="EditTaskModalHomePreviewHeaderBtnSec">
										<button className="EditTaskModalTabHeaderOpenMapBtn"
											onClick={handleOpenTaskInMapView}
											aria-label={t("open-in-map-view")}>
											<Network height={17} />
										</button>
										<button className="EditTaskModalHomeOpenFileBtn"
											id="EditTaskModalHomeOpenFileBtn"
											aria-label={t("hold-ctrl-button-to-open-in-new-window")}
											onClick={(event) => isCtrlPressed ? onOpenFilBtnClicked(event.nativeEvent, true) : onOpenFilBtnClicked(event.nativeEvent, false)}
										>
											<FileInput height={16} />
										</button>
									</div>
								)}
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
									placeholder={t("body-content")}
									style={{ display: activeTab === 'rawEditor' ? 'block' : 'none', width: '100%' }}
								/>
							</div>

							{/* Child Tasks */}
							<label className="EditTaskModalHomeFieldTitle">{t("child-tasks")}</label>
							<div className="EditTaskModalChildTasksContainer">
								<input
									type="text"
									ref={childTaskInputRef}
									className="EditTaskModalChildTaskInput"
									placeholder={t("child-tasks-section-description")}
									onChange={(e) => { e.preventDefault(); }}
								/>
								{/* Here I want to show all the depends on tasks */}
								<div className="EditTaskModalChildTasksList" ref={childTasksListRef}>
									{dependsOn.map((taskId) => (
										<div key={taskId} className="EditTaskModalChildTasksListItem">
											<div className="EditTaskModalChildTasksListItemFooter">
												<div className="EditTaskModalChildTasksListItemIdSec">
													<RxDragHandleHorizontal className="boardConfigModalColumnRowDragButton" size={15} enableBackground={0} />
													<div className="EditTaskModalChildTasksListItemIdLabel">Task Id : </div>
													<span className="EditTaskModalChildTasksListItemIdValue">{taskId}</span>
												</div>
												<div className="EditTaskModalChildTasksListItemFooterBtns">
													<button className="EditTaskModalChildTasksListItemEditBtn" onClick={(e) => handleOpenChildTaskModal(e, taskId)} aria-label="Edit Child Task"><EditIcon size={17} /></button>
													<button className="EditTaskModalChildTasksListItemDeleteBtn" onClick={() => handleRemoveChildTask(taskId)}><DeleteIcon size={20} /></button>
												</div>
											</div>
											<div className="EditTaskModalChildTasksListItemTitle" ref={(el) => { childTaskTitleRefs.current[taskId] = el; }}></div>
										</div>
									))}
								</div>
							</div>


							{/* Activity & Comments */}
							<label className="EditTaskModalHomeFieldTitle">{t("activity-and-comments")}</label>
							<div className="EditTaskModalActivityContainer">
								{t("coming-soon")}
							</div>
						</div>

						<div className="EditTaskModalHomeFooterBtnSec">
							<button className="EditTaskModalHomeSaveBtn" onClick={handleSave}>{t("save")}</button>
							<button className="EditTaskModalHomeToggleBtn" onClick={toggleRightSec} aria-label="Toggle Details">
								<PanelRightOpenIcon size={20} alignmentBaseline="middle" />
							</button>
						</div>
					</div>

					{/* Right Section for other task properties */}
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
							<div className="EditTaskModalHomeFieldTitleContainer">
								<label className="EditTaskModalHomeFieldTitle">{t("start-time")}</label>
								<FaTrash onClick={() => handleCompleteTimeChange("", "")} size={12} />
							</div>
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

						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("priority")}</label>
							<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => handlePriorityChange(parseInt(e.target.value))}>
								{getPriorityOptionsForDropdown().map((option) => (
									<option key={option.value} value={option.value}>{option.text}</option>
								))}
							</select>
						</div>

						{/* Tags input field */}
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
									const backgroundColor = tagColor ? updateRGBAOpacity(tagColor, 0.1) : `var(--tag-background)`;
									const borderColor = tagColor ? updateRGBAOpacity(tagColor, 0.5) : `var(--tag-color-hover)`;
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

						{/* On Completion property */}
						{/* <div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("on-completion")}</label>
							<select
								value={task?.onCompletion ?? 0}
								onChange={(e) =>
									handleOnCompletionChange(Number(e.target.value))
								}
								className="boardConfigModalColumnRowContentColDatedVal"
							>
								<option value={onCompletionOptions.NONE}>{t("none")}</option>
								<option value={onCompletionOptions.keep}>{t("keep")}</option>
								<option value={onCompletionOptions.delete}>{t("delete")}</option>
								<option value={onCompletionOptions.archive}>{t("archive")}</option>
							</select>
						</div> */}
					</div>
				</div>
			</div >
		</>
	);
};
