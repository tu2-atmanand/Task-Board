// /src/services/FrontmatterRenderer.ts

/**
 * @module FrontmatterRenderer
 * Utility class for rendering frontmatter properties using Obsidian's PropertyWidget API
 * The below code has been referenced from the following sources :
 * @see https://github.com/Fevol/obsidian-typings/blob/release/obsidian-public/1.9.14/src/obsidian/internals/PropertyWidget.d.ts
 * @see https://github.com/unxok/obsidian-better-properties/blob/main/src/classes/PropertyComponent/index.ts
 *
 * In the current version, this FrontmatterRenderer is using a simple custom styling method to render the properties.
 */

import type TaskBoard from "main";
import { App, Component, Notice, TFile } from "obsidian";
import { extractFrontmatterFromContent } from "src/utils/taskNote/FrontmatterOperations";

/**
 * Renders frontmatter properties using Obsidian's PropertyWidget API
 */
export class FrontmatterRenderer {
	private plugin: TaskBoard;
	private app: App;
	private component: Component;
	public isFrontmatterContainerCollapsed: boolean;

	constructor(plugin: TaskBoard, component: Component) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.component = component;
		this.isFrontmatterContainerCollapsed = true;
	}

	/**
	 * Extract frontmatter content from markdown text
	 * @param content - Full markdown content
	 * @returns The frontmatter content (including delimiters) or null if not found
	 */
	public extractFrontmatterContent(content: string): string {
		if (!content.startsWith("---\n")) {
			return "";
		}

		const secondDelimiterIndex = content.indexOf("\n---\n", 4);
		if (secondDelimiterIndex === -1) {
			return "";
		}

		// Return the complete frontmatter including delimiters
		return content.substring(0, secondDelimiterIndex + 5) ?? ""; // +5 to include "\n---\n"
	}

	public extractContentWithoutFrontmatter(
		content: string,
		frontmatterContent: string,
	): string {
		if (!frontmatterContent) return content;

		const contentWithoutFrontmatter = content.substring(
			frontmatterContent.length,
		);
		return contentWithoutFrontmatter;
	}

	/**
	 * Extract frontmatter object from content
	 * @param content - Full markdown content
	 * @returns Frontmatter object or null
	 */
	// private extractFrontmatterObject(
	// 	content: string
	// ): Record<string, any> | null {
	// 	if (!content.startsWith("---\n")) {
	// 		return null;
	// 	}

	// 	const secondDelimiterIndex = content.indexOf("\n---\n", 4);
	// 	if (secondDelimiterIndex === -1) {
	// 		return null;
	// 	}

	// 	// Extract the YAML content between delimiters
	// 	const yamlContent = content.substring(4, secondDelimiterIndex);

	// 	try {
	// 		const frontmatter = parseYaml(yamlContent);
	// 		return frontmatter as Record<string, any>;
	// 	} catch (error) {
	// bugReporterManagerInsatance.addToLogs(
	// 	172,
	// 	`Failed to parse frontmatter: ${String(error)}`,
	// 	"FrontmatterRenderer.ts/extractFrontmatterObject",
	// );
	// 		return null;
	// 	}
	// }

	/**
	 * Create a collapsible properties section for frontmatter
	 * @param containerEl - Container element to render the properties section
	 * @param content - Full markdown content
	 * @param file - Optional TFile for context
	 * @returns Object containing the frontmatter container and the rest of the content
	 */
	public renderCollapsibleFrontmatter(
		containerEl: HTMLElement,
		content: string,
		file?: TFile,
	): {
		frontmatterContainer: HTMLElement | null;
		contentWithoutFrontmatter: string;
	} {
		const frontmatterContent = this.extractFrontmatterContent(content);

		if (!frontmatterContent) {
			return {
				frontmatterContainer: null,
				contentWithoutFrontmatter: content,
			};
		}

		// Extract frontmatter object
		const frontmatter = extractFrontmatterFromContent(this.plugin, content);

		if (!frontmatter) {
			return {
				frontmatterContainer: null,
				contentWithoutFrontmatter: content,
			};
		}

		// Get the content after frontmatter
		const contentWithoutFrontmatter = this.extractContentWithoutFrontmatter(
			content,
			frontmatterContent,
		);

		// Create the frontmatter section container
		const frontmatterSection = containerEl.createDiv({
			cls: "taskboard-frontmatter-section",
		});

		// Create the collapsible header
		const header = frontmatterSection.createDiv({
			cls: "taskboard-frontmatter-header",
		});

		// Add collapse icon
		const collapseIcon = header.createSpan({
			cls: "taskboard-frontmatter-collapse-icon",
		});
		collapseIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

		// Add "Properties" text
		header.createSpan({
			cls: "taskboard-frontmatter-header-text",
			text: "Properties",
		});

		// Add property count
		const propertyCount = Object.keys(frontmatter).filter(
			(key) => key !== "position",
		).length;
		header.createSpan({
			cls: "taskboard-frontmatter-property-count",
			text: `${propertyCount}`,
		});

		// Create the properties container
		const propertiesContainer = frontmatterSection.createDiv({
			cls: ["metadata-properties", "taskboard-frontmatter-properties"],
		});
		if (this.isFrontmatterContainerCollapsed) {
			propertiesContainer.style.display = "none";
			collapseIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
		}

		// Render each property using PropertyWidget
		this.renderProperties(propertiesContainer, frontmatter, file);

		// Add click handler for collapse/expand
		header.addEventListener("click", () => {
			this.isFrontmatterContainerCollapsed =
				!this.isFrontmatterContainerCollapsed;

			if (this.isFrontmatterContainerCollapsed) {
				propertiesContainer.style.display = "none";
				collapseIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
			} else {
				propertiesContainer.style.display = "flex";
				collapseIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
			}

			frontmatterSection.toggleClass(
				"is-collapsed",
				this.isFrontmatterContainerCollapsed,
			);
		});

		return {
			frontmatterContainer: frontmatterSection,
			contentWithoutFrontmatter,
		};
	}

	/**
	 * Render individual properties using PropertyWidget API
	 * @param containerEl - Container for properties
	 * @param frontmatter - Frontmatter object
	 * @param file - Optional TFile for context
	 */
	private renderProperties(
		containerEl: HTMLElement,
		frontmatter: Record<string, any>,
		file?: TFile,
	): void {
		this.renderPropertiesSimple(containerEl, frontmatter);
		return;

		// TODO : Will work on implementing a Full Metadata editor inside this embeddableEditor later.
		/**
		 * Current Issues which I am facing right now :
		 * - `plugin.app` doesnt seems to have all the properties of `window.app`.
		 * - The values are not being populated inside the rendered widgets.
		 * - After changing the value from the widget the onChange cb is not called immediaterly. Its getting called when user tries to update the property second time.
		 * - The suggestions menu flashes when trying to edit the property value. Also the experience of editing it is not smooth.
		 * A full metadataEditor will be required to be implemented, instead of simply the propertyWidget.
		 */
		/*
		const metadataTypeManager = this.plugin.app
			.metadataTypeManager as MetadataTypeManager;
		console.log("metadataTypeManager :", metadataTypeManager);

		if (!metadataTypeManager) {
			// Fallback to simple rendering if PropertyWidget API is not available
			this.renderPropertiesSimple(containerEl, frontmatter);
			return;
		}

		// Filter out internal Obsidian properties
		const propertiesToRender = Object.entries(frontmatter).filter(
			([key]) => key !== "position"
		);

		for (const [key, value] of propertiesToRender) {
			const propertyRow = containerEl.createDiv({
				cls: [
					"metadata-property",
					"taskboard-frontmatter-property-row",
				],
			});

			// Render property key
			const keyEl = propertyRow.createDiv({
				cls: "taskboard-frontmatter-property-key",
				text: key,
			});

			// Render property value using PropertyWidget
			const valueEl = propertyRow.createDiv({
				cls: "taskboard-frontmatter-property-value",
			});

			try {
				// Get the property widget type
				const typeInfo = metadataTypeManager.getTypeInfo(key, value);

				const widget = typeInfo?.inferred || typeInfo?.expected;

				if (widget && widget.render) {
					// Create context for rendering
					const context = {
						app: window.app,
						key,
						sourcePath: file?.path || "",
						blur: () => {},
						onChange: (newValue: unknown) => {
							// Handle property value changes
							// This would require updating the frontmatter in the editor
							console.log(
								`Property ${key} changed to:`,
								newValue
							);
						},
					};

					const entryData = {
						key,
						type: widget.type,
						value,
					};

					// Render the widget
					const widgetComponent = widget.render(
						valueEl,
						entryData,
						context
					);
					console.log("Widget component :", widgetComponent);

					// Register the component if it's a Component instance
					if (
						widgetComponent &&
						widgetComponent instanceof Component
					) {
						this.component.addChild(widgetComponent);
					}
				} else {
					// Fallback to simple rendering
					this.renderPropertyValueSimple(valueEl, value);
				}
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
				174,
				`FALLBACK : Failed to render property ${key} with PropertyWidget: ${String(error)}`,
				"FrontmatterRenderer.ts/renderProperties",
			);
				// Fallback to simple rendering
				this.renderPropertyValueSimple(valueEl, value);
			}
		}
		*/
	}

	/**
	 * Simple fallback rendering for properties
	 * @param containerEl - Container for properties
	 * @param frontmatter - Frontmatter object
	 */
	private renderPropertiesSimple(
		containerEl: HTMLElement,
		frontmatter: Record<string, any>,
	): void {
		const propertiesToRender = Object.entries(frontmatter).filter(
			([key]) => key !== "position",
		);

		for (const [key, value] of propertiesToRender) {
			const propertyRow = containerEl.createDiv({
				cls: "taskboard-frontmatter-property-row",
			});

			propertyRow.addEventListener("click", () => {
				new Notice(
					"This frontmatter section is read-only. A fully-functional frontmatter editor is under development.",
				);
			});

			propertyRow.createDiv({
				cls: "taskboard-frontmatter-property-key",
				text: key,
			});

			const valueEl = propertyRow.createDiv({
				cls: "taskboard-frontmatter-property-value",
			});

			this.renderPropertyValueSimple(valueEl, value);
		}
	}

	/**
	 * Simple rendering for property values
	 * @param containerEl - Container for value
	 * @param value - Property value
	 */
	private renderPropertyValueSimple(
		containerEl: HTMLElement,
		value: any,
	): void {
		if (Array.isArray(value)) {
			const list = containerEl.createEl("ul", {
				cls: "taskboard-frontmatter-property-list",
			});
			value.forEach((item) => {
				list.createEl("li", { text: String(item) });
			});
		} else if (typeof value === "object" && value !== null) {
			containerEl.setText(JSON.stringify(value, null, 2));
		} else {
			containerEl.setText(String(value));
		}
	}
}
