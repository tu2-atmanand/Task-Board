// /src/components/MarkdownEditor.tsx

import { EditorView, basicSetup } from 'codemirror';
import React, { useEffect, useRef, useState } from 'react';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

class MarkdownEditor {
	private editorView: EditorView | null = null;
	private onChangeCallback: (value: string) => void;

	constructor(onChangeCallback: (value: string) => void) {
		this.onChangeCallback = onChangeCallback;
	}

	initializeEditor(editorContainer: HTMLDivElement, initialValue: string) {
		if (this.editorView) {
			this.editorView.destroy();
		}

		this.editorView = new EditorView({
			doc: initialValue,
			extensions: [
				basicSetup,
				markdown({ base: markdownLanguage }),
				oneDark,
				keymap.of([indentWithTab]), // Correctly wrap keybindings with `keymap.of()`
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const currentValue = this.editorView?.state.doc.toString() || '';
						this.onChangeCallback(currentValue);
					}
				}),
			],
			parent: editorContainer,
		});
	}

	destroyEditor() {
		if (this.editorView) {
			this.editorView.destroy();
			this.editorView = null;
		}
	}

	getEditorValue(): string {
		return this.editorView?.state.doc.toString() || '';
	}

	static extractIndentedLines(content: string): string[] {
		return content
			.split('\n')
			.filter((line) => /^\s+[^- \[]/.test(line)); // lines with indentation not starting with `- [ ]`
	}
}

export default function CodeMirrorEditor({ initialContent, onChange }: { initialContent: string, onChange: (bodyContent: string[]) => void }) {
	const editorRef = useRef<HTMLDivElement>(null);
	const [editorInstance, setEditorInstance] = useState<MarkdownEditor | null>(null);

	useEffect(() => {
		if (editorRef.current) {
			const editor = new MarkdownEditor((value: string) => {
				const indentedLines = MarkdownEditor.extractIndentedLines(value);
				onChange(indentedLines);
			});
			editor.initializeEditor(editorRef.current, initialContent);
			setEditorInstance(editor);

			return () => {
				editor.destroyEditor();
			};
		}
	}, [initialContent, onChange]);

	return <div ref={editorRef} className="markdown-editor"></div>;
}
