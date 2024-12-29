// Utility to convert hex to RGBA with specific opacity
export function hexToRgba(hex: string, opacity: number): string {
	let r = 0,
		g = 0,
		b = 0;

	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else if (hex.length === 7 || hex.length === 9) {
		r = parseInt(hex[1] + hex[2], 16);
		g = parseInt(hex[3] + hex[4], 16);
		b = parseInt(hex[5] + hex[6], 16);
	}

	return `rgba(${r},${g},${b},${opacity})`;
}

// Convert hex color to hex with Alpha
export function hexToHexAlpha(hex: string, alpha: number = 1): string {
	hex = hex.slice(0, 7);
	const alphaHex = Math.floor(alpha * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${alphaHex}`;
}

// Function to convert RGBA/Hex color to 20% opacity background color
export function colorTo20PercentOpacity(color: string): string {
	if (color.startsWith("#")) {
		return hexToRgba(color, 0.1);
	}
	return color; // If it's already RGBA, return the same color
}
