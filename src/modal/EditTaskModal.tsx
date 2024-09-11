// /src/components/EditTaskModal.tsx

import { App, Modal } from "obsidian";
import React, { useState } from "react";

import ReactDOM from "react-dom/client";

// Functional React component for the modal content
const EditTaskContent: React.FC<{ task: any; onSave: (updatedTask: any) => void; onClose: () => void }> = ({ task, onSave, onClose }) => {
	const [body, setBody] = useState(task.body);
	const [due, setDue] = useState(task.due);
	const [tag, setTag] = useState(task.tag);

	const handleSave = () => {
		const updatedTask = {
			...task,
			body,
			due,
			tag,
		};
		// console.log("updatedTask i am sending from EditTaskModal.tsx to Column.tsx file : ", updatedTask);
		onSave(updatedTask);
		onClose();
	};

	return (
		<div className="EditTaskModalHome">
			<div className="EditTaskModalHome-title">Edit Task</div>
			<textarea className="EditTaskModalHome-taskBody" value={body} onChange={(e) => setBody(e.target.value)} />
			<table>
				<tbody>
					<tr>
						<td>
							<div className="EditTaskModalHome-dueTitle">Task Due Date : </div>
						</td>
						<td className="EditTaskModalHome-tableValues">
							<input className="EditTaskModalHome-dueValue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
						</td>
						<td>
							📅{due}
						</td>
					</tr>
					<tr>
						<td>
							<div className="EditTaskModalHome-tagTitle">Task Tag : </div>
						</td>
						<td className="EditTaskModalHome-tableValues">
							<input className="EditTaskModalHome-tagValue" type="text" value={tag} onChange={(e) => setTag(e.target.value)} />
						</td>
						<td>
							#{tag}
						</td>
					</tr>
				</tbody>
			</table>
			<h6>Preview</h6>
			<div className="previewBox">
				- [ ] {body} | 📅{due} #{tag}
			</div>
			<button className="EditTaskModalHome-saveBtn" onClick={handleSave}>Save</button>
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
