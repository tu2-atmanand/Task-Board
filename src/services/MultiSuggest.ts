// /src/services/MultiSuggests.ts

import TaskBoard from "main";
import { AbstractInputSuggest, App, TFile, TFolder } from "obsidian";
import { CustomStatus } from "src/interfaces/GlobalSettings";
import { taskItem } from "src/interfaces/TaskItem";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";

export class MultiSuggest extends AbstractInputSuggest<string> {
	content: Set<string>;

	constructor(
		private inputEl: HTMLInputElement,
		content: Set<string>,
		private onSelectCb: (value: string) => void,
		app: App
	) {
		super(app, inputEl);
		this.content = content;
	}

	getSuggestions(inputStr: string): string[] {
		const lowerCaseInputStr = inputStr.toLocaleLowerCase();
		return [...this.content].filter((content) =>
			content.toLocaleLowerCase().includes(lowerCaseInputStr)
		);
	}

	renderSuggestion(content: string, el: HTMLElement): void {
		el.setText(content);
	}

	selectSuggestion(content: string, evt: MouseEvent | KeyboardEvent): void {
		this.onSelectCb(content);
		this.inputEl.value = content; // Set the input value to the selected suggestion
		this.inputEl.blur();
		this.close();
	}
}

export function getFolderSuggestions(app: App): string[] {
	// const folders: string[] = [];
	// const stack: TFolder[] = [app.vault.getRoot()];

	// while (stack.length > 0) {
	// 	const currentFolder = stack.pop()!;
	// 	folders.push(currentFolder.path);

	// 	currentFolder.children
	// 		.filter((child): child is TFolder => child instanceof TFolder)
	// 		.forEach((childFolder) => stack.push(childFolder));
	// }

	// Pass only loaded folders
	const folders = app.vault
		.getAllLoadedFiles()
		.filter((f) => f instanceof TFolder && f.path !== "/")
		.map((f) => f.path);

	return folders;
}

export function getFileSuggestions(app: App): string[] {
	// Pass only loaded files
	const files = app.vault
		.getAllLoadedFiles()
		.filter(
			(f) => f instanceof TFile && allowedFileExtensionsRegEx.test(f.path)
		)
		.map((f) => f.path);

	return files;
}

export function getTagSuggestions(app: App): string[] {
	// Get all tags from the vault
	const allTagsDict = app.metadataCache.getTags() || {};
	const tagsArray = Object.entries(allTagsDict)
		.filter(([tag]) => tag.startsWith("#"))
		.sort(([, countA], [, countB]) => countB - countA) // Sort by number of occurrences in descending order
		.map(([tag]) => tag); // Extract the tag names

	return tagsArray;
}

export function getQuickAddPluginChoices(
	app: App,
	quickAddPluginObj: any
): string[] {
	try {
		if (!quickAddPluginObj) {
			throw new Error("QuickAdd plugin object is undefined.");
		}
		const quickAddPlugin = app.plugins.getPlugin("quickadd");
		if (!quickAddPlugin) return [];

		const choices = quickAddPluginObj.settings.choices;

		return Object.keys(choices)
			.filter((key) => choices[key].type === "Capture")
			.map((key) => choices[key].name);
	} catch (error) {
		console.warn("Error fetching QuickAdd plugin choices:", error);
		return [];
	}
}

export function getFrontmatterPropertyNames(app: App): string[] {
	//Here I should go through all the markdown files and fetch their frontmatter property names
	const frontmatterProperties: { name: string }[] = [];
	const allFiles = app.vault.getMarkdownFiles();
	allFiles.forEach((file) => {
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
		if (frontmatter) {
			Object.keys(frontmatter).forEach((key) => {
				if (!frontmatterProperties.some((prop) => prop.name === key)) {
					frontmatterProperties.push({ name: key });
				}
			});
		}
	});

	return frontmatterProperties.map((property) => property.name);
}

export function getYAMLPropertySuggestions(app: App): string[] {
	// Get all YAML properties from the vault
	const allFiles = app.vault
		.getAllLoadedFiles()
		.filter((f) => f instanceof TFile && f.extension === "md");
	const yamlPropertiesSet = new Set<string>();

	allFiles.forEach((file) => {
		if (file instanceof TFile) {
			const metadata = app.metadataCache.getFileCache(file);
			if (metadata && metadata.frontmatter) {
				// console.log("Frontmatter:", metadata.frontmatter, "\nFile:", file.path);
				Object.keys(metadata.frontmatter).forEach((key) => {
					const value = metadata.frontmatter
						? metadata.frontmatter[key]
						: null;
					if (Array.isArray(value)) {
						value.forEach((val) => {
							yamlPropertiesSet.add(`["${key}": ${val}]`);
						});
					} else {
						yamlPropertiesSet.add(`["${key}": ${value}]`);
					}
				});
			}
		}
	});

	return Array.from(yamlPropertiesSet);
}

export function getStatusSuggestions(statusConfigs: CustomStatus[]): string[] {
	return statusConfigs.map(({ symbol, name }) => `${name} : [${symbol}]`);
}

export function getPrioritySuggestions(): string[] {
	// Return priority values with emojis
	return [
		"0", // none
		"1", // highest 🔺
		"2", // high ⏫
		"3", // medium 🔼
		"4", // low 🔽
		"5", // lowest ⏬
	];
}

export function getPendingTasksSuggestions(plugin: TaskBoard): taskItem[] {
	const pendingObj = plugin.vaultScanner.tasksCache?.Pending ?? {};
	const taskSet = new Set<taskItem>();
	Object.values(pendingObj).forEach((tasksArr) => {
		tasksArr.forEach((task) => {
			taskSet.add(task);
		});
	});
	return Array.from(taskSet);
}
