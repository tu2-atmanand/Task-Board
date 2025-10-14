/**
 * Example: Optional MetadataEditor Integration
 * 
 * This file demonstrates how to integrate the MetadataEditor patch into the main plugin.
 * The patch is OPTIONAL and can be enabled/disabled based on user preferences.
 * 
 * To enable this feature:
 * 1. Import the patchMetadataEditor function in main.ts
 * 2. Call it in the onLayoutReady callback
 * 3. Optionally add a setting to enable/disable it
 */

// Example 1: Basic Integration (main.ts)
// ========================================

/*
import { patchMetadataEditor } from "src/services/MetadataEditor";

export default class TaskBoard extends Plugin {
    async onload() {
        // ... existing code ...

        this.app.workspace.onLayoutReady(() => {
            // ... existing onLayoutReady code ...

            // Apply MetadataEditor patch (optional)
            try {
                patchMetadataEditor(this);
                console.log("TaskBoard: MetadataEditor patch applied successfully");
            } catch (error) {
                console.error("TaskBoard: Failed to apply MetadataEditor patch:", error);
            }
        });
    }
}
*/

// Example 2: Integration with Settings Toggle
// ===========================================

/*
// In GlobalSettings.ts, add:
export interface PluginDataJson {
    // ... existing settings ...
    enableMetadataEditorPatch?: boolean;
}

export const DEFAULT_SETTINGS: PluginDataJson = {
    // ... existing defaults ...
    enableMetadataEditorPatch: false, // Disabled by default
};

// In main.ts:
import { patchMetadataEditor } from "src/services/MetadataEditor";

export default class TaskBoard extends Plugin {
    async onload() {
        // ... existing code ...

        this.app.workspace.onLayoutReady(() => {
            // ... existing onLayoutReady code ...

            // Apply MetadataEditor patch if enabled
            if (this.settings.enableMetadataEditorPatch) {
                try {
                    patchMetadataEditor(this);
                    console.log("TaskBoard: MetadataEditor patch applied successfully");
                } catch (error) {
                    console.error("TaskBoard: Failed to apply MetadataEditor patch:", error);
                }
            }
        });
    }
}

// In TaskBoardSettingTab.ts, add:
new Setting(containerEl)
    .setName("Enable MetadataEditor Patch")
    .setDesc("Enables advanced MetadataEditor functionality (experimental)")
    .addToggle((toggle) =>
        toggle
            .setValue(this.plugin.settings.enableMetadataEditorPatch || false)
            .onChange(async (value) => {
                this.plugin.settings.enableMetadataEditorPatch = value;
                await this.plugin.saveSettings();
                new Notice(
                    "Please reload Obsidian for the MetadataEditor patch to take effect"
                );
            })
    );
*/

// Example 3: Direct Usage in Components
// ====================================

/*
import { resolveMetadataEditorPrototype } from "src/services/MetadataEditor";

// In a React component or service:
function MyComponent({ plugin }: { plugin: TaskBoard }) {
    useEffect(() => {
        if (plugin.app.workspace.layoutReady) {
            try {
                const metadataEditor = resolveMetadataEditorPrototype(plugin);
                // Use metadataEditor prototype for custom functionality
                console.log("MetadataEditor prototype:", metadataEditor);
            } catch (error) {
                console.error("Failed to resolve MetadataEditor:", error);
            }
        }
    }, [plugin]);

    return <div>...</div>;
}
*/

// Notes:
// ======
// 1. The patch is automatically registered with the plugin's lifecycle
// 2. The patch is removed when the plugin is unloaded
// 3. The implementation is minimal by design - extend as needed
// 4. Always wrap in try-catch to handle potential errors gracefully
// 5. Consider adding a reload notice when toggling the patch setting
