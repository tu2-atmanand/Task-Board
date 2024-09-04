// utils/RefreshColumns.ts

import fs from "fs";
import path from "path";

interface Task {
	id: number;
	body: string;
	due: string;
	tag: string;
	filePath: string;
	status: string;
}

// utils/taskUtils.ts

export const loadTasksFromJson = (): { allTasksWithStatus: Task[], pendingTasks: Task[], completedTasks: Task[] } => {
  const basePath = (window as any).app.vault.adapter.basePath;
  const tasksPath = path.join(basePath, '.obsidian', 'plugins', 'Task-Board', 'tasks.json');

  try {
    if (fs.existsSync(tasksPath)) {
      const tasksData = fs.readFileSync(tasksPath, 'utf8');
      const allTasks = JSON.parse(tasksData);

      const pendingTasks: Task[] = [];
      const completedTasks: Task[] = [];

      // Separate pending tasks
      for (const [filePath, tasks] of Object.entries(allTasks.Pending || {})) {
        tasks.forEach((task: any) => pendingTasks.push({ ...task, filePath }));
      }

      // Separate completed tasks
      for (const [filePath, tasks] of Object.entries(allTasks.Completed || {})) {
        tasks.forEach((task: any) => completedTasks.push({ ...task, filePath }));
      }

      // Combine both pending and completed tasks
      const allTasksWithStatus = [...pendingTasks, ...completedTasks];
      return { allTasksWithStatus, pendingTasks, completedTasks };
    } else {
      console.warn("tasks.json file not found.");
      return { allTasksWithStatus: [], pendingTasks: [], completedTasks: [] };
    }
  } catch (error) {
    console.error("Error reading tasks.json:", error);
    return { allTasksWithStatus: [], pendingTasks: [], completedTasks: [] };
  }
};
