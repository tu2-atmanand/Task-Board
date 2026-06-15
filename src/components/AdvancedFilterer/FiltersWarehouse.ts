import { t } from "i18next";
import {
	Modal,
	setIcon,
	ExtraButtonComponent,
	DropdownComponent,
} from "obsidian";
import type TaskBoard from "../../../main.js";
import type {
	Filter,
	FilterCriterionGroup,
	FilterCriterion,
	FiltersWarehouse,
} from "../../interfaces/BoardConfigs.js";
import { generateIdForFilters } from "./Component.js";
import {
	getCustomStatusOptionsForDropdown,
	getPriorityOptionsForDropdown,
} from "../../interfaces/Mapping.js";
import {
	MultiSuggest,
	getTagSuggestions,
	getFileSuggestions,
} from "../../services/MultiSuggest.js";

export class FiltersWarehouseModal extends Modal {
	private plugin: TaskBoard;
	private onImport?: (filters: Filter[]) => void;
	private onCancel?: () => void;
	private selectedFilterIds = new Set<string>();
	private edited: boolean = false;
	private _filtersWarehouseData: FiltersWarehouse;
	get filtersWarehouseData() {
		return this._filtersWarehouseData;
	}
	set filtersWarehouseData(newData: FiltersWarehouse) {
		this.edited = true;
		this._filtersWarehouseData = newData;
	}

	private _saveBtn: HTMLButtonElement | null = null;
	private _importBtn: HTMLButtonElement | null = null;
	private _clearBtn: HTMLButtonElement | null = null;

	private expandedFilters = new WeakMap<Filter, boolean>();

	private multiSuggestInstances = new WeakMap<
		HTMLInputElement,
		MultiSuggest
	>();

	public isMultiSuggestDropdownActive = false;

	public conditionsRequiringValue = [
		"equals",
		"contains",
		"doesNotContain",
		"startsWith",
		"endsWith",
		"is",
		"isNot",
		">",
		"<",
		">=",
		"<=",
		"before",
		"onOrBefore",
		"after",
		"onOrAfter",
	];

	constructor(
		plugin: TaskBoard,
		onImport?: (filters: Filter[]) => void,
		onCancel?: () => void,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this._filtersWarehouseData = plugin.settings.data.filtersWarehouse;
		this.onImport = onImport;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.setTitle(t("task-board-filters-warehouse"));

		this.render();
	}

	onClose() {
		this.multiSuggestInstances = new WeakMap();
		const { contentEl } = this;
		contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const filtersList = contentEl.createDiv({
			cls: "advanced-filters-list",
		});

		const warehouseFilters =
			this.plugin.settings.data.filtersWarehouse || [];

		if (warehouseFilters.length === 0) {
			contentEl.createEl("p", {
				text: "No filters saved in the warehouse yet.",
				cls: "compact-text",
			});
			return;
		}

		warehouseFilters.forEach((filter, index) => {
			const filterEl = this.createFilterListItem(filter, index);
			filtersList.appendChild(filterEl);
		});

		this.renderStickyFooter();
	}

	private renderStickyFooter(): void {
		const { contentEl } = this;

		const footer = contentEl.createDiv({
			cls: "filters-warehouse-footer",
		});

		const leftSection = footer.createDiv({
			cls: "filters-warehouse-footer-left",
		});

		const importBtn = leftSection.createEl("button", {
			cls: ["compact-btn"],
			text: "Import selected filters",
		});
		importBtn.disabled = true;

		importBtn.addEventListener("click", () => {
			const warehouse = this.plugin.settings.data.filtersWarehouse || [];
			const selectedFilters = warehouse.filter((f) =>
				this.selectedFilterIds.has(f.id),
			);
			if (selectedFilters.length > 0) {
				if (this.onImport) {
					this.onImport(selectedFilters);
				}
				this.close();
			}
		});

		const clearBtn = leftSection.createEl("button", {
			cls: ["compact-btn"],
			text: "Clear selections",
		});
		clearBtn.hide();
		clearBtn.addEventListener("click", () => {
			this.selectedFilterIds.clear();
			contentEl
				.querySelectorAll<HTMLInputElement>(
					".filters-warehouse-checkbox",
				)
				.forEach((cb) => {
					cb.checked = false;
				});
			this.updateActionButtonsState(importBtn, clearBtn);
		});

		const rightSection = footer.createDiv({
			cls: "filters-warehouse-footer-right",
		});

		const saveBtn = rightSection.createEl("button", {
			cls: ["compact-btn"],
			text: t("save-changes"),
		});
		saveBtn.hide();
		saveBtn.addEventListener("click", () => {
			this.saveWarehouse();
		});
		this._saveBtn = saveBtn;
		if (this.edited) {
			this._saveBtn.show();
		}

		// No need of a special close button. An Obsidian modal already has one at top-right corner.
		// const closeBtn = rightSection.createEl("button", {
		// 	cls: ["compact-btn"],
		// 	text: "Close",
		// });
		// closeBtn.addEventListener("click", () => {
		// 	this.close();
		// });

		this._importBtn = importBtn;
		this._clearBtn = clearBtn;
		this._saveBtn = saveBtn;
	}

	private updateActionButtonsState(
		importBtn?: HTMLButtonElement,
		clearBtn?: HTMLButtonElement,
	): void {
		const btnImport = importBtn || this._importBtn;
		const btnClear = clearBtn || this._clearBtn;
		if (!btnImport || !btnClear) return;

		const hasSelection = this.selectedFilterIds.size > 0;
		btnImport.disabled = !hasSelection;
		if (hasSelection) btnClear.show();
		else btnClear.hide();
	}

	private createFilterListItem(filter: Filter, index: number): HTMLElement {
		const container = createEl("div", {
			cls: "advanced-filter-list-item",
		});

		const topSection = container.createDiv({
			cls: "advanced-filter-top-section",
		});

		const leftSection = topSection.createDiv({
			cls: "advanced-filter-top-left",
		});

		const checkboxAndTitle = leftSection.createDiv({
			cls: "advanced-filter-top-left-upper",
		});

		const checkbox = checkboxAndTitle.createEl("input", {
			attr: { type: "checkbox" },
			cls: "filters-warehouse-checkbox",
		});
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				this.selectedFilterIds.add(filter.id);
			} else {
				this.selectedFilterIds.delete(filter.id);
			}
			this.updateActionButtonsState();
		});

		checkboxAndTitle.createEl("span", {
			cls: "filter-name-text",
			text: filter.name || "Untitled filter",
		});

		const topRightSection = topSection.createDiv({
			cls: "advanced-filter-top-right",
		});

		const deleteBtn = topRightSection.createDiv({
			cls: "advanced-filter-top-right-toggle-btn",
		});

		deleteBtn.createEl(
			"div",
			{
				cls: ["filter-menu-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "filter-menu-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "trash-2");
					},
				);
				el.addEventListener("click", () => {
					this.removeFilterFromWarehouse(filter);
				});
			},
		);

		if (filter.description) {
			const middleSection = container.createDiv({
				cls: "advanced-filter-description-section",
			});
			middleSection.createEl("span", {
				cls: "filter-description-text",
				text: filter.description,
			});
		}

		const bottomSection = container.createDiv({
			cls: "advanced-filter-bottom-section",
		});

		const expandableArea = container.createDiv({
			cls: "advanced-filter-expandable-area",
		});
		expandableArea.hide();

		// const expandBtn = bottomSection.createEl("button", {
		// 	cls: ["expand-filter-btn", "compact-btn"],
		// 	text: "Expand to edit",
		// });

		// Render for the first time
		this.collapseFilter(filter, expandableArea, bottomSection);

		this.plugin.registerDomEvent(bottomSection, "click", () => {
			const isExpanded = this.expandedFilters.get(filter) ?? false;
			if (isExpanded) {
				this.collapseFilter(filter, expandableArea, bottomSection);
			} else {
				this.expandFilter(filter, expandableArea, bottomSection);
			}
		});

		return container;
	}

	private collapseFilter(
		filter: Filter,
		expandableArea: HTMLElement,
		expandBtn: HTMLDivElement,
	): void {
		expandableArea.toggleClass("expand", false);
		expandableArea.toggleClass("collapse", true);

		expandBtn.replaceChildren();
		expandBtn.createEl(
			"div",
			{
				cls: ["expand-filter-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-criterion-group-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "chevron-down");
					},
				);
				el.createEl("span", {
					cls: "add-criterion-group-btn-text",
					text: t("expand-to-edit"),
				});
			},
		);

		this.expandedFilters.set(filter, false);
		window.setTimeout(() => {
			expandableArea.hide();
		}, 300);
	}

	private expandFilter(
		filter: Filter,
		expandableArea: HTMLElement,
		expandBtn: HTMLDivElement,
	): void {
		if (expandableArea.children.length === 0) {
			this.renderExpandedFilterContent(filter, expandableArea);
		}
		expandableArea.show();
		expandableArea.toggleClass("collapse", false);
		expandableArea.toggleClass("expand", true);

		expandBtn.replaceChildren();
		expandBtn.createEl(
			"div",
			{
				cls: ["expand-filter-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-criterion-group-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "chevron-up");
					},
				);
				el.createEl("span", {
					cls: "add-criterion-group-btn-text",
					text: t("minimize"),
				});
			},
		);

		this.expandedFilters.set(filter, true);
	}

	private renderExpandedFilterContent(
		filter: Filter,
		container: HTMLElement,
	): void {
		const nameSetting = container.createDiv({
			cls: "filter-name-setting",
		});
		nameSetting.createEl("label", {
			text: "Filter name",
			cls: "compact-text",
		});
		const nameInput = nameSetting.createEl("input", {
			cls: ["compact-input", "filter-name-input"],
			attr: { placeholder: "Enter filter name" },
		});
		nameInput.value = filter.name;
		nameInput.addEventListener("input", () => {
			filter.name = nameInput.value;
			const listItem = container.closest(".advanced-filter-list-item");
			if (listItem) {
				const nameText = listItem.querySelector(".filter-name-text");
				if (nameText) {
					nameText.textContent = filter.name || "Untitled filter";
				}
			}
			this.markAsEdited();
		});

		const descSetting = container.createDiv({
			cls: "filter-desc-setting",
		});
		descSetting.createEl("label", {
			text: "Filter description",
			cls: "compact-text",
		});
		const descInput = descSetting.createEl("input", {
			cls: ["compact-input", "filter-desc-input"],
			attr: { placeholder: "Enter filter description" },
		});
		descInput.value = filter.description || "";
		descInput.addEventListener("input", () => {
			filter.description = descInput.value || undefined;
			const listItem = container.closest(".advanced-filter-list-item");
			if (listItem) {
				const descText = listItem.querySelector(
					".filter-description-text",
				);
				if (descText) {
					if (filter.description) {
						descText.textContent = filter.description;
						descText.removeAttribute("style");
					} else {
						(descText as HTMLElement).hide();
					}
				} else if (filter.description) {
					const leftSection = listItem.querySelector(
						".advanced-filter-top-left",
					);
					if (leftSection) {
						leftSection.createEl("span", {
							cls: "filter-description-text",
							text: filter.description,
						});
					}
				}
			}
			this.markAsEdited();
		});

		const innerSection = container.createDiv({
			cls: "filter-inner-section",
		});

		const filterRootConditionSection = innerSection.createDiv({
			cls: "criterion-group-condition-section",
		});
		filterRootConditionSection.createEl("label", {
			text: t("match"),
			cls: ["compact-text", "root-condition-label"],
		});

		const filterRootConditionDropdown = new DropdownComponent(
			filterRootConditionSection,
		)
			.addOptions({
				any: t("any"),
				all: t("all"),
				none: t("none"),
			})
			.setValue(filter.rootCondition)
			.onChange((value) => {
				filter.rootCondition = value as "all" | "any" | "none";
				this.updateGroupSeparatorsForFilter(
					filter,
					filterGroupsContainerEl,
				);
				this.markAsEdited();
			});
		filterRootConditionDropdown.selectEl.toggleClass(
			["compact-select", "root-condition-select"],
			true,
		);

		filterRootConditionSection.createEl("span", {
			cls: ["compact-text", "root-condition-label"],
			text: t("of-the-below-criterion-groups"),
		});

		const filterGroupsContainerEl = innerSection.createDiv({
			cls: "criterion-group-container",
		});

		const validGroups = (filter.filterGroups || []).filter(
			(groupData) =>
				groupData &&
				typeof groupData === "object" &&
				groupData.groupCondition &&
				Array.isArray(groupData.filters),
		);

		if (validGroups.length !== (filter.filterGroups || []).length) {
			filter.filterGroups = validGroups;
		}

		validGroups.forEach((groupData) => {
			const groupElement = this.createFilterGroupElement(
				groupData,
				filter,
				filterGroupsContainerEl,
			);
			filterGroupsContainerEl.appendChild(groupElement);
		});

		this.updateGroupSeparatorsForFilter(filter, filterGroupsContainerEl);

		const addGroupSection = innerSection.createDiv({
			cls: "add-group-section",
		});

		addGroupSection.createEl(
			"div",
			{
				cls: ["add-criterion-group-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-criterion-group-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "plus");
					},
				);
				el.createEl("span", {
					cls: "add-criterion-group-btn-text",
					text: t("add-criterion-group"),
				});

				el.addEventListener("click", () => {
					this.addFilterGroupToFilter(
						filter,
						filterGroupsContainerEl,
					);
				});
			},
		);
	}

	// ===================== FILTER GROUP MANAGEMENT =====================

	private createFilterGroupElement(
		groupData: FilterCriterionGroup,
		filter: Filter,
		filterGroupsContainerEl: HTMLElement,
	): HTMLElement {
		const newGroupEl = createEl("div", {
			attr: { id: groupData.id },
			cls: ["criterion-group"],
		});

		const groupHeader = newGroupEl.createDiv({
			cls: ["criterion-group-header"],
		});

		const groupHeaderLeft = groupHeader.createDiv({
			cls: ["criterion-group-header-left"],
		});

		groupHeaderLeft.createEl("label", {
			cls: ["compact-text"],
			text: t("match"),
		});

		const groupConditionSelect = new DropdownComponent(groupHeaderLeft)
			.addOptions({
				all: t("all"),
				any: t("any"),
				none: t("none"),
			})
			.onChange((value) => {
				groupData.groupCondition = value as "all" | "any" | "none";
				this.updateFilterConjunctions(
					newGroupEl.querySelector(".filters-list"),
					groupData.groupCondition,
				);
				this.markAsEdited();
			})
			.setValue(groupData.groupCondition);
		groupConditionSelect.selectEl.toggleClass(
			["group-condition-select", "compact-select"],
			true,
		);

		groupHeaderLeft.createEl("span", {
			cls: ["compact-text"],
			text: t("criterion-in-this-group"),
		});

		const groupHeaderRight = groupHeader.createDiv({
			cls: ["criterion-group-header-right"],
		});

		const removeGroupBtn = new ExtraButtonComponent(groupHeaderRight)
			.setIcon("trash-2")
			.setTooltip(t("remove-criterion-group"))
			.onClick(() => {
				filter.filterGroups = filter.filterGroups.filter(
					(g) => g.id !== groupData.id,
				);
				newGroupEl.remove();
				const nextSibling = newGroupEl.nextElementSibling;
				if (
					nextSibling &&
					nextSibling.classList.contains(
						"criterion-group-separator-container",
					)
				) {
					nextSibling.remove();
				} else {
					const prevSibling = newGroupEl.previousElementSibling;
					if (
						prevSibling &&
						prevSibling.classList.contains(
							"criterion-group-separator-container",
						)
					) {
						prevSibling.remove();
					}
				}
				this.updateGroupSeparatorsForFilter(
					filter,
					filterGroupsContainerEl,
				);
				this.markAsEdited();
			});
		removeGroupBtn.extraSettingsEl.addClasses([
			"remove-group-btn",
			"clickable-icon",
		]);

		const filtersListEl = newGroupEl.createDiv({
			cls: ["filters-list"],
		});

		groupData.filters.forEach((filterData) => {
			const filterElement = this.createFilterItemElement(
				filterData,
				groupData,
			);
			filtersListEl.appendChild(filterElement);
		});
		this.updateFilterConjunctions(filtersListEl, groupData.groupCondition);

		const groupFooter = newGroupEl.createDiv({
			cls: ["group-footer"],
		});

		groupFooter.createEl(
			"div",
			{
				cls: ["add-criterion-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-criterion-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "plus");
					},
				);
				el.createEl("span", {
					cls: "add-criterion-btn-text",
					text: t("add-criterion"),
				});

				el.addEventListener("click", () => {
					this.addFilterToGroup(groupData, filtersListEl);
				});
			},
		);

		return newGroupEl;
	}

	private addFilterGroupToFilter(
		filter: Filter,
		filterGroupsContainerEl: HTMLElement,
	): void {
		const newGroupId = generateIdForFilters();
		const newGroupData: FilterCriterionGroup = {
			id: newGroupId,
			groupCondition: "all",
			filters: [],
		};

		filter.filterGroups.push(newGroupData);

		const newGroupElement = this.createFilterGroupElement(
			newGroupData,
			filter,
			filterGroupsContainerEl,
		);
		filterGroupsContainerEl.appendChild(newGroupElement);

		this.addFilterToGroup(
			newGroupData,
			newGroupElement.querySelector(".filters-list") as HTMLElement,
		);

		this.updateGroupSeparatorsForFilter(filter, filterGroupsContainerEl);
		this.markAsEdited();
	}

	// ===================== FILTER ITEM MANAGEMENT =====================

	private createFilterItemElement(
		filterData: FilterCriterion,
		groupData: FilterCriterionGroup,
	): HTMLElement {
		const newFilterEl = createEl("div", {
			attr: { id: filterData.id },
			cls: ["filter-item"],
		});

		if (groupData.groupCondition === "any") {
			newFilterEl.createEl("span", {
				cls: ["filter-conjunction"],
				text: t("or"),
			});
		} else if (groupData.groupCondition === "none") {
			newFilterEl.createEl("span", {
				cls: ["filter-conjunction"],
				text: t("nor"),
			});
		} else {
			newFilterEl.createEl("span", {
				cls: ["filter-conjunction"],
				text: t("and"),
			});
		}

		const propertySelect = new DropdownComponent(newFilterEl);
		propertySelect.selectEl.addClasses([
			"filter-property-select",
			"compact-select",
		]);

		const conditionSelect = new DropdownComponent(newFilterEl);
		conditionSelect.selectEl.addClasses([
			"filter-condition-select",
			"compact-select",
		]);

		const valueInput = newFilterEl.createEl("input", {
			cls: ["filter-value-input", "compact-input"],
		});
		valueInput.hide();
		valueInput.addEventListener("click", () => {
			this.isMultiSuggestDropdownActive = true;
			window.setTimeout(() => {
				this.isMultiSuggestDropdownActive = false;
			}, 100);
		});
		const dropdownInputContainer = newFilterEl.createEl("div", {
			cls: ["filter-value-input-container"],
		});
		const valueSelect = new DropdownComponent(dropdownInputContainer);
		valueSelect.selectEl.addClasses([
			"filter-value-select",
			"compact-select",
		]);

		propertySelect.onChange((value) => {
			filterData.property = value;
			this.updateFilterPropertyOptions(
				newFilterEl,
				filterData,
				propertySelect,
				conditionSelect,
				valueInput,
				valueSelect,
				dropdownInputContainer,
			);
			this.markAsEdited();
		});

		const toggleValueInputVisibility = (
			currentCond: string,
			propertyType: string,
		) => {
			let valueActuallyNeeded =
				this.conditionsRequiringValue.includes(currentCond);

			if (
				propertyType === "completed" &&
				(currentCond === "isTrue" || currentCond === "isFalse")
			) {
				valueActuallyNeeded = false;
			}
			if (currentCond === "isEmpty" || currentCond === "isNotEmpty") {
				valueActuallyNeeded = false;
			}

			const propertyValue = propertySelect.getValue();
			if (propertyValue === "priority" || propertyValue === "status") {
				valueInput.hide();
				if (valueActuallyNeeded) dropdownInputContainer.show();
				else dropdownInputContainer.hide();
			} else {
				dropdownInputContainer.hide();
				if (valueActuallyNeeded) valueInput.show();
				else valueInput.hide();
			}

			if (!valueActuallyNeeded && filterData.value !== undefined) {
				filterData.value = undefined;
				valueInput.value = "";
			}
		};

		conditionSelect.onChange((newCondition) => {
			filterData.condition = newCondition;
			toggleValueInputVisibility(newCondition, filterData.property);
			this.markAsEdited();
		});

		valueInput.value = filterData.value || "";

		valueInput.addEventListener("input", (event) => {
			filterData.value = (event.target as HTMLInputElement).value;
			this.markAsEdited();
		});

		const removeFilterBtn = new ExtraButtonComponent(newFilterEl)
			.setIcon("trash-2")
			.setTooltip(t("remove-filter"))
			.onClick(() => {
				groupData.filters = groupData.filters.filter(
					(f) => f.id !== filterData.id,
				);
				newFilterEl.remove();
				this.updateFilterConjunctions(
					newFilterEl.parentElement,
					groupData.groupCondition,
				);
				this.markAsEdited();
			});
		removeFilterBtn.extraSettingsEl.addClasses([
			"remove-filter-btn",
			"clickable-icon",
		]);

		this.updateFilterPropertyOptions(
			newFilterEl,
			filterData,
			propertySelect,
			conditionSelect,
			valueInput,
			valueSelect,
			dropdownInputContainer,
		);

		return newFilterEl;
	}

	private addFilterToGroup(
		groupData: FilterCriterionGroup,
		filtersListEl: HTMLElement,
	): void {
		const newFilterId = generateIdForFilters();
		const newFilterData: FilterCriterion = {
			id: newFilterId,
			property: "content",
			condition: "contains",
			value: "",
		};
		groupData.filters.push(newFilterData);

		const newFilterElement = this.createFilterItemElement(
			newFilterData,
			groupData,
		);
		filtersListEl.appendChild(newFilterElement);

		this.updateFilterConjunctions(filtersListEl, groupData.groupCondition);
		this.markAsEdited();
	}

	private updateFilterPropertyOptions(
		filterItemEl: HTMLElement,
		filterData: FilterCriterion,
		propertySelect: DropdownComponent,
		conditionSelect: DropdownComponent,
		valueInput: HTMLInputElement,
		valueSelect: DropdownComponent,
		dropdownInputContainer: HTMLElement,
	): void {
		const property = filterData.property;

		if (propertySelect.selectEl.options.length === 0) {
			propertySelect.addOptions({
				content: t("content"),
				id: t("id"),
				status: t("status"),
				priority: t("priority"),
				tags: t("tags"),
				createdDate: t("created-date"),
				startDate: t("start-date"),
				scheduledDate: t("scheduled-date"),
				due: t("due-date"),
				completedDate: t("completed-date"),
				cancelledDate: t("cancelled-date"),
				startTime: t("start-time"),
				reminder: t("reminder"),
				dependencies: t("dependencies"),
				filePath: t("file-path"),
			});
		}
		propertySelect.setValue(property);

		let conditionOptions: { value: string; text: string }[] = [];
		const setConditionOptions = (
			options: { value: string; text: string }[],
		) => {
			conditionOptions = options;
		};

		switch (property) {
			case "content":
				valueInput.type = "text";
				setConditionOptions([
					{ value: "contains", text: t("contains") },
					{ value: "doesNotContain", text: t("does-not-contain") },
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: "startsWith", text: t("starts-with") },
					{ value: "endsWith", text: t("ends-with") },
				]);
				break;
			case "filePath":
				valueInput.type = "text";
				setConditionOptions([
					{ value: "contains", text: t("contains") },
					{ value: "doesNotContain", text: t("does-not-contain") },
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: "startsWith", text: t("starts-with") },
					{ value: "endsWith", text: t("ends-with") },
				]);
				break;
			case "status":
				valueInput.hide();
				{
					const statusOptions = getCustomStatusOptionsForDropdown(
						this.plugin.settings.data.customStatuses,
						{ mode: "grouped" },
					);
					const optionsRecord: Record<string, string> = {};
					if (statusOptions.type === "grouped") {
						statusOptions.groups.forEach((group) => {
							optionsRecord[`__group_${group.type}__`] =
								`── ${group.label} ──`;
							group.options.forEach((opt) => {
								optionsRecord[opt.value] = opt.label;
							});
						});
					} else {
						statusOptions.options.forEach((opt) => {
							optionsRecord[opt.value] = opt.label;
						});
					}
					valueSelect.addOptions(optionsRecord);
					window.setTimeout(() => {
						Array.from(valueSelect.selectEl.options).forEach(
							(option) => {
								if (option.value.startsWith("__group_")) {
									option.disabled = true;
									option.addClass(
										"taskboard_customstatus_dropdown_option",
									);
								}
							},
						);
					}, 0);

					valueSelect.setValue(
						filterData.value ||
							getPriorityOptionsForDropdown()[0].value.toString(),
					);
					valueSelect.onChange((newValue) => {
						filterData.value = newValue;
						this.markAsEdited();
					});
				}
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
				]);
				break;
			case "priority":
				valueInput.hide();
				{
					valueSelect.addOptions(
						getPriorityOptionsForDropdown().reduce(
							(
								acc: Record<number | string, string>,
								opt: { value: number; text: string },
							) => {
								acc[opt.value] = opt.text;
								return acc;
							},
							{},
						),
					);
					valueSelect.setValue(
						filterData.value ||
							getPriorityOptionsForDropdown()[0].value.toString(),
					);
					valueSelect.onChange((newValue) => {
						filterData.value = newValue;
						this.markAsEdited();
					});
				}
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: ">", text: ">" },
					{ value: "<", text: "<" },
					{ value: ">=", text: ">=" },
					{ value: "<=", text: "<=" },
					{ value: "isEmpty", text: t("is-empty") },
					{ value: "isNotEmpty", text: t("is-not-empty") },
				]);
				break;
			case "id":
				valueInput.type = "text";
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: ">", text: ">" },
					{ value: "<", text: "<" },
					{ value: ">=", text: ">=" },
					{ value: "<=", text: "<=" },
					{ value: "isEmpty", text: t("is-empty") },
					{ value: "isNotEmpty", text: t("is-not-empty") },
				]);
				break;
			case "createdDate":
			case "due":
			case "startDate":
			case "scheduledDate":
			case "completedDate":
			case "cancelledDate":
				valueInput.type = "date";
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: "before", text: t("before") },
					{ value: "onOrBefore", text: t("on-or-before") },
					{ value: "after", text: t("after") },
					{ value: "onOrAfter", text: t("on-or-after") },
					{ value: "isEmpty", text: t("is-empty") },
					{ value: "isNotEmpty", text: t("is-not-empty") },
				]);
				break;
			case "startTime":
				valueInput.type = "time";
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: "before", text: t("before") },
					{ value: "onOrBefore", text: t("on-or-before") },
					{ value: "after", text: t("after") },
					{ value: "onOrAfter", text: t("on-or-after") },
					{ value: "isEmpty", text: t("is-empty") },
					{ value: "isNotEmpty", text: t("is-not-empty") },
				]);
				break;
			case "tags":
				valueInput.type = "text";
				setConditionOptions([
					{ value: "contains", text: t("contains-string") },
					{
						value: "doesNotContain",
						text: t("does-not-contains-string"),
					},
					{ value: "isEmpty", text: t("are-empty") },
					{ value: "isNotEmpty", text: t("are-not-empty") },
				]);
				break;
			default:
				valueInput.type = "text";
				setConditionOptions([
					{ value: "is", text: t("is") },
					{ value: "isNot", text: t("is-not") },
					{ value: "contains", text: t("contains") },
					{ value: "doesNotContain", text: t("does-not-contains") },
					{ value: "isEmpty", text: t("is-empty") },
					{ value: "isNotEmpty", text: t("is-not-empty") },
				]);
		}

		conditionSelect.selectEl.empty();
		conditionOptions.forEach(
			(opt) => void conditionSelect.addOption(opt.value, opt.text),
		);

		const currentSelectedCondition = filterData.condition;
		if (
			conditionOptions.some(
				(opt) => opt.value === currentSelectedCondition,
			)
		) {
			conditionSelect.setValue(currentSelectedCondition);
		} else if (conditionOptions.length > 0) {
			conditionSelect.setValue(conditionOptions[0].value);
			filterData.condition = conditionOptions[0].value;
		}

		const finalConditionVal = conditionSelect.getValue();
		let valueActuallyNeeded =
			this.conditionsRequiringValue.includes(finalConditionVal);
		if (
			finalConditionVal === "isEmpty" ||
			finalConditionVal === "isNotEmpty"
		) {
			valueActuallyNeeded = false;
		}

		const propertyValue = propertySelect.getValue();
		if (propertyValue === "priority" || propertyValue === "status") {
			valueInput.hide();
			if (valueActuallyNeeded) dropdownInputContainer.show();
			else dropdownInputContainer.hide();
		} else {
			dropdownInputContainer.hide();
			if (valueActuallyNeeded) valueInput.show();
			else valueInput.hide();
		}

		if (valueActuallyNeeded) {
			if (filterData.value !== undefined) {
				valueInput.value = filterData.value;
			} else {
				if (valueInput.value !== "") {
					valueInput.value = "";
				}
			}
		} else {
			valueInput.value = "";
			if (filterData.value !== undefined) {
				filterData.value = undefined;
			}
		}

		if (valueInput.instanceOf(HTMLInputElement)) {
			this.setupMultiSuggest(property, valueInput, filterData);
		}
	}

	private setupMultiSuggest(
		property: string,
		valueInput: HTMLInputElement,
		filterData: FilterCriterion,
	): void {
		const propertiesWithSuggestions = ["tags", "filePath"];
		if (!propertiesWithSuggestions.includes(property)) {
			return;
		}

		const existingInstance = this.multiSuggestInstances.get(valueInput);
		if (existingInstance) {
			existingInstance.close();
			this.multiSuggestInstances.delete(valueInput);
		}

		let suggestions: string[] = [];
		switch (property) {
			case "tags":
				suggestions = getTagSuggestions(this.app);
				break;
			case "filePath":
				suggestions = getFileSuggestions(this.app);
				break;
		}

		const onSelectCallback = (value: string) => {
			filterData.value = value.replace("#", "");
			this.markAsEdited();
		};

		const multiSuggestInstance = new MultiSuggest(
			valueInput,
			new Set(suggestions),
			onSelectCallback,
			this.app,
		);
		multiSuggestInstance.setAutoDestroy(valueInput);
		this.multiSuggestInstances.set(valueInput, multiSuggestInstance);
	}

	// ===================== UI UPDATES =====================

	private updateFilterConjunctions(
		filtersListEl: HTMLElement | null,
		groupCondition: "all" | "any" | "none" = "all",
	): void {
		if (!filtersListEl) return;
		const filters = filtersListEl.querySelectorAll(".filter-item");
		filters.forEach((filter, index) => {
			const conjunctionElement = filter.querySelector(
				".filter-conjunction",
			) as HTMLElement;
			if (conjunctionElement) {
				if (index !== 0) {
					conjunctionElement.show();
					if (groupCondition === "any") {
						conjunctionElement.textContent = t("or");
					} else if (groupCondition === "none") {
						conjunctionElement.textContent = t("nor");
					} else {
						conjunctionElement.textContent = t("and");
					}
				} else {
					conjunctionElement.hide();
					if (groupCondition === "any") {
						conjunctionElement.textContent = t("or");
					} else if (groupCondition === "none") {
						conjunctionElement.textContent = t("not");
					} else {
						conjunctionElement.textContent = t("and");
					}
				}
			}
		});
	}

	private updateGroupSeparatorsForFilter(
		filter: Filter,
		filterGroupsContainerEl: HTMLElement,
	): void {
		filterGroupsContainerEl
			?.querySelectorAll(".criterion-group-separator-container")
			.forEach((sep) => sep.remove());

		const groups = Array.from(
			filterGroupsContainerEl?.children || [],
		).filter((child) => child.classList.contains("criterion-group"));

		if (groups.length > 1) {
			groups.forEach((group, index) => {
				if (index < groups.length - 1) {
					const separatorContainer = createEl("div", {
						cls: "criterion-group-separator-container",
					});
					const separator = separatorContainer.createDiv({
						cls: "criterion-group-separator",
					});

					const rootCond = filter.rootCondition;
					let separatorText = t("or");
					if (rootCond === "all") separatorText = t("and");
					else if (rootCond === "none") separatorText = t("nor");

					separator.textContent = separatorText.toUpperCase();
					group.parentNode?.insertBefore(
						separatorContainer,
						group.nextSibling,
					);
				}
			});
		}
	}

	// ===================== WAREHOUSE OPERATIONS =====================

	private removeFilterFromWarehouse(filter: Filter): void {
		const warehouse = this.plugin.settings.data.filtersWarehouse || [];
		const index = warehouse.indexOf(filter);
		if (index === -1) return;

		warehouse.splice(index, 1);
		this._filtersWarehouseData = warehouse;
		this.selectedFilterIds.delete(filter.id);
		this.markAsEdited();
		this.render();
	}

	private saveWarehouse(): void {
		let newSettings = this.plugin.settings;
		newSettings.data.filtersWarehouse = this.filtersWarehouseData;
		void this.plugin.saveSettings(newSettings);
		if (this._saveBtn) {
			this._saveBtn.hide();
		}
		this.edited = false;
	}

	private markAsEdited(): void {
		this.edited = true;
		if (this._saveBtn) {
			this._saveBtn.show();
		}
	}
}
