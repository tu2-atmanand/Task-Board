/**
 * MetadataEditor patching utilities
 * Inspired by obsidian-better-properties
 * @see https://github.com/unxok/obsidian-better-properties/blob/main/src/MetadataEditor/patchMetadataEditor/index.ts
 */

import { around, dedupe } from "monkey-around";
import { App, MarkdownView } from "obsidian";
import { MetadataEditor } from "obsidian-typings";
import TaskBoard from "main";

/**
 * Extended MetadataEditor interface with patch capabilities
 */
export interface PatchedMetadataEditor extends MetadataEditor {
	// Add custom properties here if needed in the future
	// For now, we keep it minimal as per the requirement
}

/**
 * Resolves the MetadataEditor prototype from the app
 * @param plugin - The TaskBoard plugin instance
 * @returns The MetadataEditor prototype
 * @throws Error if called before workspace.layoutReady is true
 */
export function resolveMetadataEditorPrototype(plugin: TaskBoard): MetadataEditor {
	if (!plugin.app.workspace.layoutReady) {
		throw new Error(
			"resolveMetadataEditorPrototype can only be used when the app.workspace.layoutReady is true"
		);
	}

	const { workspace, viewRegistry } = plugin.app;
	
	// Create a temporary markdown view to extract the MetadataEditor prototype
	const leaf = workspace.getLeaf("tab");
	const view = viewRegistry.viewByType["markdown"](leaf) as MarkdownView;
	
	const metadataEditorPrototype = Object.getPrototypeOf(
		view.metadataEditor
	) as MetadataEditor;
	
	// Clean up the temporary leaf
	leaf.detach();
	
	return metadataEditorPrototype;
}

/**
 * Patches the MetadataEditor with custom functionality
 * @param plugin - The TaskBoard plugin instance
 * @returns A function to remove the patch
 */
export function patchMetadataEditor(plugin: TaskBoard): () => void {
	const mdePrototype = resolveMetadataEditorPrototype(plugin) as PatchedMetadataEditor;

	// Patch the load method to add custom initialization
	const removePatch = around(mdePrototype, {
		load(old) {
			return dedupe("task-board-metadata-editor", old, function (this: PatchedMetadataEditor) {
				// Call the original load method
				old.call(this);
				
				// Add any custom initialization here
				// For now, we keep it minimal
			});
		},
		synchronize(old) {
			return dedupe("task-board-metadata-editor", old, function (this: PatchedMetadataEditor, data) {
				// Call the original synchronize method
				old.call(this, data);
				
				// Add any custom synchronization logic here
				// For now, we keep it minimal
			});
		},
	});

	// Register the patch removal with the plugin
	plugin.register(removePatch);
	
	return removePatch;
}

/**
 * Type export for convenience
 */
export type { MetadataEditor } from "obsidian-typings";
