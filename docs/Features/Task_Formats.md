# Task Formats

This plugin only works for a specific type of tasks, which are in a particular format.

## The Checkbox Patter

Obsidian supports three types of pattern to create a checkbox or in other words a task item as shown below  :
```md
- [ ] 
+ [ ] 
* [ ] 
```

But this plugin only works for the first kind of checkbox or detects any line as task, if it starts with the following patter :
```md
- [ ] 
```

So, if you want the plugin to not detect any of your task and consider the task as normal text, then you can use the other types of formats. This even works for sub-task. Any sub-tasks with the patter other than supported by this plugin, will be considered as a description content for the task and will be shown under the Description section and not as a sub-task.

## Sub Tasks


## Task Description


