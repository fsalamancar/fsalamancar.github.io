/* Shared UI: nav solidify, scroll reveals, mobile menu */
(function () {
	var nav = document.querySelector('.nav');
	var hasHero = !!document.getElementById('frame-hero');
	if (nav && hasHero) nav.classList.add('over-hero');

	function onScroll() {
		if (!nav) return;
		if (hasHero) {
			// On the hero page: hide nav over the animation, reveal once scrolled in.
			if (window.scrollY > window.innerHeight * 0.85) nav.classList.add('solid');
			else nav.classList.remove('solid');
		} else {
			// Other pages: keep the solid header always visible.
			nav.classList.add('solid');
		}
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	// Reveal on scroll
	var io = new IntersectionObserver(function (entries) {
		entries.forEach(function (e) {
			if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
		});
	}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
	document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

	// Mobile menu
	var toggle = document.querySelector('.nav-toggle');
	var menu = document.getElementById('mobile-menu');
	if (toggle && menu) {
		toggle.addEventListener('click', function () { menu.classList.add('open'); });
		menu.querySelectorAll('a, .close').forEach(function (a) {
			a.addEventListener('click', function () { menu.classList.remove('open'); });
		});
	}

	// Active nav state (aria-current + underline)
	var here = location.pathname.split('/').pop() || 'index.html';
	document.querySelectorAll('.nav .links a, #mobile-menu a').forEach(function (a) {
		var href = a.getAttribute('href') || '';
		if (href.indexOf('http') === 0 || href.indexOf('#') > -1) return;
		if (href === here) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
	});

	// Bogotá local time in footer
	var clocks = document.querySelectorAll('[data-bogota-time]');
	if (clocks.length) {
		var fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
		var tick = function () { var t = fmt.format(new Date()); clocks.forEach(function (c) { c.textContent = t; }); };
		tick();
		setInterval(tick, 30000);
	}

	// Smooth page-leave transition on internal links
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!reduceMotion) {
		document.addEventListener('click', function (e) {
			var a = e.target.closest('a');
			if (!a) return;
			var href = a.getAttribute('href') || '';
			if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
			if (!href || href.indexOf('http') === 0 || href.indexOf('#') === 0 || href.indexOf('mailto:') === 0) return;
			if (href.indexOf('#') > -1 && href.split('#')[0] === here) return;
			e.preventDefault();
			document.body.classList.add('leaving');
			setTimeout(function () { location.href = href; }, 260);
		});
		// restore if page resurrected from bfcache
		window.addEventListener('pageshow', function () { document.body.classList.remove('leaving'); });
	}

	// Animated stat counters
	var statIO = new IntersectionObserver(function (entries) {
		entries.forEach(function (e) {
			if (!e.isIntersecting) return;
			var el = e.target, target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
			var dur = 1600, start = performance.now();
			function step(now) {
				var p = Math.min((now - start) / dur, 1);
				var eased = 1 - Math.pow(1 - p, 3);
				var val = target * eased;
				el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
				if (p < 1) requestAnimationFrame(step);
			}
			requestAnimationFrame(step);
			statIO.unobserve(el);
		});
	}, { threshold: 0.6 });
	document.querySelectorAll('[data-count]').forEach(function (el) { statIO.observe(el); });
})();
