interface TaskFormatRegularExpr {
	priorityRegex: RegExp;
	startDateRegex: RegExp;
	createdDateRegex: RegExp;
	scheduledDateRegex: RegExp;
	dueDateRegex: RegExp;
	doneDateRegex: RegExp;
	cancelledDateRegex: RegExp;
	recurrenceRegex: RegExp;
	onCompletionRegex: RegExp;
	dependsOnRegex: RegExp;
	idRegex: RegExp;
	timeRegex: RegExp;
	reminderRegex: RegExp;
}
export interface DefaultDataviewSymbols {
	TaskFormatRegularExpr: TaskFormatRegularExpr;
	TaskFormatRegularExprGlobal: TaskFormatRegularExpr;
}

/**
 * A symbol map for Dataview plugin tasks properties.
 * Uses emojis to concisely convey meaning
 */
export const DATAVIEW_PLUGIN_DEFAULT_SYMBOLS: DefaultDataviewSymbols = {
	TaskFormatRegularExpr: {
		priorityRegex: /\[priority::\s*\d+\]/,
		startDateRegex: /\[start::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
		createdDateRegex:
			/\[created::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
		scheduledDateRegex:
			/\[scheduled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
		dueDateRegex: /\[due::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
		doneDateRegex: /\[completion::\s*(.*?)\]/,
		cancelledDateRegex:
			/\[cancelled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/,
		recurrenceRegex: /\[recurring::.*?\]/,
		onCompletionRegex: /\[onCompletion::.*?\]/,
		dependsOnRegex: /\[dependsOn::\s*([^\]]+)\]/,
		idRegex: /\[id::\s*(\d+)\s*\]/,
		timeRegex: /\[time::.*?\]/,
		reminderRegex: /\[reminder::.*?\]/,
	},
	TaskFormatRegularExprGlobal: {
		priorityRegex: /\[priority::\s*\d+\]/g,
		startDateRegex: /\[start::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/g,
		createdDateRegex:
			/\[created::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/g,
		scheduledDateRegex:
			/\[scheduled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/g,
		dueDateRegex: /\[due::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/g,
		doneDateRegex: /\[completion::\s*(.*?)\]/g,
		cancelledDateRegex:
			/\[cancelled::\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\]/g,
		recurrenceRegex: /\[recurring::.*?\]/g,
		onCompletionRegex: /\[onCompletion::.*?\]/g,
		dependsOnRegex: /\[dependsOn::\s*([^\]]+)\]/g,
		idRegex: /\[id::\s*(\d+)\s*\]/g,
		timeRegex: /\[time::.*?\]/g,
		reminderRegex: /\[reminder::.*?\]/g,
	},
} as const;
