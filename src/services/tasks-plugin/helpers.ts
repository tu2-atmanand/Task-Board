import { Notice } from "obsidian";
import { TasksPluginApi } from "./api";
import { bugReporter } from "../OpenModals";
import TaskBoard from "main";
import { taskItem } from "src/interfaces/TaskItem";
import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "src/utils/TaskContentFormatter";
import { replaceOldTaskWithNewTask } from "src/utils/TaskItemUtils";

export async function fetchTasksPluginCustomStatuses(plugin: TaskBoard) {
	try {
		const tasksPluginO = new TasksPluginApi(plugin);
		// if( plugin.app.plugins.getPlugin("obsidian-tasks-plugin")) {
		if (tasksPluginO.isTasksPluginEnabled()) {
			// Define the path to the tasks plugin data.json file
			const path = `${plugin.app.vault.configDir}/plugins/obsidian-tasks-plugin/data.json`;

			// Read the file content
			const data: string = await plugin.app.vault.adapter.read(path);
			const parsedData = JSON.parse(data);

			// Extract customStatuses from the JSON
			const customStatuses =
				parsedData?.statusSettings?.customStatuses || [];

			// Store it in the plugin settings
			plugin.settings.data.globalSettings.tasksPluginCustomStatuses =
				customStatuses;
			plugin.saveSettings();
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
