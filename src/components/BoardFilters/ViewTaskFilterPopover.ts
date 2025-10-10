import { App } from "obsidian";
import { CloseableComponent, Component } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { TaskFilterComponent, RootFilterState } from "./ViewTaskFilter";
import type TaskBoard from "main";

export class ViewTaskFilterPopover
	extends Component
	implements CloseableComponent
{
	private app: App;
	public popoverRef: HTMLDivElement | null = null;
	public taskFilterComponent!: TaskFilterComponent;
	private win: Window;
	private scrollParent: HTMLElement | Window;
	private popperInstance: PopperInstance | null = null;
	public onClose: ((filterState?: RootFilterState) => void) | null = null;
	private plugin?: TaskBoard;
	private activeBoardIndex?: number;

	constructor(
		app: App,
		private leafId?: string | undefined,
		plugin?: TaskBoard,
		activeBoardIndex?: number
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.activeBoardIndex = activeBoardIndex;
		this.win = app.workspace.containerEl.win || window;

		this.scrollParent = this.win;
	}

	/**
	 * Shows the task details popover at the given position.
	 */
	showAtPosition(position: { x: number; y: number }) {
		if (this.popoverRef) {
			this.close();
		}

		// Create content container
		const contentEl = createDiv({ cls: "task-popover-content" });

		// Prevent clicks inside the popover from bubbling up
		this.registerDomEvent(contentEl, "click", (e) => {
			e.stopPropagation();
		});

		// Create metadata editor, use compact mode
		this.taskFilterComponent = new TaskFilterComponent(
			contentEl,
			this.app,
			this.leafId,
			this.plugin,
			this.activeBoardIndex
		);
		// Ensure the component is properly loaded
		this.taskFilterComponent.onload();

		// Create the popover
		this.popoverRef = this.app.workspace.containerEl.createDiv({
			cls: "filter-menu tg-menu bm-menu", // Borrowing some classes from IconMenu
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
				}
			);
		}

		// Use timeout to ensure popover is rendered before adding listeners
		this.win.setTimeout(() => {
			this.win.addEventListener("click", this.clickOutside);
			this.scrollParent.addEventListener(
				"scroll",
				this.scrollHandler,
				true
			); // Use capture for scroll
		}, 10);
	}

	private clickOutside = (e: MouseEvent) => {
		if (this.popoverRef && !this.popoverRef.contains(e.target as Node)) {
			console.log("clickOutside - closing popover", {
				target: e.target,
				popoverRef: this.popoverRef,
				contains: this.popoverRef.contains(e.target as Node),
			});
			this.close();
		}
	};

	private scrollHandler = (e: Event) => {
		if (this.popoverRef) {
			if (
				e.target instanceof Node &&
				this.popoverRef.contains(e.target)
			) {
				const targetElement = e.target as HTMLElement;
				if (
					targetElement.scrollHeight > targetElement.clientHeight ||
					targetElement.scrollWidth > targetElement.clientWidth
				) {
					return;
				}
			}
			this.close();
		}
	};

	/**
	 * Closes the popover.
	 */
	close() {
		if (this.popperInstance) {
			this.popperInstance.destroy();
			this.popperInstance = null;
		}

		let filterState: RootFilterState | undefined = undefined;
		if (this.taskFilterComponent) {
			try {
				filterState = this.taskFilterComponent.getFilterState();
			} catch (error) {
				console.error("Failed to get filter state before close", error);
			}
		}

		if (this.popoverRef) {
			this.popoverRef.remove();
			this.popoverRef = null;
		}

		this.win.removeEventListener("click", this.clickOutside);
		this.scrollParent.removeEventListener(
			"scroll",
			this.scrollHandler,
			true
		);

		if (this.taskFilterComponent) {
			this.taskFilterComponent.onunload();
		}

		if (this.onClose) {
			try {
				this.onClose(filterState);
			} catch (error) {
				console.error("Error in onClose callback", error);
			}
		}
	}
}
