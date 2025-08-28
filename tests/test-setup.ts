import '@testing-library/jest-dom';

// Mock Obsidian APIs that are commonly used in the plugin
global.window = Object.create(window);

// Mock Obsidian plugin APIs
const mockObsidian = {
    Plugin: class MockPlugin {
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
    },
    
    TFile: class MockTFile {
        path: string;
        name: string;
        extension: string;
        
        constructor(path: string) {
            this.path = path;
            this.name = path.split('/').pop() || '';
            this.extension = this.name.split('.').pop() || '';
        }
    },
    
    Notice: jest.fn(),
    
    // Mock app structure
    App: class MockApp {
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
};

// Make Obsidian mocks available globally
(global as any).obsidian = mockObsidian;

// Mock moment for date handling that's commonly used
jest.mock('moment', () => {
    const moment = jest.requireActual('moment');
    return moment;
});

// Set up global test environment
beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset console.error/warn to avoid noise in test output
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterEach(() => {
    // Clean up after each test
    jest.resetAllMocks();
});