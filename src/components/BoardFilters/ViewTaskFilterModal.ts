import { App } from "obsidian";
import { Modal } from "obsidian";
import { TaskFilterComponent, RootFilterState } from "./ViewTaskFilter";
import type TaskBoard from "main";

export class ViewTaskFilterModal extends Modal {
	public taskFilterComponent: TaskFilterComponent | null;
	public filterCloseCallback:
		| ((filterState?: RootFilterState) => void)
		| null = null;
	private plugin?: TaskBoard;

	constructor(app: App, private leafId?: string, plugin?: TaskBoard) {
		super(app);
		this.plugin = plugin;
		this.taskFilterComponent = null;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.taskFilterComponent = new TaskFilterComponent(
			this.contentEl,
			this.app,
			this.leafId,
			this.plugin
		);
		// Ensure the component is properly loaded
		this.taskFilterComponent.onload();
	}

	onClose() {
		const { contentEl } = this;

		let filterState: RootFilterState | undefined = undefined;
		if (this.taskFilterComponent) {
			try {
				filterState = this.taskFilterComponent.getFilterState();
				this.taskFilterComponent.onunload();
			} catch (error) {
				console.error(
					"Failed to get filter state before modal close",
					error
				);
			}
		}

		contentEl.empty();

		if (this.filterCloseCallback) {
			try {
				this.filterCloseCallback(filterState);
			} catch (error) {
				console.error("Error in filter close callback", error);
			}
		}
	}
}
