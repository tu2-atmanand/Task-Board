import { App, Keymap } from "obsidian";

import React from "react";
import TaskBoard from "main";

export function hookMarkdownLinkMouseEventHandlers(
	app: App,
	plugin: TaskBoard,
	containerEl: HTMLElement,
	sourcePath: string,
	filePath: string
) {
	containerEl
		.querySelectorAll<HTMLElement>("a.internal-link")
		.forEach((el) => {
			// Register the click event
			plugin.registerDomEvent(el, "click", (evt: MouseEvent) => {
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

			// Register the mouseover event
			plugin.registerDomEvent(el, "mouseover", (event: MouseEvent) => {
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
	filePath: string
) {
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
