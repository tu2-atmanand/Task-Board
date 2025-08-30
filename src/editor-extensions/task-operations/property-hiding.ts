/**
 * Task Property Hiding Extension - Hides task properties in Live Editor similar to markdown formatting.
 * Properties are hidden by default and revealed when the cursor is positioned on them.
 */

import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Extension, Range, StateField } from "@codemirror/state";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import TaskBoard from "main";
import { HideableTaskProperty } from "src/interfaces/GlobalSettings";
import { isTaskLine } from "src/utils/CheckBoxUtils";
import { priorityEmojis } from "src/interfaces/TaskItem";

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
 * Get regex patterns for different property types
 */
function getPropertyPatterns(property: HideableTaskProperty): RegExp[] {
	switch (property) {
		case HideableTaskProperty.Tags:
			return [/#[\w\-_\/]+/g];

		case HideableTaskProperty.CreatedDate:
			return [
				/➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/g,
				/\[created::.*?\]/g,
				/@created\(.*?\)/g,
			];

		case HideableTaskProperty.StartDate:
			return [
				/🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/g,
				/\[start::.*?\]/g,
				/@start\(.*?\)/g,
			];

		case HideableTaskProperty.ScheduledDate:
			return [
				/⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/g,
				/\[scheduled::.*?\]/g,
				/@scheduled\(.*?\)/g,
			];

		case HideableTaskProperty.DueDate:
			return [
				/📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/g,
				/\[due::.*?\]/g,
				/@due\(.*?\)/g,
			];

		case HideableTaskProperty.CompletionDate:
			return [
				/✅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/g,
				/\[completion::.*?\]/g,
				/@completion\(.*?\)/g,
			];

		case HideableTaskProperty.Priority:
			return [
				new RegExp(
					`(${Object.values(priorityEmojis)
						.map((emoji) => `\\s*${emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`)
						.join("|")})`,
					"g"
				),
				/\[priority::\s*\d+\]/g,
				/@priority\(\s*\d+\s*\)/g,
			];

		case HideableTaskProperty.Time:
			return [
				/⏰\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g,
				/\b\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\b/g,
				/\[time::.*?\]/g,
				/@time\(.*?\)/g,
			];

		case HideableTaskProperty.Dependencies:
			return [/\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/g];

		default:
			return [];
	}
}

/**
 * Creates decorations for hiding task properties
 */
function createPropertyDecorations(view: EditorView, plugin: TaskBoard): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const hiddenProperties = plugin.settings.data.globalSettings.hiddenTaskProperties || [];
	
	if (hiddenProperties.length === 0) {
		return Decoration.none;
	}

	const cursorPos = view.state.selection.main.head;
	const doc = view.state.doc;

	// Process each line
	for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
		const line = doc.line(lineNum);
		const lineText = line.text;

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
			const patterns = getPropertyPatterns(property);
			patterns.forEach((pattern) => {
				let match;
				while ((match = pattern.exec(lineText)) !== null) {
					const matchStart = line.from + match.index;
					const matchEnd = matchStart + match[0].length;
					
					// Check if cursor is within or near the match
					const cursorNearMatch = cursorOnLine && 
						cursorPos >= matchStart - 2 && 
						cursorPos <= matchEnd + 2;

					if (!cursorNearMatch) {
						// Hide the property by making it invisible
						decorations.push(
							Decoration.mark({
								class: "taskboard-hidden-property-editor",
								attributes: { 
									style: "opacity: 0; font-size: 0; display: none;" 
								}
							}).range(matchStart, matchEnd)
						);

						// Add a placeholder widget
						decorations.push(
							Decoration.widget({
								widget: new HiddenPropertyWidget(match[0]),
								side: 0
							}).range(matchEnd)
						);
					}
				}
			});
		});
	}

	return Decoration.set(decorations.sort((a, b) => a.from - b.from));
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
	provide: f => EditorView.decorations.from(f)
});

/**
 * View plugin for task property hiding
 */
const propertyHidingPlugin = (plugin: TaskBoard) => ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = createPropertyDecorations(view, plugin);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = createPropertyDecorations(update.view, plugin);
			}
		}
	},
	{
		decorations: v => v.decorations,
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
				display: "none"
			},
			".taskboard-hidden-property-placeholder": {
				opacity: "0.3",
				fontSize: "0.8em",
				fontStyle: "italic",
				color: "var(--text-muted)",
				cursor: "pointer"
			},
			".taskboard-hidden-property-placeholder:hover": {
				opacity: "0.6"
			}
		})
	];
}