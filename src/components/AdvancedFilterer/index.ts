/**
 * This BoardFilters component has been inspired from Bases filter and Task Genius plugin filters. All credits for this component go to the developer of Task Genius plugin.
 * 
 * Changes made to the original code:
 * 	 - Added type safety at various places.
 *   - Completely re-designed the structure to create multiple {@link Filter} for the same entity. 
 *   - This component can be used for board-level, view-level and column-level advanced filters.
 *   - A heading for the popover and modal to display the board, view or column name.
 *   - Input suggestion for various properties such as tags, priority, status, filePath, etc.
 *   - Other minor changes to make it compatible with Task Board plugin.
 * @url https://github.com/Quorafind/Obsidian-Task-Genius/blob/6307b018cae3c1a20e753127faac88492aac9ffc/src/components/features/task/filter/index.ts
 */

import { AdvancedFilterComponent } from "./Component.js";
import { AdvancedFilterModal } from "./Modal.js";
import { AdvancedFilterPopover } from "./Popover.js";
import { FiltersWarehouseModal } from "./FiltersWarehouse.js";

export {
	AdvancedFilterComponent,
	AdvancedFilterModal,
	AdvancedFilterPopover,
	FiltersWarehouseModal,
};
