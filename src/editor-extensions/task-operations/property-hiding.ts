/**
 * Task Property Hiding Extension - Hides task properties in Live Editor similar to markdown formatting.
 * Properties are hidden by default and revealed when the cursor is positioned on them.
 */

import {
	EditorView,
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { Extension, Range, StateField } from "@codemirror/state";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import TaskBoard from "main";
import { HideableTaskProperty } from "src/interfaces/GlobalSettings";
import { isTaskLine } from "src/utils/CheckBoxUtils";
import {
	TaskRegularExpressions,
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
} from "src/regularExpressions/TasksPluginRegularExpr";
import { DATAVIEW_PLUGIN_DEFAULT_SYMBOLS } from "src/regularExpressions/DataviewPluginRegularExpr";

/**
 * Widget for showing placeholder text when properties are hidden
 */
class HiddenPropertyWidget extends WidgetType {
	constructor(private content: string) {
		super();
	}

	toDOM() {
		const span = document.createElement("span");
		span.className = "taskboard-hidden-property-placeholder";
		span.textContent = "...";
		span.title = `Hidden: ${this.content}`;
		return span;
	}
}

/**
 * Get regex patterns for different property types for different formats as per the user setting.
 */
export function getTaskPropertyRegexPatterns(
	property: HideableTaskProperty,
	tasksPropertyFormat: string
): RegExp {
	if (tasksPropertyFormat === "1" || tasksPropertyFormat === "2") {
		switch (property) {
			case HideableTaskProperty.ID:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.idRegex;

			case HideableTaskProperty.Tags:
				// return [/#[\w\-_\/]+/g];
				return TaskRegularExpressions.hashTagsRegex;

			case HideableTaskProperty.CreatedDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.createdDateRegex;

			case HideableTaskProperty.StartDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.startDateRegex;

			case HideableTaskProperty.ScheduledDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.scheduledDateRegex;

			case HideableTaskProperty.DueDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.dueDateRegex;

			case HideableTaskProperty.CompletionDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.doneDateRegex;

			case HideableTaskProperty.CancelledDate:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.cancelledDateRegex;

			case HideableTaskProperty.Priority:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.priorityRegex;

			case HideableTaskProperty.Time:
				return /⏰\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g;

			case HideableTaskProperty.Recurring:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.recurrenceRegex;

			case HideableTaskProperty.OnCompletion:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.onCompletionRegex;

			case HideableTaskProperty.Dependencies:
				return TASKS_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExpWithGlobal.dependsOnRegex;

			case HideableTaskProperty.Reminder:
				return /\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/g;

			default:
				return /(?:)/g;
		}
	} else if (tasksPropertyFormat === "3") {
		switch (property) {
			case HideableTaskProperty.ID:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.idRegex;

			case HideableTaskProperty.Tags:
				// return [/#[\w\-_\/]+/g];
				return TaskRegularExpressions.hashTagsRegex;

			case HideableTaskProperty.CreatedDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.createdDateRegex;

			case HideableTaskProperty.StartDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.startDateRegex;

			case HideableTaskProperty.ScheduledDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.scheduledDateRegex;

			case HideableTaskProperty.DueDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.dueDateRegex;

			case HideableTaskProperty.CompletionDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.doneDateRegex;

			case HideableTaskProperty.CancelledDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.cancelledDateRegex;

			case HideableTaskProperty.Priority:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.priorityRegex;

			case HideableTaskProperty.Time:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.timeRegex;

			case HideableTaskProperty.Recurring:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.recurrenceRegex;

			case HideableTaskProperty.OnCompletion:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.onCompletionRegex;

			case HideableTaskProperty.Dependencies:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.dependsOnRegex;

			case HideableTaskProperty.Reminder:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.reminderRegex;

			default:
				return /(?:)/g;
		}
	} else {
		switch (property) {
			case HideableTaskProperty.ID:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.idRegex;

			case HideableTaskProperty.Tags:
				// return [/#[\w\-_\/]+/g];
				return TaskRegularExpressions.hashTagsRegex;

			case HideableTaskProperty.CreatedDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.createdDateRegex;

			case HideableTaskProperty.StartDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.startDateRegex;

			case HideableTaskProperty.ScheduledDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.scheduledDateRegex;

			case HideableTaskProperty.DueDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.dueDateRegex;

			case HideableTaskProperty.CompletionDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.doneDateRegex;

			case HideableTaskProperty.CancelledDate:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.cancelledDateRegex;

			case HideableTaskProperty.Priority:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.priorityRegex;

			case HideableTaskProperty.Time:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.timeRegex;

			case HideableTaskProperty.Recurring:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.recurrenceRegex;

			case HideableTaskProperty.OnCompletion:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.onCompletionRegex;

			case HideableTaskProperty.Dependencies:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.dependsOnRegex;

			case HideableTaskProperty.Reminder:
				return DATAVIEW_PLUGIN_DEFAULT_SYMBOLS
					.TaskFormatRegularExprGlobal.reminderRegex;

			default:
				return /(?:)/g;
		}
	}
}

/**
 * Creates decorations for hiding task properties
 */
function createPropertyDecorations(
	view: EditorView,
	plugin: TaskBoard
): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const hiddenProperties =
		plugin.settings.data.globalSettings.hiddenTaskProperties || [];

	const cursorPos = view.state.selection.main.head;
	const doc = view.state.doc;

	// Process each line
	for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
		const line = doc.line(lineNum);
		const lineText = line.text;
		// console.log("Processing the following line of the file : ", lineText);

		// Skip non-task lines
		if (!isTaskLine(lineText)) continue;

		// Check if line is in codeblock or frontmatter
		const syntaxNode = syntaxTree(view.state).resolveInner(line.from + 1);
		const nodeProps = syntaxNode.type.prop(tokenClassNodeProp);

		if (nodeProps) {
			const props = nodeProps.split(" ");
			if (
				props.includes("hmd-codeblock") ||
				props.includes("hmd-frontmatter")
			) {
				continue;
			}
		}

		// Check if cursor is on this line
		const cursorOnLine = cursorPos >= line.from && cursorPos <= line.to;

		// Process each hidden property type
		hiddenProperties.forEach((property) => {
			const pattern = getTaskPropertyRegexPatterns(
				property,
				plugin.settings.data.globalSettings?.taskPropertyFormat
			);
			const matches = Array.from(lineText.matchAll(pattern));
			// console.log(
			// 	"For hidden property :",
			// 	property,
			// 	"\nPattern is :",
			// 	pattern,
			// 	"\nRegex execution : ",
			// 	matches
			// );

			for (const match of matches) {
				if (typeof match.index !== "number") {
					console.warn(
						"Match index is undefined, skipping match:",
						match
					);
					continue;
				}
				const matchStart = line.from + match.index;
				const matchEnd = matchStart + match[0].length;

				// console.log(
				// 	"CursorPos:",
				// 	cursorPos,
				// 	"MatchStart:",
				// 	matchStart,
				// 	"MatchEnd:",
				// 	matchEnd
				// );

				// Check if cursor is within or near the match
				const cursorNearMatch =
					cursorOnLine &&
					cursorPos >= matchStart - 1 &&
					cursorPos <= matchEnd + 1;

				// console.log(
				// 	"Found match:",
				// 	match[0],
				// 	"\nFor line:",
				// 	lineText,
				// 	"\nCursor Near Match:",
				// 	cursorNearMatch
				// );
				if (!cursorNearMatch) {
					// Hide the property by making it invisible
					decorations.push(
						Decoration.mark({
							class: "taskboard-hidden-property-editor",
							attributes: {
								style: "opacity: 0; font-size: 0; display: none;",
							},
						}).range(matchStart, matchEnd)
					);

					// Add a placeholder widget
					decorations.push(
						Decoration.widget({
							widget: new HiddenPropertyWidget(match[0]),
							side: 0,
						}).range(matchEnd)
					);
				}
			}
		});
	}

	// TODO : Need a optimized code here. This might fail during build on GitHub actions.
	return Decoration.set(
		decorations.sort((a, b) => {
			if (a.from !== b.from) return a.from - b.from;
			// If both are marks, sort by to
			if (a.to !== undefined && b.to !== undefined && a.to !== b.to)
				return a.to - b.to;
			// Otherwise, sort by side
			const aSide =
				(a.value as Decoration & { side?: number }) &&
				typeof (a.value as Decoration & { side?: number }).side ===
					"number"
					? (a.value as Decoration & { side?: number }).side
					: 0;
			const bSide =
				(b.value as Decoration & { side?: number }) &&
				typeof (b.value as Decoration & { side?: number }).side ===
					"number"
					? (b.value as Decoration & { side?: number }).side
					: 0;
			return (aSide ?? 0) - (bSide ?? 0);
		})
	);
}

/**
 * State field for managing property hiding decorations
 */
const propertyHidingField = StateField.define<DecorationSet>({
	create(state) {
		return Decoration.none;
	},
	update(decorations, transaction) {
		if (transaction.docChanged || transaction.selection) {
			// Rebuild decorations when document or selection changes
			return decorations.map(transaction.changes);
		}
		return decorations;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * View plugin for task property hiding
 */
const propertyHidingPlugin = (plugin: TaskBoard) =>
	ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = createPropertyDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				if (
					update.docChanged ||
					update.selectionSet ||
					update.viewportChanged
				) {
					this.decorations = createPropertyDecorations(
						update.view,
						plugin
					);
				}
			}
		},
		{
			decorations: (v) => v.decorations,
		}
	);

/**
 * Task Property Hiding Extension
 */
export function taskPropertyHidingExtension(plugin: TaskBoard): Extension {
	return [
		propertyHidingField,
		propertyHidingPlugin(plugin),
		EditorView.baseTheme({
			".taskboard-hidden-property-editor": {
				opacity: "0",
				fontSize: "0",
				display: "none",
			},
			".taskboard-hidden-property-placeholder": {
				opacity: "0.3",
				fontSize: "0.8em",
				fontStyle: "italic",
				color: "var(--text-muted)",
				cursor: "pointer",
			},
			".taskboard-hidden-property-placeholder:hover": {
				opacity: "0.6",
			},
		}),
	];
}
