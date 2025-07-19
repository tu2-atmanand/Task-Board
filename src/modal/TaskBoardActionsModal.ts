import {
	App,
	Modal,
	Setting,
	ToggleComponent,
	DropdownComponent,
} from "obsidian";

interface TaskBoardAction {
	enabled: boolean;
	trigger: "Complete" | "Incomplete";
	type: "move" | "copy";
	targetColumn: string;
}

export class TaskBoardActionsModal extends Modal {
	actions: TaskBoardAction[];
	columns: string[];

	constructor(app: App, columns: string[], actions: TaskBoardAction[]) {
		super(app);
		this.columns = columns;
		this.actions = actions;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Modal title
		contentEl.createEl("h1", { text: "Task Board Actions" });

		// Header with Add Button
		const header = contentEl.createDiv({ cls: "taskboard-actions-header" });
		header.createEl("h2", { text: "Active Actions" });

		const addBtn = header.createEl("button", {
			text: "Add action",
			cls: "taskboard-actions-add-button",
		});
		addBtn.onclick = () => {
			this.actions.push({
				enabled: true,
				trigger: "Complete",
				type: "move",
				targetColumn: this.columns[0] || "",
			});
			this.refresh();
		};

		// Sections for Active & Inactive Actions
		const activeSection = contentEl.createDiv({
			cls: "taskboard-actions-section",
		});
		const inactiveSection = contentEl.createDiv();
		inactiveSection.createEl("h2", { text: "Inactive Actions" });

		const inactiveList = inactiveSection.createDiv({
			cls: "taskboard-actions-section",
		});

		for (let i = 0; i < this.actions.length; i++) {
			const action = this.actions[i];

			const container = (
				action.enabled ? activeSection : inactiveList
			).createDiv({
				cls: "taskboard-action-item",
			});

			// Toggle
			const toggle = new ToggleComponent(container);
			toggle.setValue(action.enabled);
			toggle.onChange((val) => {
				action.enabled = val;
				this.refresh();
			});

			container.createSpan({ text: "When the card is marked as" });

			// Trigger dropdown
			new DropdownComponent(container)
				.addOptions({ Complete: "Complete", Incomplete: "Incomplete" })
				.setValue(action.trigger)
				.onChange(
					(val) => (action.trigger = val as "Complete" | "Incomplete")
				);

			// Type dropdown
			new DropdownComponent(container)
				.addOptions({ move: "move", copy: "copy" })
				.setValue(action.type)
				.onChange((val) => (action.type = val as "move" | "copy"));

			container.createSpan({ text: "the card to" });

			// Target column dropdown
			new DropdownComponent(container)
				.addOptions(Object.fromEntries(this.columns.map((c) => [c, c])))
				.setValue(action.targetColumn)
				.onChange((val) => (action.targetColumn = val));
		}
	}

	refresh() {
		this.onOpen();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
