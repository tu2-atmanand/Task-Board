// /src/modals/SwimlanesConfigModal.tsx

import React, { useState } from 'react';
import { Modal, App } from 'obsidian';
import ReactDOM from "react-dom/client";
import TaskBoard from 'main';
import { t } from 'src/utils/lang/helper';

interface SwimlaneConfig {
	enabled: boolean;
	showEmptySwimlanes: boolean;
	property: string;
	customValue?: string;
	sortCriteria: string;
	customSortOrder?: { value: string; index: number }[];
}

interface SwimlanesConfigModalProps {
	swimlaneConfig: SwimlaneConfig;
	onSave: (config: SwimlaneConfig) => void;
	onCancel: () => void;
}

const SwimlanesConfigContent: React.FC<SwimlanesConfigModalProps> = ({
	swimlaneConfig,
	onSave,
	onCancel,
}) => {
	const [enabled, setEnabled] = useState(swimlaneConfig.enabled);
	const [property, setProperty] = useState(swimlaneConfig.property || 'tags');
	const [customValue, setCustomValue] = useState(swimlaneConfig.customValue || '');
	const [sortCriteria, setSortCriteria] = useState(swimlaneConfig.sortCriteria || 'asc');
	const [showEmptySwimlanes, setShowEmptySwimlanes] = useState(
		swimlaneConfig.showEmptySwimlanes ?? true
	);

	const handleSave = () => {
		const updatedConfig: SwimlaneConfig = {
			enabled,
			showEmptySwimlanes,
			property,
			customValue: customValue || undefined,
			sortCriteria,
			customSortOrder: swimlaneConfig.customSortOrder,
		};
		onSave(updatedConfig);
	};

	// Available swimlane properties
	const propertyOptions = [
		{ value: 'tags', label: t('tags') || 'Tags' },
		{ value: 'priority', label: t('priority') || 'Priority' },
		{ value: 'status', label: t('status') || 'Status' },
		{ value: 'project', label: t('project') || 'Project' },
		{ value: 'context', label: t('context') || 'Context' },
		{ value: 'custom', label: t('custom') || 'Custom' },
	];

	const sortOptions = [
		{ value: 'asc', label: t('ascending') || 'Ascending' },
		{ value: 'desc', label: t('descending') || 'Descending' },
		{ value: 'custom', label: t('custom') || 'Custom' },
	];

	return (
		<div className="swimlanesConfigContent">
			<div className="swimlanesConfigSection">
				<h2>{t('configure-kanban-swimlanes') || 'Configure Kanban Swimlanes'}</h2>

				{/* Enable/Disable Swimlanes */}
				<div className="swimlanesConfigItem">
					<div className="swimlanesConfigLabel">
						<label>{t('enable-swimlanes') || 'Enable Swimlanes'}</label>
						<div className="swimlanesConfigDescription">
							{t('enable-swimlanes-info') || 'Divide the board into horizontal sections'}
						</div>
					</div>
					<input
						type="checkbox"
						checked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
					/>
				</div>

				{enabled && (
					<>
						{/* Property Selection */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>{t('swimlane-property') || 'Swimlane Property'}</label>
								<div className="swimlanesConfigDescription">
									{t('swimlane-property-info') ||
										'Select the property to group tasks by'}
								</div>
							</div>
							<select
								value={property}
								onChange={(e) => setProperty(e.target.value)}
								className="swimlanesConfigSelect"
							>
								{propertyOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						{/* Custom Value (only shown if property is 'custom') */}
						{property === 'custom' && (
							<div className="swimlanesConfigItem">
								<div className="swimlanesConfigLabel">
									<label>
										{t('custom-property-key') || 'Custom Property Key'}
									</label>
									<div className="swimlanesConfigDescription">
										{t('custom-property-key-info') ||
											'Enter the custom frontmatter key to use for swimlanes'}
									</div>
								</div>
								<input
									type="text"
									placeholder={t('e-g-custom-key') || 'e.g., custom-key'}
									value={customValue}
									onChange={(e) => setCustomValue(e.target.value)}
									className="swimlanesConfigInput"
								/>
							</div>
						)}

						{/* Sort Criteria */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>{t('swimlane-sort-order') || 'Sort Order'}</label>
								<div className="swimlanesConfigDescription">
									{t('swimlane-sort-order-info') ||
										'How to sort the swimlanes'}
								</div>
							</div>
							<select
								value={sortCriteria}
								onChange={(e) => setSortCriteria(e.target.value)}
								className="swimlanesConfigSelect"
							>
								{sortOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						{/* Show Empty Swimlanes */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>
									{t('show-empty-swimlanes') || 'Show Empty Swimlanes'}
								</label>
								<div className="swimlanesConfigDescription">
									{t('show-empty-swimlanes-info') ||
										'Display swimlanes even if they have no tasks'}
								</div>
							</div>
							<input
								type="checkbox"
								checked={showEmptySwimlanes}
								onChange={(e) => setShowEmptySwimlanes(e.target.checked)}
							/>
						</div>
					</>
				)}
			</div>

			{/* Action Buttons */}
			<div className="swimlanesConfigButtonsContainer">
				<button
					className="swimlanesConfigBtn swimlanesConfigBtnCancel"
					onClick={onCancel}
				>
					{t('cancel') || 'Cancel'}
				</button>
				<button
					className="swimlanesConfigBtn swimlanesConfigBtnSave"
					onClick={handleSave}
				>
					{t('save') || 'Save'}
				</button>
			</div>
		</div>
	);
};

export class SwimlanesConfigModal extends Modal {
	root: ReactDOM.Root | null = null;
	swimlaneConfig: SwimlaneConfig;
	onSave: (config: SwimlaneConfig) => void;

	constructor(
		app: App,
		swimlaneConfig: SwimlaneConfig,
		onSave: (config: SwimlaneConfig) => void
	) {
		super(app);
		this.swimlaneConfig = swimlaneConfig;
		this.onSave = onSave;
		this.modalEl.classList.add('swimlanes-config-modal');
	}

	onOpen() {
		const { contentEl } = this;
		this.root = ReactDOM.createRoot(contentEl);
		this.root.render(
			<SwimlanesConfigContent
				swimlaneConfig={this.swimlaneConfig}
				onSave={(config) => {
					this.onSave(config);
					this.close();
				}}
				onCancel={() => this.close()}
			/>
		);
	}

	onClose() {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
