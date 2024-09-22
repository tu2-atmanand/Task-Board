import { App, Modal, Notice } from 'obsidian';
import React, { useState } from 'react';

import fs from 'fs';
import { loadGlobalSettings } from 'src/utils/SettingsOperations';
import { loadTasksFromJson } from 'src/utils/RefreshColumns';
import path from 'path';
import { priorityEmojis } from 'src/interfaces/TaskItem';
import { refreshBoardData } from 'src/utils/refreshBoard';
import { tasksPath } from 'src/interfaces/TaskBoardGlobalValues';

interface AddTaskModalProps {
	app: App;
	filePath: string;
	defaultDue?: string;
	defaultTag?: string;
	onTaskAdded: () => void;
}

export class AddTaskModal extends Modal {
	filePath: string;
	defaultDue?: string;
	defaultTag?: string;
	onTaskAdded: () => void;

	constructor(app: App, props: AddTaskModalProps) {
		super(app);
		this.filePath = props.filePath;
		this.defaultDue = props.defaultDue;
		this.defaultTag = props.defaultTag;
		this.onTaskAdded = props.onTaskAdded;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		let globalSettings = loadGlobalSettings();
		globalSettings = globalSettings.data.globalSettings;
		const autoAddDueOption = globalSettings?.autoAddDue;

		const wrapper = contentEl.createEl('div', { cls: 'modal-content-wrapper' });

		// Title Input for Task
		const taskTitleLabel = wrapper.createEl('h6', { text: 'Task Title : ' });
		const taskTitleInput = wrapper.createEl('input', { type: 'text', placeholder: 'Enter task title' });
		taskTitleInput.style.marginBottom = '10px';

		// Body Text Area (supports multiline body)
		const taskBodyLabel = wrapper.createEl('h6', { text: 'Task Body :' });
		const taskBodyTextArea = wrapper.createEl('textarea', { placeholder: 'Enter task body content here...' });
		taskBodyTextArea.style.minHeight = '100px';
		taskBodyTextArea.style.marginBottom = '10px';

		// Sub-task Input (dynamic)
		const subTaskLabel = wrapper.createEl('h6', { text: 'Sub-Tasks :' });
		const subTaskWrapper = wrapper.createEl('div', { cls: 'sub-task-wrapper' });
		const subTasks: string[] = [];

		const addSubTaskInput = () => {
			const subTaskInput = subTaskWrapper.createEl('input', { type: 'text', placeholder: 'Enter sub-task and press Enter' });
			subTaskInput.addEventListener('keypress', (e) => {
				if (e.key === 'Enter' && subTaskInput.value.trim()) {
					subTasks.push(`- [ ] ${subTaskInput.value.trim()}`);
					subTaskInput.value = ''; // Clear the field after adding
					addSubTaskInput(); // Add a new input field
				}
			});
		};
		addSubTaskInput();

		// Time input fields
		const timeWrapper = wrapper.createEl('div', { cls: 'time-input-wrapper' });

		const startTimeWrapper = timeWrapper.createEl('div', { cls: 'start-time-input-wrapper' });
		const startTimeInputTitle = startTimeWrapper.createEl('h6', { text: 'Task Start Time :' });
		const startTimeInput = startTimeWrapper.createEl('input', { type: 'time' });

		const endTimeWrapper = timeWrapper.createEl('div', { cls: 'end-time-input-wrapper' });
		const endTimeInputTitle = endTimeWrapper.createEl('h6', { text: 'Task End Time :' });
		const endTimeInput = endTimeWrapper.createEl('input', { type: 'time' });

		startTimeInput.addEventListener('change', () => {
			if (startTimeInput.value && !endTimeInput.value) {
				const [hours, minutes] = startTimeInput.value.split(':').map(Number);
				const endHours = (hours + 1) % 24;
				endTimeInput.value = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			}
		});

		// Due date input
		const dueWrapper = wrapper.createEl('div', { cls: 'due-input-wrapper' });
		const dueInputTitle = dueWrapper.createEl('h6', { text: 'Task Due Date :' });
		const dueInput = dueWrapper.createEl('input', { type: 'date' });

		// Tag input
		const tagWrapper = wrapper.createEl('div', { cls: 'tag-input-wrapper' });
		const tagInputTittle = tagWrapper.createEl('h6', { text: 'Task Tag : ' });
		const tagInput = tagWrapper.createEl('input', { type: 'text', placeholder: 'Enter tag (optional)' });

		// Priority dropdown
		const priorityWrapper = wrapper.createEl('div', { cls: 'priority-input-wrapper' });
		const priorityTitle = priorityWrapper.createEl('h6', { text: 'Task Priority :' });
		const priorityInput = priorityWrapper.createEl('select');
		const priorityOptions = [
			{ value: '0', text: 'Normal' },
			{ value: '1', text: 'Highest : 🔺' },
			{ value: '2', text: 'High : ⏫' },
			{ value: '3', text: 'Medium : 🔼' },
			{ value: '4', text: 'Low : 🔽' },
			{ value: '5', text: 'Lowest : ⏬' }
		];
		priorityOptions.forEach(opt => {
			const optionEl = priorityInput.createEl('option', { value: opt.value, text: opt.text });
			priorityInput.appendChild(optionEl);
		});

		// Add Task Button
		const addButton = wrapper.createEl('button', { text: 'Add Task' });
		addButton.style.marginTop = '30px';

		addButton.onclick = () => {
			const taskTitle = taskTitleInput.value.trim();
			const taskBody = taskBodyTextArea.value.split('\n').map(line => line.trim()).filter(line => line !== ''); // Convert body to array
			const dueDate = dueInput.value || (autoAddDueOption ? new Date().toISOString().split('T')[0] : '');
			const tag = tagInput.value.trim();
			const time = `${startTimeInput.value} - ${endTimeInput.value}`;
			const priority = priorityInput.value;

			if (!taskTitle) {
				new Notice("Task title cannot be empty.");
				return;
			}

			// Add task to the file
			this.addTaskToFile(taskTitle, taskBody, subTasks, time, dueDate, tag, Number(priority) || 0);
			this.onTaskAdded();
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
	}

	addTaskToFile(title: string, body: string[], subTasks: string[], time: string, dueDate: string, tag: string, priority: number) {
		const basePath = (window as any).app.vault.adapter.basePath;
		const fullPath = path.join(basePath, this.filePath);
		let globalSettings = loadGlobalSettings(); // Load the globalSettings to check dayPlannerPlugin status
		globalSettings = globalSettings.data.globalSettings;
		console.log("The global setting loaded in Add New Task Modal : ", globalSettings);
		const dayPlannerPlugin = globalSettings?.dayPlannerPlugin;
		// const autoAddDueOption = globalSettings?.autoAddDue;
		// console.log("Global Settings Values : dayPlannerPluginCompatibility : ", dayPlannerPlugin, " | autoAddDueOption : ", autoAddDueOption);

		// const today = new Date().toISOString().split('T')[0]; // get today's date in YYYY-MM-DD format

		const dueDateWithEmo = dueDate ? `📅 ${dueDate}` : '';

		// const dueDateWithEmo = autoAddDueOption ? `📅 ${dueDate}` : '';

		const Emopriority = Number(priority) > 0 ? priorityEmojis[Number(priority)] : ''; // or any other default value


		try {
			let newTaskLine = '';
			if (dayPlannerPlugin) {
				const timeWithEmo = (time === " - ") ? '' : `${time} `;
				// If dayPlannerPlugin is true, place time before the task body
				newTaskLine = `- [ ] ${timeWithEmo}${title} | ${dueDateWithEmo} ${Emopriority} ${tag}\n\t${body[0]}\n\t------- I need a danger logic here to show the content properly-------\n\t${subTasks[0]}\n\t------- I need a danger logic here to show the content properly-------\n`;
			} else {
				console.log("Time value before processing it : ", (time === " - "))
				const timeWithEmo = (time === " - ") ? '' : `⏰ [${time}]`;
				console.log("Time added : ", time);
				// If dayPlannerPlugin is false, place time after the task body
				newTaskLine = `- [ ] ${title} | ${timeWithEmo} ${dueDateWithEmo} ${Emopriority} ${tag}\n\t${body[0]}\n\t------- I need a danger logic here to show the content properly-------\n\t${subTasks[0]}\n\t------- I need a danger logic here to show the content properly-------\n`;
			}

			// Append task to the file at the current cursor position or the end
			fs.appendFileSync(fullPath, newTaskLine);

			// Update tasks.json
			time = (time === " - ") ? '' : time;

			// Update tasks.json
			this.updateTasksJson(title, body, subTasks, time, dueDate, tag, priority, this.filePath);
		} catch (error) {
			console.error("Error adding task to file:", error);
		}
	}

	updateTasksJson(title: string, body: string[], subTasks: string[], time: string, dueDate: string, tag: string, priority: number, filePath: string) {
		const tasksData = fs.readFileSync(tasksPath, 'utf8');
		const allTasks = JSON.parse(tasksData);

		const newTask = {
			id: Date.now(),
			title: title,
			body: [...body, ...subTasks],  // Body now includes main body and sub-tasks
			time: time || '',
			due: dueDate || '',
			tag: tag || '',
			priority: priority,
			filePath: filePath,
			completed: ''  // This will be updated when task is marked as complete
		};

		// Update the task list (assuming it's a file-based task structure)
		if (!allTasks.Pending[filePath]) {
			allTasks.Pending[filePath] = [];
		}
		allTasks.Pending[filePath].push(newTask);

		fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
	}
}
