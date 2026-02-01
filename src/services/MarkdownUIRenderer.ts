// /src/services/MarkdownUIRenderer.ts

import { App, Component, MarkdownRenderer } from "obsidian";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

export type TextRenderer = (
	app: App,
	text: string,
	element: HTMLSpanElement,
	path: string,
	obsidianComponent: Component | null, // null is allowed here only for tests
) => Promise<void>;

/**
 * Create an HTML element, and append it to a parent element.
 *
 * Unlike the equivalent Obsidian convenience function li.createEl(),
 * this can be called from our automated tests.
 *
 * @param tagName - the type of element to be created, for example 'ul', 'div', 'span', 'li'.
 * @param parentElement - the parent element, to which the created element will be appended.
 *
 * @example <caption>Example call:</caption>
 * const li = createAndAppendElement('li', parentElement);
 */
export function createAndAppendElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	parentElement: HTMLElement,
): HTMLElementTagNameMap[K] {
	// Maintenance note:
	//  We don't use the Obsidian convenience function li.createEl() here, because we don't have it available
	//  when running tests, and we want the tests to be able to create the full div and span structure,
	//  so had to convert all of these to the equivalent but more elaborate document.createElement() and
	//  appendChild() calls.

	const el: HTMLElementTagNameMap[K] = document.createElement(tagName);
	parentElement.appendChild(el);
	return el;
}

export class MarkdownUIRenderer {
	private readonly textRenderer: TextRenderer;
	private readonly obsidianComponent: Component | null;
	private readonly parentUlElement: HTMLElement;
	// private readonly taskLayoutOptions: TaskLayoutOptions;
	// private readonly queryLayoutOptions: QueryLayoutOptions;

	public static async obsidianMarkdownRenderer(
		app: App,
		text: string,
		element: HTMLSpanElement,
		path: string,
		obsidianComponent: Component | null,
	) {
		if (!obsidianComponent) {
			return;
		}
		await MarkdownRenderer.render(
			app,
			text,
			element,
			path,
			obsidianComponent,
		);
	}

	/**
	 * Builds a renderer for tasks with various options.
	 *
	 * @param textRenderer The optional renderer to be used. Skip this parameter for Obsidian rendering.
	 * For test purposes mock renderers shall be used.
	 *
	 * @param obsidianComponent One of the parameters needed by `MarkdownRenderer.renderMarkdown()` Obsidian API,
	 * that is called by the Obsidian renderer. Set this to null in test code.
	 *
	 * @param parentUlElement HTML element where the task shall be rendered.
	 */
	constructor({
		textRenderer = MarkdownUIRenderer.obsidianMarkdownRenderer,
		obsidianComponent,
		parentUlElement,
	}: {
		textRenderer?: TextRenderer;
		obsidianComponent: Component | null;
		parentUlElement: HTMLElement;
	}) {
		this.textRenderer = textRenderer;
		this.obsidianComponent = obsidianComponent;
		this.parentUlElement = parentUlElement;
	}

	public static async renderTaskDisc(
		app: App,
		taskDescText: string,
		element: HTMLDivElement,
		path: string,
		obsidianComponent: Component | null,
	) {
		if (!obsidianComponent) {
			return;
		}

		await MarkdownRenderer.render(
			app,
			taskDescText,
			element,
			path,
			obsidianComponent,
		);
	}

	static async renderSubtaskText(
		app: App,
		subtaskText: string,
		el: HTMLElement,
		path: string,
		taskItemComponent: Component | null,
	) {
		try {
			// console.log("renderSubtaskText : Received following text : ", subtaskText);
			let componentEl = taskItemComponent ?? new Component();
			if (!componentEl) {
				return;
			}
			// Call Obsidian's MarkdownRenderer to render the subtaskText as markdown
			await MarkdownRenderer.render(
				app,
				subtaskText,
				el,
				path,
				componentEl,
			);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				102,
				String(error),
				"MarkdownUIRenderer.ts/MarkdownUIRenderer.renderSubtaskText",
			);
		}
	}
}
