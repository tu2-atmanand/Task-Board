// /src/components/EditTaskModal.tsx

import React, { useState } from "react";
import { Modal, App } from "obsidian";
import ReactDOM from "react-dom/client";

// Functional React component for the modal content
const EditTaskContent: React.FC<{ task: any; onSave: (updatedTask: any) => void; onClose: () => void }> = ({ task, onSave, onClose }) => {
	const [body, setBody] = useState(task.body);
	const [due, setDue] = useState(task.due);

	const handleSave = () => {
		const updatedTask = {
			...task,
			body,
			due,
		};
		console.log("updatedTask i am sending from EditTaskModal.tsx to Column.tsx file : ", updatedTask);
		onSave(updatedTask);
		onClose();
	};

	return (
		<div>
			<h3>Edit Task</h3>
			<textarea value={body} onChange={(e) => setBody(e.target.value)} />
			<input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
			<button onClick={handleSave}>Save</button>
		</div>
	);
};

// Class component extending Modal for Obsidian
export class EditTaskModal extends Modal {
	task: any;
	onSave: (updatedTask: any) => void;

	constructor(app: App, task: any, onSave: (updatedTask: any) => void) {
		super(app);
		this.task = task;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<EditTaskContent
			task={this.task}
			onSave={this.onSave}
			onClose={() => this.close()}
		/>)
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
