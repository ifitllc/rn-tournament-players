// Omnipong scraping helpers for RN/JS without Node-only deps.

const OMNIPONG_HOST = 'https://www.omnipong.com/';
const TOURNAMENT_SEARCH_PATH = 'T-tourney.asp?t=9&e=0';
const OMNIPONG_LINK_PATTERN = /open_window\('([^']+)'/;
const OMNIPONG_ID_PATTERN = /t=(\d*)&r=(\d*)/;

/**
 * Fetch tournaments matching the Omnipong keyword search.
 * Mirrors the original MAUI service behavior.
 */
export async function getTournaments({ keyword = 'HCTT', year = new Date().getFullYear() } = {}) {
	try {
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1; // 1-12
		const currentYearMonth = currentYear * 100 + currentMonth; // e.g., 202512

		// Fetch current year
		const body = new URLSearchParams({
			Year: String(year),
			Keyword: keyword,
		}).toString();

		const response = await fetch(`${OMNIPONG_HOST}${TOURNAMENT_SEARCH_PATH}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});

		if (!response.ok) {
			throw new Error(`Omnipong tournament request failed: ${response.status}`);
		}

		const html = await response.text();
		let tournaments = parseTournamentTable(html);

		// Also fetch next year tournaments
		const nextYear = currentYear + 1;
		const nextYearBody = new URLSearchParams({
			Year: String(nextYear),
			Keyword: keyword,
		}).toString();

		const nextYearResponse = await fetch(`${OMNIPONG_HOST}${TOURNAMENT_SEARCH_PATH}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: nextYearBody,
		});

		if (nextYearResponse.ok) {
			const nextYearHtml = await nextYearResponse.text();
			const nextYearTournaments = parseTournamentTable(nextYearHtml);
			tournaments = [...tournaments, ...nextYearTournaments];
		}

		// Filter out past tournaments (keep current month and future)
		return tournaments.filter(tournament => {
			// Extract YYYYMM from tournament name (e.g., "HCTT 202512" or "202512")
			const match = tournament.name.match(/(\d{6})/);
			if (!match) return true; // Keep tournaments without date pattern
			
			const tournamentYearMonth = parseInt(match[1], 10);
			return tournamentYearMonth >= currentYearMonth;
		});
	} catch (error) {
		console.error('Failed to fetch tournaments:', error.message);
		return [];
	}
}

/**
 * Fetch player list for a specific tournament link (relative or absolute).
 */
export async function getPlayers(tournamentLink) {
	if (!tournamentLink) return [];

	const resolvedLink = resolveLink(tournamentLink);

	try {
		const response = await fetch(resolvedLink);
		if (!response.ok) {
			throw new Error(`Omnipong players request failed: ${response.status}`);
		}

		const html = await response.text();
		return parsePlayers(html);
	} catch (error) {
		console.error('Failed to fetch players:', error.message);
		return [];
	}
}


function parseTournamentTable(html) {
	const tableHtml = extractTable(html);
	const tournaments = [];
	if (!tableHtml) return tournaments;

	const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
	for (const row of rows) {
		const cells = row.match(/<td[\s\S]*?<\/td>/gi) || [];
		const linkCell = cells[1];
		const nameCell = cells[2];
		if (!linkCell || !nameCell) continue;

		const linkMatch = OMNIPONG_LINK_PATTERN.exec(linkCell);
		if (!linkMatch) continue;
		const tournamentPath = linkMatch[1].trim();
		const idMatch = OMNIPONG_ID_PATTERN.exec(tournamentPath);
		if (!idMatch) continue;

		tournaments.push({
			clubId: Number(idMatch[1]),
			tournamentId: Number(idMatch[2]),
			name: stripTags(nameCell).trim(),
			omnipongPath: tournamentPath,
			omnipongUrl: resolveLink(tournamentPath),
		});
	}

	return tournaments;
}

function parsePlayers(html) {
	const tableHtml = extractTable(html);
	const players = [];
	if (!tableHtml) return players;

	const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
	let id = 1;
	for (const row of rows) {
		try {
			const cells = row.match(/<td[\s\S]*?<\/td>/gi) || [];
			const nameCell = cells[0];
			if (!nameCell) continue;

			const name = stripTags(nameCell).replace(/^-+/, '').trim();
			if (!name) continue;

			players.push({ id: id++, name });
		} catch (err) {
			console.warn('Skipping player row:', err.message);
		}
	}

	return players;
}

function extractTable(html) {
	const match = html.match(/<table[^>]*class=["']omnipong["'][^>]*>([\s\S]*?)<\/table>/i);
	return match ? match[1] : null;
}

function stripTags(value) {
	return (value || '').replace(/<[^>]*>/g, '');
}

function resolveLink(path) {
	try {
		return new URL(path, OMNIPONG_HOST).toString();
	} catch (_) {
		return `${OMNIPONG_HOST}${path}`;
	}
}

// Named exports are used above for ES modules.
