/**
 * This BoardFilters component has been inspired from Bases filter and Task Genius plugin filters. All credits for this component go to the developer of Task Genius plugin.
 * Changes made to the original code:
 * 	 - Added type safetly at various places.
 *   - This component can be used for both board as well as column.
 *   - A heading for the popover and modal to display the column or board name.
 *   - Input suggestion for various properties such as tags, priority, status, filePath, etc.
 *   - Other minor changes to make it compatible with Task Board plugin.
 * @url https://github.com/Quorafind/Obsidian-Task-Genius/blob/6307b018cae3c1a20e753127faac88492aac9ffc/src/components/features/task/filter/index.ts
 */

import { TaskFilterComponent } from "./ViewTaskFilter";
import { ViewTaskFilterModal } from "./ViewTaskFilterModal";
import { ViewTaskFilterPopover } from "./ViewTaskFilterPopover";

export { TaskFilterComponent, ViewTaskFilterModal, ViewTaskFilterPopover };
