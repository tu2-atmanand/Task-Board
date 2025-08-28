import { 
    taskItem, 
    taskLocation, 
    noteItem, 
    jsonCacheData, 
    tasksJsonData,
    taskJsonMerged,
    priorityEmojis,
    priorityOptions 
} from '../../src/interfaces/TaskItem';

// Mock the translation function
jest.mock('src/utils/lang/helper', () => ({
    t: (key: string) => {
        const translations: Record<string, string> = {
            'none': 'None',
            'highest': 'Highest',
            'high': 'High', 
            'medium': 'Medium',
            'low': 'Low',
            'lowest': 'Lowest',
        };
        return translations[key] || key;
    }
}));

describe('TaskItem Interfaces', () => {
    describe('taskLocation interface', () => {
        test('should create taskLocation with all properties', () => {
            const location: taskLocation = {
                startLine: 5,
                startCharIndex: 10,
                endLine: 7,
                endCharIndex: 25
            };

            expect(location.startLine).toBe(5);
            expect(location.startCharIndex).toBe(10);
            expect(location.endLine).toBe(7);
            expect(location.endCharIndex).toBe(25);
        });

        test('should handle single line task location', () => {
            const location: taskLocation = {
                startLine: 3,
                startCharIndex: 0,
                endLine: 3,
                endCharIndex: 15
            };

            expect(location.startLine).toBe(location.endLine);
        });
    });

    describe('taskItem interface', () => {
        test('should create basic taskItem', () => {
            const task: taskItem = {
                id: 1,
                title: 'Sample task',
                body: ['Task description'],
                createdDate: '2024-01-15',
                startDate: '',
                scheduledDate: '',
                due: '',
                tags: ['work', 'urgent'],
                frontmatterTags: ['project'],
                time: '14:30',
                priority: 2,
                status: ' ',
                filePath: '/path/to/file.md',
                taskLocation: {
                    startLine: 1,
                    startCharIndex: 0,
                    endLine: 1,
                    endCharIndex: 20
                }
            };

            expect(task.id).toBe(1);
            expect(task.title).toBe('Sample task');
            expect(task.tags).toEqual(['work', 'urgent']);
            expect(task.frontmatterTags).toEqual(['project']);
            expect(task.priority).toBe(2);
            expect(task.status).toBe(' ');
            expect(task.filePath).toBe('/path/to/file.md');
        });

        test('should create taskItem with optional fields', () => {
            const task: taskItem = {
                id: 2,
                title: 'Complete task',
                body: [],
                createdDate: '2024-01-16',
                startDate: '2024-01-15',
                scheduledDate: '2024-01-17',
                due: '2024-01-20',
                tags: [],
                frontmatterTags: [],
                time: '',
                priority: 0,
                status: 'x',
                filePath: '/another/file.md',
                taskLocation: {
                    startLine: 5,
                    startCharIndex: 2,
                    endLine: 5,
                    endCharIndex: 30
                },
                reminder: '2024-01-18 09:00',
                completion: '2024-01-16 15:30',
                cancelledDate: undefined
            };

            expect(task.status).toBe('x');
            expect(task.reminder).toBe('2024-01-18 09:00');
            expect(task.completion).toBe('2024-01-16 15:30');
            expect(task.cancelledDate).toBeUndefined();
        });

        test('should handle cancelled task', () => {
            const task: taskItem = {
                id: 3,
                title: 'Cancelled task',
                body: [],
                createdDate: '2024-01-10',
                startDate: '',
                scheduledDate: '',
                due: '',
                tags: [],
                frontmatterTags: [],
                time: '',
                priority: 0,
                status: '-',
                filePath: '/cancelled.md',
                taskLocation: {
                    startLine: 1,
                    startCharIndex: 0,
                    endLine: 1,
                    endCharIndex: 15
                },
                cancelledDate: '2024-01-15'
            };

            expect(task.status).toBe('-');
            expect(task.cancelledDate).toBe('2024-01-15');
        });
    });

    describe('noteItem interface', () => {
        test('should create noteItem', () => {
            const note: noteItem = {
                filePath: '/notes/daily.md',
                frontmatter: {
                    title: 'Daily Notes',
                    tags: ['daily', 'journal']
                },
                reminder: '2024-01-16 08:00'
            };

            expect(note.filePath).toBe('/notes/daily.md');
            expect(note.frontmatter.title).toBe('Daily Notes');
            expect(note.reminder).toBe('2024-01-16 08:00');
        });
    });

    describe('jsonCacheData interface', () => {
        test('should create jsonCacheData structure', () => {
            const sampleTask: taskItem = {
                id: 1,
                title: 'Test task',
                body: [],
                createdDate: '2024-01-15',
                startDate: '',
                scheduledDate: '',
                due: '',
                tags: [],
                frontmatterTags: [],
                time: '',
                priority: 0,
                status: ' ',
                filePath: '/test.md',
                taskLocation: {
                    startLine: 1,
                    startCharIndex: 0,
                    endLine: 1,
                    endCharIndex: 10
                }
            };

            const cacheData: jsonCacheData = {
                VaultName: 'MyVault',
                Modified_at: '2024-01-16T10:00:00Z',
                Pending: {
                    '/test.md': [sampleTask]
                },
                Completed: {},
                Notes: [{
                    filePath: '/notes.md',
                    frontmatter: {},
                    reminder: ''
                }]
            };

            expect(cacheData.VaultName).toBe('MyVault');
            expect(cacheData.Pending['/test.md']).toHaveLength(1);
            expect(cacheData.Completed).toEqual({});
            expect(cacheData.Notes).toHaveLength(1);
        });
    });

    describe('tasksJsonData interface', () => {
        test('should create tasksJsonData structure', () => {
            const taskData: tasksJsonData = {
                Pending: {
                    '/file1.md': [],
                    '/file2.md': []
                },
                Completed: {
                    '/file1.md': []
                }
            };

            expect(Object.keys(taskData.Pending)).toEqual(['/file1.md', '/file2.md']);
            expect(Object.keys(taskData.Completed)).toEqual(['/file1.md']);
        });
    });

    describe('taskJsonMerged interface', () => {
        test('should create merged task structure', () => {
            const sampleTask: taskItem = {
                id: 1,
                title: 'Test',
                body: [],
                createdDate: '2024-01-15',
                startDate: '',
                scheduledDate: '',
                due: '',
                tags: [],
                frontmatterTags: [],
                time: '',
                priority: 0,
                status: ' ',
                filePath: '/test.md',
                taskLocation: {
                    startLine: 1,
                    startCharIndex: 0,
                    endLine: 1,
                    endCharIndex: 10
                }
            };

            const mergedData: taskJsonMerged = {
                Pending: [sampleTask],
                Completed: []
            };

            expect(mergedData.Pending).toHaveLength(1);
            expect(mergedData.Completed).toHaveLength(0);
        });
    });
});

describe('Priority Constants', () => {
    describe('priorityEmojis', () => {
        test('should have all priority emoji mappings', () => {
            expect(priorityEmojis[0]).toBe('0');
            expect(priorityEmojis[1]).toBe('🔺');
            expect(priorityEmojis[2]).toBe('⏫');
            expect(priorityEmojis[3]).toBe('🔼');
            expect(priorityEmojis[4]).toBe('🔽');
            expect(priorityEmojis[5]).toBe('⏬');
        });

        test('should return undefined for invalid priority', () => {
            expect(priorityEmojis[99]).toBeUndefined();
            expect(priorityEmojis[-1]).toBeUndefined();
        });
    });

    describe('priorityOptions', () => {
        test('should have all priority options', () => {
            expect(priorityOptions).toHaveLength(6);
            
            expect(priorityOptions[0].value).toBe(0);
            expect(priorityOptions[0].text).toBe('None');
            
            expect(priorityOptions[1].value).toBe(1);
            expect(priorityOptions[1].text).toBe('Highest : 🔺');
            
            expect(priorityOptions[2].value).toBe(2);
            expect(priorityOptions[2].text).toBe('High : ⏫');
            
            expect(priorityOptions[3].value).toBe(3);
            expect(priorityOptions[3].text).toBe('Medium : 🔼');
            
            expect(priorityOptions[4].value).toBe(4);
            expect(priorityOptions[4].text).toBe('Low : 🔽');
            
            expect(priorityOptions[5].value).toBe(5);
            expect(priorityOptions[5].text).toBe('Lowest : ⏬');
        });

        test('should have sequential priority values', () => {
            priorityOptions.forEach((option, index) => {
                expect(option.value).toBe(index);
            });
        });
    });
});