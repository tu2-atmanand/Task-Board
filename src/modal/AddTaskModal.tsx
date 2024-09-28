// /src/modal/AddTaskModal.tsx

import { App, Modal, Notice } from 'obsidian';
import React, { useState } from 'react';

import fs from 'fs';
import { loadGlobalSettings } from 'src/utils/SettingsOperations';
import path from 'path';
import { priorityEmojis } from 'src/interfaces/TaskItem';
import { refreshBoardData } from 'src/utils/refreshBoard';
import { tasksPath } from 'src/interfaces/GlobalVariables';

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

		const dueDateWithEmo = dueDate ? ` 📅${dueDate}` : "";
		const timeWithEmo = time ? ` ⏰[${time}]` : "";

		// Combine priority emoji if it exists
		const priorityWithEmo =
			priority > 0
				? priorityEmojis[priority as number]
				: "";


		try {
			let formattedTask = "";
			if (dayPlannerPlugin) {
				formattedTask = `- [ ] ${time ? `${time} ` : ""
					}${title
					} |${timeWithEmo}${dueDateWithEmo} ${priorityWithEmo} ${tag
					}`;
			} else {
				formattedTask = `- [ ] ${title
					} |${timeWithEmo}${dueDateWithEmo} ${priorityWithEmo} ${tag
					}`;
			}

			// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
			const bodyLines = body
				.filter(
					(line: string) =>
						!line.startsWith("- [ ]") && !line.startsWith("- [x]")
				)
				.map((line: string) => `\t${line}`)
				.join("\n");

			// console.log("The subtasks array before i append backslah t into it : ", subTasks);

			// Add the sub-tasks without additional indentation
			const subTasksWithTab = subTasks
				.map((Line: string) => `\t${Line}`)
				.join("\n");

			// console.log("If i dont add anything in body, then what is the value of bodyLines between the colons :", bodyLines,":");
			// Combine all parts: main task, body, and sub-tasks
			// const completeTask = `${formattedTask}\n${bodyLines}\n${subTasksWithTab}\n`;
			const completeTask = `${formattedTask}${bodyLines.trim() ? `\n${bodyLines}` : ''}\n${subTasksWithTab}\n`;


			// Append task to the file at the current cursor position or the end
			fs.appendFileSync(fullPath, completeTask);

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
