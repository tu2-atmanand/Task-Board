// src/components/filter/FilterGroupComponent.tsx

import React from "react";
import { Plus, Copy, Trash2 } from "lucide-react";
import { FilterGroup, TaskFilter } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";
import { FilterItemComponent } from "./FilterItemComponent";

interface FilterGroupComponentProps {
	plugin: TaskBoard;
	group: FilterGroup;
	onUpdate: (group: FilterGroup) => void;
	onDelete: () => void;
}

export const FilterGroupComponent: React.FC<FilterGroupComponentProps> = ({
	plugin,
	group,
	onUpdate,
	onDelete,
}) => {
	const handleAddFilter = () => {
		const newFilter: TaskFilter = {
			id: `filter-${Date.now()}`,
			property: "priority",
			operator: "is empty",
			value: "",
			logicalOperator: "AND",
		};

		onUpdate({
			...group,
			filters: [...group.filters, newFilter],
		});
	};

	const handleUpdateFilter = (filterId: string, updatedFilter: TaskFilter) => {
		onUpdate({
			...group,
			filters: group.filters.map((f) => (f.id === filterId ? updatedFilter : f)),
		});
	};

	const handleDeleteFilter = (filterId: string) => {
		const updatedFilters = group.filters.filter((f) => f.id !== filterId);
		
		// If no filters left, delete the entire group
		if (updatedFilters.length === 0) {
			onDelete();
		} else {
			onUpdate({
				...group,
				filters: updatedFilters,
			});
		}
	};

	const handleMatchTypeChange = (matchType: "All" | "Any") => {
		onUpdate({
			...group,
			matchType,
		});
	};

	const handleDuplicateGroup = () => {
		// This is handled by parent component
		// Could be extended to support duplication
	};

	return (
		<div
			className="filter-group"
			style={{
				border: "1px solid var(--background-modifier-border)",
				borderRadius: "6px",
				padding: "12px",
				marginBottom: "12px",
				background: "var(--background-secondary)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "12px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Match</span>
					<select
						value={group.matchType}
						onChange={(e) => handleMatchTypeChange(e.target.value as "All" | "Any")}
						style={{
							padding: "4px 8px",
							borderRadius: "4px",
							border: "1px solid var(--background-modifier-border)",
							background: "var(--background-primary)",
							fontSize: "13px",
						}}
					>
						<option value="All">All</option>
						<option value="Any">Any</option>
					</select>
					<span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
						filters in this group
					</span>
				</div>

				<div style={{ display: "flex", gap: "4px" }}>
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
						aria-label="Delete group"
						title="Delete group"
					>
						<Trash2 size={16} />
					</button>
				</div>
			</div>

			<div className="filter-group-filters">
				{group.filters.map((filter, index) => (
					<div key={filter.id}>
						{index > 0 && (
							<div
								style={{
									textAlign: "center",
									margin: "8px 0",
									color: "var(--text-muted)",
									fontSize: "11px",
									fontWeight: 600,
								}}
							>
								{group.matchType.toUpperCase()}
							</div>
						)}
						<FilterItemComponent
							plugin={plugin}
							filter={filter}
							onUpdate={(updatedFilter) => handleUpdateFilter(filter.id, updatedFilter)}
							onDelete={() => handleDeleteFilter(filter.id)}
						/>
					</div>
				))}
			</div>

			<button
				onClick={handleAddFilter}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "6px",
					padding: "6px 10px",
					marginTop: "8px",
					background: "transparent",
					border: "1px dashed var(--background-modifier-border)",
					borderRadius: "4px",
					cursor: "pointer",
					width: "100%",
					justifyContent: "center",
					color: "var(--text-muted)",
					fontSize: "12px",
				}}
			>
				<Plus size={14} />
				<span>Add filter</span>
			</button>
		</div>
	);
};
