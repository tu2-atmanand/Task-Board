# Filters for Scanning

These are the filters you can use while your whole Vault is getting scanned. You can use this filters, to restrict the plugin from scanning certain files and folder and also tasks which has specific tags. Or you can also tell the plugin to only scan specific files and folders and tasks with a specific tag on them.
There are three types of filters you can use, as explained below.

## Filters for Files

In the first row you will enter the names of the files, which you want to apply for filtering while scanning.

### Files Names

This is a text input field, where you will enter the names of the files separated with comma. Do not add the extension with the name. For example say you want to enter the two files, `Personal Tasks.md` and another file is inside a folder 'New folder' say `New file.md`. Then enter the names as : 
```
Personal Tasks.md, New folder/New file.md
```

This plugin only works for markdown files (files with an extension of .md).

### Filter Status

This is a dropdown which allows you to set the status of the files filter or programs the plugin, how the filter going to work. There are three options for this dropdown : 

- **Only Scan This :** If you have entered few file names and you have set this status for this filter. Then the plugin will scan only this files and rest all of your files will be ignored. The plugin will keeps tracking this files for any changes and will detect if the tasks has been updated or a new tasks has been added. Either real-time or on periodic basis.

- **Dont Scan This :** If you have selected this feature, then the plugin will not  going to scan the files. All the rest of the files from the vault will be scanned and tracked for changes. Use this feature, if there are some private files/tasks you dont want to see on the Task Board.

- **Disable :** This option will help you to temporarily disable this specific filter. If for some reason, you also want the entered files to be get scanned or want to scan all other files other than the entered files. Then you can disable the filter, so the plugin can scan all the files from your vault.

> Please note that, even if you have disabled this filter, dont forget to check the status of the below filter, since, the below filter will still going to get applied, if you havent set the status of the below Filters for Folder as not disabled.

## Filters for Folder

In the seccond row you will enter the folder names which you will be going to use for the filters.

### Folder Names

Enter the folder names separated with commas.
For Example, if you want to enter two folder names, say 'New Folder 1' amd 'New Folder 2', then enter the values as : 
```
New Folder 1, New Folder 2
```

If you are giving a folder name which is inside another folder, then, enter the path of the folder from your Vault location. 

For exaple, if you want to enter the specific folder name, say 'New folder' and this folder is inside another folder say 'Parent Folder'. Then enter the full path of this folder :
```
Parent Folder/new folder
```

### Filter Status

The status filter again works similar to the one in the above section in Filters for Files.

- **Only Scan This :** The plugin will only scan the files inside the folders whose names has been entered by you in the text field.

- **Dont Scan This :** The plugin will not scan any files under the folders whole names has been entered in the text field and also the sub-folders inside them. It will scan all the files in all the other folder and in the parent directory of the vault, unless you have given the names of the files from the parent directory.

- **Disable :** The Filters for Folder wont be applied and the plugin will scan all the files from all the folder.

> Please note that, if you have entered a folder name here say 'New folder/' and you dont want to scan any file from this folder, then you can give the status of this filter as `Dont Scan this`. But in the **Filters for Files**, you have given a file name, which is inside the folder 'New folder/' and you have set status of that filter to `Only Scan this`. In this situation, since you do not want any files from that folder to be get scanned. The filter in **Filters for Files** will be useless, and none of your files will going to get scanned. This kind of situation/logic is called **Void Filters**.

> Hence use the filter after doing some logic math, if your requirement is complex. For simple cases, the filters will work fine. You can simply use only one of the filter above and keep few files for not scanning. OR put all your files in one folder and set the status to not scan any files from this folder. 


## Filters for Tags

This filter can be used, when you only want to scan tasks which has certain tags. Or you dont want certain tasks to be get scanned.

### Tag Names

In this text input field you will enter the names of the tags along with the '#' symbol at the begining of the name/string and separate the multiple tags with comma.

For example you want to enter the tags 'Bug', 'docs/bug' and 'feature'. Then enter the names as shown below : 
```
#Bug, #docs/bug, #feature
```

### Filter Status

Similar to the above two files, this also works similar way.

- **Only Scan This :** The plugin will only scan the tasks which contains the tags entered in the input field by you.

- **Dont Scan This :** The plugin will not going to scan any task, which contains any one of the tag mentioned in the input field by you. All the other tasks will going to get scanned, if those tasks doesnt contain any tag mentioned by you in the input field.

- **Disable :** Keep this filter disabled. All tasks will going to get scanned.
