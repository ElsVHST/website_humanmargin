/**
 * kinetic-type
 * ------------
 * "Dichtdrukken": woorden worden vetter en smaller en krijgen meer contrast
 * naarmate ze het midden van het scherm naderen — het effect op de aanbod-koppen
 * van faresmasharawi.nl. Werkt op een variabele font met een `wght`- én
 * `wdth`-as (zie README voor welke fonts geschikt zijn).
 *
 * Meet gewoon posities: dit component weet niets van horizontal-scroll-pin of
 * enige andere scroll-choreografie. Standaard meet het langs de y-as (verticale
 * afstand tot het midden van het scherm); zet `data-kinetic-type="x"` op een
 * element om het langs de x-as te meten (voor gebruik bínnen een horizontale
 * track, zoals horizontal-scroll-pin) — met een terugval naar de y-as onder
 * `xAxisBreakpoint`, want in een gestapelde mobiele layout beweegt een element
 * nauwelijks horizontaal.
 *
 * Vanilla ES-module, 0 dependencies, SSR-veilig.
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026), eigen implementatie.
 *
 * @param {HTMLElement} root - container waarbinnen naar `[data-kinetic-type]`
 *   gezocht wordt (root zelf telt ook mee als het die attribuut draagt).
 * @param {object} [options]
 * @param {string} [options.xAxisBelow='52rem'] - CSS-lengte; onder deze
 *   breedte meten x-mode-elementen alsnog langs de y-as (PageMotion in de
 *   bron: `"x"!==e.dataset.kinetic||t()`, waarbij `t()` de mobiel-check is —
 *   zie SPEC-features.md §3.4). Heette tot 22-09-2026 `xAxisBreakpoint` en
 *   nam toen een complete media-query-string; die naam blijft werken als
 *   alias voor bestaande integraties, maar `xAxisBelow` is de voorkeursnaam.
 * @param {number} [options.yFactor=0.6] - normalisatie-afstand voor de y-as, als
 *   fractie van de viewporthoogte.
 * @param {number} [options.xFactor=0.7] - normalisatie-afstand voor de x-as, als
 *   fractie van de viewportbreedte.
 * @param {number} [options.minWeight=300] - `wght` ver van het midden.
 * @param {number} [options.maxWeight=800] - `wght` in het midden.
 * @param {number} [options.maxWidth=100] - `wdth` ver van het midden (normale breedte).
 * @param {number} [options.minWidth=84] - `wdth` in het midden (smaller).
 * @param {number} [options.minAlpha=0.4] - dekking ver van het midden.
 * @param {number} [options.maxAlpha=1] - dekking in het midden.
 * @returns {() => void} destroy
 */

const DEFAULTS = {
	xAxisBelow: "52rem",
	yFactor: 0.6,
	xFactor: 0.7,
	minWeight: 300,
	maxWeight: 800,
	maxWidth: 100,
	minWidth: 84,
	minAlpha: 0.4,
	maxAlpha: 1,
};

const SELECTOR = "[data-kinetic-type]";

const activeInstances = new WeakMap();

function smoothstep(n) {
	return n * n * (3 - 2 * n);
}

export function init(root, options = {}) {
	if (!root || typeof window === "undefined") {
		return () => {};
	}

	activeInstances.get(root)?.();

	// `xAxisBreakpoint` (vóór 22-09-2026: een volledige media-query-string) blijft werken als
	// alias, zodat een bestaande integratie die 'm nog gebruikt niet stilzwijgend breekt.
	const { xAxisBreakpoint, ...restOptions } = options;
	const config = { ...DEFAULTS, ...restOptions };
	const xAxisMediaQuery = xAxisBreakpoint ?? `(max-width: ${config.xAxisBelow})`;

	const ownMatch = typeof root.matches === "function" && root.matches(SELECTOR);
	const elements = ownMatch
		? [root, ...root.querySelectorAll(SELECTOR)]
		: Array.from(root.querySelectorAll(SELECTOR));

	if (elements.length === 0) {
		return () => {};
	}

	const xAxisQuery = window.matchMedia(xAxisMediaQuery);

	let rafId = null;
	const visible = new Set();

	function startLoop() {
		if (rafId != null) return;
		rafId = requestAnimationFrame(tick);
	}
	function stopLoop() {
		if (rafId != null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}
	function tick() {
		rafId = requestAnimationFrame(tick);
		step();
	}

	function step() {
		const vh = window.innerHeight;
		const vw = window.innerWidth;
		const xFallsBackToY = xAxisQuery.matches;

		for (const el of elements) {
			const rect = el.getBoundingClientRect();

			// Ver buiten beeld (~2 viewports): overslaan, scheelt werk.
			if (rect.bottom < -vh || rect.top > 2 * vh || rect.right < -vw || rect.left > 2 * vw) {
				continue;
			}

			const useXAxis = el.dataset.kineticType === "x" && !xFallsBackToY;
			let n;
			if (useXAxis) {
				const delta = rect.left + rect.width / 2 - vw / 2;
				n = Math.max(0, 1 - Math.abs(delta) / (config.xFactor * vw));
			} else {
				const delta = rect.top + rect.height / 2 - vh / 2;
				n = Math.max(0, 1 - Math.abs(delta) / (config.yFactor * vh));
			}

			const a = smoothstep(n);
			el.style.setProperty(
				"--kt-w",
				String(Math.round(config.minWeight + (config.maxWeight - config.minWeight) * a)),
			);
			el.style.setProperty(
				"--kt-wd",
				(config.maxWidth + (config.minWidth - config.maxWidth) * a).toFixed(1),
			);
			el.style.setProperty(
				"--kt-b",
				(config.minAlpha + (config.maxAlpha - config.minAlpha) * a).toFixed(3),
			);
		}
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target);
				else visible.delete(entry.target);
			}
			if (visible.size > 0) startLoop();
			else stopLoop();
		},
		{ rootMargin: "100% 0px 100% 0px", threshold: 0 },
	);
	elements.forEach((el) => observer.observe(el));

	// Synchrone eerste stap: een pagina die halverwege een kinetic-woord laadt (of
	// ververst) toont meteen de juiste --kt-w/--kt-wd/--kt-b, niet pas na de eerste tick.
	step();

	function destroy() {
		stopLoop();
		observer.disconnect();
		visible.clear();
		elements.forEach((el) => {
			el.style.removeProperty("--kt-w");
			el.style.removeProperty("--kt-wd");
			el.style.removeProperty("--kt-b");
		});
		activeInstances.delete(root);
	}

	activeInstances.set(root, destroy);
	return destroy;
}
