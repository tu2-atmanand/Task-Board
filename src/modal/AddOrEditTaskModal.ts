// /src/modal/AddOrEditTaskModal.ts

import { App, Modal } from "obsidian";

import AddOrEditTaskModalContent from "./AddOrEditTaskModalContent.svelte";
import { SvelteComponent } from "svelte";
import type TaskBoard from "main";
import type { taskItem } from "src/interfaces/TaskItemProps";

const taskItemEmpty = {
	id: 0,
	title: "",
	body: [],
	due: "",
	tags: [],
	time: "",
	priority: 0,
	completed: "",
	filePath: "",
};

export class AddOrEditTaskModal extends Modal {
	app: App;
	plugin: TaskBoard;
	task: taskItem = taskItemEmpty;
	filePath: string;
	taskExist: boolean;
	onSave: (updatedTask: taskItem) => void;

	private component: SvelteComponent | null = null;

	constructor(
		app: App,
		plugin: TaskBoard,
		onSave: (updatedTask: taskItem) => void,
		filePath: string,
		taskExist: boolean,
		task?: taskItem
	) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.filePath = filePath;
		this.onSave = onSave;
		this.taskExist = taskExist;
		if (task) {
			this.task = task;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const plainTask = { ...this.task };

		console.log(
			"AddOrEditTaskModal: The plain task I am passing:",
			plainTask
		);

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		// Pass props to Svelte component
		this.component = new AddOrEditTaskModalContent({
			target: contentEl,
			props: {
				task: plainTask, // Default to an empty object if `this.task` is undefined
				taskExists: this.taskExist, // Ensure it's a boolean
				filePath: this.filePath ?? "", // Default to an empty string
				onSave: this.onSave ?? (() => {}), // Provide a fallback function
				onClose: () => this.close(),
			},
		});

		console.log("Content Element:", contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.component) {
			this.component.$destroy;
			this.component = null;
		}
	}
}
