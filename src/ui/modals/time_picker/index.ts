/**
 * Time Picker Modal
 * A lightweight, keyboard-friendly replacement for the native time input.
 * @module modals/time_picker
 */

import {
	TimePickerComponent,
	formatTimeForDisplay,
	is12HourTimeFormat,
	normalizeTimeValue,
} from "./TimePickerComponent.js";
import { TimePickerModal } from "./TimePickerModal.js";

export {
	TimePickerComponent,
	TimePickerModal,
	formatTimeForDisplay,
	is12HourTimeFormat,
	normalizeTimeValue,
};
