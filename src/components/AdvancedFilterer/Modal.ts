import { t } from "i18next";
import { Modal } from "obsidian";
import TaskBoard from "../../../main.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { AdvancedFilterComponent } from "./Component.js";
import { AdvancedFilter } from "../../interfaces/BoardConfigs.js";

export class AdvancedFilterModal extends Modal {
	private plugin: TaskBoard;
	private currentBoardID: string;
	public parentFiltersAreActive: boolean;
	public entity: "board" | "view" | "column";
	public taskFilterComponent: AdvancedFilterComponent | null;
	private columnOrViewOrBoardName?: string;
	private existingFilters?: AdvancedFilter;
	public filterCloseCallback:
		| ((filterState?: AdvancedFilter) => void)
		| null = null;

	constructor(
		plugin: TaskBoard,
		entity: "board" | "view" | "column",
		currentBoardID: string,
		parentFiltersAreActive: boolean,
		columnOrViewOrBoardName?: string,
		existingFilters?: AdvancedFilter,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.currentBoardID = currentBoardID;
		this.parentFiltersAreActive = parentFiltersAreActive;
		this.entity = entity;
		this.columnOrViewOrBoardName = columnOrViewOrBoardName;
		this.existingFilters = existingFilters;

		this.taskFilterComponent = null;

		if (this.entity === "column") {
			this.setTitle(
				t("column-filters-for") + " - " + this.columnOrViewOrBoardName,
			);
		} else if (this.entity === "view") {
			this.setTitle(
				t("view-filters-for") + " - " + this.columnOrViewOrBoardName,
			);
		} else if (this.entity === "board") {
			this.setTitle(
				t("board-filters-for") + " - " + this.columnOrViewOrBoardName,
			);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.taskFilterComponent = new AdvancedFilterComponent(
			this.contentEl,
			this.plugin,
			this.app,
			this.currentBoardID,
			this.parentFiltersAreActive,
			this.entity,
			this.existingFilters,
		);
		// Ensure the component is properly loaded
		this.taskFilterComponent.onload();
	}

	onClose() {
		const { contentEl } = this;

		let filtersState: AdvancedFilter | undefined = undefined;
		if (this.taskFilterComponent) {
			try {
				filtersState = this.taskFilterComponent.getFiltersState();
				this.taskFilterComponent.onunload();
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					114,
					String(error),
					"AdvancedFilterModal.ts/onClose",
				);
			}
		}

		contentEl.empty();

		if (this.filterCloseCallback) {
			try {
				this.filterCloseCallback(filtersState);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					115,
					String(error),
					"AdvancedFilterModal.ts/onClose",
				);
			}
		}
	}
}
