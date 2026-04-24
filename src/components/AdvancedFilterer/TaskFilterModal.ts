import { t } from "i18next";
import { Modal } from "obsidian";
import TaskBoard from "../../../main.js";
import { RootFilterState } from "../../interfaces/BoardConfigs.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { TaskFilterComponent } from "./TaskFilterComponent.js";

export class TaskFilterModal extends Modal {
	private plugin: TaskBoard;
	public taskFilterComponent: TaskFilterComponent | null;
	private columnOrBoardName?: string;
	private initialFilterState?: RootFilterState;
	public filterCloseCallback:
		| ((filterState?: RootFilterState) => void)
		| null = null;

	constructor(
		plugin: TaskBoard,
		forColumn: boolean,
		private leafId?: string,
		columnOrBoardName?: string,
		initialFilterState?: RootFilterState,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.columnOrBoardName = columnOrBoardName;
		this.initialFilterState = initialFilterState;

		this.taskFilterComponent = null;

		if (forColumn) {
			this.setTitle(
				t("column-filters-for") + " " + this.columnOrBoardName,
			);
		} else {
			this.setTitle(
				t("board-filters-for") + " " + this.columnOrBoardName,
			);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.taskFilterComponent = new TaskFilterComponent(
			this.contentEl,
			this.plugin,
			this.app,
			this.leafId,
			this.initialFilterState,
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
				bugReporterManagerInsatance.addToLogs(
					114,
					String(error),
					"TaskFilterModal.ts/onClose",
				);
			}
		}

		contentEl.empty();

		if (this.filterCloseCallback) {
			try {
				this.filterCloseCallback(filterState);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					115,
					String(error),
					"TaskFilterModal.ts/onClose",
				);
			}
		}
	}
}
