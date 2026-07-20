"use strict";

/* ============================================================
   sidebar.js — fills in the shared sidebar.

   Every in-app page contains the same sidebar markup (see any of the
   HTML files). The static structure lives in the HTML; this file fills
   the parts that depend on data: the icons, the active-tab highlight,
   the current-tier readout, and the "contents" tree.

   A page calls fill_sidebar once, telling it which tab is active and,
   if we are inside a subtopic, which subtopic and study page we are on:

       fill_sidebar('curriculum', progress, null, null);   // a top-level page
       fill_sidebar('curriculum', progress, 1, 2);         // studying subtopic 1, page 2
   ============================================================ */


/* Fill every dynamic part of the sidebar for the current page. */
function fill_sidebar(active_tab, progress, subtopic_index, study_page_index) {

  // Drop the brand mark and the three nav icons into their slots.
  document.getElementById('brand-mark').innerHTML = brand_mark_svg();
  document.querySelectorAll('.ni-slot').forEach(function (icon_slot) {
    const icon_kind = icon_slot.getAttribute('data-icon');
    icon_slot.innerHTML = icon_kind === 'dash' ? dashboard_icon_svg()
      : icon_kind === 'curric' ? curriculum_icon_svg()
        : icon_kind === 'exit' ? exit_icon_svg() : '';
  });

  // Highlight the nav link for the page we are on.
  const active_link = document.querySelector('.nav-item[data-nav="' + active_tab + '"]');
  if (active_link) active_link.classList.add('active');

  // Fill the current-tier card: the tier name, the progress bar, and the count.
  const cleared_count = count_subtopics_cleared(progress);
  const percent = Math.round(cleared_count / SUBTOPICS.length * 100);
  document.getElementById('side-tier').textContent = 'Tier ' + progress.current_tier;
  document.getElementById('side-xp').style.width = percent + '%';
  document.getElementById('side-sub').textContent = cleared_count + ' / ' + SUBTOPICS.length + ' subtopics';

  // A quiet marker so it is obvious which screen of the flow we are on.
  const demo_marker = document.getElementById('demo-state');
  if (demo_marker) demo_marker.textContent = 'demo state · ' + active_tab;

  // Build the contents tree at the bottom.
  build_contents_tree(progress, subtopic_index, study_page_index);
}


/* Build the "contents" tree in the sidebar. Inside a subtopic it lists that
   subtopic's study pages (marking the current one, and locking the capstone
   until Tier 2 is mastered). Everywhere else it lists the subtopics. Every
   row is a real link. */
function build_contents_tree(progress, subtopic_index, study_page_index) {
  const tree_element = document.getElementById('side-tree');
  if (!tree_element) return;

  // Not inside a subtopic: list the subtopics ("modules").
  if (subtopic_index == null) {
    const module_rows = SUBTOPICS.map(function (subtopic, index) {
      return '<a class="tree-mod" href="subtopic.html?i=' + index + '">'
        + '<span class="tree-num">' + (index + 1) + '</span>'
        + '<span class="tree-title">' + subtopic.name + '</span></a>';
    }).join('');

    tree_element.innerHTML = '<div class="tree-head">Modules</div>' + module_rows;
    return;
  }

  // Inside a subtopic: list its study pages.
  const page_rows = get_study_pages(subtopic_index).map(function (page, page_index) {
    const is_locked = (page.kind === 'capstone' && !progress.mastery[subtopic_index][2].is_mastered);
    const active_class = (study_page_index != null && study_page_index === page_index) ? ' active' : '';

    return '<a class="tree-page' + active_class + (is_locked ? ' locked' : '') + '" '
      + 'href="study.html?i=' + subtopic_index + '&page=' + page_index + '">'
      + '<span class="tree-num">' + page.num + '</span>'
      + '<span class="tree-title">' + page.title + '</span>'
      + (is_locked ? '<span class="lock-mini">' + lock_icon_svg() + '</span>' : '')
      + '</a>';
  }).join('');

  tree_element.innerHTML = '<div class="tree-head">' + SUBTOPICS[subtopic_index].name + '</div>' + page_rows;
}
