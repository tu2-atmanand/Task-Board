// src/modal/ConfigureColumnSortingModal.ts

import type TaskBoard from "main";
import { Modal, Setting } from "obsidian";
import Sortable from "sortablejs";
import { ColumnData, columnSortingCriteria } from "src/interfaces/BoardConfigs";
import { t } from "src/utils/lang/helper";

export class ConfigureColumnSortingModal extends Modal {
	plugin: TaskBoard;
	columnConfiguration: ColumnData;
	onSave: (updatedColumnConfiguration: ColumnData) => void;
	onCancel: () => void;

	constructor(
		plugin: TaskBoard,
		columnConfiguration: ColumnData,
		onSave: (updatedColumnConfiguration: ColumnData) => void,
		onCancel: () => void
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.columnConfiguration = { ...columnConfiguration }; // Create a copy to avoid mutating original
		this.onSave = onSave;
		this.onCancel = onCancel;
		
		// Initialize sortCriterias if not present
		if (!this.columnConfiguration.sortCriterias) {
			this.columnConfiguration.sortCriterias = [];
		}
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute(
			"data-type",
			"task-board-column-sorting-configure"
		);

		const homeComponent = contentEl.createEl("span", {
			cls: "configureColumnSortingModalHome",
		});
		homeComponent.createEl("h4", {
			text: t("Sorting criterias for ") + this.columnConfiguration.name,
		});
		homeComponent.createEl("p", {
			text: t(
				"Apply sorting criterias to this column. Change the order to set the priority of the criterias to be applied."
			),
		});

		// List of sorting criterias container
		const sortingCriteriaList = homeComponent.createDiv({
			cls: "configureColumnSortingModalHomeSortingCriteriaList",
		});

		// Initialize Sortable.js
		Sortable.create(sortingCriteriaList, {
			animation: 150,
			handle: ".taskboard-setting-tag-color-row-element-drag-handle",
			ghostClass: "task-board-sortable-ghost",
			chosenClass: "task-board-sortable-chosen",
			dragClass: "task-board-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-board-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: async () => {
				const newOrder = Array.from(sortingCriteriaList.children)
					.map((child, index) => {
						const criteriaName = child.getAttribute("data-criteria-name");
						const criteria = this.columnConfiguration.sortCriterias?.find((c) => c.criteria === criteriaName);
						if (criteria) {
							criteria.priority = index + 1;
							return criteria;
						}
						return null;
					})
					.filter(
						(
							criteria
						): criteria is columnSortingCriteria => criteria !== null
					);

				this.columnConfiguration.sortCriterias = newOrder;
			},
		});

		const renderSortingCriterias = () => {
			if (!this.columnConfiguration.sortCriterias) return;

			sortingCriteriaList.empty(); // Clear existing rendered rows

			this.columnConfiguration.sortCriterias.sort(
				(a, b) => a.priority - b.priority
			).forEach((sortCriteria, index) => {
				const row = sortingCriteriaList.createDiv({
					cls: "tag-color-row",
					attr: { "data-criteria-name": sortCriteria.criteria },
				});

				new Setting(row)
					.setClass("tag-color-row-element")
					.addButton((drag) =>
						drag
							.setTooltip("Hold and drag")
							.setIcon("grip-horizontal")
							.setClass(
								"taskboard-setting-tag-color-row-element-drag-handle"
							)
					)
					.addDropdown((dropdown) => {
						dropdown
							.addOption("status", t("Status"))
							.addOption("completed", t("Completed"))
							.addOption("priority", t("Priority"))
							.addOption("dueDate", t("Due Date"))
							.addOption("startDate", t("Start Date"))
							.addOption("scheduledDate", t("Scheduled Date"))
							.addOption("createdDate", t("Created Date"))
							.addOption("completedDate", t("Completed Date"))
							.addOption("content", t("Content"))
							.addOption("tags", t("Tags"))
							.addOption("project", t("Project"))
							.addOption("context", t("Context"))
							.addOption("recurrence", t("Recurrence"))
							.addOption("filePath", t("File Path"))
							.addOption("lineNumber", t("Line Number"))
							.setValue(sortCriteria.criteria)
							.onChange((value: string) => {
								if (this.columnConfiguration.sortCriterias) {
									this.columnConfiguration.sortCriterias[index].criteria = value as columnSortingCriteria["criteria"];
								}
							});
					})
					.addDropdown((dropdown) => {
						dropdown
							.addOption("asc", t("Ascending")) // Ascending might mean different things (e.g., High -> Low for priority)
							.addOption("desc", t("Descending")) // Descending might mean different things (e.g., Low -> High for priority)
							.setValue(sortCriteria.order)
							.onChange((value: string) => {
								if (this.columnConfiguration.sortCriterias) {
									this.columnConfiguration.sortCriterias[index].order = value as columnSortingCriteria["order"];
								}
							});
						// Add tooltips explaining what asc/desc means for each field type if possible
						if (sortCriteria.criteria === "priority") {
							dropdown.selectEl.title = t(
								"Ascending: High -> Low -> None. Descending: None -> Low -> High"
							);
						} else if (
							["dueDate", "startDate", "scheduledDate"].includes(
								sortCriteria.criteria
							)
						) {
							dropdown.selectEl.title = t(
								"Ascending: Earlier -> Later -> None. Descending: None -> Later -> Earlier"
							);
						} else if (sortCriteria.criteria === "status") {
							dropdown.selectEl.title = t(
								"Ascending respects status order (Overdue first). Descending reverses it."
							);
						} else {
							dropdown.selectEl.title = t(
								"Ascending: A-Z. Descending: Z-A"
							);
						}
					})
					.addButton((del) =>
						del
							.setButtonText("Delete")
							.setIcon("trash")
							.setClass(
								"taskboard-setting-tag-color-row-element-delete"
							)
							.setTooltip(t("delete-tag-color"))
							.onClick(async () => {
								if (this.columnConfiguration.sortCriterias) {
									this.columnConfiguration.sortCriterias.splice(index, 1);
									renderSortingCriterias(); // Re-render after delete
								}
							})
					);
			});
		};

		// Initial render
		renderSortingCriterias();

		// Add "Add New Sorting Criteria" button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("add-sorting-criteria"))
				.setCta()
				.onClick(async () => {
					const newCriteria: columnSortingCriteria = {
						criteria: "content",
						order: "asc",
						priority: (this.columnConfiguration.sortCriterias?.length || 0) + 1,
					};
					if (!this.columnConfiguration.sortCriterias) {
						this.columnConfiguration.sortCriterias = [];
					}
					this.columnConfiguration.sortCriterias.push(newCriteria);
					renderSortingCriterias();
				})
		);

		// Button container at bottom
		const buttonContainer = homeComponent.createDiv(
			"configureColumnSortingModalHome-button-container"
		);

		const saveButton = buttonContainer.createEl("button", {
			text: t("save"),
			cls: "configureColumnSortingModalHomeBtnContainerSaveBtn",
		});
		saveButton.addEventListener("click", () => {
			this.onSave(this.columnConfiguration);
			this.close();
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: t("cancel"),
		});
		cancelButton.classList.add(
			"configureColumnSortingModalHomeBtnContainerCancelBtn"
		);
		cancelButton.addEventListener("click", () => {
			this.onCancel();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
