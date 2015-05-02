function draw_circle(ctx, x_center, y_center, radius) {
  ctx.moveTo(x_center + radius, y_center);
  ctx.arc(x_center, y_center, radius, 0, Math.PI*2, true);
}

function gen_rand_linear(lower, upper) {
  return lower + (upper - lower) * Math.random();
}

function gen_rand_normal(stdev, mean) {
  var sum = 0;
  for (var i=0; i<3; i++) {  // I love semicola
    sum += gen_rand_linear(-1, 1);
  }
  sum = sum * stdev + mean;
  return sum;
}

function draw_galactic_band(ctx, star_count, star_radius, star_color, band_height, band_width, guidepoints) {
  ctx.beginPath();

  for (var i=0; i<star_count; i++) {
    var circle_y = gen_rand_linear(band_height.min, band_height.max);
    var circle_x = gen_rand_normal(band_width.stdev, band_width.mean) +
      get_x_coord_at_y_coord(guidepoints, circle_y) - band_width.mean;
    draw_circle(ctx,
      circle_x,
      circle_y,
      gen_rand_linear(star_radius.min, star_radius.max));
  }

  ctx.fillStyle = star_color;
  ctx.fill();
}

function bend_line(points, start, wiggle_distance_x, wiggle_distance_y, depth) {
  if (depth === 0) {
    return;
  }

  function midpoint(p1, p2) {
    return Math.abs(p1 - p2) / 2 + Math.min(p1, p2);
  }

  var midpoint_x = midpoint(points[start].x, points[start+1].x);
  var midpoint_y = midpoint(points[start].y, points[start+1].y);
  var new_x;
  var new_y;
  do {
    new_x = Math.round(gen_rand_normal(wiggle_distance_x, midpoint_x));
  } while (Math.abs(new_x - midpoint_x) < wiggle_distance_x / 2)  // make sure it wiggles at least a little
  do {
    new_y = Math.round(gen_rand_normal(wiggle_distance_y, midpoint_y));
  } while (new_y < points[start].y || new_y > points[start+1].y)  // keep it from wiggling too much

  // Now, for both lines created by our new point, make sure that the
  // vertical projection is greater than the horizontal projection so that
  // for each pixel in the y coordinate along the idealized line there exists
  // exactly one pixel along the x coordinate. This simplifies our
  // implementation of Bresenham's line algorithm, used later to actually
  // wiggle the galaxy according to the points generated here.
  if (new_y - points[start].y < Math.abs(new_x - points[start].x) ||
    points[start+1].y - new_y < Math.abs(new_x - points[start+1].x)) {
    new_x = midpoint_x;
    new_y = midpoint_y;
  }

  points.splice(start+1, 0, {x: new_x, y: new_y});

  bend_line(points, start+1, wiggle_distance_x / 2, wiggle_distance_y / 2, depth - 1);  // hilarious
  bend_line(points, start, wiggle_distance_x / 2, wiggle_distance_y / 2, depth - 1);
}

function get_x_coord_at_y_coord(guidepoints, y) {
  // Should I feel bad about how inefficient this is?
  // There aren't *that* many guidepoints, so a binary search wouldn't buy us
  // much... on average it's log(n) vs n/2 for small n.
  // And ideally we wouldn't repeat a search at all, we'd just generate all
  // possible points beforehand and stuff them in an array and do a lookup.
  // A compromise would be to generate all stars beforehand, sort them by
  // their x coord, then run through the array of guidepoints exactly once.
  // Maybe I should just stop worrying about it.
  for (var i=1; i<guidepoints.length; i++) {
    if (guidepoints[i].y > y) {
      var x0 = guidepoints[i-1].x;
      var y0 = guidepoints[i-1].y;
      var x1 = guidepoints[i].x;
      var y1 = guidepoints[i].y;

      // This function implements Bresenham's line algorithm according to the
      // formula presented at http://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm,
      // which is specifically for the east-south-east octant. We implement only
      // the variants for the south-south-east and south-south-west octants,
      // as our point generation algorithms already preclude all other octants.
      if (x0 > x1) { // South-south-west octant
        return (((y - y0) / (y1 - y0) * (x0 - x1)) - x0) * -1;
      } else {  // South-south-east octant
        return ((y - y0) / (y1 - y0) * (x1 - x0)) + x0;
      }
    }
  }
}

function draw_galactic_plane() {
  var canvas_width = window.innerWidth;
  var canvas_height = window.innerHeight;

  var galactic_ecliptic = 5*canvas_width/8;

  var canvas = document.getElementById('canvas');
  canvas.width = canvas_width;
  canvas.height = canvas_height;

  var ctx = canvas.getContext('2d');

  var guidepoints = [
    {x: galactic_ecliptic, y: 0},
    {x: galactic_ecliptic, y: canvas_height},
  ];

  bend_line(guidepoints, 0, canvas_width / 30, canvas_height / 30, 5);

  // Visualize guidepoint generation while debugging
  if (false) {
    ctx.beginPath();
    ctx.moveTo(guidepoints[0].x, guidepoints[0].y);
    for (var i=1; i<guidepoints.length; i++) {
      ctx.lineTo(guidepoints[i].x, guidepoints[i].y);
    }
    ctx.strokeStyle = "white";
    ctx.stroke();
  }

  // Visualize Bresenham coordinates while debugging
  if (true) {
    ctx.beginPath();
    ctx.moveTo(guidepoints[0].x, guidepoints[0].y);
    for (var i=1; i<canvas_height; i++) {
      ctx.lineTo(get_x_coord_at_y_coord(guidepoints, i), i);
    }
    ctx.strokeStyle = "red";
    ctx.stroke();
  }

  // background band
  draw_galactic_band(ctx,
    canvas_height * 100,
    {min: 0.5, max: 0.8},
    "rgba(255, 255, 255, 0.05)",
    {min: 0, max: canvas_height},
    {mean: galactic_ecliptic, stdev: canvas_width/15},
    guidepoints);

  // background highlight band
  draw_galactic_band(ctx,
    canvas_height * 25,
    {min: 0.5, max: 0.8},
    "rgba(255, 255, 255, 0.075)",
    {min: 0, max: canvas_height},
    {mean: galactic_ecliptic, stdev: canvas_width/25},
    guidepoints);

  // foreground band
  draw_galactic_band(ctx,
    canvas_height * 10,
    {min: 0.1, max: 1.1},
    "rgba(255, 255, 255, 0.15)",
    {min: 0, max: canvas_height},
    {mean: galactic_ecliptic, stdev: canvas_width/6},
    guidepoints);

  // foreground highlight band
  draw_galactic_band(ctx,
    canvas_height/3,
    {min: 0.9, max: 1.5},
    "rgba(255, 255, 255, 0.35)",
    {min: 0, max: canvas_height},
    {mean: galactic_ecliptic, stdev: canvas_width/4},
    guidepoints);

  document.body.style.backgroundImage = "url(" + canvas.toDataURL() + ")";
  // We can't just blank the classnames inline with the rest of this function,
  // as the browser needs a reflow before it'll apply a CSS transition.
  // Fortunately the delay actually looks quite pleasant,
  // which is why we wait for a whole second rather than just a single milli.
  setTimeout(function() {
    //document.getElementById("curtain").className='hidden';
  }, 1000);
}

onload = draw_galactic_plane;
