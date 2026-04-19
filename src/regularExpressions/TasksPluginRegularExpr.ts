export class TaskRegularExpressions {
	// Matches indentation before a list marker (including > for potentially nested blockquotes or Obsidian callouts)
	public static readonly indentationRegex = /^([\s\t>]*)/;

	// Matches - * and + list markers, or numbered list markers, for example 1. and 1)
	public static readonly listMarkerRegex = /([-*+]|[0-9]+[.)])/;

	// Matches a checkbox and saves the status character inside
	public static readonly checkboxRegex = /\[(.)\]/u;

	// Matches the rest of the task after the checkbox.
	public static readonly afterCheckboxRegex = / *(.*)/u;

	// Matches the indentation and checkbox only.
	public static readonly indentationAndCheckboxRegex = new RegExp(
		TaskRegularExpressions.indentationRegex.source +
			TaskRegularExpressions.listMarkerRegex.source +
			" +" +
			TaskRegularExpressions.checkboxRegex.source,
	);

	// Main regex for parsing a line. It matches the following:
	// - Indentation
	// - List marker
	// - Status character
	// - Rest of task after checkbox markdown
	// See Task.extractTaskComponents() for abstraction around this regular expression.
	// That is private for now, but could be made public in future if needed.
	public static readonly taskRegex = new RegExp(
		TaskRegularExpressions.indentationRegex.source +
			TaskRegularExpressions.listMarkerRegex.source +
			" +" +
			TaskRegularExpressions.checkboxRegex.source +
			TaskRegularExpressions.afterCheckboxRegex.source,
		"u",
	);

	// Used with the "Create or Edit Task" command to parse indentation and status if present
	// It matches the following:
	// - Indentation
	// - List marker
	// - Checkbox with status character
	// - Status character
	// - Rest of task after checkbox markdown
	public static readonly nonTaskRegex = new RegExp(
		TaskRegularExpressions.indentationRegex.source +
			TaskRegularExpressions.listMarkerRegex.source +
			"? *(" +
			TaskRegularExpressions.checkboxRegex.source +
			")?" +
			TaskRegularExpressions.afterCheckboxRegex.source,
		"u",
	);

	// Used with "Toggle Done" command to detect a list item that can get a checkbox added to it.
	public static readonly listItemRegex = new RegExp(
		TaskRegularExpressions.indentationRegex.source +
			TaskRegularExpressions.listMarkerRegex.source,
	);

	// Match on block link at end.
	public static readonly blockLinkRegex = / \^[a-zA-Z0-9-]+$/u;

	// Regex to match all hash tags, basically hash followed by anything but the characters in the negation.
	// To ensure URLs are not caught it is looking of beginning of string tag and any
	// tag that has a space in front of it. Any # that has a character in front
	// of it will be ignored.
	// EXAMPLE:
	// description: '#dog #car http://www/ddd#ere #house'
	// matches: #dog, #car, #house
	// MAINTENANCE NOTE:
	//  If hashTags is modified, please update 'Recognising Tags' in Tags.md in the docs.
	public static readonly hashTagsRegex = /(^|\s)#[^ !@#$%^&*(),.?":{}|<>]+/g;
	public static readonly hashTag = new RegExp(this.hashTagsRegex.source);
	public static readonly hashTagsFromEnd = new RegExp(
		this.hashTagsRegex.source + "$",
	);

	// The allowed characters in a single task id:
	public static readonly taskIdRegex = /[a-zA-Z0-9-_]+/;

	// The allowed characters in a comma-separated sequence of task ids:
	public static readonly taskIdSequenceRegex = new RegExp(
		this.taskIdRegex.source + "( *, *" + this.taskIdRegex.source + " *)*",
	);
}

/* Interface describing the symbols that {@link DefaultTaskSerializer}
 * uses to serialize and deserialize tasks.
 *
 * @interface DefaultTaskSerializerSymbols
 */
export interface DefaultTaskSerializerSymbols {
	// NEW_TASK_FIELD_EDIT_REQUIRED
	readonly prioritySymbols: {
		Highest: string;
		High: string;
		Medium: string;
		Low: string;
		Lowest: string;
		None: string;
	};
	readonly duration: string;
	readonly startDateSymbol: string;
	readonly createdDateSymbol: string;
	readonly scheduledDateSymbol: string;
	readonly dueDateSymbol: string;
	readonly doneDateSymbol: string;
	readonly cancelledDateSymbol: string;
	readonly recurrenceSymbol: string;
	readonly onCompletionSymbol: string;
	readonly idSymbol: string;
	readonly dependsOnSymbol: string;
	readonly dependsOnCompletedSymbol: string;
	readonly TaskFormatRegularExpressions: {
		priorityRegex: RegExp;
		durationRegex: RegExp;
		startDateRegex: RegExp;
		createdDateRegex: RegExp;
		scheduledDateRegex: RegExp;
		dueDateRegex: RegExp;
		doneDateRegex: RegExp;
		cancelledDateRegex: RegExp;
		recurrenceRegex: RegExp;
		onCompletionRegex: RegExp;
		idRegex: RegExp;
		dependsOnRegex: RegExp;
	};
	readonly TaskFormatRegularExpWithGlobal: {
		priorityRegex: RegExp;
		durationRegex: RegExp;
		startDateRegex: RegExp;
		createdDateRegex: RegExp;
		scheduledDateRegex: RegExp;
		dueDateRegex: RegExp;
		doneDateRegex: RegExp;
		cancelledDateRegex: RegExp;
		recurrenceRegex: RegExp;
		onCompletionRegex: RegExp;
		idRegex: RegExp;
		dependsOnRegex: RegExp;
	};
}

function dateFieldRegex(symbols: string, filter: string) {
	// Match symbol with optional emoji variant selector, optional space (0 or 1), and capture any contiguous non-space characters
	// This allows flexible date format parsing (YYYY-MM-DD, YYYY/MM/DD, ISO 8601, etc.)
	let source = symbols + "\uFE0F? ?([^ ]+)";
	return filter ? new RegExp(source, filter) : new RegExp(source);
}

function fieldRegex(symbols: string, valueRegexString: string, filter: string) {
	// \uFE0F? allows an optional Variant Selector 16 on emojis.
	let source = symbols + "\uFE0F?";
	if (valueRegexString !== "") {
		source += " ?" + valueRegexString;
	}
	// The regexes end with `$` because they will be matched and
	// removed from the end until none are left.
	// source += "$";
	return filter ? new RegExp(source, filter) : new RegExp(source); // Remove the 'u' flag, to fix parsing on iPadOS/iOS 18.6 and 26 Public Beta 2
}

/**
 * A symbol map for obsidian-task's default task style.
 * Uses emojis to concisely convey meaning
 */
export const TASKS_PLUGIN_DEFAULT_SYMBOLS: DefaultTaskSerializerSymbols = {
	// NEW_TASK_FIELD_EDIT_REQUIRED
	prioritySymbols: {
		Highest: "🔺",
		High: "⏫",
		Medium: "🔼",
		Low: "🔽",
		Lowest: "⏬",
		None: "",
	},
	duration: "⏰",
	startDateSymbol: "🛫",
	createdDateSymbol: "➕",
	scheduledDateSymbol: "⏳",
	dueDateSymbol: "📅",
	doneDateSymbol: "✅",
	cancelledDateSymbol: "❌",
	recurrenceSymbol: "🔁",
	onCompletionSymbol: "🏁",
	dependsOnSymbol: "⛔",
	dependsOnCompletedSymbol: "⛔︎",
	idSymbol: "🆔",
	TaskFormatRegularExpressions: {
		priorityRegex: fieldRegex("(🔺|⏫|🔼|🔽|⏬)", "", ""),
		durationRegex: dateFieldRegex("⏰", ""),
		startDateRegex: dateFieldRegex("🛫", ""),
		createdDateRegex: dateFieldRegex("➕", ""),
		scheduledDateRegex: dateFieldRegex("(?:⏳|⌛)", ""),
		dueDateRegex: dateFieldRegex("(?:📅|📆|🗓)", ""),
		doneDateRegex: dateFieldRegex("✅", ""),
		cancelledDateRegex: dateFieldRegex("❌", ""),
		recurrenceRegex: fieldRegex("🔁", "([a-zA-Z0-9, !]+)", ""),
		onCompletionRegex: fieldRegex("🏁", "([a-zA-Z]+)", ""),
		dependsOnRegex: fieldRegex(
			"⛔",
			"(" + TaskRegularExpressions.taskIdSequenceRegex.source + ")",
			"",
		),
		idRegex: fieldRegex(
			"🆔",
			"(" + TaskRegularExpressions.taskIdRegex.source + ")",
			"",
		),
	},
	TaskFormatRegularExpWithGlobal: {
		priorityRegex: fieldRegex("(🔺|⏫|🔼|🔽|⏬)", "", "g"),
		durationRegex: dateFieldRegex("⏰", "g"),
		startDateRegex: dateFieldRegex("🛫", "g"),
		createdDateRegex: dateFieldRegex("➕", "g"),
		scheduledDateRegex: dateFieldRegex("(?:⏳|⌛)", "g"),
		dueDateRegex: dateFieldRegex("(?:📅|📆|🗓)", "g"),
		doneDateRegex: dateFieldRegex("✅", "g"),
		cancelledDateRegex: dateFieldRegex("❌", "g"),
		recurrenceRegex: fieldRegex("🔁", "([a-zA-Z0-9, !]+)", "g"),
		onCompletionRegex: fieldRegex("🏁", "([a-zA-Z]+)", "g"),
		dependsOnRegex: fieldRegex(
			"⛔",
			"(" + TaskRegularExpressions.taskIdSequenceRegex.source + ")",
			"g",
		),
		idRegex: fieldRegex(
			"🆔",
			"(" + TaskRegularExpressions.taskIdRegex.source + ")",
			"g",
		),
	},
} as const;
