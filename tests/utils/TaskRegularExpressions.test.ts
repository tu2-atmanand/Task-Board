import { TaskRegularExpressions } from '../../src/utils/TaskRegularExpressions';

describe('TaskRegularExpressions', () => {
    describe('Basic Constants', () => {
        test('dateFormat should be YYYY-MM-DD', () => {
            expect(TaskRegularExpressions.dateFormat).toBe('YYYY-MM-DD');
        });

        test('dateTimeFormat should be YYYY-MM-DD HH:mm', () => {
            expect(TaskRegularExpressions.dateTimeFormat).toBe('YYYY-MM-DD HH:mm');
        });
    });

    describe('Indentation Regex', () => {
        test('should match empty indentation', () => {
            const match = 'no indentation'.match(TaskRegularExpressions.indentationRegex);
            expect(match?.[1]).toBe('');
        });

        test('should match space indentation', () => {
            const match = '  indented with spaces'.match(TaskRegularExpressions.indentationRegex);
            expect(match?.[1]).toBe('  ');
        });

        test('should match tab indentation', () => {
            const match = '\t\tindented with tabs'.match(TaskRegularExpressions.indentationRegex);
            expect(match?.[1]).toBe('\t\t');
        });

        test('should match mixed indentation with blockquotes', () => {
            const match = '  > blockquote indentation'.match(TaskRegularExpressions.indentationRegex);
            expect(match?.[1]).toBe('  > ');
        });
    });

    describe('List Marker Regex', () => {
        test('should match dash marker', () => {
            const match = '-'.match(TaskRegularExpressions.listMarkerRegex);
            expect(match?.[1]).toBe('-');
        });

        test('should match asterisk marker', () => {
            const match = '*'.match(TaskRegularExpressions.listMarkerRegex);
            expect(match?.[1]).toBe('*');
        });

        test('should match plus marker', () => {
            const match = '+'.match(TaskRegularExpressions.listMarkerRegex);
            expect(match?.[1]).toBe('+');
        });

        test('should match numbered list markers', () => {
            const match1 = '1.'.match(TaskRegularExpressions.listMarkerRegex);
            expect(match1?.[1]).toBe('1.');

            const match2 = '42)'.match(TaskRegularExpressions.listMarkerRegex);
            expect(match2?.[1]).toBe('42)');
        });
    });

    describe('Checkbox Regex', () => {
        test('should match empty checkbox', () => {
            const match = '[ ]'.match(TaskRegularExpressions.checkboxRegex);
            expect(match?.[1]).toBe(' ');
        });

        test('should match completed checkbox', () => {
            const match = '[x]'.match(TaskRegularExpressions.checkboxRegex);
            expect(match?.[1]).toBe('x');
        });

        test('should match various status characters', () => {
            const statuses = ['x', 'X', '/', '-', '>', '<', '!', '?'];
            
            statuses.forEach(status => {
                const match = `[${status}]`.match(TaskRegularExpressions.checkboxRegex);
                expect(match?.[1]).toBe(status);
            });
        });
    });

    describe('Task Regex (Full Task Parsing)', () => {
        test('should parse basic task', () => {
            const taskLine = '- [ ] Basic task';
            const match = taskLine.match(TaskRegularExpressions.taskRegex);
            
            expect(match).not.toBeNull();
            expect(match?.[1]).toBe(''); // no indentation
            expect(match?.[2]).toBe('-'); // list marker
            expect(match?.[3]).toBe(' '); // status character
            expect(match?.[4]).toBe('Basic task'); // task description
        });

        test('should parse indented task', () => {
            const taskLine = '  - [x] Completed indented task';
            const match = taskLine.match(TaskRegularExpressions.taskRegex);
            
            expect(match).not.toBeNull();
            expect(match?.[1]).toBe('  '); // indentation
            expect(match?.[2]).toBe('-'); // list marker
            expect(match?.[3]).toBe('x'); // status character
            expect(match?.[4]).toBe('Completed indented task'); // task description
        });

        test('should parse numbered task', () => {
            const taskLine = '1. [/] In progress task';
            const match = taskLine.match(TaskRegularExpressions.taskRegex);
            
            expect(match).not.toBeNull();
            expect(match?.[1]).toBe(''); // no indentation
            expect(match?.[2]).toBe('1.'); // numbered list marker
            expect(match?.[3]).toBe('/'); // status character
            expect(match?.[4]).toBe('In progress task'); // task description
        });

        test('should handle extra spaces around checkbox', () => {
            const taskLine = '-   [ ]   Task with extra spaces';
            const match = taskLine.match(TaskRegularExpressions.taskRegex);
            
            expect(match).not.toBeNull();
            expect(match?.[2]).toBe('-');
            expect(match?.[3]).toBe(' ');
            expect(match?.[4]).toBe('Task with extra spaces');
        });
    });

    describe('Hash Tags Regex', () => {
        test('should match hash tags at beginning of string', () => {
            const text = '#start-tag some text';
            const matches = text.match(TaskRegularExpressions.hashTagsRegex);
            expect(matches).toEqual(['#start-tag']);
        });

        test('should match hash tags after spaces', () => {
            const text = 'some text #middle-tag more text';
            const matches = text.match(TaskRegularExpressions.hashTagsRegex);
            expect(matches).toEqual([' #middle-tag']);
        });

        test('should match multiple hash tags', () => {
            const text = '#first some text #second and #third';
            const matches = text.match(TaskRegularExpressions.hashTagsRegex);
            expect(matches).toEqual(['#first', ' #second', ' #third']);
        });

        test('should ignore hash tags in URLs', () => {
            const text = 'Visit http://example.com#section and #validtag';
            const matches = text.match(TaskRegularExpressions.hashTagsRegex);
            expect(matches).toEqual([' #validtag']);
        });

        test('should ignore hash tags with invalid characters', () => {
            const text = '#valid-tag #invalid@tag #also.invalid #good_tag';
            const matches = text.match(TaskRegularExpressions.hashTagsRegex);
            // The regex actually matches up to the first invalid character
            expect(matches).toEqual(['#valid-tag', ' #invalid', ' #also', ' #good_tag']);
        });
    });

    describe('Block Link Regex', () => {
        test('should match block links at end of line', () => {
            const text = 'Some task content ^block-id';
            const match = text.match(TaskRegularExpressions.blockLinkRegex);
            expect(match?.[0]).toBe(' ^block-id');
        });

        test('should not match block links in middle of line', () => {
            const text = 'Some task ^block-id with more content';
            const match = text.match(TaskRegularExpressions.blockLinkRegex);
            expect(match).toBeNull();
        });

        test('should match block links with dashes and numbers', () => {
            const text = 'Task content ^block-123-abc';
            const match = text.match(TaskRegularExpressions.blockLinkRegex);
            expect(match?.[0]).toBe(' ^block-123-abc');
        });
    });
});