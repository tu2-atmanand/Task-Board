# Example: How to Use AddOrEditTask as a View

This document provides practical examples of how to use the new AddOrEditTask view functionality.

## Basic Usage Examples

### 1. Add Command to Open Task Editor in New Tab

Add this to your plugin's `onload()` method in `main.ts`:

```typescript
// Add command to open task editor in a new tab
this.addCommand({
    id: 'open-task-editor-tab',
    name: 'Open Task Editor in New Tab',
    callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }
        
        await openAddOrEditTaskView(
            this,
            async (newTask, quickAddChoice, noteContent) => {
                await addTaskInNote(this, newTask, false);
                this.realTimeScanning.processAllUpdatedFiles(newTask.filePath);
                eventEmitter.emit("REFRESH_COLUMN");
            },
            false,  // isTaskNote
            false,  // activeNote
            false,  // taskExists (creating new task)
            undefined,  // task
            activeFile.path,
            "tab"
        );
    }
});
```

### 2. Add Command to Edit Task in Popout Window

```typescript
// Add command to edit selected task in popout window
this.addCommand({
    id: 'edit-task-popout',
    name: 'Edit Task in Popout Window',
    callback: async () => {
        // Assume you have a selected task somehow
        const selectedTask = getCurrentlySelectedTask(); // Your implementation
        
        if (!selectedTask) {
            new Notice('No task selected');
            return;
        }
        
        await openAddOrEditTaskView(
            this,
            async (updatedTask, quickAddChoice, noteContent) => {
                await updateTaskInFile(this, updatedTask);
                this.realTimeScanning.processAllUpdatedFiles(updatedTask.filePath);
                eventEmitter.emit("REFRESH_COLUMN");
            },
            false,  // isTaskNote
            false,  // activeNote
            true,   // taskExists (editing existing)
            selectedTask,
            selectedTask.filePath,
            "window"
        );
    }
});
```

### 3. Add Command to Create Task Note in Split Pane

```typescript
// Add command to create task note in split pane
this.addCommand({
    id: 'create-task-note-split',
    name: 'Create Task Note in Split Pane',
    callback: async () => {
        if (!this.settings.data.globalSettings.experimentalFeatures) {
            new Notice(t("enable-experimental-features-message"), 5000);
            return;
        }
        
        await openAddOrEditTaskView(
            this,
            async (newTask, quickAddChoice, noteContent) => {
                if (noteContent) {
                    // Create the task note file
                    const parts = newTask.filePath.split("/");
                    if (parts.length > 1) {
                        const dirPath = parts.slice(0, -1).join("/");
                        if (!(await this.app.vault.adapter.exists(dirPath))) {
                            await this.app.vault.createFolder(dirPath);
                        }
                    }
                    await writeDataToVaultFile(this, newTask.filePath, noteContent);
                    this.realTimeScanning.processAllUpdatedFiles(newTask.filePath);
                    eventEmitter.emit("REFRESH_COLUMN");
                }
            },
            true,   // isTaskNote
            false,  // activeNote
            false,  // taskExists
            undefined,
            undefined,  // filePath will be generated
            "split"
        );
    }
});
```

## Integration with Existing Modal Functions

The new view functionality works alongside existing modal functionality. You can continue using modals for quick edits and use views for more complex workflows:

### Decision Logic Example

```typescript
function openTaskEditor(task: taskItem, preferView: boolean = false) {
    const saveCallback = async (updatedTask: taskItem, quickAddChoice: string, noteContent?: string) => {
        await updateTaskInFile(plugin, updatedTask);
        plugin.realTimeScanning.processAllUpdatedFiles(updatedTask.filePath);
        eventEmitter.emit("REFRESH_COLUMN");
    };
    
    if (preferView) {
        // Open as view (in tab, split, or window)
        await openAddOrEditTaskView(
            plugin,
            saveCallback,
            false,
            false,
            true,
            task,
            task.filePath,
            "tab"  // or get from settings
        );
    } else {
        // Open as modal (traditional)
        const modal = new AddOrEditTaskModal(
            plugin,
            saveCallback,
            false,
            false,
            true,
            task,
            task.filePath
        );
        modal.open();
    }
}
```

## Settings Integration Example

You could add a setting to let users choose their preferred method:

```typescript
// In GlobalSettings interface
export interface GlobalSettings {
    // ... existing settings
    taskEditorPreferredMode: "modal" | "tab" | "split" | "window";
}

// In settings tab
new Setting(containerEl)
    .setName("Task Editor Mode")
    .setDesc("Choose how to open the task editor")
    .addDropdown(dropdown => dropdown
        .addOption("modal", "Modal (Default)")
        .addOption("tab", "New Tab")
        .addOption("split", "Split Pane")
        .addOption("window", "Popout Window")
        .setValue(this.plugin.settings.data.globalSettings.taskEditorPreferredMode)
        .onChange(async (value: "modal" | "tab" | "split" | "window") => {
            this.plugin.settings.data.globalSettings.taskEditorPreferredMode = value;
            await this.plugin.saveSettings();
        })
    );
```

## Context Menu Integration

Add view options to context menus:

```typescript
// In TaskItem component or similar
const handleOpenInTab = async (event: React.MouseEvent) => {
    event.stopPropagation();
    await openAddOrEditTaskView(
        plugin,
        saveCallback,
        false,
        false,
        true,
        task,
        task.filePath,
        "tab"
    );
};

// In JSX
<ContextMenu>
    <MenuItem onClick={handleEdit}>Edit (Modal)</MenuItem>
    <MenuItem onClick={handleOpenInTab}>Edit in Tab</MenuItem>
    <MenuItem onClick={() => handleOpenInView("window")}>Edit in Window</MenuItem>
</ContextMenu>
```

## Notes

- The view will automatically close when saved or cancelled
- Multiple view instances can be open simultaneously (unlike modals)
- Views persist across workspace layout changes
- Views can be dragged to different panes like any other Obsidian view
- The same React component powers both modal and view implementations, ensuring consistent behavior
