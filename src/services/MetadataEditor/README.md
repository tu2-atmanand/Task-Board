# MetadataEditor Integration

## Overview

The `MetadataEditor` module provides utilities for accessing and patching Obsidian's MetadataEditor component. This is based on patterns from the [obsidian-better-properties](https://github.com/unxok/obsidian-better-properties) project.

## Usage

### Basic Setup

To use the MetadataEditor patch in your plugin:

```typescript
import { patchMetadataEditor } from "src/services/MetadataEditor";
import TaskBoard from "main";

export default class TaskBoard extends Plugin {
    async onload() {
        // Wait for workspace to be ready
        this.app.workspace.onLayoutReady(() => {
            // Apply the patch
            patchMetadataEditor(this);
        });
    }
}
```

### Accessing MetadataEditor Prototype

If you need direct access to the MetadataEditor prototype:

```typescript
import { resolveMetadataEditorPrototype } from "src/services/MetadataEditor";

// Must be called after workspace.layoutReady is true
const metadataEditorPrototype = resolveMetadataEditorPrototype(plugin);
```

## API Reference

### `patchMetadataEditor(plugin: TaskBoard)`

Patches the MetadataEditor with custom functionality.

**Parameters:**
- `plugin` - The TaskBoard plugin instance

**Returns:**
- A function to remove the patch

**Example:**
```typescript
const removePatch = patchMetadataEditor(plugin);
// Later, to remove the patch:
removePatch();
```

### `resolveMetadataEditorPrototype(plugin: TaskBoard)`

Resolves the MetadataEditor prototype from the app.

**Parameters:**
- `plugin` - The TaskBoard plugin instance

**Returns:**
- The MetadataEditor prototype

**Throws:**
- Error if called before `workspace.layoutReady` is true

### `PatchedMetadataEditor`

Extended MetadataEditor interface with patch capabilities.

```typescript
interface PatchedMetadataEditor extends MetadataEditor {
    // Custom properties can be added here
}
```

## Implementation Details

The patch uses `monkey-around` to safely extend the MetadataEditor's behavior:

1. **load()** - Called when the editor is loaded
2. **synchronize()** - Called when properties are synchronized

These methods are patched with `dedupe` to ensure they're only patched once, even if multiple plugins try to patch them.

## Notes

- The patch is automatically registered with the plugin's lifecycle
- The patch is removed when the plugin is unloaded
- The implementation is minimal by design, focusing on providing a foundation for future enhancements

## Related

- [obsidian-typings](https://github.com/Fevol/obsidian-typings) - Provides MetadataEditor types
- [obsidian-better-properties](https://github.com/unxok/obsidian-better-properties) - Reference implementation
