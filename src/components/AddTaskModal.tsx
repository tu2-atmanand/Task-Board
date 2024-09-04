

import React, { useState } from 'react';
import { Modal, App, Notice } from 'obsidian';
import fs from 'fs';
import path from 'path';
import { loadTasksFromJson } from 'src/utils/RefreshColumns';

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

		const taskInput = contentEl.createEl('input', { type: 'text', placeholder: 'Enter task description' });
		const dueInput = contentEl.createEl('input', { type: 'date' });
		const tagInput = contentEl.createEl('input', { type: 'text', placeholder: 'Enter tag (optional)' });

		// Set default values if provided
		if (this.defaultDue) dueInput.value = this.defaultDue;
		if (this.defaultTag) tagInput.value = this.defaultTag;

		const addButton = contentEl.createEl('button', { text: 'Add Task' });

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
			// TODO : Call the loadTasks from Columns, to refresh that component.
			this.close();
		};
	}

	addTaskToFile(taskBody: string, dueDate: string, tag: string) {
		const basePath = (window as any).app.vault.adapter.basePath;
		const fullPath = path.join(basePath, this.filePath);

		try {
			const newTaskLine = `- [ ] ${taskBody} | 📅 ${dueDate} ${tag ? `#${tag}` : ''}\n`;

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
