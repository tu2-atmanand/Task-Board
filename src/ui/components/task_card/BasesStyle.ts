import type { ReactNode } from "react";
import type { globalSettingsData } from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import type {
	TaskCardFooterComponentOptions,
} from "./index.js";
import {
	getTaskCardFooterProperties,
	renderTaskCardFooter,
} from "./TaskCardFooter.js";
import { taskCardStyleNames } from "../../../interfaces/Enums.js";
import {
	renderTaskCardHeader,
	type TaskCardHeaderOptions,
} from "./TaskCardHeader.js";

export function renderBasesStyleFooter(
	options: TaskCardFooterComponentOptions,
	taskItem: taskItem,
	globalSetting: globalSettingsData,
): ReactNode {
	return renderTaskCardFooter(
		options,
		getTaskCardFooterProperties(
			taskItem,
			globalSetting,
			options.propertiesVisibleInUI,
		),
		taskCardStyleNames.BASES,
	);
}

export function renderBasesStyleHeader(
	header: HTMLElement,
	options: TaskCardHeaderOptions,
): void {
	renderTaskCardHeader(header, options, "bases");
}
