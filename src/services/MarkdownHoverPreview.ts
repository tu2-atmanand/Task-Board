import { App, Keymap } from "obsidian";

import React from "react";

export function hookMarkdownLinkMouseEventHandlers(
	app: App,
	containerEl: HTMLElement,
	sourcePath: string,
	filePath: string
) {
	containerEl.querySelectorAll("a.internal-link").forEach((el) => {
		el.addEventListener("click", (evt: MouseEvent) => {
			evt.preventDefault();
			const linktext = el.getAttribute("href");
			if (linktext) {
				app.workspace.openLinkText(
					linktext,
					sourcePath,
					Keymap.isModEvent(evt)
				);
			}
		});

		el.addEventListener("mouseover", (event: MouseEvent) => {
			event.preventDefault();
			const linktext = el.getAttribute("href");
			if (linktext) {
				app.workspace.trigger("hover-link", {
					event,
					source: "task-board",
					hoverParent: { hoverPopover: null },
					targetEl: event.currentTarget,
					linktext: linktext,
					sourcePath: filePath,
				});
			}
		});
	});
}

export function markdownButtonHoverPreviewEvent(
	app: App,
	event: React.MouseEvent,
	containerEl: HTMLElement,
	filePath: string
) {
	// console.log("Inside the markdownButtonHoverPreviewEvent() ...");
	app.workspace.trigger("hover-link", {
		event,
		source: "task-board",
		hoverParent: { hoverPopover: null },
		targetEl: event.currentTarget,
		linktext: filePath,
		sourcePath: filePath,
	});
	
	// const editButtonElement:HTMLElement = containerEl.getElementsById("taskItemiconButtonEdit");
	// containerEl.addEventListener("mouseover", (event: MouseEvent) => {
	// 	console.log("Mouse hovered over the edit button ...");
	// 	// event.preventDefault();
	// });
}