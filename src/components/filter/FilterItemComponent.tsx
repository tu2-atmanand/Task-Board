// src/components/filter/FilterItemComponent.tsx

import React from "react";
import { Trash2 } from "lucide-react";
import { TaskFilter, FilterProperty, FilterOperator } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";

interface FilterItemComponentProps {
	plugin: TaskBoard;
	filter: TaskFilter;
	onUpdate: (filter: TaskFilter) => void;
	onDelete: () => void;
}

// Define available properties with their operators
const propertyOperators: Record<FilterProperty, FilterOperator[]> = {
	priority: ["is empty", "is not empty"],
	status: ["contains", "does not contain", "is", "is not"],
	"due date": [">=", "<=", "=", ">", "<", "is empty", "is not empty"],
	"created date": [">=", "<=", "=", ">", "<", "is empty", "is not empty"],
	"scheduled date": [">=", "<=", "=", ">", "<", "is empty", "is not empty"],
	"start date": [">=", "<=", "=", ">", "<", "is empty", "is not empty"],
	"completion date": [">=", "<=", "=", ">", "<", "is empty", "is not empty"],
	"file path": ["contains", "does not contain", "starts with", "ends with"],
	tags: ["contains", "does not contain", "is empty", "is not empty"],
};

export const FilterItemComponent: React.FC<FilterItemComponentProps> = ({
	plugin,
	filter,
	onUpdate,
	onDelete,
}) => {
	const handlePropertyChange = (property: FilterProperty) => {
		const operators = propertyOperators[property];
		onUpdate({
			...filter,
			property,
			operator: operators[0],
			value: "",
		});
	};

	const handleOperatorChange = (operator: FilterOperator) => {
		onUpdate({
			...filter,
			operator,
		});
	};

	const handleValueChange = (value: string) => {
		onUpdate({
			...filter,
			value,
		});
	};

	const needsValueInput = () => {
		return !["is empty", "is not empty"].includes(filter.operator);
	};

	const getInputType = () => {
		if (
			filter.property.includes("date") &&
			needsValueInput()
		) {
			return "date";
		}
		return "text";
	};

	const getPlaceholder = () => {
		if (filter.property === "priority") {
			return "e.g., high, medium, low";
		} else if (filter.property === "status") {
			return "e.g., x, /, -, >";
		} else if (filter.property === "file path") {
			return "e.g., folder/file.md";
		} else if (filter.property === "tags") {
			return "e.g., #project, #work";
		} else if (filter.property.includes("date")) {
			return "Select date";
		}
		return "Enter value";
	};

	return (
		<div
			className="filter-item"
			style={{
				display: "flex",
				alignItems: "center",
				gap: "8px",
				padding: "8px",
				background: "var(--background-primary)",
				borderRadius: "4px",
				border: "1px solid var(--background-modifier-border)",
			}}
		>
			<select
				value={filter.property}
				onChange={(e) => handlePropertyChange(e.target.value as FilterProperty)}
				style={{
					padding: "6px 8px",
					borderRadius: "4px",
					border: "1px solid var(--background-modifier-border)",
					background: "var(--background-primary)",
					fontSize: "13px",
					minWidth: "120px",
				}}
			>
				<option value="priority">Priority</option>
				<option value="status">Status</option>
				<option value="due date">Due Date</option>
				<option value="created date">Created Date</option>
				<option value="scheduled date">Scheduled Date</option>
				<option value="start date">Start Date</option>
				<option value="completion date">Completion Date</option>
				<option value="file path">File Path</option>
				<option value="tags">Tags</option>
			</select>

			<select
				value={filter.operator}
				onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
				style={{
					padding: "6px 8px",
					borderRadius: "4px",
					border: "1px solid var(--background-modifier-border)",
					background: "var(--background-primary)",
					fontSize: "13px",
					minWidth: "140px",
				}}
			>
				{propertyOperators[filter.property].map((op) => (
					<option key={op} value={op}>
						{op}
					</option>
				))}
			</select>

			{needsValueInput() && (
				<input
					type={getInputType()}
					value={filter.value}
					onChange={(e) => handleValueChange(e.target.value)}
					placeholder={getPlaceholder()}
					style={{
						flex: 1,
						padding: "6px 8px",
						borderRadius: "4px",
						border: "1px solid var(--background-modifier-border)",
						background: "var(--background-primary)",
						fontSize: "13px",
					}}
				/>
			)}

			<button
				onClick={onDelete}
				style={{
					background: "transparent",
					border: "none",
					cursor: "pointer",
					padding: "4px",
					display: "flex",
					alignItems: "center",
					color: "var(--text-muted)",
				}}
				aria-label="Delete filter"
				title="Delete filter"
			>
				<Trash2 size={16} />
			</button>
		</div>
	);
};
