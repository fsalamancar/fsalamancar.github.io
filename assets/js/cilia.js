/* ============================================================
   Gut barrier — flat illustrative epithelium.

   - A row of columnar cells (flat top, rounded bottom) each
     with a nucleus.
   - A comb-like brush border of short cilia (microvilli) sits
     on top of the cell layer.
   - Small colourful molecules / microbes drift in the lumen
     above; scattered molecules sit below the cells.
   - The cursor acts like local flow: nearby molecules drift
     away and the cilia bend away, returning with a spring.
   ============================================================ */
(function () {
	var canvas = document.getElementById('cilia-canvas');
	if (!canvas) return;
	var ctx = canvas.getContext('2d');
	var hint = document.querySelector('.cilia-hint');

	var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
	var mouse = { x: -9999, y: -9999, active: false };
	var t = 0;

	var COL = {
		cell: '#E9A79E', cellEdge: '#E1928A',
		cilia: '#ECAFA7', nucleus: '#D4685F',
		purple: '#8478C9', pink: '#E486A9', amber: '#E2A94E',
		green: '#6FA86A', salmon: '#E9A79E', red: '#E0685E'
	};

	var cells = [], cilia = [], microbes = [], lowerDots = [];
	var epiTop = 0;

	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

	var MTYPES = ['rod', 'rod', 'chain', 'spiral', 'diplo', 'vibrio', 'vibrio', 'antibody', 'dot', 'dot', 'dot'];
	var MPAL = [COL.purple, COL.pink, COL.amber, COL.green, COL.salmon, COL.purple, COL.salmon];

	// hex → {r,g,b} and a linear blend between two hex colours
	function hex2rgb(h) { h = h.replace('#', ''); return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) }; }
	function lerpColor(a, b, u) {
		var A = hex2rgb(a), B = hex2rgb(b);
		return 'rgb(' + Math.round(A.r + (B.r - A.r) * u) + ',' + Math.round(A.g + (B.g - A.g) * u) + ',' + Math.round(A.b + (B.b - A.b) * u) + ')';
	}

	// Build one microbe. `fresh` = spawned mid-life (fades in) vs initial fill.
	// Lifecycle: lumen → stick (on the brush border) → absorb (down through a
	// cell, morphing to red) → settled (a dot at the base) → fades, respawns.
	function makeMicrobe(fresh) {
		var type = pick(MTYPES);
		return {
			type: type,
			bx: rand(0.03, 0.97) * W,
			by: rand(0.05, 0.34) * H,
			x: 0, y: 0,
			color: type === 'antibody' ? COL.pink : (type === 'vibrio' ? COL.salmon : pick(MPAL)),
			size: rand(0.85, 1.25),
			ang: rand(0, Math.PI * 2),
			spin: rand(-0.0015, 0.0015),
			vx: 0, vy: 0,                                  // velocity from cursor pushes
			bvx: rand(-0.08, 0.08), bvy: rand(0.04, 0.12), // slow downward lumen current
			wob: rand(0, Math.PI * 2), wobS: rand(0.4, 0.9), wobA: rand(2, 5),
			alpha: fresh ? 0 : 1,
			state: 'lumen', timer: 0, cellX: 0, absSpeed: rand(0.7, 1.3),
			settleColor: COL.red, settleR: 4
		};
	}

	function nearestCellCenter(x) {
		var best = x, bd = Infinity;
		for (var i = 0; i < cells.length; i++) {
			var cx = cells[i].left + cells[i].w / 2, d = Math.abs(cx - x);
			if (d < bd) { bd = d; best = cx; }
		}
		return best;
	}

	function build() {
		var rect = canvas.getBoundingClientRect();
		W = rect.width; H = rect.height;
		canvas.width = W * dpr; canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		epiTop = H * 0.50;                          // top of cell bodies (cilia above)
		var bodyBot = H * 0.93;

		// ---- columnar cells ----
		cells = [];
		var target = W < 600 ? 110 : 150;
		var n = Math.max(2, Math.round(W / target));
		var gap = 6;
		var cw = (W - gap * (n + 1)) / n;
		for (var i = 0; i < n; i++) {
			var left = gap + i * (cw + gap);
			cells.push({
				left: left, w: cw,
				nucY: epiTop + (bodyBot - epiTop) * rand(0.40, 0.62),
				nucR: cw * rand(0.20, 0.24)
			});
		}

		// ---- comb brush border (cilia) across full width ----
		cilia = [];
		var pitch = W < 600 ? 11 : 13;
		var cn = Math.floor(W / pitch);
		var margin = (W - (cn - 1) * pitch) / 2;
		for (var k = 0; k < cn; k++) {
			cilia.push({
				x: margin + k * pitch,
				len: rand(20, 26),
				w: pitch * 0.42,
				phase: k * 0.5,
				bend: 0, vel: 0
			});
		}

		// ---- drifting molecules / microbes in the lumen ----
		microbes = [];
		var area = Math.round(W / 60) + 8;
		for (var m = 0; m < area; m++) microbes.push(makeMicrobe(false));

		// ---- scattered molecules below the cells ----
		lowerDots = [];
		var ld = Math.round(W / 55) + 4;
		for (var d = 0; d < ld; d++) {
			lowerDots.push({
				x: rand(0.02, 0.98) * W,
				y: rand(0.955, 0.995) * H,
				r: rand(3, 6),
				color: pick([COL.red, COL.salmon, COL.red]),
				bob: rand(0, Math.PI * 2)
			});
		}
	}

	/* -------- shape drawing -------- */
	function capsule(x, y, len, rad, ang, color) {
		ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(-len / 2, 0, rad, 0, Math.PI * 2);
		ctx.arc(len / 2, 0, rad, 0, Math.PI * 2);
		ctx.rect(-len / 2, -rad, len, rad * 2);
		ctx.fill();
		ctx.restore();
	}
	function circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }

	function drawMicrobe(o) {
		var x = o.x, y = o.y, s = o.size, c = o.color;
		if (o.type === 'dot') {
			circle(x, y, 4 * s, c);
		} else if (o.type === 'rod') {
			capsule(x, y, 20 * s, 6 * s, o.ang, c);
		} else if (o.type === 'diplo') {
			var dx = Math.cos(o.ang) * 6 * s, dy = Math.sin(o.ang) * 6 * s;
			circle(x - dx, y - dy, 6.5 * s, c); circle(x + dx, y + dy, 6.5 * s, c);
		} else if (o.type === 'chain') {
			for (var i = 0; i < 6; i++) {
				var a = o.ang + i * 0.18;
				circle(x + Math.cos(a) * i * 7 * s, y + Math.sin(a) * i * 7 * s, 4.6 * s, c);
			}
		} else if (o.type === 'spiral') {
			for (var j = 0; j < 8; j++) {
				var ang = o.ang + j * 0.8, rad = 3 + j * 1.5 * s;
				circle(x + Math.cos(ang) * rad * 0.6, y + Math.sin(ang) * rad * 0.6, 3.6 * s, c);
			}
		} else if (o.type === 'vibrio') {
			ctx.save(); ctx.translate(x, y); ctx.rotate(o.ang);
			ctx.strokeStyle = c; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.arc(0, 0, 10 * s, -0.6, 1.5); ctx.stroke();
			ctx.restore();
		} else if (o.type === 'antibody') {
			ctx.save(); ctx.translate(x, y); ctx.rotate(o.ang);
			ctx.strokeStyle = c; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(0, 8 * s); ctx.lineTo(0, 0);
			ctx.moveTo(0, 0); ctx.lineTo(-8 * s, -9 * s);
			ctx.moveTo(0, 0); ctx.lineTo(8 * s, -9 * s);
			ctx.stroke();
			ctx.restore();
		}
	}

	function draw() {
		t += 0.016;
		ctx.clearRect(0, 0, W, H);

		// ---- cells (flat top, rounded bottom) ----
		for (var i = 0; i < cells.length; i++) {
			var c = cells[i];
			var r = Math.min(c.w * 0.45, (H * 0.93 - epiTop) * 0.45);
			var bot = H * 0.93, l = c.left, rt = c.left + c.w;
			ctx.beginPath();
			ctx.moveTo(l, epiTop);
			ctx.lineTo(rt, epiTop);
			ctx.lineTo(rt, bot - r);
			ctx.quadraticCurveTo(rt, bot, rt - r, bot);
			ctx.lineTo(l + r, bot);
			ctx.quadraticCurveTo(l, bot, l, bot - r);
			ctx.closePath();
			ctx.fillStyle = COL.cell; ctx.fill();
			ctx.strokeStyle = COL.cellEdge; ctx.lineWidth = 1; ctx.stroke();
			circle(c.left + c.w / 2, c.nucY, c.nucR, COL.nucleus);
		}

		// ---- brush border cilia (comb) ----
		for (var k = 0; k < cilia.length; k++) {
			var f = cilia[k];
			var sway = Math.sin(t * 2.2 + f.phase) * 1.5;

			var target = 0;
			if (mouse.active) {
				var dx = f.x - mouse.x, dy = (epiTop - f.len) - mouse.y;
				var dist = Math.sqrt(dx * dx + dy * dy), R = 130;
				if (dist < R) { var force = 1 - dist / R; target = (dx >= 0 ? 1 : -1) * force * force * 18; }
			}
			f.vel += (target - f.bend) * 0.12; f.vel *= 0.82; f.bend += f.vel;

			var tipX = f.x + sway + f.bend, tipY = epiTop - f.len;
			ctx.beginPath();
			ctx.moveTo(f.x, epiTop + 1);
			ctx.quadraticCurveTo((f.x + tipX) / 2, epiTop - f.len * 0.5, tipX, tipY);
			ctx.strokeStyle = COL.cilia; ctx.lineWidth = f.w; ctx.lineCap = 'round';
			ctx.stroke();
		}

		// ---- molecules below ----
		for (var d = 0; d < lowerDots.length; d++) {
			var o = lowerDots[d];
			circle(o.x, o.y + Math.sin(t * 1.5 + o.bob) * 1.5, o.r, o.color);
		}

		// ---- microbes: lumen → stick on brush → absorb through cell → settle ----
		var bot = H * 0.93, brushTopY = epiTop - 24;
		for (var m = 0; m < microbes.length; m++) {
			var p = microbes[m];

			if (p.state === 'lumen') {
				// cursor pushes molecules and they stay where shoved (settle, no snap-back)
				if (mouse.active) {
					var mx = p.bx - mouse.x, my = p.by - mouse.y;
					var md = Math.sqrt(mx * mx + my * my), MR = 150;
					if (md < MR && md > 0.01) { var ff = 1 - md / MR; ff *= ff; p.vx += (mx / md) * ff * 3.4; p.vy += (my / md) * ff * 3.4; }
				}
				p.vx *= 0.9; p.vy *= 0.9;
				p.bx += p.vx + p.bvx;
				p.by += p.vy + p.bvy;          // slow downward current toward the epithelium
				if (p.alpha < 1) p.alpha = Math.min(1, p.alpha + 0.02);

				p.x = p.bx + Math.cos(t * p.wobS + p.wob) * p.wobA;
				p.y = p.by + Math.sin(t * p.wobS * 0.9 + p.wob) * p.wobA;
				p.ang += p.spin;

				if (p.by >= brushTopY) {        // reached the brush border → cling
					p.state = 'stick'; p.by = brushTopY; p.vx = p.vy = 0;
					p.timer = t + rand(0.4, 1.0); p.cellX = nearestCellCenter(p.bx);
				} else if (p.bx < -30 || p.bx > W + 30 || p.by < -40) {
					microbes[m] = makeMicrobe(true); continue;   // drifted away → refill from top
				}
				ctx.globalAlpha = p.alpha; drawMicrobe(p); ctx.globalAlpha = 1;

			} else if (p.state === 'stick') {   // pinned to the cilia, jittering
				p.x = p.bx + Math.sin(t * 6 + p.wob) * 1.5;
				p.y = brushTopY + Math.sin(t * 4 + p.wob) * 1.2;
				p.ang += p.spin;
				if (t >= p.timer) p.state = 'absorb';
				ctx.globalAlpha = p.alpha; drawMicrobe(p); ctx.globalAlpha = 1;

			} else if (p.state === 'absorb') {  // slide into the cell column, descend, morph to red
				p.bx += (p.cellX - p.bx) * 0.06;
				p.by += p.absSpeed;
				var prog = Math.max(0, Math.min(1, (p.by - epiTop) / (bot - epiTop)));
				p.x = p.bx; p.y = p.by;
				ctx.globalAlpha = p.alpha;
				circle(p.x, p.y, (5 * p.size) * (1 - 0.35 * prog), lerpColor(p.color, COL.nucleus, Math.min(1, prog + 0.15)));
				ctx.globalAlpha = 1;
				if (p.by >= bot - 4) {
					p.state = 'settled';
					p.by = rand(0.955, 0.99) * H; p.bx = p.cellX + rand(-8, 8);
					p.timer = t + rand(3, 6);
					p.settleColor = pick([COL.red, COL.salmon, COL.red]);
					p.settleR = rand(3.5, 6);
				}

			} else {                            // settled dot at the base, then fades and respawns up top
				p.x = p.bx; p.y = p.by + Math.sin(t * 1.5 + p.wob) * 1.5;
				if (t >= p.timer) { p.alpha -= 0.02; if (p.alpha <= 0) { microbes[m] = makeMicrobe(true); continue; } }
				ctx.globalAlpha = p.alpha; circle(p.x, p.y, p.settleR, p.settleColor); ctx.globalAlpha = 1;
			}
		}

		requestAnimationFrame(draw);
	}

	function onMove(e) {
		var rect = canvas.getBoundingClientRect();
		mouse.x = e.clientX - rect.left;
		mouse.y = e.clientY - rect.top;
		mouse.active = true;
		if (hint) hint.style.opacity = '0';
	}
	function onLeave() { mouse.active = false; mouse.x = mouse.y = -9999; }

	canvas.addEventListener('mousemove', onMove);
	canvas.addEventListener('mouseleave', onLeave);
	canvas.addEventListener('touchmove', function (e) {
		var tch = e.touches[0]; if (!tch) return;
		onMove({ clientX: tch.clientX, clientY: tch.clientY });
	}, { passive: true });
	canvas.addEventListener('touchend', onLeave);

	window.addEventListener('resize', build);
	build();
	requestAnimationFrame(draw);
})();
