/**
 * Returns local time in ISO-like format (YYYY-MM-DDTHH:MM) without milliseconds or timezone
 * @returns Current local time in ISO format string (YYYY-MM-DDTHH:MM)
 */
export const getLocalDateTimeString = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Returns local time in ISO-like format (YYYY-MM-DDTHH:MM:SS) without milliseconds or timezone
 * @returns Current local time in ISO format string (YYYY-MM-DDTHH:MM:SS)
 */
export const getCurrentLocalTimeString = (): string => {
	const now = new Date();
	const currentTime = new Date(
		now.getTime() - now.getTimezoneOffset() * 60000
	)
		.toISOString()
		.slice(0, 19);

	return currentTime;
};
