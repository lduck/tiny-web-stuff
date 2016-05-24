/**
 * This requires jQuery and makes use of HTML5 Canvas.
 *
 * generates a dynamic background for a div with id "social"
 *
 * Copyright (c) 2016, Milan Pikula
 * All rights reserved.
 */
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
	window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
	window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
				   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
	window.requestAnimationFrame = function(callback, element) {
	    var currTime = new Date().getTime();
	    var timeToCall = Math.max(0, 16 - (currTime - lastTime));
	    var id = window.setTimeout(function() { callback(currTime + timeToCall); },
	      timeToCall);
	    lastTime = currTime + timeToCall;
	    return id;
	};
 
    if (!window.cancelAnimationFrame)
	window.cancelAnimationFrame = function(id) {
	    clearTimeout(id);
	};
})();

jQuery(document).ready(function() {
	var soc = jQuery('#social');
	var can = jQuery('<canvas/>', {'class':'socialcanvas'});
	soc.prepend(can);
	can = can.get(0);

	// settings
	var circle_r = 15;
	var cfg_margin = -circle_r;
	var cfg_pixels_per_dot = 1000;

	// variables
	var cfg_maxdots;
	var ctx = can.getContext('2d');
	var M2PI = 2*Math.PI;
	var centerPhase = 0;
	var currentConnections = 0;
	var timer1, timer2;
	timer1 = Date.now();	// for ageing, movement
	timer2 = 0;		// used to populate with new particles
	var socnet = [ ];

	// (topo)logical functions

	function wouldLoop(begin, end, visited) {
		for (var i = 0; i < socnet[begin][3].length; i++) {
			if (socnet[begin][3][i] == end)
				return true;
			if (visited.indexOf(socnet[begin][3][i]) != -1)
				continue;
			visited.push(begin);
			if (wouldLoop(socnet[begin][3][i], end, visited))
				return true;
		}
		return false;
	}

	// graphical functions

	function doResize() {
		can.width = soc.innerWidth();
		can.height = soc.innerHeight();
		cfg_maxdots = Math.ceil(can.width * can.height / cfg_pixels_per_dot);
	}

	function phaseToSize(phase) {
		return 1-0.3*Math.sqrt(Math.abs(phase/4 * 2 - 1));
	}

	function phaseToAlpha(phase) {
		if (phase < 1.5)
			return phase / 1.5;
		else if (phase < 2.5)
			return 1;
		else if (phase < 4)
			return (4 - phase) / 1.5;
		return 0;
	}

	function drawCircle(idx) {
		var alpha = phaseToAlpha(socnet[idx][2]);
		var al100 = Math.floor(255-127*alpha);
		var al200 = Math.floor(255-255*alpha);
		ctx.fillStyle = 'rgba('+al200+','+al200+','+al100+',1)';
		//ctx.strokeStyle = 'rgba(0,0,0,'+phaseToAlpha(socnet[idx][2])+')';
		ctx.strokeStyle = '#fff';
		ctx.beginPath();
		// ctx.arc(socnet[idx][0], socnet[idx][1], circle_r*(0.25+socnet[idx][3].length), 0, M2PI, false);
		ctx.arc(socnet[idx][0], socnet[idx][1], circle_r*phaseToSize(socnet[idx][2]), 0, M2PI, false);
		ctx.closePath();
		ctx.fill();
		//ctx.stroke();
	}

	function drawConnection(idx1, idx2) {
		if (idx1 > idx2)
			return;
		ctx.strokeStyle = 'rgba(0,0,0,'+Math.min(phaseToAlpha(socnet[idx1][2]), phaseToAlpha(socnet[idx2][2]))+')';
		ctx.beginPath();
		ctx.moveTo(socnet[idx1][0], socnet[idx1][1]);
		ctx.lineTo(socnet[idx2][0], socnet[idx2][1]);
		ctx.stroke();
	}

	function socTimer() {

		var now = Date.now();
		var elapsed1 = now - timer1;
		var elapsed2 = now - timer2;

		timer1 = now;

		centerPhase = (centerPhase + 0.00006 * elapsed1 ) % (42*Math.PI);

		var centerX = can.width * ( 0.25 + 0.5 * Math.sin(3*centerPhase)*Math.sin(2*centerPhase) );
		var centerY = can.height * ( 0.2 + 0.6 * Math.cos(centerPhase * 5.5));

		var cleared = 0;
		for (var i=0; i<socnet.length; i++) {
			var angle = Math.atan2(socnet[i][0]-centerX, socnet[i][1]-centerY);
			var aging;

			// move the dots from the center
			socnet[i][0] += 0.015 * elapsed1 * Math.sin(angle) * Math.atan(socnet[i][2] * 50);
			socnet[i][1] += 0.015 * elapsed1 * Math.cos(angle) * Math.atan(socnet[i][2] * 50);

			// age the dots by some coefficient
			if (socnet[i][0] < cfg_margin || socnet[i][0] >= can.width-cfg_margin || socnet[i][1] < cfg_margin || socnet[i][1] >= can.height-cfg_margin) {
				// start decreasing right now and age agressively
				if (socnet[i][2] < 2)
					socnet[i][2] = 4-socnet[i][2];
				aging = 1.5;
			} else {
				// age normally, slower if multi-node
				aging = (1 / (1+2*socnet[i][3].length));
			}

			socnet[i][2] += 0.002 * elapsed1 * aging;

			if (socnet[i][2] < 4)
				continue;

			// kill the old dots - mark for deletion here
			socnet[i][2] = -1;
			for (var j=0; j<socnet.length; j++) {
				if (socnet[j][2] == -1)
					continue;
				var newlinks = [ ];
				for (var k=0; k < socnet[j][3].length; k++) {
					if (socnet[j][3][k] < i-cleared)
						newlinks.push(socnet[j][3][k]);
					else if (socnet[j][3][k] > i-cleared)
						newlinks.push(socnet[j][3][k]-1);
				}
				socnet[j][3] = newlinks;
			}
			cleared++;
		}

		// remove the nodes marked for deletion
		var newsocnet = [ ];
		for (var i=0; i<socnet.length; i++) {
			if (socnet[i][2] != -1)
				newsocnet.push(socnet[i]);
		}
		socnet = newsocnet;

		// generate new dots
		if (elapsed2 > 250 + 500 * Math.random()) {
			timer2 = now;
			for (var iter=0; iter < 4 && socnet.length < cfg_maxdots; iter++) {
				var newx = can.width * (0.1 + 0.8 * Math.random());
				var newy = can.height * (0.1 + 0.8 * Math.random());
				var distances = [];
				for (var i=0; i<socnet.length; i++) {
					var dist = Math.sqrt((socnet[i][0]-newx)*(socnet[i][0]-newx) + (socnet[i][1]-newy)*(socnet[i][1]-newy));
					if (dist <= (circle_r*2)) // too close
						break;
					distances.push([i, dist]);
				}
				if (i != socnet.length)
					continue;

				socnet.push([
					newx,
					newy,
					0, //phase
					[ ] // connections array
				]);

				distances.sort(function(a,b) { return a[1] - b[1] });

				var drawn_lines = 0;
				for (var j=0; j < 3 && drawn_lines < 2 && j < distances.length; j++) {
					if (wouldLoop(distances[j][0], i, [ ] ))
						continue;
					drawn_lines++;
					socnet[i][3].push(distances[j][0]);
					socnet[distances[j][0]][3].push(i);
				}
			}
		}

		// draw
		currentConnections = 0;
		//ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
		//ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.clearRect(0,0,can.width, can.height);
		for (i=0; i<socnet.length; i++)  {
			for (j=0; j<socnet[i][3].length; j++) {
				var idx = socnet[i][3][j];
				drawConnection(i,idx);
				currentConnections++;
			}
		}
		for (i=0; i<socnet.length; i++)  {
			drawCircle(i);
		}
		requestAnimationFrame(socTimer);
	}

	doResize();
	window.addEventListener('resize', doResize, false);

	ctx.lineWidth = 1.5;

	//setInterval(socTimer, 100);
	requestAnimationFrame(socTimer);
	
});
