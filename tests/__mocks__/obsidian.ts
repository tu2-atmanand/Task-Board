// Mock Obsidian module for testing
export const Notice = jest.fn();

export class Modal {
    app: any;
    
    constructor(app: any) {
        this.app = app;
    }
    
    open() {}
    close() {}
}

export class Plugin {
    app: any;
    manifest: any;
    
    constructor(app: any, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    
    onload() {}
    onunload() {}
    addCommand() {}
    registerView() {}
    addSettingTab() {}
}

export class TFile {
    path: string;
    name: string;
    extension: string;
    
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        this.extension = this.name.split('.').pop() || '';
    }
}

export class App {
    vault: any;
    workspace: any;
    
    constructor() {
        this.vault = {
            adapter: {
                exists: jest.fn().mockResolvedValue(true),
                read: jest.fn().mockResolvedValue(''),
                write: jest.fn().mockResolvedValue(undefined),
            },
            getFiles: jest.fn().mockReturnValue([]),
            getMarkdownFiles: jest.fn().mockReturnValue([]),
        };
        
        this.workspace = {
            getActiveFile: jest.fn().mockReturnValue(null),
            activeEditor: null,
        };
    }
}