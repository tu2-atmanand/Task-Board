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

		// Initialize sortCriteria if not present
		if (!this.columnConfiguration.sortCriteria) {
			this.columnConfiguration.sortCriteria = [];
		}
	}

	onOpen() {
		const { contentEl } = this;

		this.setTitle(
			t("sorting-criterias-for") + " " + this.columnConfiguration.name
		);

		this.modalEl.setAttribute(
			"data-type",
			"task-board-column-sorting-configure"
		);

		const homeComponent = contentEl.createEl("span", {
			cls: "configureColumnSortingModalHome",
		});
		// homeComponent.createEl("h4", {
		// 	text:
		// 		,
		// });
		homeComponent.createEl("p", {
			text: t("column-sorting-criteria-configure-modal-description"),
		});

		// List of sorting criterias container
		const sortingCriteriaList = homeComponent.createDiv({
			cls: "configureColumnSortingModalHomeSortingCriteriaList",
		});

		// Initialize Sortable.js
		Sortable.create(sortingCriteriaList, {
			animation: 150,
			handle: ".configureColumnSortingModalHomeSortingCriteriaListItemDragHandle",
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
						const criteriaName =
							child.getAttribute("data-criteria-name");
						const criteria =
							this.columnConfiguration.sortCriteria?.find(
								(c) => c.criteria === criteriaName
							);
						if (criteria) {
							criteria.priority = index + 1;
							return criteria;
						}
						return null;
					})
					.filter(
						(criteria): criteria is columnSortingCriteria =>
							criteria !== null
					);

				this.columnConfiguration.sortCriteria = newOrder;
			},
		});

		const renderSortingCriterias = () => {
			if (!this.columnConfiguration.sortCriteria) return;

			sortingCriteriaList.empty(); // Clear existing rendered rows

			this.columnConfiguration.sortCriteria
				.sort((a, b) => a.priority - b.priority)
				.forEach((sortCriteria, index) => {
					const row = sortingCriteriaList.createDiv({
						cls: "configureColumnSortingModalHomeSortingCriteriaListItemRow",
						attr: { "data-criteria-name": sortCriteria.criteria },
					});

					new Setting(row)
						.setClass(
							"configureColumnSortingModalHomeSortingCriteriaListItem"
						)
						.addButton((drag) =>
							drag
								.setTooltip("Hold and drag")
								.setIcon("grip-horizontal")
								.setClass(
									"configureColumnSortingModalHomeSortingCriteriaListItemDragHandle"
								)
						)
						.addDropdown((dropdown) => {
							dropdown
								.addOption("content", t("title"))
								.addOption("id", t("id"))
								.addOption("status", t("status"))
								.addOption("priority", t("priority"))
								.addOption("tags", t("tags"))
								// .addOption("project", t("project")) // Will be implemented in future
								.addOption("time", t("start-time"))
								.addOption("createdDate", t("created-date"))
								.addOption("startDate", t("start-date"))
								.addOption("scheduledDate", t("scheduled-date"))
								.addOption("dueDate", t("due-date"))
								.addOption("completedDate", t("completed-date"))
								.addOption("recurrence", t("recurrence"))
								.addOption("filePath", t("file-path"))
								// .addOption("lineNumber", t("line Number"))
								.setValue(sortCriteria.criteria)
								.onChange((value: string) => {
									if (this.columnConfiguration.sortCriteria) {
										this.columnConfiguration.sortCriteria[
											index
										].criteria =
											value as columnSortingCriteria["criteria"];
									}
								});
						})
						.addDropdown((dropdown) => {
							dropdown
								.addOption("asc", t("ascending")) // Ascending might mean different things (e.g., High -> Low for priority)
								.addOption("desc", t("descending")) // Descending might mean different things (e.g., Low -> High for priority)
								.setValue(sortCriteria.order)
								.onChange((value: string) => {
									if (this.columnConfiguration.sortCriteria) {
										this.columnConfiguration.sortCriteria[
											index
										].order =
											value as columnSortingCriteria["order"];
									}
								});
							// Add tooltips explaining what asc/desc means for each field type if possible
							if (sortCriteria.criteria === "priority") {
								dropdown.selectEl.title = t(
									"column-sorting-criteria-priority-tooltip-numeric-properties"
								);
							} else if (
								[
									"dueDate",
									"startDate",
									"scheduledDate",
								].includes(sortCriteria.criteria)
							) {
								dropdown.selectEl.title = t(
									"column-sorting-criteria-priority-tooltip-date-properties"
								);
							} else if (sortCriteria.criteria === "status") {
								dropdown.selectEl.title = t(
									"column-sorting-criteria-priority-tooltip-status-properties"
								);
							} else {
								dropdown.selectEl.title = t(
									"column-sorting-criteria-priority-tooltip-content-properties"
								);
							}
						})
						.addButton((del) =>
							del
								.setButtonText("delete")
								.setIcon("trash")
								.setClass(
									"configureColumnSortingModalHomeSortingCriteriaListItemDeleteCriterion"
								)
								.setTooltip(t("remove-sort-criterion"))
								.onClick(async () => {
									if (this.columnConfiguration.sortCriteria) {
										this.columnConfiguration.sortCriteria.splice(
											index,
											1
										);
										renderSortingCriterias(); // Re-render after delete
									}
								})
						);
				});
		};

		// Initial render
		renderSortingCriterias();

		const addNewSortingButton = homeComponent.createEl("button", {
			text: t("add-new-sorting-criterion"),
			cls: "configureColumnSortingModalHomeAddSortingBtn",
		});
		addNewSortingButton.addEventListener("click", async () => {
			const newCriteria: columnSortingCriteria = {
				criteria: "content",
				order: "asc",
				priority:
					(this.columnConfiguration.sortCriteria?.length || 0) + 1,
			};
			if (!this.columnConfiguration.sortCriteria) {
				this.columnConfiguration.sortCriteria = [];
			}
			this.columnConfiguration.sortCriteria.push(newCriteria);
			renderSortingCriterias();
		});

		// Button container at bottom
		const buttonContainer = homeComponent.createDiv(
			"configureColumnSortingModalHomeButtonContainer"
		);

		const saveButton = buttonContainer.createEl("button", {
			text: t("save"),
			cls: "configureColumnSortingModalHomeButtonContainerSaveBtn",
		});
		saveButton.addEventListener("click", () => {
			this.onSave(this.columnConfiguration);
			this.close();
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: t("cancel"),
		});
		cancelButton.classList.add(
			"configureColumnSortingModalHomeButtonContainerCancelBtn"
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
