<script>
	import { onMount, onDestroy } from "svelte";
	import { MarkdownUIRenderer } from "../services/MarkdownUIRenderer";
	import { scanFilterForFilesNFolders } from "../utils/FiltersVerifier";
	import { t } from "../utils/lang/helper";
	import { taskElementsFormatter } from "../utils/TaskItemUtils";
	import ScanningVault from "../utils/ScanningVault";

	export let app;
	export let plugin;

	let scanningVault = new ScanningVault(app, plugin);
	let isRunning = false;
	let terminalOutput = [];
	let progress = 0;
	let showCollectedTasks = false;
	let collectedTasks = { Pending: {}, Completed: {} };
	let taskRendererRef = {};

	const runScan = async () => {
		isRunning = true;
		const files = app.vault.getMarkdownFiles();
		progress = 0; // Reset progress

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			const scanFilters = plugin.settings.data.globalSettings.scanFilters;
			if (scanFilterForFilesNFolders(file, scanFilters)) {
				terminalOutput = [
					...terminalOutput,
					`Scanning file: ${file.path}`,
				];
				await scanningVault.extractTasksFromFile(
					file,
					scanningVault.tasks,
					scanFilters,
				);
			}

			progress = ((i + 1) / files.length) * 100; // Update progress
		}

		collectedTasks = scanningVault.tasks;
		new Notice(t(64));
		scanningVault.saveTasksToFile();
	};

	const toggleView = () => {
		showCollectedTasks = !showCollectedTasks;
	};

	onMount(() => {
		// Set up component-related initialization here if needed
	});

	onDestroy(() => {
		// Clean up resources if necessary
	});

	$: if (showCollectedTasks) {
		Object.keys(collectedTasks.Pending).forEach((filePath) => {
			const tasks = collectedTasks.Pending[filePath];
			tasks.forEach((task, taskIndex) => {
				const newTaskContent = {
					...task,
					title: task.title,
					body: task.body,
					due: task.due,
					tags: task.tags,
					time: task.time,
					priority: task.priority,
				};

				const formattedContent = taskElementsFormatter(
					plugin,
					newTaskContent,
				);

				const uniqueKey = `${filePath}-task-${taskIndex}`;
				const descElement = taskRendererRef[uniqueKey];

				if (descElement && formattedContent !== "") {
					descElement.innerHTML = "";
					MarkdownUIRenderer.renderTaskDisc(
						app,
						formattedContent,
						descElement,
						task.filePath,
						null,
					);
				}
			});
		});
	}
</script>

<div class="scanVaultModalHome">
	<h2>{t(65)}</h2>
	<p>{t(66)}</p>
	<p>{t(67)}</p>
	<p>{t(68)}</p>

	<div class="scanVaultModalHomeSecondSection">
		<div class="scanVaultModalHomeSecondSectionProgressBarContainer">
			<progress
				max="100"
				value={progress}
				style="width: 100%; height: 35px;"
			></progress>
		</div>
		<button
			class="scanVaultModalHomeSecondSectionButton"
			on:click={runScan}
			disabled={isRunning}
		>
			{isRunning ? progress.toFixed(0) : t(69)}
		</button>
	</div>

	<div class="scanVaultModalHomeThirdSection">
		<div
			class={`scanVaultModalHomeTerminal ${
				showCollectedTasks
					? "scanVaultModalHomeTerminalSlideOut"
					: "scanVaultModalHomeTerminalSlideIn"
			}`}
		>
			{#each terminalOutput as line, index}
				<div key={index}>{line}</div>
			{/each}
		</div>

		<div
			class={`scanVaultModalHomeTasksCollected ${
				showCollectedTasks ? "slideIn" : "slideOut"
			}`}
		>
			{#each Object.keys(collectedTasks.Pending) as filePath, index}
				<div key={index}>
					<h3>{filePath}</h3>
					<div>
						{#each collectedTasks.Pending[filePath] as task, taskIndex}
							<div key={taskIndex}>
								<div
									bind:this={taskRendererRef[
										`${filePath}-task-${taskIndex}`
									]}
									id={`${filePath}-task-${taskIndex}`}
								></div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<button class="scanVaultModalHomeToggleButton" on:click={toggleView}>
		{showCollectedTasks ? t(70) : t(71)}
	</button>
</div>
