/* ============================================================
   PROJECT 501 — GAME LOGIC
   ============================================================ */

// ============================================================
// CONSTANTS
// ============================================================

const DATA_BASE = 'data/players/';
const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const MAX_SCORE = 180;
const WIN_THRESHOLD = -10;
const TIMER_SECONDS = 30;

// ============================================================
// 100 HAND-PICKED CATEGORIES
// ============================================================
// Logica: stat moet goede spreiding hebben in 1-180 range.
// Goals voor clubs/competities = ideaal (1-200+, veel in 1-180).
// Appearances = goed maar risico op bust (veel >180).
// Assists = lager bereik, goed voor strategische plays.
// International caps/goals = perfecte spreiding.
//
// Verdeling: 20 interlands, 20 eredivisie, 40 premier league, 20 overig
// ============================================================

const QUESTIONS = [

  // ==================== PREMIER LEAGUE (40) ====================
  // Goals voor PL clubs
  {id:'pl_goals',        label:'Premier League Goals',           desc:'Hoeveel Premier League goals heeft deze speler gescoord?',         type:'comp', comp:'Premier League', stat:'g'},
  {id:'pl_apps',         label:'Premier League Appearances',     desc:'Hoeveel Premier League wedstrijden heeft deze speler gespeeld?',   type:'comp', comp:'Premier League', stat:'a'},
  {id:'pl_assists',      label:'Premier League Assists',         desc:'Hoeveel assists in de Premier League?',                           type:'comp', comp:'Premier League', stat:'as'},
  // Team-specific goals
  {id:'t_arsenal_g',     label:'Goals for Arsenal',              desc:'Hoeveel goals heeft deze speler gescoord voor Arsenal?',           type:'team', team:'Arsenal FC',       stat:'g'},
  {id:'t_chelsea_g',     label:'Goals for Chelsea',              desc:'Hoeveel goals voor Chelsea?',                                     type:'team', team:'Chelsea FC',       stat:'g'},
  {id:'t_liverpool_g',   label:'Goals for Liverpool',            desc:'Hoeveel goals voor Liverpool?',                                   type:'team', team:'Liverpool FC',     stat:'g'},
  {id:'t_mancity_g',     label:'Goals for Manchester City',      desc:'Hoeveel goals voor Manchester City?',                             type:'team', team:'Manchester City',   stat:'g'},
  {id:'t_manutd_g',      label:'Goals for Manchester United',    desc:'Hoeveel goals voor Manchester United?',                           type:'team', team:'Manchester United', stat:'g'},
  {id:'t_spurs_g',       label:'Goals for Tottenham',            desc:'Hoeveel goals voor Tottenham Hotspur?',                           type:'team', team:'Tottenham Hotspur', stat:'g'},
  {id:'t_everton_g',     label:'Goals for Everton',              desc:'Hoeveel goals voor Everton?',                                     type:'team', team:'Everton FC',       stat:'g'},
  {id:'t_newcastle_g',   label:'Goals for Newcastle',            desc:'Hoeveel goals voor Newcastle United?',                            type:'team', team:'Newcastle United', stat:'g'},
  {id:'t_westham_g',     label:'Goals for West Ham',             desc:'Hoeveel goals voor West Ham United?',                             type:'team', team:'West Ham United',  stat:'g'},
  {id:'t_villa_g',       label:'Goals for Aston Villa',          desc:'Hoeveel goals voor Aston Villa?',                                 type:'team', team:'Aston Villa',      stat:'g'},
  {id:'t_leeds_g',       label:'Goals for Leeds United',         desc:'Hoeveel goals voor Leeds United?',                                type:'team', team:'Leeds United',     stat:'g'},
  {id:'t_leicester_g',   label:'Goals for Leicester City',       desc:'Hoeveel goals voor Leicester City?',                              type:'team', team:'Leicester City',   stat:'g'},
  // Team-specific appearances
  {id:'t_arsenal_a',     label:'Apps for Arsenal',               desc:'Hoeveel wedstrijden voor Arsenal gespeeld?',                      type:'team', team:'Arsenal FC',       stat:'a'},
  {id:'t_chelsea_a',     label:'Apps for Chelsea',               desc:'Hoeveel wedstrijden voor Chelsea gespeeld?',                      type:'team', team:'Chelsea FC',       stat:'a'},
  {id:'t_liverpool_a',   label:'Apps for Liverpool',             desc:'Hoeveel wedstrijden voor Liverpool gespeeld?',                    type:'team', team:'Liverpool FC',     stat:'a'},
  {id:'t_mancity_a',     label:'Apps for Manchester City',       desc:'Hoeveel wedstrijden voor Manchester City gespeeld?',              type:'team', team:'Manchester City',  stat:'a'},
  {id:'t_manutd_a',      label:'Apps for Manchester United',     desc:'Hoeveel wedstrijden voor Man United gespeeld?',                   type:'team', team:'Manchester United',stat:'a'},
  {id:'t_spurs_a',       label:'Apps for Tottenham',             desc:'Hoeveel wedstrijden voor Tottenham gespeeld?',                    type:'team', team:'Tottenham Hotspur',stat:'a'},
  // Team-specific assists
  {id:'t_arsenal_as',    label:'Assists for Arsenal',            desc:'Hoeveel assists voor Arsenal?',                                   type:'team', team:'Arsenal FC',       stat:'as'},
  {id:'t_chelsea_as',    label:'Assists for Chelsea',            desc:'Hoeveel assists voor Chelsea?',                                   type:'team', team:'Chelsea FC',       stat:'as'},
  {id:'t_liverpool_as',  label:'Assists for Liverpool',          desc:'Hoeveel assists voor Liverpool?',                                 type:'team', team:'Liverpool FC',     stat:'as'},
  {id:'t_manutd_as',     label:'Assists for Man United',         desc:'Hoeveel assists voor Manchester United?',                         type:'team', team:'Manchester United',stat:'as'},
  // Championship
  {id:'ch_goals',        label:'Championship Goals',             desc:'Hoeveel goals in de Championship?',                               type:'comp', comp:'Championship', stat:'g'},
  {id:'ch_apps',         label:'Championship Appearances',       desc:'Hoeveel Championship wedstrijden gespeeld?',                      type:'comp', comp:'Championship', stat:'a'},
  // PL Competition stats
  {id:'pl_yellows',      label:'PL Yellow Cards',                desc:'Hoeveel gele kaarten in de Premier League?',                      type:'comp', comp:'Premier League', stat:'y'},
  // More PL team goals
  {id:'t_wolves_g',      label:'Goals for Wolverhampton',        desc:'Hoeveel goals voor Wolverhampton Wanderers?',                     type:'team', team:'Wolverhampton Wanderers', stat:'g'},
  {id:'t_southampton_g', label:'Goals for Southampton',          desc:'Hoeveel goals voor Southampton?',                                 type:'team', team:'Southampton FC',  stat:'g'},
  {id:'t_palace_g',      label:'Goals for Crystal Palace',       desc:'Hoeveel goals voor Crystal Palace?',                              type:'team', team:'Crystal Palace',   stat:'g'},
  {id:'t_fulham_g',      label:'Goals for Fulham',               desc:'Hoeveel goals voor Fulham?',                                      type:'team', team:'Fulham FC',        stat:'g'},
  {id:'t_brighton_g',    label:'Goals for Brighton',             desc:'Hoeveel goals voor Brighton & Hove Albion?',                      type:'team', team:'Brighton & Hove Albion', stat:'g'},
  {id:'t_burnley_g',     label:'Goals for Burnley',              desc:'Hoeveel goals voor Burnley?',                                     type:'team', team:'Burnley FC',       stat:'g'},
  {id:'t_watford_g',     label:'Goals for Watford',              desc:'Hoeveel goals voor Watford?',                                     type:'team', team:'Watford FC',       stat:'g'},
  {id:'t_bournemouth_g', label:'Goals for Bournemouth',          desc:'Hoeveel goals voor AFC Bournemouth?',                             type:'team', team:'AFC Bournemouth',  stat:'g'},
  // PL team appearances extra
  {id:'t_everton_a',     label:'Apps for Everton',               desc:'Hoeveel wedstrijden voor Everton gespeeld?',                      type:'team', team:'Everton FC',       stat:'a'},
  {id:'t_newcastle_a',   label:'Apps for Newcastle',             desc:'Hoeveel wedstrijden voor Newcastle gespeeld?',                    type:'team', team:'Newcastle United', stat:'a'},
  {id:'t_westham_a',     label:'Apps for West Ham',              desc:'Hoeveel wedstrijden voor West Ham gespeeld?',                     type:'team', team:'West Ham United',  stat:'a'},
  {id:'t_villa_a',       label:'Apps for Aston Villa',           desc:'Hoeveel wedstrijden voor Aston Villa gespeeld?',                  type:'team', team:'Aston Villa',      stat:'a'},

  // ==================== EREDIVISIE (20) ====================
  {id:'ed_goals',        label:'Eredivisie Goals',               desc:'Hoeveel goals in de Eredivisie?',                                 type:'comp', comp:'Eredivisie', stat:'g'},
  {id:'ed_apps',         label:'Eredivisie Appearances',         desc:'Hoeveel Eredivisie wedstrijden gespeeld?',                        type:'comp', comp:'Eredivisie', stat:'a'},
  {id:'ed_assists',      label:'Eredivisie Assists',             desc:'Hoeveel assists in de Eredivisie?',                               type:'comp', comp:'Eredivisie', stat:'as'},
  {id:'t_ajax_g',        label:'Goals for Ajax',                 desc:'Hoeveel goals voor Ajax?',                                        type:'team', team:'Ajax Amsterdam',   stat:'g'},
  {id:'t_ajax_a',        label:'Apps for Ajax',                  desc:'Hoeveel wedstrijden voor Ajax gespeeld?',                         type:'team', team:'Ajax Amsterdam',   stat:'a'},
  {id:'t_psv_g',         label:'Goals for PSV',                  desc:'Hoeveel goals voor PSV?',                                         type:'team', team:'PSV Eindhoven',    stat:'g'},
  {id:'t_psv_a',         label:'Apps for PSV',                   desc:'Hoeveel wedstrijden voor PSV gespeeld?',                          type:'team', team:'PSV Eindhoven',    stat:'a'},
  {id:'t_feyenoord_g',   label:'Goals for Feyenoord',            desc:'Hoeveel goals voor Feyenoord?',                                   type:'team', team:'Feyenoord Rotterdam', stat:'g'},
  {id:'t_feyenoord_a',   label:'Apps for Feyenoord',             desc:'Hoeveel wedstrijden voor Feyenoord gespeeld?',                    type:'team', team:'Feyenoord Rotterdam', stat:'a'},
  {id:'t_azalk_g',       label:'Goals for AZ Alkmaar',           desc:'Hoeveel goals voor AZ?',                                          type:'team', team:'AZ Alkmaar',       stat:'g'},
  {id:'t_azalk_a',       label:'Apps for AZ Alkmaar',            desc:'Hoeveel wedstrijden voor AZ gespeeld?',                           type:'team', team:'AZ Alkmaar',       stat:'a'},
  {id:'t_twente_g',      label:'Goals for FC Twente',            desc:'Hoeveel goals voor FC Twente?',                                   type:'team', team:'FC Twente Enschede',stat:'g'},
  {id:'t_vitesse_g',     label:'Goals for Vitesse',              desc:'Hoeveel goals voor Vitesse?',                                     type:'team', team:'Vitesse',           stat:'g'},
  {id:'t_heerenveen_g',  label:'Goals for Heerenveen',           desc:'Hoeveel goals voor SC Heerenveen?',                               type:'team', team:'SC Heerenveen',    stat:'g'},
  {id:'t_utrecht_g',     label:'Goals for FC Utrecht',           desc:'Hoeveel goals voor FC Utrecht?',                                  type:'team', team:'FC Utrecht',       stat:'g'},
  {id:'t_willem_g',      label:'Goals for Willem II',            desc:'Hoeveel goals voor Willem II?',                                   type:'team', team:'Willem II Tilburg', stat:'g'},
  {id:'t_ajax_as',       label:'Assists for Ajax',               desc:'Hoeveel assists voor Ajax?',                                      type:'team', team:'Ajax Amsterdam',   stat:'as'},
  {id:'t_psv_as',        label:'Assists for PSV',                desc:'Hoeveel assists voor PSV?',                                       type:'team', team:'PSV Eindhoven',    stat:'as'},
  {id:'t_feyenoord_as',  label:'Assists for Feyenoord',          desc:'Hoeveel assists voor Feyenoord?',                                 type:'team', team:'Feyenoord Rotterdam', stat:'as'},

  // ==================== INTERNATIONAL (20) ====================
  {id:'intl_caps',       label:'International Caps',             desc:'Hoeveel interlands heeft deze speler gespeeld?',                  type:'career', stat:'ic'},
  {id:'intl_goals',      label:'International Goals',            desc:'Hoeveel interlandgoals gescoord?',                                type:'career', stat:'ig'},
  {id:'total_goals',     label:'Total Career Goals',             desc:'Hoeveel goals in totaal (club + interland)?',                     type:'career', stat:'cg'},
  {id:'total_apps',      label:'Total Career Appearances',       desc:'Hoeveel wedstrijden in totaal (club + interland)?',               type:'career', stat:'ca'},
  {id:'club_goals',      label:'Club Career Goals',              desc:'Hoeveel goals in de gehele clubcarrière?',                        type:'career', stat:'clg'},
  {id:'club_apps',       label:'Club Career Appearances',        desc:'Hoeveel clubwedstrijden gespeeld in totaal?',                     type:'career', stat:'cla'},
  {id:'career_assists',  label:'Career Assists',                 desc:'Hoeveel assists in de gehele clubcarrière?',                      type:'career', stat:'cas'},
  {id:'career_yellows',  label:'Career Yellow Cards',            desc:'Hoeveel gele kaarten in de gehele carrière?',                     type:'career', stat:'cy'},
  // CL & EL
  {id:'cl_goals',        label:'Champions League Goals',         desc:'Hoeveel Champions League goals gescoord?',                        type:'comp', comp:'Champions League', stat:'g'},
  {id:'cl_apps',         label:'Champions League Appearances',   desc:'Hoeveel Champions League wedstrijden gespeeld?',                  type:'comp', comp:'Champions League', stat:'a'},
  {id:'cl_assists',      label:'Champions League Assists',       desc:'Hoeveel assists in de Champions League?',                         type:'comp', comp:'Champions League', stat:'as'},
  {id:'el_goals',        label:'Europa League Goals',            desc:'Hoeveel Europa League goals?',                                    type:'comp', comp:'Europa League', stat:'g'},
  {id:'el_apps',         label:'Europa League Appearances',      desc:'Hoeveel Europa League wedstrijden gespeeld?',                     type:'comp', comp:'Europa League', stat:'a'},
  // World Cup / EC
  {id:'wm_goals',        label:'World Cup Goals',                desc:'Hoeveel WK-goals gescoord?',                                     type:'comp', comp:'World Cup', stat:'g'},
  {id:'wm_apps',         label:'World Cup Appearances',          desc:'Hoeveel WK-wedstrijden gespeeld?',                               type:'comp', comp:'World Cup', stat:'a'},
  {id:'em_goals',        label:'European Championship Goals',    desc:'Hoeveel EK-goals gescoord?',                                     type:'comp', comp:'European Championship', stat:'g'},
  {id:'em_apps',         label:'European Championship Apps',     desc:'Hoeveel EK-wedstrijden gespeeld?',                               type:'comp', comp:'European Championship', stat:'a'},
  // Career reds (low numbers but dramatic)
  {id:'career_reds',     label:'Career Red Cards',               desc:'Hoeveel rode kaarten in de gehele carrière?',                     type:'career', stat:'cr'},
  {id:'career_cs',       label:'Career Clean Sheets',            desc:'Hoeveel clean sheets in de gehele carrière? (keepers)',            type:'career', stat:'ccs'},
  {id:'cl_yellows',      label:'CL Yellow Cards',                desc:'Hoeveel gele kaarten in de Champions League?',                    type:'comp', comp:'Champions League', stat:'y'},

  // ==================== OVERIG (20) ====================
  {id:'la_goals',        label:'LaLiga Goals',                   desc:'Hoeveel LaLiga goals gescoord?',                                  type:'comp', comp:'LaLiga', stat:'g'},
  {id:'la_apps',         label:'LaLiga Appearances',             desc:'Hoeveel LaLiga wedstrijden gespeeld?',                            type:'comp', comp:'LaLiga', stat:'a'},
  {id:'la_assists',      label:'LaLiga Assists',                 desc:'Hoeveel assists in LaLiga?',                                      type:'comp', comp:'LaLiga', stat:'as'},
  {id:'sa_goals',        label:'Serie A Goals',                  desc:'Hoeveel Serie A goals gescoord?',                                 type:'comp', comp:'Serie A', stat:'g'},
  {id:'sa_apps',         label:'Serie A Appearances',            desc:'Hoeveel Serie A wedstrijden gespeeld?',                           type:'comp', comp:'Serie A', stat:'a'},
  {id:'bl_goals',        label:'Bundesliga Goals',               desc:'Hoeveel Bundesliga goals gescoord?',                              type:'comp', comp:'Bundesliga', stat:'g'},
  {id:'bl_apps',         label:'Bundesliga Appearances',         desc:'Hoeveel Bundesliga wedstrijden gespeeld?',                        type:'comp', comp:'Bundesliga', stat:'a'},
  {id:'l1_goals',        label:'Ligue 1 Goals',                  desc:'Hoeveel Ligue 1 goals gescoord?',                                 type:'comp', comp:'Ligue 1', stat:'g'},
  {id:'l1_apps',         label:'Ligue 1 Appearances',            desc:'Hoeveel Ligue 1 wedstrijden gespeeld?',                           type:'comp', comp:'Ligue 1', stat:'a'},
  // Big club goals
  {id:'t_barca_g',       label:'Goals for Barcelona',            desc:'Hoeveel goals voor FC Barcelona?',                                type:'team', team:'FC Barcelona',     stat:'g'},
  {id:'t_real_g',        label:'Goals for Real Madrid',          desc:'Hoeveel goals voor Real Madrid?',                                 type:'team', team:'Real Madrid',      stat:'g'},
  {id:'t_bayern_g',      label:'Goals for Bayern München',       desc:'Hoeveel goals voor Bayern München?',                              type:'team', team:'Bayern Munich',    stat:'g'},
  {id:'t_juve_g',        label:'Goals for Juventus',             desc:'Hoeveel goals voor Juventus?',                                    type:'team', team:'Juventus Turin',   stat:'g'},
  {id:'t_milan_g',       label:'Goals for AC Milan',             desc:'Hoeveel goals voor AC Milan?',                                    type:'team', team:'AC Milan',         stat:'g'},
  {id:'t_inter_g',       label:'Goals for Inter Milan',          desc:'Hoeveel goals voor Inter Milan?',                                 type:'team', team:'Inter Milan',      stat:'g'},
  {id:'t_psg_g',         label:'Goals for PSG',                  desc:'Hoeveel goals voor Paris Saint-Germain?',                         type:'team', team:'Paris Saint-Germain', stat:'g'},
  {id:'t_dortmund_g',    label:'Goals for Borussia Dortmund',    desc:'Hoeveel goals voor Borussia Dortmund?',                           type:'team', team:'Borussia Dortmund', stat:'g'},
  {id:'t_atletico_g',    label:'Goals for Atlético Madrid',      desc:'Hoeveel goals voor Atlético Madrid?',                             type:'team', team:'Atlético de Madrid', stat:'g'},
  {id:'t_benfica_g',     label:'Goals for Benfica',              desc:'Hoeveel goals voor SL Benfica?',                                  type:'team', team:'SL Benfica',       stat:'g'},
  {id:'t_porto_g',       label:'Goals for FC Porto',             desc:'Hoeveel goals voor FC Porto?',                                    type:'team', team:'FC Porto',         stat:'g'},
];

// Country → flag emoji mapping (most common nationalities)
const COUNTRY_FLAGS = {
  'Afghanistan':'🇦🇫','Albania':'🇦🇱','Algeria':'🇩🇿','Argentina':'🇦🇷','Armenia':'🇦🇲',
  'Australia':'🇦🇺','Austria':'🇦🇹','Azerbaijan':'🇦🇿','Belgium':'🇧🇪','Bolivia':'🇧🇴',
  'Bosnia-Herzegovina':'🇧🇦','Brazil':'🇧🇷','Bulgaria':'🇧🇬','Cameroon':'🇨🇲',
  'Canada':'🇨🇦','Chile':'🇨🇱','China':'🇨🇳','Colombia':'🇨🇴','Congo DR':'🇨🇩',
  'Costa Rica':'🇨🇷','Cote d\'Ivoire':'🇨🇮','Croatia':'🇭🇷','Cuba':'🇨🇺','Cyprus':'🇨🇾',
  'Czech Republic':'🇨🇿','Czechia':'🇨🇿','Denmark':'🇩🇰','DR Congo':'🇨🇩','Ecuador':'🇪🇨','Egypt':'🇪🇬',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Estonia':'🇪🇪','Finland':'🇫🇮','France':'🇫🇷','Gabon':'🇬🇦',
  'Gambia':'🇬🇲','Georgia':'🇬🇪','Germany':'🇩🇪','Ghana':'🇬🇭','Greece':'🇬🇷',
  'Guatemala':'🇬🇹','Guinea':'🇬🇳','Haiti':'🇭🇹','Honduras':'🇭🇳','Hungary':'🇭🇺',
  'Iceland':'🇮🇸','India':'🇮🇳','Indonesia':'🇮🇩','Iran':'🇮🇷','Iraq':'🇮🇶','Ireland':'🇮🇪',
  'Israel':'🇮🇱','Italy':'🇮🇹','Ivory Coast':'🇨🇮','Jamaica':'🇯🇲','Japan':'🇯🇵',
  'Kenya':'🇰🇪','Korea, South':'🇰🇷','Kosovo':'🇽🇰','Latvia':'🇱🇻','Lithuania':'🇱🇹',
  'Luxembourg':'🇱🇺','Mali':'🇲🇱','Malta':'🇲🇹','Mexico':'🇲🇽','Montenegro':'🇲🇪',
  'Morocco':'🇲🇦','Netherlands':'🇳🇱','New Zealand':'🇳🇿','Nigeria':'🇳🇬',
  'North Macedonia':'🇲🇰','Northern Ireland':'🏴','Norway':'🇳🇴','Panama':'🇵🇦',
  'Paraguay':'🇵🇾','Peru':'🇵🇪','Philippines':'🇵🇭','Poland':'🇵🇱','Portugal':'🇵🇹',
  'Romania':'🇷🇴','Russia':'🇷🇺','Saudi Arabia':'🇸🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal':'🇸🇳','Serbia':'🇷🇸','Slovakia':'🇸🇰','Slovenia':'🇸🇮',
  'South Africa':'🇿🇦','South Korea':'🇰🇷','Spain':'🇪🇸','Sweden':'🇸🇪',
  'Switzerland':'🇨🇭','Trinidad and Tobago':'🇹🇹','Tunisia':'🇹🇳','Turkey':'🇹🇷',
  'Ukraine':'🇺🇦','United States':'🇺🇸','Uruguay':'🇺🇾','Uzbekistan':'🇺🇿',
  'Venezuela':'🇻🇪','Vietnam':'🇻🇳','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Zambia':'🇿🇲','Zimbabwe':'🇿🇼',
  'Cape Verde':'🇨🇻','Burkina Faso':'🇧🇫','Togo':'🇹🇬','Benin':'🇧🇯','Madagascar':'🇲🇬',
  'Mozambique':'🇲🇿','Angola':'🇦🇴','Congo':'🇨🇬','Curacao':'🇨🇼','Curaçao':'🇨🇼',
  'Suriname':'🇸🇷','Guyana':'🇬🇾',
};

function getFlag(nationality) {
  if (!nationality) return '⚽';
  // Try exact match
  if (COUNTRY_FLAGS[nationality]) return COUNTRY_FLAGS[nationality];
  // Try partial match
  for (const [country, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (nationality.includes(country) || country.includes(nationality)) return flag;
  }
  return '🌍';
}

// ============================================================
// STATE
// ============================================================

let autocompleteData = [];  // [{id, n, nat, ca}] - with nationality + career apps for sorting
let playerCache = {};
let usedPlayerIds = new Set();

let gameMode = 'solo';
let currentQuestion = null;
let currentTurn = 0;
let scores = [501, 501];
let turnNumber = 0;
let timerInterval = null;
let timerRemaining = TIMER_SECONDS;

const $ = (id) => document.getElementById(id);

// ============================================================
// DATA LOADING
// ============================================================

async function loadData() {
  try {
    const resp = await fetch('data/autocomplete.json');
    const raw = await resp.json();
    // Enrich autocomplete data: we need nationality for flags
    // Load all letter files to get nationality
    // Actually, autocomplete.json only has {id, n} — we need to enhance it
    // For now use it as-is, we'll load nationality when player is selected
    autocompleteData = raw;
    console.log(`Loaded ${autocompleteData.length} players`);
  } catch (e) {
    console.error('Data laden mislukt:', e);
  }
}

function normalizeLetterJS(name) {
  if (!name) return '_';
  let letter = name.charAt(0).toUpperCase();
  let normalized = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'Ø') normalized = 'O';
  return /[A-Z]/.test(normalized) ? normalized : '_';
}

async function loadLetterData(letter) {
  if (!playerCache[letter]) {
    try {
      const resp = await fetch(`${DATA_BASE}${letter}.json`);
      playerCache[letter] = await resp.json();
      // Enrich autocomplete data with nationality + popularity from loaded players
      const byId = {};
      playerCache[letter].forEach(p => { byId[p.id] = p; });
      autocompleteData.forEach(ac => {
        const full = byId[ac.id];
        if (full && !ac.nat) {
          ac.nat = full.nat || '';
          ac.club = full.club || '';
          ac.ca = full.ca || 0;
        }
      });
    } catch (e) {
      console.error(`Kan ${letter}.json niet laden:`, e);
    }
  }
}

async function getPlayerById(id) {
  const entry = autocompleteData.find(p => p.id === id);
  if (!entry) return null;

  const letter = normalizeLetterJS(entry.n);
  await loadLetterData(letter);
  return playerCache[letter]?.find(p => p.id === id) || null;
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  if (id !== 'gameScreen') clearInterval(timerInterval);
}

// ============================================================
// CATEGORY / QUESTION SELECTION
// ============================================================

function getRandomQuestion() {
  const idx = Math.floor(Math.random() * QUESTIONS.length);
  return QUESTIONS[idx];
}

function showCategoryReveal() {
  currentQuestion = getRandomQuestion();
  $('catRevealName').textContent = currentQuestion.label;
  $('catRevealDesc').textContent = currentQuestion.desc;
  showScreen('categoryScreen');
}

function skipCategory() {
  currentQuestion = getRandomQuestion();
  // Animate the swap
  const nameEl = $('catRevealName');
  nameEl.style.opacity = '0';
  nameEl.style.transform = 'translateY(10px)';
  setTimeout(() => {
    nameEl.textContent = currentQuestion.label;
    $('catRevealDesc').textContent = currentQuestion.desc;
    nameEl.style.opacity = '1';
    nameEl.style.transform = 'translateY(0)';
  }, 150);
}

// ============================================================
// GAME START
// ============================================================

function startSetup(mode) {
  gameMode = mode;
  showCategoryReveal();
}

function startGame() {
  if (!currentQuestion) return;

  scores = [501, 501];
  usedPlayerIds = new Set();
  currentTurn = 0;
  turnNumber = 1;

  $('gameCategoryLabel').textContent = currentQuestion.label;
  $('score1').textContent = '501';
  $('score2').textContent = '501';
  $('last1').innerHTML = '';
  $('last2').innerHTML = '';
  $('historySection').innerHTML = '';
  $('playerInput').value = '';

  if (gameMode === 'multi') {
    $('scorePanel2').style.display = '';
    $('p1Label').textContent = 'Speler 1';
    $('p2Label').textContent = 'Speler 2';
  } else {
    $('scorePanel2').style.display = 'none';
    $('p1Label').textContent = 'Jij';
  }

  updateTurnUI();
  showScreen('gameScreen');
  setTimeout(() => $('playerInput').focus(), 300);
  startTimer();
}

// ============================================================
// TIMER
// ============================================================

function startTimer() {
  clearInterval(timerInterval);
  timerRemaining = TIMER_SECONDS;
  updateTimerBar();

  timerInterval = setInterval(() => {
    timerRemaining -= 0.1;
    updateTimerBar();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 100);
}

function updateTimerBar() {
  const pct = Math.max(0, (timerRemaining / TIMER_SECONDS) * 100);
  const fill = $('timerFill');
  fill.style.width = pct + '%';
  fill.className = 'timer-fill';
  if (pct < 20) fill.classList.add('danger');
  else if (pct < 40) fill.classList.add('warning');
}

function handleTimeout() {
  addHistory(currentTurn, 'Tijd op!', 0, true, 'Geen antwoord');
  updateLastScore(currentTurn, 'BUST — tijd op!', true);
  nextTurn();
}

// ============================================================
// TURN LOGIC
// ============================================================

function updateTurnUI() {
  const p1 = $('scorePanel1');
  const p2 = $('scorePanel2');

  if (gameMode === 'solo') {
    $('gameTurnLabel').textContent = `Beurt ${turnNumber}`;
    p1.classList.add('active-turn');
  } else {
    const who = currentTurn === 0 ? 'Speler 1' : 'Speler 2';
    $('gameTurnLabel').textContent = `Beurt ${turnNumber} — ${who}`;
    p1.classList.toggle('active-turn', currentTurn === 0);
    p2.classList.toggle('active-turn', currentTurn === 1);
  }

  [0, 1].forEach(i => {
    const el = $(`score${i + 1}`);
    el.className = 'score-value';
    if (scores[i] <= 50) el.classList.add('low');
    if (scores[i] <= 10) el.classList.add('danger');
  });
}

function nextTurn() {
  if (gameMode === 'multi') {
    currentTurn = currentTurn === 0 ? 1 : 0;
    if (currentTurn === 0) turnNumber++;
  } else {
    turnNumber++;
  }

  $('playerInput').value = '';
  $('acList').classList.remove('show');
  updateTurnUI();
  startTimer();
  setTimeout(() => $('playerInput').focus(), 100);
}

// ============================================================
// SCORING
// ============================================================

function getPlayerStat(player, question) {
  if (question.type === 'comp') {
    return player.comp?.[question.comp]?.[question.stat] || 0;
  }
  if (question.type === 'team') {
    return player.teams?.[question.team]?.[question.stat] || 0;
  }
  // career
  return player[question.stat] || 0;
}

function checkBust(stat, currentScore) {
  if (stat === 0) return true;
  if (stat > MAX_SCORE) return true;
  if (IMPOSSIBLE_SCORES.has(stat)) return true;
  if (currentScore - stat < WIN_THRESHOLD) return true;
  return false;
}

async function submitPlayer(playerId) {
  clearInterval(timerInterval);

  if (usedPlayerIds.has(playerId)) {
    showFeedback('Speler al gebruikt!');
    startTimer();
    return;
  }

  const player = await getPlayerById(playerId);
  if (!player) {
    showFeedback('Speler niet gevonden');
    startTimer();
    return;
  }

  const stat = getPlayerStat(player, currentQuestion);
  usedPlayerIds.add(playerId);

  const isBust = checkBust(stat, scores[currentTurn]);

  if (isBust) {
    const reason = stat > MAX_SCORE ? `${stat} > 180`
      : IMPOSSIBLE_SCORES.has(stat) ? `${stat} is onmogelijk in darts`
      : stat === 0 ? '0 — geen data'
      : `Te ver (score zou ${scores[currentTurn] - stat} worden)`;

    addHistory(currentTurn, player.n, stat, true, reason);
    updateLastScore(currentTurn, `BUST — ${player.n} (${stat})`, true);

    const panel = $(`scorePanel${currentTurn + 1}`);
    panel.classList.add('bust');
    setTimeout(() => panel.classList.remove('bust'), 500);
  } else {
    scores[currentTurn] -= stat;
    $(`score${currentTurn + 1}`).textContent = scores[currentTurn];
    addHistory(currentTurn, player.n, stat, false);
    updateLastScore(currentTurn, `${player.n} — ${stat}`, false);

    if (scores[currentTurn] <= 0 && scores[currentTurn] >= WIN_THRESHOLD) {
      if (gameMode === 'multi' && currentTurn === 0) {
        nextTurn();
        return;
      }
      endGame();
      return;
    }
  }

  nextTurn();
}

// ============================================================
// UI HELPERS
// ============================================================

function updateLastScore(playerIdx, text, isBust) {
  $(`last${playerIdx + 1}`).innerHTML =
    `<span class="${isBust ? 'bust' : 'hit'}">${text}</span>`;
}

function addHistory(playerIdx, name, stat, isBust, reason) {
  const section = $('historySection');
  const div = document.createElement('div');
  div.className = 'history-item';

  const whoClass = playerIdx === 0 ? 'p1' : 'p2';
  const whoLabel = gameMode === 'solo' ? turnNumber : (playerIdx === 0 ? 'P1' : 'P2');
  const scoreClass = isBust ? 'bust' : 'hit';
  const scoreText = isBust ? 'BUST' : `-${stat}`;
  const detail = reason || `Stat: ${stat}`;

  div.innerHTML = `
    <div class="h-who ${whoClass}">${whoLabel}</div>
    <div style="flex:1">
      <div>${name}</div>
      <div class="h-player">${detail}</div>
    </div>
    <div class="h-score ${scoreClass}">${scoreText}</div>
  `;
  section.insertBefore(div, section.firstChild);
}

function showFeedback(msg) {
  const input = $('playerInput');
  input.value = '';
  input.placeholder = msg;
  setTimeout(() => { input.placeholder = 'Typ een spelersnaam...'; }, 2000);
}

// ============================================================
// WIN / END GAME
// ============================================================

function endGame() {
  clearInterval(timerInterval);

  let winner, detail;

  if (gameMode === 'solo') {
    winner = 'Gewonnen!';
    detail = `Je hebt 501 bereikt in ${turnNumber} beurten`;
  } else {
    const inZone0 = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD;
    const inZone1 = scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;

    if (inZone0 && inZone1) {
      const diff0 = Math.abs(scores[0]);
      const diff1 = Math.abs(scores[1]);
      if (diff0 < diff1) {
        winner = 'Speler 1 wint!'; detail = 'Dichter bij 0';
      } else if (diff1 < diff0) {
        winner = 'Speler 2 wint!'; detail = 'Dichter bij 0';
      } else {
        winner = 'Gelijkspel!'; detail = 'Beide even dicht bij 0';
      }
    } else if (inZone0) {
      winner = 'Speler 1 wint!'; detail = `Afgemaakt op ${scores[0]}`;
    } else {
      winner = 'Speler 2 wint!'; detail = `Afgemaakt op ${scores[1]}`;
    }
  }

  $('winTitle').textContent = winner;
  $('winDetail').textContent = detail;

  const scoresDiv = $('winScores');
  if (gameMode === 'solo') {
    scoresDiv.innerHTML = `
      <div class="win-score-box winner">
        <div class="wsb-name">Eindscore</div>
        <div class="wsb-score">${scores[0]}</div>
      </div>
      <div class="win-score-box">
        <div class="wsb-name">Beurten</div>
        <div class="wsb-score">${turnNumber}</div>
      </div>`;
  } else {
    const w0 = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD;
    const w1 = scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;
    scoresDiv.innerHTML = `
      <div class="win-score-box ${w0 ? 'winner' : ''}">
        <div class="wsb-name">Speler 1</div>
        <div class="wsb-score">${scores[0]}</div>
      </div>
      <div class="win-score-box ${w1 ? 'winner' : ''}">
        <div class="wsb-name">Speler 2</div>
        <div class="wsb-score">${scores[1]}</div>
      </div>`;
  }

  showScreen('winScreen');
}

// ============================================================
// AUTOCOMPLETE
// ============================================================

let acHighlightIdx = -1;
let acResults = [];
let debounceTimer = null;

function initAutocomplete() {
  const input = $('playerInput');
  const list = $('acList');

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchPlayers(input.value), 120);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acHighlightIdx = Math.min(acHighlightIdx + 1, acResults.length - 1);
      updateAcHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acHighlightIdx = Math.max(acHighlightIdx - 1, 0);
      updateAcHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acHighlightIdx >= 0 && acResults[acHighlightIdx]) {
        selectAcItem(acResults[acHighlightIdx]);
      } else if (acResults.length === 1) {
        selectAcItem(acResults[0]);
      }
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) list.classList.remove('show');
  });
}

async function searchPlayers(query) {
  const list = $('acList');

  if (query.length < 2) {
    list.classList.remove('show');
    acResults = [];
    return;
  }

  const q = query.toLowerCase();

  // Filter matches
  let matches = autocompleteData
    .filter(p => !usedPlayerIds.has(p.id) && p.n.toLowerCase().includes(q));

  // Sort: prioritize players with nationality loaded (= more popular, already fetched)
  // Then by career appearances (most popular first)
  matches.sort((a, b) => {
    // Players with enriched data first
    const aEnriched = a.ca ? 1 : 0;
    const bEnriched = b.ca ? 1 : 0;
    if (aEnriched !== bEnriched) return bEnriched - aEnriched;
    // Then by career appearances
    return (b.ca || 0) - (a.ca || 0);
  });

  acResults = matches.slice(0, 12);

  // Pre-load letter data for results so we have nationality
  const lettersToLoad = new Set(acResults.map(p => normalizeLetterJS(p.n)));
  await Promise.all([...lettersToLoad].map(l => loadLetterData(l)));

  acHighlightIdx = -1;
  renderAcResults();
}

function renderAcResults() {
  const list = $('acList');

  if (acResults.length === 0) {
    list.classList.remove('show');
    return;
  }

  list.innerHTML = '';
  acResults.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item' + (i === acHighlightIdx ? ' highlighted' : '');

    const flag = getFlag(p.nat);
    const meta = [p.nat, p.club].filter(Boolean).join(' · ');

    div.innerHTML = `
      <span class="ac-flag">${flag}</span>
      <div class="ac-info">
        <div class="ac-name">${p.n}</div>
        ${meta ? `<div class="ac-meta">${meta}</div>` : ''}
      </div>
    `;
    div.addEventListener('click', () => selectAcItem(p));
    list.appendChild(div);
  });
  list.classList.add('show');
}

function updateAcHighlight() {
  const list = $('acList');
  list.querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('highlighted', i === acHighlightIdx);
  });
  const highlighted = list.querySelector('.highlighted');
  if (highlighted) highlighted.scrollIntoView({ block: 'nearest' });
}

function selectAcItem(player) {
  $('acList').classList.remove('show');
  $('playerInput').value = player.n;
  submitPlayer(player.id);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initEvents() {
  // Start screen: mode buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => startSetup(btn.dataset.mode));
  });

  // Navigation buttons
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.target));
  });

  // Category reveal
  $('btnPlayCategory').addEventListener('click', startGame);
  $('btnSkipCategory').addEventListener('click', skipCategory);

  // Game: back to menu
  $('btnBackToMenu').addEventListener('click', () => {
    clearInterval(timerInterval);
    showScreen('startScreen');
  });

  // Rematch
  $('rematchBtn').addEventListener('click', () => {
    showCategoryReveal();
  });
}

// ============================================================
// BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initEvents();
  initAutocomplete();
});
