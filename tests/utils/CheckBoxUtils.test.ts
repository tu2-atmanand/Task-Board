import { 
    checkboxStateSwitcher, 
    isCompleted, 
    isTaskLine, 
    extractCheckboxSymbol,
    getObsidianIndentationSetting 
} from '../../src/utils/CheckBoxUtils';

// Mock the taskStatuses import to avoid dependency issues
jest.mock('src/interfaces/TaskItem', () => ({
    taskStatuses: {
        regular: 'x',
        checked: 'X', 
        dropped: '-',
        unchecked: ' '
    }
}));

// Mock main module
jest.mock('main', () => {
    return {};
});

describe('CheckBoxUtils', () => {
    describe('checkboxStateSwitcher', () => {
        test('should switch from unchecked to checked by default', () => {
            const mockPlugin = {
                settings: {
                    data: {
                        globalSettings: {
                            tasksPluginCustomStatuses: [],
                            customStatuses: []
                        }
                    }
                }
            };

            expect(checkboxStateSwitcher(mockPlugin, ' ')).toBe('x');
        });

        test('should switch from checked to unchecked by default', () => {
            const mockPlugin = {
                settings: {
                    data: {
                        globalSettings: {
                            tasksPluginCustomStatuses: [],
                            customStatuses: []
                        }
                    }
                }
            };

            expect(checkboxStateSwitcher(mockPlugin, 'x')).toBe(' ');
            expect(checkboxStateSwitcher(mockPlugin, 'X')).toBe(' ');
        });

        test('should use tasksPluginCustomStatuses when available', () => {
            const mockPlugin = {
                settings: {
                    data: {
                        globalSettings: {
                            tasksPluginCustomStatuses: [
                                { symbol: ' ', nextStatusSymbol: '/' },
                                { symbol: '/', nextStatusSymbol: 'x' },
                                { symbol: 'x', nextStatusSymbol: ' ' }
                            ],
                            customStatuses: []
                        }
                    }
                }
            };

            expect(checkboxStateSwitcher(mockPlugin, ' ')).toBe('/');
            expect(checkboxStateSwitcher(mockPlugin, '/')).toBe('x');
            expect(checkboxStateSwitcher(mockPlugin, 'x')).toBe(' ');
        });

        test('should use customStatuses when tasksPluginCustomStatuses not available', () => {
            const mockPlugin = {
                settings: {
                    data: {
                        globalSettings: {
                            tasksPluginCustomStatuses: [],
                            customStatuses: [
                                { symbol: ' ', nextStatusSymbol: '!' },
                                { symbol: '!', nextStatusSymbol: 'x' },
                                { symbol: 'x', nextStatusSymbol: ' ' }
                            ]
                        }
                    }
                }
            };

            expect(checkboxStateSwitcher(mockPlugin, ' ')).toBe('!');
            expect(checkboxStateSwitcher(mockPlugin, '!')).toBe('x');
            expect(checkboxStateSwitcher(mockPlugin, 'x')).toBe(' ');
        });

        test('should fallback to default behavior for unknown symbols', () => {
            const mockPlugin = {
                settings: {
                    data: {
                        globalSettings: {
                            tasksPluginCustomStatuses: [],
                            customStatuses: []
                        }
                    }
                }
            };

            expect(checkboxStateSwitcher(mockPlugin, '?')).toBe('x');
            expect(checkboxStateSwitcher(mockPlugin, '/')).toBe('x');
        });
    });

    describe('isCompleted', () => {
        test('should return true for regular completed status', () => {
            expect(isCompleted('- [x] Completed task')).toBe(true);
        });

        test('should return true for checked completed status', () => {
            expect(isCompleted('- [X] Completed task')).toBe(true);
        });

        test('should return true for dropped status', () => {
            expect(isCompleted('- [-] Dropped task')).toBe(true);
        });

        test('should return false for unchecked status', () => {
            expect(isCompleted('- [ ] Unchecked task')).toBe(false);
        });

        test('should return false for in-progress status', () => {
            expect(isCompleted('- [/] In progress task')).toBe(false);
        });

        test('should return false for invalid task format', () => {
            expect(isCompleted('Not a task')).toBe(false);
            expect(isCompleted('- [ Malformed task')).toBe(false);
            expect(isCompleted('')).toBe(false);
        });

        test('should return false for tasks without checkbox', () => {
            expect(isCompleted('- Regular list item')).toBe(false);
        });
    });

    describe('isTaskLine', () => {
        test('should return true for valid task lines', () => {
            expect(isTaskLine('- [ ] Valid task')).toBe(true);
            expect(isTaskLine('- [x] Completed task')).toBe(true);
            expect(isTaskLine('- [/] In progress task')).toBe(true);
            expect(isTaskLine('- [!] Important task')).toBe(true);
        });

        test('should return false for invalid task lines', () => {
            expect(isTaskLine('- Regular list item')).toBe(false);
            expect(isTaskLine('- [ ]')).toBe(false); // No content after checkbox
            expect(isTaskLine('- [ ] ')).toBe(false); // Only whitespace after checkbox
            expect(isTaskLine('* [x] Wrong list marker')).toBe(false);
        });

        test('should return false for malformed tasks', () => {
            expect(isTaskLine('- [x Incomplete checkbox')).toBe(false);
            expect(isTaskLine('- [] Empty checkbox')).toBe(false);
            expect(isTaskLine('[x] Missing list marker')).toBe(false);
            expect(isTaskLine('')).toBe(false);
        });

        test('should handle tasks with extra spaces', () => {
            expect(isTaskLine('- [x]  Task with extra spaces')).toBe(true);
        });
    });

    describe('extractCheckboxSymbol', () => {
        test('should extract correct symbols', () => {
            expect(extractCheckboxSymbol('- [ ] Unchecked task')).toBe(' ');
            expect(extractCheckboxSymbol('- [x] Checked task')).toBe('x');
            expect(extractCheckboxSymbol('- [X] Uppercase checked')).toBe('X');
            expect(extractCheckboxSymbol('- [/] In progress')).toBe('/');
            expect(extractCheckboxSymbol('- [!] Important')).toBe('!');
            expect(extractCheckboxSymbol('- [-] Dropped')).toBe('-');
        });

        test('should return space for malformed tasks', () => {
            expect(extractCheckboxSymbol('- [ Malformed')).toBe(' ');
            expect(extractCheckboxSymbol('Not a task')).toBe(' ');
            expect(extractCheckboxSymbol('')).toBe(' ');
            expect(extractCheckboxSymbol('- [] Empty checkbox')).toBe(' ');
        });

        test('should handle tasks with extra spaces', () => {
            expect(extractCheckboxSymbol('- [x]  Task with spaces')).toBe('x');
        });
    });

    describe('getObsidianIndentationSetting', () => {
        test('should return tab when useTab is true', () => {
            const mockPlugin = {
                app: {
                    vault: {
                        config: {
                            useTab: true,
                            tabSize: 4
                        }
                    }
                }
            };

            expect(getObsidianIndentationSetting(mockPlugin as any)).toBe('\t');
        });

        test('should return spaces when useTab is false', () => {
            const mockPlugin = {
                app: {
                    vault: {
                        config: {
                            useTab: false,
                            tabSize: 4
                        }
                    }
                }
            };

            expect(getObsidianIndentationSetting(mockPlugin as any)).toBe('    ');
        });

        test('should handle custom tab sizes', () => {
            const mockPlugin = {
                app: {
                    vault: {
                        config: {
                            useTab: false,
                            tabSize: 2
                        }
                    }
                }
            };

            expect(getObsidianIndentationSetting(mockPlugin as any)).toBe('  ');
        });

        test('should default to 4 spaces when tabSize not set', () => {
            const mockPlugin = {
                app: {
                    vault: {
                        config: {
                            useTab: false
                        }
                    }
                }
            };

            expect(getObsidianIndentationSetting(mockPlugin as any)).toBe('    ');
        });

        test('should default to tab when config not available', () => {
            const mockPlugin = {
                app: {
                    vault: {}
                }
            };

            expect(getObsidianIndentationSetting(mockPlugin as any)).toBe('\t');
        });
    });
});