"use strict";

/* ============================================================
   render-helpers.js — small helpers that turn data into markup.

   These build little pieces of visual content (SVG icons, the flower,
   the chart) and format the study text. A page calls one and drops the
   result into a container, e.g.

       document.getElementById('slot').innerHTML = flower_svg(2, 150);

   None of them touch progress or navigation; they only produce strings.
   ============================================================ */


/* ---- A tiny toast message at the bottom of the screen ---- */

let toast_hide_timer = null;

/* Show a short message that fades away on its own after ~2 seconds. */
function show_toast(message) {
  const toast_element = document.getElementById('toast');
  if (!toast_element) return;

  toast_element.textContent = message;
  toast_element.classList.add('show');

  clearTimeout(toast_hide_timer);
  toast_hide_timer = setTimeout(function () { toast_element.classList.remove('show'); }, 1900);
}


/* ---- Inline SVG icons (each returns an <svg> string) ---- */

/* The little three-petal logo shown next to the "Bloom" wordmark. */
function brand_mark_svg() {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
    + '<path d="M12 12.5 C 8.6 9.4 8.6 4.8 12 3 C 15.4 4.8 15.4 9.4 12 12.5 Z" fill="#e3ecdd" stroke="#5f7a5a" stroke-width="1.2"/>'
    + '<path d="M12 12.5 C 8.8 12.8 5 14.6 4.6 19 C 8.6 19 11.4 16.9 12 12.5 Z" fill="#e6ebf1" stroke="#8792ac" stroke-width="1.2"/>'
    + '<path d="M12 12.5 C 15.2 12.8 19 14.6 19.4 19 C 15.4 19 12.6 16.9 12 12.5 Z" fill="#e6ebf1" stroke="#8792ac" stroke-width="1.2"/>'
    + '</svg>';
}

/* Sidebar "Dashboard" icon (a 2x2 grid). */
function dashboard_icon_svg() { return '<svg class="ni" viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/></svg>'; }

/* Sidebar "Curriculum" icon (stacked lines). */
function curriculum_icon_svg() { return '<svg class="ni" viewBox="0 0 20 20"><path d="M4 6h12M4 10h12M4 14h8"/></svg>'; }

/* Sidebar "Exit" icon (door with an arrow). */
function exit_icon_svg() { return '<svg class="ni" viewBox="0 0 20 20"><path d="M12 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6"/><path d="M9.5 10H17M14 7l3 3-3 3"/></svg>'; }

/* Account-settings gear (topic-entry page). */
function gear_icon_svg() { return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>'; }

/* "Study" choice-card icon (an open book). */
function study_icon_svg() { return '<svg class="ci" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 1-2-2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 0 2-2V5Z"/></svg>'; }

/* "Assessment" choice-card icon (a checked clipboard). */
function assessment_icon_svg() { return '<svg class="ci" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 12l2 2 4-4"/></svg>'; }

/* "Defense" choice-card icon (a speech bubble). */
function defense_icon_svg() { return '<svg class="ci" viewBox="0 0 24 24"><path d="M4 5h16v10H9l-4 4V5Z"/><path d="M8 9h8M8 11.5h5"/></svg>'; }

/* Padlock icon for locked study cells and tree rows. */
function lock_icon_svg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'; }

/* Return an emblem for a subtopic, chosen by its name (so it survives the
   subtopics being reordered). Falls back to a generic "field lines" icon. */
function subtopic_icon_svg(subtopic_index) {
  const subtopic_name = (SUBTOPICS[subtopic_index] && SUBTOPICS[subtopic_index].name) || '';

  if (/gravit/i.test(subtopic_name)) return '<svg class="si" viewBox="0 0 32 32"><circle cx="16" cy="16" r="2.6" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="7.5"/><circle cx="16" cy="16" r="12"/></svg>';
  if (/electric/i.test(subtopic_name)) return '<svg class="si" viewBox="0 0 32 32"><circle cx="16" cy="16" r="3.2"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6M8 8l4 4M20 20l4 4M24 8l-4 4M8 24l4-4"/></svg>';
  if (/magnet/i.test(subtopic_name)) return '<svg class="si" viewBox="0 0 32 32"><path d="M9 6v9a7 7 0 0 0 14 0V6"/><path d="M6 6h6M6 6v4M20 6h6M26 6v4"/></svg>';

  return '<svg class="si" viewBox="0 0 32 32"><path d="M5 10c8 0 14 0 22 0M4 16c9 0 15 0 24 0M5 22c8 0 14 0 22 0"/></svg>';
}


/* Draw the mastery flower as an SVG string. `stage` is 0..3 (0 = a closed
   bud, 3 = full bloom); `size` is the width/height in pixels. More petals
   open and spread wider as the stage rises. */
function flower_svg(stage, size) {
  size = size || 150;

  const center_x = size / 2;
  const base_y = size * 0.66;          // where the stem meets the petals
  const openness = stage / 3;          // 0 (bud) .. 1 (fully open)

  // Build one petal, pointing up from the base, then rotated by `angle_degrees`.
  function make_petal(angle_degrees, length, width, fill_color, stroke_color) {
    const path = 'M0 0 C ' + width + ' ' + (-length * 0.32) + ' ' + (width * 0.5) + ' ' + (-length * 0.92) + ' 0 ' + (-length)
      + ' C ' + (-width * 0.5) + ' ' + (-length * 0.92) + ' ' + (-width) + ' ' + (-length * 0.32) + ' 0 0 Z';
    return '<path d="' + path + '" transform="translate(' + center_x + ',' + base_y + ') rotate(' + angle_degrees + ')" '
      + 'fill="' + fill_color + '" stroke="' + stroke_color + '" stroke-width="1.5" stroke-linejoin="round"/>';
  }

  // Colours for the three petal layers.
  const inner_stroke = '#7f8f70';
  const inner_fill = (stage === 0 ? '#e4ecdd' : '#eef2ea');
  const outer_stroke = '#98a3bd';
  const outer_fill = 'rgba(152,163,189,0.30)';
  const leaf_stroke = '#6f8468';
  const leaf_fill = 'rgba(124,150,120,0.32)';

  // Petal lengths and how far the petals fan out.
  const inner_length = size * 0.30;
  const outer_length = size * 0.40;
  const leaf_length = size * 0.21;
  const inner_spread = 5 + openness * 20;
  const outer_spread = 18 + openness * 46;

  // The stem.
  let svg_parts = '<line x1="' + center_x + '" y1="' + base_y + '" x2="' + center_x + '" y2="' + (size - 2) + '" stroke="' + leaf_stroke + '" stroke-width="2"/>';

  // Two base leaves, and two more once the flower is well open.
  svg_parts += make_petal(114, leaf_length * (0.6 + 0.4 * openness), size * 0.10, leaf_fill, leaf_stroke)
    + make_petal(-114, leaf_length * (0.6 + 0.4 * openness), size * 0.10, leaf_fill, leaf_stroke);
  if (stage >= 2) {
    svg_parts += make_petal(146, leaf_length * 0.8, size * 0.09, leaf_fill, leaf_stroke)
      + make_petal(-146, leaf_length * 0.8, size * 0.09, leaf_fill, leaf_stroke);
  }

  // The outer ring of petals appears from stage 1.
  if (stage >= 1) {
    [-2, -1, 1, 2].forEach(function (position) {
      svg_parts += make_petal(position * outer_spread / 2, outer_length, size * 0.135, outer_fill, outer_stroke);
    });
  }

  // Three inner petals are always present.
  [-1, 0, 1].forEach(function (position) {
    svg_parts += make_petal(position * inner_spread, inner_length, size * 0.11, inner_fill, inner_stroke);
  });

  // A little pollen dot at the centre once it is blooming.
  if (stage >= 2) {
    svg_parts += '<circle cx="' + center_x + '" cy="' + (base_y - inner_length * 0.5) + '" r="' + (size * 0.035) + '" fill="#d9c98a" stroke="#b9a45f" stroke-width="1"/>';
  }

  return '<svg class="flower" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" '
    + 'role="img" aria-label="mastery flower, stage ' + stage + ' of 3">' + svg_parts + '</svg>';
}


/* Draw the dashboard's small line chart as an SVG string. The data is a fixed
   mock — it is only a visual placeholder for "recent performance". */
function performance_chart_svg() {

  const sample_scores = [35, 42, 38, 55, 60, 72, 78];
  const width = 340;
  const height = 120;
  const padding = 12;
  const max_score = 100;

  // Turn each score into an [x, y] point across the chart.
  const x_step = (width - padding * 2) / (sample_scores.length - 1);
  const points = sample_scores.map(function (score, index) {
    return [padding + index * x_step, height - padding - (score / max_score) * (height - padding * 2)];
  });

  // The line through the points, and a filled area beneath it.
  const line_path = points.map(function (point, index) {
    return (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1);
  }).join(' ');
  const area_path = line_path
    + ' L ' + points[points.length - 1][0].toFixed(1) + ' ' + (height - padding)
    + ' L ' + points[0][0].toFixed(1) + ' ' + (height - padding) + ' Z';

  // Faint horizontal gridlines.
  let gridlines = '';
  [0.25, 0.5, 0.75].forEach(function (fraction) {
    const y_position = (padding + (height - padding * 2) * fraction).toFixed(1);
    gridlines += '<line x1="' + padding + '" y1="' + y_position + '" x2="' + (width - padding) + '" y2="' + y_position + '" stroke="#eef1ea"/>';
  });

  // A dot on each data point.
  const dot_circles = points.map(function (point) {
    return '<circle cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1) + '" r="2.6" fill="#4f6f52"/>';
  }).join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '">'
    + gridlines
    + '<line x1="' + padding + '" y1="' + (height - padding) + '" x2="' + (width - padding) + '" y2="' + (height - padding) + '" stroke="#dfe3da"/>'
    + '<path d="' + area_path + '" fill="rgba(79,111,82,0.10)"/>'
    + '<path d="' + line_path + '" fill="none" stroke="#4f6f52" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + dot_circles
    + '</svg>';
}


/* ---- Study text: Markdown + light LaTeX -> HTML ----
   Study bodies are Markdown with LaTeX maths ($...$ inline, $$...$$ block).
   With no build step or maths library we do a light, dependency-free pass:
   escape HTML, handle **bold**, and tidy common LaTeX tokens into Unicode.
   (With a build step, swap this for a real renderer such as KaTeX.) */

/* Escape the three characters that would otherwise be read as HTML. */
function escape_html(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Convert common LaTeX tokens in a maths snippet into readable Unicode/HTML
   (superscripts, fractions, √, ×, ≈, and so on). Best-effort, not a real
   maths engine. */
function latex_to_text(text) {
  text = text.replace(/\^\{([^{}]*)\}/g, function (whole_match, contents) { return '<sup>' + contents + '</sup>'; });
  text = text.replace(/_\{([^{}]*)\}/g, function (whole_match, contents) { return '<sub>' + contents + '</sub>'; });
  text = text.replace(/\^(-?[0-9A-Za-z])/g, function (whole_match, character) { return '<sup>' + character + '</sup>'; });
  text = text.replace(/_(-?[0-9A-Za-z])/g, function (whole_match, character) { return '<sub>' + character + '</sub>'; });
  text = text.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  text = text.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g, '$1');

  const symbol_replacements = {
    '\\times': '×', '\\cdot': '·', '\\approx': '≈', '\\neq': '≠', '\\pm': '±',
    '\\Delta': 'Δ', '\\to': '→', '\\infty': '∞', '\\leq': '≤', '\\geq': '≥', '\\propto': '∝',
    '\\qquad': ' ', '\\quad': ' ', '\\,': ' ', '\\ ': ' ', '\\!': ''
  };
  for (const token in symbol_replacements) { text = text.split(token).join(symbol_replacements[token]); }

  text = text.replace(/[{}]/g, '');
  text = text.replace(/\\([A-Za-z]+)/g, '$1');
  return text;
}

/* Format a single line of Markdown: escape HTML, then turn $$…$$ and $…$ into
   maths spans and **…** into bold. */
function format_inline(text) {
  text = escape_html(text);
  text = text.replace(/\$\$([^$]+)\$\$/g, function (whole_match, maths) { return '<span class="math">' + latex_to_text(maths.trim()) + '</span>'; });
  text = text.replace(/\$([^$]+)\$/g, function (whole_match, maths) { return '<span class="math">' + latex_to_text(maths) + '</span>'; });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return text;
}

/* Turn a whole Markdown body into HTML paragraphs. A paragraph that is
   nothing but a $$…$$ block becomes a centred formula. */
function render_body(markdown_text) {
  const paragraphs = String(markdown_text).split(/\n\n+/);

  return paragraphs.map(function (paragraph) {
    paragraph = paragraph.trim();

    const display_formula = paragraph.match(/^\$\$([\s\S]+)\$\$$/);
    if (display_formula) return '<div class="formula">' + latex_to_text(display_formula[1].trim()) + '</div>';

    return '<p>' + format_inline(paragraph) + '</p>';
  }).join('');
}

/* Render a "further reading" list of links, or an empty string if there are none. */
function render_further_reading(links) {
  if (!links || !links.length) return '';

  const list_items = links.map(function (link) {
    return '<li><a href="' + link.url + '" target="_blank" rel="noopener noreferrer">' + escape_html(link.title) + '</a></li>';
  }).join('');

  return '<div class="further"><div class="further-cap">Further reading</div><ul>' + list_items + '</ul></div>';
}
