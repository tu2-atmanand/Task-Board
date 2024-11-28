// /src/modal/AddColumnModal.tsx

import React, { useState } from "react";

import { t } from "src/utils/lang/helper";

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
				<h2>{t(56)}</h2>
				<div className="addColumnModalOverlayContentField">
					<label htmlFor="colType">{t(10)}</label>
					<select id="colType" value={colType} onChange={handleColTypeChange}>
						<option value="undated">{t(11)}</option>
						<option value="dated">{t(12)}</option>
						<option value="namedTag">{t(13)}</option>
						<option value="untagged">{t(14)}</option>
						<option value="completed">{t(15)}</option>
						<option value="otherTags">{t(16)}</option>
					</select>
				</div>
				<div className="addColumnModalOverlayContentField">
					<label htmlFor="name">{t(17)}</label>
					<input
						type="text"
						id="name"
						value={name}
						onChange={handleNameChange}
						placeholder={t(20)}
					/>
				</div>
				<div className="addColumnModalOverlayContentActions">
					<button onClick={handleSubmit}>{t(18)}</button>
					<button onClick={onClose}>{t(19)}</button>
				</div>
			</div>
		</div>
	);
};

export default AddColumnModal;
