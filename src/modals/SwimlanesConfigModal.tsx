// /src/modals/SwimlanesConfigModal.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Modal, App, BooleanValue } from 'obsidian';
import ReactDOM from "react-dom/client";
import TaskBoard from 'main';
import { t } from 'src/utils/lang/helper';
import Sortable from 'sortablejs';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { FaTrash } from 'react-icons/fa';
import { swimlaneConfigs } from 'src/interfaces/BoardConfigs';

interface SwimlanesConfigModalProps {
	swimlaneConfig: swimlaneConfigs;
	onSave: (config: swimlaneConfigs) => void;
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
	const [hideEmptySwimlanes, setHideEmptySwimlanes] = useState(
		swimlaneConfig.hideEmptySwimlanes ?? false
	);
	const [customSortOrder, setCustomSortOrder] = useState<{ value: string; index: number }[]>(
		swimlaneConfig.customSortOrder || []
	);
	const [maxHeight, setmaxHeight] = useState(swimlaneConfig.maxHeight || '300px');
	const [groupAllRest, setGroupAllRest] = useState(swimlaneConfig.groupAllRest);
	const [verticalHeaderUI, setVerticalHeaderUI] = useState(swimlaneConfig.verticalHeaderUI || false);

	const sortableListRef = useRef<HTMLDivElement | null>(null);
	const sortableInstanceRef = useRef<any>(null);

	// Initialize Sortable for custom sort order
	useEffect(() => {
		if (sortCriteria === 'custom' && sortableListRef.current) {
			if (sortableInstanceRef.current) {
				sortableInstanceRef.current.destroy();
			}

			sortableInstanceRef.current = Sortable.create(sortableListRef.current, {
				animation: 150,
				handle: '.swimlanesConfigSortRowDragHandle',
				ghostClass: 'swimlanesConfigSortRowGhost',
				chosenClass: 'swimlanesConfigSortRowChosen',
				dragClass: 'swimlanesConfigSortRowDrag',
				onEnd: (evt) => {
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					const newOrder = [...customSortOrder];
					const [movedItem] = newOrder.splice(evt.oldIndex, 1);
					newOrder.splice(evt.newIndex, 0, movedItem);

					// Update indexes
					const updatedOrder = newOrder.map((item, idx) => ({
						...item,
						index: idx + 1,
					}));

					setCustomSortOrder(updatedOrder);
				},
			});
		}

		return () => {
			if (sortableInstanceRef.current) {
				sortableInstanceRef.current.destroy();
				sortableInstanceRef.current = null;
			}
		};
	}, [sortCriteria, customSortOrder.length]);

	const handleSave = () => {
		const updatedConfig: swimlaneConfigs = {
			enabled,
			hideEmptySwimlanes,
			property,
			maxHeight,
			customValue: customValue || undefined,
			sortCriteria,
			customSortOrder: sortCriteria === 'custom' ? customSortOrder : undefined,
			groupAllRest,
			verticalHeaderUI,
			minimized: []
		};
		onSave(updatedConfig);
	};

	const handleAddSortRow = () => {
		const newIndex = customSortOrder.length + 1;
		setCustomSortOrder([
			...customSortOrder,
			{ value: '', index: newIndex },
		]);
	};

	const handleRemoveSortRow = (rowIndex: number) => {
		const updatedOrder = customSortOrder
			.filter((_, idx) => idx !== rowIndex)
			.map((item, idx) => ({
				...item,
				index: idx + 1,
			}));
		setCustomSortOrder(updatedOrder);
	};

	const handleSortRowValueChange = (rowIndex: number, newValue: string) => {
		const updatedOrder = [...customSortOrder];
		updatedOrder[rowIndex].value = newValue;
		setCustomSortOrder(updatedOrder);
	};

	// Available swimlane properties
	const propertyOptions = [
		{ value: 'tags', label: t('tags') },
		{ value: 'priority', label: t('priority') },
		{ value: 'status', label: t('status') },
		// { value: 'scheduledDate', label: t('scheduled-date')},
		{ value: 'custom', label: t('custom-property') },
	];

	const sortOptions = [
		{ value: 'asc', label: t('ascending') },
		{ value: 'desc', label: t('descending') },
		{ value: 'custom', label: t('custom-sorting') },
	];

	return (
		<div className="swimlanesConfigContent">
			<div className="swimlanesConfigSection">
				<h2>{t("configure-kanban-swimlanes")}</h2>

				{/* Enable/Disable Swimlanes */}
				<div className="swimlanesConfigItem">
					<div className="swimlanesConfigLabel">
						<label>{t("enable-swimlanes")}</label>
						<div className="swimlanesConfigDescription">
							{t("enable-swimlanes-info-1")}
							<br />
							{t("enable-swimlanes-info-2")}
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
								<label>{t('task-property')}</label>
								<div className="swimlanesConfigDescription">
									{t('task-property-info')}
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
										{t('custom-property-key')}
									</label>
									<div className="swimlanesConfigDescription">
										{t('custom-property-key-info')}
									</div>
								</div>
								<input
									type="text"
									placeholder={'e.g.: project'}
									value={customValue}
									onChange={(e) => setCustomValue(e.target.value)}
									className="swimlanesConfigInput"
								/>
							</div>
						)}

						{/* Set custom min swimlane height */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>
									{t('max-swimlane-height')}
								</label>
								<div className="swimlanesConfigDescription">
									{t('max-swimlane-height-info')}
								</div>
							</div>
							<input
								type="text"
								placeholder={'Default is 300px'}
								value={maxHeight || '300px'}
								onChange={(e) => setmaxHeight(e.target.value)}
							/>
						</div>

						{/* Sort Criteria */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>{t('swimlane-sort-order')}</label>
								<div className="swimlanesConfigDescription">
									{t('swimlane-sort-order-info')}
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

						{/* Manual Sorting Mapping Section */}
						{sortCriteria === 'custom' && (
							<div className="swimlanesConfigManualSortSection">
								<h3 className="swimlanesConfigManualSortHeading">
									{t('manual-sorting-mapping')}
								</h3>
								<div className="swimlanesConfigManualSortDescription">
									{t('manual-sorting-mapping-info')}
								</div>

								<div className='swimlaneConfigsManualSortContainer'>
									{/* Sortable List */}
									<div
										ref={sortableListRef}
										className="swimlanesConfigSortRowsList"
									>
										{customSortOrder.map((sortRow, rowIndex) => (
											<div
												key={rowIndex}
												className="swimlanesConfigSortRow"
											>
												<RxDragHandleDots2
													className="swimlanesConfigSortRowDragHandle"
													size={16}
												/>
												<div className="swimlanesConfigSortRowIndex">
													{sortRow.index}
												</div>
												<input
													type="text"
													placeholder={t('enter-property-value')}
													value={sortRow.value}
													onChange={(e) =>
														handleSortRowValueChange(
															rowIndex,
															e.target.value
														)
													}
													className="swimlanesConfigSortRowInput"
												/>
												<FaTrash
													className="swimlanesConfigSortRowDeleteBtn"
													size={20}
													onClick={() => handleRemoveSortRow(rowIndex)}
													title={t('delete')}
												/>
											</div>
										))}
									</div>

									{/* Add Row Button */}
									<button
										className="swimlanesConfigAddSortRowBtn"
										onClick={handleAddSortRow}
									>
										{t('add-row')}
									</button>
								</div>

								{/* Hide Empty Swimlanes */}
								<div className="swimlanesConfigItem">
									<div className="swimlanesConfigLabel">
										<label>
											{t('hide-empty-swimlanes')}
										</label>
										<div className="swimlanesConfigDescription">
											{t('hide-empty-swimlanes-info')}
										</div>
									</div>
									<input
										type="checkbox"
										checked={hideEmptySwimlanes}
										onChange={(e) => setHideEmptySwimlanes(e.target.checked)}
									/>
								</div>

								{/* Enable/Disable groupAllRest */}
								<div className="swimlanesConfigItem">
									<div className="swimlanesConfigLabel">
										<label>{t('aggregator-swimlane')}</label>
										<div className="swimlanesConfigDescription">
											{t('aggregator-swimlane-info')}
										</div>
									</div>
									<input
										type="checkbox"
										checked={groupAllRest}
										onChange={(e) => setGroupAllRest(e.target.checked)}
									/>
								</div>
							</div>
						)}

						{/* Enable/Disable verticalSwimlaneHeader UI */}
						<div className="swimlanesConfigItem">
							<div className="swimlanesConfigLabel">
								<label>{'UI type : vertical swimlane header on left'}</label>
								<div className="swimlanesConfigDescription">
									{'Enable this setting to display the swimlane header as vertical bar on left.This is an experimental setting to get user feedback. This setting will be removed in the future and a common UI type will be selected based on the better ergonomic design and majority votes from the community.'}
								</div>
							</div>
							<input
								type="checkbox"
								checked={verticalHeaderUI}
								onChange={(e) => setVerticalHeaderUI(e.target.checked)}
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
		</div >
	);
};

export class SwimlanesConfigModal extends Modal {
	root: ReactDOM.Root | null = null;
	swimlaneConfig: swimlaneConfigs;
	onSave: (config: swimlaneConfigs) => void;

	constructor(
		app: App,
		swimlaneConfig: swimlaneConfigs,
		onSave: (config: swimlaneConfigs) => void
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
