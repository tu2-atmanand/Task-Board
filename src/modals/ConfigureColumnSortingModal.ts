// src/modal/ConfigureColumnSortingModal.ts

import type TaskBoard from "main";
import { Modal, Notice, Setting } from "obsidian";
import Sortable from "sortablejs";
import { ColumnData, columnSortingCriteria } from "src/interfaces/BoardConfigs";
import { t } from "src/utils/lang/helper";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";

export class ConfigureColumnSortingModal extends Modal {
	plugin: TaskBoard;
	columnConfiguration: ColumnData;
	isEdited: boolean;
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
		this.isEdited = false;
		// Deep-copy columnConfiguration to avoid mutating caller's object (avoid stale/unsaved changes)
		try {
			this.columnConfiguration = JSON.parse(
				JSON.stringify(columnConfiguration)
			);
		} catch (e) {
			// Fallback to shallow copy if stringify fails
			this.columnConfiguration = { ...columnConfiguration };
		}
		this.onSave = onSave;
		this.onCancel = onCancel;

		// Initialize sortCriteria if not present, and ensure each criterion has a stable uid
		if (!this.columnConfiguration.sortCriteria) {
			this.columnConfiguration.sortCriteria = [];
		} else {
			this.columnConfiguration.sortCriteria =
				this.columnConfiguration.sortCriteria.map((c) => ({
					...c,
					uid:
						(c as any).uid ||
						Math.random().toString(36).slice(2, 10),
				}));
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
				// Use stable uid attributes on DOM rows to determine new order
				const uidsInDom = Array.from(sortingCriteriaList.children).map(
					(child) => child.getAttribute("data-uid")
				);
				const existing = this.columnConfiguration.sortCriteria || [];
				const newOrder: ColumnData["sortCriteria"] = [];
				uidsInDom.forEach((uid, idx) => {
					if (!uid) return;
					const found = existing.find((c) => (c as any).uid === uid);
					if (found) {
						found.priority = idx + 1;
						newOrder.push(found);
					}
				});
				this.columnConfiguration.sortCriteria = newOrder;
				this.isEdited = true;
				// Re-render to refresh indices and listeners
				renderSortingCriterias();
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
						attr: {
							"data-criteria-name": sortCriteria.criteria,
							"data-uid": (sortCriteria as any).uid,
						},
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
							if (
								this.plugin.settings.data
									.experimentalFeatures
							) {
								dropdown.addOption(
									"manualOrder",
									t("manual-order")
								);
							}

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
									this.isEdited = true;
									if (this.columnConfiguration.sortCriteria) {
										if (value === "manualOrder") {
											renderSortingCriterias(); // Re-render if manualOrder is selected
											// Remove all the other sort criteria
											this.columnConfiguration.sortCriteria =
												[];
											// Add manualOrder sort criteria
											this.columnConfiguration.sortCriteria[0].criteria =
												value as columnSortingCriteria["criteria"];
										} else {
											this.columnConfiguration.sortCriteria[
												index
											].criteria =
												value as columnSortingCriteria["criteria"];
										}
									}
								});
						})
						.addDropdown((dropdown) => {
							if (sortCriteria.criteria !== "manualOrder") {
								dropdown
									.addOption("asc", t("ascending")) // Ascending might mean different things (e.g., High -> Low for priority)
									.addOption("desc", t("descending")) // Descending might mean different things (e.g., Low -> High for priority)
									.setValue(sortCriteria.order)
									.onChange((value: string) => {
										if (
											this.columnConfiguration
												.sortCriteria
										) {
											this.columnConfiguration.sortCriteria[
												index
											].order =
												value as columnSortingCriteria["order"];
										}
										this.isEdited = true;
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
							} else {
								dropdown.selectEl.remove();
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
									this.isEdited = true;
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

			if (
				this.columnConfiguration.sortCriteria.some(
					(c) => c.criteria === "manualOrder"
				)
			) {
				new Setting(sortingCriteriaList)
					.setClass(
						"configureColumnSortingModalHomeSortingCriteriaListItemNotice"
					)
					.setName(t("note"))
					.setDesc(t("manual-order-notice"));
			}
		};

		// Initial render
		renderSortingCriterias();

		const addNewSortingButton = homeComponent.createEl("button", {
			text: t("add-new-sorting-criterion"),
			cls: "configureColumnSortingModalHomeAddSortingBtn",
		});
		addNewSortingButton.addEventListener("click", async () => {
			if (
				this.columnConfiguration.sortCriteria?.some(
					(c) => c.criteria === "manualOrder"
				)
			) {
				new Notice(
					t("cannot-add-more-sorting-criteria-with-manual-order")
				);
			} else {
				this.isEdited = true;
				const newCriteria: any = {
					criteria: "content",
					order: "asc",
					priority:
						(this.columnConfiguration.sortCriteria?.length || 0) +
						1,
					uid: Math.random().toString(36).slice(2, 10),
				};
				if (!this.columnConfiguration.sortCriteria) {
					this.columnConfiguration.sortCriteria = [];
				}
				this.columnConfiguration.sortCriteria.push(newCriteria);
				renderSortingCriterias();
			}
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
			this.isEdited = false;
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

	handleCloseAttempt() {
		// Open confirmation modal
		const mssg = t("edit-task-modal-close-confirm-mssg");
		const closeConfirmModal = new ClosePopupConfrimationModal(this.app, {
			app: this.app,
			mssg,
			onDiscard: () => {
				this.isEdited = false;
				this.close();
			},
			onGoBack: () => {
				// Do nothing
			},
		});
		closeConfirmModal.open();
	}

	public close(): void {
		if (this.isEdited) {
			this.handleCloseAttempt();
		} else {
			this.onClose();
			super.close();
		}
	}
}
