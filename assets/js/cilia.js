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
		var types = ['rod', 'rod', 'chain', 'spiral', 'diplo', 'vibrio', 'vibrio', 'antibody', 'dot', 'dot', 'dot'];
		var palette = [COL.purple, COL.pink, COL.amber, COL.green, COL.salmon, COL.purple, COL.salmon];
		var area = Math.round(W / 70) + 6;
		for (var m = 0; m < area; m++) {
			var type = pick(types);
			microbes.push({
				type: type,
				bx: rand(0.03, 0.97) * W,
				by: rand(0.06, 0.40) * H,
				x: 0, y: 0,
				color: type === 'antibody' ? COL.pink : (type === 'vibrio' ? COL.salmon : pick(palette)),
				size: rand(0.85, 1.25),
				ang: rand(0, Math.PI * 2),
				spin: rand(-0.0015, 0.0015),
				driftA: rand(6, 16),
				driftP: rand(0, Math.PI * 2),
				driftS: rand(0.4, 0.9),
				ox: 0, oy: 0, vx: 0, vy: 0
			});
		}

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

		// ---- drifting microbes in the lumen ----
		for (var m = 0; m < microbes.length; m++) {
			var p = microbes[m];
			// gentle drift around base position
			var dx2 = Math.cos(t * p.driftS + p.driftP) * p.driftA;
			var dy2 = Math.sin(t * p.driftS * 0.8 + p.driftP) * p.driftA * 0.6;
			// cursor repulsion (spring)
			var tx = 0, ty = 0;
			if (mouse.active) {
				var mx = p.bx + dx2 - mouse.x, my = p.by + dy2 - mouse.y;
				var md = Math.sqrt(mx * mx + my * my), MR = 150;
				if (md < MR && md > 0.01) { var ff = (1 - md / MR); tx = (mx / md) * ff * 70; ty = (my / md) * ff * 70; }
			}
			p.vx += (tx - p.ox) * 0.08; p.vx *= 0.86; p.ox += p.vx;
			p.vy += (ty - p.oy) * 0.08; p.vy *= 0.86; p.oy += p.vy;

			p.x = p.bx + dx2 + p.ox;
			p.y = p.by + dy2 + p.oy;
			p.ang += p.spin;
			drawMicrobe(p);
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
