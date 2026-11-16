import type { ReactNode } from "react";
import type { globalSettingsData } from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import type { TaskCardFooterComponent } from "./index.js";
import { getTaskCardFooterProperties, renderTaskCardFooter } from "./TaskCardFooter.js";

export function renderBasesStyleFooter(
	component: TaskCardFooterComponent,
	taskItem: taskItem,
	globalSetting: globalSettingsData,
): ReactNode {
	return renderTaskCardFooter(
		component,
		getTaskCardFooterProperties(taskItem, globalSetting),
		"bases",
	);
}
