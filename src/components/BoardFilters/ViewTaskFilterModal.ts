import { Modal } from "obsidian";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { RootFilterState } from "src/interfaces/BoardConfigs";
import { TaskFilterComponent } from "./ViewTaskFilter";
import { useTaskBoardPlugin } from "src/context/PluginContext";

export class ViewTaskFilterModal extends Modal {
	private plugin: TaskBoard;
	public activeBoardIndex?: number;
	public taskFilterComponent: TaskFilterComponent | null;
	private columnOrBoardName?: string;
	private initialFilterState?: RootFilterState;
	public filterCloseCallback:
		| ((filterState?: RootFilterState) => void)
		| null = null;

	constructor(
		forColumn: boolean,
		private leafId?: string,
		activeBoardIndex?: number,
		columnOrBoardName?: string,
		initialFilterState?: RootFilterState
	) {
		const taskBoardPlugin = useTaskBoardPlugin();
		super(taskBoardPlugin.app);
		this.plugin = taskBoardPlugin;
		this.activeBoardIndex = activeBoardIndex;
		this.columnOrBoardName = columnOrBoardName;
		this.initialFilterState = initialFilterState;

		this.taskFilterComponent = null;

		if (forColumn) {
			this.setTitle(
				t("column-filters-for") + " " + this.columnOrBoardName
			);
		} else {
			this.setTitle(
				t("board-filters-for") + " " + this.columnOrBoardName
			);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.taskFilterComponent = new TaskFilterComponent(
			this.contentEl,
			this.app,
			this.leafId,
			this.plugin,
			this.activeBoardIndex,
			this.initialFilterState
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
