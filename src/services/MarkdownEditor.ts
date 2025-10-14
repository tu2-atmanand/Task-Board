// /src/services/MarkdownEditor.ts

/**
 * All credits go to mgmeyers for figuring out how to grab the proper editor prototype
 * 	 and making it easily deployable
 * Changes made to the original code:
 * 	 - Refactored to JS-only syntax (original code made use of React)
 * 	 - Added blur completion
 * 	 - Added some comments on how the code functions
 * 	 - Made editor settings fully optional
 * 	 - Allow all editor commands to function on this editor
 * 	 - Added typings for the editor(s) (will be added to obsidian-typings)
 * Make sure to also check out the original source code here: https://github.com/mgmeyers/obsidian-kanban/blob/main/src/components/Editor/MarkdownEditor.tsx
 * @author Fevol
 * @url https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838
 */

/**
 * Fevol's Implementation is licensed under MIT, as is this project.
 * Changes made to the original code:
 * - Removed check for now-fixed chrome bug for onBlur()
 * - Added some typescript assertions for editor being existent (ts error if not asserted)
 * - Removed monkey patch for setActiveLeaf() as it caused a bug with a leaf's editor permanently stealing workspace.activeEditor
 * - Add `filePath` param to constructor. Without it, rendering links (and possibly other things) breaks and causes issues.
 * - Converted to an instance creator function to avoid using global app
 * - Adapted for Task-Board plugin by @tu2-atmanand
 */

import {
	App,
	Constructor,
	Editor,
	MarkdownView,
	Scope,
	TFile,
	WidgetEditorView,
	WorkspaceLeaf,
} from "obsidian";

import { MarkdownScrollableEditView } from "obsidian-typings";
import { EditorSelection, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewUpdate } from "@codemirror/view";

import { around } from "monkey-around";

/**
 * Creates an embeddable markdown editor
 * @param app The Obsidian app instance
 * @param container The container element
 * @param options Editor options
 * @param filePath The file path for the editor (required for proper link rendering)
 * @returns A configured markdown editor
 */
export function createEmbeddableMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps>,
	filePath?: string
): EmbeddableMarkdownEditor {
	// Get the editor class
	const EditorClass = resolveEditorPrototype(app);

	// Create the editor instance
	return new EmbeddableMarkdownEditor(app, EditorClass, container, options, filePath || "");
}

export type TEmbeddableMarkdownEditor = EmbeddableMarkdownEditor;

/**
 * Resolves the markdown editor prototype from the app
 */
function resolveEditorPrototype(app: App): Constructor<MarkdownScrollableEditView> {
	// Create a temporary editor to resolve the prototype of ScrollableMarkdownEditor
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement("div") },
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

	// Return the constructor
	return MarkdownEditor.constructor as Constructor<MarkdownScrollableEditView>;
}

interface MarkdownEditorProps {
	cursorLocation?: { anchor: number; head: number };
	value?: string;
	cls?: string;
	placeholder?: string;
	focus?: boolean;
	filteredExtensions?: Extension[];

	onEditorClick?: (
		event: MouseEvent,
		editor: EmbeddableMarkdownEditor,
		element?: HTMLElement
	) => void;
	onEnter: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onEscape?: (editor: EmbeddableMarkdownEditor) => void;
	onSubmit: (editor: EmbeddableMarkdownEditor) => void;
	onFocus?: (editor: EmbeddableMarkdownEditor) => void;
	onBlur: (editor: EmbeddableMarkdownEditor) => void | Promise<void>;
	onPaste: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	onChange: (update: ViewUpdate, editor: EmbeddableMarkdownEditor) => void;
}

const defaultProperties: MarkdownEditorProps = {
	cursorLocation: { anchor: 0, head: 0 },
	value: "",
	cls: "",
	placeholder: "",
	focus: true,
	filteredExtensions: [],

	onEditorClick: () => {},
	onEnter: (editor, mod, _) => {
		editor.options.onSubmit(editor);
		return mod;
	},
	onEscape: (editor) => {
		editor.options.onBlur(editor);
	},
	onSubmit: () => {},
	onFocus: () => {},
	// NOTE: Blur takes precedence over Escape (this can be changed)
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
};

/**
 * A markdown editor that can be embedded in any container
 */
export class EmbeddableMarkdownEditor {
	options: MarkdownEditorProps;
	initial_value: string;
	scope: Scope;
	editor: MarkdownScrollableEditView;

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
	 * @remark Takes 5ms to fully construct and attach
	 * @param app - Reference to App instance
	 * @param EditorClass - The editor class constructor
	 * @param container - Container element to add the editor to
	 * @param options - Options for controlling the initial state of the editor
	 * @param filePath - The file path for the editor (required for proper link rendering)
	 */
	constructor(
		app: App,
		EditorClass: any,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>,
		filePath: string
	) {
		// Create the editor with the app instance
		this.editor = new EditorClass(app, container, {
			app,
			// This mocks the MarkdownView functions, required for proper scrolling
			onMarkdownScroll: () => {},
			getMode: () => "source",
		});

		// Store user options
		this.options = { ...defaultProperties, ...options };
		this.initial_value = this.options.value!;
		this.scope = new Scope(app.scope);

		// NOTE: Since Mod+Enter is linked to the "Open link in new leaf" command, but it is also the default user action for submitting the editor,
		//      the hotkey should be disabled by either overwriting it in the scope, or applying a preventDefault in the keymap
		//      the scope is used to prevent the hotkey from executing (by returning `true`)
		this.scope.register(["Mod"], "Enter", () => {
			return true;
		});

		// Set up the editor relationship for commands to work
		// Since the commands expect that this is a MarkdownView (with editMode as the Editor itself),
		//   we need to mock this by setting both the editMode and editor to this instance and its containing view respectively
		if (this.owner) {
			// @ts-ignore (editMode is normally a MarkdownSubView)
			this.owner.editMode = this;
			this.owner.editor = this.editor.editor;

			const f = app.vault.getFileByPath(filePath);
			// @ts-ignore read-only property. This is needed because otherwise `file` is undefined and rendering links breaks.
			this.owner.file = f;
		}

		// Set initial content
		this.set(options.value || "", true);

		let containingMarkdownView: MarkdownView | null = null;
		window.setTimeout(() => {
			app.workspace.iterateAllLeaves((leaf) => {
				if (!(leaf.view instanceof MarkdownView)) return;
				if (!leaf.containerEl.contains(this.containerEl)) return;
				containingMarkdownView = leaf.view;
			});
		}, 0);

		// Execute onBlur when the editor loses focus
		if (this.editor.editor?.cm?.contentDOM) {
			this.editor.editor.cm.contentDOM.addEventListener("blur", async () => {
				if (app.workspace.activeEditor === this.owner) {
					if (containingMarkdownView) {
						// @ts-expect-error
						app.workspace._activeEditor = containingMarkdownView;
						app.workspace.activeEditor = containingMarkdownView;
					}
				}

				app.keymap.popScope(this.scope);
				await this.options.onBlur(this);
			});

			// Whenever the editor is focused, set the activeEditor to the mocked view (this.owner)
			// This allows for the editorCommands to actually work
			this.editor.editor.cm.contentDOM.addEventListener("focusin", async () => {
				app.keymap.pushScope(this.scope);

				if (this.options.onFocus && this.options.onFocus !== defaultProperties.onFocus) {
					this.options.onFocus(this);
				}
			});
		}

		// Remove default markdown class
		this.editorEl.classList.remove("markdown-source-view");

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
						{
							key: "Escape",
							run: () => {
								if (this.options.onEscape) {
									this.options.onEscape(this);
								}
								return true;
							},
							preventDefault: true,
						},
					])
				)
			);

			return extensions;
		};

		// Override getDynamicExtensions to support filtered extensions
		const originalGetDynamicExtensions = this.editor.getDynamicExtensions?.bind(this.editor);
		if (originalGetDynamicExtensions) {
			this.editor.getDynamicExtensions = () => {
				return originalGetDynamicExtensions()
					.filter((ext: Extension) => !this.options.filteredExtensions?.includes(ext));
			};
		}

		// Override onUpdate to call our onChange handler
		const originalOnUpdate = this.editor.onUpdate.bind(this.editor);
		this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
			originalOnUpdate(update, changed);
			if (changed) {
				this.options.onChange(update, this);
			}
		};

		// Override onEditorClick to call custom handler
		if (this.options.onEditorClick) {
			const originalOnEditorClick = this.editor.onEditorClick?.bind(this.editor);
			if (originalOnEditorClick) {
				this.editor.onEditorClick = (event: MouseEvent, element?: HTMLElement) => {
					originalOnEditorClick(event, element);
					this.options.onEditorClick!(event, this, element);
				};
			}
		}

		// Override onload to handle focus
		const originalOnload = this.editor.onload?.bind(this.editor);
		if (originalOnload) {
			this.editor.onload = () => {
				originalOnload();
				if (this.options.focus) {
					this.editor.editor?.focus();
				}
			};
		}
	}

	// Get the current editor value
	get value(): string {
		return this.editor.editor?.cm?.state.doc.toString() || "";
	}

	// Set content in the editor
	set(content: string, focus: boolean = false): void {
		this.editor.set(content, focus);
	}

	// Register cleanup callback
	register(cb: any): void {
		this.editor.register(cb);
	}

	// Clean up method that ensures proper destruction
	destroy(): void {
		if (this._loaded && typeof this.editor.unload === "function") {
			this.editor.unload();
		}

		this.app.keymap.popScope(this.scope);
		if (this.app.workspace.activeEditor === this.owner) {
			this.app.workspace.activeEditor = null;
		}
		this.containerEl.empty();

		this.editor.destroy();
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
