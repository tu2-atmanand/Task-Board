// /src/components/AddTaskModal.tsx

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

		// Create a wrapper div for styling
		const wrapper = contentEl.createEl('div', { cls: 'modal-content-wrapper' });

		// Add heading
		const heading = wrapper.createEl('h2', { text: 'Add New Task' });
		heading.style.marginBottom = '10px'; // Space below heading

		// Add description paragraph
		const description = wrapper.createEl('p', {
			text: 'This will add a new task in the Currently Opened Markdown File at the Cursor Position.',
		});
		description.style.marginBottom = '20px'; // Space below paragraph

		// Create inputs
		const taskInputTittle = wrapper.createEl('h6', { text: 'Task Description : ' });
		const taskInput = wrapper.createEl('textarea', { type: 'text', placeholder: 'Enter task description' });
		taskInput.style.marginBottom = '10px'; // Space below input
		taskInput.style.minHeight = '100px';

		// Time input fields
		const timeWrapper = wrapper.createEl('div', { cls: 'time-input-wrapper' }); // Wrapper for flex layout
		
		const startTimeWrapper = timeWrapper.createEl('div', { cls: 'start-time-input-wrapper' });
		const startTimeInputTitle = startTimeWrapper.createEl('h6', { text: 'Task Start Time :' });
		const startTimeInput = startTimeWrapper.createEl('input', { type: 'time' });
		
		const endTimeWrapper = timeWrapper.createEl('div', { cls: 'end-time-input-wrapper' });
		const endTimeInputTitle = endTimeWrapper.createEl('h6', { text: 'Task End Time :' });
		const endTimeInput = endTimeWrapper.createEl('input', { type: 'time' });

		// Automatically set end time if only start time is provided
		startTimeInput.addEventListener('change', () => {
			if (startTimeInput.value && !endTimeInput.value) {
				const [hours, minutes] = startTimeInput.value.split(':').map(Number);
				const endHours = (hours + 1) % 24;
				endTimeInput.value = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			}
		});

		// Due date input field
		const dueWrapper = wrapper.createEl('div', { cls: 'due-input-wrapper' });
		const dueInputTitle = dueWrapper.createEl('h6', { text: 'Task Due Date :' });
		const dueInput = dueWrapper.createEl('input', { type: 'date' });

		// Tag input field
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

		// Set default values if provided
		if (this.defaultDue) dueInput.value = this.defaultDue;
		if (this.defaultTag) tagInput.value = this.defaultTag;

		// Create and style button
		const addButton = wrapper.createEl('button', { text: 'Add Task' });
		addButton.style.marginTop = '30px'; // Space above button

		addButton.onclick = () => {
			const taskBody = taskInput.value;
			const defaultDue = autoAddDueOption ? new Date().toISOString().split('T')[0] : '';
			const dueDate = dueInput.value || defaultDue; // Default to today
			const tag = tagInput.value.trim();
			const time = `${startTimeInput.value} - ${endTimeInput.value}`; // Time format for the task
			const priority = priorityInput.value;

			if (!taskBody) {
				new Notice("Task body cannot be empty.");
				return;
			}

			this.addTaskToFile(taskBody, time ? time : '', dueDate ? dueDate : '', tag ? `#${tag}` : '', (Number(priority) === 0) ? '' : priority);
			this.onTaskAdded(); // Callback to refresh tasks after addition
			// TODO: Simply took trouble, i dont have to specifically refresh the board myself. Since when the md file will be updated. It will be detected by the code in main.ts and the board will be updated by that service.
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
	}

	addTaskToFile(taskBody: string, time: string, dueDate: string, tag: string, priority: string) {
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
				newTaskLine = `- [ ] ${timeWithEmo}${taskBody} | ${dueDateWithEmo} ${Emopriority} ${tag}\n`;
			} else {
				console.log("Time value before processing it : ", (time===" - "))
				const timeWithEmo = (time === " - ") ? '' : `⏰ [${time}]`;
				console.log("Time added : ", time);
				// If dayPlannerPlugin is false, place time after the task body
				newTaskLine = `- [ ] ${taskBody} | ${timeWithEmo} ${dueDateWithEmo} ${Emopriority} ${tag}\n`;
			}

			// Append task to the file at the current cursor position or the end
			fs.appendFileSync(fullPath, newTaskLine);

			// Update tasks.json
			time = (time === " - ") ? '' : time;
			this.updateTasksJson(taskBody, time, dueDate, tag, Number(priority) ? Number(priority) : 0, this.filePath);
		} catch (error) {
			console.error("Error adding task to file:", error);
		}
	}

	updateTasksJson(taskBody: string, time: string, dueDate: string, tag: string, priority: number, filePath: string) {

		try {
			const tasksData = fs.readFileSync(tasksPath, 'utf8');
			const allTasks = JSON.parse(tasksData);

			const newTask = {
				id: Date.now(),
				body: taskBody,
				time: time,
				due: dueDate,
				tag: tag,
				priority: priority,
				filePath: filePath,
				completed: false,
			};

			// Add task to the correct file path in the "Pending" category
			if (!allTasks.Pending[filePath]) {
				allTasks.Pending[filePath] = [];
			}
			allTasks.Pending[filePath].push(newTask);

			fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
		} catch (error) {
			console.error("Error updating tasks.json:", error);
		}
	}
}
