// /src/components/KanbanBoard.tsx

import TaskBoard from "main";
import {
	Modal,
	ToggleComponent,
	DropdownComponent,
	ButtonComponent,
} from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import { TaskBoardAction } from "src/interfaces/GlobalSettings";

export class TaskBoardActionsModal extends Modal {
	plugin: TaskBoard;
	columns: ColumnData[];

	constructor(plugin: TaskBoard, columns: ColumnData[]) {
		super(plugin.app);
		this.plugin = plugin;
		this.columns = columns;
		this.setTitle("Task Board Actions");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute("data-type", "task-board-actions-modal");
		contentEl.setAttribute("data-type", "task-board-actions-modal");

		// Header
		const header = contentEl.createDiv({ cls: "taskboard-actions-header" });
		header.createEl("h2", { text: "Active Actions" });

		const addBtn = header.createEl("button", {
			text: "Add action",
			cls: "taskboard-actions-add-button",
		});
		addBtn.onclick = () => {
			const newAction: TaskBoardAction = {
				enabled: true,
				trigger: "Complete",
				type: "move",
				targetColumn: this.columns[0].name || "",
			};
			this.plugin.settings.data.actions.push(newAction);
			this.plugin.saveSettings();
			this.refresh();
		};

		// Sections
		const activeSection = contentEl.createDiv({
			cls: "taskboard-active-actions-section",
		});
		const inactiveSection = contentEl.createDiv();
		inactiveSection.createEl("h2", {
			text: "Inactive Actions",
			cls: "taskboard-inactive-actions-section",
		});

		const inactiveList = inactiveSection.createDiv({
			cls: "taskboard-actions-modal-list",
		});

		const actions: TaskBoardAction[] =
			this.plugin.settings.data.actions;

		for (let i = 0; i < actions.length; i++) {
			const action = actions[i];

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
				this.plugin.saveSettings();
				this.refresh();
			});

			container.createSpan({ text: "When the card is marked as" });

			new DropdownComponent(container)
				.addOptions({ Complete: "Complete", Incomplete: "Incomplete" })
				.setValue(action.trigger)
				.onChange((val) => {
					action.trigger = val as "Complete" | "Incomplete";
					this.plugin.saveSettings();
				});

			new DropdownComponent(container)
				.addOptions({ move: "move", copy: "copy" })
				.setValue(action.type)
				.onChange((val) => {
					action.type = val as "move" | "copy";
					this.plugin.saveSettings();
				});

			container.createSpan({ text: "the card to" });

			new DropdownComponent(container)
				.addOptions(
					Object.fromEntries(
						this.columns.map((c) => [c.index, c.name || ""])
					)
				)
				.setValue(action.targetColumn)
				.onChange((val) => {
					action.targetColumn = val;
					this.plugin.saveSettings();
				});

			new ButtonComponent(container)
				.setIcon("trash")
				.setTooltip("Delete Action")
				.onClick(() => {
					this.plugin.settings.data.actions.splice(
						i,
						1
					);
					this.plugin.saveSettings();
					this.refresh();
				});
		}
	}

	refresh() {
		this.onOpen();
	}

	onClose() {
		this.contentEl.empty();
	}
}
