// src/components/filter/ViewTaskFilterPopover.tsx

import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Copy, Trash2 } from "lucide-react";
import { AdvancedFilters, FilterGroup, TaskFilter, FilterProperty, FilterOperator } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";
import { FilterGroupComponent } from "./FilterGroupComponent";

interface ViewTaskFilterPopoverProps {
	plugin: TaskBoard;
	boardIndex: number;
	currentFilters: AdvancedFilters;
	onSave: (filters: AdvancedFilters) => void;
	onClose: () => void;
	anchorEl: HTMLElement;
}

export const ViewTaskFilterPopover: React.FC<ViewTaskFilterPopoverProps> = ({
	plugin,
	boardIndex,
	currentFilters,
	onSave,
	onClose,
	anchorEl,
}) => {
	const [filters, setFilters] = useState<AdvancedFilters>(
		currentFilters || {
			enabled: false,
			matchType: "All",
			groups: [],
		}
	);
	const popoverRef = useRef<HTMLDivElement>(null);

	// Position the popover near the anchor element
	useEffect(() => {
		if (popoverRef.current && anchorEl) {
			const rect = anchorEl.getBoundingClientRect();
			const popover = popoverRef.current;
			
			// Position below the anchor element
			popover.style.top = `${rect.bottom + 5}px`;
			popover.style.left = `${rect.left}px`;
			popover.style.maxWidth = "600px";
		}
	}, [anchorEl]);

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node) &&
				!anchorEl.contains(event.target as Node)
			) {
				handleSave();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [filters]);

	const handleSave = () => {
		onSave(filters);
		onClose();
	};

	const handleAddFilterGroup = () => {
		const newGroup: FilterGroup = {
			id: `group-${Date.now()}`,
			matchType: "All",
			filters: [
				{
					id: `filter-${Date.now()}`,
					property: "priority",
					operator: "is empty",
					value: "",
					logicalOperator: "AND",
				},
			],
			logicalOperator: "OR",
		};

		setFilters({
			...filters,
			groups: [...filters.groups, newGroup],
		});
	};

	const handleDeleteGroup = (groupId: string) => {
		setFilters({
			...filters,
			groups: filters.groups.filter((g) => g.id !== groupId),
		});
	};

	const handleUpdateGroup = (groupId: string, updatedGroup: FilterGroup) => {
		setFilters({
			...filters,
			groups: filters.groups.map((g) => (g.id === groupId ? updatedGroup : g)),
		});
	};

	const handleToggleEnabled = () => {
		setFilters({
			...filters,
			enabled: !filters.enabled,
		});
	};

	const handleMatchTypeChange = (matchType: "All" | "Any") => {
		setFilters({
			...filters,
			matchType,
		});
	};

	return (
		<div
			ref={popoverRef}
			className="task-filter-popover"
			style={{
				position: "fixed",
				zIndex: 1000,
				background: "var(--background-primary)",
				border: "1px solid var(--background-modifier-border)",
				borderRadius: "8px",
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
				padding: "16px",
				minWidth: "500px",
				maxHeight: "600px",
				overflowY: "auto",
			}}
		>
			<div className="task-filter-popover-header" style={{ marginBottom: "12px" }}>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Board Filters</h3>
					<button
						onClick={onClose}
						style={{
							background: "transparent",
							border: "none",
							cursor: "pointer",
							padding: "4px",
							display: "flex",
							alignItems: "center",
						}}
						aria-label="Close filters"
					>
						<X size={18} />
					</button>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
					<label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<input
							type="checkbox"
							checked={filters.enabled}
							onChange={handleToggleEnabled}
						/>
						<span>Enable filters</span>
					</label>

					{filters.enabled && filters.groups.length > 1 && (
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span>Match</span>
							<select
								value={filters.matchType}
								onChange={(e) => handleMatchTypeChange(e.target.value as "All" | "Any")}
								style={{
									padding: "4px 8px",
									borderRadius: "4px",
									border: "1px solid var(--background-modifier-border)",
									background: "var(--background-primary)",
								}}
							>
								<option value="All">All</option>
								<option value="Any">Any</option>
							</select>
							<span>filter groups</span>
						</div>
					)}
				</div>
			</div>

			{filters.enabled && (
				<div className="task-filter-popover-body">
					{filters.groups.length === 0 ? (
						<div
							style={{
								padding: "24px",
								textAlign: "center",
								color: "var(--text-muted)",
							}}
						>
							No filters added. Click "Add filter group" to create one.
						</div>
					) : (
						filters.groups.map((group, index) => (
							<div key={group.id}>
								{index > 0 && (
									<div
										style={{
											textAlign: "center",
											margin: "12px 0",
											color: "var(--text-muted)",
											fontSize: "12px",
											fontWeight: 600,
										}}
									>
										{filters.matchType.toUpperCase()}
									</div>
								)}
								<FilterGroupComponent
									plugin={plugin}
									group={group}
									onUpdate={(updatedGroup) => handleUpdateGroup(group.id, updatedGroup)}
									onDelete={() => handleDeleteGroup(group.id)}
								/>
							</div>
						))
					)}

					<button
						onClick={handleAddFilterGroup}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							padding: "8px 12px",
							marginTop: "12px",
							background: "transparent",
							border: "1px dashed var(--background-modifier-border)",
							borderRadius: "4px",
							cursor: "pointer",
							width: "100%",
							justifyContent: "center",
							color: "var(--text-muted)",
						}}
					>
						<Plus size={16} />
						<span>Add filter group</span>
					</button>
				</div>
			)}

			<div
				style={{
					marginTop: "16px",
					paddingTop: "12px",
					borderTop: "1px solid var(--background-modifier-border)",
					display: "flex",
					justifyContent: "flex-end",
					gap: "8px",
				}}
			>
				<button
					onClick={onClose}
					style={{
						padding: "8px 16px",
						background: "transparent",
						border: "1px solid var(--background-modifier-border)",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Cancel
				</button>
				<button
					onClick={handleSave}
					style={{
						padding: "8px 16px",
						background: "var(--interactive-accent)",
						color: "var(--text-on-accent)",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Apply Filters
				</button>
			</div>
		</div>
	);
};
