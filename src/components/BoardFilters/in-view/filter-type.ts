import { Component } from "obsidian";

export interface FilterCategory {
	id: string;
	label: string;
	options: string[];
}

export interface ActiveFilter {
	id: string;
	category: string;
	categoryLabel: string;
	value: string;
}

export interface FilterComponentOptions {
	container: HTMLElement;
	options: FilterCategory[];
	onChange?: (activeFilters: ActiveFilter[]) => void;
	components?: Component[];
}

export interface FilterDropdownOptions {
	options: FilterCategory[];
	anchorElement: HTMLElement;
	onSelect: (category: string, value: string) => void;
	onClose: () => void;
}

export interface FilterPillOptions {
	filter: ActiveFilter;
	onRemove: (id: string) => void;
}
