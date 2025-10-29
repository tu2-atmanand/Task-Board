// /src/components/BoardFilters/ViewTaskFilter.ts

import {
	Component,
	ExtraButtonComponent,
	setIcon,
	DropdownComponent,
	App,
	setTooltip,
} from "obsidian";
import Sortable from "sortablejs";
import { FilterConfigModal } from "./FilterConfigModal";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import {
	Filter,
	FilterGroup,
	RootFilterState,
	SavedFilterConfig,
} from "src/interfaces/BoardConfigs";
import {
	MultiSuggest,
	getTagSuggestions,
	getFileSuggestions,
	getStatusSuggestions,
	getPrioritySuggestions,
} from "src/services/MultiSuggest";

export class TaskFilterComponent extends Component {
	private hostEl: HTMLElement;
	private rootFilterState!: RootFilterState;
	private app: App;
	private filterGroupsContainerEl!: HTMLElement;
	private plugin?: TaskBoard;
	private activeBoardIndex?: number;

	// Sortable instances
	private groupsSortable?: Sortable;

	// WeakMap to store MultiSuggest instances for cleanup
	private multiSuggestInstances = new WeakMap<
		HTMLInputElement,
		MultiSuggest
	>();
	public isMultiSuggestDropdownActive = false;

	constructor(
		hostEl: HTMLElement,
		app: App,
		private leafId?: string | undefined,
		plugin?: TaskBoard,
		activeBoardIndex?: number,
		private initialFilterState?: RootFilterState
	) {
		super();
		this.hostEl = hostEl;
		this.app = app;
		this.plugin = plugin;
		this.activeBoardIndex = activeBoardIndex;
	}

	onload() {
		// If initial filter state is provided (for column filters), use it
		if (this.initialFilterState) {
			this.rootFilterState = this.initialFilterState;
		} else {
			// Otherwise, load from localStorage (for board filters)
			const savedState = this.leafId
				? this.app.loadLocalStorage(
						`task-board-view-filter-${this.leafId}`
				  )
				: this.app.loadLocalStorage("task-board-view-filter");

			console.log("savedState", savedState, this.leafId);
			if (
				savedState &&
				typeof (savedState as any).rootCondition === "string" &&
				Array.isArray((savedState as any).filterGroups)
			) {
				// Basic validation passed
				this.rootFilterState = savedState as RootFilterState;
			} else {
				if (savedState) {
					// If it exists but failed validation
					console.warn(
						"Task Filter: Invalid data in local storage. Resetting to default state."
					);
				}
				// Initialize with default state
				this.rootFilterState = {
					rootCondition: "any",
					filterGroups: [],
				};
			}
		}

		// Render first to initialize DOM elements
		this.render();
	}

	onunload() {
		// Destroy sortable instances
		this.groupsSortable?.destroy();
		this.filterGroupsContainerEl
			?.querySelectorAll(".filters-list")
			.forEach((listEl) => {
				if ((listEl as any).sortableInstance) {
					((listEl as any).sortableInstance as Sortable).destroy();
				}
			});

		// Clear the host element
		this.hostEl.empty(); // Obsidian's way to clear innerHTML and managed children
	}

	close() {
		this.onunload();
	}

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("task-filter-root-container");

		const mainPanel = this.hostEl.createDiv({
			cls: "task-filter-main-panel",
		});
		const rootFilterSetupSection = mainPanel.createDiv({
			attr: { id: "root-filter-setup-section" },
		});
		rootFilterSetupSection.addClass("root-filter-setup-section");

		// Root Condition Section
		const rootConditionSection = rootFilterSetupSection.createDiv({});
		rootConditionSection.addClass("root-condition-section");

		rootConditionSection.createEl("label", {
			text: t("match"),
			attr: { for: "task-filter-root-condition" },
			cls: ["compact-text", "root-condition-label"],
		});

		const rootConditionDropdown = new DropdownComponent(
			rootConditionSection
		)
			.addOptions({
				any: t("any"),
				all: t("all"),
				none: t("none"),
			})
			.setValue(this.rootFilterState.rootCondition)
			.onChange((value) => {
				this.rootFilterState.rootCondition = value as
					| "all"
					| "any"
					| "none";
				this.saveStateToLocalStorage();
				this.updateGroupSeparators();
			});

		rootConditionDropdown.selectEl.toggleClass("compact-select", true);

		rootConditionSection.createEl("span", {
			cls: ["compact-text", "root-condition-span"],
			text: t("filter-group"),
		});

		// Filter Groups Container
		this.filterGroupsContainerEl = rootFilterSetupSection.createDiv({
			attr: { id: "task-filter-groups-container" },
			cls: "filter-groups-container",
		});

		// Add Filter Group Button Section
		const addGroupSection = rootFilterSetupSection.createDiv({
			cls: "add-group-section",
		});

		addGroupSection.createEl(
			"div",
			{
				cls: ["add-filter-group-btn", "compact-btn"],
			},
			(el) => {
				el.createEl(
					"span",
					{
						cls: "add-filter-group-btn-icon",
					},
					(iconEl) => {
						setIcon(iconEl, "plus");
					}
				);
				el.createEl("span", {
					cls: "add-filter-group-btn-text",
					text: t("add-filter-group"),
				});

				this.registerDomEvent(el, "click", () => {
					this.addFilterGroup();
				});
			}
		);

		// Filter Configuration Buttons Section (only show if plugin is available)
		if (this.plugin) {
			const configSection = addGroupSection.createDiv({
				cls: "filter-config-section",
			});

			// Save Configuration Button
			configSection.createEl(
				"div",
				{
					cls: ["save-filter-config-btn", "compact-btn"],
				},
				(el) => {
					el.createEl(
						"span",
						{
							cls: "save-filter-config-btn-icon",
						},
						(iconEl) => {
							setIcon(iconEl, "save");
							setTooltip(el, t("save-current-filter"));
						}
					);

					this.registerDomEvent(el, "click", () => {
						this.openSaveConfigModal();
					});
				}
			);

			// Load Configuration Button
			configSection.createEl(
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
							setIcon(iconEl, "folder-open");
							setTooltip(el, t("load-saved-filter"));
						}
					);

					this.registerDomEvent(el, "click", () => {
						this.openLoadConfigModal();
					});
				}
			);
		}

		// Re-populate filter groups from state
		this.rootFilterState.filterGroups.forEach((groupData) => {
			const groupElement = this.createFilterGroupElement(groupData);
			this.filterGroupsContainerEl.appendChild(groupElement);
		});
		this.updateGroupSeparators();
		this.makeSortableGroups();
	}

	// --- Filter Group Management ---
	private createFilterGroupElement(groupData: FilterGroup): HTMLElement {
		const newGroupEl = this.hostEl.createEl("div", {
			attr: { id: groupData.id },
			cls: ["filter-group"],
		});

		const groupHeader = newGroupEl.createDiv({
			cls: ["filter-group-header"],
		});

		const groupHeaderLeft = groupHeader.createDiv({
			cls: ["filter-group-header-left"],
		});

		// Drag Handle - kept as custom SVG for now
		groupHeaderLeft.createDiv(
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
					}
				);
			}
		);

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
				this.saveStateToLocalStorage();
				this.updateFilterConjunctions(
					newGroupEl.querySelector(".filters-list") as HTMLElement,
					selectedValue
				);
			})
			.setValue(groupData.groupCondition);
		groupConditionSelect.selectEl.toggleClass(
			["group-condition-select", "compact-select"],
			true
		);

		groupHeaderLeft.createEl("span", {
			cls: ["compact-text"],
			text: t("filter-in-this-group"),
		});

		const groupHeaderRight = groupHeader.createDiv({
			cls: ["filter-group-header-right"],
		});

		const duplicateGroupBtn = new ExtraButtonComponent(groupHeaderRight)
			.setIcon("copy")
			.setTooltip(t("duplicate-filter-group"))
			.onClick(() => {
				const newGroupId = generateIdForFilters();
				const duplicatedFilters = groupData.filters.map((f) => ({
					...f,
					id: generateIdForFilters(),
				}));
				const duplicatedGroupData: FilterGroup = {
					...groupData,
					id: newGroupId,
					filters: duplicatedFilters,
				};
				this.addFilterGroup(duplicatedGroupData, newGroupEl);
			});
		duplicateGroupBtn.extraSettingsEl.addClasses([
			"duplicate-group-btn",
			"clickable-icon",
		]);

		const removeGroupBtn = new ExtraButtonComponent(groupHeaderRight)
			.setIcon("trash-2")
			.setTooltip(t("remove-filter-group"))
			.onClick(() => {
				const filtersListElForSortable = newGroupEl.querySelector(
					".filters-list"
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

				this.rootFilterState.filterGroups =
					this.rootFilterState.filterGroups.filter(
						(g) => g.id !== groupData.id
					);
				this.saveStateToLocalStorage();
				newGroupEl.remove();
				const nextSibling = newGroupEl.nextElementSibling;
				if (
					nextSibling &&
					nextSibling.classList.contains(
						"filter-group-separator-container"
					)
				) {
					nextSibling.remove();
				} else {
					const prevSibling = newGroupEl.previousElementSibling;
					if (
						prevSibling &&
						prevSibling.classList.contains(
							"filter-group-separator-container"
						)
					) {
						prevSibling.remove();
					}
				}
				this.updateGroupSeparators();
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
				groupData
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
					}
				);
				el.createEl("span", {
					cls: "add-filter-btn-text",
					text: t("add-filter"),
				});

				this.registerDomEvent(el, "click", () => {
					this.addFilterToGroup(groupData, filtersListEl);
				});
			}
		);

		return newGroupEl;
	}

	private addFilterGroup(
		groupDataToClone: FilterGroup | null = null,
		insertAfterElement: HTMLElement | null = null
	): void {
		// Ensure the container is initialized
		if (!this.filterGroupsContainerEl) {
			console.warn(
				"TaskFilterComponent: filterGroupsContainerEl not initialized yet"
			);
			return;
		}

		const newGroupId = groupDataToClone
			? groupDataToClone.id
			: generateIdForFilters();

		let newGroupData: FilterGroup;
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
			? this.rootFilterState.filterGroups.findIndex(
					(g) => g.id === insertAfterElement.id
			  ) + 1
			: this.rootFilterState.filterGroups.length;

		this.rootFilterState.filterGroups.splice(groupIndex, 0, newGroupData);
		this.saveStateToLocalStorage();
		const newGroupElement = this.createFilterGroupElement(newGroupData);

		if (
			insertAfterElement &&
			insertAfterElement.parentNode === this.filterGroupsContainerEl
		) {
			this.filterGroupsContainerEl.insertBefore(
				newGroupElement,
				insertAfterElement.nextSibling
			);
		} else {
			this.filterGroupsContainerEl.appendChild(newGroupElement);
		}

		if (
			(!groupDataToClone || groupDataToClone.filters.length === 0) &&
			!insertAfterElement
		) {
			this.addFilterToGroup(
				newGroupData,
				newGroupElement.querySelector(".filters-list") as HTMLElement
			);
		} else if (
			groupDataToClone &&
			groupDataToClone.filters.length === 0 &&
			insertAfterElement
		) {
			this.addFilterToGroup(
				newGroupData,
				newGroupElement.querySelector(".filters-list") as HTMLElement
			);
		}

		this.updateGroupSeparators();
		this.makeSortableGroups();
	}

	// --- Filter Item Management ---
	private createFilterItemElement(
		filterData: Filter,
		groupData: FilterGroup
	): HTMLElement {
		const newFilterEl = this.hostEl.createEl("div", {
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
				text: t("and-not"),
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
		});

		propertySelect.onChange((value) => {
			filterData.property = value;
			this.saveStateToLocalStorage(false);
			setTimeout(() => this.saveStateToLocalStorage(true), 300);
			this.updateFilterPropertyOptions(
				newFilterEl,
				filterData,
				propertySelect,
				conditionSelect,
				valueInput
			);
		});

		const toggleValueInputVisibility = (
			currentCond: string,
			propertyType: string
		) => {
			const conditionsRequiringValue = [
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
			];
			let valueActuallyNeeded =
				conditionsRequiringValue.includes(currentCond);

			if (
				propertyType === "completed" &&
				(currentCond === "isTrue" || currentCond === "isFalse")
			) {
				valueActuallyNeeded = false;
			}
			if (currentCond === "isEmpty" || currentCond === "isNotEmpty") {
				valueActuallyNeeded = false;
			}

			valueInput.style.display = valueActuallyNeeded ? "block" : "none";
			if (!valueActuallyNeeded && filterData.value !== undefined) {
				filterData.value = undefined;
				this.saveStateToLocalStorage();
				valueInput.value = "";
			}
		};

		conditionSelect.onChange((newCondition) => {
			filterData.condition = newCondition;
			this.saveStateToLocalStorage(false);
			setTimeout(() => this.saveStateToLocalStorage(true), 300);
			toggleValueInputVisibility(newCondition, filterData.property);
			if (
				valueInput.style.display === "none" &&
				valueInput.value !== ""
			) {
				// If input is hidden, value should be undefined as per toggleValueInputVisibility
				// This part might need re-evaluation of logic if filterData.value should be set here.
				// For now, assuming toggleValueInputVisibility handles setting filterData.value correctly.
			}
		});

		valueInput.value = filterData.value || "";

		let valueInputTimeout: NodeJS.Timeout;
		this.registerDomEvent(valueInput, "input", (event) => {
			filterData.value = (event.target as HTMLInputElement).value;

			this.saveStateToLocalStorage(false);

			clearTimeout(valueInputTimeout);
			valueInputTimeout = setTimeout(() => {
				this.saveStateToLocalStorage(true);
			}, 400);
		});

		const removeFilterBtn = new ExtraButtonComponent(newFilterEl)
			.setIcon("trash-2")
			.setTooltip(t("remove-filter"))
			.onClick(() => {
				groupData.filters = groupData.filters.filter(
					(f) => f.id !== filterData.id
				);
				this.saveStateToLocalStorage();
				newFilterEl.remove();
				this.updateFilterConjunctions(
					newFilterEl.parentElement as HTMLElement,
					groupData.groupCondition
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
			valueInput
		);

		return newFilterEl;
	}

	private addFilterToGroup(
		groupData: FilterGroup,
		filtersListEl: HTMLElement
	): void {
		const newFilterId = generateIdForFilters();
		const newFilterData: Filter = {
			id: newFilterId,
			property: "content",
			condition: "contains",
			value: "",
		};
		groupData.filters.push(newFilterData);
		this.saveStateToLocalStorage();

		const newFilterElement = this.createFilterItemElement(
			newFilterData,
			groupData
		);
		filtersListEl.appendChild(newFilterElement);

		this.updateFilterConjunctions(filtersListEl, groupData.groupCondition);
	}

	private updateFilterPropertyOptions(
		filterItemEl: HTMLElement,
		filterData: Filter,
		propertySelect: DropdownComponent,
		conditionSelect: DropdownComponent,
		valueInput: HTMLInputElement
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
				dueDate: t("due-date"),
				completedDate: t("completed-date"),
				cancelledDate: t("cancelled-date"),
				startTime: t("start-time"),
				reminder: t("reminder"),
				dependencies: t("dependencies"),
				filePath: t("file-path"),
				// project: t("project"),
			});
		}
		propertySelect.setValue(property);

		let conditionOptions: { value: string; text: string }[] = [];
		valueInput.type = "text";

		switch (property) {
			case "content":
			case "filePath":
			case "status":
			case "project":
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
			case "dueDate":
			case "startDate":
			case "scheduledDate":
			case "completedDate":
				valueInput.type = "date";
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
			case "startTime":
				valueInput.type = "time";
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
			case "tags":
				conditionOptions = [
					{
						value: "hasTag",
						text: t("has-tag"),
					},
					{
						value: "doesNotHaveTag",
						text: t("does-not-have-tag"),
					},
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
			case "completed":
				conditionOptions = [
					{
						value: "isTrue",
						text: t("is-true"),
					},
					{
						value: "isFalse",
						text: t("is-false"),
					},
				];
				break;
			default:
				conditionOptions = [
					{
						value: "isSet",
						text: t("is-set"),
					},
					{
						value: "isNotSet",
						text: t("is-not-set"),
					},
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
						text: t("contains-string"),
					},
					{
						value: "doesNotContain",
						text: t("does-not-contains-string"),
					},
				];
		}

		conditionSelect.selectEl.empty();
		conditionOptions.forEach((opt) =>
			conditionSelect.addOption(opt.value, opt.text)
		);

		const currentSelectedCondition = filterData.condition;
		let conditionChanged = false;
		if (
			conditionOptions.some(
				(opt) => opt.value === currentSelectedCondition
			)
		) {
			conditionSelect.setValue(currentSelectedCondition);
		} else if (conditionOptions.length > 0) {
			conditionSelect.setValue(conditionOptions[0].value);
			filterData.condition = conditionOptions[0].value;
			conditionChanged = true;
		}

		const finalConditionVal = conditionSelect.getValue();
		const conditionsRequiringValue = [
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
		];
		let valueActuallyNeeded =
			conditionsRequiringValue.includes(finalConditionVal);
		if (
			property === "completed" &&
			(finalConditionVal === "isTrue" || finalConditionVal === "isFalse")
		) {
			valueActuallyNeeded = false;
		}
		if (
			finalConditionVal === "isEmpty" ||
			finalConditionVal === "isNotEmpty"
		) {
			valueActuallyNeeded = false;
		}

		let valueChanged = false;
		valueInput.style.display = valueActuallyNeeded ? "block" : "none";
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
				valueChanged = true;
			}
		}

		if (conditionChanged || valueChanged) {
			this.saveStateToLocalStorage();
		}

		// Setup MultiSuggest for appropriate properties
		this.setupMultiSuggest(property, valueInput, filterData);
	}

	private setupMultiSuggest(
		property: string,
		valueInput: HTMLInputElement,
		filterData: Filter
	): void {
		// Only setup suggestions for specific properties
		const propertiesWithSuggestions = [
			"status",
			"priority",
			"tags",
			"filePath",
		];

		// Clean up existing MultiSuggest instance if it exists
		const existingInstance = this.multiSuggestInstances.get(valueInput);
		if (existingInstance) {
			existingInstance.close();
			this.multiSuggestInstances.delete(valueInput);
		}

		if (!propertiesWithSuggestions.includes(property)) {
			return;
		}

		let suggestions: string[] = [];

		switch (property) {
			case "status":
				suggestions = getStatusSuggestions();
				break;
			case "priority":
				suggestions = getPrioritySuggestions();
				break;
			case "tags":
				suggestions = getTagSuggestions(this.app);
				break;
			case "filePath":
				suggestions = getFileSuggestions(this.app);
				break;
		}

		// Create callback to update filter data when suggestion is selected
		const onSelectCallback = (value: string) => {
			filterData.value = value;
			this.saveStateToLocalStorage();
		};

		// Initialize MultiSuggest with suggestions and store instance for cleanup
		const multiSuggestInstance = new MultiSuggest(
			valueInput,
			new Set(suggestions),
			onSelectCallback,
			this.app
		);

		// Store instance in WeakMap for cleanup
		this.multiSuggestInstances.set(valueInput, multiSuggestInstance);
	}

	// --- UI Updates (Conjunctions, Separators) ---
	private updateFilterConjunctions(
		filtersListEl: HTMLElement | null,
		groupCondition: "all" | "any" | "none" = "all"
	): void {
		if (!filtersListEl) return;
		const filters = filtersListEl.querySelectorAll(".filter-item");
		filters.forEach((filter, index) => {
			const conjunctionElement = filter.querySelector(
				".filter-conjunction"
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

	private updateGroupSeparators(): void {
		this.filterGroupsContainerEl
			?.querySelectorAll(".filter-group-separator-container")
			.forEach((sep) => sep.remove());

		const groups = Array.from(
			this.filterGroupsContainerEl?.children || []
		).filter((child) => child.classList.contains("filter-group"));

		if (groups.length > 1) {
			groups.forEach((group, index) => {
				if (index < groups.length - 1) {
					const separatorContainer = createEl("div", {
						cls: "filter-group-separator-container",
					});
					const separator = separatorContainer.createDiv({
						cls: "filter-group-separator",
					});

					const rootCond = this.rootFilterState.rootCondition;
					let separatorText = t("or");
					if (rootCond === "all") separatorText = t("and");
					else if (rootCond === "none") separatorText = t("and-not");

					separator.textContent = separatorText.toUpperCase();
					group.parentNode?.insertBefore(
						separatorContainer,
						group.nextSibling
					);
				}
			});
		}
	}

	// --- SortableJS Integration ---
	private makeSortableGroups(): void {
		if (this.groupsSortable) {
			this.groupsSortable.destroy();
			this.groupsSortable = undefined;
		}
		if (!this.filterGroupsContainerEl) return;

		this.groupsSortable = new Sortable(this.filterGroupsContainerEl, {
			animation: 150,
			handle: ".drag-handle",
			filter: ".filter-group-separator-container",
			preventOnFilter: true,
			ghostClass: "dragging-placeholder",
			onEnd: (evt: Event) => {
				const sortableEvent = evt as any;
				if (
					sortableEvent.oldDraggableIndex === undefined ||
					sortableEvent.newDraggableIndex === undefined
				)
					return;

				const movedGroup = this.rootFilterState.filterGroups.splice(
					sortableEvent.oldDraggableIndex,
					1
				)[0];
				this.rootFilterState.filterGroups.splice(
					sortableEvent.newDraggableIndex,
					0,
					movedGroup
				);
				this.saveStateToLocalStorage();
				this.updateGroupSeparators();
			},
		});
	}

	// --- Filter State Management ---
	private updateFilterState(
		filterGroups: FilterGroup[],
		rootCondition: "all" | "any" | "none"
	): void {
		this.rootFilterState.filterGroups = filterGroups;
		this.rootFilterState.rootCondition = rootCondition;
		this.saveStateToLocalStorage();
	}

	// Public method to get current filter state
	public getFilterState(): RootFilterState {
		// Handle case where rootFilterState might not be initialized
		if (!this.rootFilterState) {
			return {
				rootCondition: "any",
				filterGroups: [],
			};
		}
		return JSON.parse(JSON.stringify(this.rootFilterState));
	}

	// Public method to load filter state
	public loadFilterState(state: RootFilterState): void {
		// Safely destroy sortable instances
		try {
			if (this.groupsSortable) {
				this.groupsSortable.destroy();
				this.groupsSortable = undefined;
			}
		} catch (error) {
			console.warn("Error destroying groups sortable:", error);
			this.groupsSortable = undefined;
		}

		// Safely destroy filter list sortable instances
		this.filterGroupsContainerEl
			?.querySelectorAll(".filters-list")
			.forEach((listEl) => {
				try {
					if ((listEl as any).sortableInstance) {
						(
							(listEl as any).sortableInstance as Sortable
						).destroy();
						(listEl as any).sortableInstance = undefined;
					}
				} catch (error) {
					console.warn(
						"Error destroying filter list sortable:",
						error
					);
					(listEl as any).sortableInstance = undefined;
				}
			});

		this.rootFilterState = JSON.parse(JSON.stringify(state));
		this.saveStateToLocalStorage();

		this.render();
	}

	// --- Local Storage Management ---
	private saveStateToLocalStorage(
		triggerRealtimeUpdate: boolean = true
	): void {
		if (this.app) {
			this.app.saveLocalStorage(
				this.leafId
					? `task-board-view-filter-${this.leafId}`
					: "task-board-view-filter",
				this.rootFilterState
			);

			if (triggerRealtimeUpdate) {
				this.app.workspace.trigger(
					"task-board:filter-changed",
					this.rootFilterState,
					this.leafId || undefined
				);
			}
		}
	}

	// --- Filter Configuration Management ---
	private openSaveConfigModal(): void {
		if (!this.plugin || this.activeBoardIndex === undefined) return;

		const modal = new FilterConfigModal(
			this.app,
			this.plugin,
			"save",
			this.activeBoardIndex,
			this.getFilterState(),
			(config: SavedFilterConfig) => {
				// Optional: Handle successful save
				console.log("Filter configuration saved:", config.name);
			}
		);
		modal.open();
	}

	private openLoadConfigModal(): void {
		if (!this.plugin || this.activeBoardIndex === undefined) return;

		const modal = new FilterConfigModal(
			this.app,
			this.plugin,
			"load",
			this.activeBoardIndex,
			undefined,
			undefined,
			(config: SavedFilterConfig) => {
				// Load the configuration
				this.loadFilterState(config.filterState);
				console.log("Filter configuration loaded:", config.name);
			}
		);
		modal.open();
	}
}

export function generateIdForFilters(): string {
	return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
