// Date and string helpers translated from C# utility methods.

/**
 * Return the first Saturday of the month for the given date.
 * @param {Date} dt
 * @returns {Date}
 */
export function getFirstSaturdayOfThisMonth(dt = new Date()) {
	const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
	const firstSaturday = new Date(firstDay);
	while (firstSaturday.getDay() !== 6) {
		firstSaturday.setDate(firstSaturday.getDate() + 1);
	}
	return firstSaturday;
}

/**
 * Get the active tournament name (yyyymm) based on first Saturday logic.
 * @param {Date} today
 * @returns {string}
 */
export function getActiveTournamentName(today = new Date()) {
	const firstSat = getFirstSaturdayOfThisMonth(today);
	if (firstSat > today) {
		return formatYearMonth(firstSat);
	}
	return formatYearMonth(getFirstSaturdayOfThisMonth(addMonths(today, 1)));
}

/**
 * Compose an image filename from a "Last, First" or plain name string.
 * Output is lowercased, spaces removed, with .png extension.
 * @param {string} name
 * @returns {string}
 */
export function composeImageFileName(name) {
	const parts = (name || '').split(',');
	const sName = parts.length > 1 ? `${parts[1].trim()}${parts[0].trim()}` : name;
	return `${(sName || '').replace(/\s+/g, '').toLowerCase()}.png`;
}

function formatYearMonth(d) {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	return `${year}${month}`;
}

function addMonths(date, months) {
	const d = new Date(date);
	d.setMonth(d.getMonth() + months);
	return d;
}
