// src/components/AdvancedFilterer/Component.ts

import { t } from "i18next";
import {
	Component,
	ExtraButtonComponent,
	setIcon,
	DropdownComponent,
	App,
	setTooltip,
	Notice,
	ToggleComponent,
	Menu,
} from "obsidian";
import Sortable from "sortablejs";
import TaskBoard from "../../../main.js";
import {
	Filter,
	FilterCriterionGroup,
	FilterCriterion,
	AdvancedFilter,
} from "../../interfaces/BoardConfigs.js";
import {
	getCustomStatusOptionsForDropdown,
	getPriorityOptionsForDropdown,
	priorityDropDownOption,
} from "../../interfaces/Mapping.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { FiltersWarehouseModal } from "./FiltersWarehouse.js";
import {
	MultiSuggest,
	getTagSuggestions,
	getFileSuggestions,
} from "../../services/MultiSuggest.js";
import { generateRandomStringId } from "../../utils/TaskItemUtils.js";

export class AdvancedFilterComponent extends Component {
	private hostEl: HTMLElement;
	private advancedFilter!: AdvancedFilter;
	private plugin: TaskBoard;
	private app: App;
	private currentBoardID: string;
	private entity: "board" | "view" | "column";
	private parentFiltersAreActive: boolean;
	private initialFilterState?: AdvancedFilter;

	private expandedFilters = new WeakMap<Filter, boolean>();

	private filtersSortableInstance: Sortable | null = null;

	private multiSuggestInstances = new WeakMap<
		HTMLInputElement,
		MultiSuggest
	>();

	// public isMultiSuggestDropdownActive = false;
	// public isConfigModalOpen = false;
	public isWarehouseModalOpened = false;
	public somethingElseIsOpened = true;
	// get somethingElseIsOpened() {
	// 	return this._isSomethingElseIsOpened;
	// }
	// set somethingElseIsOpened(value: boolean) {
	// 	this._isSomethingElseIsOpened = value;
	// }

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
		hostEl: HTMLElement,
		plugin: TaskBoard,
		app: App,
		currentBoardID: string,
		parentFiltersAreActive: boolean,
		entity: "board" | "view" | "column",
		initialFilterState?: AdvancedFilter,
	) {
		super();
		this.hostEl = hostEl;
		this.plugin = plugin;
		this.app = app;
		this.currentBoardID = currentBoardID;
		this.entity = entity;
		this.parentFiltersAreActive = parentFiltersAreActive;
		this.initialFilterState = initialFilterState;
	}

	onload() {
		if (this.initialFilterState) {
			this.advancedFilter = JSON.parse(
				JSON.stringify(this.initialFilterState),
			);

			this.advancedFilter.filters = this.advancedFilter.filters.filter(
				(filter) =>
					filter &&
					typeof filter === "object" &&
					filter.name !== undefined,
			);

			this.advancedFilter.filters.forEach((filter) => {
				if (filter.filterGroups && Array.isArray(filter.filterGroups)) {
					filter.filterGroups = filter.filterGroups.filter(
						(groupData) =>
							groupData &&
							typeof groupData === "object" &&
							groupData.groupCondition &&
							Array.isArray(groupData.filters),
					);
				} else {
					filter.filterGroups = [];
				}
			});
		} else {
			this.advancedFilter = {
				filters: [],
				rootCondition: "all",
			};
		}

		this.render();
	}

	onunload() {
		if (this.filtersSortableInstance) {
			this.filtersSortableInstance.destroy();
			this.filtersSortableInstance = null;
		}

		this.multiSuggestInstances = new WeakMap();

		this.hostEl.empty();
	}

	close() {
		this.onunload();
	}

	// ===================== RENDERING =====================

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("advanced-filter-menu-container-body");

		const mainPanel = this.hostEl.createDiv({
			cls: "advanced-filter-menu-container-body-main-panel",
		});
		const rootFilterSetupSection = mainPanel.createDiv({
			cls: "advanced-filter-menu-container-body-main-panel-configs",
		});

		this.renderBoardLevelFiltersWarning(rootFilterSetupSection);
		this.renderRootConditionSection(rootFilterSetupSection);
		this.renderFiltersList(rootFilterSetupSection);
		this.renderActionButtons(rootFilterSetupSection);
	}

	private renderBoardLevelFiltersWarning(container: HTMLElement): void {
		if (this.entity === "column" && this.parentFiltersAreActive) {
			const viewLevelFiltersWarning = container.createDiv({
				cls: "parent-level-filters-present-warning",
			});
			viewLevelFiltersWarning.createEl(
				"span",
				{
					cls: "parent-level-filters-present-warning-icon",
				},
				(iconEl) => {
					setIcon(iconEl, "info");
				},
			);
			const viewLevelFiltersWarningMessage =
				viewLevelFiltersWarning.createDiv({
					cls: "parent-level-filters-present-warning-message",
				});
			viewLevelFiltersWarningMessage.createSpan({
				cls: "parent-level-filters-present-warning-text",
				text: "View level filters are active. Tasks will be first filtered through the view level filters. Read more here: ",
			});
			viewLevelFiltersWarningMessage.createEl("a", {
				text: "Advanced filters",
				href: "",
			});
		} else if (this.entity === "view" && this.parentFiltersAreActive) {
			const boardLevelFiltersWarning = container.createDiv({
				cls: "parent-level-filters-present-warning",
				text: "",
			});
			boardLevelFiltersWarning.createEl(
				"span",
				{
					cls: "parent-level-filters-present-warning-icon",
				},
				(iconEl) => {
					setIcon(iconEl, "info");
				},
			);

			const boardLevelFiltersWarningMessage =
				boardLevelFiltersWarning.createDiv({
					cls: "parent-level-filters-present-warning-message",
				});
			boardLevelFiltersWarningMessage.createSpan({
				cls: "parent-level-filters-present-warning-text",
				text: "Board level filters are active. Tasks will be first filtered through the board level filters. Read more here: ",
			});
			boardLevelFiltersWarningMessage.createEl("a", {
				text: "Advanced filters",
				href: "",
			});
		}
	}

	private renderRootConditionSection(container: HTMLElement): void {
		const rootConditionSection = container.createDiv({
			cls: "filters-root-condition-section",
		});

		rootConditionSection.createEl("label", {
			text: t("match"),
			attr: { for: "advanced-filter-root-condition" },
			cls: ["compact-text", "root-condition-label"],
		});

		const rootConditionDropdown = new DropdownComponent(
			rootConditionSection,
		)
			.addOptions({
				any: t("any"),
				all: t("all"),
				none: t("none"),
			})
			.setValue(this.advancedFilter.rootCondition)
			.onChange((value) => {
				this.advancedFilter.rootCondition = value as
					| "all"
					| "any"
					| "none";
			});
		rootConditionDropdown.selectEl.toggleClass("compact-select", true);

		rootConditionSection.createEl("label", {
			cls: ["compact-text", "root-condition-label"],
			text: t("of-the-below-enabled-filters"),
		});
	}

	private renderFiltersList(container: HTMLElement): void {
		const filtersListContainer = container.createDiv({
			cls: "advanced-filters-list",
		});

		this.advancedFilter.filters.forEach((filter, index) => {
			const filterEl = this.createFilterListItem(filter, index);
			filtersListContainer.appendChild(filterEl);
		});

		this.makeFiltersSortable(filtersListContainer);
	}

	private renderActionButtons(container: HTMLElement): void {
		const actionSection = container.createDiv({
			cls: "add-filter-section",
		});

		actionSection.createEl(
			"div",
			{
				cls: ["add-filter-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-filter-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "plus");
					},
				);
				el.createEl("span", {
					cls: "add-filter-btn-text",
					text: t("add-filter"),
				});
				setTooltip(el, t("create-new-filter"));

				this.registerDomEvent(el, "click", () => {
					this.addNewFilter();
				});
			},
		);

		actionSection.createEl(
			"div",
			{
				cls: ["load-filter-config-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "load-filter-config-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "warehouse");
					},
				);
				el.createEl("span", {
					cls: "load-filter-config-btn-text",
					text: t("import-filter"),
				});
				setTooltip(el, t("import-filter-from-filter-warehouse"));

				this.registerDomEvent(el, "click", async () => {
					this.openFiltersWarehouseModal();
				});
			},
		);
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
		const leftUpperSec = leftSection.createDiv({
			cls: "advanced-filter-top-left-upper",
		});
		leftUpperSec.createDiv(
			{
				cls: "drag-handle-container",
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "drag-handle",
					},
					(iconEl) => {
						setIcon(iconEl, "grip-vertical");
					},
				);
			},
		);
		leftUpperSec.createEl("span", {
			cls: "filter-name-text",
			text: filter.name || "Untitled filter",
		});

		// The description section
		if (filter.description) {
			leftSection.createEl("span", {
				cls: "filter-description-text",
				text: filter.description,
			});
		}

		const topRightSection = topSection.createDiv({
			cls: "advanced-filter-top-right",
		});
		// Instead of an ExtraButtonComponent, will create a normal toggle component
		// const toggleBtn = new ExtraButtonComponent(rightSection)
		// 	.setIcon(filter.status ? "toggle-left" : "toggle-right")
		// 	.setTooltip(filter.status ? t("disable") : t("activate"))
		// 	.onClick(() => {
		// 		filter.status = !filter.status;
		// 		toggleBtn.setIcon(
		// 			filter.status ? "toggle-left" : "toggle-right",
		// 		);
		// 		toggleBtn.setTooltip(
		// 			filter.status ? t("disable") : t("activate"),
		// 		);
		// 	});

		const filterToggleBtn = topRightSection.createDiv({
			cls: "advanced-filter-top-right-toggle-btn",
		});

		new ToggleComponent(filterToggleBtn)
			.setValue(filter.status)
			.setTooltip(filter.status ? t("disable") : t("activate"))
			.onChange(() => {
				filter.status = !filter.status;
			});

		const filterMenuBtn = topSection.createDiv({
			cls: "advanced-filter-top-right-toggle-btn",
		});

		filterMenuBtn.createEl(
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
						setIcon(iconEl, "ellipsis-vertical");
					},
				);
				this.registerDomEvent(el, "click", (event: PointerEvent) => {
					this.somethingElseIsOpened = true;
					const filterMenu = new Menu();

					filterMenu.addItem((item) => {
						item.setTitle(t("duplicate-filter"));
						item.setIcon("copy");
						item.onClick(async () => {
							this.duplicateFilter(filter);
						});
					});

					filterMenu.addItem((item) => {
						item.setTitle(t("save-in-warehouse"));
						item.setIcon("warehouse");
						item.onClick(async () => {
							const warehouse =
								this.plugin.settings.data.filtersWarehouse ||
								[];
							const filterCopy = JSON.parse(
								JSON.stringify(filter),
							);
							warehouse.push(filterCopy);

							this.plugin.settings.data.filtersWarehouse =
								warehouse;
							await this.plugin.saveSettings();

							new Notice(
								`Filter "${filter.name}" saved to warehouse.`,
							);
						});
					});

					filterMenu.addItem((item) => {
						item.setTitle(t("delete-filter"));
						item.setIcon("trash-2");
						item.onClick(async () => {
							this.removeFilter(filter, container);
						});
					});

					// Use native event if available (React event has nativeEvent property)
					filterMenu.showAtMouseEvent(event);
				});
			},
		);

		const bottomSection = container.createDiv({
			cls: "advanced-filter-bottom-section",
		});

		const expandableArea = container.createDiv({
			cls: "advanced-filter-expandable-area",
		});
		expandableArea.hide();

		// const expandBtn = bottomSection.createEl(
		// 	"div",
		// 	{
		// 		cls: ["expand-filter-btn", "compact-btn"],
		// 	},
		// 	(el) => {
		// 		el.createEl(
		// 			"span",
		// 			{
		// 				cls: "add-criterion-group-btn-icon",
		// 			},
		// 			(iconEl) => {
		// 				setIcon(iconEl, "chevron-down");
		// 			},
		// 		);
		// 		el.createEl("span", {
		// 			cls: "add-criterion-group-btn-text",
		// 			text: t("expand-to-edit"),
		// 		});
		// 	},
		// );

		// Render for the first time
		this.collapseFilter(filter, expandableArea, bottomSection);

		this.registerDomEvent(bottomSection, "click", () => {
			const isExpanded = this.expandedFilters.get(filter) ?? false;
			if (isExpanded) {
				this.collapseFilter(filter, expandableArea, bottomSection);
			} else {
				this.expandFilter(filter, expandableArea, bottomSection);
			}
		});

		return container;
	}

	// ===================== FILTER EXPAND / COLLAPSE =====================

	private collapseFilter(
		filter: Filter,
		expandableArea: HTMLElement,
		expandBtn: HTMLDivElement,
	): void {
		expandableArea.style.maxHeight = "0";
		expandableArea.style.opacity = "0";
		expandableArea.style.paddingTop = "0";
		expandableArea.style.paddingBottom = "0";

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
		setTimeout(() => {
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
		expandableArea.style.maxHeight = "0";
		expandableArea.style.opacity = "0";
		expandableArea.style.paddingTop = "0";
		expandableArea.style.paddingBottom = "0";
		void expandableArea.offsetHeight;
		expandableArea.style.maxHeight = "2000px";
		expandableArea.style.opacity = "1";
		expandableArea.style.paddingTop = "var(--size-2-2)";
		expandableArea.style.paddingBottom = "var(--size-2-2)";

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
			text: t("name"),
			cls: ["compact-text", "filter-configuration-label"],
		});
		const nameInput = nameSetting.createEl("input", {
			cls: ["filter-name-input", "compact-input"],
			attr: { placeholder: "Enter filter name" },
		});
		nameInput.value = filter.name;
		this.registerDomEvent(nameInput, "input", () => {
			filter.name = nameInput.value;
			const listItem = container.closest(".advanced-filter-list-item");
			if (listItem) {
				const nameText = listItem.querySelector(".filter-name-text");
				if (nameText) {
					nameText.textContent = filter.name || "Untitled filter";
				}
			}
		});

		const descSetting = container.createDiv({
			cls: "filter-desc-setting",
		});
		descSetting.createEl("label", {
			text: t("description"),
			cls: ["compact-text", "filter-configuration-label"],
		});
		const descInput = descSetting.createEl("input", {
			cls: ["filter-name-input", "compact-input"],
			attr: { placeholder: "Enter filter description" },
		});
		descInput.value = filter.description || "";
		this.registerDomEvent(descInput, "input", () => {
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
						const newDesc = leftSection.createEl("span", {
							cls: "filter-description-text",
							text: filter.description,
						});
						newDesc.addClass("filter-description-text");
					}
				}
			}
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
			});
		filterRootConditionDropdown.selectEl.toggleClass(
			["compact-select", "root-condition-select"],
			true,
		);

		filterRootConditionSection.createEl("label", {
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

				this.registerDomEvent(el, "click", () => {
					this.addFilterGroupToFilter(
						filter,
						filterGroupsContainerEl,
					);
				});
			},
		);

		// const filterActions = container.createDiv({
		// 	cls: "filter-actions-section",
		// });

		// filterActions.createEl(
		// 	"div",
		// 	{
		// 		cls: ["compact-btn", "duplicate-filter-btn"],
		// 	},
		// 	(el) => {
		// 		el.createEl("span", {}, (iconEl) => setIcon(iconEl, "copy"));
		// 		el.createEl("span", {
		// 			text: "Duplicate",
		// 		});
		// 		this.registerDomEvent(el, "click", () => {
		// 			this.duplicateFilter(filter);
		// 		});
		// 	},
		// );

		// filterActions.createEl(
		// 	"div",
		// 	{
		// 		cls: ["compact-btn", "delete-filter-btn"],
		// 	},
		// 	(el) => {
		// 		el.createEl("span", {}, (iconEl) => setIcon(iconEl, "trash-2"));
		// 		el.createEl("span", {
		// 			text: t("delete"),
		// 		});
		// 		this.registerDomEvent(el, "click", () => {
		// 			this.removeFilter(filter, container);
		// 		});
		// 	},
		// );
	}

	// ===================== FILTER CRUD =====================

	private addNewFilter(): void {
		const existingCount = this.advancedFilter.filters.filter((f) =>
			f.name.startsWith("New filter"),
		).length;

		const newFilter: Filter = {
			id: generateIdForFilters(),
			status: true,
			name:
				existingCount > 0
					? `New filter ${existingCount + 1}`
					: "New filter",
			rootCondition: "all",
			filterGroups: [],
		};

		this.advancedFilter.filters.push(newFilter);
		this.render();
	}

	private duplicateFilter(filter: Filter): void {
		const index = this.advancedFilter.filters.indexOf(filter);
		if (index === -1) return;

		const newFilter: Filter = JSON.parse(JSON.stringify(filter));
		newFilter.name = `${filter.name} ${t("copy-suffix")}`;

		this.advancedFilter.filters.splice(index + 1, 0, newFilter);
		this.expandedFilters = new WeakMap();
		if (this.filtersSortableInstance) {
			this.filtersSortableInstance.destroy();
			this.filtersSortableInstance = null;
		}
		this.render();
	}

	private removeFilter(
		filter: Filter,
		expandableContainer?: HTMLElement,
	): void {
		const index = this.advancedFilter.filters.indexOf(filter);
		if (index === -1) return;

		this.advancedFilter.filters.splice(index, 1);
		this.expandedFilters = new WeakMap();
		if (this.filtersSortableInstance) {
			this.filtersSortableInstance.destroy();
			this.filtersSortableInstance = null;
		}
		this.render();
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

		// NOTE : We have removed the drag and sorting feature at criterion-group level.
		// Its no longer required and is not that helpful compared to the one we have at
		// filter-level.
		// groupHeaderLeft.createDiv(
		// 	{
		// 		cls: "drag-handle-container",
		// 	},
		// 	(el) => {
		// 		el.createEl(
		// 			"span",
		// 			{
		// 				cls: "drag-handle",
		// 			},
		// 			(iconEl) => {
		// 				setIcon(iconEl, "grip-vertical");
		// 			},
		// 		);
		// 	},
		// );

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
				const selectedValue = value as "all" | "any" | "none";
				groupData.groupCondition = selectedValue;

				this.updateFilterConjunctions(
					newGroupEl.querySelector(".filters-list") as HTMLElement,
					selectedValue,
				);
			})
			.setValue(groupData.groupCondition);
		groupConditionSelect.selectEl.toggleClass(
			["group-condition-select", "compact-select"],
			true,
		);

		groupHeaderLeft.createEl("label", {
			cls: ["compact-text"],
			text: t("criterion-in-this-group"),
		});

		const groupHeaderRight = groupHeader.createDiv({
			cls: ["criterion-group-header-right"],
		});

		const duplicateGroupBtn = new ExtraButtonComponent(groupHeaderRight)
			.setIcon("copy")
			.setTooltip(t("duplicate-criterion-group"))
			.onClick(() => {
				const newGroupId = generateIdForFilters();
				const duplicatedFilters = groupData.filters.map((f) => ({
					...f,
					id: generateIdForFilters(),
				}));
				const duplicatedGroupData: FilterCriterionGroup = {
					...groupData,
					id: newGroupId,
					filters: duplicatedFilters,
				};
				this.addFilterGroupToFilter(
					filter,
					filterGroupsContainerEl,
					duplicatedGroupData,
					newGroupEl,
				);
			});
		duplicateGroupBtn.extraSettingsEl.addClasses([
			"duplicate-group-btn",
			"clickable-icon",
		]);

		const removeGroupBtn = new ExtraButtonComponent(groupHeaderRight)
			.setIcon("trash-2")
			.setTooltip(t("remove-criterion-group"))
			.onClick(() => {
				const filtersListElForSortable = newGroupEl.querySelector(
					".filters-list",
				) as HTMLElement;
				if (
					filtersListElForSortable &&
					(filtersListElForSortable as any).sortableInstance
				) {
					(
						(filtersListElForSortable as any)
							.sortableInstance as Sortable
					).destroy();
				}

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

				this.registerDomEvent(el, "click", () => {
					this.addFilterToGroup(groupData, filtersListEl);
				});
			},
		);

		return newGroupEl;
	}

	private addFilterGroupToFilter(
		filter: Filter,
		filterGroupsContainerEl: HTMLElement,
		groupDataToClone: FilterCriterionGroup | null = null,
		insertAfterElement: HTMLElement | null = null,
	): void {
		if (!filterGroupsContainerEl) {
			bugReporterManagerInsatance.addToLogs(
				168,
				"filterGroupsContainerEl not available",
				"ViewTaskFilter.ts/addFilterGroupToFilter",
			);
			return;
		}

		const newGroupId = groupDataToClone
			? groupDataToClone.id
			: generateIdForFilters();

		let newGroupData: FilterCriterionGroup;
		if (groupDataToClone && insertAfterElement) {
			newGroupData = {
				id: newGroupId,
				groupCondition: groupDataToClone.groupCondition,
				filters: groupDataToClone.filters.map((f) => ({
					...f,
					id: generateIdForFilters(),
				})),
			};
		} else {
			newGroupData = {
				id: newGroupId,
				groupCondition: "all",
				filters: [],
			};
		}

		const groupIndex = insertAfterElement
			? filter.filterGroups.findIndex(
					(g) => g.id === insertAfterElement.id,
				) + 1
			: filter.filterGroups.length;

		filter.filterGroups.splice(groupIndex, 0, newGroupData);

		const newGroupElement = this.createFilterGroupElement(
			newGroupData,
			filter,
			filterGroupsContainerEl,
		);

		if (
			insertAfterElement &&
			insertAfterElement.parentNode === filterGroupsContainerEl
		) {
			filterGroupsContainerEl.insertBefore(
				newGroupElement,
				insertAfterElement.nextSibling,
			);
		} else {
			filterGroupsContainerEl.appendChild(newGroupElement);
		}

		if (
			(!groupDataToClone || groupDataToClone.filters.length === 0) &&
			!insertAfterElement
		) {
			this.addFilterToGroup(
				newGroupData,
				newGroupElement.querySelector(".filters-list") as HTMLElement,
			);
		} else if (
			groupDataToClone &&
			groupDataToClone.filters.length === 0 &&
			insertAfterElement
		) {
			this.addFilterToGroup(
				newGroupData,
				newGroupElement.querySelector(".filters-list") as HTMLElement,
			);
		}

		this.updateGroupSeparatorsForFilter(filter, filterGroupsContainerEl);
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
		this.registerDomEvent(valueInput, "click", () => {
			this.somethingElseIsOpened = true;
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
			if (
				valueInput.style.display === "none" &&
				valueInput.value !== ""
			) {
				// Input hidden, value handled by toggleValueInputVisibility
			}
		});

		valueInput.value = filterData.value || "";

		this.registerDomEvent(valueInput, "input", (event) => {
			filterData.value = (event.target as HTMLInputElement).value;
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
					newFilterEl.parentElement as HTMLElement,
					groupData.groupCondition,
				);
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

		switch (property) {
			case "content":
				valueInput.type = "text";
				conditionOptions = [
					{
						value: "contains",
						text: t("contains"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contain"),
					},
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "startsWith",
						text: t("starts-with"),
					},
					{
						value: "endsWith",
						text: t("ends-with"),
					},
				];
				break;
			case "filePath":
				valueInput.type = "text";
				conditionOptions = [
					{
						value: "contains",
						text: t("contains"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contain"),
					},
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "startsWith",
						text: t("starts-with"),
					},
					{
						value: "endsWith",
						text: t("ends-with"),
					},
				];
				break;
			case "status":
				valueInput.hide();
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
				setTimeout(() => {
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
				});

				conditionOptions = [
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
				];
				break;
			case "project":
				valueInput.type = "text";
				conditionOptions = [
					{
						value: "contains",
						text: t("contains"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contain"),
					},
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "startsWith",
						text: t("starts-with"),
					},
					{
						value: "endsWith",
						text: t("ends-with"),
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
				break;
			case "priority":
				valueInput.hide();
				valueSelect.addOptions(
					getPriorityOptionsForDropdown().reduce(
						(
							acc: Record<number | string, string>,
							opt: priorityDropDownOption,
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
					filterData.value = Number(newValue);
				});
				conditionOptions = [
					{
						value: "is",
						text: t("is"),
					},
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: ">",
						text: ">",
					},
					{
						value: "<",
						text: "<",
					},
					{
						value: ">=",
						text: ">=",
					},
					{
						value: "<=",
						text: "<=",
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
				break;
			case "id":
				valueInput.type = "text";
				conditionOptions = [
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: ">",
						text: ">",
					},
					{
						value: "<",
						text: "<",
					},
					{
						value: ">=",
						text: ">=",
					},
					{
						value: "<=",
						text: "<=",
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
				break;
			case "createdDate":
			case "due":
			case "startDate":
			case "scheduledDate":
			case "completedDate":
			case "cancelledDate":
				valueInput.type = "date";
				conditionOptions = [
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "before",
						text: t("before"),
					},
					{
						value: "onOrBefore",
						text: t("on-or-before"),
					},
					{
						value: "after",
						text: t("after"),
					},
					{
						value: "onOrAfter",
						text: t("on-or-after"),
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
				break;
			case "startTime":
				valueInput.type = "time";
				conditionOptions = [
					{ value: "is", text: t("is") },
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "before",
						text: t("before"),
					},
					{
						value: "onOrBefore",
						text: t("on-or-before"),
					},
					{
						value: "after",
						text: t("after"),
					},
					{
						value: "onOrAfter",
						text: t("on-or-after"),
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
				break;
			case "tags":
				valueInput.type = "text";
				conditionOptions = [
					{
						value: "contains",
						text: t("contains-string"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contains-string"),
					},
					{
						value: "isEmpty",
						text: t("are-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("are-not-empty"),
					},
				];
				break;
			default:
				valueInput.type = "text";
				conditionOptions = [
					{
						value: "is",
						text: t("is"),
					},
					{
						value: "isNot",
						text: t("is-not"),
					},
					{
						value: "contains",
						text: t("contains"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contains"),
					},
					{
						value: "isEmpty",
						text: t("is-empty"),
					},
					{
						value: "isNotEmpty",
						text: t("is-not-empty"),
					},
				];
		}

		conditionSelect.selectEl.empty();
		conditionOptions.forEach((opt) =>
			conditionSelect.addOption(opt.value, opt.text),
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

		if (valueInput instanceof HTMLInputElement) {
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

	private makeFiltersSortable(containerEl: HTMLElement): void {
		if (this.filtersSortableInstance) {
			this.filtersSortableInstance.destroy();
			this.filtersSortableInstance = null;
		}

		if (!containerEl) return;

		this.filtersSortableInstance = new Sortable(containerEl, {
			animation: 150,
			handle: ".drag-handle",
			ghostClass: "dragging-placeholder",
			onEnd: (evt: Event) => {
				const sortableEvent = evt as any;
				if (
					sortableEvent.oldDraggableIndex === undefined ||
					sortableEvent.newDraggableIndex === undefined
				)
					return;

				const movedFilter = this.advancedFilter.filters.splice(
					sortableEvent.oldDraggableIndex,
					1,
				)[0];
				this.advancedFilter.filters.splice(
					sortableEvent.newDraggableIndex,
					0,
					movedFilter,
				);
			},
		});
	}

	// ===================== STATE MANAGEMENT =====================

	public getFiltersState(): AdvancedFilter {
		if (!this.advancedFilter) {
			return {
				filters: [],
				rootCondition: "all",
			};
		}
		return JSON.parse(JSON.stringify(this.advancedFilter));
	}

	public loadFilterState(state: AdvancedFilter): void {
		if (this.filtersSortableInstance) {
			this.filtersSortableInstance.destroy();
			this.filtersSortableInstance = null;
		}

		this.advancedFilter = JSON.parse(JSON.stringify(state));

		if (
			this.advancedFilter.filters &&
			Array.isArray(this.advancedFilter.filters)
		) {
			this.advancedFilter.filters = this.advancedFilter.filters.filter(
				(filter) =>
					filter &&
					typeof filter === "object" &&
					filter.name !== undefined,
			);
			this.advancedFilter.filters.forEach((filter) => {
				if (filter.filterGroups && Array.isArray(filter.filterGroups)) {
					filter.filterGroups = filter.filterGroups.filter(
						(groupData) =>
							groupData &&
							typeof groupData === "object" &&
							groupData.groupCondition &&
							Array.isArray(groupData.filters),
					);
				}
			});
		}

		this.expandedFilters = new WeakMap();
		this.multiSuggestInstances = new WeakMap();
		this.render();
	}

	// ===================== STUB METHODS =====================

	private async openFiltersWarehouseModal(): Promise<void> {
		this.isWarehouseModalOpened = true;

		const warehouseModal = new FiltersWarehouseModal(
			this.plugin,
			(importedFilters: Filter[]) => {
				for (const importedFilter of importedFilters) {
					const filterCopy = JSON.parse(
						JSON.stringify(importedFilter),
					);
					this.advancedFilter.filters.push(filterCopy);
				}
				this.expandedFilters = new WeakMap();
				if (this.filtersSortableInstance) {
					this.filtersSortableInstance.destroy();
					this.filtersSortableInstance = null;
				}
				this.render();
			},
		);

		warehouseModal.setCloseCallback(() => {
			this.isWarehouseModalOpened = false;
			this.somethingElseIsOpened = true;
		});

		warehouseModal.open();
	}
}

export function generateIdForFilters(): string {
	return generateRandomStringId(`filter_${Date.now()}`);
}
