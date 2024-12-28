// import store, { getAllTasksMerged } from "src/store";

export function storeVariablesSyncrhonizer() {
	store.allTaskJsonData.subscribe(() => getAllTasksMerged());
}
