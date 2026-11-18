import type { ReactNode } from "react";
import type { globalSettingsData } from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import type { TaskCardFooterComponentOptions } from "./index.js";
import {
	getTaskCardFooterProperties,
	renderTaskCardFooter,
} from "./TaskCardFooter.js";
import { taskCardStyleNames } from "../../../interfaces/Enums.js";
import {
	renderTaskCardHeader,
	type TaskCardHeaderOptions,
} from "./TaskCardHeader.js";

export function renderEmojiStyleFooter(
	component: TaskCardFooterComponentOptions,
	taskItem: taskItem,
	globalSetting: globalSettingsData,
): ReactNode {
	return renderTaskCardFooter(
		component,
		getTaskCardFooterProperties(
			taskItem,
			globalSetting,
			component.propertiesVisibleInUI,
		),
		taskCardStyleNames.EMOJI,
	);
}

export function renderEmojiStyleHeader(
	header: HTMLElement,
	options: TaskCardHeaderOptions,
): void {
	renderTaskCardHeader(header, options, "emoji");
}
