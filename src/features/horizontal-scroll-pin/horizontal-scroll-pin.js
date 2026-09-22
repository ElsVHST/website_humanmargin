/**
 * horizontal-scroll-pin
 * ----------------------
 * Zet een sectie vast (position: sticky) terwijl de bezoeker verticaal scrolt, en
 * schuift een rij panelen ("track") daarbinnen horizontaal mee — het "Bouwen /
 * Inspireren / Leren"-effect van faresmasharawi.nl. Onder een breedte-drempel
 * (standaard 52rem) schakelt het component om naar gewoon horizontaal scrollen
 * met scroll-snap; daar is niets vastgezet.
 *
 * Progressive enhancement: de CSS-standaard (vóórdat init() ooit draait, of
 * zonder JS) is op ELKE breedte de native scroll-snap-rij — paneel 2 en 3
 * blijven dus altijd met een gewone scroll/swipe bereikbaar. Pas als init()
 * vaststelt dat de viewport niet-mobiel is, zet de module het attribuut
 * `data-scroll-pin-pinned` op `root`; alleen dán schakelt de CSS naar de
 * vastgezette pin-modus. Zie horizontal-scroll-pin.css.
 *
 * Vanilla ES-module, 0 dependencies, SSR-veilig (raakt `window`/`document` alleen
 * binnen init() aan, nooit bij import).
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026), eigen implementatie.
 * Zie README.md voor het markup-contract en alle opties.
 *
 * @param {HTMLElement} root - het `[data-scroll-pin]`-element.
 * @param {object} [options]
 * @param {string} [options.breakpoint='(max-width: 52rem)'] - media query waaronder
 *   het component naar de mobiele (native scroll-snap) modus omschakelt. Moet
 *   overeenkomen met de `max-width` in horizontal-scroll-pin.css.
 * @param {number} [options.lerp=0.14] - uitdemp-factor per frame (0–1) voor de
 *   translateX van de track. 1 = geen vertraging (net als reduced-motion).
 * @param {number} [options.wheelMultiplier=1.3] - vermenigvuldiger voor zijwaarts
 *   scrollen (trackpad-swipe) omgezet naar verticale scrollBy.
 * @param {number} [options.vhPerPanel=115] - extra scrolhoogte per paneel na het
 *   eerste, in vh. Bepaalt hoe "traag" er door de reeks gescrold wordt.
 * @returns {() => void} destroy — ruimt listeners, rAF, observers en inline
 *   styles op. Idempotent: opnieuw init() aanroepen op dezelfde root ruimt eerst
 *   de vorige instantie op.
 */

const DEFAULTS = {
	breakpoint: "(max-width: 52rem)",
	lerp: 0.14,
	wheelMultiplier: 1.3,
	vhPerPanel: 115,
};

const SELECTORS = {
	track: "[data-scroll-pin-track]",
	word: "[data-scroll-pin-word]",
	panel: "[data-scroll-pin-panel]",
	segBar: "[data-scroll-pin-seg] i",
};

// root -> destroy, zodat een tweede init() op dezelfde root de eerste opruimt.
const activeInstances = new WeakMap();

function clamp01(value) {
	return Math.min(1, Math.max(0, value));
}

export function init(root, options = {}) {
	if (!root || typeof window === "undefined") {
		return () => {};
	}

	// Idempotent: een eerdere instantie op deze root eerst afbreken.
	activeInstances.get(root)?.();

	const config = { ...DEFAULTS, ...options };

	const track = root.querySelector(SELECTORS.track);
	const words = Array.from(root.querySelectorAll(SELECTORS.word));
	const segBars = Array.from(root.querySelectorAll(SELECTORS.segBar));
	const panels = track ? Array.from(track.children) : [];
	const panelCount = panels.length;

	if (!track || panelCount === 0) {
		// Geen panelen om te tonen: niets te doen, geen listeners op te ruimen.
		return () => {};
	}

	// CSS leest dit om de sectiehoogte te berekenen (calc met N panelen).
	root.style.setProperty("--scroll-pin-panels", String(panelCount));
	root.style.setProperty("--scroll-pin-vh-per-panel", `${config.vhPerPanel}vh`);

	const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	const mobileQuery = window.matchMedia(config.breakpoint);

	const isMobile = () => mobileQuery.matches;
	const isReducedMotion = () => reducedMotionQuery.matches;

	let displayedX = 0;
	let hasPositioned = false; // eerste frame (of na resize/modewissel): direct snappen, niet lerpen
	let rafId = null;
	let isIntersecting = false;
	let lastFocusedPanelIndex = -1;

	// Progressive enhancement: de CSS-standaard (geen attribuut) is altijd de
	// native scroll-snap-rij — bereikbaar zonder JS. Pas als deze functie
	// vaststelt dat de module draait ÉN de viewport niet-mobiel is, zet ze het
	// attribuut dat de CSS naar pin-modus laat omschakelen (zie
	// horizontal-scroll-pin.css). Zo kan paneel 2/3 nooit "achter" een
	// overflow:hidden pin-modus verdwijnen vóórdat JS geladen is.
	function syncPinnedAttribute() {
		if (isMobile()) {
			root.removeAttribute("data-scroll-pin-pinned");
		} else {
			root.setAttribute("data-scroll-pin-pinned", "");
		}
	}

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
		stepDesktop();
	}

	function stepDesktop() {
		if (isMobile()) return;

		const rect = root.getBoundingClientRect();
		const vh = window.innerHeight;

		// Buiten (of net buiten) beeld: niets bijwerken, spaart werk uit.
		if (rect.bottom <= 0 || rect.top >= vh) return;

		const scrollable = root.offsetHeight - vh;
		const p = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;
		const targetX = -p * (panelCount - 1) * window.innerWidth;

		if (!hasPositioned || isReducedMotion()) {
			displayedX = targetX;
			hasPositioned = true;
		} else {
			displayedX += (targetX - displayedX) * config.lerp;
		}
		track.style.transform = `translate3d(${displayedX.toFixed(1)}px, 0, 0)`;

		const continuousIndex = p * (panelCount - 1);
		const activeIndex = Math.round(continuousIndex);
		words.forEach((word, i) => word.classList.toggle("is-active", i === activeIndex));
		segBars.forEach((bar, i) => {
			bar.style.width = `${(100 * clamp01(continuousIndex - i + 1)).toFixed(1)}%`;
		});
	}

	function updateMobileActive() {
		if (!isMobile()) return;
		const first = track.children[0];
		if (!first) return;
		const style = window.getComputedStyle(track);
		const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
		const panelWidth = first.getBoundingClientRect().width + gap;
		if (panelWidth <= 0) return;
		const idx = Math.min(
			panelCount - 1,
			Math.max(0, Math.round(track.scrollLeft / panelWidth)),
		);
		words.forEach((word, i) => word.classList.toggle("is-active", i === idx));
	}

	function goToPanel(index) {
		if (isMobile()) {
			panels[index]?.scrollIntoView({
				behavior: isReducedMotion() ? "auto" : "smooth",
				inline: "start",
				block: "nearest",
			});
			return;
		}
		const scrollable = root.offsetHeight - window.innerHeight;
		const fraction = panelCount > 1 ? index / (panelCount - 1) : 0;
		const targetY = root.offsetTop + fraction * scrollable;
		window.scrollTo({ top: targetY, behavior: isReducedMotion() ? "auto" : "smooth" });
	}

	const wordClickHandlers = words.map((word, i) => {
		const handler = () => goToPanel(i);
		word.addEventListener("click", handler);
		return handler;
	});

	function onWheel(event) {
		if (isMobile() || isReducedMotion()) return;
		if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
		const rect = root.getBoundingClientRect();
		// Alleen ingrijpen als de sectie volledig vastgezet is (anders normaal scrollgedrag).
		if (rect.top > 0 || rect.bottom < window.innerHeight) return;
		event.preventDefault();
		window.scrollBy({ top: config.wheelMultiplier * event.deltaX, behavior: "instant" });
	}
	root.addEventListener("wheel", onWheel, { passive: false });

	function onFocusIn(event) {
		const panel = event.target.closest(SELECTORS.panel);
		if (!panel) return;
		const idx = panels.indexOf(panel);
		if (idx === -1 || idx === lastFocusedPanelIndex) return;
		lastFocusedPanelIndex = idx;
		goToPanel(idx);
	}
	track.addEventListener("focusin", onFocusIn);

	track.addEventListener("scroll", updateMobileActive, { passive: true });

	function handleModeChange() {
		hasPositioned = false;
		syncPinnedAttribute();
		if (isMobile()) {
			stopLoop();
			track.style.transform = "";
			segBars.forEach((bar) => {
				bar.style.width = "";
			});
			updateMobileActive();
		} else if (isIntersecting) {
			startLoop();
		}
	}
	mobileQuery.addEventListener("change", handleModeChange);

	function handleResize() {
		// Een oude px-waarde in een nieuwe breedte is zinloos: opnieuw snappen i.p.v. lerpen.
		hasPositioned = false;
		updateMobileActive();
	}
	window.addEventListener("resize", handleResize, { passive: true });

	const observer = new IntersectionObserver(
		(entries) => {
			isIntersecting = entries[0]?.isIntersecting ?? false;
			if (isIntersecting && !isMobile()) {
				startLoop();
			} else {
				stopLoop();
			}
		},
		// Ruime marge: de rAF-loop start al vóórdat de sectie het beeld raakt, zodat er
		// geen "sprong" te zien is zodra hij binnenkomt.
		{ rootMargin: "100% 0px 100% 0px", threshold: 0 },
	);
	observer.observe(root);

	// Direct één synchrone stap, zodat een pagina die halverwege de sectie ververst
	// (of laadt met een scrollpositie diep in de sectie) meteen de juiste stand toont
	// — niet pas na de eerste rAF-tick, en niet met een lerp-inhaalslag vanaf 0.
	syncPinnedAttribute();
	if (isMobile()) {
		updateMobileActive();
	} else {
		stepDesktop();
	}

	function destroy() {
		stopLoop();
		observer.disconnect();
		mobileQuery.removeEventListener("change", handleModeChange);
		window.removeEventListener("resize", handleResize);
		root.removeEventListener("wheel", onWheel);
		track.removeEventListener("focusin", onFocusIn);
		track.removeEventListener("scroll", updateMobileActive);
		words.forEach((word, i) => {
			word.removeEventListener("click", wordClickHandlers[i]);
			word.classList.remove("is-active");
		});
		track.style.transform = "";
		segBars.forEach((bar) => {
			bar.style.width = "";
		});
		root.style.removeProperty("--scroll-pin-panels");
		root.style.removeProperty("--scroll-pin-vh-per-panel");
		root.removeAttribute("data-scroll-pin-pinned");
		activeInstances.delete(root);
	}

	activeInstances.set(root, destroy);
	return destroy;
}
