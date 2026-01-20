# Copilot Chat Conversation Export: Custom view for file clicks in

**User:** @tu2-atmanand
**Thread URL:** https://github.com/copilot/c/9b862551-e33b-4adc-b4fa-d6d6956c67b9

## @tu2-atmanand

I am trying to implement a functionality wherein, if I click on a particular type of file from the Obsidian's File Navigator, it should open my custom view. I can see that in this excalidraw plugin project, it has been done from the line 279 to 294. I have used exactly simlar code in my tu2-atmanand/task-board project, but the thing I am not able to understand is, how to find out on which file the user has clicked from the File Navigator. Because, right now in my project the view properly opens when I click on the file type I want to. But, it renders the default data, instead it was supposed to render the data from the file user has clicked to open the view.

Can you please go through this excalidraw project and let me know how to exactly know on which file user has clicked and then load the data from that particular file and render inside the my custom view opened by Obsidian.

## Copilot

Short answer: when a file is clicked the file path is passed in the view state as state.state.file (Obsidian calls leaf.setViewState({ type: "markdown", state: { file: "<path>" } })). The Excalidraw plugin intercepts that in its WorkspaceLeaf.setViewState monkey patch, swaps the view type to the custom view, and then the custom view receives the TFile (as this.file) and the file text (via setViewData / this.data). You should load the file contents from this.file (or from the state.file string) in your view's setViewData / onOpen, not rely only on constructor defaults.

What Excalidraw does (how you should copy it)
- It intercepts workspace leaf setViewState and looks at state.type === "markdown" && state.state?.file (the clicked file path is state.state.file).
- If the file should open in Excalidraw, it replaces state.type with VIEW_TYPE_EXCALIDRAW and calls the original setViewState with the new state. (See registerMonkeyPatches -> WorkspaceLeaf.prototype.setViewState.)
- Because Obsidian will create the new view with the state that contains the file path, the view gets a TFile assigned to this.file and gets its contents delivered to setViewData. ExcalidrawView implements setViewData / loadDrawing which read this.file and this.data and render the scene.

How to implement this in your plugin (concrete steps + minimal code)

1) Intercept/force opening your custom view when a user clicks the file (optional)
- If you want clicks on files with extension .foo to open your view by default, use the same pattern as Excalidraw: around/monkey-patch WorkspaceLeaf.prototype.setViewState and when state.type === "markdown" && state.state?.file and fileShouldBeCustom(state.state.file) — replace state.type with YOUR_VIEW_TYPE then call next(newState,...). That ensures Obsidian creates your view and passes the file path along.

Example (pseudo-code):
```ts
// inside onload() or after workspace ready
this.register(
  around(WorkspaceLeaf.prototype, {
    setViewState(next) {
      return function(state: ViewState, ...rest: any[]) {
        const markdownViewLoaded = state.type === "markdown" && state.state?.file;
        if (markdownViewLoaded && fileShouldBeCustom(state.state.file)) {
          const newState = { ...state, type: YOUR_VIEW_TYPE };
          return next.apply(this, [newState, ...rest]);
        }
        return next.apply(this, [state, ...rest]);
      };
    }
  })
);
```
Note: fileShouldBeCustom() is your function for matching extension/path.

2) Make your view read the file passed in and render it
- Prefer extending TextFileView (or a FileView variant that receives a TFile). When Obsidian opens the view for a file, it will set this.file and call setViewData(data: string). Implement setViewData to store the incoming data and call your rendering logic.

Minimal view code outline:
```ts
import { TextFileView, WorkspaceLeaf, TFile } from "obsidian";

export default class MyCustomView extends TextFileView {
  constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return "my-custom-view"; }
  getDisplayText() { return this.file?.basename ?? "No file"; }

  // Obsidian calls this when the file content is provided/changed:
  async setViewData(data: string, clear: boolean = false) {
    // `this.file` is the TFile for the file the user clicked
    if (!this.file) return;
    this.data = data; // store it if you want, or read it fresh
    // If you need the TFile object:
    const tfile: TFile = this.file;
    // Read direct from vault if needed:
    // const content = await this.app.vault.read(tfile);

    // Now parse `data` (or content) and render inside your view:
    this.renderFromFileData(data);
  }

  async onOpen() {
    // If for some reason setViewData wasn't called yet, you can get the file path:
    const state = this.leaf.getViewState();
    const pathFromState = state?.state?.file; // string path
    // or just rely on this.file and the setViewData call
  }

  renderFromFileData(data: string) {
    // your custom rendering
  }
}
```

Why your view probably shows default data now
- You likely open your view but never consume the file passed by Obsidian (this.file / setViewData). Common mistakes:
  - Creating your view that ignores this.file and uses a default initial state set in constructor.
  - Not extending TextFileView or not implementing setViewData, so Obsidian does not provide the file text into your view lifecycle.
  - Trying to read file path from the DOM or from active leaf wrongly; use this.file or state.state.file.

Alternative if you don't want monkey patching
- If you only register your view and file extension (registerExtensions([...], MY_VIEW_TYPE)), clicking the file will open your view directly. You still must read the file as above. If your view isn't a TextFileView, in onOpen you can take the path string from leaf.getViewState()?.state?.file and then call this.app.vault.getAbstractFileByPath(path) and then this.app.vault.read(file) to get content.

Example (non-TextFileView):
```ts
async onOpen() {
  const path = this.leaf.getViewState()?.state?.file;
  if (!path) return;
  const file = this.app.vault.getAbstractFileByPath(path);
  if (file && file instanceof TFile) {
    const content = await this.app.vault.read(file);
    this.renderFromFileData(content);
  }
}
```

Summary (what to do next)
- Inspect your view class:
  - If it extends TextFileView: implement/verify setViewData reads this.data or this.file and feeds that into your renderer.
  - If it does not extend TextFileView: in onOpen read the path from this.leaf.getViewState().state.file and read via app.vault.read(TFile).
- If you want clicks to automatically open your view instead of the default markdown view, intercept WorkspaceLeaf.setViewState as Excalidraw does and replace the type with your view type (and include the file path in state so you still receive it).
- If you prefer, paste the minimal code of your view.onOpen / setViewData here and I can point out exactly what to change.

If you want, I can:
- point to the exact lines in Excalidraw that show state.state.file being used (I already looked; the WorkspaceLeaf.setViewState monkey patch is where the file path is inspected),
- or review your tu2-atmanand/task-board view code and show the exact place where you should read this.file or the state file path.
