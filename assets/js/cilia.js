/* ============================================================
   GUT GUARDIAN — a small game on the epithelial barrier.

   Microbes drift down through the lumen toward the brush border.
   - Pathogens (purple / red, angular) must be flushed back out the
     top with your cursor's current. If one reaches the wall it
     breaches the barrier (health down).
   - Nutrients (warm, round) should be guided DOWN into the cells:
     they get absorbed, convert, and fall away — that scores.
   Score, combo multiplier, a barrier health bar, rising difficulty
   and a persistent best score. Move the cursor to create flow.
   ============================================================ */
(function () {
	var canvas = document.getElementById('cilia-canvas');
	if (!canvas) return;
	var ctx = canvas.getContext('2d');
	var hint = document.querySelector('.cilia-hint');

	// HUD elements (optional — created in index.html)
	var elScore = document.getElementById('g-score');
	var elBest = document.getElementById('g-best');
	var elCombo = document.getElementById('g-combo');
	var elHealth = document.getElementById('g-health-fill');
	var elOverlay = document.getElementById('gut-overlay');
	var elTitle = document.getElementById('g-title');
	var elDesc = document.getElementById('g-desc');
	var elStart = document.getElementById('g-start');
	var elFinal = document.getElementById('g-final');

	var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
	var mouse = { x: -9999, y: -9999, active: false };
	var t = 0;

	var COL = {
		cell: '#E9A79E', cellEdge: '#E1928A',
		cilia: '#ECAFA7', nucleus: '#D4685F',
		purple: '#8478C9', deep: '#5D54A6', pink: '#E486A9', amber: '#E2A94E',
		green: '#6FA86A', salmon: '#E9A79E', red: '#E0685E'
	};

	var cells = [], cilia = [], microbes = [], epiTop = 0;

	/* -------- game state -------- */
	var state = 'idle';            // 'idle' | 'playing' | 'over'
	var score = 0, best = 0, combo = 0, health = 100, level = 1;
	var flash = 0, spawnTimer = 0;
	try { best = parseInt(localStorage.getItem('gutGuardBest') || '0', 10) || 0; } catch (e) { }

	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

	function comboMult() { return Math.min(1 + Math.floor(combo / 3), 8); }

	function hex2rgb(h) { h = h.replace('#', ''); return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) }; }
	function lerpColor(a, b, u) {
		var A = hex2rgb(a), B = hex2rgb(b);
		return 'rgb(' + Math.round(A.r + (B.r - A.r) * u) + ',' + Math.round(A.g + (B.g - A.g) * u) + ',' + Math.round(A.b + (B.b - A.b) * u) + ')';
	}

	/* -------- a drifting entity -------- */
	function makeDrifter(role, fromTop) {
		var path = role === 'pathogen';
		var type = path ? pick(['rod', 'spiral', 'vibrio', 'chain', 'rod'])
		                 : pick(['dot', 'diplo', 'dot', 'amoeba']);
		var color = path ? pick([COL.purple, COL.deep, COL.red, COL.purple])
		                 : pick([COL.green, COL.amber, COL.pink, COL.salmon]);
		var sf = 1 + (level - 1) * 0.13;
		return {
			role: role, type: type === 'amoeba' ? 'dot' : type, color: color,
			bx: rand(0.06, 0.94) * W,
			by: fromTop ? rand(-0.10, -0.02) * H : rand(0.04, 0.30) * H,
			x: 0, y: 0,
			size: path ? rand(0.95, 1.3) : rand(0.9, 1.15),
			ang: rand(0, Math.PI * 2), spin: rand(-0.02, 0.02),
			vx: 0, vy: 0,
			bvx: rand(-0.10, 0.10), bvy: rand(0.45, 0.85) * sf,
			wob: rand(0, Math.PI * 2), wobS: rand(0.4, 0.9), wobA: rand(2, 5),
			alpha: 0, state: 'drift', cellX: 0, absSpeed: rand(0.9, 1.5),
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

	function targetPop() {
		var base = Math.max(4, Math.round(W / 150));
		if (state === 'idle') return base + 2;
		return Math.min(base + level + 2, base + 12);
	}
	function pathProb() { return Math.min(0.48 + level * 0.03, 0.78); }

	function build() {
		var rect = canvas.getBoundingClientRect();
		W = rect.width; H = rect.height;
		canvas.width = W * dpr; canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		epiTop = H * 0.62;
		var bodyBot = H * 0.93;

		cells = [];
		var target = W < 600 ? 110 : 150;
		var n = Math.max(2, Math.round(W / target));
		var gap = 6, cw = (W - gap * (n + 1)) / n;
		for (var i = 0; i < n; i++) {
			cells.push({ left: gap + i * (cw + gap), w: cw, flash: 0 });
		}

		cilia = [];
		var pitch = W < 600 ? 11 : 13;
		var cn = Math.floor(W / pitch), margin = (W - (cn - 1) * pitch) / 2;
		for (var k = 0; k < cn; k++) {
			cilia.push({ x: margin + k * pitch, len: rand(20, 26), w: pitch * 0.42, phase: k * 0.5, bend: 0, vel: 0 });
		}

		microbes = [];
		for (var m = 0; m < targetPop(); m++) microbes.push(makeDrifter(Math.random() < 0.35 ? 'pathogen' : 'nutrient', false));
	}

	/* -------- shapes -------- */
	function capsule(x, y, len, rad, ang, color) {
		ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
		ctx.beginPath(); ctx.arc(-len / 2, 0, rad, 0, Math.PI * 2); ctx.arc(len / 2, 0, rad, 0, Math.PI * 2);
		ctx.rect(-len / 2, -rad, len, rad * 2); ctx.fill(); ctx.restore();
	}
	function circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }

	function drawMicrobe(o) {
		var x = o.x, y = o.y, s = o.size, c = o.color;
		if (o.type === 'dot') { circle(x, y, 5 * s, c); }
		else if (o.type === 'rod') { capsule(x, y, 20 * s, 6 * s, o.ang, c); }
		else if (o.type === 'diplo') {
			var dx = Math.cos(o.ang) * 6 * s, dy = Math.sin(o.ang) * 6 * s;
			circle(x - dx, y - dy, 6.5 * s, c); circle(x + dx, y + dy, 6.5 * s, c);
		} else if (o.type === 'chain') {
			for (var i = 0; i < 6; i++) { var a = o.ang + i * 0.18; circle(x + Math.cos(a) * i * 7 * s, y + Math.sin(a) * i * 7 * s, 4.6 * s, c); }
		} else if (o.type === 'spiral') {
			for (var j = 0; j < 8; j++) { var ang = o.ang + j * 0.8, rad = 3 + j * 1.5 * s; circle(x + Math.cos(ang) * rad * 0.6, y + Math.sin(ang) * rad * 0.6, 3.6 * s, c); }
		} else if (o.type === 'vibrio') {
			ctx.save(); ctx.translate(x, y); ctx.rotate(o.ang); ctx.strokeStyle = c; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.arc(0, 0, 10 * s, -0.6, 1.5); ctx.stroke(); ctx.restore();
		}
	}

	// drift drawing with a role cue: nutrients get a soft halo, pathogens a dark rim
	function drawEntity(p) {
		ctx.globalAlpha = p.alpha;
		if (p.role === 'nutrient') {
			ctx.globalAlpha = p.alpha * 0.16; circle(p.x, p.y, 11 * p.size, COL.green); ctx.globalAlpha = p.alpha;
			drawMicrobe(p);
		} else {
			drawMicrobe(p);
			ctx.globalAlpha = p.alpha * 0.5;
			ctx.strokeStyle = '#3c3766'; ctx.lineWidth = 1.4;
			ctx.beginPath(); ctx.arc(p.x, p.y, 9 * p.size, 0, Math.PI * 2); ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	/* -------- scoring helpers -------- */
	function gain(pts) { score += pts * comboMult(); combo++; }
	function breach(cellIdx) {
		health -= 16; combo = 0; flash = 1;
		if (cells[cellIdx]) cells[cellIdx].flash = 1;
		if (health <= 0) { health = 0; endGame(); }
	}

	function syncHUD() {
		if (elScore) elScore.textContent = score;
		if (elBest) elBest.textContent = best;
		if (elHealth) elHealth.style.width = health + '%';
		if (elCombo) {
			if (state === 'playing' && combo >= 3) { elCombo.textContent = '×' + comboMult(); elCombo.style.opacity = '1'; }
			else elCombo.style.opacity = '0';
		}
	}

	function startGame() {
		state = 'playing'; score = 0; combo = 0; health = 100; level = 1; flash = 0;
		microbes = [];
		for (var m = 0; m < targetPop(); m++) microbes.push(makeDrifter(Math.random() < pathProb() ? 'pathogen' : 'nutrient', true));
		if (elOverlay) elOverlay.classList.remove('show');
		if (hint) hint.style.opacity = '0';
		syncHUD();
	}
	function endGame() {
		state = 'over';
		if (score > best) { best = score; try { localStorage.setItem('gutGuardBest', String(best)); } catch (e) { } }
		if (elTitle) elTitle.textContent = 'Barrier breached';
		if (elDesc) elDesc.innerHTML = 'The wall held for a while. Pathogens flushed, nutrients absorbed — then they got through.';
		if (elFinal) elFinal.innerHTML = 'Score <b>' + score + '</b> &nbsp;·&nbsp; Best <b>' + best + '</b>';
		if (elStart) elStart.textContent = 'Play again';
		if (elOverlay) elOverlay.classList.add('show');
		syncHUD();
	}

	function draw() {
		t += 0.016;
		ctx.clearRect(0, 0, W, H);

		level = 1 + Math.floor(score / 120);

		// ---- cells ----
		var bot = H * 0.93, brushTopY = epiTop - 24;
		for (var i = 0; i < cells.length; i++) {
			var c = cells[i];
			var r = Math.min(c.w * 0.45, (bot - epiTop) * 0.45);
			var l = c.left, rt = c.left + c.w;
			ctx.beginPath();
			ctx.moveTo(l, epiTop); ctx.lineTo(rt, epiTop);
			ctx.lineTo(rt, bot - r); ctx.quadraticCurveTo(rt, bot, rt - r, bot);
			ctx.lineTo(l + r, bot); ctx.quadraticCurveTo(l, bot, l, bot - r);
			ctx.closePath();
			ctx.fillStyle = c.flash > 0 ? lerpColor(COL.cell, '#b6463c', c.flash) : COL.cell;
			ctx.fill();
			ctx.strokeStyle = COL.cellEdge; ctx.lineWidth = 1; ctx.stroke();
			circle(c.left + c.w / 2, epiTop + (bot - epiTop) * 0.42, c.w * 0.22, COL.nucleus);
			if (c.flash > 0) c.flash = Math.max(0, c.flash - 0.03);
		}

		// ---- brush border ----
		for (var k = 0; k < cilia.length; k++) {
			var f = cilia[k];
			var sway = Math.sin(t * 2.2 + f.phase) * 1.5, tgt = 0;
			if (mouse.active) {
				var dx = f.x - mouse.x, dy = (epiTop - f.len) - mouse.y, dist = Math.sqrt(dx * dx + dy * dy), R = 130;
				if (dist < R) { var force = 1 - dist / R; tgt = (dx >= 0 ? 1 : -1) * force * force * 18; }
			}
			f.vel += (tgt - f.bend) * 0.12; f.vel *= 0.82; f.bend += f.vel;
			var tipX = f.x + sway + f.bend, tipY = epiTop - f.len;
			ctx.beginPath(); ctx.moveTo(f.x, epiTop + 1);
			ctx.quadraticCurveTo((f.x + tipX) / 2, epiTop - f.len * 0.5, tipX, tipY);
			ctx.strokeStyle = COL.cilia; ctx.lineWidth = f.w; ctx.lineCap = 'round'; ctx.stroke();
		}

		// ---- spawn to keep the lumen populated ----
		var driftCount = 0;
		for (var q = 0; q < microbes.length; q++) if (microbes[q].state === 'drift') driftCount++;
		if (state !== 'over' && driftCount < targetPop() && t >= spawnTimer) {
			var role = (state === 'playing') ? (Math.random() < pathProb() ? 'pathogen' : 'nutrient') : 'nutrient';
			microbes.push(makeDrifter(role, true));
			spawnTimer = t + Math.max(0.18, 0.8 - level * 0.05);
		}

		// ---- entities ----
		for (var m = microbes.length - 1; m >= 0; m--) {
			var p = microbes[m];

			if (p.state === 'drift') {
				if (mouse.active) {
					var mx = p.bx - mouse.x, my = p.by - mouse.y, mdd = Math.sqrt(mx * mx + my * my), MR = 160;
					if (mdd < MR && mdd > 0.01) { var ff = 1 - mdd / MR; ff *= ff; p.vx += (mx / mdd) * ff * 4.2; p.vy += (my / mdd) * ff * 4.2; }
				}
				p.vx *= 0.9; p.vy *= 0.9;
				p.bx += p.vx + p.bvx;
				p.by += p.vy + p.bvy;
				if (p.alpha < 1) p.alpha = Math.min(1, p.alpha + 0.04);

				// keep inside the walls (bounce) so the only exits are top/bottom
				var rr = 10;
				if (p.bx < rr) { p.bx = rr; p.vx *= -0.5; }
				if (p.bx > W - rr) { p.bx = W - rr; p.vx *= -0.5; }

				p.x = p.bx + Math.cos(t * p.wobS + p.wob) * p.wobA;
				p.y = p.by + Math.sin(t * p.wobS * 0.9 + p.wob) * p.wobA;
				p.ang += p.spin;

				if (p.by >= brushTopY) {                 // reached the wall
					if (state === 'playing' && p.role === 'pathogen') {
						breach(Math.round((p.bx / W) * (cells.length - 1)));
						microbes.splice(m, 1); continue;
					}
					// nutrient (or idle) → absorb through the cell
					p.state = 'absorb'; p.cellX = nearestCellCenter(p.bx);
					if (state === 'playing' && p.role === 'nutrient') gain(10);
				} else if (p.by < -0.16 * H) {           // pushed out the top
					if (state === 'playing' && p.role === 'pathogen') gain(6);
					microbes.splice(m, 1); continue;
				}
				drawEntity(p);

			} else if (p.state === 'absorb') {
				p.bx += (p.cellX - p.bx) * 0.06; p.by += p.absSpeed;
				var prog = Math.max(0, Math.min(1, (p.by - epiTop) / (bot - epiTop)));
				p.x = p.bx; p.y = p.by;
				ctx.globalAlpha = p.alpha;
				circle(p.x, p.y, (5 * p.size) * (1 - 0.35 * prog), lerpColor(p.color, COL.nucleus, Math.min(1, prog + 0.15)));
				ctx.globalAlpha = 1;
				if (p.by >= bot - 4) {
					p.state = 'fall';
					p.settleColor = pick([COL.red, COL.salmon, COL.red]);
					p.settleR = rand(3.5, 5.5); p.vy = rand(0.6, 1.1); p.vx = rand(-0.4, 0.4);
				}

			} else { // fall away and fade
				p.vy += 0.05; p.by += p.vy; p.bx += p.vx;
				p.alpha = Math.max(0, 1 - (p.by - bot) / (H - bot));
				p.x = p.bx; p.y = p.by;
				if (p.alpha <= 0 || p.by > H + 16) { microbes.splice(m, 1); continue; }
				ctx.globalAlpha = p.alpha; circle(p.x, p.y, p.settleR, p.settleColor); ctx.globalAlpha = 1;
			}
		}

		// ---- breach flash over the barrier ----
		if (flash > 0) {
			ctx.globalAlpha = flash * 0.28; ctx.fillStyle = '#c0473d';
			ctx.fillRect(0, epiTop - 30, W, H - (epiTop - 30)); ctx.globalAlpha = 1;
			flash = Math.max(0, flash - 0.04);
		}

		syncHUD();
		requestAnimationFrame(draw);
	}

	/* -------- input -------- */
	function onMove(e) {
		var rect = canvas.getBoundingClientRect();
		mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; mouse.active = true;
		if (hint && state !== 'idle') hint.style.opacity = '0';
	}
	function onLeave() { mouse.active = false; mouse.x = mouse.y = -9999; }
	canvas.addEventListener('mousemove', onMove);
	canvas.addEventListener('mouseleave', onLeave);
	canvas.addEventListener('touchmove', function (e) { var tch = e.touches[0]; if (!tch) return; onMove({ clientX: tch.clientX, clientY: tch.clientY }); }, { passive: true });
	canvas.addEventListener('touchend', onLeave);
	if (elStart) elStart.addEventListener('click', startGame);

	window.addEventListener('resize', build);
	build();
	syncHUD();
	requestAnimationFrame(draw);
})();
