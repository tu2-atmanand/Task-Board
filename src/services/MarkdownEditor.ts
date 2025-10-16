// /src/services/MarkdownEditor.ts

/**
 * This complete EmbeddableMarkdownEditor component has been imported from Task Genius plugin.
 * @see https://github.com/Quorafind/Obsidian-Task-Genius/blob/59a2d42f9fb95a5700d32975917e56372e5bdb7d/src/editor-extensions/core/markdown-editor.ts
 */

import {
	App,
	Editor,
	MarkdownScrollableEditView,
	Scope,
	TFile,
	WidgetEditorView,
	WorkspaceLeaf,
} from "obsidian";

import { EditorSelection, Prec } from "@codemirror/state";
import {
	EditorView,
	keymap,
	placeholder,
	ViewUpdate,
	Decoration,
	DecorationSet,
} from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

import { around } from "monkey-around";
import type TaskBoard from "main";
import { FrontmatterRenderer } from "./FrontmatterRenderer";

/**
 * Creates an embeddable markdown editor
 * @param app The Obsidian app instance
 * @param container The container element
 * @param options Editor options
 * @returns A configured markdown editor
 */
export function createEmbeddableMarkdownEditor(
	plugin: TaskBoard,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps>
): EmbeddableMarkdownEditor {
	// Get the editor class
	const EditorClass = resolveEditorPrototype(plugin.app);

	// Create the editor instance
	return new EmbeddableMarkdownEditor(
		plugin,
		plugin.app,
		EditorClass,
		container,
		options
	);
}

/**
 * Resolves the markdown editor prototype from the app
 */
function resolveEditorPrototype(app: App): any {
	// Create a temporary editor to resolve the prototype of ScrollableMarkdownEditor
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: createDiv() },
		null as unknown as TFile,
		""
	) as WidgetEditorView;

	// Mark as editable to instantiate the editor
	widgetEditorView.editable = true;
	widgetEditorView.showEditor();
	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(widgetEditorView.editMode!)
	);

	// Unload to remove the temporary editor
	widgetEditorView.unload();

	// Return the constructor, using 'any' type to bypass the abstract class check
	return MarkdownEditor.constructor;
}

interface MarkdownEditorProps {
	cursorLocation?: { anchor: number; head: number };
	value?: string;
	cls?: string;
	placeholder?: string;
	enableFrontmatterUI?: boolean; // Enable enhanced frontmatter UI
	file?: TFile; // Optional file for context in property rendering

	onEnter: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	// onEscape: (editor: EmbeddableMarkdownEditor) => void;
	onSubmit: (editor: EmbeddableMarkdownEditor) => void;
	onBlur: (editor: EmbeddableMarkdownEditor) => void;
	onPaste: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	onChange: (update: ViewUpdate, fullContent: string) => void;
}

const defaultProperties: MarkdownEditorProps = {
	cursorLocation: { anchor: 0, head: 0 },
	value: "",
	cls: "",
	placeholder: "",
	enableFrontmatterUI: false,
	file: undefined,

	onEnter: () => false,
	// onEscape: () => {},
	onSubmit: () => {},
	// NOTE: Blur takes precedence over Escape (this can be changed)
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
};

/**
 * A markdown editor that can be embedded in any container
 */
export class EmbeddableMarkdownEditor {
	private plugin: TaskBoard;
	options: MarkdownEditorProps;
	initial_value: string;
	scope: Scope;
	editor: MarkdownScrollableEditView;
	frontmatterRenderer: FrontmatterRenderer;
	private frontmatterUIContainer: HTMLElement | null = null;

public frontmatterContent = "";

	// Expose commonly accessed properties
	get editorEl(): HTMLElement {
		return this.editor.editorEl;
	}
	get obsidianEditor(): Editor | undefined {
		return this.editor.editor;
	}
	get containerEl(): HTMLElement {
		return this.editor.containerEl;
	}
	get activeCM(): EditorView {
		return this.editor.activeCM;
	}
	get app(): App {
		return this.editor.app;
	}
	get owner(): any {
		return this.editor.owner;
	}
	get _loaded(): boolean {
		return this.editor._loaded;
	}

	/**
	 * Construct the editor
	 * @param app - Reference to App instance
	 * @param EditorClass - The editor class constructor
	 * @param container - Container element to add the editor to
	 * @param options - Options for controlling the initial state of the editor
	 */
	constructor(
		plugin: TaskBoard,
		app: App,
		EditorClass: any,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>
	) {
		this.plugin = plugin;
		// Create the editor with the app instance
		this.editor = new EditorClass(app, container, {
			app,
			// This mocks the MarkdownView functions, required for proper scrolling
			onMarkdownScroll: () => {},
			getMode: () => "source",
		});

		this.frontmatterRenderer = new FrontmatterRenderer(plugin, this.editor);

		// Store user options
		this.options = { ...defaultProperties, ...options };
		this.initial_value = this.options.value!;
		this.scope = new Scope(app.scope);

		// Prevent Mod+Enter default behavior
		this.scope.register(["Mod"], "Enter", () => true);

		// Set up the editor relationship for commands to work
		if (this.owner) {
			this.owner.editMode = this;
			this.owner.editor = this.editor.editor;
		}

		// Set initial content
		this.set(options.value || "", false);

		// Prevent active leaf changes while focused
		this.register(
			around(app.workspace, {
				setActiveLeaf:
					(oldMethod: any) =>
					(leaf: WorkspaceLeaf, ...args: any[]) => {
						if (!this.activeCM?.hasFocus) {
							oldMethod.call(app.workspace, leaf, ...args);
						}
					},
			})
		);

		// Set up blur event handler
		if (
			this.options.onBlur !== defaultProperties.onBlur &&
			this.editor.editor?.cm?.contentDOM
		) {
			this.editor.editor.cm.contentDOM.addEventListener("blur", () => {
				app.keymap.popScope(this.scope);
				if (this._loaded) this.options.onBlur(this);
			});
		}

		// Set up focus event handler
		if (this.editor.editor?.cm?.contentDOM) {
			this.editor.editor.cm.contentDOM.addEventListener("focusin", () => {
				app.keymap.pushScope(this.scope);
				app.workspace.activeEditor = this.owner;
			});
		}

		// Apply custom class if provided
		if (options.cls && this.editorEl) {
			this.editorEl.classList.add(options.cls);
		}

		// Set cursor position if specified
		if (options.cursorLocation && this.editor.editor?.cm) {
			this.editor.editor.cm.dispatch({
				selection: EditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}

		// Override the buildLocalExtensions method to add our custom extensions
		const originalBuildLocalExtensions =
			this.editor.buildLocalExtensions.bind(this.editor);
		this.editor.buildLocalExtensions = () => {
			const extensions = originalBuildLocalExtensions();

			// Add placeholder if configured
			if (this.options.placeholder) {
				extensions.push(placeholder(this.options.placeholder));
			}

			// Add frontmatter hiding extension
			// extensions.push(this.createFrontmatterHidingExtension());

			// Add paste event handler
			extensions.push(
				EditorView.domEventHandlers({
					paste: (event) => {
						this.options.onPaste(event, this);
					},
				})
			);

			// Add keyboard handlers
			extensions.push(
				Prec.highest(
					keymap.of([
						{
							key: "Enter",
							run: () => this.options.onEnter(this, false, false),
							shift: () =>
								this.options.onEnter(this, false, true),
						},
						{
							key: "Mod-Enter",
							run: () => this.options.onEnter(this, true, false),
							shift: () => this.options.onEnter(this, true, true),
						},
						// {
						// 	key: "Escape",
						// 	run: () => {
						// 		this.options.onEscape(this);
						// 		return true;
						// 	},
						// 	preventDefault: true,
						// },
					])
				)
			);

			return extensions;
		};

		// Override onUpdate to call our onChange handler
		const originalOnUpdate = this.editor.onUpdate.bind(this.editor);
		this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
			originalOnUpdate(update, changed);
			if (changed) {
				const fullContent =
					this.frontmatterContent + this.editor.editor?.getValue();
				this.options.onChange(update, fullContent);
			}
		};
	}

	/**
	 * Creates an extension for hiding frontmatter content in the editor
	 * Frontmatter is content that starts and ends with '---' lines
	 * @returns CodeMirror extension for frontmatter hiding
	 */
	private createFrontmatterHidingExtension() {
		// Helper function to build decorations for frontmatter
		const buildDecorations = (state: any): DecorationSet => {
			const decorations: any[] = [];
			const doc = state.doc;
			const text = doc.toString();

			// Regular expression to match frontmatter blocks
			// Matches content that starts with '---' and ends with '---'
			const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*$/gm;
			let match;

			while ((match = frontmatterRegex.exec(text)) !== null) {
				const start = match.index;
				const end = match.index + match[0].length;
				console.log(
					"frontmatter match :\n",
					match,
					"\nStart : ",
					start,
					"\nEnd : ",
					end
				);

				// Create decoration to hide the frontmatter content
				decorations.push(
					Decoration.mark({
						class: "task-board-frontmatter-hidden",
						attributes: {
							style: "display: none;",
						},
					}).range(start, end)
				);
			}

			return Decoration.set(decorations);
		};

		// StateField to track frontmatter positions and generate decorations
		const frontmatterStateField = StateField.define<DecorationSet>({
			create(state) {
				return buildDecorations(state);
			},
			update(decorations, transaction) {
				if (transaction.docChanged) {
					return buildDecorations(transaction.state);
				}
				return decorations.map(transaction.changes);
			},
			provide: (field) => EditorView.decorations.from(field),
		});

		return frontmatterStateField;
	}

	// Get the current editor value
	get value(): string {
		return this.editor.editor?.cm?.state.doc.toString() || "";
	}

	// Set content in the editor
	set(content: string, focus: boolean = false): void {
		const frontmatterContent =
			this.frontmatterRenderer.extractFrontmatterContent(content);
		const contentWithoutFrontmatter =
			this.frontmatterRenderer.extractContentWithoutFrontmatter(
				content,
				frontmatterContent
			);

		console.log(
			"Setting editor content...\nComplete content :\n",
			content,
			"\nfrontmatterContent :\n",
			frontmatterContent,
			"\ncontentWithoutFrontmatter:\n",
			contentWithoutFrontmatter
		);

		this.editor.set(contentWithoutFrontmatter, focus);

		// Update frontmatter UI if enabled
		if (this.options.enableFrontmatterUI && frontmatterContent) {
			this.updateFrontmatterUI(content);
		}
	}

	/**
	 * Update the frontmatter UI based on content
	 * @param content - Markdown content to check for frontmatter
	 */
	private updateFrontmatterUI(content: string): void {
		// Import the FrontmatterRenderer dynamically to avoid circular dependencies
		// Remove existing frontmatter UI if any
		if (this.frontmatterUIContainer) {
			this.frontmatterUIContainer.remove();
			this.frontmatterUIContainer = null;
		}

		// Check if content has frontmatter
		if (!content.startsWith("---\n")) {
			return;
		}

		// Find or create a wrapper in the container
		// We'll prepend the frontmatter UI to the container
		const wrapper = this.containerEl.querySelector(
			".taskboard-frontmatter-wrapper"
		) as HTMLElement;

		if (!wrapper) {
			// Create a wrapper div for frontmatter UI at the start of container
			this.frontmatterUIContainer = this.containerEl.createDiv({
				cls: "taskboard-frontmatter-wrapper",
			});

			// Insert at the beginning of the container
			this.containerEl.insertBefore(
				this.frontmatterUIContainer,
				this.containerEl.firstChild
			);
		} else {
			this.frontmatterUIContainer = wrapper;
			this.frontmatterUIContainer.empty();
		}

		// Render the frontmatter properties
		const result = this.frontmatterRenderer.renderCollapsibleFrontmatter(
			this.frontmatterUIContainer,
			content,
			this.options.file
		);

		// If no frontmatter was rendered, remove the container
		if (!result.frontmatterContainer) {
			this.frontmatterUIContainer.remove();
			this.frontmatterUIContainer = null;
		}
	}

	// Register cleanup callback
	register(cb: any): void {
		this.editor.register(cb);
	}

	// Clean up method that ensures proper destruction
	destroy(): void {
		// Clean up frontmatter UI
		if (this.frontmatterUIContainer) {
			this.frontmatterUIContainer.remove();
			this.frontmatterUIContainer = null;
		}

		if (this._loaded && typeof this.editor.unload === "function") {
			this.editor.unload();
		}

		this.app.keymap.popScope(this.scope);
		this.app.workspace.activeEditor = null;
		this.containerEl.empty();

		this.editor.destroy();
	}

	onBlur(): void {
		if (typeof this.options.onBlur === "function") {
			this.options.onBlur(this);
		}
	}

	// Unload handler
	onunload(): void {
		if (typeof this.editor.onunload === "function") {
			this.editor.onunload();
		}
		this.destroy();
	}

	// Required method for MarkdownScrollableEditView compatibility
	unload(): void {
		if (typeof this.editor.unload === "function") {
			this.editor.unload();
		}
	}
}
