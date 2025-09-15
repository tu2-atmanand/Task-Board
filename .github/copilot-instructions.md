# Task Board - Obsidian Plugin Development Guide

Task Board is an Obsidian plugin written in TypeScript and React that provides a Kanban-style board for managing tasks throughout your vault. The plugin scans markdown files for tasks and displays them in an organized, interactive board interface.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Environment Setup
- **CRITICAL**: This is an Obsidian plugin that cannot run standalone - it requires Obsidian to be fully functional.
- Use Node.js v18+ and npm v8+ (tested with Node.js v20.19.4 and npm v10.8.2).
- **NEVER CANCEL**: Install dependencies with `npm install` -- takes approximately 25-45 seconds depending on network speed. NEVER CANCEL. Set timeout to 60+ minutes.

### Build and Development
- **Bootstrap the repository:**
  ```bash
  npm install  # 23-45 seconds depending on network. NEVER CANCEL. Set timeout to 60+ minutes.
  npm run build  # 5 seconds. Very fast build process.
  ```
- **Development workflow:**
  ```bash
  npm run dev  # Starts watch mode with esbuild - RUNS CONTINUOUSLY until stopped
  ```
- **NEVER CANCEL**: The `npm run build` command takes approximately 5 seconds and runs `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`. NEVER CANCEL builds even though they're quick.
- **TypeScript validation**: `npx tsc --noEmit --skipLibCheck` takes approximately 5 seconds.
- **Build process**: TypeScript compilation check followed by esbuild bundling to produce `main.js`.
  - Production build (`npm run build`): ~714KB optimized bundle
  - Development build (`npm run dev`): ~8.8MB bundle with inline sourcemaps

### Validation and Code Quality
- **CRITICAL**: Always run `npx tsc --noEmit --skipLibCheck` to validate TypeScript compilation before committing changes (takes ~5 seconds).
- **ESLint**: The project uses legacy ESLint configuration (`.eslintrc`). Modern ESLint versions may show warnings about configuration format, but TypeScript validation is the primary code quality check.
- **No test suite exists** - validation relies on TypeScript compilation and manual testing within Obsidian.
- **ALWAYS validate changes with these scenarios:**
  1. Clean install and build: `rm -rf node_modules && npm install && npm run build`
  2. TypeScript compilation: `npx tsc --noEmit --skipLibCheck` 
  3. File size check: Verify `main.js` is generated (~700KB+ when built)
  4. Critical file modification check: If you modify task parsing, always check files can be scanned correctly

### Plugin Development Constraints
- **VALIDATION REQUIREMENT**: Since this is an Obsidian plugin, you cannot test full functionality without Obsidian. Always validate:
  1. TypeScript compilation succeeds
  2. Build completes successfully  
  3. Generated `main.js` file is created (production: ~714KB, development: ~8.8MB with sourcemaps)
  4. No TypeScript errors when importing Obsidian APIs
- **Development testing**: Install the plugin in an Obsidian vault by copying `main.js`, `manifest.json`, and `styles.css` to a plugin folder.
- **Key constraint**: The plugin extensively uses Obsidian's vault API (`this.app.vault.*`) which is not available outside Obsidian environment.

## Manual Validation Scenarios

After making changes, perform these validation scenarios:

### 1. Basic Build Validation
```bash
# Clean rebuild
rm -rf node_modules main.js
npm install  # Should complete in 25-45 seconds
npm run build  # Should complete in ~5 seconds
ls -la main.js  # Should show ~714KB (production) or ~8.8MB (development)
```

### 2. TypeScript Validation  
```bash
npx tsc --noEmit --skipLibCheck  # Should complete without errors in ~5 seconds
```

### 3. Plugin Structure Validation
```bash
# Verify all required distribution files exist
ls -la main.js manifest.json styles.css
# Verify key source files are present
ls -la main.ts src/views/TaskBoardView.tsx src/components/TaskItem.tsx
```

### 4. Development Mode Validation
```bash  
npm run dev  # Should start watch mode and display "watching for changes..."
# Test by touching a file: touch src/test.ts && rm src/test.ts
# Should trigger rebuild automatically
```

## Codebase Navigation

### Project Structure
```
/home/runner/work/Task-Board/Task-Board/
├── main.ts                     # Plugin entry point - Obsidian plugin lifecycle
├── manifest.json              # Plugin metadata for Obsidian
├── esbuild.config.mjs         # Build configuration
├── styles.css                 # Global styles (4000+ lines)
├── src/                       # Source folder (~50+ TypeScript/React files)
│   ├── views/                 # Obsidian views (1 file)
│   │   └── TaskBoardView.tsx  # Main Kanban board view
│   ├── components/            # React components (5 files)
│   │   ├── Column.tsx         # Kanban column component
│   │   ├── TaskItem.tsx       # Individual task component (26k lines - complex)
│   │   ├── KanbanBoard.tsx    # Main board component
│   │   ├── TaskBoardViewContent.tsx # Main board content wrapper
│   │   └── MapView.tsx     # Map-based view component
│   ├── interfaces/            # TypeScript interfaces (3 files)
│   │   ├── TaskItem.ts        # Task data structures
│   │   ├── BoardConfigs.ts    # Board configuration types
│   │   └── GlobalSettings.ts  # Plugin settings types (300+ lines)
│   ├── services/              # Business logic and external integrations (~10 files)
│   ├── utils/                 # Utility functions and helpers (~15 files)
│   │   ├── ScanningVault.ts   # Core vault scanning logic
│   │   ├── RealTimeScanning.ts # Real-time file change handling
│   │   ├── RenderColumns.ts   # Task filtering and column rendering
│   │   └── ...               # File operations, task parsing, etc.
│   ├── settings/              # Plugin settings UI
│   ├── modal/                 # Modal dialogs
│   └── types/                 # Type definitions and constants
```

### Key Development Patterns
- **Plugin Entry Point**: `main.ts` extends Obsidian's `Plugin` class
- **React Integration**: Uses React 19+ with createRoot for rendering UI components
- **TypeScript**: Strict TypeScript configuration with React JSX support
- **Modular Architecture**: Clear separation between views, components, services, and utilities
- **File Operations**: Heavy use of Obsidian's vault API for reading/writing markdown files
- **Real-time Updates**: Plugin monitors file changes and updates the board interface

### Important Files to Check When Making Changes
- **Always check `main.ts`** after modifying plugin lifecycle or registration logic
- **Always check `TaskBoardView.tsx`** after modifying the main board interface
- **Always check `interfaces/TaskItem.ts`** after modifying task data structures
- **Always check `utils/RenderColumns.ts`** after modifying task filtering or display logic

## Common Development Tasks

### Adding New Task Properties
1. Update `interfaces/TaskItem.ts` with new property definitions
2. Modify parsing logic in `utils/` directory
3. Update React components in `components/` to display new properties
4. Update settings UI if user configuration is needed

### Modifying Board Layout
1. Core layout logic is in `components/KanbanBoard.tsx`
2. Column rendering is handled in `components/Column.tsx`
3. Task filtering and display logic is in `utils/RenderColumns.ts`

### Plugin Settings Changes
1. Settings interface is defined in `interfaces/GlobalSettings.ts`
2. Settings UI is constructed in `settings/TaskBoardSettingConstructUI.ts`
3. Default settings are in `interfaces/GlobalSettings.ts`

## Build Outputs and Artifacts
- **Generated files**: `main.js` (bundled plugin code)
- **Distribution files**: `main.js`, `manifest.json`, `styles.css`
- **Excluded from git**: `main.js`, `node_modules/`, `*.map`, `data.json`, `tasks.json`

## Debugging and Troubleshooting
- **Plugin not loading**: Check `manifest.json` version compatibility with Obsidian
- **Build failures**: Run `npx tsc --noEmit --skipLibCheck` to isolate TypeScript errors
- **Runtime errors**: Use Obsidian's developer console (Ctrl+Shift+I)
- **File scanning issues**: Check `utils/ScanningVault.ts` and `utils/RealTimeScanning.ts`

## Release Process
- Releases are automated via GitHub Actions on git tags
- The workflow runs `npm install && npm run build` and creates a GitHub release
- **NEVER CANCEL**: Release builds may take up to 60 seconds total including dependency installation

## Critical Reminders
- **NEVER CANCEL** any npm or build commands - always wait for completion
- This plugin requires Obsidian for full functionality testing
- Always validate TypeScript compilation before pushing changes
- The plugin processes markdown files throughout the user's vault - be careful with file operations
- Real-time scanning can be performance-sensitive with large vaults
