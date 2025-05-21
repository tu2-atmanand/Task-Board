// /src/modal/BugReporter.ts

import { App, Modal, Notice } from "obsidian";
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
	}

	onOpen() {
		const { contentEl } = this;

		this.modalEl.setAttribute("data-type", "task-board-view");
		contentEl.setAttribute("data-type", "task-board-view");

		const modalContent = contentEl.createDiv({
			cls: "bugReporterModal",
		});

		// Header
		modalContent.createEl("h2", { text: t("bug-reporter") });

		const bugReportSection = modalContent.createDiv({
			cls: "bugReportSection",
		});
		bugReportSection.createEl("h3", { text: t("report") });
		const bugReportContent = bugReportSection.createDiv({
			cls: "bugReportContent",
		});
		const sanitizedBugReportContent = this.sanitizeBugReportContent(
			this.message,
			this.bugContent,
			this.context
		);
		bugReportContent.createEl("p", {
			text: createFragmentWithHTML(sanitizedBugReportContent),
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
				"<li>Under the <b>ERROR</b> section, please find if there is any personal information captured. If yes, please replace each of those characters in that part with equal amounts of <b>'*'</b> symbol, so the developers can understand the format of your content for easier debugging.<br/>Kindly copy this content and create a new issue on <a href='github.com/tu2-atmanand/task-board/issues'>GitHub</a> or mail it to <link href='mailto:sanketgauns8@gmail.com'>sanketgauns8@gmail.com</link> with any additional information and screenshots. Thank you for your contribution.</li>"
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
			this.handleCopyBtnEvent(sanitizedBugReportContent);
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

		this.modalEl.addClass("bugReporterModal");
	}

	sanitizeBugReportContent(
		message: String,
		bugContent: String,
		context: String
	) {
		// Sanitize the bug report content to prevent XSS attacks
		let sanitizedContent = bugContent
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		// This sanitization function will also going to hide user data to preserve privacy. To do this, I will be replacing all the alphabets and nembers with '*', and keep the rest of characters as it is. This will help me to get the format of the their content and also preserve the privacy of the user.
		// sanitizedContent = sanitizedContent.replace(/[a-zA-Z0-9]/g, "*");

		const finalContent = `<b>Developer message</b> : ${message}<br/><br/><b>Context</b> : ${context}<br/><br/><h5>ERROR</h5><i>${sanitizedContent}</i><br/>`;

		return finalContent;
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
		console.log("Bug Report Submitted:", this.bugContent);
		console.log("Context:", this.context);
		// this.onClose();
	}

	// onClose() {
	// 	const { contentEl } = this;
	// 	contentEl.empty();

	// 	// Close the modal
	// 	this.close();
	// }
}
