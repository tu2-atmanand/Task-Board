// /src/components/TaskEditorRC.tsx
// React component for adding or editing tasks, usable in both modals and views

import { Component, Keymap, Notice, Platform, TFile, UserEvent, debounce, normalizePath } from "obsidian";
import { FaTimes, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import { DeleteIcon, EditIcon, FileInput, Network, PanelRightOpenIcon, Plus } from "lucide-react";
import { ViewUpdate } from "@codemirror/view";
import { RxDragHandleHorizontal } from "react-icons/rx";
import TaskBoard from "../../../main.js";
import { statusTypeNames, UniversalDateOptions, EditButtonMode, PropertyTypeConfig } from "../../interfaces/Enums.js";
import { EMPTY_TASK_ITEM } from "../../interfaces/Mapping.js";
import {
	coerceCustomTaskPropertyValue,
	taskItem,
	taskItemWithCustomProperties,
	cursorLocationInterface,
} from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import { allowedFileExtensionsRegEx } from "../../utils/regular_expressions/MiscelleneousRegExpr.js";
import { CommunityPlugins } from "../../services/CommunityPlugins.js";
import { eventEmitter } from "../../services/EventEmitter.js";
import { EmbeddableMarkdownEditor, createEmbeddableMarkdownEditor } from "../../services/MarkdownEditor.js";
import { markdownButtonHoverPreviewEvent } from "../../services/MarkdownHoverPreview.js";
import { MarkdownUIRenderer } from "../../services/MarkdownUIRenderer.js";
import { getTagSuggestions, MultiSuggest, getQuickAddPluginChoices, getFileSuggestions, getPendingTasksSuggestions } from "../../services/MultiSuggest.js";
import { openEditTaskView } from "../modals/OpenModals.js";
import { compareTwoTags, verifySubtasksAndChildtasksAreComplete } from "../../core/algorithms/ScanningFilterer.js";
import { getObsidianIndentationSetting, isTaskLine } from "../../utils/CheckBoxUtils.js";
import { getPriorityOptionsForDropdown } from "../../utils/TaskItemUtils.js";
import { getFormattedTaskContentSync, cleanTaskTitleLegacy, sanitizeStatus, sanitizeCreatedDate, sanitizeStartDate, sanitizeScheduledDate, sanitizeDueDate, sanitizePriority, sanitizeTime, sanitizeTags, sanitizeDependsOn, sanitizeTaskProperty } from "../../utils/task_line/TaskContentFormatter.js";
import {
	formatDateStringAsPerSettings,
	formatDateTimeAsPerSettings,
	getCurrentLocalDateString,
	robustDateParser,
} from "../../utils/DateTimeCalculations.js";
import { formatTaskNoteContent, isTaskNotePresentInTags } from "../../utils/task_note/TaskNoteUtils.js";
import { updateRGBAOpacity } from "../../utils/UIHelpers.js";
import { handleEditTask } from "../../utils/UserTaskEvents.js";
import { t } from "../../utils/lang/helper.js";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal.js";
import { DatePickerModal } from "../modals/date_picker/DatePickerModal.js";
import { DateTimePickerModal } from "../modals/date_time_picker/DateTimePickerModal.js";
import { TimePickerModal, formatTimeForDisplay, is12HourTimeFormat } from "../modals/time_picker/index.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../interfaces/Enums.js";
import { SupportedPropertiesConfig } from "../../interfaces/GlobalSettings.js";
import { buildTaskFromRawContent } from "../../utils/task_line/PropertiesParsing.js";

/**
 * These task properites stored inside task cache by default will 
 * be handled using special input fields.
 */
const SPECIAL_DEFAULT_TASK_PROPERTIES = new Set([
	String(DEFAULT_TASK_CACHE_KEYS.ID),
	String(DEFAULT_TASK_CACHE_KEYS.LegacyID),
	String(DEFAULT_TASK_CACHE_KEYS.Title),
	String(DEFAULT_TASK_CACHE_KEYS.Body),
	String(DEFAULT_TASK_CACHE_KEYS.Status),
	String(DEFAULT_TASK_CACHE_KEYS.Priority),
	String(DEFAULT_TASK_CACHE_KEYS.Tags),
	String(DEFAULT_TASK_CACHE_KEYS.FrontMatterTags),
	String(DEFAULT_TASK_CACHE_KEYS.Time),
	String(DEFAULT_TASK_CACHE_KEYS.Dependencies),
	String(DEFAULT_TASK_CACHE_KEYS.FilePath),
	String(DEFAULT_TASK_CACHE_KEYS.TaskLocation)
]);

/**
 * Properties rendered through the generic property list (all default properties
 * not handled by a dedicated field plus every custom property).
 */
const isGenericTaskProperty = (property: SupportedPropertiesConfig): boolean =>
	Boolean(property.key) &&
	!SPECIAL_DEFAULT_TASK_PROPERTIES.has(property.key);

export interface filterOptions {
	value: string;
	text: string;
}

// Functional React component for adding or editing tasks
export const TaskEditorRC: React.FC<{
	plugin: TaskBoard,
	root: HTMLElement,
	activeNote: boolean,
	filePath: string;
	isTaskNote: boolean;
	noteContent: string;
	task?: taskItem,
	taskExists?: boolean,
	inboxView?: boolean,
	onSave: (updatedTask: taskItem, quickAddPluginChoice: string, updatedNoteContent?: string) => Promise<void>;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}> = ({ plugin, root, isTaskNote, noteContent, task = EMPTY_TASK_ITEM, taskExists, inboxView = false, activeNote, filePath, onSave, onClose, setIsEdited: reportEdited }) => {
	const globalSettings = plugin.settings.data;
	const taskWithCustomProperties =
		task as taskItemWithCustomProperties;
	// ------------ Date / date-time picker helpers ------------
	/** Returns the calendar part of a value, regardless of the separator used. */
	const getPickerDatePart = (value: string): string => {
		const timeSeparatorIndex = value.search(/T|\s\d{1,2}:\d{2}/);
		return timeSeparatorIndex >= 0
			? value.slice(0, timeSeparatorIndex)
			: value;
	};

	/** Returns the first time (HH:mm) found in a value, if any. */
	const getPickerTimePart = (value: string): string =>
		value.match(/\d{1,2}:\d{2}/)?.[0] ?? "";

	/** Normalizes any accepted date representation to `yyyy-MM-dd`. */
	const toPickerDate = (value: string): string => {
		if (!value) return "";
		const datePart = getPickerDatePart(value);
		const parsed = robustDateParser(datePart, globalSettings.dateFormat);
		return parsed ? formatDateStringAsPerSettings(parsed, "yyyy-MM-dd") : "";
	};

	/** Normalizes any accepted date-time representation to `yyyy-MM-ddTHH:mm`. */
	const toPickerDateTime = (value: string): string => {
		if (!value) return "";
		const date = toPickerDate(value);
		const time = getPickerTimePart(value);
		return date ? (time ? `${date}T${time}` : date) : "";
	};

	const openDatePicker = (
		propertyName: string,
		currentValue: string,
		onSelect: (value: string) => void,
	) => {
		const modal = new DatePickerModal(
			plugin,
			propertyName,
			toPickerDate(currentValue),
		);
		modal.onDateSelected = (date) => onSelect(toPickerDate(date));
		modal.open();
	};

	const openDateTimePicker = (
		propertyName: string,
		currentValue: string,
		onSelect: (value: string) => void,
	) => {
		const modal = new DateTimePickerModal(
			plugin,
			propertyName,
			toPickerDateTime(currentValue),
		);
		modal.onDateTimeSelected = (dateTime) =>
			onSelect(toPickerDateTime(dateTime));
		modal.open();
	};

	const use24HourTime = !is12HourTimeFormat(globalSettings.dateTimeFormat);
	const formatTimeValue = (value: string): string =>
		formatTimeForDisplay(value || null, use24HourTime);

	const openTimePicker = (
		propertyName: string,
		currentValue: string,
		onSelect: (value: string) => void,
	) => {
		const modal = new TimePickerModal(
			plugin,
			propertyName,
			currentValue,
			use24HourTime,
		);
		modal.onTimeSelected = onSelect;
		modal.open();
	};

	// Special Default Task Properties
	const [title, setTitle] = useState(
		task[DEFAULT_TASK_CACHE_KEYS.Title]
			? task[DEFAULT_TASK_CACHE_KEYS.Title]
			: isTaskNote ? "" : "- [ ] "
	);
	const [bodyContent, setBodyContent] = useState(isTaskNote ? noteContent : task[DEFAULT_TASK_CACHE_KEYS.Body]?.join('\n') || '');
	const [priority, setPriority] = useState(task[DEFAULT_TASK_CACHE_KEYS.Priority] || 0);
	const [status, setStatus] = useState(task[DEFAULT_TASK_CACHE_KEYS.Status] || ' ');
	const [dependsOn, setDependsOn] = useState<string[]>(task?.[DEFAULT_TASK_CACHE_KEYS.Dependencies] || []);
	const [startTime, setStartTime] = useState(task[DEFAULT_TASK_CACHE_KEYS.Time] ? task?.[DEFAULT_TASK_CACHE_KEYS.Time]?.split('-')[0]?.trim() || '' : "");
	const [endTime, setEndTime] = useState(task[DEFAULT_TASK_CACHE_KEYS.Time] ? task?.[DEFAULT_TASK_CACHE_KEYS.Time]?.split('-')[1]?.trim() || '' : "");
	const [newTime, setNewTime] = useState(task[DEFAULT_TASK_CACHE_KEYS.Time] || '');

	const [tags, setTags] = useState<string[]>(task[DEFAULT_TASK_CACHE_KEYS.Tags] || []);
	const [customPropertyValues, setCustomPropertyValues] = useState<Record<string, unknown>>(() =>
		Object.fromEntries(globalSettings.taskProperties.filter(isGenericTaskProperty).map((property) => [
			property.id,
			taskWithCustomProperties[property.key] !== undefined
				? taskWithCustomProperties[property.key]
				: coerceCustomTaskPropertyValue(
					property.defaultValue,
					property.type,
					property.type === PropertyTypeConfig.date
						? globalSettings.dateFormat
						: globalSettings.dateTimeFormat,
					globalSettings.dateFormat,
				),
		])));
	const getGenericPropertyValuesByKey = () =>
		Object.fromEntries(
			globalSettings.taskProperties
				.filter(isGenericTaskProperty)
				.map((property) => [
					property.key,
					customPropertyValues[property.id],
				]),
		);

	const getGenericProperty = (key: string) =>
		globalSettings.taskProperties.find((property) => property.key === key);

	/** String representation of a generic property, used by auto-add checks. */
	const getGenericPropertyString = (key: string): string => {
		const property = getGenericProperty(key);
		if (!property) return "";
		const value = customPropertyValues[property.id];
		if (value === undefined || value === null || value === "") return "";
		if (typeof value === "number") {
			return property.type === PropertyTypeConfig.date
				? formatDateStringAsPerSettings(value, globalSettings.dateFormat)
				: formatDateTimeAsPerSettings(value, globalSettings.dateTimeFormat);
		}
		return String(value);
	};

	const coerceGenericPropertyValue = (key: string, value: unknown) => {
		const property = getGenericProperty(key);
		if (!property) return undefined;
		return coerceCustomTaskPropertyValue(
			value,
			property.type,
			property.type === PropertyTypeConfig.date
				? globalSettings.dateFormat
				: globalSettings.dateTimeFormat,
			globalSettings.dateFormat,
		);
	};

	const [childTasks, setChildTasks] = useState<taskItem[]>([]);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	const setIsEdited = (value: boolean) => {
		setHasUnsavedChanges(value);
		reportEdited(value);
	};

	const [formattedTaskContent, setFormattedTaskContent] = useState<string>(isTaskNote ? noteContent : getFormattedTaskContentSync(task));
	const frontmatterContentRef = useRef<string>('');
	const [newFilePath, setNewFilePath] = useState<string>(filePath);
	const [quickAddPluginChoice, setQuickAddPluginChoice] = useState<string>(globalSettings.quickAddPluginDefaultChoice || '');

	const [markdownEditor, setMarkdownEditor] = useState<EmbeddableMarkdownEditor | null>(null);
	const [isEditorContentChanged, setIsEditorContentChanged] = useState<boolean>(true);
	const cursorLocationRef = useRef<cursorLocationInterface | null>(null);

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
			activeDocument.addEventListener("mousedown", handleClickOutside);
		} else {
			activeDocument.removeEventListener("mousedown", handleClickOutside);
		}
		return () => activeDocument.removeEventListener("mousedown", handleClickOutside);
	}, [isRightSecVisible]);

	// Load statuses dynamically
	let filteredStatusesDropdown: filterOptions[] = [];

	// Fetch all the custom statuses and add them to the dropdown
	if (plugin.settings.data.customStatuses?.length > 0) {
		filteredStatusesDropdown = plugin.settings.data.customStatuses.map((customStatus) => ({
			value: customStatus.symbol,
			text: `${customStatus.name} [${customStatus.symbol}]`,
		}));
	} else {
		bugReporterManagerInsatance.addToLogs(
			129,
			`customStatuses are empty in the settings.`,
			"TaskEditorRC.tsx",
		);
	}

	// ------------ Handle task property values changes ------------
	const titleComponentRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (isTaskNote) return;

		const cleanedTaskTitle = cleanTaskTitleLegacy(
			modifiedTask,
			globalSettings.usePipeToSeparateProperties,
			globalSettings,
		);
		// setFormattedTaskContent(cleanedTaskTitle);
		if (titleComponentRef.current && cleanedTaskTitle !== "") {
			// Clear previous content before rendering new markdown
			titleComponentRef.current.empty();

			void MarkdownUIRenderer.strictRender(
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

	const handleStatusChange = async (symbol: string) => {
		const statusConfig =
			globalSettings.customStatuses.find(
				(status) => status.symbol === symbol
			);
		const statusType = statusConfig ? statusConfig.type : statusTypeNames.TODO;

		if (statusType === statusTypeNames.DONE) {
			const allowed = await verifySubtasksAndChildtasksAreComplete(plugin, task);

			if (!allowed) {
				new Notice(t("verifySubtasksAndChildtasksAreComplete-false-message"));
				return;
			}
		}

		setStatus(symbol);

		// if (statusType === statusTypeNames.DONE) {
		// 	const globalSettings = plugin.settings.data.globalSettings;
		// 	const moment = _moment as unknown as typeof _moment.default;
		// 	const currentDateValue = moment().format(
		// 		globalSettings?.dateTimeFormat
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
		// 		globalSettings?.dateTimeFormat
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

		if (!isTaskNote) {
			const newTitle = sanitizeStatus(globalSettings, title, symbol, statusType);
			setTitle(newTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	}

	const handlePriorityChange = (value: number) => {
		setPriority(value);

		if (!isTaskNote) {
			const newTitle = sanitizePriority(plugin.settings.data, title, value, cursorLocationRef.current ?? undefined);
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
			const newTitle = sanitizeTime(plugin.settings.data, title, newTime, cursorLocationRef.current ?? undefined);
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
				const newTitle = sanitizeTags(title, newTagsList, cursorLocationRef.current ?? undefined);
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
				const newTitle = sanitizeTags(currentTitle, newTagsList, cursorLocationRef.current ?? undefined);
				setTitle(newTitle);
			}

			if (!currentTags.includes(choice)) {
				setTags(prevTags => [...prevTags, choice]);
			}
			setIsEdited(true);
			setIsEditorContentChanged(true);

			// Clear the input field after MultiSuggest has finished processing
			window.setTimeout(() => {
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
			const newTitle = sanitizeTags(title, newTags, cursorLocationRef.current ?? undefined);
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
	const handleSave = async () => {
		try {
			if (isTaskNote) {
				await handleSaveAsTaskNote();
			} else {
				await handleSaveAsTaskLine();
			}
		} catch (error) {
			new Notice(`Unable to save task: ${String(error)}`);
		}
	};

	const handleCustomPropertyChange = (id: string, value: unknown, type: PropertyTypeConfig) => {
		const property = globalSettings.taskProperties.find(
			(candidate) => candidate.id === id,
		);
		const coercedValue = value === ""
			? ""
			: coerceCustomTaskPropertyValue(
				value,
				type,
				type === PropertyTypeConfig.date
					? globalSettings.dateFormat
					: globalSettings.dateTimeFormat,
				globalSettings.dateFormat,
			);

		setCustomPropertyValues((previous) => ({
			...previous,
			[id]: coercedValue,
		}));

		if (!isTaskNote && property?.key) {
			const sanitizedTitle = sanitizeTaskProperty(
				globalSettings,
				title,
				property.key,
				coercedValue,
				cursorLocationRef.current ?? undefined,
			);
			setTitle(sanitizedTitle);
		}

		setIsEdited(true);
		setIsEditorContentChanged(true);
	};

	const withCustomInlineProperties = (rawTitle: string): string => {
		let result = rawTitle;
		for (const property of globalSettings.taskProperties.filter(isGenericTaskProperty)) {
			if (!property.key) continue;
			result = sanitizeTaskProperty(
				globalSettings,
				result,
				property.key,
				customPropertyValues[property.id],
			);
		}
		return result;
	};

	const getAutoAddedDate = (universalDateKey: string): string => {
		if (!plugin.settings.data.autoAddUniversalDate || taskExists) return "";
		if (getGenericPropertyString(universalDateKey)) return "";
		const universalDateType = plugin.settings.data.universalDate;
		if (universalDateType === universalDateKey) {
			return getCurrentLocalDateString(globalSettings.dateFormat);
		}
		return "";
	};

	const getAutoAddedDateValues = (): Record<string, unknown> => {
		const values: Record<string, unknown> = {};
		const keys = [
			DEFAULT_TASK_CACHE_KEYS.DueDate,
			DEFAULT_TASK_CACHE_KEYS.StartDate,
			DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
		];
		for (const key of keys) {
			const date = getAutoAddedDate(String(key));
			if (date) values[String(key)] = coerceGenericPropertyValue(String(key), date);
		}
		if (globalSettings.autoAddCreatedDate && !taskExists) {
			const date = getCurrentLocalDateString(globalSettings.dateFormat);
			values[String(DEFAULT_TASK_CACHE_KEYS.CreatedDate)] = coerceGenericPropertyValue(
				String(DEFAULT_TASK_CACHE_KEYS.CreatedDate),
				date,
			);
		}
		return values;
	};

	const handleSaveAsTaskLine = async () => {
		let newTitle = title;

		const autoDueDate = getAutoAddedDate(String(DEFAULT_TASK_CACHE_KEYS.DueDate));
		const autoStartDate = getAutoAddedDate(String(DEFAULT_TASK_CACHE_KEYS.StartDate));
		const autoScheduledDate = getAutoAddedDate(String(DEFAULT_TASK_CACHE_KEYS.ScheduledDate));
		if (autoDueDate) newTitle = sanitizeDueDate(globalSettings, newTitle, autoDueDate);
		if (autoStartDate) newTitle = sanitizeStartDate(globalSettings, newTitle, autoStartDate);
		if (autoScheduledDate) newTitle = sanitizeScheduledDate(globalSettings, newTitle, autoScheduledDate);

		if (globalSettings.autoAddCreatedDate && !taskExists) {
			const autoCreatedDate = getCurrentLocalDateString(globalSettings.dateFormat);
			newTitle = sanitizeCreatedDate(globalSettings, newTitle, autoCreatedDate);
		}

		let editedFilePath = allowedFileExtensionsRegEx.test(newFilePath) ? newFilePath : `${newFilePath}.md`;
		editedFilePath = normalizePath(editedFilePath);

		const updatedTask = {
			...task,
			title: withCustomInlineProperties(newTitle),
			body: [
				...bodyContent.split('\n'),
			],
			tags,
			time: newTime,
			priority,
			filePath: editedFilePath,
			taskLocation: task[DEFAULT_TASK_CACHE_KEYS.TaskLocation],
			status,
			...getGenericPropertyValuesByKey(),
			...getAutoAddedDateValues(),
		};

		await onSave(updatedTask, quickAddPluginChoice);
		setIsEdited(false);
		// onClose();
	}

	// Function to handle saving as task note
	const handleSaveAsTaskNote = async () => {
		// Determine file path for task note
		let taskNoteFilePath = allowedFileExtensionsRegEx.test(newFilePath) ? newFilePath : `${newFilePath}.md`;
		taskNoteFilePath = normalizePath(taskNoteFilePath);

		const taskNoteItem: taskItem = {
			...modifiedTask,
			...getAutoAddedDateValues(),
			title: title === "" ? taskNoteFilePath.split('/').pop() ?? "No title" : title,
			body: formattedTaskContent ? formattedTaskContent.split('\n').filter(line => isTaskLine(line)) : [],
			tags: [...tags, '#taskNote'], // Add taskNote tag
			time: newTime,
			priority: modifiedTask[DEFAULT_TASK_CACHE_KEYS.Priority],
			filePath: taskNoteFilePath,
			taskLocation: modifiedTask[DEFAULT_TASK_CACHE_KEYS.TaskLocation],
			status: modifiedTask[DEFAULT_TASK_CACHE_KEYS.Status],
			dependsOn: dependsOn,
		};

		const newFormattedNoteContent = formatTaskNoteContent(plugin, taskNoteItem, formattedTaskContent);

		// Call onSave with the task note item
		await onSave(taskNoteItem, quickAddPluginChoice, newFormattedNoteContent.newContent ? newFormattedNoteContent.newContent : undefined);
		setIsEdited(false);
	};

	let modifiedTask: taskItem = {
		...task,
		title: title,
		body: [
			...bodyContent.split('\n'),
		],
		tags: tags,
		time: newTime,
		priority: priority,
		filePath: newFilePath,
		status: status,
		taskLocation: task?.[DEFAULT_TASK_CACHE_KEYS.TaskLocation] || EMPTY_TASK_ITEM[DEFAULT_TASK_CACHE_KEYS.TaskLocation],
		dependsOn: dependsOn,
		...getGenericPropertyValuesByKey(),
		completionDate: task[DEFAULT_TASK_CACHE_KEYS.CompletionDate],
		cancelledDate: task[DEFAULT_TASK_CACHE_KEYS.CancelledDate],
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

	const handleOpenTaskInMapView = async () => {
		// if (!globalSettings.experimentalFeatures) {
		// 	new Notice(t("enable-experimental-features-message"));
		// 	return;
		// }

		await plugin.vaultScanner.applyIdToTaskItem(task).then((newId) => {
			plugin.settings.data.lastViewHistory.taskId = newId ? String(newId) : (task[DEFAULT_TASK_CACHE_KEYS.LegacyID] ? task[DEFAULT_TASK_CACHE_KEYS.LegacyID] : String(globalSettings.uniqueIdCounter));

			// console.log("Preparing to open task in kanban view. Current file path:", newFilePath, "\nTask ID:", task.id, "\nLegacy ID:", task.legacyId, "\nnewId:", newId);

			plugin.realTimeScanner.processAllUpdatedFiles(filePath).then(() => {
				onClose();
				window.setTimeout(() => {
					eventEmitter.emit("SWITCH_VIEW", 'first-map');
				}, 1000)
			}).catch((error) => {
				bugReporterManagerInsatance.addToLogs(
					217,
					String(error),
					"TaskEditorRC.tss/handleOpenTaskInMapView",
				);
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
		if (!Platform.isMobile && !isTaskNote) {
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
				await leaf.openFile(file, { eState: { line: task[DEFAULT_TASK_CACHE_KEYS.TaskLocation]?.startLine ?? 1 - 1 } });
			} else {
				bugReporterManagerInsatance.showNotice(21, "File not found", `The file at path ${newFilePath} could not be found.`, "TaskEditorModal.tsx/EditTaskContent/onOpenFilBtnClicked");
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
				await leaf.openFile(file, { eState: { line: task[DEFAULT_TASK_CACHE_KEYS.TaskLocation]?.startLine ?? 1 - 1 } });
			} else {
				// bugReporterManagerInsatance.showNotice(22, "File not found", `The file at path ${newFilePath} could not be found.`, "TaskEditorModal.tsx/EditTaskContent/onOpenFilBtnClicked");
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
		componentRef.current = null; // @todo - Assign the current Modal parent as component to maintain its lifecycle.
	}, []);

	// TODO : This function should be optimized to avoid excessive parsing on every keystroke.
	const handleTaskEditedThroughEditors = debounce((value: string) => {
		if (isTaskNote) return;

		const updatedTask = buildTaskFromRawContent(value, indentationString, undefined, globalSettings);

		setTitle(updatedTask[DEFAULT_TASK_CACHE_KEYS.Title] || '');
		setBodyContent(updatedTask[DEFAULT_TASK_CACHE_KEYS.Body]?.join('\n') || '');
		setTags(updatedTask[DEFAULT_TASK_CACHE_KEYS.Tags] || []);
		setStartTime(updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] ? updatedTask[DEFAULT_TASK_CACHE_KEYS.Time]?.split('-')[0].trim() || '' : "");
		setEndTime(updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] ? updatedTask[DEFAULT_TASK_CACHE_KEYS.Time]?.split('-')[1]?.trim() || '' : "");
		setNewTime(updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] ? updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] : "");
		setPriority(updatedTask[DEFAULT_TASK_CACHE_KEYS.Priority] || 0);
		setStatus(updatedTask[DEFAULT_TASK_CACHE_KEYS.Status] || ' ');
		setCustomPropertyValues(Object.fromEntries(globalSettings.taskProperties.filter(isGenericTaskProperty).map((property) => [property.id, updatedTask[property.key]])));
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
						cls: "TaskEditorModal-markdown-editor-embed",
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
				const { newContent, newFrontmatter } = formatTaskNoteContent(plugin, modifiedTask, formattedTaskContent);
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

	const childTasksListRef = useRef<HTMLDivElement>(null);

	const handleOpenChildTaskSelector = async (): Promise<void> => {
		try {

			const handleOnChooseTask = async (selected: taskItem | null) => {
				if (!selected) return;

				const newId = await plugin.vaultScanner.applyIdToTaskItem(selected);

				if (newId) {
					await plugin.realTimeScanner.processAllUpdatedFiles(selected[DEFAULT_TASK_CACHE_KEYS.FilePath], selected[DEFAULT_TASK_CACHE_KEYS.ID]);

					const getUpdatedDependsOnIds = (prev: string[]) => {
						if (!prev.includes(task[DEFAULT_TASK_CACHE_KEYS.LegacyID] ? task[DEFAULT_TASK_CACHE_KEYS.LegacyID] : task[DEFAULT_TASK_CACHE_KEYS.ID])) {
							if (newId === undefined && !selected?.[DEFAULT_TASK_CACHE_KEYS.LegacyID]) {
								bugReporterManagerInsatance.showNotice(24, "Both newId and legacyId are undefined", `Both newId and legacyId are undefined for the selected task titled ${selected[DEFAULT_TASK_CACHE_KEYS.Title]}.`, "AddOrEditTaskModal.tsx/handleOpenChildTaskSelector/getUpdatedDependsOnIds");
								return [...prev, String(globalSettings.uniqueIdCounter)];
							} else if (newId === undefined) {
								return [...prev, selected[DEFAULT_TASK_CACHE_KEYS.LegacyID]];
							} else if (newId) {
								return [...prev, newId];
							}
						}
						return prev;
					};

					setDependsOn(prev => {
						const updated = getUpdatedDependsOnIds(prev);
						if (!isTaskNote) {
							const newTitle = sanitizeDependsOn(plugin.settings.data, title, updated, cursorLocationRef.current ?? undefined);
							setTitle(newTitle);
						}

						selected[DEFAULT_TASK_CACHE_KEYS.LegacyID] = selected[DEFAULT_TASK_CACHE_KEYS.LegacyID] ? selected[DEFAULT_TASK_CACHE_KEYS.LegacyID] : (newId ? String(newId) : String(globalSettings.uniqueIdCounter));
						setChildTasks(prevChildTasks => {
							if (!prevChildTasks.find(t => t[DEFAULT_TASK_CACHE_KEYS.ID] === selected[DEFAULT_TASK_CACHE_KEYS.ID])) {
								return [...prevChildTasks, selected];
							}
							return prevChildTasks;
						});

						setIsEdited(true);
						setIsEditorContentChanged(true);
						return updated;
					});
				}

				// .catch(err => {
				// 	bugReporterManagerInsatance.showNotice(25, "Error updating task in file", `An error occurred while updating the task in file: ${err.message}`, "AddOrEditTaskModal.tsx/handleOpenChildTaskSelector");
				// });
			}

			let pendingTaskItems = getPendingTasksSuggestions(plugin).filter(t => t[DEFAULT_TASK_CACHE_KEYS.ID] !== task[DEFAULT_TASK_CACHE_KEYS.ID]);
			pendingTaskItems = pendingTaskItems.filter((t) => !dependsOn.includes(t[DEFAULT_TASK_CACHE_KEYS.LegacyID]));
			openTaskSelector(plugin, pendingTaskItems, (selected) => {
				void handleOnChooseTask(selected);
			}, {
				placeholder: t("search-child-task"),
				title: t("select-child-task")
			});
		} catch (err) {
			console.error(err);
		}
	};

	const childTaskTitleRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	// This should run only on the first render to fetch child tasks based on dependsOn IDs
	useEffect(() => {
		if (childTasks.length === 0 && dependsOn.length > 0) {
			Promise.all(dependsOn.map(id => plugin.vaultScanner.getTaskFromID(id)))
				.then(tasks => {
					const validTasks = tasks.filter(Boolean) as taskItem[];
					setChildTasks(validTasks);
				})
				.catch((err) => {
					bugReporterManagerInsatance.addToLogs(
						130,
						String(err),
						"TaskEditorRC.tsx/fetching child-tasks useEffect",
					);
				});
		}
	}, []);

	// Render child task titles when childTasks changes
	useEffect(() => {
		childTasks.forEach((childTask, index) => {
			const element = childTaskTitleRefs.current[childTask[DEFAULT_TASK_CACHE_KEYS.LegacyID] ? childTask[DEFAULT_TASK_CACHE_KEYS.LegacyID] : childTask[DEFAULT_TASK_CACHE_KEYS.ID]];
			if (!element) return;

			const childTaskTitle = childTask[DEFAULT_TASK_CACHE_KEYS.Title];
			void MarkdownUIRenderer.safeRender(
				plugin.app,
				childTaskTitle,
				element,
				task[DEFAULT_TASK_CACHE_KEYS.FilePath],
				componentRef.current
			);
		});
	}, [childTasks]);

	const handleOpenChildTaskModal = async (event: React.MouseEvent, taskId: string) => {
		event.stopPropagation();
		const childTask = childTasks.find(t => t[DEFAULT_TASK_CACHE_KEYS.LegacyID] === taskId);
		if (!childTask) {
			bugReporterManagerInsatance.showNotice(26, "Child task not found", `The child task with ID ${taskId} was not found in pending tasks.`, "TaskEditorModal.tsx/EditTaskContent/handleOpenChildTaskModal");
			return;
		}

		// Will need to open the TaskEditorModal modal for child task in a new window, until i come up with a better solution.
		// const leaf = plugin.app.workspace.getLeaf('window');
		// await leaf.setViewState({ type: 'empty', active: true });
		// // Clear existing children in the leaf
		// await leaf.open(new TaskEditorModal(plugin, childTask, onSave, onClose, true, activeNote));

		const settingOption = globalSettings.editButtonAction;
		switch (settingOption) {
			case EditButtonMode.NoteInSplit:
			case EditButtonMode.NoteInTab:
			case EditButtonMode.NoteInWindow:
				handleEditTask(plugin, task, settingOption);
				break;
			case EditButtonMode.NoteInHover:
				event.ctrlKey = true;
				markdownButtonHoverPreviewEvent(plugin.app, event, task[DEFAULT_TASK_CACHE_KEYS.FilePath]);
				event.ctrlKey = false;
				break;
			case EditButtonMode.Modal:
			case EditButtonMode.ViewInWindow:
			case EditButtonMode.TasksPluginModal:
			default:
				{
					const isTaskNotePresent = isTaskNotePresentInTags(globalSettings.taskNoteIdentifierTag, childTask[DEFAULT_TASK_CACHE_KEYS.Tags] ?? []);
					void openEditTaskView(plugin, isTaskNotePresent, false, true, childTask, childTask[DEFAULT_TASK_CACHE_KEYS.FilePath], "window");
					break;
				}
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
		setChildTasks(prevChildTasks => {
			const newChildTasks = prevChildTasks.filter((t) => t[DEFAULT_TASK_CACHE_KEYS.ID] !== taskId)
			return newChildTasks;
		});
		if (!isTaskNote) {
			const newTitle = sanitizeDependsOn(plugin.settings.data, title, newDependsOn, cursorLocationRef.current ?? undefined);
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
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					// Reorder the dependsOn array based on the drag and drop
					const updatedDependsOn = [...dependsOn];
					const [movedItem] = updatedDependsOn.splice(evt.oldIndex, 1);
					updatedDependsOn.splice(evt.newIndex, 0, movedItem);

					setDependsOn(updatedDependsOn);

					// Update the title with the new dependsOn order if not a task note
					if (!isTaskNote) {
						const newTitle = sanitizeDependsOn(plugin.settings.data, title, updatedDependsOn, cursorLocationRef.current ?? undefined);
						setTitle(newTitle);
					}

					setIsEdited(true);
					setIsEditorContentChanged(true);
				} catch (error) {
					bugReporterManagerInsatance.showNotice(27, "Error in Sortable onSort for child tasks", error as string, "TaskEditorRC.tsx/childTasksListRef useEffect");
				}
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [dependsOn, title, isTaskNote, plugin]);

	/**
	 * Date/date-time properties are shown as a clickable value instead of an
	 * input. Clicking the value (or the add icon shown for empty values) opens
	 * the matching Obsidian picker modal.
	 */
	const renderPickerField = (
		key: string,
		label: string,
		displayValue: string,
		onOpenPicker: () => void,
		onClear?: () => void,
	) => (
		<div className="EditTaskModalHomeField" key={key}>
			<div className="TaskEditorModalHomeFieldLabelContainer">
				<label className="EditTaskModalHomeFieldTitle">{label}</label>
				{!displayValue && (
					<Plus
						className="EditTaskModalHomeFieldAddIcon"
						size={14}
						role="button"
						tabIndex={0}
						aria-label={`${label} - add`}
						onClick={onOpenPicker}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onOpenPicker();
							}
						}}
					/>
				)}
				{displayValue && onClear && (
					<FaTrash
						size={12}
						role="button"
						tabIndex={0}
						aria-label={`${label} - clear`}
						onClick={onClear}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onClear();
							}
						}}
					/>
				)}
			</div>
			{displayValue && (
				<div
					className="EditTaskModalHomePickerValue"
					role="button"
					tabIndex={0}
					title={label}
					onClick={onOpenPicker}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							onOpenPicker();
						}
					}}
				>
					{displayValue}
				</div>
			)}
		</div>
	);

	// ------------------ Rendering the component ------------------

	return (
		<>
			<div className="EditTaskModalHome">
				<div className="EditTaskModalHomeBody">
					<div className="EditTaskModalHomeLeftSec">
						{inboxView && hasUnsavedChanges && (
							<button
								type="button"
								className="EditTaskModalInboxSaveBtn"
								onClick={() => void handleSave()}
								aria-label={t("save")}
							>
								{t("save")}
							</button>
						)}
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
									autoFocus={taskExists ? false : true}
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
											onClick={() => { void handleOpenTaskInMapView(); }}
											aria-label={t("open-in-map-view")}>
											<Network height={17} />
										</button>
										<button className="EditTaskModalHomeOpenFileBtn"
											id="EditTaskModalHomeOpenFileBtn"
											aria-label={t("hold-ctrl-button-to-open-in-new-window")}
											onClick={(event) => isCtrlPressed ? void onOpenFilBtnClicked(event.nativeEvent, true) : void onOpenFilBtnClicked(event.nativeEvent, false)}
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
							<div className="EditTaskModalChildTaskHeader">
								<label className="EditTaskModalHomeFieldTitle">{t("child-tasks")}</label>
								<div
									className="EditTaskModalChildTaskAddBtn"
									onClick={() => { void handleOpenChildTaskSelector(); }}
									aria-label={t("child-tasks-section-description")}
								>
									{t("add-child-task")}
								</div>
							</div>
							<div className="EditTaskModalChildTasksContainer">
								{/* All child tasks in list view */}
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
													{!Platform.isMobileApp && (
														<button className="EditTaskModalChildTasksListItemEditBtn" onClick={(e) => void handleOpenChildTaskModal(e, taskId)} aria-label="Edit Child Task"><EditIcon size={17} /></button>
													)}
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
							{!inboxView && (
								<button className="EditTaskModalHomeSaveBtn" onClick={() => void handleSave()}>{t("save")}</button>
							)}
							<button className="EditTaskModalHomeToggleBtn" onClick={toggleRightSec} aria-label="Toggle Details">
								<PanelRightOpenIcon size={25} alignmentBaseline="middle" />
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
							<select className="EditTaskModalHome-taskStatusValue" value={status} onChange={(e) => void handleStatusChange(e.target.value)}>
								{filteredStatusesDropdown.map((option) => (
									<option key={`${option.value}-${Math.floor(1000 + Math.random() * 9000)}`} value={option.value}>{option.text}</option>
								))}
							</select>
						</div>

						{/* Task Priority */}
						<div className="EditTaskModalHomeField">
							<label className="EditTaskModalHomeFieldTitle">{t("priority")}</label>
							<select className="EditTaskModalHome-priorityValue" value={priority} onChange={(e) => handlePriorityChange(parseInt(e.target.value))}>
								{getPriorityOptionsForDropdown(globalSettings.customPriorities).map((option) => (
									<option key={option.value} value={option.value}>{option.text}</option>
								))}
							</select>
						</div>

						{/* Task Time Input */}
						{renderPickerField(
							"start-time",
							t("start-time"),
							formatTimeValue(startTime),
							() => openTimePicker(
								t("start-time"),
								startTime,
								handleStartTimeChange,
							),
							() => handleCompleteTimeChange("", ""),
						)}
						{renderPickerField(
							"end-time",
							t("end-time"),
							formatTimeValue(endTime),
							() => openTimePicker(
								t("end-time"),
								endTime,
								handleEndTimeChange,
							),
						)}

						{/* Remaining default properties and custom properties */}
						{globalSettings.taskProperties.filter(isGenericTaskProperty).map((property) => {
							const value = customPropertyValues[property.id];
							const isDateProperty = property.type === PropertyTypeConfig.date;
							const isDateTimeProperty = property.type === PropertyTypeConfig.dateTime;
							const displayValue = Array.isArray(value)
								? value.join(", ")
								: value === undefined || value === null
									? ""
									: typeof value === "number" && isDateProperty
										? formatDateStringAsPerSettings(value, "yyyy-MM-dd")
										: typeof value === "number" && isDateTimeProperty
											? formatDateTimeAsPerSettings(value, "yyyy-MM-dd'T'HH:mm")
											: String(value);

							if (isDateProperty || isDateTimeProperty) {
								const onSelect = (next: string) =>
									handleCustomPropertyChange(property.id, next, property.type);
								const getPickerInitialValue = (): string => {
									if (displayValue) return displayValue;
									if (property.key === String(DEFAULT_TASK_CACHE_KEYS.Reminder)) {
										const dateToUse =
											getGenericPropertyString(String(DEFAULT_TASK_CACHE_KEYS.StartDate)) ||
											getGenericPropertyString(String(DEFAULT_TASK_CACHE_KEYS.ScheduledDate)) ||
											getGenericPropertyString(String(DEFAULT_TASK_CACHE_KEYS.DueDate));
										const timeToUse = startTime || "09:00";
										return dateToUse ? `${dateToUse}T${timeToUse}` : "";
									}
									return "";
								};
								return renderPickerField(
									property.id,
									property.name,
									displayValue,
									() => isDateProperty
										? openDatePicker(property.name, getPickerInitialValue(), onSelect)
										: openDateTimePicker(property.name, getPickerInitialValue(), onSelect),
								);
							}

							return (<div className="EditTaskModalHomeField" key={property.id}>
								<label className="EditTaskModalHomeFieldTitle">{property.name}</label>
								{property.type === PropertyTypeConfig.boolean ? (
									<select className="EditTaskModalHome-taskStatusValue" value={value === undefined ? "" : String(value)} onChange={(event) => handleCustomPropertyChange(property.id, event.target.value === "" ? "" : event.target.value === "true", property.type)}>
										<option value="">—</option><option value="true">True</option><option value="false">False</option>
									</select>
								) : <input className="EditTaskModalHomeDueInput" type={property.type === PropertyTypeConfig.numeric ? "number" : property.type === PropertyTypeConfig.time ? "time" : "text"} value={displayValue} onChange={(event) => {
									const next = property.type === PropertyTypeConfig.list ? event.target.value.split(",").map(item => item.trim()).filter(Boolean) : event.target.value;
									handleCustomPropertyChange(property.id, next, property.type);
								}} />}
							</div>);
						})}

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
								{tags.map((tag: string, index: number) => {
									const customTagData = globalSettings.tagColors.find(t => compareTwoTags(t.name, tag));
									const tagColor = customTagData?.color;
									const backgroundColor = tagColor ? updateRGBAOpacity(tagColor, 0.1) : `var(--tag-background)`;
									const borderColor = tagColor ? updateRGBAOpacity(tagColor, 0.5) : `var(--tag-color-hover)`;
									return (
										<div
											key={`${tag}_${index}`}
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
