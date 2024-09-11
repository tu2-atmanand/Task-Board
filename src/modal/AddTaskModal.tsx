// /src/components/AddTaskModal.tsx

import { App, Modal, Notice } from 'obsidian';
import React, { useState } from 'react';

import fs from 'fs';
import { loadTasksFromJson } from 'src/utils/RefreshColumns';
import path from 'path';
import { refreshBoardData } from 'src/utils/refreshBoard';

interface AddTaskModalProps {
	app: App;
	filePath: string;
	defaultDue?: string;
	defaultTag?: string;
	onTaskAdded: () => void; // Callback function to refresh tasks after addition
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
		const taskInputTittle = wrapper.createEl('h6', { text: 'Task Description : '});
		const taskInput = wrapper.createEl('textarea', { type: 'text', placeholder: 'Enter task description' });
		taskInput.style.marginBottom = '10px'; // Space below input
		taskInput.style.minHeight = '100px';

		const dueWrapper = wrapper.createEl('div', { cls: 'due-input-wrapper' }); // Wrapper for flex layout
		// Create title and input
		const dueInputTitle = dueWrapper.createEl('h6', { text: 'Task Due Date :' });
		const dueInput = dueWrapper.createEl('input', { type: 'date' });
		dueInputTitle.style.marginRight = '10px'; // Space between title and input
		// dueInput.style.marginBottom = '10px'; // Space below input

		const tagWrapper = wrapper.createEl('div', { cls: 'due-input-wrapper' });
		const tagInputTittle = tagWrapper.createEl('h6', { text: 'Task Tag : '})
		const tagInput = tagWrapper.createEl('input', { type: 'text', placeholder: 'Enter tag (optional)' });
		dueInputTitle.style.marginRight = '10px'; // Space between title and input
		// tagInput.style.marginBottom = '20px'; // Space below input

		// Set default values if provided
		if (this.defaultDue) dueInput.value = this.defaultDue;
		if (this.defaultTag) tagInput.value = this.defaultTag;

		// Create and style button
		const addButton = wrapper.createEl('button', { text: 'Add Task' });
		addButton.style.marginTop = '30px'; // Space above button

		addButton.onclick = () => {
			const taskBody = taskInput.value;
			const dueDate = dueInput.value || new Date().toISOString().split('T')[0]; // Default to today
			const tag = tagInput.value.trim();

			if (!taskBody) {
				new Notice("Task body cannot be empty.");
				return;
			}

			this.addTaskToFile(taskBody, dueDate, tag);
			this.onTaskAdded(); // Callback to refresh tasks after addition
			// TODO: Simply took trouble, i dont have to specifically refresh the board myself. Since when the md file will be updated. It will be detected by the code in main.ts and the board will be updated by that service.
			this.close();
		};
	}


	addTaskToFile(taskBody: string, dueDate: string, tag: string) {
		const basePath = (window as any).app.vault.adapter.basePath;
		const fullPath = path.join(basePath, this.filePath);

		try {
			const newTaskLine = `- [ ] ${taskBody} | 📅 ${dueDate} ${tag ? `${tag}` : ''}\n`;

			// Append task to the file at the current cursor position or the end
			fs.appendFileSync(fullPath, newTaskLine);

			// Update tasks.json
			this.updateTasksJson(taskBody, dueDate, tag, this.filePath);
		} catch (error) {
			console.error("Error adding task to file:", error);
		}
	}

	updateTasksJson(taskBody: string, dueDate: string, tag: string, filePath: string) {
		const basePath = (window as any).app.vault.adapter.basePath;
		const tasksPath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'tasks.json');

		try {
			const tasksData = fs.readFileSync(tasksPath, 'utf8');
			const allTasks = JSON.parse(tasksData);

			const newTask = {
				id: Date.now(),
				body: taskBody,
				due: dueDate,
				tag: tag,
			};

			// Add task to the correct file path in the "Pending" category
			if (!allTasks.Pending[filePath]) {
				allTasks.Pending[filePath] = [];
			}
			console.log("Adding a new element in Pending : ", filePath);
			allTasks.Pending[filePath].push(newTask);

			fs.writeFileSync(tasksPath, JSON.stringify(allTasks, null, 2));
		} catch (error) {
			console.error("Error updating tasks.json:", error);
		}
	}
}
