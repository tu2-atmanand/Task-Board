import { TaskRegularExpressions } from "./TasksPluginRegularExpr";

/**
 * A symbol map for Dataview plugin tasks properties.
 * Uses emojis to concisely convey meaning
 */
export const DATAVIEW_PLUGIN_DEFAULT_SYMBOLS: Record<string, RegExp> = {
	priorityRegex: /\[priority::\s*\d+\]/,
	startDateRegex: /\[start::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
	createdDateRegex: /\[created::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
	scheduledDateRegex:
		/\[scheduled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
	dueDateRegex: /\[due::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
	doneDateRegex: /\[completion::\s*(.*?)\]/,
	cancelledDateRegex:
		/\[cancelled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
	recurrenceRegex: /\[recurring::.*?\]/,
	onCompletionRegex: /\[onCompletion::.*?\]/,
	dependsOnRegex: /\[dependsOn::\s*([^\]]+)\]/,
	idRegex: /\[id::.*?\]/,
	timeRegex: /\[time::.*?\]/,
	reminderRegex: /\[reminder::.*?\]/,
} as const;
