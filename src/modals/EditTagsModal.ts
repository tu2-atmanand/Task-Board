import { Modal } from 'obsidian';
import TaskBoard from 'main';

export default class EditTagsModal extends Modal {
    plugin: TaskBoard;
    initialTags: string[];
    onSave: (tags: string[]) => void;

    private tagsContainer: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;

    constructor(plugin: TaskBoard, initialTags: string[], onSave: (tags: string[]) => void) {
        super(plugin.app);
        this.plugin = plugin;
        this.initialTags = initialTags || [];
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('task-board-edit-tags-modal');

        const title = contentEl.createEl('h3', { text: 'Edit tags' });
        this.tagsContainer = contentEl.createDiv({ cls: 'tags-container' });

        const inputWrap = contentEl.createDiv({ cls: 'tag-input-wrap' });
        this.inputEl = inputWrap.createEl('input', { type: 'text' }) as HTMLInputElement;
        this.inputEl.placeholder = 'Type to add tag and press Enter (use #prefix optional)';

        const info = contentEl.createEl('div', { text: 'Existing tags:' });

        // Render initial tags as capsules
        this.initialTags.forEach(t => this.addTagPill(t));

        // MultiSuggest for tag suggestions (best-effort)
        try {
            // @ts-ignore - MultiSuggest is available globally in project
            const suggestionContent = this.plugin.settings.data.globalSettings.tagColors?.map(tc => tc.name) || [];
            // @ts-ignore
            new (window as any).MultiSuggest(this.inputEl, new Set(suggestionContent), (choice: string) => {
                this.handleAddTag(choice);
            }, this.plugin.app);
        } catch (error) {
            // ignore if MultiSuggest not available in this scope
        }

        this.inputEl.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                const v = this.inputEl!.value.trim();
                if (v) this.handleAddTag(v);
                this.inputEl!.value = '';
            }
        });

        const footer = contentEl.createDiv({ cls: 'modal-footer' });
        const saveBtn = footer.createEl('button', { text: 'Save' });
        saveBtn.addEventListener('click', () => {
            const tags = Array.from(this.tagsContainer!.querySelectorAll('.tag-pill')).map((el: any) => el.getAttribute('data-tag'));
            this.onSave(tags);
            this.close();
        });

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    addTagPill(tag: string) {
        if (!this.tagsContainer) return;
        const normalized = tag.startsWith('#') ? tag : `#${tag}`;
        // avoid duplicates
        const exists = Array.from(this.tagsContainer.querySelectorAll('.tag-pill')).some((el: any) => el.getAttribute('data-tag') === normalized);
        if (exists) return;
        const pill = this.tagsContainer.createDiv({ cls: 'tag-pill' });
        pill.setAttr('data-tag', normalized);
        pill.createSpan({ text: normalized });
        const removeBtn = pill.createEl('button', { text: '✕' });
        removeBtn.addEventListener('click', () => pill.remove());
    }

    handleAddTag(tag: string) {
        if (!this.tagsContainer) return;
        const t = tag.trim();
        if (!t) return;
        this.addTagPill(t);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
