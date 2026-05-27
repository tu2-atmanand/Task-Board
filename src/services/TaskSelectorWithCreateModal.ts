import { t } from "i18next";
import { SuggestModal, App } from "obsidian";
import TaskBoard from "../../main.js";
import createTaskCard from "../components/TaskCard/TaskCardImage.js";
import { taskItem } from "../interfaces/TaskItem.js";
import { buildTaskFromRawContent } from "../managers/VaultScanner.js";
import { createNewInlineTask } from "../utils/taskLine/TaskItemEventHandlers.js";
import { generateRandomStringId } from "../utils/TaskItemUtils.js";

export type TaskSelectorWithCreateResult =
	| { type: "selected"; task: taskItem }
	| { type: "created"; task: taskItem }
	| { type: "cancelled" };

export interface TaskSelectorWithCreateOptions {
	/** Callback when a task is selected or created */
	onResult: (result: TaskSelectorWithCreateResult) => void;
	/** Optional placeholder text override */
	placeholder?: string;
	/** Optional title override */
	title?: string;
}

function searchableValueIncludes(value: unknown, lowerQuery: string): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (
		typeof value !== "string" &&
		typeof value !== "number" &&
		typeof value !== "boolean"
	) {
		return false;
	}

	return String(value).toLowerCase().includes(lowerQuery);
}

export function taskMatchesSelectorQuery(
	task: taskItem,
	lowerQuery: string,
): boolean {
	if (searchableValueIncludes(task.title, lowerQuery)) return true;
	if (searchableValueIncludes(task.due, lowerQuery)) return true;
	if (
		task.priority !== 0 &&
		searchableValueIncludes(task.priority, lowerQuery)
	) {
		return true;
	}
	// if (task.contexts?.some((context) => searchableValueIncludes(context, lowerQuery))) {
	// 	return true;
	// }

	// const filteredProjects = filterEmptyProjects(task.projects || []);
	// if (filteredProjects.some((project) => searchableValueIncludes(project, lowerQuery))) {
	// 	return true;
	// }

	return false;
}

/**
 * A fuzzy selector modal that allows users to either:
 * 1. Select an existing task from the list
 * 2. Create a new task via NLP parsing by pressing Shift+Enter
 *
 * Features:
 * - Real-time NLP preview in footer as user types
 * - Shift+Enter to create a new task from the current query
 * - Standard Enter to select highlighted existing task
 */
export class TaskSelectorWithCreateModal extends SuggestModal<taskItem> {
	private tasks: taskItem[];
	private options: TaskSelectorWithCreateOptions;
	private plugin: TaskBoard;
	private createFooterEl: HTMLElement | null = null;
	private currentQuery = "";
	private resultHandled = false;

	constructor(
		app: App,
		plugin: TaskBoard,
		tasks: taskItem[],
		options: TaskSelectorWithCreateOptions,
	) {
		super(app);
		this.plugin = plugin;
		this.tasks = tasks;
		this.options = options;

		// Set placeholder
		this.setPlaceholder(options.placeholder || t("search-for-task"));

		// Set instructions
		this.setInstructions([
			{ command: "↑↓", purpose: t("to navigate") },
			{ command: "↵", purpose: t("to selet") },
			// {
			// 	command: "⇧↵",
			// 	purpose: t("to create new task"),
			// },
			{ command: "esc", purpose: t("to dismiss") },
		]);

		// Set modal title for accessibility
		this.titleEl.setText(
			options.title || t("Search an existing task or create a new one"),
		);
		this.titleEl.setAttribute("id", "task-selector-with-create-title");

		// Set aria attributes on the modal
		this.containerEl.setAttribute(
			"aria-labelledby",
			"task-selector-with-create-title",
		);
		this.containerEl.setAttribute("role", "dialog");
		this.containerEl.setAttribute("aria-modal", "true");
		this.containerEl.addClass("taskboard-task-selector-modal");
	}

	onOpen(): void {
		super.onOpen();

		// Add keydown listener for Shift+Enter on the modal container to catch it before Obsidian
		// this.scope.register(["Shift"], "Enter", (e: KeyboardEvent) => {
		// 	e.preventDefault();
		// 	e.stopPropagation();
		// 	void this.createNewTask();
		// 	return false;
		// });

		// Add input listener for real-time preview updates
		this.inputEl.addEventListener("input", this.handleInputChange);

		// Create footer after DOM is ready.
		// SuggestModal builds its DOM asynchronously, so we defer to the next tick.
		// window.setTimeout(() => this.createFooter(), 0);
	}

	private createFooter(): void {
		// The SuggestModal structure is: modalEl > .prompt > [input, results]
		// We want to append our footer inside the modalEl, after .prompt
		const modalContentEl =
			this.modalEl.querySelector(".prompt")?.parentElement ||
			this.modalEl;

		this.createFooterEl = createDiv({ cls: "task-selector-create-footer" });
		this.createFooterEl.classList.add("tn-static-display-none-6b99de8b");
		modalContentEl.appendChild(this.createFooterEl);
	}

	private handleInputChange = (): void => {
		const query = this.inputEl.value.trim();
		this.currentQuery = query;
		// this.updateCreateFooter(query);
	};

	private updateCreateFooter(query: string): void {
		if (!this.createFooterEl) return;

		if (!query) {
			this.createFooterEl.empty();
			return;
		}

		if (query !== "") {
			this.createFooterEl.empty();

			// Content
			const contentDiv = this.createFooterEl.createDiv({
				cls: "task-selector-create-footer__content",
			});

			// Title line
			const titleLine = contentDiv.createDiv({
				cls: "task-selector-create-footer__title-line",
			});
			titleLine.createSpan({
				cls: "task-selector-create-footer__title",
				text: query,
			});

			// Shortcut hint
			const hintLine = contentDiv.createDiv({
				cls: "task-selector-create-footer__hint",
			});
			hintLine.createSpan({
				cls: "task-selector-create-footer__shortcut",
				text: "⇧↵",
			});
			hintLine.createSpan({
				cls: "task-selector-create-footer__hint-text",
				text: t("create-new-task"),
			});
		} else {
			this.createFooterEl.empty();
		}
	}

	private async createNewTask(): Promise<void> {
		const query = this.inputEl.value.trim();
		if (!query || query === "") {
			new Notice(t("Please enter a title to create the task."));
			return;
		}

		try {
			// Build task creation data
			let taskData = buildTaskFromRawContent(`- [ ] ${query}`, "");
			taskData["id"] = generateRandomStringId();
			let completeTask: taskItem = taskData as taskItem;
			// Create the task
			const result = await createNewInlineTask(this.plugin, completeTask);

			new Notice(
				t("A new task created successfully : ", {
					title: query,
				}),
			);

			// Close modal and return result
			this.resultHandled = true;
			this.close();
			this.options.onResult({ type: "created", task: completeTask });
		} catch (error) {
			console.error("Failed to create task:", error);
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(t("modals.taskCreation.notices.failure", { message }));
		}
	}

	getSuggestions(query: string): taskItem[] {
		this.currentQuery = query;
		return this.getFilteredTasks(query);
	}

	private getFilteredTasks(query: string): taskItem[] {
		const lowerQuery = query.toLowerCase();

		return this.tasks
			.filter((task) => {
				if (!query) return true;
				return taskMatchesSelectorQuery(task, lowerQuery);
			})
			.sort((a, b) => {
				// Sort by due date second
				if (a.due && !b.due) return -1;
				if (!a.due && b.due) return 1;
				if (a.due && b.due) {
					const dateCompare = a.due.localeCompare(b.due);
					if (dateCompare !== 0) return dateCompare;
				}

				// Then by priority
				const priorityOrder: Record<string, number> = {
					high: 0,
					normal: 1,
					low: 2,
				};
				const aPriority = priorityOrder[a.priority] ?? 1;
				const bPriority = priorityOrder[b.priority] ?? 1;
				if (aPriority !== bPriority) return aPriority - bPriority;

				// Finally by title
				return a.title.localeCompare(b.title);
			});
	}

	renderSuggestion(task: taskItem, el: HTMLElement): void {
		// Use TaskCard component with default layout for full styling
		const taskCard = createTaskCard(this.plugin, task);

		// Add modal-specific class for any additional styling
		taskCard.classList.add("taskboard-task-selector-modal-taskitem");

		// Clone the element to remove TaskCard's event listeners
		// This allows the modal's selection handling to work properly
		const cleanCard = taskCard.cloneNode(true) as HTMLElement;

		el.appendChild(cleanCard);
	}

	onChooseSuggestion(task: taskItem, evt: MouseEvent | KeyboardEvent): void {
		// Select existing task
		this.resultHandled = true;
		this.options.onResult({ type: "selected", task });
	}

	onClose(): void {
		// Remove event listeners
		this.inputEl.removeEventListener("input", this.handleInputChange);

		// Clean up footer element
		// if (this.createFooterEl) {
		// 	this.createFooterEl.remove();
		// 	this.createFooterEl = null;
		// }

		// Obsidian's SuggestModal calls onClose() BEFORE onChooseSuggestion().
		// Defer the cancelled check to the next tick so onChooseSuggestion() can set resultHandled first.
		window.setTimeout(() => {
			if (!this.resultHandled) {
				this.options.onResult({ type: "cancelled" });
			}
		}, 0);

		super.onClose();
	}
}

/**
 * Helper function to open a task selector with create capability.
 * Users can select an existing task OR create a new one via Shift+Enter.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param tasks - Array of tasks to choose from
 * @param onChooseTask - Callback when a task is selected or created (null if cancelled)
 * @param options - Optional configuration (placeholder, title)
 *
 * @todo - The create new task functionality is under development and will require brainstorming.
 */
export function openTaskSelector(
	plugin: TaskBoard,
	tasks: taskItem[],
	onChooseTask: (task: taskItem | null) => void,
	options?: { placeholder?: string; title?: string },
): void {
	const modal = new TaskSelectorWithCreateModal(plugin.app, plugin, tasks, {
		placeholder: options?.placeholder,
		title: options?.title,
		onResult: (result) => {
			if (result.type === "selected" || result.type === "created") {
				onChooseTask(result.task);
			} else {
				onChooseTask(null);
			}
		},
	});
	modal.open();
}
