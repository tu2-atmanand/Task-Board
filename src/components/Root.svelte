<!-- /src/components/Root.svelte -->

<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { eventEmitter } from "src/services/EventEmitter";
	import { openBoardConfigModal } from "../services/OpenModals";
	import { t } from "src/utils/lang/helper";
	import Column from "src/components/Column.svelte";
	import { Bolt, RefreshCcw, Tally1 } from "lucide-svelte";

	import type { Board } from "../interfaces/BoardConfigs";
	import type {
		taskItem,
		taskJsonMerged,
	} from "src/interfaces/TaskItemProps";
	import store, {
		allTasksMerged,
		app,
		boardConfigs,
		plugin,
	} from "src/store";
	import { BoardConfigureModal } from "src/modal/BoardConfigModal";
	import { saveBoardsData } from "src/utils/JsonFileOperations";

	let allTasks: taskJsonMerged | undefined = $state($allTasksMerged);
	let boards: Board[] = $state($boardConfigs);
	let activeBoardIndex = $state(0);

	const refreshBoardButton = () => {
		if ($plugin.settings.data.globalSettings.realTimeScanning) {
			// eventEmitter.emit("REFRESH_BOARD");
			store.refreshSignal.set(true);
		} else {
			if (
				localStorage.getItem("taskBoardFileStack")?.at(0) !== undefined
			) {
				$plugin.realTimeScanning.processStack();
			}
			// eventEmitter.emit("REFRESH_BOARD");
			store.refreshSignal.set(true);
		}
	};

	onMount(() => {
		console.log(
			"Root component : reading allTasksMerged store variable :",
			$allTasksMerged,
		);
		// const refreshColumnListener = async () => {
		// 	try {
		// 		const loadedTasks = loadTasksAndMerge();
		// 		if (loadedTasks) {
		// 			allTasks = loadedTasks;
		// 		}
		// 	} catch (error) {
		// 		console.error("Error loading tasks:", error);
		// 	}
		// };

		// eventEmitter.on("REFRESH_BOARD", refreshBoardListener);
		// eventEmitter.on("REFRESH_COLUMN", refreshColumnListener);

		// refreshBoardData(setBoards, async () => {
		// 	try {
		// 		const data = await loadBoardsData();
		// 		boards = data;
		// 		const loadedTasks = loadTasksAndMerge();
		// 		if (loadedTasks) allTasks = loadedTasks;
		// 	} catch (error) {
		// 		console.error("Error loading tasks:", error);
		// 	}
		// });

		return () => {
			// eventEmitter.off("REFRESH_BOARD", refreshBoardListener);
			// eventEmitter.off("REFRESH_COLUMN", refreshColumnListener);
		};
	});

	function setBoards(updatedBoards: Board[]) {
		boards = updatedBoards;
	}

	function openBoardConfigureModal() {
		// openBoardConfigModal($ap, $plugin,)
		console.log("This will open Board Configure Modal...");
		const modal = new BoardConfigureModal(
			$app,
			boards,
			activeBoardIndex,
			(updatedBoards) => saveBoardsData(updatedBoards),
		);
		modal.open();
	}
</script>

<div class="kanbanBoard">
	<div class="kanbanHeader">
		<div class="boardTitles">
			{#each boards as board, index}
				<button
					class={`boardTitleButton${
						index === activeBoardIndex ? "Active" : ""
					}`}
					onclick={() => (activeBoardIndex = index)}
				>
					{board.name}
				</button>
			{/each}
		</div>
		<div class="kanbanHeaderBtns">
			<Tally1 class="kanbanHeaderBtnsSeparator" />
			<button
				class="ConfigureBtn"
				aria-label={t(145)}
				onclick={openBoardConfigureModal}
			>
				<Bolt size={20} />
			</button>
			<button
				class="RefreshBtn"
				aria-label={t(146)}
				onclick={refreshBoardButton}
			>
				<RefreshCcw size={20} />
			</button>
		</div>
	</div>
	<div class="columnsContainer">
		{#if boards[activeBoardIndex]}
			{#each boards[activeBoardIndex].columns.filter((column) => column.active) as column, index}
				<Column
					columnIndex={index}
					{activeBoardIndex}
					colType={column.colType}
					data={column.data}
				/>
			{/each}
		{/if}
	</div>
</div>
