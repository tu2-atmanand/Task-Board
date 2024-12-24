<script>
	import { onMount, onDestroy } from "svelte";
	import AddColumnModal from "./AddColumnModal.svelte";
	import DeleteConfirmationModal from "./DeleteConfirmationModal.svelte";
	import {
		DragDropContext,
		Draggable,
		Droppable,
	} from "svelte-beautiful-dnd";
	import { EyeIcon, EyeOffIcon } from "lucide-svelte";
	import { RxDragHandleDots2 } from "svelte-icons/rx";
	import { FaTrash } from "svelte-icons/fa";
	import { t } from "../utils/lang/helper";
	import { SettingsManager } from "../settings/TaskBoardSettingConstructUI";

	export let app;
	export let plugin;
	export let boards = [];
	export let activeBoardIndex;
	export let onSave;
	export let onClose;

	let localBoards = JSON.parse(JSON.stringify(boards));
	let selectedBoardIndex = activeBoardIndex;
	let isAddColumnModalOpen = false;
	let globalSettingsHTMLSection;

	const settingManager = new SettingsManager(app, plugin);

	const handleBoardNameChange = (index, newName) => {
		localBoards = localBoards.map((board, i) =>
			i === index ? { ...board, name: newName } : board,
		);
	};

	const handleColumnChange = (boardIndex, columnIndex, field, value) => {
		localBoards[boardIndex].columns[columnIndex].data[field] = value;
		localBoards = [...localBoards];
	};

	const handleFiltersChange = (boardIndex, value) => {
		localBoards[boardIndex].filters = value
			.split(",")
			.map((tag) => tag.trim());
		localBoards = [...localBoards];
	};

	const handleFilterPolarityChange = (boardIndex, value) => {
		localBoards[boardIndex].filterPolarity = value;
		localBoards = [...localBoards];
	};

	const handleToggleChange = (boardIndex, field, value) => {
		localBoards[boardIndex][field] = value;
		localBoards = [...localBoards];
	};

	const handleAddColumn = (columnData) => {
		localBoards[activeBoardIndex].columns.push({
			colType: columnData.colType,
			active: columnData.active,
			collapsed: false,
			data: {
				name: columnData.name,
				index: localBoards[activeBoardIndex].columns.length + 1,
			},
		});
		isAddColumnModalOpen = false;
		localBoards = [...localBoards];
	};

	const deleteColumnFromBoard = (boardIndex, columnIndex) => {
		localBoards[boardIndex].columns.splice(columnIndex, 1);
		localBoards = [...localBoards];
	};

	const deleteCurrentBoard = () => {
		if (selectedBoardIndex !== -1) {
			localBoards.splice(selectedBoardIndex, 1);
			selectedBoardIndex = -1;
			localBoards = [...localBoards];
		}
	};

	const onDragEnd = (result) => {
		if (!result.destination) return;
		const [movedColumn] = localBoards[selectedBoardIndex].columns.splice(
			result.source.index,
			1,
		);
		localBoards[selectedBoardIndex].columns.splice(
			result.destination.index,
			0,
			movedColumn,
		);
		localBoards[selectedBoardIndex].columns.forEach(
			(col, idx) => (col.data.index = idx + 1),
		);
		localBoards = [...localBoards];
	};

	const toggleActiveState = (boardIndex, columnIndex) => {
		localBoards[boardIndex].columns[columnIndex].active =
			!localBoards[boardIndex].columns[columnIndex].active;
		localBoards = [...localBoards];
	};

	const handleSave = () => {
		onSave(localBoards);
		onClose();
	};

	const renderBoardSettings = (boardIndex) => {
		const board = localBoards[boardIndex];
		return board;
	};

	const renderGlobalSettingsTab = () => {
		settingManager.constructUI(globalSettingsHTMLSection, t(36));
	};

	onMount(() => {
		if (selectedBoardIndex === -1) {
			renderGlobalSettingsTab();
		}
	});

	onDestroy(() => {
		settingManager.cleanUp();
	});
</script>

<div class="boardConfigModalHome">
	<div class="boardConfigModalSidebar">
		<div
			class="boardConfigModalSidebarBtnAreaGlobal"
			on:click={() => (selectedBoardIndex = -1)}
		>
			{t(58)}
		</div>

		<hr class="boardConfigModalHr-100" />

		{#each localBoards as board, index}
			<div
				on:click={() => (selectedBoardIndex = index)}
				class="boardConfigModalSidebarBtnArea-btn"
			>
				{board.name}
			</div>
		{/each}

		<button
			class="boardConfigModalSidebarBtnAreaAddBoard"
			on:click={() => {
				localBoards = [
					...localBoards,
					{
						name: `Board ${localBoards.length + 1}`,
						index: localBoards.length + 1,
						columns: [],
					},
				];
			}}
		>
			{t(59)}
		</button>

		<hr class="boardConfigModalHr-100" />

		<button class="boardConfigModalSidebarSaveBtn" on:click={handleSave}>
			{t(1)}
		</button>
	</div>

	<DragDropContext {onDragEnd}>
		<div class="boardConfigModalMainContent">
			{selectedBoardIndex === -1
				? renderGlobalSettingsTab()
				: renderBoardSettings(selectedBoardIndex)}
		</div>
	</DragDropContext>
</div>

<AddColumnModal
	bind:isOpen={isAddColumnModalOpen}
	on:submit={handleAddColumn}
	on:close={() => (isAddColumnModalOpen = false)}
/>

<DeleteConfirmationModal on:confirm={deleteCurrentBoard} on:cancel={() => {}} />
