// /src/modal/BugReporter.ts

import { App, Modal, Notice, Plugin, PluginManifest } from "obsidian";
import { getObsidianDebugInfo } from "src/services/ObsidianDebugInfo";
import { createFragmentWithHTML } from "src/utils/UIHelpers";
import { t } from "src/utils/lang/helper";

export class BugReporterModal extends Modal {
	private bugContent: string;
	private context: string;
	private message: string;

	constructor(app: App, message: string, bug: string, context: string) {
		super(app);
		this.message = message;
		this.bugContent = bug;
		this.context = context;
		this.setTitle(t("bug-reporter"));
	}

	async onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "taskBoardBugReporterModal",
		});

		// Header
		// modalContent.createEl("h2", { text: t("bug-reporter") });

		const bugReportSection = modalContent.createDiv({
			cls: "bugReportSection",
		});
		bugReportSection.createEl("h3", { text: t("debug-info") });
		const bugReportContent = bugReportSection.createDiv({
			cls: "bugReportContent",
		});
		const sanitizedBugReportContent = await this.sanitizeBugReportContent(
			this.message,
			this.bugContent,
			this.context
		);
		bugReportContent.createEl("p", {
			text: createFragmentWithHTML(
				sanitizedBugReportContent.finalContentForHTMLDom
			),
		});

		const userMessageSection = modalContent.createDiv({
			cls: "contextSection",
		});
		userMessageSection.createEl("h3", { text: t("note") });

		const messageForUser = userMessageSection.createDiv({
			cls: "contextContent",
		});

		messageForUser.createEl("p", {
			text: createFragmentWithHTML(
				"<li>Kindly copy the report using button below.</li><li>Under the <b>ERROR</b> section, please find if there is any personal information captured. If yes, please replace the content with some dummy data, so the developers can understand the format of your content for easier debugging.</li><br/><li>Either mail it to <a href='mailto:sanketgauns8@gmail.com'>sanketgauns8@gmail.com</a></li><li style='align-item: 'center';''>OR</li><li>Click on the following link and login with your GitHub account :  <a href='https://github.com/tu2-atmanand/Task-Board/issues/new'>New GitHub Issue</a></li><li>Paste the report and add any additional information or screenshots.</li><li>Click on <b>create</b> to submit the issue.</b><br/><li>Thank you for your contribution.</li>"
			),
		});

		// messageForUser.createEl("p", {
		// 	text: t(
		// 		"Kindly copy this content and create a new issue on GitHub or mail it to sanketgauns8@gmail.com with any additional information and screenshots. Thank you for your contribution."
		// 	),
		// });

		const closeButton = modalContent.createEl("button", {
			text: t("copy-report"),
			cls: "bugReporterCloseButton",
		});

		closeButton.addEventListener("click", () => {
			this.handleCopyBtnEvent(
				sanitizedBugReportContent.finalContentForMarkdown
			);
		});

		// const submitButton = modalContent.createEl("button", {
		// 	text: t("submit"),
		// 	cls: "bugReporterSubmitButton",
		// });
		// submitButton.addEventListener("click", () => {
		// 	// Handle the submission of the bug report
		// 	this.handleSubmit();
		// });

		const cancelButton = modalContent.createEl("button", {
			text: t("ignore-this-bug"),
			cls: "bugReporterCancelButton",
		});

		cancelButton.addEventListener("click", () => {
			// this.onClose();
			this.close();
		});

		const actions = modalContent.createDiv({
			cls: "bugReporterActions",
		});

		actions.appendChild(closeButton);
		// actions.appendChild(submitButton);
		actions.appendChild(cancelButton);
	}

	async sanitizeBugReportContent(
		message: String,
		bugContent: String,
		context: String
	) {
		// Sanitize the bug report content to prevent XSS attacks
		let sanitizedErrorContent = bugContent;
			// .replace(/</g, "&lt;")
			// .replace(/>/g, "&gt;");
		// This sanitization function will also going to hide user data to preserve privacy. To do this, I will be replacing all the alphabets and nembers with '*', and keep the rest of characters as it is. This will help me to get the format of the their content and also preserve the privacy of the user.
		// sanitizedErrorContent = sanitizedErrorContent.replace(/[a-zA-Z0-9]/g, "*");

		// const systemInfo = this.getSystemInfo();
		const systemInfo = await getObsidianDebugInfo(this.app);
		const systemInfoTextHTMLDom = Object.entries(systemInfo)
			.map(
				([key, value]) =>
					`${key}: ${
						Array.isArray(value) ? value.join("<br/>") : value
					}`
			)
			.join("<br/>");

		const systemInfoTextMarkdown = Object.entries(systemInfo)
			.map(
				([key, value]) =>
					`${key}: ${
						Array.isArray(value) ? value.join("\n\t") : value
					}`
			)
			.join("\n");

		const finalContentForHTMLDom = `<h4>Developer message</h4><br/>${message}<br/><br/><h5>Error Message</h5><i>${sanitizedErrorContent}</i><br/><br/><b>Context</b> : ${context}<br/><br/><h5>System Information</h5>${systemInfoTextHTMLDom}<br/><h5>Any additional information and screenshots</h5>`;

		const finalContentForMarkdown = `# Bug Report\n\n## Developer message\n\n${message}\n\n## Error Message\n\n${sanitizedErrorContent}\n\n## Context\n${context}\n\n## System Information\n\n${systemInfoTextMarkdown}\n\n### Any additional information and screenshots`;

		return { finalContentForHTMLDom, finalContentForMarkdown };
	}

	getSystemInfo() {
		// Get system information like OS, Obsidian version, etc.
		const obsidianVersion =
			this.app.title.split(" ").pop() || "Unknown Version";
		const appVersion = navigator.appVersion || "Unknown App Version";
		const enabledPlugins = this.app.plugins.enabledPlugins;
		const enabledPluginsWithVersionMap = Object.values(
			this.app.plugins.manifests
		)
			.filter((plugin: PluginManifest) => enabledPlugins.has(plugin.id))
			.map((plugin: PluginManifest) => ({
				id: plugin.id,
				version: plugin.version,
			}));

		const stringifyEnabledPlugins = enabledPluginsWithVersionMap
			.map((plugin) => `${plugin.id} = ${plugin.version}`)
			.join("    <br/>");

		return `<b>App version</b>: ${appVersion}<br/><br/><b>Obsidian Version</b>: ${obsidianVersion}<br/><br/><b>Enabled Plugins</b>:<br/>${stringifyEnabledPlugins}`;
	}

	handleCopyBtnEvent(bugReportContent: string) {
		// Copy the bug report content to clipboard
		navigator.clipboard.writeText(bugReportContent).then(() => {
			new Notice(t("copied-to-clipboard"));
		});
	}

	handleSubmit() {
		// Handle the submission of the bug report
		// You can send the bug report to your server or handle it as needed
		// console.log("Bug Report Submitted:", this.bugContent);
		// console.log("Context:", this.context);
		// this.onClose();
	}

	// onClose() {
	// 	const { contentEl } = this;
	// 	contentEl.empty();

	// 	// Close the modal
	// 	this.close();
	// }
}
