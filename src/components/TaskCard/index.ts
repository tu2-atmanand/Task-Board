/**
 * This folder consists of variations of the TaskCard designs.
 *
 * 1. TaskItem - This shows the properties in the Tasks plugin emoji format, with all the properties arranged as pills.
 * 2. TaskitemV2 - This provides more of a Bases cards kind of view, where the properties are shown as key-value pair in a list format inside the footer of the Task Card.
 * 3. createTaskCard - A function which basically returns an HTML DOM element with the emoji format UI. This DOM element dont have any interactive elements inside it. Its an simple element only for rendering/viewing purposes.
 */

import TaskItem from "./TaskItem.js";
import TaskItemV2 from "./TaskItemV2.js";
import createTaskCard from "./TaskCardImage.js";


export { TaskItem, TaskItemV2, createTaskCard };
