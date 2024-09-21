// /src/modal/AddColumnModal.tsx

import React, { useState } from "react";

interface AddColumnModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (columnData: { colType: string; name: string, active: boolean }) => void;
}

const AddColumnModal: React.FC<AddColumnModalProps> = ({ isOpen, onClose, onSubmit }) => {
	const [colType, setColType] = useState("undated");
	const [name, setName] = useState("");

	const handleColTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setColType(event.target.value);
	};

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	};

	const handleSubmit = () => {
		const active = true;
		onSubmit({ colType, name, active });
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="addColumnModalOverlay">
			<div className="addColumnModalOverlayContent">
				<h2>Add Column</h2>
				<div className="addColumnModalOverlayContentField">
					<label htmlFor="colType">Column Type</label>
					<select id="colType" value={colType} onChange={handleColTypeChange}>
						<option value="undated">Undated</option>
						<option value="dated">Dated</option>
						<option value="namedTag">Tagged</option>
						<option value="untagged">Untagged</option>
						<option value="completed">Completed</option>
						<option value="otherTags">Other Tags</option>
					</select>
				</div>
				<div className="addColumnModalOverlayContentField">
					<label htmlFor="name">Column Name</label>
					<input
						type="text"
						id="name"
						value={name}
						onChange={handleNameChange}
						placeholder="Enter column name"
					/>
				</div>
				<div className="addColumnModalOverlayContentActions">
					<button onClick={handleSubmit}>Submit</button>
					<button onClick={onClose}>Cancel</button>
				</div>
			</div>
		</div>
	);
};

export default AddColumnModal;
