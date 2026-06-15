// /src/services/MarkdownEditor.ts

/**
 * This complete EmbeddableMarkdownEditor component has been imported from Task Genius plugin by Boninall.
 * @see https://github.com/Quorafind/Obsidian-Task-Genius/blob/59a2d42f9fb95a5700d32975917e56372e5bdb7d/src/editor-extensions/core/markdown-editor.ts
 */

import {
	App,
	Editor,
	MarkdownFileInfo,
	MarkdownScrollableEditView,
	Scope,
	TFile,
	Workspace,
	WorkspaceLeaf,
} from "obsidian";

import { EditorSelection, Prec, Range } from "@codemirror/state";
import {
	EditorView,
	keymap,
	placeholder,
	ViewUpdate,
	Decoration,
	DecorationSet,
} from "@codemirror/view";
import { StateField } from "@codemirror/state";

import { around } from "monkey-around";
import TaskBoard from "../../main.js";
import { FrontmatterRenderer } from "./FrontmatterRenderer.js";

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
	options: Partial<MarkdownEditorProps>,
): EmbeddableMarkdownEditor {
	// Get the editor class
	const EditorClass = resolveEditorPrototype(plugin.app);

	// Create the editor instance
	return new EmbeddableMarkdownEditor(
		plugin,
		plugin.app,
		EditorClass,
		container,
		options,
	);
}

/**
 * Resolves the markdown editor prototype from the app
 */
function resolveEditorPrototype(app: App): unknown {
	// Create a temporary editor to resolve the prototype of ScrollableMarkdownEditor
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: createDiv() },
		// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- null TFile needed for API
		null as unknown as TFile,
		"",
	);

	// Mark as editable to instantiate the editor
	widgetEditorView.editable = true;
	widgetEditorView.showEditor();
	// Navigate prototype chain to resolve the ScrollableMarkdownEditor constructor
	const editMode = widgetEditorView.editMode as object;
	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(editMode),
	) as { constructor: unknown };

	// Unload to remove the temporary editor
	widgetEditorView.unload();

	// Return the constructor, bypassing the abstract class check
	return MarkdownEditor.constructor;
}

interface MarkdownEditorProps {
	cursorLocation?: { anchor: number; head: number };
	value?: string;
	cls?: string;
	placeholder?: string;
	enableFrontmatterUI?: boolean; // Enable enhanced frontmatter UI
	file?: TFile; // Optional file for context in property rendering
	singleLine?: boolean;

	onEnter: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean,
	) => boolean;
	onEscape?: (editor: EmbeddableMarkdownEditor) => void;
	onSubmit: (editor: EmbeddableMarkdownEditor) => void;
	onBlur: (editor: EmbeddableMarkdownEditor) => void;
	onPaste: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	onChange: (update: ViewUpdate) => void;
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
	get owner(): unknown {
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
		EditorClass: unknown,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>,
	) {
		this.plugin = plugin;

		// Store user options first
		this.options = { ...defaultProperties, ...options };
		this.initial_value = this.options.value!;
		this.scope = new Scope(app.scope);

		// Prevent Mod+Enter default behavior
		this.scope.register(["Mod"], "Enter", () => true);

		// Store reference to self for the patched method BEFORE using it
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- needed for monkey-patching context
		const self = this;

		// Use monkey-around to safely patch the method
		const uninstaller = around(
			(EditorClass as { prototype: object }).prototype,
			{
				buildLocalExtensions: (originalMethod: unknown) =>
					function (this: object) {
						const extensions = (
							originalMethod as (this: object) => unknown[]
						).call(this);

						// Only add our custom extensions if this is our editor instance
						if (this === self.editor) {
							// Add placeholder if configured
							if (self.options.placeholder) {
								extensions.push(
									placeholder(self.options.placeholder),
								);
							}

							// Add paste, blur, and focus event handlers
							extensions.push(
								EditorView.domEventHandlers({
									paste: (event) => {
										self.options.onPaste(event, self);
									},
									blur: () => {
										// Always trigger blur callback and let it handle the logic
										app.keymap.popScope(self.scope);
										if (self.options.onBlur) {
											self.options.onBlur(self);
										}
									},
									focusin: () => {
										app.keymap.pushScope(self.scope);
										app.workspace.activeEditor =
											self.owner as MarkdownFileInfo | null;
									},
								}),
							);

							// Add keyboard handlers
							const keyBindings = [
								{
									key: "Enter",
									run: () => {
										return self.options.onEnter(
											self,
											false,
											false,
										);
									},
									shift: () =>
										self.options.onEnter(self, false, true),
								},
								{
									key: "Mod-Enter",
									run: () =>
										self.options.onEnter(self, true, false),
									shift: () =>
										self.options.onEnter(self, true, true),
								},
								{
									key: "Escape",
									run: () => {
										self.options.onEscape?.(self);
										return true;
									},
									preventDefault: true,
								},
							];

							// For single line mode, prevent Enter key from creating new lines
							if (self.options.singleLine) {
								keyBindings[0] = {
									key: "Enter",
									run: () => {
										// In single line mode, Enter should trigger onEnter
										return self.options.onEnter(
											self,
											false,
											false,
										);
									},
									shift: () => {
										// Even with shift, still call onEnter in single line mode
										return self.options.onEnter(
											self,
											false,
											true,
										);
									},
								};
							}

							extensions.push(
								Prec.highest(keymap.of(keyBindings)),
							);
						}

						return extensions;
					},
			},
		);
		plugin.register(uninstaller);

		// Create the editor with the app instance
		this.editor = new (EditorClass as new (
			app: App,
			container: HTMLElement,
			opts: Record<string, unknown>,
		) => MarkdownScrollableEditView)(app, container, {
			app,
			// This mocks the MarkdownView functions, required for proper scrolling
			onMarkdownScroll: () => {},
			getMode: () => "source",
		});

		this.frontmatterRenderer = new FrontmatterRenderer(plugin, this.editor);

		// Prevent Mod+Enter default behavior
		this.scope.register(["Mod"], "Enter", () => true);

		// Set up the editor relationship for commands to work
		const ownerRecord = this.owner as Record<string, unknown> | undefined;
		if (ownerRecord) {
			ownerRecord.editMode = this;
			ownerRecord.editor = this.editor.editor;
		}

		// Set initial content
		this.set(options.value || "", false);

		// Prevent active leaf changes while focused
		this.register(
			around(app.workspace, {
				setActiveLeaf:
					(oldMethod: unknown) =>
					(leaf: WorkspaceLeaf, ...args: unknown[]) => {
						if (!this.activeCM?.hasFocus) {
							(
								oldMethod as (
									this: Workspace,
									leaf: WorkspaceLeaf,
									...args: unknown[]
								) => void
							).call(app.workspace, leaf, ...args);
						}
					},
			}),
		);

		// Set up blur event handler
		const contentDOM = (
			this.editor.editor as unknown as Record<string, unknown>
		)?.cm as Record<string, unknown> | undefined;
		if (
			this.options.onBlur !== defaultProperties.onBlur &&
			contentDOM?.contentDOM
		) {
			(contentDOM.contentDOM as HTMLElement).addEventListener(
				"blur",
				() => {
					app.keymap.popScope(this.scope);
					if (this._loaded) this.options.onBlur(this);
				},
			);
		}

		// Set up focus event handler
		if (contentDOM?.contentDOM) {
			(contentDOM.contentDOM as HTMLElement).addEventListener(
				"focusin",
				() => {
					app.keymap.pushScope(this.scope);
					app.workspace.activeEditor = this
						.owner as MarkdownFileInfo | null;
				},
			);
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
					options.cursorLocation.head,
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
				}),
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
					]),
				),
			);

			return extensions;
		};

		// Override onUpdate to call our onChange handler
		const originalOnUpdate = this.editor.onUpdate.bind(this.editor);
		this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
			originalOnUpdate(update, changed);
			if (changed) {
				this.options.onChange(update);
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
		const buildDecorations = (state: unknown): DecorationSet => {
			const decorations: Range<Decoration>[] = [];
			const editorState = state as { doc: { toString: () => string } };
			const doc = editorState.doc;
			const text = doc.toString();

			// Regular expression to match frontmatter blocks
			// Matches content that starts with '---' and ends with '---'
			const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*$/gm;
			let match: RegExpExecArray | null;

			while ((match = frontmatterRegex.exec(text)) !== null) {
				const start = match.index;
				const end = match.index + match[0].length;

				// Create decoration to hide the frontmatter content
				decorations.push(
					Decoration.mark({
						class: "task-board-frontmatter-hidden",
						attributes: {
							style: "display: none;",
						},
					}).range(start, end),
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
				frontmatterContent,
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
			".taskboard-frontmatter-wrapper",
		) as HTMLElement;

		if (!wrapper) {
			// Create a wrapper div for frontmatter UI at the start of container
			this.frontmatterUIContainer = this.containerEl.createDiv({
				cls: "taskboard-frontmatter-wrapper",
			});

			// Insert at the beginning of the container
			this.containerEl.insertBefore(
				this.frontmatterUIContainer,
				this.containerEl.firstChild,
			);
		} else {
			this.frontmatterUIContainer = wrapper;
			this.frontmatterUIContainer.empty();
		}

		// Render the frontmatter properties
		const result = this.frontmatterRenderer.renderCollapsibleFrontmatter(
			this.frontmatterUIContainer,
			content,
			this.options.file,
		);

		// If no frontmatter was rendered, remove the container
		if (!result.frontmatterContainer) {
			this.frontmatterUIContainer.remove();
			this.frontmatterUIContainer = null;
		}
	}

	// Register cleanup callback
	register(cb: unknown): void {
		this.editor.register(cb as () => unknown);
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
