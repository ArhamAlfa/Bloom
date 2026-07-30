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
function performance_chart_svg(history) {

  const scores = Array.isArray(history) ? history : [];

  const width = 700;
  const height = 220;
  const padding = 16;
  const max_score = 100;

  // Map a 0..100 value to a y coordinate (0% at the bottom, 100% at the top).
  function y_for(value) {
    return height - padding - (value / max_score) * (height - padding * 2);
  }

  // The tier boundaries. Tier 1 fills 0..33.3%, Tier 2 33.3..66.7%, Tier 3 above.
  const tier2_y = y_for(100 / 3);
  const tier3_y = y_for(200 / 3);

  // Faint band shading for the three tier regions (darker higher up).
  const band_tier1 = '<rect x="' + padding + '" y="' + tier2_y.toFixed(1) + '" width="' + (width - padding * 2) + '" height="' + ((height - padding) - tier2_y).toFixed(1) + '" fill="rgba(79,111,82,0.04)"/>';
  const band_tier2 = '<rect x="' + padding + '" y="' + tier3_y.toFixed(1) + '" width="' + (width - padding * 2) + '" height="' + (tier2_y - tier3_y).toFixed(1) + '" fill="rgba(79,111,82,0.09)"/>';
  const band_tier3 = '<rect x="' + padding + '" y="' + padding + '" width="' + (width - padding * 2) + '" height="' + (tier3_y - padding).toFixed(1) + '" fill="rgba(79,111,82,0.14)"/>';

  // A labelled, dashed boundary line.
  function dashed_boundary(y_position, label) {
    return '<line x1="' + padding + '" y1="' + y_position.toFixed(1) + '" x2="' + (width - padding) + '" y2="' + y_position.toFixed(1) + '" stroke="#8aa08c" stroke-width="1" stroke-dasharray="4 3"/>'
      + '<text x="' + (width - padding) + '" y="' + (y_position - 3).toFixed(1) + '" text-anchor="end" font-size="8" fill="#8aa08c">' + label + '</text>';
  }
  const tier_boundaries = dashed_boundary(tier2_y, 'Tier 2') + dashed_boundary(tier3_y, 'Tier 3');

  const baseline = '<line x1="' + padding + '" y1="' + (height - padding) + '" x2="' + (width - padding) + '" y2="' + (height - padding) + '" stroke="#dfe3da"/>';

  // No data yet: show the bands and a gentle hint, no line.
  if (scores.length === 0) {
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="none" style="display:block">'
      + band_tier1 + band_tier2 + band_tier3 + tier_boundaries + baseline
      + '<text x="' + (width / 2) + '" y="' + (height / 2) + '" text-anchor="middle" font-size="9" fill="#9aa79b">Answer questions to grow your curve.</text>'
      + '</svg>';
  }

  // Spread the points across the width (a single point sits at the left edge).
  let x_step = 0;
  if (scores.length > 1) {
    x_step = (width - padding * 2) / (scores.length - 1);
  }
  const points = scores.map(function (score, index) {
    return [padding + index * x_step, y_for(score)];
  });

  const line_path = points.map(function (point, index) {
    return (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1);
  }).join(' ');
  const area_path = line_path
    + ' L ' + points[points.length - 1][0].toFixed(1) + ' ' + (height - padding)
    + ' L ' + points[0][0].toFixed(1) + ' ' + (height - padding) + ' Z';

  const dot_circles = points.map(function (point) {
    return '<circle cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1) + '" r="2.4" fill="#4f6f52"/>';
  }).join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="none" style="display:block">'
    + band_tier1 + band_tier2 + band_tier3
    + tier_boundaries
    + baseline
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

/* ---- Chat message: light Markdown -> HTML ----
   The examiner writes in Markdown (paragraphs, **bold**, and simple bulleted
   or numbered lists) with real newlines. HTML would otherwise collapse those
   newlines into single spaces, which is why the raw reply looks like one solid
   block. This walks the text line by line and rebuilds the structure. Inline
   formatting (and HTML escaping) is delegated to format_inline, so the output
   is safe to assign to innerHTML. */
function render_chat_markdown(markdown_text) {
  const source_text = String(markdown_text).replace(/\r\n/g, '\n');
  const lines = source_text.split('\n');

  // Finished HTML blocks, in order.
  const html_blocks = [];

  // A run of consecutive list items we are still gathering.
  let open_list_items = [];
  let open_list_tag = '';          // 'ul' or 'ol' while a list is open, else ''.

  // A run of consecutive text lines that form one paragraph.
  let paragraph_lines = [];

  // Close off the paragraph we were building, if any.
  function flush_paragraph() {
    if (paragraph_lines.length === 0) {
      return;
    }

    const paragraph_html = paragraph_lines.join('<br>');
    html_blocks.push('<p>' + paragraph_html + '</p>');
    paragraph_lines = [];
  }

  // Close off the list we were building, if any.
  function flush_list() {
    if (open_list_items.length === 0) {
      return;
    }

    const items_html = open_list_items.join('');
    html_blocks.push('<' + open_list_tag + '>' + items_html + '</' + open_list_tag + '>');
    open_list_items = [];
    open_list_tag = '';
  }

  for (let line_index = 0; line_index < lines.length; line_index = line_index + 1) {
    const trimmed_line = lines[line_index].trim();

    // A blank line ends the current paragraph and list.
    if (trimmed_line === '') {
      flush_paragraph();
      flush_list();
      continue;
    }

    // A bulleted item: "- text" or "* text".
    const bullet_match = trimmed_line.match(/^[-*]\s+(.*)$/);
    if (bullet_match) {
      flush_paragraph();

      if (open_list_tag !== 'ul') {
        flush_list();
        open_list_tag = 'ul';
      }

      const item_html = format_inline(bullet_match[1]);
      open_list_items.push('<li>' + item_html + '</li>');
      continue;
    }

    // A numbered item: "1. text".
    const number_match = trimmed_line.match(/^\d+\.\s+(.*)$/);
    if (number_match) {
      flush_paragraph();

      if (open_list_tag !== 'ol') {
        flush_list();
        open_list_tag = 'ol';
      }

      const item_html = format_inline(number_match[1]);
      open_list_items.push('<li>' + item_html + '</li>');
      continue;
    }

    // A heading: "# text" .. "###### text". Shown as a bold line.
    const heading_match = trimmed_line.match(/^#{1,6}\s+(.*)$/);
    if (heading_match) {
      flush_paragraph();
      flush_list();

      const heading_html = format_inline(heading_match[1]);
      html_blocks.push('<p class="chat-h"><strong>' + heading_html + '</strong></p>');
      continue;
    }

    // Anything else is a normal line of the current paragraph.
    flush_list();
    paragraph_lines.push(format_inline(trimmed_line));
  }

  flush_paragraph();
  flush_list();

  return html_blocks.join('');
}


/* Render a "further reading" list of links, or an empty string if there are none. */
function render_further_reading(links) {
  if (!links || !links.length) return '';

  const list_items = links.map(function (link) {
    return '<li><a href="' + link.url + '" target="_blank" rel="noopener noreferrer">' + escape_html(link.title) + '</a></li>';
  }).join('');

  return '<div class="further"><div class="further-cap">Further reading</div><ul>' + list_items + '</ul></div>';
}
