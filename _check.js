
"use strict";

/* ============================================================
   BLOOM PATHWAY — throwaway proof-of-concept UI (all mocked).
   A clickable state machine of screens. No AI, no backend.
   ============================================================ */

/* ---------- 1. MOCK DATA (hardcoded) ---------- */
const TIER_NAMES = {
  1: 'Tier 1 · Knowledge & Comprehension',
  2: 'Tier 2 · Application & Analysis',
  3: 'Tier 3 · Synthesis & Evaluation'
};

const SUBTOPICS = [
  {
    name: 'Gravitational fields',
    skills: ['g = F/m', 'g = GM/r²', "Newton's law of gravitation"],
    study: {
      1: "A gravitational field is the region around a mass where another mass feels a force. Field strength g is the force per unit mass: g = F/m, measured in N/kg. Near Earth's surface g ≈ 9.8 N/kg and points toward the centre of the Earth.",
      2: "For a point mass, g = GM/r². Field strength falls off with the inverse square of distance, so doubling r quarters g. To find a force, multiply the local field by the mass: F = mg. Fields from several masses add as vectors.",
      3: "Synthesis: the point-mass model assumes spherical symmetry and treats all the mass as concentrated at a point. It breaks down inside an extended body, for non-spherical distributions, and in strong fields where general relativity is needed. Be ready to justify where g = GM/r² applies and where it fails."
    },
    defenseOpener: "You've claimed to understand gravitational fields. Tell me — when does the g = GM/r² point-mass model stop being valid, and why?"
  },
  {
    name: 'Electric fields',
    skills: ['E = F/q', "Coulomb's law", 'E from a point charge'],
    study: {
      1: "An electric field surrounds any charge. Field strength E is the force per unit positive charge: E = F/q, in N/C. Field lines run from positive to negative charges and never cross.",
      2: "Coulomb's law gives the force between point charges: F = kq₁q₂/r², an inverse-square law. The field of a point charge is E = kQ/r². Superpose fields from several charges as vectors to find the net field.",
      3: "Synthesis: a point-charge model ignores the finite size of real charge distributions and the way conductors rearrange charge. At a conductor's surface the field is perpendicular and the interior field is zero. Be ready to defend when the point model is a good approximation."
    },
    defenseOpener: "You say you understand electric fields. Where does treating a charge as a point source break down, and what changes at a conductor's surface?"
  },
  {
    name: 'Magnetic fields',
    skills: ['F = BIL', 'F = qvB', 'Direction rules'],
    study: {
      1: "A magnetic field exerts forces on moving charges and currents. A current-carrying wire in a field feels F = BIL when the current is perpendicular to the field. Magnetic flux density B is measured in tesla (T).",
      2: "A single charge moving through a field feels F = qvB, maximum when v is perpendicular to B and zero when parallel. The force is always perpendicular to both v and B, given by the right-hand rule, which curves the charge into a circle.",
      3: "Synthesis: magnetism and electricity are frame-dependent facets of one electromagnetic field. A charge at rest feels no magnetic force, but in a frame where it moves it does. Be ready to reason about why the magnetic force is always perpendicular to motion and does no work."
    },
    defenseOpener: "Convince me you understand magnetic fields. Why does a static charge feel no magnetic force while a moving one does?"
  }
];

// One question per skill, per tier (index aligns with the skills array).
const QUESTIONS = {
  0: {
    1: [
      {type:'mcq',  prompt:'Gravitational field strength g is defined as…', options:['F · m','F / m','m / F','G · M'], answer:1},
      {type:'short',prompt:'State the units of gravitational field strength.', answer:'N/kg (or m/s²)'},
      {type:'mcq',  prompt:"In Newton's law of gravitation, the force between two masses is proportional to…", options:['r','1/r','1/r²','r²'], answer:2}
    ],
    2: [
      {type:'short',prompt:'A 2 kg mass sits where g = 9.8 N/kg. Find the force on it, then on a 5 kg mass at the same point.', answer:'19.6 N, then 49 N  (F = mg)'},
      {type:'mcq',  prompt:'Double your distance from a point mass. Its field strength g becomes…', options:['×2','÷2','÷4','×4'], answer:2},
      {type:'mcq',  prompt:'Surface field is g. At radius 2R (same mass) the field is about…', options:['g','g/2','g/4','2g'], answer:2}
    ]
  },
  1: {
    1: [
      {type:'mcq',  prompt:'Electric field strength E is defined as…', options:['F · q','q / F','F / q','k · Q'], answer:2},
      {type:'short',prompt:'State the units of electric field strength.', answer:'N/C (or V/m)'},
      {type:'mcq',  prompt:"In Coulomb's law the force between two point charges is proportional to…", options:['1/r²','r²','1/r','r'], answer:0}
    ],
    2: [
      {type:'short',prompt:'A +2 μC charge feels a force of 0.10 N in a field. Find E.', answer:'E = F/q = 0.10 / 2×10⁻⁶ = 5×10⁴ N/C'},
      {type:'mcq',  prompt:'Electric field lines point…', options:['from − to +','from + to −','in closed loops','randomly'], answer:1},
      {type:'mcq',  prompt:'Halve the distance to a point charge. The field E becomes…', options:['×2','×4','÷2','÷4'], answer:1}
    ]
  },
  2: {
    1: [
      {type:'mcq',  prompt:'The force on a current-carrying wire in a field is F =…', options:['qvB','BIL','½BIL','IL/B'], answer:1},
      {type:'short',prompt:'State the unit of magnetic flux density B.', answer:'tesla (T)'},
      {type:'mcq',  prompt:'The force F = qvB on a moving charge is maximum when v is … to B.', options:['parallel','anti-parallel','perpendicular','at 45°'], answer:2}
    ],
    2: [
      {type:'short',prompt:'A 0.5 m wire carries 3 A at 90° in a 0.2 T field. Find the force.', answer:'F = BIL = 0.2 × 3 × 0.5 = 0.3 N'},
      {type:'mcq',  prompt:'A charge moving parallel to B feels a magnetic force of…', options:['maximum','qvB','zero','qE'], answer:2},
      {type:'mcq',  prompt:'The magnetic force on a moving charge is always … its velocity.', options:['parallel to','perpendicular to','opposite to','independent of'], answer:1}
    ]
  }
};

// Scripted Tier 3 "thesis defense" exchanges (student replies are canned).
const DEFENSE = {
  0: [
    {student:"It assumes all the mass acts at a point, so it fails inside an extended body and for non-spherical mass distributions.",
     examiner:"Reasonable. Push further — what about very strong fields, say near a compact star?"},
    {student:"There Newtonian gravity breaks down and you need general relativity; g = GM/r² is only a weak-field approximation.",
     examiner:"Good. One more — for a valid point mass, what quantity stays fixed as r changes?"},
    {student:"The product g·r² stays constant — that's just the inverse-square law restated.",
     examiner:"I've heard enough to reach a verdict."}
  ],
  1: [
    {student:"The point model ignores the physical size of a charged object and any induced charge on nearby conductors.",
     examiner:"And at the surface of a conductor in equilibrium?"},
    {student:"The field there is perpendicular to the surface, and the field inside the conductor is zero.",
     examiner:"Why must the internal field be zero?"},
    {student:"Because free charges rearrange until they cancel any internal field — otherwise they'd keep moving.",
     examiner:"Enough. Let me judge."}
  ],
  2: [
    {student:"The magnetic force is F = qvB, so it's zero when v = 0 — only moving charge couples to the field.",
     examiner:"That raises a puzzle: motion is relative. Whose frame decides?"},
    {student:"It's frame-dependent — electric and magnetic fields transform into each other between observers; they're one field.",
     examiner:"Then why does the magnetic force do no work?"},
    {student:"Because it's always perpendicular to the velocity, so it changes direction but not speed.",
     examiner:"Good enough for a verdict."}
  ]
};

/* ---------- 2. STATE ---------- */
function freshState(){
  return {
    screen: 'splash',
    currentBand: 1,          // tier-major: whole cohort works one band at a time
    currentSubtopic: 0,
    lastSubtopic: null,
    flowerStage: 0,          // number of fully-cleared bands (0..3)
    courseComplete: false,
    pendingUnlock: null,
    returnFromExit: 'dashboard',
    progress: SUBTOPICS.map(function(){
      return { 1:{skills:0,done:false}, 2:{skills:0,done:false}, 3:{defense:'none'} };
    }),
    exam: null,              // transient Tier 1/2 loop state
    chat: null               // transient Tier 3 defense state
  };
}
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

// A pre-baked "save" so the has-save -> Resume branch is demoable immediately.
let savedExists = true;
let saved = (function(){
  const s = freshState();
  s.screen = 'dashboard';
  s.currentBand = 2;
  s.flowerStage = 1;                         // Tier 1 band already cleared
  s.progress[0][1] = {skills:3, done:true};
  s.progress[1][1] = {skills:3, done:true};
  s.progress[2][1] = {skills:3, done:true};
  s.progress[1][2] = {skills:1, done:false}; // mid Tier 2
  s.lastSubtopic = 1;
  return s;
})();

let state = freshState();

/* ---------- 3. SMALL HELPERS ---------- */
function tierShort(b){ return 'Tier ' + b; }
function skillsN(i){ return SUBTOPICS[i].skills.length; }

function bandsClearedText(){
  return ['Bud — no bands cleared','Tier 1 cleared','Tier 2 cleared','Full bloom — Tier 3 cleared'][state.flowerStage];
}
function bandProgressText(){
  if(state.courseComplete) return 'All bands complete';
  const b = state.currentBand;
  const done = state.progress.filter(function(p){ return b===3 ? p[3].defense==='passed' : p[b].done; }).length;
  return tierShort(b) + ' band: ' + done + '/' + SUBTOPICS.length + ' subtopics mastered';
}
function skillDone(i, band, si){
  if(band===3) return state.progress[i][3].defense==='passed';
  return si < state.progress[i][band].skills;
}
function bandStatus(i, band){
  const p = state.progress[i];
  if(band===3){
    if(p[3].defense==='passed')    return {label:'Defense passed', cls:'ok'};
    if(p[3].defense==='sent-back') return {label:'Sent to review', cls:'warn'};
    return {label:'Not attempted', cls:'muted'};
  }
  const m = p[band];
  if(m.done)      return {label:'Mastered', cls:'ok'};
  if(m.skills>0)  return {label:'In progress', cls:'warn'};
  return {label:'Not started', cls:'muted'};
}
function bar(pct){ return '<div class="bar"><div class="fill" style="width:'+pct+'%"></div></div>'; }

/* ---------- 4. FLOWER (SVG, blooms by stage 0..3) ---------- */
function flowerSVG(stage, size){
  size = size || 140;
  const cx = size/2, cy = size/2 - 4;
  const open = stage/3;                    // 0..1
  const dist = 7 + open*23;                // petal distance from centre
  const pL   = 12 + open*10;               // petal length
  const pW   = 7 + open*6;                 // petal width
  const petalFill  = ['#8cc07a','#f7b7ce','#f48fb1','#ec5f97'][stage];
  const centerFill = ['#6fa85e','#ffe082','#ffd54f','#ffc107'][stage];
  const centerR = 5 + open*7;
  let petals = '';
  const n = 8;
  for(let k=0;k<n;k++){
    const a = k*(360/n);
    petals += '<g transform="rotate('+a+' '+cx+' '+cy+')">'
            + '<ellipse cx="'+cx+'" cy="'+(cy-dist)+'" rx="'+pW+'" ry="'+pL+'" fill="'+petalFill+'" stroke="rgba(0,0,0,.08)"/>'
            + '</g>';
  }
  const stem = '<line x1="'+cx+'" y1="'+cy+'" x2="'+cx+'" y2="'+(size-6)+'" stroke="#4c8a3f" stroke-width="4" stroke-linecap="round"/>'
    + '<path d="M'+cx+' '+(size-26)+' q -18 -4 -26 -18 q 20 -2 26 12 z" fill="#5aa049"/>'
    + '<path d="M'+cx+' '+(size-16)+' q 18 -4 26 -18 q -20 -2 -26 12 z" fill="#5aa049"/>';
  return '<svg class="flower" viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" aria-label="flower stage '+stage+'">'
    + stem + petals
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+centerR+'" fill="'+centerFill+'" stroke="rgba(0,0,0,.10)"/>'
    + '</svg>';
}

/* ---------- 5. MOCK PERFORMANCE CHART ---------- */
function chartSVG(){
  const vals = [30,45,40,60,55,75,70];
  const w=260,h=90,pad=6;
  const slot=(w-pad*2)/vals.length, bw=slot-7;
  let bars='';
  vals.forEach(function(v,i){
    const bh=v/100*(h-18), x=pad+i*slot+3, y=h-bh-4;
    bars+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="3" fill="#ec7fb0"/>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" class="chart">'
    + '<line x1="4" y1="'+(h-4)+'" x2="'+(w-4)+'" y2="'+(h-4)+'" stroke="#e6dfda"/>'+bars+'</svg>';
}

/* ---------- 6. SCREEN RENDERERS ---------- */
function splash(){
  return '<div class="card center">'
    + '<div class="logo">🌸 Bloom Pathway</div>'
    + '<p class="sub">Adaptive learning up Bloom’s Taxonomy — grow a topic from a bud to full bloom.</p>'
    + flowerSVG(savedExists ? saved.flowerStage : 0, 150)
    + '<div class="btn-row center">'
    +   '<button class="btn primary" data-action="newRun">Start new</button>'
    +   '<button class="btn" data-action="resume" '+(savedExists?'':'disabled')+'>Resume '+(savedExists?'(demo save)':'')+'</button>'
    + '</div>'
    + '<p class="hint">Entry point → “Has save?”  ·  <b>New</b> goes to topic entry; <b>Resume</b> jumps straight to the dashboard.</p>'
    + '</div>';
}

function topicEntry(){
  return '<div class="card">'
    + '<h1>What do you want to learn?</h1>'
    + '<p class="sub">Type anything — the demo loads a hardcoded IB Physics curriculum.</p>'
    + '<input id="topicInput" class="input" placeholder="e.g. Fields in physics" value="Fields in physics">'
    + '<div class="btn-row">'
    +   '<button class="btn primary" data-action="submitTopic">Generate curriculum →</button>'
    +   '<button class="btn ghost" data-action="toSplash">Back</button>'
    + '</div>'
    + '<p class="hint">Input is ignored — any text loads: <b>Topic → Subtopics → Skills</b>.</p>'
    + '</div>';
}

function dashboard(){
  return '<div class="card">'
    + '<div class="topline"><h1>Dashboard</h1><span class="pill">'+TIER_NAMES[state.currentBand]+'</span></div>'
    + '<div class="dash-grid">'
    +   '<div class="panel center">'+flowerSVG(state.flowerStage,120)
    +     '<div class="cap" style="margin-top:6px">Bloom progress</div>'
    +     '<div class="muted small">'+bandsClearedText()+'</div></div>'
    +   '<div class="panel">'
    +     '<div class="cap">Most recent subtopic</div>'
    +     '<div class="big">'+(state.lastSubtopic!=null?SUBTOPICS[state.lastSubtopic].name:'— none yet')+'</div>'
    +     '<div class="cap" style="margin-top:14px">Weekly performance</div>'+chartSVG()
    +   '</div>'
    + '</div>'
    + '<div class="btn-row">'
    +   '<button class="btn primary" data-action="toCurriculum">Go to curriculum →</button>'
    +   '<button class="btn ghost" data-action="toExit">Exit</button>'
    + '</div></div>';
}

function curriculum(){
  const rows = SUBTOPICS.map(function(s,i){
    const st = bandStatus(i, state.currentBand);
    const chips = s.skills.map(function(sk,si){
      return '<span class="skill '+(skillDone(i,state.currentBand,si)?'done':'')+'">'+sk+'</span>';
    }).join('');
    return '<button class="row" data-action="selectSubtopic" data-arg="'+i+'">'
      + '<div><div class="row-title">'+s.name+'</div><div class="row-sub">'+chips+'</div></div>'
      + '<span class="chip '+st.cls+'">'+st.label+'</span></button>';
  }).join('');
  return '<div class="card">'
    + '<div class="topline"><h1>Curriculum</h1><span class="pill">Current band: '+TIER_NAMES[state.currentBand]+'</span></div>'
    + '<div class="curric">'
    +   '<div class="panel center">'+flowerSVG(state.flowerStage,140)
    +     '<div class="cap" style="margin-top:8px">'+bandsClearedText()+'</div>'
    +     '<div class="muted small">'+bandProgressText()+'</div></div>'
    +   '<div class="list">'+rows+'</div>'
    + '</div>'
    + (state.courseComplete ? '<p class="hint ok">🌸 Full bloom — all three bands cleared across every subtopic. Course complete!</p>' : '')
    + '<div class="btn-row">'
    +   '<button class="btn ghost" data-action="toDashboard">← Dashboard</button>'
    +   '<button class="btn ghost" data-action="toExit">Exit</button>'
    + '</div></div>';
}

function subtopic(){
  const s = SUBTOPICS[state.currentSubtopic];
  const t3 = state.currentBand===3;
  return '<div class="card">'
    + '<button class="back" data-action="toCurriculum">← Curriculum</button>'
    + '<div class="topline"><h1>'+s.name+'</h1><span class="pill">'+TIER_NAMES[state.currentBand]+'</span></div>'
    + '<p class="sub">Skills at this band: '+s.skills.join('  ·  ')+'</p>'
    + '<div class="choice">'
    +   '<button class="tile" data-action="toStudy"><div class="tile-ico">📖</div>'
    +     '<div class="tile-t">Study</div><div class="tile-d">Read the '+tierShort(state.currentBand)+' material for this subtopic.</div></button>'
    +   '<button class="tile" data-action="toExam"><div class="tile-ico">'+(t3?'🎓':'📝')+'</div>'
    +     '<div class="tile-t">Exam mode</div><div class="tile-d">'
    +     (t3?'Defend your understanding to the examiner.':'Answer questions until the skill bar fills.')+'</div></button>'
    + '</div>'
    + '<p class="hint">Exam mode auto-picks the engine from the current band — Tier 1/2 run a question loop, Tier 3 runs the defense chat.</p>'
    + '</div>';
}

function study(){
  const s = SUBTOPICS[state.currentSubtopic];
  return '<div class="card">'
    + '<button class="back" data-action="toSubtopic">← '+s.name+'</button>'
    + '<div class="topline"><h1>📖 '+s.name+'</h1><span class="pill">'+TIER_NAMES[state.currentBand]+'</span></div>'
    + '<div class="wiki">'+s.study[state.currentBand]+'</div>'
    + '<div class="ask"><input class="input" placeholder="Ask the assistant… (demo — not wired up)" disabled>'
    +   '<button class="btn ghost" disabled>Ask</button></div>'
    + '<div class="btn-row">'
    +   '<button class="btn primary" data-action="toExam">Go to exam mode →</button>'
    +   '<button class="btn ghost" data-action="toSubtopic">Back</button>'
    + '</div></div>';
}

/* ----- Exam mode: dispatch on the subtopic's current band ----- */
function examScreen(){
  return state.currentBand===3 ? defenseScreen() : loopScreen();
}

function loopScreen(){
  const i = state.currentSubtopic, band = state.currentBand;
  const s = SUBTOPICS[i], p = state.progress[i][band];
  if(p.done) return masteredCard();

  const idx = p.skills;                                   // next skill to master
  const q   = QUESTIONS[i][band][idx];
  const pct = Math.round(p.skills / skillsN(i) * 100);
  const chips = s.skills.map(function(sk,si){
    return '<span class="skill '+(si<p.skills?'done':'')+'">'+(si<p.skills?'✓ ':'')+sk+'</span>';
  }).join('');

  let body = q.type==='mcq' ? mcqOptions(q) : shortAnswer();

  return '<div class="card">'
    + '<button class="back" data-action="toSubtopic">← '+s.name+'</button>'
    + '<div class="topline"><h1>📝 Exam — '+s.name+'</h1><span class="pill">'+TIER_NAMES[band]+'</span></div>'
    + '<div class="mastery"><div class="cap">Mastery · '+p.skills+'/'+skillsN(i)+' skills</div>'
    +   bar(pct)+'<div class="skills">'+chips+'</div></div>'
    + '<div class="q"><div class="q-tag">Targeting skill: '+s.skills[idx]+'</div>'
    +   '<div class="q-prompt">'+q.prompt+'</div>'+body+'</div>'
    + gradeArea(q)
    + '</div>';
}

function mcqOptions(q){
  const submitted = state.exam.submitted, chosen = state.exam.chosen;
  const opts = q.options.map(function(o,oi){
    let cls='opt';
    if(submitted){ if(oi===q.answer) cls+=' correct'; else if(oi===chosen) cls+=' wrong'; }
    else if(oi===chosen) cls+=' sel';
    return '<button class="'+cls+'" data-action="selectMcq" data-arg="'+oi+'" '+(submitted?'disabled':'')+'>'
      + String.fromCharCode(97+oi)+') '+o+'</button>';
  }).join('');
  return '<div class="opts">'+opts+'</div>';
}
function shortAnswer(){
  return '<textarea class="input area" placeholder="Type your answer… (demo ignores it)" '
    + (state.exam.submitted?'disabled':'')+'></textarea>';
}
function gradeArea(q){
  if(!state.exam.submitted){
    return '<div class="btn-row"><button class="btn primary" data-action="submitAnswer">Send to grader →</button>'
      + '<button class="btn ghost" data-action="toSubtopic">Quit exam</button></div>';
  }
  const model = q.type==='mcq' ? (String.fromCharCode(97+q.answer)+') '+q.options[q.answer]) : q.answer;
  return '<div class="graded">'
    + '<div class="answer"><b>Model answer:</b> '+model+'</div>'
    + '<div class="cap">Grade it — faked, you steer</div>'
    + '<div class="btn-row">'
    +   '<button class="btn ok" data-action="gradeCorrect">✓ Mark correct</button>'
    +   '<button class="btn danger" data-action="gradeIncorrect">✗ Mark incorrect</button>'
    +   '<button class="btn ghost" data-action="coinFlip">🎲 Coin-flip</button>'
    + '</div></div>';
}
function masteredCard(){
  const s = SUBTOPICS[state.currentSubtopic];
  return '<div class="card"><button class="back" data-action="toCurriculum">← Curriculum</button>'
    + '<div class="topline"><h1>✅ '+s.name+'</h1><span class="pill">'+TIER_NAMES[state.currentBand]+'</span></div>'
    + '<p class="sub">Already mastered at this tier — nothing left to grade here.</p>'
    + '<div class="skills">'+s.skills.map(function(sk){return '<span class="skill done">✓ '+sk+'</span>';}).join('')+'</div>'
    + '<div class="btn-row"><button class="btn primary" data-action="toCurriculum">Back to curriculum →</button></div></div>';
}

function defenseScreen(){
  const i = state.currentSubtopic, s = SUBTOPICS[i], script = DEFENSE[i];
  const log = state.chat.log.map(function(m){
    return '<div class="msg '+m.who+'"><div class="who">'+(m.who==='ex'?'Examiner':'You')+'</div>'
      + '<div class="bubble">'+m.text+'</div></div>';
  }).join('');
  let controls;
  if(state.chat.step < script.length){
    controls = '<div class="chat-actions">'
      + '<button class="btn primary" data-action="sendReply">➤ '+script[state.chat.step].student+'</button>'
      + '<p class="hint">Scripted replies — click to advance the defense.</p></div>';
  } else {
    controls = '<div class="verdict"><div class="cap">Examiner’s verdict — you steer</div>'
      + '<div class="btn-row">'
      +   '<button class="btn ok" data-action="defensePass">✓ Pass — mastery</button>'
      +   '<button class="btn danger" data-action="defenseSendBack">↩ Send back to review</button>'
      + '</div><p class="hint">No meter here — Tier 3 is pass / fail.</p></div>';
  }
  return '<div class="card">'
    + '<button class="back" data-action="toSubtopic">← '+s.name+'</button>'
    + '<div class="topline"><h1>🎓 Thesis defense — '+s.name+'</h1><span class="pill">'+TIER_NAMES[3]+'</span></div>'
    + '<div class="chat">'+log+'</div>'+controls+'</div>';
}

function progression(){
  const cleared = TIER_NAMES[state.currentBand];
  const msg = state.courseComplete
    ? 'All three bands complete across every subtopic. Mastery achieved.'
    : 'Every subtopic passed '+tierShort(state.currentBand)+'. '+TIER_NAMES[state.pendingUnlock]+' is now unlocked.';
  return '<div class="card center">'
    + '<div class="logo">'+(state.courseComplete?'🌸 Full bloom!':'🌱 The flower blooms')+'</div>'
    + flowerSVG(state.flowerStage,180)
    + '<h1>'+cleared+' cleared</h1><p class="sub">'+msg+'</p>'
    + '<div class="btn-row center"><button class="btn primary" data-action="advanceBand">'
    +   (state.courseComplete?'Back to curriculum':'Enter next band →')+'</button></div></div>';
}

function exit(){
  return '<div class="card center"><h1>Exit</h1>'
    + '<p class="sub">Save your progress and quit to the splash screen?</p>'
    + '<div class="btn-row center">'
    +   '<button class="btn primary" data-action="saveQuit">💾 Save &amp; quit</button>'
    +   '<button class="btn ghost" data-action="cancelExit">Cancel</button>'
    + '</div><p class="hint">Save is mocked — it just flashes a toast and returns to the splash.</p></div>';
}

const SCREENS = {
  splash: splash, topicEntry: topicEntry, dashboard: dashboard, curriculum: curriculum,
  subtopic: subtopic, study: study, exam: examScreen, progression: progression, exit: exit
};

/* ---------- 7. PROGRESSION LOGIC ---------- */
function completeBandCheck(){
  const b = state.currentBand;
  const allDone = state.progress.every(function(p){
    return b===3 ? p[3].defense==='passed' : p[b].done;
  });
  if(allDone){
    state.flowerStage = b;                    // cleared bands == band number
    if(b < 3){ state.pendingUnlock = b+1; }
    else { state.courseComplete = true; state.pendingUnlock = null; }
    go('progression');
  } else {
    go('curriculum');
  }
}

/* ---------- 8. ACTIONS (the state transitions) ---------- */
const actions = {
  // splash
  newRun:  function(){ state = freshState(); go('topicEntry'); },
  resume:  function(){ if(!savedExists) return; state = deepCopy(saved); go('dashboard'); },
  toSplash:function(){ go('splash'); },

  // topic entry
  submitTopic: function(){ go('dashboard'); },   // input ignored; curriculum is hardcoded

  // navigation
  toDashboard:  function(){ go('dashboard'); },
  toCurriculum: function(){ go('curriculum'); },
  toSubtopic:   function(){ go('subtopic'); },
  toStudy:      function(){ go('study'); },
  selectSubtopic: function(arg){ state.currentSubtopic = +arg; go('subtopic'); },

  // exam entry — engine chosen by band (system-read state, not a user choice)
  toExam: function(){
    const i = state.currentSubtopic, b = state.currentBand;
    if(b===3){ state.chat = { step:0, log:[{who:'ex', text:SUBTOPICS[i].defenseOpener}] }; }
    else     { state.exam = { submitted:false, chosen:null }; }
    go('exam');
  },

  // Tier 1/2 loop
  selectMcq:    function(arg){ if(!state.exam.submitted){ state.exam.chosen = +arg; render(); } },
  submitAnswer: function(){ state.exam.submitted = true; render(); },
  gradeCorrect: function(){
    const i = state.currentSubtopic, b = state.currentBand, p = state.progress[i][b];
    p.skills = Math.min(skillsN(i), p.skills + 1);
    if(p.skills >= skillsN(i)){
      p.done = true; state.lastSubtopic = i;
      toast('🎉 Subtopic mastered at ' + tierShort(b));
      return completeBandCheck();
    }
    toast('✓ Correct — skill mastered (' + p.skills + '/' + skillsN(i) + ')');
    state.exam.submitted = false; state.exam.chosen = null; render();
  },
  gradeIncorrect: function(){
    toast('✗ Incorrect — keep practising this skill');
    state.exam.submitted = false; state.exam.chosen = null; render();
  },
  coinFlip: function(){ (Math.random() < 0.5 ? actions.gradeCorrect : actions.gradeIncorrect)(); },

  // Tier 3 defense
  sendReply: function(){
    const t = DEFENSE[state.currentSubtopic][state.chat.step];
    state.chat.log.push({who:'me', text:t.student});
    state.chat.log.push({who:'ex', text:t.examiner});
    state.chat.step++;
    render();
  },
  defensePass: function(){
    const i = state.currentSubtopic;
    state.progress[i][3].defense = 'passed'; state.lastSubtopic = i;
    toast('🎓 Defense passed — mastery');
    completeBandCheck();
  },
  defenseSendBack: function(){
    state.progress[state.currentSubtopic][3].defense = 'sent-back';
    toast('↩ Sent back to review');
    go('study');
  },

  // progression
  advanceBand: function(){
    if(state.pendingUnlock){ state.currentBand = state.pendingUnlock; state.pendingUnlock = null; }
    go('curriculum');
  },

  // exit / save / quit
  toExit:     function(){ state.returnFromExit = state.screen; go('exit'); },
  cancelExit: function(){ go(state.returnFromExit || 'dashboard'); },
  saveQuit:   function(){ saved = deepCopy(state); savedExists = true; toast('💾 Progress saved'); go('splash'); }
};

/* ---------- 9. RENDER / ROUTER ---------- */
const appEl = document.getElementById('app');
const statusEl = document.getElementById('statusbar');
const toastEl = document.getElementById('toast');

function go(screen){ state.screen = screen; render(); }

function render(){
  appEl.innerHTML = (SCREENS[state.screen] || splash)();
  statusEl.innerHTML = statusBar();
  const input = document.getElementById('topicInput');
  if(input){
    input.focus();
    input.addEventListener('keydown', function(e){ if(e.key==='Enter') actions.submitTopic(); });
  }
}

function statusBar(){
  let s = 'state machine — screen: <b>' + state.screen + '</b> · band: <b>' + tierShort(state.currentBand)
        + '</b> · flower: <b>' + state.flowerStage + '/3</b>';
  if(['subtopic','study','exam'].indexOf(state.screen) > -1){
    s += ' · subtopic: <b>' + SUBTOPICS[state.currentSubtopic].name + '</b>';
  }
  return s;
}

let toastTimer = null;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1900);
}

// Single delegated click handler = the whole state machine's edges.
appEl.addEventListener('click', function(e){
  const t = e.target.closest('[data-action]');
  if(!t || t.disabled) return;
  const fn = actions[t.dataset.action];
  if(fn) fn(t.dataset.arg);
});

render();
