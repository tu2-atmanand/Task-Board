import { t } from "i18next";
import { PropertyTypeConfig } from "../../../interfaces/Enums.js";
import type { SupportedPropertiesConfig } from "../../../interfaces/GlobalSettings.js";

export interface FilterConditionOption {
	value: string;
	text: string;
}

export interface PropertyTypeFilterConfig {
	inputType: "text" | "number" | "date" | "datetime-local" | "time";
	conditionOptions: FilterConditionOption[];
}

const CONDITIONS_REQUIRING_VALUE = new Set([
	"equals",
	"contains",
	"doesNotContain",
	"startsWith",
	"endsWith",
	"is",
	"isNot",
	">",
	"<",
	">=",
	"<=",
	"before",
	"onOrBefore",
	"after",
	"onOrAfter",
]);

export function getPropertyTypeFilterConfig(
	type: PropertyTypeConfig,
): PropertyTypeFilterConfig {
	const emptyValueConditions: FilterConditionOption[] = [
		{ value: "isEmpty", text: t("is-empty") },
		{ value: "isNotEmpty", text: t("is-not-empty") },
	];
	const equalityConditions: FilterConditionOption[] = [
		{ value: "is", text: t("is") },
		{ value: "isNot", text: t("is-not") },
	];
	const orderingConditions: FilterConditionOption[] = [
		{ value: ">", text: ">" },
		{ value: "<", text: "<" },
		{ value: ">=", text: ">=" },
		{ value: "<=", text: "<=" },
	];
	const dateOrderingConditions: FilterConditionOption[] = [
		{ value: "before", text: t("before") },
		{ value: "onOrBefore", text: t("on-or-before") },
		{ value: "after", text: t("after") },
		{ value: "onOrAfter", text: t("on-or-after") },
	];
	const containsConditions: FilterConditionOption[] = [
		{ value: "contains", text: t("contains") },
		{ value: "doesNotContain", text: t("does-not-contain") },
	];
	const stringConditions: FilterConditionOption[] = [
		...equalityConditions,
		...containsConditions,
		{ value: "startsWith", text: t("starts-with") },
		{ value: "endsWith", text: t("ends-with") },
	];

	switch (type) {
		case PropertyTypeConfig.numeric:
			return {
				inputType: "number",
				conditionOptions: [
					...equalityConditions,
					...orderingConditions,
					...emptyValueConditions,
				],
			};
		case PropertyTypeConfig.date:
			return {
				inputType: "date",
				conditionOptions: [
					...equalityConditions,
					...dateOrderingConditions,
					...emptyValueConditions,
				],
			};
		case PropertyTypeConfig.dateTime:
			return {
				inputType: "datetime-local",
				conditionOptions: [
					...equalityConditions,
					...dateOrderingConditions,
					...emptyValueConditions,
				],
			};
		case PropertyTypeConfig.time:
			return {
				inputType: "time",
				conditionOptions: [
					...equalityConditions,
					...dateOrderingConditions,
					...emptyValueConditions,
				],
			};
		case PropertyTypeConfig.boolean:
			return {
				inputType: "text",
				conditionOptions: [
					...equalityConditions,
					...emptyValueConditions,
				],
			};
		case PropertyTypeConfig.list:
			return {
				inputType: "text",
				conditionOptions: [
					...containsConditions,
					...equalityConditions,
					...emptyValueConditions,
				],
			};
		default:
			return {
				inputType: "text",
				conditionOptions: [
					...stringConditions,
					...emptyValueConditions,
				],
			};
	}
}

export function conditionRequiresValue(condition: string): boolean {
	return CONDITIONS_REQUIRING_VALUE.has(condition);
}

export function isBooleanFilterProperty(
	propertyId: string,
	taskProperties: Pick<SupportedPropertiesConfig, "id" | "type">[],
): boolean {
	return (
		propertyId === "priority" ||
		propertyId === "status" ||
		taskProperties.some(
			(property) =>
				property.id === propertyId &&
				property.type === PropertyTypeConfig.boolean,
		)
	);
}