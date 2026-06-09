// /src/components/BoardFilters/AdvancedFilterPopover.ts

import { App, setIcon, setTooltip } from "obsidian";
import { CloseableComponent, Component } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { t } from "i18next";
import TaskBoard from "../../../main.js";
import { AdvancedFilter } from "../../interfaces/BoardConfigs.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { AdvancedFilterComponent } from "./Component.js";

export class AdvancedFilterPopover
	extends Component
	implements CloseableComponent
{
	private plugin: TaskBoard;
	private app: App;
	public entity: "board" | "view" | "column";
	public currentBoardID: string;
	public parentFiltersAreActive: boolean;
	public popoverRef: HTMLDivElement | null = null;
	public advancedFilterComponent!: AdvancedFilterComponent;
	private win: Window;
	// private scrollParent: HTMLElement | Window;
	private popperInstance: PopperInstance | null = null;
	public onClose: ((filterState?: AdvancedFilter) => void) | null = null;
	private columnOrViewOrBoardName?: string;
	private existingFilters?: AdvancedFilter;

	constructor(
		plugin: TaskBoard,
		entity: "board" | "view" | "column",
		currentBoardID: string,
		parentFiltersAreActive: boolean,
		columnOrViewOrBoardName?: string,
		existingFilters?: AdvancedFilter,
	) {
		super();
		this.plugin = plugin;
		this.app = plugin.app;
		this.entity = entity;
		this.currentBoardID = currentBoardID;
		this.parentFiltersAreActive = parentFiltersAreActive;
		this.columnOrViewOrBoardName = columnOrViewOrBoardName;
		this.existingFilters = existingFilters;
		this.win = plugin.app.workspace.containerEl.win || window;

		// this.scrollParent = this.win;
	}

	/**
	 * Shows the task details popover at the given position.
	 */
	showAtPosition(position: { x: number; y: number }) {
		if (this.popoverRef) {
			this.close();
		}

		// Create content container
		const contentEl = createDiv({ cls: "advanced-filter-menu-container" });
		// Prevent clicks inside the popover from bubbling up
		this.registerDomEvent(contentEl, "click", (e) => {
			e.stopPropagation();
		});

		const headerEl = contentEl.createDiv({
			cls: "advanced-filter-menu-container-header",
		});

		const leftSec = headerEl.createDiv({
			cls: "advanced-filter-menu-container-header-leftSec",
		});
		// Add column filter heading if this is for a column
		if (this.entity === "column") {
			leftSec.createEl("h3", {
				text:
					t("column-filters-for") +
					" - " +
					this.columnOrViewOrBoardName,
				cls: "advanced-filter-menu-container-header-heading",
			});
		} else if (this.entity === "view") {
			leftSec.createEl("h3", {
				text:
					t("view-filters-for") +
					" - " +
					this.columnOrViewOrBoardName,
				cls: "advanced-filter-menu-container-header-heading",
			});
		} else if (this.entity === "board") {
			leftSec.createEl("h3", {
				text:
					t("board-filters-for") +
					" - " +
					this.columnOrViewOrBoardName,
				cls: "advanced-filter-menu-container-header-heading",
			});
		}

		const rightSec = headerEl.createDiv({
			cls: "advanced-filter-menu-container-header-rightSec",
		});

		// const applyBtn = rightSec.createEl("button", {
		// 	cls: "advanced-filter-menu-container-header-rightSec-btn",
		// 	text: t("close"),
		// });
		const applyBtn = rightSec.createEl(
			"div",
			{
				cls: [
					"advanced-filter-menu-container-header-rightSec-btn",
					"compact-btn",
				],
			},
			(el) => {
				setIcon(el, "x");
				setTooltip(el, t("close-to-apply-changes"));
			},
		);
		this.plugin.registerDomEvent(applyBtn, "click", (evt: MouseEvent) => {
			this.close();
		});

		// Add a horizontal rule
		contentEl.createEl("hr");

		const taskFilterContainer = contentEl.createDiv({
			cls: "advanced-filter-menu-container-body",
		});

		// Create metadata editor, use compact mode
		this.advancedFilterComponent = new AdvancedFilterComponent(
			taskFilterContainer,
			this.plugin,
			this.app,
			this.currentBoardID,
			this.parentFiltersAreActive,
			this.entity,
			this.existingFilters,
		);
		// Ensure the component is properly loaded
		this.advancedFilterComponent.onload();

		// Create the popover
		this.popoverRef = this.app.workspace.containerEl.createDiv({
			cls: "advanced-filter-menu",
		});
		this.popoverRef.appendChild(contentEl);

		document.body.appendChild(this.popoverRef);

		// Create a virtual element for Popper.js
		const virtualElement = {
			getBoundingClientRect: () => ({
				width: 0,
				height: 0,
				top: position.y,
				right: position.x,
				bottom: position.y,
				left: position.x,
				x: position.x,
				y: position.y,
				toJSON: function () {
					return this;
				},
			}),
		};

		if (this.popoverRef) {
			this.popperInstance = createPopper(
				virtualElement,
				this.popoverRef,
				{
					placement: "bottom-start",
					modifiers: [
						{
							name: "offset",
							options: {
								offset: [0, 8], // Offset the popover slightly from the reference
							},
						},
						{
							name: "preventOverflow",
							options: {
								padding: 10, // Padding from viewport edges
							},
						},
						{
							name: "flip",
							options: {
								fallbackPlacements: [
									"top-start",
									"right-start",
									"left-start",
								],
								padding: 10,
							},
						},
					],
				},
			);
		}

		// Use timeout to ensure popover is rendered before adding listeners
		this.win.setTimeout(() => {
			this.win.addEventListener("click", this.clickOutside);

			// No need to close the popover on-scroll.
			// this.scrollParent.addEventListener(
			// 	"scroll",
			// 	this.scrollHandler,
			// 	true
			// ); // Use capture for scroll
		}, 10);
	}

	private clickOutside = (e: MouseEvent): void => {
		const warehouseOpened =
			this.advancedFilterComponent.isWarehouseModalOpened;

		if (
			this.advancedFilterComponent.somethingElseIsOpened &&
			!warehouseOpened
		) {
			// First outside click will make the other components to close and will keep this popover open. The second click will surely close it.
			this.advancedFilterComponent.somethingElseIsOpened = false;
			return;
		}

		if (
			!warehouseOpened &&
			!this.advancedFilterComponent.somethingElseIsOpened &&
			// !this.advancedFilterComponent.isConfigModalOpen &&
			this.popoverRef &&
			!this.popoverRef.contains(e.target as Node) // This finds out if we are clicking out of the popover component
		) {
			// console.log("clickOutside - closing popover", {
			// 	target: e.target,
			// 	popoverRef: this.popoverRef,
			// 	contains: this.popoverRef.contains(e.target as Node),
			// });
			this.close();
		}
	};

	// private scrollHandler = (e: Event) => {
	// 	if (this.popoverRef) {
	// 		if (
	// 			e.target instanceof Node &&
	// 			this.popoverRef.contains(e.target)
	// 		) {
	// 			const targetElement = e.target as HTMLElement;
	// 			if (
	// 				targetElement.scrollHeight > targetElement.clientHeight ||
	// 				targetElement.scrollWidth > targetElement.clientWidth
	// 			) {
	// 				return;
	// 			}
	// 		}
	// 		this.close();
	// 	}
	// };

	/**
	 * Closes the popover.
	 */
	close() {
		if (this.popperInstance) {
			this.popperInstance.destroy();
			this.popperInstance = null;
		}

		let filtersState: AdvancedFilter | undefined = undefined;
		if (this.advancedFilterComponent) {
			try {
				filtersState = this.advancedFilterComponent.getFiltersState();
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					116,
					String(error),
					"AdvancedFilterPopover.ts/close",
				);
			}
		}

		if (this.popoverRef) {
			this.popoverRef.remove();
			this.popoverRef = null;
		}

		this.win.removeEventListener("click", this.clickOutside);
		// this.scrollParent.removeEventListener(
		// 	"scroll",
		// 	this.scrollHandler,
		// 	true
		// );

		if (this.advancedFilterComponent) {
			this.advancedFilterComponent.onunload();
		}

		if (this.onClose) {
			try {
				this.onClose(filtersState);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					117,
					String(error),
					"AdvancedFilterPopover.ts/close",
				);
			}
		}
	}
}
