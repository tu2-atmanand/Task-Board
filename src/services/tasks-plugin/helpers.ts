// /src/services/tasks-plugin/helpers.ts

import { TasksPluginApi } from "./api";
import { bugReporter } from "../OpenModals";
import TaskBoard from "main";
import { taskItem } from "src/interfaces/TaskItem";
import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "src/utils/taskLine/TaskContentFormatter";
import { replaceOldTaskWithNewTask } from "src/utils/taskLine/TaskLineUtils";
import { CustomStatus } from "src/interfaces/GlobalSettings";
import { eventEmitter } from "../EventEmitter";

export async function fetchTasksPluginCustomStatuses(plugin: TaskBoard) {
	try {
		const tasksPluginO = new TasksPluginApi(plugin);
		console.log(
			"Tasks Plugin API:",
			tasksPluginO,
			"\nIs tasks plugin enabled?",
			tasksPluginO.isTasksPluginEnabled()
		);
		// if( plugin.app.plugins.getPlugin("obsidian-tasks-plugin")) {
		if (tasksPluginO.isTasksPluginEnabled()) {
			// Define the path to the tasks plugin data.json file
			const path = `${plugin.app.vault.configDir}/plugins/obsidian-tasks-plugin/data.json`;

			// Read the file content
			const data: string = await plugin.app.vault.adapter.read(path);
			const parsedData = JSON.parse(data);

			// Extract coreStatuses from the JSON
			const coreStatuses: CustomStatus[] =
				parsedData?.statusSettings?.coreStatuses || [];

			// Extract customStatuses from the JSON
			const customStatuses: CustomStatus[] =
				parsedData?.statusSettings?.customStatuses || [];

			const statusMap = new Map();
			coreStatuses.forEach((status: CustomStatus) =>
				statusMap.set(status.symbol, status)
			);
			customStatuses.forEach((status: CustomStatus) =>
				statusMap.set(status.symbol, status)
			);
			const statuses: CustomStatus[] = Array.from(statusMap.values());

			// console.log(
			// 	"Fetched custom statuses from tasks plugin:",
			// 	statuses,
			// 	"\nTask Board old statuses:",
			// 	plugin.settings.data.globalSettings.tasksPluginCustomStatuses,
			// 	"\nCondition :",
			// 	JSON.stringify(
			// 		plugin.settings.data.globalSettings
			// 			.tasksPluginCustomStatuses
			// 	) !== JSON.stringify(statuses)
			// );

			// Store it in the plugin settings if there is a difference
			if (
				JSON.stringify(
					plugin.settings.data.globalSettings
						.tasksPluginCustomStatuses
				) !== JSON.stringify(statuses)
			) {
				plugin.settings.data.globalSettings.tasksPluginCustomStatuses =
					statuses;
				await plugin.saveSettings(plugin.settings);
			}
		}
	} catch (error) {
		console.warn(
			"Error fetching custom statuses from tasks plugin:",
			error
		);
	}
}

export async function openTasksPluginEditModal(
	plugin: TaskBoard,
	oldTask: taskItem
) {
	try {
		const tasksPlugin = new TasksPluginApi(plugin);
		// Prepare the updated task block
		const completeOldTaskContent = await getFormattedTaskContent(oldTask);
		if (completeOldTaskContent === "")
			throw "getSanitizedTaskContent returned empty string";

		if (tasksPlugin.isTasksPluginEnabled()) {
			const tasksPluginApiOutput = await tasksPlugin.editTaskLineModal(
				completeOldTaskContent
			);

			if (!tasksPluginApiOutput) {
				bugReporter(
					plugin,
					"Tasks plugin API did not return any output.",
					"Tasks plugin API did not return any output.",
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
				);
				return;
			}

			const twoTaskTitles = tasksPluginApiOutput.split("\n");
			// console.log(
			// 	"useTasksPluginToUpdateInFile : tasksPluginApiOutput :\n",
			// 	tasksPluginApiOutput,
			// 	"\n| first line :",
			// 	twoTaskTitles[0],
			// 	"\n| second line :",
			// 	twoTaskTitles[1],
			// 	"\n| Old task :",
			// 	completeOldTaskContent
			// );
			let newContent = "";
			if (tasksPluginApiOutput === "") {
				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent
				);
			} else if ((twoTaskTitles.length = 1)) {
				const { formattedTaskContent, newId } =
					await addIdToTaskContent(plugin, tasksPluginApiOutput);
				const tasksPluginApiOutputWithId = formattedTaskContent;
				newContent = `${tasksPluginApiOutputWithId}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}`;
				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent
				);
			} else if ((twoTaskTitles.length = 2)) {
				newContent = `${twoTaskTitles[0]}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}\n${twoTaskTitles[1]}${
					oldTask.body.length > 0
						? `\n${oldTask.body.join("\n")}`
						: ""
				}`;

				await replaceOldTaskWithNewTask(
					plugin,
					oldTask,
					completeOldTaskContent,
					newContent
				);
			} else {
				bugReporter(
					plugin,
					"Unexpected output from tasks plugin API. Since the task you are trying to update is a recurring task, Task Board cannot handle recurring tasks as of now and Tasks plugin didnt returned an expected output. Please report this issue so developers can enhance the integration.",
					`Input to tasksPluginApi : ${completeOldTaskContent}\n Output of tasksPluginApi: ${tasksPluginApiOutput}`,
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
				);
				return;
			}

			plugin.realTimeScanning.processAllUpdatedFiles(oldTask.filePath);
			setTimeout(() => {
				// This event emmitter will stop any loading animation of ongoing task-card.
				eventEmitter.emit("UPDATE_TASK", {
					taskID: oldTask.id,
					state: false,
				});
			}, 500);

			// Just to scan the file after updating.
			// plugin.fileUpdatedUsingModal = "";
			// const scannVault = new vaultScanner(plugin.app, plugin);
			// const file = plugin.app.vault.getAbstractFileByPath(filePath);
			// if (file && file instanceof TFile)
			// 	scannVault.refreshTasksFromFiles([file]);
			// eventEmitter.emit("REFRESH_COLUMN");
		} else {
			//fallback to normal function
			// await updateTaskInFile(plugin, updatedTask, oldTask);

			bugReporter(
				plugin,
				"Tasks plugin is must for handling recurring tasks. Since the task you are trying to update is a recurring task and Task Board cannot handle recurring tasks as of now. Hence the plugin has not updated your content.",
				`Tasks plugin installed and enabled: ${tasksPlugin.isTasksPluginEnabled()}`,
				"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
			);
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error while updating the recurring task in the file. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
			String(error),
			"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
		);
		throw error;
	}
}
