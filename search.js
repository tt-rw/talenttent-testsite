// ─── Zoekfunctie ─────────────────────────────────────────────────────────────

// TT-514 (besluit Ronald, 25-10-2026: "podium is goed"): overal "Podium", gelijk aan het keuzemenu in de setlist.
const LEVEL_LABELS = { basis: 'Basis', bijna: 'Bijna', podium: 'Podium' };

// TT-47 (herzien 09-08-2026): concrete ambitie-vragen naast het abstracte
// doelveld — alleen ter aanvulling van het profiel, bewust geen zoekfilter
// (besluit Ronald, 09-08-2026). Eerste versie had een aparte "wil je
// optreden?"-vraag die dubbel op de doelkaart "Optreden" zat; vervangen door
// een vraag over muzikale groei, die geen overlap heeft met het doelveld.
// Nog niet definitief (Ronald, 09-08-2026: "dit is nog niet goed genoeg") —
// doel en ambitie voelen nog te dicht bij elkaar, komt terug in een latere sessie.
const REHEARSAL_LABELS = {
  dagelijks:       'Dagelijks',
  wekelijks:       'Wekelijks',
  paar_per_maand:  'Paar keer per maand',
  losse_jams:      'Losse jams, als het uitkomt',
  per_project:     'Projectmatig'
};
const AMBITION_LABELS = {
  verbeteren: 'Mezelf verbeteren op mijn instrument',
  stijlen:    'Nieuwe stijlen ontdekken',
  eigen_werk: 'Samen nummers/eigen werk maken',
  plezier:    'Gewoon plezier, geen groot plan'
};
// TT-52 (12-08-2026): repertoire-type, optioneel, per profiel (niet per nummer).
// Losse waarden gekozen (niet 'eigen_werk' hergebruikt) omdat musical_ambition.eigen_werk
// een andere betekenis heeft: dat is een wens ("samen nummers/eigen werk maken"),
// dit veld is een feit over het huidige repertoire ("covers/eigen nummers/beide").
const REPERTOIRE_TYPE_LABELS = {
  covers: 'Covers',
  eigen:  'Eigen nummers',
  beide:  'Allebei'
};

// TT-520 (26-10-2026): één filterset voor muzikanten én bands. Instrument
// betekent bij een muzikant "speelt", bij een band "zoekt" (Laag 3.1, besluit
// Ronald 25-10-2026: een band die het gekozen instrument zoekt, is een treffer).
let filterInstruments = [];
let filterGenres      = [];
let searchSortMode    = 'score';

// TT-232 (09-09-2026): vaste stappen voor de draaiwielen. Lege waarde = het
// filter staat uit ("Alle" bovenaan het wiel, TT-308, was "Geen").
// Leeftijd: per 3 jaar tot 24, daarna per 5 — bij tieners telt één jaar
// verschil zwaar, bij volwassenen niet meer.
const WHEEL_AGE_MIN = [''].concat([13,16,19,22], rangeStep(25, 95, 5));
const WHEEL_AGE_MAX = [''].concat([15,18,21,24], rangeStep(30, 95, 5), [99]);
const WHEEL_NIVEAU  = ['', 1, 2, 3, 4, 5];
// TT-233 (10-09-2026): straal terug van 28 naar 10 standen. 28 standen tot
// 500 km vroegen een lange scrollbeweging voor een keuze die in de praktijk
// tussen 10 en 50 km ligt. Nederland is ongeveer 300 km lang.
const WHEEL_RADIUS  = [5, 10, 15, 25, 50, 75, 100, 150, 250, 500];
const STRAAL_STANDAARD = 10;  // beginstand van elk straalwiel (Ronald, 16-09-2026, TT-276; was 5)

function rangeStep(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

// TT-01 / TT-232: e-mailvoorkeuren, nu onder Instellingen. Beïnvloedt alleen
// de e-mail op de achtergrond, nooit de live zoekresultaten.
let digestFrequencyValue = 'daily';
// TT-520: het resultaat van Muzikanten, muzikanten en bands door elkaar. Elk
// item draagt `soort`: 'muzikant' of 'band'.
let lastZoekResultaten = [];
// TT-62: is de straal automatisch verruimd, dan staat hier {van, naar}.
// {leeg:true} betekent: ook landelijk niets gevonden. null = niet verruimd.
let zoekVerruimd = null;
// TT-295: vertrekpunt van de laatste zoekopdracht met eigen profiel, of null.
let laatsteZoekVertrek = null;
let setlistVerruimd = null;
// TT-30 (07-08-2026): lijst- of kaartweergave voor de zoekresultaten, apart
// onthouden (localStorage) — Ronald: "bij veel matches neig ik naar regels,
// maar bij veel profielfoto's is een kaart ook tof", dus geen vaste keuze maar
// een keuze die de gebruiker zelf zet.
// TT-U13 (12-08-2026): op een telefoon zijn kaarten de standaard, niet de
// lijst. Je verkoopt mensen, geen records; op een rij is de foto 44px.
// Een eigen keuze blijft leidend — die staat in localStorage.
function standaardWeergave() {
  try { return window.matchMedia('(max-width: 560px)').matches ? 'grid' : 'list'; }
  catch (e) { return 'list'; }
}
// TT-387 (01-10-2026): de bewaarde keuze lezen, binnen try. Blokkeert de
// browser opslag ("alle cookies blokkeren"), dan gooit localStorage een
// SecurityError. Zonder try brak search.js hier af, en gaf elke zoekopdracht
// daarna 0 resultaten zonder melding. Nu geldt dan gewoon de standaard.
function bewaardeWeergave(sleutel) {
  try { return localStorage.getItem(sleutel) || standaardWeergave(); }
  catch (e) { return standaardWeergave(); }
}
// TT-520: één weergave voor Muzikanten (muzikanten en bands samen). De
// beginstand is de lijst, ook op een telefoon: het resultaat is één regel per
// treffer (Laag 3.1.b.1, akkoord Ronald 25-10-2026); de kaarten staan onder
// Weergave. Een eigen keuze blijft leidend. Nieuwe sleutel, zodat de oude
// beginstand Kaarten van TT-U13 niet als eigen keuze meetelt.
let musicianViewMode = (() => {
  try { return localStorage.getItem('tt_zoekWeergave') || 'list'; }
  catch (e) { return 'list'; }
})();
// TT-U13: zet de markering in de keuzevelden gelijk aan de werkelijke stand.
// De HTML markeert "Lijst" vast; op een telefoon klopt dat niet meer.
function syncViewToggles() {
  const musicianSel = document.getElementById('musicianViewToggle');
  if (musicianSel) musicianSel.value = musicianViewMode;
  const setlistSel = document.getElementById('setlistViewToggle');
  if (setlistSel) setlistSel.value = setlistViewMode;
  refreshChoiceField('weergave');
  refreshChoiceField('setlist-weergave');
}

function setMusicianViewMode(mode) {
  musicianViewMode = mode;
  try { localStorage.setItem('tt_zoekWeergave', mode); } catch(e) {}
  const sel = document.getElementById('musicianViewToggle');
  if (sel) sel.value = mode;
  refreshChoiceField('weergave');
  if (lastZoekResultaten.length) renderCappedZoekResultaten();
}
// Afstand per muzikant-id, gevuld door zoekresultaten (gewoon zoeken en setlist-
// zoeken). Gebruikt om de afstand ook te tonen als iemand het profiel opent
// vanuit een resultatenlijst — zonder de postcode zelf ooit te tonen (TT-04).
let musicianDistanceCache = {};

// ─── De drie schermen van Zoeken (TT-520, 26-10-2026) ────────────────────────
// 'start' is de bovenkant van het tabblad: titel Zoeken en twee tegels.
// 'muzikanten' en 'mixmatch' liggen één stap dieper; terug brengt je naar het
// startscherm (appTerug() in core.js). Geen nieuwe view: de views blijven
// zestien (app-gedrag §9).
//
// zoekSchermDirect: het scherm is van buiten Zoeken geopend (een open rol van
// je band, TT-385). Ligt er een scherm achter je, dan gaat terug daarheen, niet
// langs het startscherm dat je nooit zag.
let zoekScherm = 'start';
let zoekSchermDirect = false;
// Alles · Muzikanten · Bands (Laag 3.1). Alles is de beginstand.
let zoekSoort = 'alles';
const ZOEK_SOORTEN = ['alles', 'muzikanten', 'bands'];
const ZOEK_SCHERMEN = ['start', 'muzikanten', 'mixmatch'];
const ZOEK_SCHERM_IDS = { start: 'zoekStart', muzikanten: 'searchModeMusician', mixmatch: 'searchModeSetlist' };

// Zet het scherm zonder te zoeken.
function zetZoekScherm(scherm) {
  if (!ZOEK_SCHERMEN.includes(scherm)) scherm = 'start';
  zoekScherm = scherm;
  if (scherm === 'start') zoekSchermDirect = false;
  Object.keys(ZOEK_SCHERM_IDS).forEach(k => {
    const el = document.getElementById(ZOEK_SCHERM_IDS[k]);
    if (el) el.style.display = k === scherm ? 'block' : 'none';
  });
  bewaarZoekStand(); // TT-279: overleeft verversen
  if (typeof werkTerugKnopBij === 'function') werkTerugKnopBij();
}

// Een tik op een tegel, of een knop elders die meteen naar Muzikanten gaat.
function openZoekScherm(scherm, opties) {
  opties = opties || {};
  zetZoekScherm(scherm);
  zoekSchermDirect = !!opties.direct;
  if (!opties.stil) window.scrollTo({ top: 0, behavior: 'instant' });
  if (scherm === 'muzikanten') { initSearchFilters(); if (!opties.geenZoek) runSearch(); }
  if (scherm === 'mixmatch') {
    initSetlistSearchFilters();
    if (setlistSoort === 'nummers') initGedeeldSearchFilters(); // TT-289
    setlistZoekVerversen();
  }
}

// De landingspagina en "Muzikanten zoeken →" in een lege staat: meteen het
// scherm Muzikanten (TT-520, startnotitie: "landingsknop opent Muzikanten
// direct"). Zoeken is een tabblad; het startscherm ligt eronder.
function openZoekMuzikanten() {
  showView('search');
  // configureSearchAccess() (vanuit showView) zoekt zodra het profiel bekend is.
  openZoekScherm('muzikanten', { geenZoek: true });
}

// Terug vanaf Muzikanten of Mix & Match (appTerug() in core.js).
function zoekSchermTerug() {
  const direct = zoekSchermDirect && navStack.length;
  zetZoekScherm('start');
  if (direct) { popNavStap(); return; }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// TT-279: het scherm en de soort overleven verversen. Alleen voor deze kijker,
// in dit tabblad van de browser; lukt opslaan niet, dan begint Zoeken bij het
// startscherm.
function bewaarZoekStand() {
  try { sessionStorage.setItem('tt-zoekstand', JSON.stringify({ scherm: zoekScherm, soort: zoekSoort })); } catch (e) { /* geen opslag: geen herstel */ }
}
function herstelZoekStand() {
  let stand = null;
  try { stand = JSON.parse(sessionStorage.getItem('tt-zoekstand') || 'null'); } catch (e) { return; }
  if (!stand) return;
  if (ZOEK_SOORTEN.includes(stand.soort)) zetZoekSoortKnoppen(stand.soort);
  if (ZOEK_SCHERMEN.includes(stand.scherm)) zetZoekScherm(stand.scherm);
}

function zetZoekSoortKnoppen(soort) {
  zoekSoort = soort;
  const ids = { alles: 'zoekSoortAllesBtn', muzikanten: 'zoekSoortMuzikantenBtn', bands: 'zoekSoortBandsBtn' };
  Object.keys(ids).forEach(k => {
    const b = document.getElementById(ids[k]);
    if (!b) return;
    b.classList.toggle('active', k === soort);
    b.setAttribute('aria-selected', k === soort ? 'true' : 'false');
  });
}

function setZoekSoort(soort) {
  if (!ZOEK_SOORTEN.includes(soort)) return;
  zetZoekSoortKnoppen(soort);
  bewaarZoekStand();
  runSearch();
}

// Filters klapt open onder Plaats en Straal; het pijltje draait om (TT-520,
// sessie 18, punt 1). Geen getal achter het woord (besluit Ronald: "weglaten").
let zoekFiltersOpen = false;
function zetZoekFilters(open) {
  zoekFiltersOpen = !!open;
  const vak = document.getElementById('zoekFilterVak');
  const knop = document.getElementById('zoekFiltersKnop');
  if (vak) vak.hidden = !zoekFiltersOpen;
  if (knop) {
    knop.setAttribute('aria-expanded', zoekFiltersOpen ? 'true' : 'false');
    knop.classList.toggle('open', zoekFiltersOpen);
  }
}
function toggleZoekFilters() { zetZoekFilters(!zoekFiltersOpen); }

// De i bij Niveau: onder Bands de tabel van de band, anders die van de muzikant.
// De woorden van beide tabellen wijzigen in bouwsessie c (Algemeen b.2).
function openZoekNiveauInfo() {
  if (zoekSoort === 'bands') openBandNiveauInfoModal();
  else openMusicianNiveauInfoModal();
}

// Debounce-timers voor tekstvelden die automatisch verversen: een klik op een
// tag mag direct verversen, maar bij typen (naam/plaats/leeftijd) wachten we
// een fractie van een seconde na de laatste toetsaanslag, anders zoekt de app
// bij elke letter opnieuw — hakkelig en onnodig zwaar.
let musicianAutoSearchTimeout = null;
let setlistAutoSearchTimeout = null;

// TT-84 (10-08-2026, externe review 2.3): volgnummers tegen verouderde
// resultaten. De debounce hierboven wacht 400 ms na de laatste toetsaanslag,
// maar stopt een zoekopdracht die al onderweg is niet. Op een traag mobiel
// netwerk kan zoekopdracht A dus ná zoekopdracht B binnenkomen. Het scherm
// toont dan het antwoord op filters die de gebruiker net heeft aangepast.
// Elke zoekopdracht krijgt nu een nummer. Alleen het antwoord met het hoogste
// nummer mag het scherm en de resultaatlijst nog aanraken.
let musicianSearchSeq = 0;
let setlistSearchSeq = 0;

function scheduleMusicianAutoSearch() {
  clearTimeout(musicianAutoSearchTimeout);
  musicianAutoSearchTimeout = setTimeout(() => runSearch(), 400);
}
function scheduleSetlistAutoSearch() {
  clearTimeout(setlistAutoSearchTimeout);
  // Zonder minstens 1 opgegeven nummer heeft zoeken geen betekenis — dan
  // stilzwijgend niets doen i.p.v. een foutmelding te tonen terwijl iemand
  // nog gewoon de plaats/straal aan het intypen is.
  setlistAutoSearchTimeout = setTimeout(() => { if (setlistWantedSongs.length) runSetlistSearch(); }, 400);
}

// TT-232 (09-09-2026, besluit Ronald): de matchscore komt niet uit de
// database en zegt niets over jouw eigen profiel. Hij telt uitsluitend wat je
// zelf hebt ingevuld:
//   3 punten per gekozen instrument dat deze muzikant speelt;
//   2 punten per gekozen genre dat deze muzikant speelt.
// Instrument weegt zwaarder dan genre: je zoekt een bassist, geen genre.
// Straal telt niet mee als punten — die is al een harde grens.
// TT-520 (besluit Ronald 26-10-2026, sessie 17 punt 7): bands volgen dezelfde
// regel. Een band krijgt 3 punten per gekozen instrument dat hij zoekt, en 2
// per gekozen genre dat hij speelt. De genrescore uit de database (Jaccard)
// telt niet meer, ook niet met een eigen profiel.
function musicianFilterScore(m) {
  let score = 0;
  if (filterInstruments.length) {
    const mine = (m.musician_instruments || []).map(x => x.instrument);
    score += 3 * filterInstruments.filter(i => mine.includes(i)).length;
  }
  if (filterGenres.length) {
    const mine = (m.musician_genres || []).map(x => x.genre);
    score += 2 * filterGenres.filter(g => mine.includes(g)).length;
  }
  return score;
}
function bandFilterScore(b) {
  let score = 0;
  if (filterInstruments.length) {
    const gezocht = (b.band_wanted || []).map(w => w.instrument);
    score += 3 * filterInstruments.filter(i => gezocht.includes(i)).length;
  }
  if (filterGenres.length) {
    score += 2 * filterGenres.filter(g => (b.genres || []).includes(g)).length;
  }
  return score;
}

// Laatst actief (25-09-2026, besluit Ronald). Drie groepen:
//   0 = actief in de laatste 30 dagen
//   1 = actief in de laatste 6 maanden
//   2 = langer geleden
// De database geeft per profiel alleen de groep en een rangnummer terug
// (1 = het laatst actief), nooit de datum zelf. Bij een band telt de
// beheerder: de oprichter kan de band al verlaten hebben.
// Mislukt de vraag, dan staat iedereen in groep 0: de gekozen sortering
// werkt dan gewoon, zonder dat de gebruiker iets merkt.
async function zetActiefStand(soort, lijst) {
  lijst.forEach(x => { x.actiefGroep = 0; x.actiefRang = 0; });
  if (!lijst.length) return;
  const functie = soort === 'band' ? 'tt_band_actief_stand' : 'tt_actief_stand';
  try {
    const { data, error } = await db.rpc(functie, { ids: lijst.map(x => x.id) });
    if (error) throw error;
    const perId = {};
    (data || []).forEach(r => { perId[r.id] = r; });
    lijst.forEach(x => {
      const r = perId[x.id];
      x.actiefGroep = r ? r.groep : 2;
      x.actiefRang  = r ? r.rang  : Number.MAX_SAFE_INTEGER;
    });
  } catch (e) {
    logCaught('zetActiefStand', e);
  }
}

function vergelijkActiefGroep(a, b) {
  return (a.actiefGroep || 0) - (b.actiefGroep || 0);
}

// De naam waarop een treffer alfabetisch staat: een muzikant zijn gekozen
// naam (TT-420), een band zijn bandnaam.
function zoekNaamVan(x) {
  return (x.soort === 'band' ? (x.name || '') : displayNameOf(x)).toLowerCase();
}
// Een band die nog iemand zoekt: een open rol (band_wanted).
function bandZoekt(b) {
  return (b.band_wanted || []).length > 0;
}

/* TT-520 — Beste match (besluit Ronald 26-10-2026, sessie 17 punt 7, keuze b),
   voor Alles, Muzikanten en Bands:
     1. de afstand in ringen van 5 km (0–5, 5–10, …). "De afstand is altijd
        relevant." Zonder vertrekpunt staat iedereen in dezelfde ring;
     2. binnen de ring een band die nog iemand zoekt boven een complete band
        (sessie 18, akkoord Ronald);
     3. binnen de ring laatst actief, in de drie groepen van TT-324;
     4. de afstand op de kilometer;
     5. de punten uit de filters (instrument 3, genre 2);
     6. de naam.
   Vervangt de volgorde van TT-232/TT-324, waar laatst actief vóór alles ging.
   Dichtstbijzijnde en Laatst actief houden hun volgorde (groep eerst). */
const ZOEK_RING_KM = 5;
function zoekRing(x) {
  return x.distance_km != null ? Math.floor(x.distance_km / ZOEK_RING_KM) : 0;
}
function zoekCompleteBand(x) {
  return x.soort === 'band' && !bandZoekt(x) ? 1 : 0;
}
function sortZoekLijst(list) {
  list.sort((a, b) => {
    if (searchSortMode === 'score') {
      const ring = zoekRing(a) - zoekRing(b);
      if (ring) return ring;
      const compleet = zoekCompleteBand(a) - zoekCompleteBand(b);
      if (compleet) return compleet;
      const groep = vergelijkActiefGroep(a, b);
      if (groep) return groep;
      if (a.distance_km != null && b.distance_km != null) {
        const km = Math.round(a.distance_km) - Math.round(b.distance_km);
        if (km) return km;
      }
      if (a.matchScore !== b.matchScore) return (b.matchScore || 0) - (a.matchScore || 0);
      return zoekNaamVan(a).localeCompare(zoekNaamVan(b), 'nl');
    }
    const groep = vergelijkActiefGroep(a, b);
    if (groep) return groep;
    if (searchSortMode === 'distance' && a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }
    if (searchSortMode === 'actief' && a.actiefRang !== b.actiefRang) return a.actiefRang - b.actiefRang;
    return zoekNaamVan(a).localeCompare(zoekNaamVan(b), 'nl');
  });
  return list;
}

// Volgorde staat in de filters: her-sorteert direct de al opgehaalde
// resultaten, geen nieuwe zoekopdracht nodig.
function setSearchSortMode(mode) {
  // "Dichtstbijzijnde" zonder afstandsgegevens (geen Plaats ingevuld als
  // vertrekpunt) zou de keuze laten staan zonder dat er iets verandert —
  // verwarrend. Geef dan een duidelijke melding i.p.v. stilzwijgend niets doen.
  if (mode === 'distance' && lastZoekResultaten.length && !lastZoekResultaten.some(x => x.distance_km != null)) {
    showToast('Vul een plaats in om op afstand te sorteren.');
    document.getElementById('filterSortMode').value = searchSortMode;
    refreshChoiceField('sorteren');
    return;
  }
  searchSortMode = mode;
  const sel = document.getElementById('filterSortMode');
  if (sel) sel.value = mode;
  refreshChoiceField('sorteren');
  if (lastZoekResultaten.length) {
    sortZoekLijst(lastZoekResultaten);
    renderCappedZoekResultaten();
  }
}

// Instrument en Genre tonen hun keuze in het veld zelf (TT-520): "Alle" zolang
// er niets gekozen is, net als Leeftijd en Niveau ernaast (TT-308).
function pickerVeldTekst(lijst) {
  return lijst.length ? lijst.join(', ') : 'Alle';
}

function initSearchFilters() {
  if (PICKERS.filterInstruments) return; // al ingevuld

  // TT-55/TT-183: maximaal 1 instrument, Zang en Songwriting als losse
  // uitzonderingen die niet meetellen voor die limiet — afgehandeld door
  // de generieke picker (singleMax + exceptionValues), zie
  // choosePickerListValue().
  initPicker({
    id: 'filterInstruments',
    fieldId: 'filterInstrumentsField',
    options: INSTRUMENTS, getList: () => filterInstruments,
    singleMax: true, exceptionValues: ['Zang', 'Songwriting'],
    inVeld: pickerVeldTekst,
    sheetTitle: 'Kies een instrument',
    onChange: runSearch
  });

  initPicker({
    id: 'filterGenres',
    fieldId: 'filterGenresField',
    options: GENRES, getList: () => filterGenres,
    inVeld: pickerVeldTekst,
    sheetTitle: 'Kies een genre',
    onChange: runSearch
  });

  // TT-233 (10-09-2026): de wielvelden. Elk veld opent een bladwijzer met het
  // wiel erin; het wiel schrijft naar de verborgen invoervelden die runSearch()
  // uitleest.
  initWheelField({
    id: 'radius',
    fieldId: 'filterRadiusField',
    title: 'Straal',
    unit: 'km',
    columns: [{ inputId: 'filterRadius', values: WHEEL_RADIUS, ariaLabel: 'Zoekstraal in kilometers' }],
    value: [STRAAL_STANDAARD],
    clearTo: [STRAAL_STANDAARD],
    // Zoeken zonder straal bestaat niet, dus "aan" betekent hier: afgeweken
    // van de standaard. Een veld dat altijd goud is, zegt niets.
    isActief: (v) => Number(v[0]) !== STRAAL_STANDAARD,
    format: (v) => `${v[0]} km`,
    hint:   (v) => `Straal ${v[0]} km`,
    onChange: runSearch
  });

  initWheelField({
    id: 'leeftijd',
    fieldId: 'filterAgeField',
    title: 'Leeftijd',
    sep: 't/m',
    unit: 'jaar',
    koppelBereik: true,
    columns: [
      { inputId: 'filterAgeMin', values: WHEEL_AGE_MIN, ariaLabel: 'Leeftijd vanaf' },
      { inputId: 'filterAgeMax', values: WHEEL_AGE_MAX, ariaLabel: 'Leeftijd tot en met' }
    ],
    value: ['', ''],
    format: (v) => leeftijdKort(v[0], v[1]),
    hint:   (v) => leeftijdBereikTekst(v[0], v[1]),
    onChange: runSearch
  });

  // TT-520: Niveau geldt voor muzikant en band (één woord, Laag 3.1). Bij een
  // muzikant het niveau op een instrument, bij een band het niveau van de band.
  initWheelField({
    id: 'niveau',
    fieldId: 'filterNiveauField',
    title: 'Niveau',
    sep: 't/m',
    koppelBereik: true,
    // Niveau begint bij 1. "Geen t/m 2" bestaat dus niet: kiest iemand een
    // bovengrens terwijl de ondergrens op Geen staat, dan wordt die 1.
    // (Ronald, 10-09-2026)
    ondergrensVerplicht: true,
    infoActie: openZoekNiveauInfo,
    columns: [
      { inputId: 'filterNiveauMin', values: WHEEL_NIVEAU, ariaLabel: 'Niveau vanaf' },
      { inputId: 'filterNiveauMax', values: WHEEL_NIVEAU, ariaLabel: 'Niveau tot en met' }
    ],
    value: ['', ''],
    format: (v) => niveauKort(v[0], v[1]),
    hint:   (v) => niveauBereikTekst(v[0], v[1]),
    onChange: runSearch
  });

  // Volgorde en Weergave: geen wiel maar een keuzemenu (huisstijl §7.1).
  initChoiceField({ id: 'sorteren', fieldId: 'filterSortModeField',
                    menuId: 'filterSortModeMenu', selectId: 'filterSortMode' });
  initChoiceField({ id: 'weergave', fieldId: 'musicianViewToggleField',
                    menuId: 'musicianViewToggleMenu', selectId: 'musicianViewToggle' });
  syncViewToggles();
}

// De naam van een niveau, uit dezelfde tabel als de i-knop toont
// (NIVEAU_INFO_MUSICIAN_ROWS in musicians.js) — één bron, geen tweede lijst die
// uit de pas kan lopen. "1. Beginner (Bedroom)" wordt "Beginner".
function niveauNaam(n) {
  try {
    return NIVEAU_INFO_MUSICIAN_ROWS[n - 1][0].replace(/^\d+\.\s*/, '').replace(/\s*\(.*\)\s*$/, '');
  } catch (e) {
    return '';
  }
}

// Leest een gekozen bereik terug in woorden. De korte vorm staat in het
// gesloten veld, de lange vorm op de terugleesregel in de bladwijzer.
// In het gesloten veld staat een streepje tussen de grenzen: "22 - 40 jaar"
// (Ronald, 10-09-2026). Korter dan "t/m", en het veld is maar een halve regel
// breed. In het wiel en op de terugleesregel blijft "t/m" staan — daar is
// ruimte en leest het woord duidelijker.
function leeftijdKort(min, max) {
  if (min === '' && max === '') return 'Alle'; // TT-308, zie utils.js/initWheel
  if (min !== '' && max === '') return `${min}+ jaar`;
  if (min === '' && max !== '') return `t/m ${max} jaar`;
  if (min === max) return `${min} jaar`;
  return `${min} - ${max} jaar`;
}

function leeftijdBereikTekst(min, max) {
  if (min === '' && max === '') return 'Alle leeftijden';
  if (min !== '' && max === '') return `${min} jaar en ouder`;
  if (min === '' && max !== '') return `Tot en met ${max} jaar`;
  if (min === max) return `Alleen ${min} jaar`;
  return `${min} t/m ${max} jaar`;
}

function niveauKort(min, max) {
  if (min === '' && max === '') return 'Alle'; // TT-308, zie utils.js/initWheel
  if (min !== '' && max === '') return `${min}+`;
  if (min === max) return `Alleen ${min}`;
  return `${min} - ${max}`;
}

function niveauBereikTekst(min, max) {
  const naam = (n) => { const t = niveauNaam(n); return t ? ` — ${t}` : ''; };
  if (min === '' && max === '') return 'Alle niveaus';
  if (min !== '' && max === '') return `Niveau ${min} en hoger${naam(min)}`;
  if (min === max) return `Alleen niveau ${min}${naam(min)}`;
  return `Niveau ${min} t/m ${max} — ${niveauNaam(min)} t/m ${niveauNaam(max)}`;
}

// Straal-invoer strikt uitlezen: 0 km moet ook echt 0 km betekenen (0 is
// falsy in JS, dus "|| 25" zou 0 onterecht vervangen door de standaardwaarde).
function parseRadiusInput(id) {
  const raw = document.getElementById(id).value;
  if (raw === '' || raw == null) return 25;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 25;
}

/* TT-62 (11-09-2026) — nooit nul zoekresultaten tonen, deel 1.

   Levert een zoekopdracht niets op terwijl er een straal actief is, dan
   verruimt de app de straal zelf tot er wél iets staat. De gebruiker krijgt
   het dichtstbijzijnde resultaat te zien, met één regel die uitlegt wat er is
   gebeurd. Zonder dit eindigt vrijwel elke echte zoekopdracht in een leeg
   scherm met drie opdrachten erin — terwijl de app gewoon nog leeg is.

   Deze ladder en de twee hulpfuncties gelden voor Muzikanten en Mix & Match.
   Eén regel, één plek.

   GEVERIFIEERD 11-09-2026, tegen de productiedatabase, ingelogd:
   `tt_search_musicians` en `tt_search_bands_for_musician` met `radius_km: null`
   geven **nul rijen** terug — null betekent daar dus niet "geen beperking".
   Daarom eindigt de ladder op een getal, niet op null. 500 km overspant
   Nederland ruim; dat is de laatste trede. */
const STRAAL_LADDER = [10, 25, 50, 100, 250, 500];
const STRAAL_LANDELIJK = 500;

// Geeft de eerstvolgende ruimere straal, of undefined als er geen ruimere is.
function volgendeStraal(huidig) {
  if (huidig == null) return undefined;
  for (const r of STRAAL_LADDER) {
    if (r > huidig) return r;
  }
  return undefined;
}

function straalTekst(km) {
  return km == null ? 'je zoekgebied' : `${km} km`;
}

/* De regel boven het resultaat na automatisch verruimen.

   Tekst vastgesteld door Ronald, 11-09-2026. Twee zinnen. De eerste zegt wat
   er niet is, de tweede wat er wel staat. Beide getallen blijven erin: zonder
   de straal weet de lezer niet waarom de lijst verder weg ligt. */
function verruimdNotice(verruimd, meervoud) {
  if (!verruimd || verruimd.leeg) return '';
  const staart = verruimd.naar >= STRAAL_LANDELIJK
    ? `Dit zijn de dichtstbijzijnde ${meervoud} in heel Nederland.`
    : `Dit zijn de dichtstbijzijnde ${meervoud}, tot ${verruimd.naar} km.`;
  return `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Binnen ${straalTekst(verruimd.van)} vonden we nog geen match. ${staart}</p>`;
}

// Het woord voor wat er op het scherm staat, per soort (TT-520).
function zoekMeervoud() {
  return zoekSoort === 'bands' ? 'bands' : zoekSoort === 'muzikanten' ? 'muzikanten' : 'muzikanten en bands';
}

// Wissen — wist alle velden, behalve Plaats en Straal (besluit Ronald
// 26-10-2026, sessie 18 punt 3: "laat dan alleen de stad en straal staan").
// Alles · Muzikanten · Bands en Weergave zijn geen filters en blijven staan.
// Zoekt daarna meteen opnieuw (TT-10: nooit een leeg scherm na het wissen).
function resetMusicianSearch() {
  document.getElementById('filterName').value = '';
  // TT-233: de wielvelden terug naar hun beginstand. false = niet zelf opnieuw
  // zoeken; deze functie doet dat hieronder één keer.
  setWheelFieldValues('leeftijd', ['', ''], false);
  setWheelFieldValues('niveau',   ['', ''], false);
  filterInstruments.length = 0;
  filterGenres.length = 0;
  renderPickerBadges(PICKERS.filterInstruments);
  renderPickerBadges(PICKERS.filterGenres);
  selectSortModeByValue('filterSortMode', 'score');
  refreshChoiceField('sorteren');
  runSearch();
}

// TT-385 fase 3 (punt 7): een tik op een open rol of invaller van je eigen
// band opent Muzikanten met dat instrument en de plaats van de band. De andere
// filters gaan terug naar hun beginstand, zodat het resultaat over deze ene
// vraag gaat. Eén regel erboven zegt waarvoor (verdwijnt bij de volgende
// keer dat Zoeken opent, configureSearchAccess()). Een invaller vraag je in
// een bericht; een vast lid nodig je uit vanuit het venster van de muzikant
// (rolUitnodigKnopPlaatsen() in bands.js, besluit Ronald 02-10-2026).
// TT-520: je zoekt hier een muzikant, dus de soort is Muzikanten, en Filters
// staat open, zodat je het gekozen instrument ziet.
function zoekMuzikantVoorRol(instrument, plaats, bandNaam, datum, bandId) {
  sluitAlleMenus();
  // TT-450: 'behoud'. Zoeken is een tabblad en wist anders de stapel; terug
  // moet naar de bandpagina of het tegeloverzicht waar je vandaan kwam.
  showView('search', 'behoud');
  initSearchFilters();
  document.getElementById('filterName').value = '';
  document.getElementById('filterCity').value = plaats || '';
  setWheelFieldValues('leeftijd', ['', ''], false);
  setWheelFieldValues('niveau',   ['', ''], false);
  setWheelFieldValues('radius',   [STRAAL_STANDAARD], false);
  filterInstruments.length = 0;
  filterInstruments.push(instrument);
  filterGenres.length = 0;
  renderPickerBadges(PICKERS.filterInstruments);
  renderPickerBadges(PICKERS.filterGenres);
  if (plaats) scheduleSearchCityStatus('filterCity', 'filterCityStatus');
  zetZoekSoortKnoppen('muzikanten');
  zetZoekFilters(true);
  // configureSearchAccess() (vanuit showView) zoekt meteen (TT-10).
  openZoekScherm('muzikanten', { direct: true, geenZoek: true });
  zoekRolBand = (!datum && bandId) ? { id: bandId, naam: bandNaam || '' } : null;
  const melding = document.getElementById('zoekRolMelding');
  const rond = plaats ? `Muzikanten rond ${escHtml(plaats)}.` : 'Muzikanten bij jou in de buurt.';
  melding.innerHTML = datum
    ? `<p class="melding-tekst"><strong>${escHtml(instrument)} voor ${invallerDatum(datum)}.</strong> ${rond} Vraag ze in een bericht.</p>`
    : `<p class="melding-tekst"><strong>${escHtml(instrument)} voor ${escHtml(bandNaam || 'je band')}.</strong> ${rond} Open een profiel om uit te nodigen.</p>`;
  melding.hidden = false;
}

/* TT-442 (08-10-2026, besluit Ronald: optie A): je eigen profiel staat niet
   in de resultaten van Zoeken. Een rij met jezelf had geen doel, en een bericht
   aan jezelf verscheen dubbel. Geldt voor Muzikanten en voor Zoek muzikanten
   in Mix & Match. "Maak setlist" is een ander scherm en zet je eigen naam
   bewust wel in de lijst (TT-441). `myMusicianId` staat in core.js en is
   gevuld zodra een zoekopdracht met profiel loopt. */
function isEigenProfiel(id) {
  return !!myMusicianId && id === myMusicianId;
}

/* De muzikanten bij een vertrekpunt. Geeft { lijst, matchInfo } terug.
   Met eigen profiel: tt_search_musicians, met het eigen vertrekpunt of het
   getypte; zonder profiel de openbare functies. Ongewijzigd uit runSearch()
   van vóór TT-520. */
async function zoekMuzikantenOphalen(radius, origin) {
  const matchInfo = {};
  let musicians = [];
  if (hasOwnProfile) {
    const { data: matches, error: rpcErr } = await db.rpc('tt_search_musicians', {
      searcher_id: origin.mid, radius_km: radius,
      origin_lat: origin.lat, origin_lng: origin.lng
    });
    if (rpcErr) throw rpcErr;
    if (!matches.length) return { lijst: [], matchInfo };
    matches.forEach(m => { matchInfo[m.musician_id] = m; });
    const ids = matches.map(m => m.musician_id);
    // B-01 tweede stap (18-08-2026): birth_date staat niet in deze select. De
    // leeftijd komt apart binnen via tt_musicians_ages().
    const { data, error } = await db.from('musicians').select(`
      id, weergavenaam, username, city, zip, bio, goal,
      avatar_url,
      musician_instruments(instrument, niveau),
      musician_genres(genre),
      musician_songs(song_title, song_artist, mastery_level)
    `).in('id', ids);
    if (error) throw error;
    musicians = data || [];
    const { data: ages, error: ageErr } = await db.rpc('tt_musicians_ages', { ids });
    if (!ageErr && ages) {
      const ageById = {};
      ages.forEach(a => { ageById[a.id] = a.age; });
      musicians.forEach(m => { m.age = ageById[m.id]; });
    }
    // Gaat tt_musicians_ages mis: de lijst blijft gevuld, alleen zonder
    // leeftijd — geen kapot scherm.
  } else {
    const { data: matches, error: rpcErr } = await db.rpc('tt_search_musicians_anon', {
      origin_lat: origin.lat, origin_lng: origin.lng,
      radius_km: origin.lat != null ? radius : null,
    });
    if (rpcErr) throw rpcErr;
    if (!matches.length) return { lijst: [], matchInfo };
    matches.forEach(m => { matchInfo[m.musician_id] = m; });
    const ids = matches.map(m => m.musician_id);
    const { data, error } = await db.rpc('tt_get_musicians_public', { ids });
    if (error) throw error;
    // TT-420: de naam komt uit weergavenaam (weergavenamenToevoegen()), nooit
    // uit fname of lname. B-02: de publieke functie geeft de leeftijd, geen
    // geboortedatum.
    musicians = (data || []).map(m => ({
      id: m.id, username: m.username, age: m.age, birth_date: m.birth_date, city: m.city,
      bio: m.bio, goal: m.goal, avatar_url: m.avatar_url,
      musician_instruments: (m.instrument_levels || []).map(x => ({ instrument: x.instrument, niveau: x.niveau })),
      musician_genres: (m.genres || []).map(g => ({ genre: g })),
      musician_songs: m.songs || [],
    }));
    await weergavenamenToevoegen(musicians);
  }
  musicians.forEach(m => { m.soort = 'muzikant'; });
  return { lijst: musicians, matchInfo };
}

/* De bands bij een vertrekpunt. Zelfde vorm als hierboven. Een band die niet
   beschikbaar is, staat er gewoon in (TT-457). */
async function zoekBandsOphalen(radius, origin) {
  const matchInfo = {};
  let bands = [];
  if (hasOwnProfile) {
    const { data: matches, error: rpcErr } = await db.rpc('tt_search_bands_for_musician', {
      searcher_id: origin.mid, radius_km: radius,
      origin_lat: origin.lat, origin_lng: origin.lng
    });
    if (rpcErr) throw rpcErr;
    if (!matches.length) return { lijst: [], matchInfo };
    matches.forEach(m => { matchInfo[m.band_id] = m; });
    const ids = matches.map(m => m.band_id);
    // TT-385 fase 5: de bandfoto en de invallers voor de bandkaart. De leden
    // alleen om te tellen (bandStatusLabel()); geen namen.
    const { data, error } = await db.from('bands').select(`id, name, city, genres, status, niveau, avatar_url, band_members(status), band_wanted(instrument), band_invallers(instrument, datum)`).in('id', ids);
    if (error) throw error;
    bands = data || [];
  } else {
    const { data: matches, error: rpcErr } = await db.rpc('tt_search_bands_anon', {
      origin_lat: origin.lat, origin_lng: origin.lng,
      radius_km: origin.lat != null ? radius : null,
    });
    if (rpcErr) throw rpcErr;
    if (!matches.length) return { lijst: [], matchInfo };
    matches.forEach(m => { matchInfo[m.band_id] = m; });
    const ids = matches.map(m => m.band_id);
    const { data, error } = await db.rpc('tt_get_bands_public', { ids });
    if (error) throw error;
    // TT-385 fase 5: zelfde vorm als hierboven. tt_get_bands_public geeft alleen
    // bevestigde leden, alleen invallers vanaf vandaag, en geen bandfoto als de
    // band is afgeschermd (TT-385 punt 9).
    bands = (data || []).map(b => ({
      id: b.id, name: b.name, city: b.city, genres: b.genres || [], status: b.status,
      niveau: b.niveau,
      avatar_url: b.avatar_url || null,
      band_members: (b.members || []).map(() => ({ status: 'bevestigd' })),
      band_wanted: (b.wanted || []).map(i => ({ instrument: i })),
      band_invallers: b.invallers || [],
    }));
  }
  bands.forEach(b => { b.soort = 'band'; });
  return { lijst: bands, matchInfo };
}

/* TT-520: één zoekopdracht voor Alles, Muzikanten en Bands.
   TT-62: `straalOverride` is alleen voor de automatische verruiming hieronder.
   Roept een knop of filter deze functie aan, dan blijft die parameter leeg en
   geldt gewoon het straalveld van de gebruiker. */
async function runSearch(straalOverride) {
  const seq = ++musicianSearchSeq; // TT-84: zie toelichting bij musicianSearchSeq
  const resultsEl = document.getElementById('searchResults');
  if (straalOverride === undefined) zoekVerruimd = null; // nieuwe zoekopdracht
  // TT-10: bij automatisch verversen blijft het bestaande resultaat staan tot
  // het nieuwe binnen is — geen laadanimatie die het scherm laat "knipperen".
  // Alleen bij de allereerste zoekopdracht (nog niets op het scherm) tonen we 'm.
  if (!resultsEl.innerHTML.trim()) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div class="save-spinner" style="margin:0 auto 16px;"></div>Zoeken...
    </div>`;
  }

  try {
    // TT-257 (12-09-2026): zoekstandaard — zonder aanhalingstekens matcht een
    // deel van de naam, mét aanhalingstekens moet het exact zijn.
    const nameTerm = naamZoekTerm(document.getElementById('filterName').value);
    const cityQuery = document.getElementById('filterCity').value.trim().toLowerCase();
    const radius = straalOverride !== undefined ? straalOverride : parseRadiusInput('filterRadius');
    const ageMinVal = document.getElementById('filterAgeMin').value;
    const ageMaxVal = document.getElementById('filterAgeMax').value;
    const leeftijdGekozen = !!(ageMinVal || ageMaxVal);
    // Besluit Ronald 26-10-2026 (sessie 17 punt 5): zodra een leeftijd is
    // gekozen, verdwijnen de bands uit het resultaat, ook onder Alles.
    const metMuzikanten = zoekSoort !== 'bands';
    const metBands = zoekSoort !== 'muzikanten' && !leeftijdGekozen;

    // Onder Bands met een leeftijd: er is niets te zoeken. Geen verruiming.
    if (!metMuzikanten && !metBands) {
      lastZoekResultaten = [];
      zoekVerruimd = null;
      renderZoekResultaten([], { leeftijdBijBands: true });
      return;
    }

    /* TT-62: geen treffers en er is een straal actief? Dan opnieuw zoeken met
       de eerstvolgende ruimere straal. Geeft undefined terug als er niets
       ruimers meer is; dan pas verschijnt de lege staat. */
    const ruimerZoeken = (straalActief) => {
      // TT-257 (besluit Ronald, 12-09-2026): zoek je op naam, dan verruimt de
      // app niet. Je zoekt één bepaalde persoon of band.
      if (nameTerm) return undefined;
      if (!straalActief) return undefined;
      const volgende = volgendeStraal(radius);
      if (volgende === undefined) return undefined;
      zoekVerruimd = { van: zoekVerruimd ? zoekVerruimd.van : radius, naar: volgende };
      return volgende;
    };
    const geenResultaat = () => {
      lastZoekResultaten = [];
      // Is er al landelijk gezocht, dan ligt het aan de filters, niet aan de straal.
      zoekVerruimd = (straalOverride !== undefined && volgendeStraal(radius) === undefined)
        ? { van: zoekVerruimd ? zoekVerruimd.van : null, naar: radius, leeg: true }
        : null;
      renderZoekResultaten([], { verruimd: zoekVerruimd, naamGezocht: !!nameTerm, straal: radius });
    };

    // Het vertrekpunt. TT-80 (10-08-2026): met eigen profiel is de eigen stad
    // het vertrekpunt, tenzij je een andere plaats typt; dan wordt dát het
    // vertrekpunt. Zonder profiel het Plaats-veld (leeg of onbekend: geen
    // straal, alle profielen).
    let origin, originResolved;
    if (hasOwnProfile) {
      const mid = await getMyMusicianId();
      const myCity = await getMyCity();
      const typedCity = document.getElementById('filterCity').value.trim();
      const usesOwnCity = !typedCity || (!!myCity && typedCity.toLowerCase() === myCity.toLowerCase());
      const o = usesOwnCity ? { lat: null, lng: null } : await resolveSearchOrigin(typedCity);
      origin = { mid, lat: o.lat, lng: o.lng };
      // Een getypte plaats die nergens matcht valt terug op je eigen locatie,
      // en blijft dan als tekstfilter gelden, zodat een tikfout niet
      // stilzwijgend wordt genegeerd. TT-62: vóór het ophalen, want de
      // verruiming moet weten of er een straal actief is.
      originResolved = usesOwnCity || o.lat != null;
      // TT-295: het vertrekpunt van déze zoekopdracht, voor "Bewaar deze
      // zoekopdracht". De ingestelde straal, niet een verruimde (TT-62).
      laatsteZoekVertrek = originResolved ? {
        plaats: usesOwnCity ? null : typedCity,
        plaatsTekst: usesOwnCity ? (myCity || 'je woonplaats') : typedCity,
        lat: usesOwnCity ? null : o.lat,
        lng: usesOwnCity ? null : o.lng,
        straal: parseRadiusInput('filterRadius'),
      } : null;
    } else {
      const o = await resolveSearchOrigin(document.getElementById('filterCity').value);
      origin = { mid: null, lat: o.lat, lng: o.lng };
      originResolved = o.lat != null;
    }

    const leeg = { lijst: [], matchInfo: {} };
    const [muz, bnd] = await Promise.all([
      metMuzikanten ? zoekMuzikantenOphalen(radius, origin) : leeg,
      metBands ? zoekBandsOphalen(radius, origin) : leeg
    ]);
    if (seq !== musicianSearchSeq) return; // TT-84

    // Filters in de app (naam, plaats, leeftijd, instrument, niveau, genre).
    const ageMin = parseInt(ageMinVal) || 0;
    const ageMax = parseInt(ageMaxVal) || 150;
    // TT-51: niveau-bereik, aaneengesloten (1-5). Leeg = geen ondergrens/bovengrens.
    const niveauMinVal = document.getElementById('filterNiveauMin').value;
    const niveauMaxVal = document.getElementById('filterNiveauMax').value;
    const niveauMin = niveauMinVal ? parseInt(niveauMinVal) : 1;
    const niveauMax = niveauMaxVal ? parseInt(niveauMaxVal) : 5;
    const niveauFilterActive = !!(niveauMinVal || niveauMaxVal);
    // Als Plaats als vertrekpunt is herkend (straal actief) of een postcode is,
    // dan niet óók nog als letterlijk tekstfilter toepassen — anders vallen
    // buurplaatsen binnen de straal (bijv. Den Haag bij "Delft") er onterecht uit.
    const cityIsPostcode = /^[1-9][0-9]{3}$/.test(cityQuery.replace(/\s/g,''));
    const skipCityTextFilter = originResolved || cityIsPostcode;
    const plaatsPast = (stad) => !cityQuery || skipCityTextFilter || (stad || '').toLowerCase().includes(cityQuery);

    const muzikanten = muz.lijst.filter(m => {
      // TT-06 (18-09-2026): een blokkade werkt beide kanten op. Hier, vóór de
      // TT-62-controle, zodat de app ook dán eerst ruimer zoekt.
      if (isGeblokkeerd(m.id)) return false;
      if (isEigenProfiel(m.id)) return false; // TT-442
      const age = ageOf(m);
      if (age < ageMin || age > ageMax) return false;
      // TT-420 (besluit Ronald, 09-10-2026): het naamveld doorzoekt precies dát
      // wat je in de lijst ziet: de gekozen naam, voor iedereen gelijk.
      if (!naamMatcht(nameTerm, displayNameOf(m))) return false;
      if (!plaatsPast(m.city)) return false;
      if (filterInstruments.length) {
        const mInstr = m.musician_instruments.map(x => x.instrument);
        if (!filterInstruments.some(i => mInstr.includes(i))) return false;
      }
      // TT-51: het niveau van de gekozen instrumenten, of van alle instrumenten
      // als er geen is gekozen. Ontbrekende niveaudata sluit niemand uit —
      // liever te veel tonen dan iemand onterecht laten verdwijnen.
      if (niveauFilterActive) {
        const relevantInstr = filterInstruments.length
          ? m.musician_instruments.filter(x => filterInstruments.includes(x.instrument))
          : m.musician_instruments;
        const levels = relevantInstr.map(x => x.niveau).filter(n => n != null);
        if (levels.length && !levels.some(n => n >= niveauMin && n <= niveauMax)) return false;
      }
      if (filterGenres.length) {
        const mGenres = m.musician_genres.map(x => x.genre);
        if (!filterGenres.some(g => mGenres.includes(g))) return false;
      }
      return true;
    });

    const bands = bnd.lijst.filter(b => {
      if (!naamMatcht(nameTerm, b.name)) return false;
      if (!plaatsPast(b.city)) return false;
      if (filterGenres.length && !filterGenres.some(g => (b.genres || []).includes(g))) return false;
      // Een band die het gekozen instrument zoekt, is een treffer (TT-520).
      if (filterInstruments.length) {
        const gezocht = (b.band_wanted || []).map(w => w.instrument);
        if (!filterInstruments.some(i => gezocht.includes(i))) return false;
      }
      // TT-51: het niveau van de band zelf. Geen niveau gekozen: niet uitsluiten.
      if (niveauFilterActive && b.niveau != null && (b.niveau < niveauMin || b.niveau > niveauMax)) return false;
      return true;
    });

    // Afstand en punten (TT-232, TT-520).
    muzikanten.forEach(m => {
      const info = muz.matchInfo[m.id];
      m.distance_km = info ? info.distance_km : null;
      m.matchScore  = musicianFilterScore(m);
      musicianDistanceCache[m.id] = m.distance_km;
    });
    bands.forEach(b => {
      const info = bnd.matchInfo[b.id];
      b.distance_km = info ? info.distance_km : null;
      b.matchScore  = bandFilterScore(b);
    });

    // TT-62: de straal haalde wel iets op, maar de filters hielden alles
    // tegen. Ook dan eerst ruimer zoeken voordat de lege staat verschijnt.
    if (!muzikanten.length && !bands.length) {
      const v = ruimerZoeken(originResolved);
      if (v !== undefined) return runSearch(v);
      geenResultaat(); return;
    }
    await Promise.all([zetActiefStand('muzikant', muzikanten), zetActiefStand('band', bands)]);
    if (seq !== musicianSearchSeq) return; // TT-84
    lastZoekResultaten = sortZoekLijst(muzikanten.concat(bands));
    renderCappedZoekResultaten();

  } catch(e) {
    logCaught('runSearch', e);
    if (seq !== musicianSearchSeq) return; // TT-84: fout van een verouderde zoekopdracht niet tonen
    resultsEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">${friendlyErrorMessage(e, 'zoeken')}</div>`;
  }
}

// TT-10 (05-08-2026): nooit meer dan dit aantal tegelijk tonen, ook niet
// zonder filters — bij duizenden/tienduizenden profielen zou de browser
// anders vastlopen en het dataverkeer onnodig groot worden. Bij meer treffers
// dan dit aantal: gewoon de eerste N (op de gekozen volgorde) tonen, met een
// duidelijke melding erboven i.p.v. stilzwijgend afkappen.
const SEARCH_RESULT_LIMIT = 50;

// "3 muzikanten en 1 band gevonden" (TT-520).
function zoekTelling(lijst, total) {
  const muz = lijst.filter(x => x.soort === 'muzikant').length;
  const bnd = lijst.length - muz;
  if (total > lijst.length) return `${total} gevonden`;
  const m = muz ? `${muz} muzikant${muz !== 1 ? 'en' : ''}` : '';
  const b = bnd ? `${bnd} band${bnd !== 1 ? 's' : ''}` : '';
  return `${[m, b].filter(Boolean).join(' en ')} gevonden`;
}

function renderZoekResultaten(lijst, opts) {
  opts = opts || {};
  const el = document.getElementById('searchResults');
  const total = opts.total != null ? opts.total : lijst.length;
  // Het blok "Bewaar deze zoekopdracht" (TT-295) gaat over muzikanten; onder
  // Bands staat het niet. Het wordt in bouwsessie a, deel 2 de vink Onthoud.
  const seintje = zoekSoort !== 'bands';

  if (!total) {
    // TT-62: is er al automatisch tot heel Nederland verruimd, dan is de
    // straal niet meer het probleem. Dan die raad ook niet geven.
    // TT-257 (12-09-2026): zocht je op naam, dan is de raad "pas je filters
    // aan" verkeerd. Er is één filter dat ertoe doet — de naam zelf.
    const wat = zoekMeervoud();
    let kop, uitleg;
    if (opts.leeftijdBijBands) {
      // TT-520: een band heeft geen leeftijd (besluit 26-10-2026, punt 5).
      kop = 'Geen bands bij deze leeftijd';
      uitleg = 'Een band heeft geen leeftijd. Zet Leeftijd op Alle om bands te zien.';
    } else if (opts.naamGezocht) {
      const wie = { muzikanten: ['Deze muzikant staat er niet', 'Niemand'],
                    bands: ['Deze band staat er niet', 'Geen band'],
                    alles: ['Deze naam staat er niet', 'Geen muzikant of band'] }[zoekSoort];
      kop = wie[0];
      uitleg = `${wie[1]} met deze naam binnen ${straalTekst(opts.straal)}. Controleer de spelling, of vergroot je zoekstraal.`;
    } else {
      kop = `Geen ${wat} gevonden`;
      uitleg = opts.verruimd && opts.verruimd.leeg
        ? `Ook in heel Nederland voldoet niemand aan deze filters. Haal een filter weg.`
        : 'Pas je filters of zoekstraal aan, en controleer of je eigen postcode in je profiel klopt.';
    }
    el.innerHTML = `
      <div class="no-results">
        <p style="font-size:16px;font-weight:600;margin-bottom:8px;">${kop}</p>
        <p style="font-size:13px;">${uitleg}</p>
      </div>
      ${seintje ? '<div id="seintjePlek"></div>' : ''}`;
    if (seintje) vulSeintjeBlok();
    return;
  }

  const verruimd = verruimdNotice(opts.verruimd, zoekMeervoud());
  // TT-295: is de straal verruimd (TT-62), dan zit de juiste er dichtbij nog
  // niet bij. Precies dan hoort het blok bovenaan, direct onder die regel.
  // Anders staat het onder de lijst.
  const seintjePlek = seintje ? '<div id="seintjePlek"></div>' : '';
  const locationHint = opts.showLocationHint
    ? `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Dit zijn ${lijst.length} willekeurige ${zoekMeervoud()} uit heel Nederland — vul een plaats in voor resultaten bij jou in de buurt.</p>`
    : '';
  const cappedNotice = total > lijst.length
    ? `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Toont de eerste ${lijst.length} van ${total} resultaten — voeg een filter toe of verklein je zoekstraal voor een preciezer overzicht.</p>`
    : '';
  const kaarten = musicianViewMode === 'grid';
  el.innerHTML = `
    <div class="results-header">
      <span class="results-count">${zoekTelling(lijst, total)}</span>
    </div>
    ${verruimd}${verruimd ? seintjePlek : ''}${locationHint}${cappedNotice}
    <div class="${kaarten ? 'results-grid-view' : 'results-list'}">
      ${lijst.map(x => x.soort === 'band'
        ? (kaarten ? bandCardHTML(x) : bandRowHTML(x))
        : (kaarten ? musicianCardHTML(x) : musicianRowHTML(x))).join('')}
    </div>
    ${verruimd ? '' : seintjePlek}`;
  if (seintje) vulSeintjeBlok();
}

// Gedeeld door runSearch() en de volgorde- en weergavekeuze — zorgt dat
// afkappen tot SEARCH_RESULT_LIMIT en de bijbehorende meldingen altijd
// hetzelfde werken, of het resultaat nu net is opgehaald of opnieuw gesorteerd.
function renderCappedZoekResultaten() {
  const total = lastZoekResultaten.length;
  const shown = lastZoekResultaten.slice(0, SEARCH_RESULT_LIMIT);
  const cityFilled = !!document.getElementById('filterCity').value.trim();
  const showLocationHint = !hasOwnProfile && !cityFilled && total > 0;
  renderZoekResultaten(shown, { total, showLocationHint, verruimd: zoekVerruimd });
}

// TT-520 (besluit Ronald 26-10-2026, sessie 18 punt 5): de berichtknop is
// rond, een rond tekstballonnetje op een rond grijs vlak, het icoon in de
// tekstkleur. Gedeeld door de muzikant-rijen hier en in Mix & Match, en door
// de muzikantkaart. Niet bij een band: een bericht aan een band gaat via de
// bandpagina naar de contactpersoon.
const MESSAGE_ICON_SVG = `<svg class="result-row-msg-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><title>Bericht sturen mogelijk</title><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path></svg>`;

// TT-33 (07-08-2026): zonder profielfoto (of zonder identiteit, uitgelogd)
// tonen we altijd de "T" van het logo i.p.v. de voorletter van de naam —
// consistente merkherkenning i.p.v. een willekeurige letter per gebruiker
// (Ronald: "geef iedereen dan een typische T van het logo"). Zelfde lettertype
// als het woordmerk (--font-display).
// Bevinding Ronald 28-09-2026: de vorm staat in .avatar-t (styles.css), één
// klasse voor elke T in de app, 25% groter dan de letter van zijn vak.
const AVATAR_T_FALLBACK = `<span class="avatar-t">T</span>`;

// TT-420 (09-10-2026, besluit Ronald): één plek die bepaalt welke naam een ander
// te zien krijgt, voor ingelogd en uitgelogd gelijk. De gebruiker kiest zelf:
// echte naam (voor- en achternaam) of gebruikersnaam. De database zet die keuze
// om in de kolom weergavenaam (trigger tt_weergavenaam_bijwerken); onder de 16
// is dat altijd de gebruikersnaam. De app leest dus alleen weergavenaam en
// bepaalt zelf nooit uit fname of lname welke naam er staat. Een object zonder
// dat veld (de naam is er nog niet bij gehaald) toont de gebruikersnaam.
function displayNameOf(m) {
  if (!m) return 'Muzikant';
  if (m.weergavenaam !== undefined) return m.weergavenaam || 'Muzikant';
  return m.username || 'Muzikant';
}

// Bugfix/rename 19-08-2026 (Ronald): de zichtbare rol heet voortaan
// "Beheerder" i.p.v. "Oprichter" — één beheerder per band, geen meervoud.
// De opgeslagen waarde in band_members.role blijft letterlijk 'Oprichter';
// alleen de weergave verandert. Elke plek die role aan de gebruiker toont, gaat
// via deze functie — nooit meer m.role rechtstreeks in de HTML.
function roleLabel(role) {
  return role === 'Oprichter' ? 'Beheerder' : (role || 'Lid');
}

// "Drums", of bij een gekozen instrument dat instrument: het eerste wat je
// wilt weten (TT-520, Laag 3.1.b.1).
function eersteGekozen(lijst) {
  const gekozen = lijst.find(v => filterInstruments.includes(v) || filterGenres.includes(v));
  return gekozen || lijst[0] || '';
}
function afstandTekst(km) {
  return km != null ? `${km.toFixed(1)} km` : '';
}

/* TT-520 (Laag 3.1.b.1, akkoord Ronald 25-10-2026; vlak per treffer sessie 18):
   één regel per treffer, in een eigen vlak, zonder lijnen. Foto links (rond bij
   een muzikant, vierkant bij een band). Onder de naam één regel: instrument of
   genre · plaats · afstand. Rechts de berichtknop bij een muzikant, "Zoekt
   <instrument>" bij een band die iemand zoekt. De losse labels (instrumenten,
   genres, +1, Zoekend/Compleet) vervallen. */
function zoekRijHTML(opts) {
  const meta = [opts.eerste, opts.plaats, opts.afstand].filter(Boolean).map(escHtml).join(' · ');
  return `
    <div class="result-row" onclick="${opts.klik}">
      <div class="result-row-top">
        <div class="result-row-avatar${opts.vierkant ? ' result-vierkant' : ''}">${opts.foto}</div>
        <div class="result-row-main">
          <div class="result-row-name"><span class="result-row-naam">${escHtml(opts.naam)}</span>${opts.vierkant ? '<span class="result-row-soort">BAND</span>' : ''}</div>
          <div class="result-row-meta">${meta}</div>
        </div>
        ${opts.rechts || ''}
      </div>
    </div>`;
}

function musicianRowHTML(m) {
  // TT-38 / TT-43: de foto is voor iedereen zichtbaar (Ronald: die is te
  // belangrijk voor de presentatie om achter een login te zetten).
  const avatarSrc = safeUrl(m.avatar_url);
  const displayName = displayNameOf(m);
  return zoekRijHTML({
    klik: `openProfielScherm('${jsAttr(m.id)}')`,
    foto: avatarSrc ? `<img src="${avatarSrc}" alt="${escHtml(displayName)}">` : AVATAR_T_FALLBACK,
    naam: displayName,
    eerste: eersteGekozen((m.musician_instruments || []).map(x => x.instrument)),
    plaats: m.city || '',
    afstand: afstandTekst(m.distance_km),
    rechts: `<div class="result-row-msg-btn" data-bericht-id="${escHtml(m.id)}" onclick="openRowMessageIcon(event,'${jsAttr(m.id)}','${jsAttr(displayName)}')">${MESSAGE_ICON_SVG}</div>`
  });
}

// TT-30 (07-08-2026): kaartweergave als alternatief voor de rij hierboven —
// zelfde gegevens en dezelfde klik, alleen fotogericht. Kiesbaar via Weergave
// (Ronald: "bij veel profielfoto's is een kaart ook tof"). TT-520: de kaarten
// houden in deze bouwsessie hun huidige uiterlijk (akkoord Ronald, sessie 18).
function musicianCardHTML(m) {
  const instruments = m.musician_instruments.map(x => x.instrument);
  const genres = m.musician_genres.map(x => x.genre);

  const avatarSrc = safeUrl(m.avatar_url);
  const displayName = displayNameOf(m);
  const photoHTML = avatarSrc ? `<img src="${avatarSrc}" alt="${escHtml(displayName)}">` : AVATAR_T_FALLBACK;
  const nameHTML = escHtml(displayName);

  return `
    <div class="result-card" onclick="openProfielScherm('${jsAttr(m.id)}')">
      <div class="result-card-photo">${photoHTML}</div>
      <div class="result-card-top-row">
        <div class="result-card-name">${nameHTML}</div>
        <div class="result-row-msg-btn" data-bericht-id="${escHtml(m.id)}" onclick="openRowMessageIcon(event,'${jsAttr(m.id)}','${jsAttr(displayName)}')">${MESSAGE_ICON_SVG}</div>
      </div>
      <div class="result-card-meta">${escHtml(m.city || '')}${m.distance_km != null ? ` · ${m.distance_km.toFixed(1)} km` : ''}</div>
      <div class="result-card-badges-line">${overflowBadgeHTML(instruments, 2)}</div>
      <div class="result-card-badges-line">${overflowBadgeHTML(genres, 2)}</div>
    </div>`;
}

// ─── Bands in het resultaat ──────────────────────────────────────────────────

// TT-56 (12-08-2026), TT-457 (10-10-2026): of de muzikant zichzelf beschikbaar
// heeft gezet (kolom `accepts_band_invites`). Bijgehouden als eigen variabele
// (net als myMusicianId) zodat de tegel in Instellingen zijn stand kan tonen
// zonder steeds opnieuw te hoeven laden.
let myBeschikbaar = true;

// TT-385 fase 5 (besluit Ronald bij punt 11): de bandkaart in Zoeken. De
// vierkante bandfoto tegenover de ronde foto van een muzikant, geen foto's van
// de leden ("dat zie je als je het profiel opent"), de open rol als tag. Een
// invaller voor één optreden staat er ook als tag (punt 16). De statustag
// komt uit dezelfde functie als op de bandpagina en in Mijn Bands
// (bandStatusLabel()).
function bandKaartGegevens(b) {
  const open = (b.band_wanted || []).map(w => w.instrument);
  const vandaag = vandaagISO();
  const invallers = (b.band_invallers || []).filter(v => String(v.datum) >= vandaag).map(v => v.instrument);
  const leden = (b.band_members || []).filter(m => m.status === 'bevestigd').length;
  return {
    foto: safeUrl(b.avatar_url),
    status: bandStatusLabel(leden, open.length),
    rollen: open.map(i => '+ ' + i).concat(invallers.map(i => 'Invaller ' + instrumentInZin(i))),
    plaats: `${escHtml(b.city || '')}${b.distance_km != null ? ` · ${b.distance_km.toFixed(1)} km` : ''}`
  };
}

// "Drums" midden in een zin wordt "drums"; een afkorting als "DJ" blijft staan.
function instrumentInZin(naam) {
  const w = String(naam || '');
  return /^[A-Z]{2,}\b/.test(w) ? w : w.charAt(0).toLowerCase() + w.slice(1);
}

// TT-520: de rij van een band. Onder de naam het genre · plaats · afstand.
// Rechts "Zoekt <instrument>" als de band een open rol heeft: het gekozen
// instrument als de band dat zoekt, anders zijn eerste open rol. Zo ziet de
// zoeker waarom de band in het resultaat staat (Laag 3.1, besluit Ronald
// 25-10-2026). Geen berichtknop (zie MESSAGE_ICON_SVG).
function bandRowHTML(b) {
  const foto = safeUrl(b.avatar_url);
  const gezocht = (b.band_wanted || []).map(w => w.instrument);
  const zoekt = gezocht.length ? eersteGekozen(gezocht) : '';
  return zoekRijHTML({
    klik: `openBandScherm('${jsAttr(b.id)}')`,
    foto: foto ? `<img src="${foto}" alt="${escHtml(b.name)}">` : AVATAR_T_FALLBACK,
    vierkant: true,
    naam: b.name || '',
    eerste: eersteGekozen(b.genres || []),
    plaats: b.city || '',
    afstand: afstandTekst(b.distance_km),
    rechts: zoekt ? `<span class="result-row-zoekt">Zoekt ${escHtml(instrumentInZin(zoekt))}</span>` : ''
  });
}

// TT-30 (07-08-2026): kaartweergave, kiesbaar via Weergave. Geen berichtknop:
// een bericht aan een band gaat via de bandpagina naar de contactpersoon.
// Eén regel tags: de eerste open rol of invaller met "+N" voor de rest, of
// anders de status. Twee rollen passen niet op een kaart van 390px breed; de
// tweede werd afgesneden.
function bandCardHTML(b) {
  const k = bandKaartGegevens(b);
  const tags = k.rollen.length ? overflowBadgeHTML(k.rollen, 1) : (k.status ? tagSolid(k.status) : '');
  return `
    <div class="result-card" onclick="openBandScherm('${jsAttr(b.id)}')">
      <div class="result-card-photo result-vierkant">${k.foto ? `<img src="${k.foto}" alt="${escHtml(b.name)}">` : AVATAR_T_FALLBACK}</div>
      <div class="result-card-name">${escHtml(b.name)}</div>
      <div class="result-card-meta">${k.plaats}</div>
      ${tags ? `<div class="result-card-badges-line">${tags}</div>` : ''}
    </div>`;
}

// ─── Setlist-zoekfunctie ─────────────────────────────────────────────────────
// Herzien ontwerp (04-08-2026, Ronald): zelfde Artiest→Nummer-zoekvelden als
// bij de profiel-repertoirestap i.p.v. los vrij-tekstveld. De zoeker (band)
// bouwt zo een genummerde setlist op (#1, #2, ...); exacte titel+artiest-match
// tegen het repertoire van muzikanten. Hoe meer nummers matchen, hoe hoger de
// muzikant in het resultaat. Geen ingelogd/uitgelogd-verschil in mogelijkheden
// — alleen de databaseroute verschilt (publieke RPC vs. directe tabeltoegang).

let setlistWantedSongs = [];       // { title, artist }, volgorde = volgnummer
let selectedSetlistArtist = null;  // { id, name }
let setlistItunesSearchTimeout = null;
let filterSetlistInstruments = []; // TT-139: harde instrumentfilter, zelfde patroon als TT-55

// TT-239 (10-09-2026): Sorteren en Weergave, zoals bij Muzikanten en Bands.
// Eigen stand per tabblad, zelfde patroon als musicianViewMode/bandViewMode.
let lastSetlistResults   = [];
let setlistSearchSortMode = 'score';
let setlistViewMode = bewaardeWeergave('tt_setlistViewMode');

function setSetlistViewMode(mode) {
  setlistViewMode = mode;
  try { localStorage.setItem('tt_setlistViewMode', mode); } catch(e) {}
  const sel = document.getElementById('setlistViewToggle');
  if (sel) sel.value = mode;
  refreshChoiceField('setlist-weergave');
  if (lastSetlistResults.length) renderCappedSetlistResults();
}

// "Beste match" is hier het aantal nummers uit de setlist dat de muzikant
// speelt. Die telling maakt de app zelf, uit musician_songs — hij komt niet
// uit de database en werkt dus ook uitgelogd. Verouderde profielen zakken
// altijd naar onderen, in elke sorteerstand; zelfde regel als bij Muzikanten.
// Sinds 25-09-2026 bepaalt "laatst actief" wat verouderd is, niet meer
// "laatst bijgewerkt" — zie zetActiefStand().
function sortSetlistList(list) {
  list.sort((a, b) => {
    const groep = vergelijkActiefGroep(a, b);
    if (groep) return groep;
    if (setlistSearchSortMode === 'distance' && a.distance_km != null && b.distance_km != null) {
      return a.distance_km - b.distance_km;
    }
    if (setlistSearchSortMode === 'actief') return a.actiefRang - b.actiefRang;
    if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
    if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }
    const nameA = (displayNameOf(a) || '').toLowerCase();
    const nameB = (displayNameOf(b) || '').toLowerCase();
    return nameA.localeCompare(nameB, 'nl');
  });
  return list;
}

// Her-sorteert de al opgehaalde resultaten. Geen nieuwe zoekopdracht nodig.
function setSetlistSearchSortMode(mode) {
  if (mode === 'distance' && lastSetlistResults.length && !lastSetlistResults.some(m => m.distance_km != null)) {
    showToast('Vul een plaats in bij de zoekfilters om op afstand te sorteren.');
    const sel = document.getElementById('filterSetlistSortMode');
    if (sel) sel.value = setlistSearchSortMode;
    refreshChoiceField('setlist-sorteren');
    return;
  }
  setlistSearchSortMode = mode;
  const sel = document.getElementById('filterSetlistSortMode');
  if (sel) sel.value = mode;
  refreshChoiceField('setlist-sorteren');
  if (lastSetlistResults.length) {
    sortSetlistList(lastSetlistResults);
    renderCappedSetlistResults();
  }
}

function renderCappedSetlistResults() {
  const total = lastSetlistResults.length;
  renderSetlistResults(lastSetlistResults.slice(0, SEARCH_RESULT_LIMIT), { total, verruimd: setlistVerruimd });
}

// TT-139: instrumentpicker voor Setlist-zoeken, zelfde patroon als
// initSearchFilters()/initBandSearchFilters() — maximaal 1 instrument,
// Zang en Songwriting als losse uitzonderingen (singleMax + exceptionValues).
function initSetlistSearchFilters() {
  if (!PICKERS.filterSetlistInstruments) {
    initPicker({
      id: 'filterSetlistInstruments',
      fieldId: 'filterSetlistInstrumentsField', badgeRowId: 'filterSetlistInstrumentsBadgeRow',
      options: INSTRUMENTS, getList: () => filterSetlistInstruments,
      singleMax: true, exceptionValues: ['Zang', 'Songwriting'],
      placeholder: 'Kies een instrument',
      sheetTitle: 'Kies een instrument',
      onChange: () => { if (setlistWantedSongs.length) runSetlistSearch(); }
    });
  }

  // TT-239 (10-09-2026): hetzelfde straalwiel als bij Muzikanten en Bands.
  // Het verborgen invoerveld houdt zijn id, dus runSetlistSearch() leest het
  // ongewijzigd uit. De filterlogica is niet gewijzigd.
  if (!WHEEL_FIELDS['setlist-straal']) {
    initWheelField({
      id: 'setlist-straal',
      fieldId: 'filterSetlistRadiusField',
      title: 'Straal',
      unit: 'km',
      columns: [{ inputId: 'filterSetlistRadius', values: WHEEL_RADIUS, ariaLabel: 'Zoekstraal in kilometers' }],
      value: [STRAAL_STANDAARD],
      clearTo: [STRAAL_STANDAARD],
      isActief: (v) => Number(v[0]) !== STRAAL_STANDAARD,
      format: (v) => `${v[0]} km`,
      hint:   (v) => `Straal ${v[0]} km`,
      onChange: () => { if (setlistWantedSongs.length) runSetlistSearch(); }
    });
  }

  if (!CHOICE_FIELDS['setlist-sorteren']) {
    initChoiceField({ id: 'setlist-sorteren', fieldId: 'filterSetlistSortModeField',
                      menuId: 'filterSetlistSortModeMenu', selectId: 'filterSetlistSortMode' });
    initChoiceField({ id: 'setlist-weergave', fieldId: 'setlistViewToggleField',
                      menuId: 'setlistViewToggleMenu', selectId: 'setlistViewToggle' });
    syncViewToggles();
  }
}

// TT-239 (10-09-2026, Ronald): zelfde opmaak als "Je setlist" op Mijn Profiel
// — artiest vet boven, nummer eronder in de bijschriftkleur, met een kopregel
// erboven. Het volgnummer blijft staan: de matchbadge in het resultaat
// verwijst ernaar ("2/5 matches: #1, #3").
// Het kruisje blijft hier een kaal ✕, zonder "Zeker?"-stap. Huisstijl §8 gaat
// over het verwijderen van opgeslagen gegevens; dit is een zoekfilter dat je
// zelf net hebt toegevoegd.
function renderSetlistSongsList() {
  const list = document.getElementById('setlistSongsList');
  const row  = document.getElementById('setlistSongsRow');
  if (!setlistWantedSongs.length) {
    list.innerHTML = '';
    if (row) row.style.display = 'none';
    return;
  }
  if (row) row.style.display = '';
  list.innerHTML = zoekLijstHTML('#', 'Band / artiest — nummer', setlistWantedSongs.map((s, i) => ({
    voor: `#${i + 1}`, titel: s.artist, sub: s.title || 'Alle nummers',
    actie: `removeSetlistSong(${i})`, label: `Verwijder ${s.title || s.artist}`
  })));
}

// TT-289 (17-09-2026): één vorm voor een lijst die je zelf in een zoekfilter
// samenstelt — de setlist in "Zoek muzikanten" en de gekozen muzikanten in
// "Maak setlist". Zelfde kopregel, zelfde rij, zelfde ✕. Nooit een eigen
// variant per stand. `voorKop` leeg = geen voorkolom.
function zoekLijstHTML(voorKop, kop, rijen) {
  const voorKol = (t) => voorKop
    ? `<span class="zoek-lijst-voor">${escHtml(t)}</span>` : '';
  return `
    <div class="zoek-lijst">
      <div class="zoek-lijst-kop">${voorKol(voorKop)}<span class="zoek-lijst-hoofd">${escHtml(kop)}</span></div>
      ${rijen.map(r => `
        <div class="zoek-lijst-rij">
          ${voorKop ? `<span class="zoek-lijst-voor zoek-lijst-nr">${escHtml(r.voor)}</span>` : ''}
          <div class="zoek-lijst-hoofd">
            <div class="zoek-lijst-titel">${escHtml(r.titel)}</div>
            ${r.sub ? `<div class="zoek-lijst-sub">${escHtml(r.sub)}</div>` : ''}
          </div>
          <button type="button" class="song-remove" onclick="${r.actie}" title="Verwijderen" aria-label="${escHtml(r.label)}">✕</button>
        </div>`).join('')}
    </div>`;
}

function addSetlistSong(title, artist) {
  if (setlistWantedSongs.find(s => s.title === title && s.artist === artist)) return;
  // TT-430: een nummer maakt de selectie van zijn artiest af. De rij met alleen
  // die artiest ("Alle nummers") maakt plaats voor de rij met het nummer.
  const alleenArtiest = setlistWantedSongs.findIndex(s => !s.title && s.artist === artist);
  if (alleenArtiest !== -1) setlistWantedSongs.splice(alleenArtiest, 1);
  setlistWantedSongs.push({ title, artist });
  document.getElementById('setlistArtistSearch').value = '';
  document.getElementById('setlistTrackSearch').value = '';
  document.getElementById('setlistTrackSearchWrap').style.display = 'none';
  closeAC('acSetlistTrackList');
  closeAC('acSetlistArtistList');
  selectedSetlistArtist = null;
  renderSetlistSongsList();
  setTimeout(() => document.getElementById('setlistArtistSearch').focus(), 0);
  runSetlistSearch(); // TT-10: direct verversen, minstens 1 nummer is nu bekend
}

function removeSetlistSong(i) {
  setlistWantedSongs.splice(i, 1);
  renderSetlistSongsList();
  // TT-10: bij het laatste nummer weghalen is er niets meer om op te matchen —
  // resultaat netjes leegmaken i.p.v. het oude resultaat te laten staan.
  if (setlistWantedSongs.length) runSetlistSearch();
  else document.getElementById('setlistSearchResults').innerHTML = '';
}

// Stap A: artiest zoeken (zelfde iTunes-aanpak als profiel-repertoire, TT-139).
async function onSetlistArtistSearch(q) {
  const ac = document.getElementById('acSetlistArtistList');
  if (q.length < 2) { ac.classList.remove('open'); return; }

  ac.innerHTML = '<div class="ac-item"><span style="color:var(--muted)">Zoeken...</span></div>';
  ac.classList.add('open');

  const cacheKey = q.toLowerCase();
  if (itunesArtistCache.has(cacheKey)) {
    renderArtistResults(ac, itunesArtistCache.get(cacheKey), q, 'selectSetlistArtist');
    return;
  }

  clearTimeout(setlistItunesSearchTimeout);
  setlistItunesSearchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=7&country=NL`
      );
      const data = await res.json();
      const artists = (data.results || []).slice(0, 6);
      itunesArtistCache.set(cacheKey, artists);
      renderArtistResults(ac, artists, q, 'selectSetlistArtist');
    } catch(e) {
      logCaught('onSetlistArtistSearch', e);
      ac.innerHTML = '<div class="ac-item"><span style="color:var(--danger)">Zoeken lukt nu niet. Controleer je verbinding en typ opnieuw</span></div>';
    }
  }, 400);
}

function selectSetlistArtist(id, name) {
  selectedSetlistArtist = { id, name };
  document.getElementById('setlistArtistSearch').value = name;
  closeAC('acSetlistArtistList');
  const wrap = document.getElementById('setlistTrackSearchWrap');
  // Leeg, niet 'block': het blok is sinds TT-239 een .filter-row (display:grid).
  wrap.style.display = '';
  document.getElementById('setlistTrackSearchLabel').textContent = `Nummer van ${name} (kies je er een, dan zoekt hij daarop)`;
  document.getElementById('setlistTrackSearch').value = '';
  closeAC('acSetlistTrackList');
  // TT-430: een artiest alleen is al een zoekopdracht. Is er al een rij voor
  // deze artiest (met of zonder nummer), dan verandert er niets.
  if (!setlistWantedSongs.find(x => x.artist === name)) {
    setlistWantedSongs.push({ title: '', artist: name });
    renderSetlistSongsList();
    runSetlistSearch();
  }
}

// Stap B: nummer zoeken binnen geselecteerde artiest — lokaal filteren,
// zelfde cache (fetchArtistSongs) als bij het profiel-repertoire.
async function onSetlistTrackSearch(q) {
  const ac = document.getElementById('acSetlistTrackList');
  if (!selectedSetlistArtist) return;
  if (q.length < 1) { ac.classList.remove('open'); return; }

  ac.innerHTML = '<div class="ac-item"><span style="color:var(--muted)">Zoeken...</span></div>';
  ac.classList.add('open');

  try {
    const songs = await fetchArtistSongs(selectedSetlistArtist.id);
    renderTrackResults(ac, songs, q, selectedSetlistArtist, 'addSetlistSong', setlistWantedSongs);
  } catch(e) {
    logCaught('onSetlistTrackSearch', e);
    ac.innerHTML = '<div class="ac-item"><span style="color:var(--danger)">Zoeken lukt nu niet. Controleer je verbinding en typ opnieuw</span></div>';
  }
}

function resetSetlistSearch() {
  setlistWantedSongs = [];
  selectedSetlistArtist = null;
  document.getElementById('setlistArtistSearch').value = '';
  document.getElementById('setlistTrackSearch').value = '';
  document.getElementById('setlistTrackSearchWrap').style.display = 'none';
  document.getElementById('filterSetlistCity').value = '';
  document.getElementById('filterSetlistCityStatus').textContent = '';
  // TT-239: het straalwiel terug naar zijn beginstand. false = niet zelf
  // opnieuw zoeken; zonder nummers valt er hier toch niets te zoeken.
  setWheelFieldValues('setlist-straal', [STRAAL_STANDAARD], false);
  filterSetlistInstruments = [];
  if (PICKERS.filterSetlistInstruments) renderPickerBadges(PICKERS.filterSetlistInstruments);
  setlistSearchSortMode = 'score';
  const sortSel = document.getElementById('filterSetlistSortMode');
  if (sortSel) sortSel.value = 'score';
  refreshChoiceField('setlist-sorteren');
  lastSetlistResults = [];
  setlistVerruimd = null; // TT-62
  renderSetlistSongsList();
  document.getElementById('setlistSearchResults').innerHTML = '';
}

// TT-62: `straalOverride` werkt exact zoals bij runSearch(). Zie daar.
async function runSetlistSearch(straalOverride) {
  const seq = ++setlistSearchSeq; // TT-84: zie toelichting bij musicianSearchSeq
  const resultsEl = document.getElementById('setlistSearchResults');
  if (!setlistWantedSongs.length) { showToast('Kies minimaal één band of artiest.'); return; }
  if (straalOverride === undefined) setlistVerruimd = null; // nieuwe zoekopdracht

  if (!resultsEl.innerHTML.trim()) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div class="save-spinner" style="margin:0 auto 16px;"></div>Zoeken...
    </div>`;
  }

  try {
    const titles  = setlistWantedSongs.map(s => s.title);
    const artists = setlistWantedSongs.map(s => s.artist);
    const radius  = straalOverride !== undefined ? straalOverride : parseRadiusInput('filterSetlistRadius');

    // TT-62: zelfde twee hulpjes als in runSearch(). `straalActief` is hier
    // pas na de straal-aanroep bekend (radiusIds), dus die geven we mee.
    const ruimerZoeken = (straalActief) => {
      if (!straalActief) return undefined;
      const volgende = volgendeStraal(radius);
      if (volgende === undefined) return undefined;
      setlistVerruimd = { van: setlistVerruimd ? setlistVerruimd.van : radius, naar: volgende };
      return volgende;
    };
    const geenResultaat = (straalActief) => {
      lastSetlistResults = [];
      setlistVerruimd = (straalActief && straalOverride !== undefined && volgendeStraal(radius) === undefined)
        ? { van: setlistVerruimd ? setlistVerruimd.van : null, naar: radius, leeg: true }
        : null;
      renderSetlistResults([], { verruimd: setlistVerruimd });
    };

    // Repertoire-match en straal-match zijn onafhankelijk van elkaar —
    // tegelijk opvragen i.p.v. na elkaar (performance, 04-08-2026).
    const [songResult, radiusResult] = await Promise.all([
      db.rpc('tt_search_musicians_by_songlist_anon', { titles, artists }),
      (async () => {
        // Bugfix 05-08-2026 (gevonden door Ronald): het Plaats-veld werd
        // genegeerd zodra je een eigen profiel had — de straal werd dan
        // altijd vanaf je eigen postcode berekend, ook als je hier expliciet
        // een andere plaats had ingetypt (bijv. "Rotterdam" terwijl je eigen
        // profiel in Delft staat). Dat gaf verwarrende/onjuiste afstanden.
        // Nu: een ingevulde Plaats heeft altijd voorrang; eigen postcode is
        // alleen nog de fallback als het veld leeg is.
        const cityVal = document.getElementById('filterSetlistCity').value.trim();
        if (cityVal) {
          const origin = await resolveSearchOrigin(cityVal);
          if (origin.lat == null) return { data: null, error: null };
          return db.rpc('tt_search_musicians_anon', {
            origin_lat: origin.lat, origin_lng: origin.lng, radius_km: radius
          });
        }
        if (hasOwnProfile) {
          const mid = await getMyMusicianId();
          // TT-159 (27-08-2026, bugfix/aanname): deze aanroep miste
          // origin_lat/origin_lng — dezelfde tt_search_musicians-functie
          // krijgt die in runSearch() wél altijd mee (zie hierboven). Zonder
          // een expliciet getypte Plaats hier (cityVal leeg, anders was deze
          // tak niet bereikt) is er geen ander vertrekpunt dan de eigen
          // postcode van de zoeker — vandaar null/null, exact zoals
          // runSearch() dat doet via `usesOwnCity`.
          return db.rpc('tt_search_musicians', {
            searcher_id: mid, radius_km: radius,
            origin_lat: null, origin_lng: null
          });
        }
        return { data: null, error: null };
      })(),
    ]);

    if (songResult.error) throw songResult.error;
    if (seq !== setlistSearchSeq) return; // TT-84
    const songMatches = songResult.data || [];
    if (!songMatches.length) { lastSetlistResults = []; renderSetlistResults([]); return; }
    const songMatchIds = new Set(songMatches.map(m => m.musician_id));

    // Straal toepassen om het zoekgebied te beperken: ingevulde Plaats heeft
    // voorrang (zie hierboven), anders eigen postcode (ingelogd) of geen
    // straalbeperking (uitgelogd zonder Plaats ingevuld).
    let distanceMap = {};
    let radiusIds = null; // null = geen straalbeperking (geen vertrekpunt bekend)

    if (radiusResult.error) throw radiusResult.error;
    if (radiusResult.data) {
      radiusIds = new Set(radiusResult.data.map(m => m.musician_id));
      radiusResult.data.forEach(m => { distanceMap[m.musician_id] = m.distance_km; });
    }

    let ids = Array.from(songMatchIds);
    if (radiusIds) ids = ids.filter(id => radiusIds.has(id));
    // TT-62: er zijn wél muzikanten met deze nummers, alleen niet binnen de
    // straal. Dan verruimen in plaats van een leeg scherm tonen. Is er geen
    // vertrekpunt (radiusIds leeg), dan is de straal niet het probleem.
    if (!ids.length) {
      const v = ruimerZoeken(!!radiusIds);
      if (v !== undefined) return runSetlistSearch(v);
      geenResultaat(!!radiusIds); return;
    }

    let musicians;
    if (hasOwnProfile) {
      const { data, error } = await db.from('musicians').select(`
        id, weergavenaam, username, city, zip, avatar_url,
        musician_songs(song_title, song_artist, mastery_level),
        musician_instruments(instrument, niveau)
      `).in('id', ids);
      if (error) throw error;
      musicians = data;
    } else {
      const { data, error } = await db.rpc('tt_get_musicians_public', { ids });
      if (error) throw error;
      musicians = (data || []).map(m => ({
        id: m.id, username: m.username, city: m.city, // TT-04: geen postcode voor bezoekers
        avatar_url: m.avatar_url,
        musician_songs: m.songs || [],
        musician_instruments: (m.instrument_levels || []).map(x => ({ instrument: x.instrument, niveau: x.niveau })),
      }));
      await weergavenamenToevoegen(musicians);
    }

    // TT-139: harde instrumentfilter, zelfde regel als bij Muzikanten/Bands
    // (TT-55) — maximaal 1 instrument + optioneel Zang, vóór de repertoire-
    // matching toepassen.
    if (filterSetlistInstruments.length) {
      musicians = musicians.filter(m => {
        const mInstr = (m.musician_instruments || []).map(x => x.instrument);
        return filterSetlistInstruments.some(i => mInstr.includes(i));
      });
    }

    // Per muzikant bepalen welke volgnummers uit de gezochte setlist matchen
    // (exacte titel+artiest, case-insensitive) en hoeveel er in totaal matchen.
    musicians.forEach(m => {
      const own = (m.musician_songs || []).map(s => `${(s.song_title||'').toLowerCase()}|||${(s.song_artist||'').toLowerCase()}`);
      const eigenArtiesten = (m.musician_songs || []).map(x => (x.song_artist || '').toLowerCase());
      m.matchedNumbers = setlistWantedSongs
        .map((s, i) => (s.title
            ? own.includes(`${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`)
            : eigenArtiesten.includes(s.artist.toLowerCase())) ? i + 1 : null)
        .filter(n => n !== null);
      m.matchCount = m.matchedNumbers.length;
      m.distance_km = distanceMap[m.id] != null ? distanceMap[m.id] : null;
      musicianDistanceCache[m.id] = m.distance_km;
    });

    // Hoe meer nummers matchen, hoe hoger in het resultaat; bij gelijke stand
    // dichtstbijzijnde eerst (indien bekend).
    // TT-239: de vaste sortering staat nu in sortSetlistList(), zodat de
    // keuzelijst "Sorteren op" dezelfde lijst kan herschikken zonder opnieuw
    // te zoeken. "Beste match" geeft exact de volgorde van hiervoor.
    // TT-06: zelfde regel als bij Muzikanten, vóór de TT-62-controle.
    // TT-442: je eigen profiel staat er niet bij. De eigen id moet dan bekend zijn,
    // ook als de straal vanuit een getypte Plaats werd bepaald.
    if (hasOwnProfile) await getMyMusicianId();
    const filtered = musicians.filter(m => m.matchCount > 0 && !isGeblokkeerd(m.id) && !isEigenProfiel(m.id));

    if (seq !== setlistSearchSeq) return; // TT-84: nieuwere zoekopdracht loopt al
    // TT-62: zelfde regel als bij Muzikanten en Bands.
    if (!filtered.length) {
      const v = ruimerZoeken(!!radiusIds);
      if (v !== undefined) return runSetlistSearch(v);
      geenResultaat(!!radiusIds); return;
    }
    await zetActiefStand('muzikant', filtered);
    if (seq !== setlistSearchSeq) return; // TT-84
    lastSetlistResults = sortSetlistList(filtered);
    renderCappedSetlistResults();

  } catch(e) {
    logCaught('runSetlistSearch', e);
    if (seq !== setlistSearchSeq) return; // TT-84: fout van een verouderde zoekopdracht niet tonen
    resultsEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">${friendlyErrorMessage(e, 'zoeken')}</div>`;
  }
}

function renderSetlistResults(musicians, opts) {
  opts = opts || {};
  const el = document.getElementById('setlistSearchResults');
  const total = opts.total != null ? opts.total : musicians.length;

  if (!total) {
    // TT-62: is er al tot heel Nederland verruimd, dan is het zoekgebied niet
    // meer de beperking — dan heeft simpelweg niemand deze nummers.
    const uitleg = opts.verruimd && opts.verruimd.leeg
      ? 'Niemand in de Tent heeft een match met deze setlist, ook niet buiten je zoekgebied.'
      : 'Niemand in de Tent (binnen je zoekgebied) heeft (nog) een match met deze setlist.';
    el.innerHTML = `
      <div class="no-results">
        <p style="font-size:16px;font-weight:600;margin-bottom:8px;">Geen muzikanten gevonden</p>
        <p style="font-size:13px;">${uitleg}</p>
      </div>`;
    return;
  }
  const verruimd = verruimdNotice(opts.verruimd, 'muzikanten');
  const cappedNotice = total > musicians.length
    ? `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Toont de eerste ${musicians.length} van ${total} resultaten — voeg meer nummers toe of verklein je zoekstraal voor een preciezer overzicht.</p>`
    : '';
  el.innerHTML = `
    <div class="results-header">
      <span class="results-count">${total} muzikant${total !== 1 ? 'en' : ''} gevonden</span>
    </div>
    ${verruimd}${cappedNotice}
    <div class="${setlistViewMode === 'grid' ? 'results-grid-view' : 'results-list'}">
      ${musicians.map(m => setlistViewMode === 'grid' ? musicianSetlistCardHTML(m) : musicianSetlistRowHTML(m)).join('')}
    </div>`;
}

// TT-239 (10-09-2026, keuze Ronald): de kaartweergave toont dezelfde kop als
// bij Muzikanten (foto, naam, plaats, afstand), maar op de badge-regel staat
// de match in plaats van instrumenten en genres. Genres worden bij deze
// zoekopdracht niet opgehaald; de match is hier het antwoord op de vraag.
function musicianSetlistCardHTML(m) {
  const avatarSrc = safeUrl(m.avatar_url);
  const displayName = displayNameOf(m);
  const photoHTML = avatarSrc ? `<img src="${avatarSrc}" alt="${escHtml(displayName)}">` : AVATAR_T_FALLBACK;

  return `
    <div class="result-card" onclick="openProfielScherm('${jsAttr(m.id)}')">
      <div class="result-card-photo">${photoHTML}</div>
      <div class="result-card-top-row">
        <div class="result-card-name">${escHtml(displayName)}</div>
        <div class="result-row-msg-btn" data-bericht-id="${escHtml(m.id)}" onclick="openRowMessageIcon(event,'${jsAttr(m.id)}','${jsAttr(displayName)}')">${MESSAGE_ICON_SVG}</div>
      </div>
      <div class="result-card-meta">${escHtml(m.city || '')}${m.distance_km != null ? ` · ${m.distance_km.toFixed(1)} km` : ''}</div>
      <div class="result-card-badges-line">${setlistMatchBadge(m)}</div>
    </div>`;
}

// Eén bron voor de matchbadge, gedeeld door de rij- en de kaartweergave.
function setlistMatchBadge(m) {
  const total = setlistWantedSongs.length;
  return tagSolid(
    `${m.matchCount}/${total} match${m.matchCount !== 1 ? 'es' : ''}: ${m.matchedNumbers.map(n => '#' + Number(n)).join(', ')}`
  );
}

// Compact gehouden: volledige nummertitels zijn te veel info voor één regel
// (Ronald) — toont i.p.v. daarvan het aantal treffers + de volgnummers.
function musicianSetlistRowHTML(m) {
  const avatarSrc = safeUrl(m.avatar_url);
  const displayName = displayNameOf(m);
  const avatarHTML = avatarSrc ? `<img src="${avatarSrc}" alt="${escHtml(displayName)}">` : AVATAR_T_FALLBACK;
  const nameHTML = escHtml(displayName);

  return `
    <div class="result-row" onclick="openProfielScherm('${jsAttr(m.id)}')">
      <div class="result-row-top">
        <div class="result-row-avatar">${avatarHTML}</div>
        <div class="result-row-main">
          <div class="result-row-name">${nameHTML}</div>
          <div class="result-row-meta">${escHtml(m.city || '')}${m.distance_km != null ? ` · ${m.distance_km.toFixed(1)} km` : ''}</div>
        </div>
        <div class="result-row-msg-btn" data-bericht-id="${escHtml(m.id)}" onclick="openRowMessageIcon(event,'${jsAttr(m.id)}','${jsAttr(displayName)}')">${MESSAGE_ICON_SVG}</div>
      </div>
      <div class="result-row-badges">
        ${setlistMatchBadge(m)}
      </div>
    </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// TT-289 — Maak setlist (tot 29-09-2026 "Zoek setlist"): van muzikanten naar de nummers die ze delen
// ═══════════════════════════════════════════════════════════════════════════
// Besluiten Ronald, 17-09-2026:
// - Het Setlist-tabblad heeft twee standen: "Zoek muzikanten" (bestaand) en
//   "Maak setlist" (deze). Vegen blijft tussen de hoofdtabbladen.
// - Je kiest 2 tot 20 muzikanten, alleen muzikanten, geen bands. Wie zoekt,
//   staat er sinds 08-10-2026 als eerste vanzelf in (bevinding Ronald: "meestal
//   wil je jezelf ook in de lijst hebben"); met het ✕ haal je jezelf weg.
// - Plaats en Straal beperken alleen de naamsuggesties ("honderd keer Colin").
//   Wie gekozen is, blijft staan. Geen verruiming (huisstijl §17.1).
// - Een nummer telt als het in iemands repertoire staat, ongeacht niveau.
//   Alleen nummers die minstens 2 gekozen muzikanten spelen.
// - Eén weergave, de lijst. Een tik klapt een regel open en toont per
//   muzikant of hij het speelt, met het niveau rechts naast de naam.
// - De knop "Maak setlist" (tot 29-09-2026 "Zoek nummers") blijft, al ververst de lijst ook vanzelf.

const GEDEELD_MIN = 2;
const GEDEELD_MAX = 20;
const GEDEELD_SUGGESTIES = 8;

let setlistSoort = 'muzikanten';   // 'muzikanten' | 'nummers'
let gedeeldGekozen = [];           // { id, naam, city, distance_km }, volgorde van kiezen
let gedeeldSortMode = 'spelers';
let gedeeldResultaat = [];         // { sleutel, titel, artiest, spelers: {id: niveau} }
let gedeeldOpen = new Set();       // sleutels van opengeklapte regels
let gedeeldSearchSeq = 0;
let gedeeldNaamSeq = 0;
let gedeeldNaamTimeout = null;
let gedeeldKandidaten = null;      // { sleutel, lijst } — cache per vertrekpunt en straal
let gedeeldEigenId = null;         // wie er vanzelf is toegevoegd; haal je jezelf weg, dan komt hij niet terug

function setSetlistSoort(soort) {
  setlistSoort = soort === 'nummers' ? 'nummers' : 'muzikanten';
  const nummers = setlistSoort === 'nummers';
  document.getElementById('setlistDeelMuzikanten').style.display = nummers ? 'none' : '';
  document.getElementById('setlistDeelNummers').style.display = nummers ? '' : 'none';
  const knoppen = { muzikanten: 'setlistSoortMuzikantenBtn', nummers: 'setlistSoortNummersBtn' };
  Object.entries(knoppen).forEach(([k, id]) => {
    const b = document.getElementById(id);
    b.classList.toggle('active', k === setlistSoort);
    b.setAttribute('aria-selected', k === setlistSoort ? 'true' : 'false');
  });
  // Het straalwiel wordt pas bijgesteld als het zichtbaar is (huisstijl §7.1).
  if (nummers) initGedeeldSearchFilters();
  setlistZoekVerversen();
}

// Eén plek die bepaalt wat het Setlist-tabblad bij tonen opnieuw zoekt.
function setlistZoekVerversen() {
  if (setlistSoort === 'nummers') {
    gedeeldEigenToevoegen().then(veranderd => {
      if (!veranderd && gedeeldGekozen.length >= GEDEELD_MIN) runGedeeldSearch();
    });
  } else if (setlistWantedSongs.length) {
    runSetlistSearch();
  }
}

function initGedeeldSearchFilters() {
  if (!WHEEL_FIELDS['gedeeld-straal']) {
    initWheelField({
      id: 'gedeeld-straal',
      fieldId: 'filterGedeeldRadiusField',
      title: 'Straal',
      unit: 'km',
      columns: [{ inputId: 'filterGedeeldRadius', values: WHEEL_RADIUS, ariaLabel: 'Zoekstraal in kilometers' }],
      value: [STRAAL_STANDAARD],
      clearTo: [STRAAL_STANDAARD],
      isActief: (v) => Number(v[0]) !== STRAAL_STANDAARD,
      format: (v) => `${v[0]} km`,
      hint:   (v) => `Straal ${v[0]} km`,
      onChange: () => gedeeldKandidatenVergeten()
    });
  }
  if (!CHOICE_FIELDS['gedeeld-sorteren']) {
    initChoiceField({ id: 'gedeeld-sorteren', fieldId: 'gedeeldSortModeField',
                      menuId: 'gedeeldSortModeMenu', selectId: 'gedeeldSortMode' });
  }
}

// Plaats of straal gewijzigd: de suggesties gelden niet meer. De gekozen
// muzikanten blijven staan.
function gedeeldKandidatenVergeten() {
  gedeeldKandidaten = null;
  const q = document.getElementById('gedeeldNaam');
  if (q && q.value.trim()) onGedeeldNaamInput(q.value);
}

function onGedeeldNaamInput(ruw) {
  clearTimeout(gedeeldNaamTimeout);
  const ac = document.getElementById('acGedeeldNaamList');
  const term = naamZoekTerm(ruw);
  if (!term || term.tekst.length < 2) { ac.classList.remove('open'); return; }
  gedeeldNaamTimeout = setTimeout(() => gedeeldSuggesties(term), 300);
}

async function gedeeldSuggesties(term) {
  const seq = ++gedeeldNaamSeq;
  const ac = document.getElementById('acGedeeldNaamList');
  if (gedeeldGekozen.length >= GEDEELD_MAX) {
    ac.innerHTML = `<div class="ac-item"><span>Je hebt al ${GEDEELD_MAX} muzikanten gekozen.</span></div>`;
    ac.classList.add('open');
    return;
  }
  if (!gedeeldKandidaten) {
    ac.innerHTML = '<div class="ac-item"><span>Zoeken...</span></div>';
    ac.classList.add('open');
  }
  try {
    const lijst = await gedeeldKandidatenLaden();
    if (seq !== gedeeldNaamSeq) return; // TT-84: er is intussen verder getypt
    const gekozenIds = new Set(gedeeldGekozen.map(g => g.id));
    const treffers = lijst
      // TT-06: een geblokkeerde muzikant is ook hier niet te vinden.
      .filter(m => !gekozenIds.has(m.id) && !isGeblokkeerd(m.id) && naamMatcht(term, displayNameOf(m)))
      .sort((a, b) => {
        if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
          return a.distance_km - b.distance_km;
        }
        if ((a.distance_km == null) !== (b.distance_km == null)) return a.distance_km == null ? 1 : -1;
        return displayNameOf(a).localeCompare(displayNameOf(b), 'nl');
      })
      .slice(0, GEDEELD_SUGGESTIES);
    if (!treffers.length) {
      const binnen = gedeeldKandidaten && gedeeldKandidaten.straalActief
        ? ` binnen ${straalTekst(parseRadiusInput('filterGedeeldRadius'))}` : '';
      ac.innerHTML = `<div class="ac-item"><span>Niemand met deze naam${binnen}.</span></div>`;
      ac.classList.add('open');
      return;
    }
    ac.innerHTML = treffers.map(m => `
      <div class="ac-item" onmousedown="addGedeeldMuzikant('${jsAttr(m.id)}')">
        <strong>${highlight(displayNameOf(m), term.tekst)}</strong>
        <span>${escHtml(gedeeldMeta(m))}</span>
      </div>`).join('');
    ac.classList.add('open');
  } catch (e) {
    logCaught('gedeeldSuggesties', e);
    if (seq !== gedeeldNaamSeq) return;
    ac.innerHTML = '<div class="ac-item"><span>Zoeken lukt nu niet. Controleer je verbinding en typ opnieuw</span></div>';
    ac.classList.add('open');
  }
}

// "Delft · 8 km". Uitgelogd of zonder vertrekpunt: alleen de plaats.
function gedeeldMeta(m) {
  const delen = [];
  if (m.city) delen.push(m.city);
  if (m.distance_km != null) delen.push(`${Math.round(m.distance_km)} km`);
  return delen.join(' · ');
}

// Alle muzikanten binnen de straal, met naam, plaats en afstand. Zelfde
// vertrekpunt-regels als runSetlistSearch(): een ingevulde Plaats heeft
// voorrang, anders de eigen postcode (ingelogd), anders geen straal.
async function gedeeldKandidatenLaden() {
  const cityVal = document.getElementById('filterGedeeldCity').value.trim();
  const radius = parseRadiusInput('filterGedeeldRadius');
  const sleutel = `${hasOwnProfile ? 1 : 0}|${cityVal.toLowerCase()}|${radius}`;
  if (gedeeldKandidaten && gedeeldKandidaten.sleutel === sleutel) return gedeeldKandidaten.lijst;

  let rijen = null;
  let straalActief = true;
  if (cityVal) {
    const origin = await resolveSearchOrigin(cityVal);
    if (origin.lat != null) {
      const { data, error } = await db.rpc('tt_search_musicians_anon', {
        origin_lat: origin.lat, origin_lng: origin.lng, radius_km: radius
      });
      if (error) throw error;
      rijen = data || [];
    }
  }
  if (rijen === null && hasOwnProfile) {
    const mid = await getMyMusicianId();
    const { data, error } = await db.rpc('tt_search_musicians', {
      searcher_id: mid, radius_km: radius, origin_lat: null, origin_lng: null
    });
    if (error) throw error;
    rijen = data || [];
  }
  if (rijen === null) {
    // Uitgelogd zonder herkende plaats: geen straal, iedereen komt in aanmerking.
    straalActief = false;
    const { data, error } = await db.rpc('tt_search_musicians_anon', {
      origin_lat: null, origin_lng: null, radius_km: null
    });
    if (error) throw error;
    rijen = data || [];
  }

  const afstand = {};
  rijen.forEach(r => { afstand[r.musician_id] = r.distance_km; });
  const ids = rijen.map(r => r.musician_id);
  // Wie zoekt, staat ook in de kandidaten: haalt hij zichzelf weg, dan kiest hij zichzelf hier terug.
  if (hasOwnProfile) {
    const mid = await getMyMusicianId();
    if (mid && !ids.includes(mid)) ids.push(mid);
  }
  const lijst = ids.length ? await gedeeldMuzikantenLaden(ids, false) : [];
  lijst.forEach(m => { m.distance_km = afstand[m.id] != null ? afstand[m.id] : null; });
  gedeeldKandidaten = { sleutel, lijst, straalActief };
  return lijst;
}

// Naam en plaats, en desgewenst het repertoire. Uitgelogd via de publieke
// functie; de gekozen naam komt er apart bij (TT-420).
async function gedeeldMuzikantenLaden(ids, metNummers) {
  if (hasOwnProfile) {
    const velden = metNummers
      ? 'id, weergavenaam, username, city, musician_songs(song_title, song_artist, mastery_level)'
      : 'id, weergavenaam, username, city';
    const { data, error } = await db.from('musicians').select(velden).in('id', ids);
    if (error) throw error;
    return (data || []).map(m => ({ ...m, musician_songs: m.musician_songs || [] }));
  }
  const { data, error } = await db.rpc('tt_get_musicians_public', { ids });
  if (error) throw error;
  const rijen = (data || []).map(m => ({
    id: m.id, username: m.username, city: m.city, musician_songs: m.songs || []
  }));
  await weergavenamenToevoegen(rijen);
  return rijen;
}

function addGedeeldMuzikant(id) {
  const ac = document.getElementById('acGedeeldNaamList');
  closeAC('acGedeeldNaamList');
  if (gedeeldGekozen.some(g => g.id === id)) return;
  if (gedeeldGekozen.length >= GEDEELD_MAX) {
    showToast(`Je kunt maximaal ${GEDEELD_MAX} muzikanten kiezen.`);
    return;
  }
  const m = (gedeeldKandidaten ? gedeeldKandidaten.lijst : []).find(x => x.id === id);
  if (!m) return;
  gedeeldGekozen.push({ id: m.id, naam: displayNameOf(m), city: m.city || '', distance_km: m.distance_km });
  const veld = document.getElementById('gedeeldNaam');
  veld.value = '';
  if (ac) ac.innerHTML = '';
  renderGedeeldGekozen();
  setTimeout(() => veld.focus(), 0);
  if (gedeeldGekozen.length >= GEDEELD_MIN) runGedeeldSearch();
}

// Wie een profiel heeft, staat als eerste in de lijst (08-10-2026). Eén keer per
// account: haal je jezelf weg, dan blijft dat zo. Een ander account (of uitloggen)
// haalt de vorige eigenaar weer weg. Geeft waar als de lijst veranderde en de
// resultaten zijn bijgewerkt.
async function gedeeldEigenToevoegen() {
  try {
    const mid = hasOwnProfile ? await getMyMusicianId() : null;
    if (mid === gedeeldEigenId) return false;
    if (gedeeldEigenId) {
      const i = gedeeldGekozen.findIndex(g => g.id === gedeeldEigenId);
      if (i !== -1) gedeeldGekozen.splice(i, 1);
    }
    gedeeldEigenId = mid;
    if (mid && !gedeeldGekozen.some(g => g.id === mid)) {
      const { data, error } = await db.from('musicians').select('id, weergavenaam, username, city').eq('id', mid).maybeSingle();
      if (error) throw error;
      if (data && gedeeldGekozen.length < GEDEELD_MAX) {
        gedeeldGekozen.unshift({ id: data.id, naam: displayNameOf(data), city: data.city || '', distance_km: null });
      }
    }
    renderGedeeldGekozen();
    if (gedeeldGekozen.length >= GEDEELD_MIN) runGedeeldSearch();
    else { gedeeldResultaat = []; gedeeldOpen.clear(); renderGedeeldResults(); }
    return true;
  } catch (e) {
    logCaught('gedeeldEigenToevoegen', e);
    return false;
  }
}

function removeGedeeldMuzikant(i) {
  const weg = gedeeldGekozen.splice(i, 1)[0];
  renderGedeeldGekozen();
  if (weg) gedeeldResultaat.forEach(n => { delete n.spelers[weg.id]; });
  if (gedeeldGekozen.length >= GEDEELD_MIN) runGedeeldSearch();
  else { gedeeldResultaat = []; gedeeldOpen.clear(); renderGedeeldResults(); }
}

function renderGedeeldGekozen() {
  const row = document.getElementById('gedeeldGekozenRow');
  const list = document.getElementById('gedeeldGekozenList');
  const teller = document.getElementById('gedeeldTeller');
  if (!gedeeldGekozen.length) {
    list.innerHTML = '';
    teller.textContent = '';
    row.style.display = 'none';
    return;
  }
  row.style.display = '';
  list.innerHTML = zoekLijstHTML('', 'Gekozen muzikanten', gedeeldGekozen.map((g, i) => ({
    titel: g.naam, sub: gedeeldMeta(g),
    actie: `removeGedeeldMuzikant(${i})`, label: `Verwijder ${g.naam}`
  })));
  const nogNodig = GEDEELD_MIN - gedeeldGekozen.length;
  teller.textContent = nogNodig > 0
    ? `${gedeeldGekozen.length} van ${GEDEELD_MAX} · kies er nog ${nogNodig}`
    : `${gedeeldGekozen.length} van ${GEDEELD_MAX}`;
}

function resetGedeeldSearch() {
  gedeeldGekozen = [];
  gedeeldEigenId = null;
  gedeeldResultaat = [];
  gedeeldOpen.clear();
  gedeeldKandidaten = null;
  document.getElementById('gedeeldNaam').value = '';
  closeAC('acGedeeldNaamList');
  document.getElementById('filterGedeeldCity').value = '';
  document.getElementById('filterGedeeldCityStatus').textContent = '';
  setWheelFieldValues('gedeeld-straal', [STRAAL_STANDAARD], false);
  gedeeldSortMode = 'spelers';
  const sel = document.getElementById('gedeeldSortMode');
  if (sel) sel.value = 'spelers';
  refreshChoiceField('gedeeld-sorteren');
  renderGedeeldGekozen();
  renderGedeeldResults();
  gedeeldEigenToevoegen(); // Lijst wissen: terug naar alleen jezelf
}

function setGedeeldSortMode(mode) {
  gedeeldSortMode = ['spelers', 'artiest', 'az'].includes(mode) ? mode : 'spelers';
  const sel = document.getElementById('gedeeldSortMode');
  if (sel) sel.value = gedeeldSortMode;
  refreshChoiceField('gedeeld-sorteren');
  sortGedeeldList(gedeeldResultaat);
  renderGedeeldResults();
}

async function runGedeeldSearch() {
  const seq = ++gedeeldSearchSeq;
  const el = document.getElementById('gedeeldResults');
  if (gedeeldGekozen.length < GEDEELD_MIN) {
    showToast(`Kies minstens ${GEDEELD_MIN} muzikanten.`);
    return;
  }
  if (!el.innerHTML.trim()) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div class="save-spinner" style="margin:0 auto 16px;"></div>Zoeken...
    </div>`;
  }
  try {
    const muzikanten = await gedeeldMuzikantenLaden(gedeeldGekozen.map(g => g.id), true);
    if (seq !== gedeeldSearchSeq) return; // TT-84
    const nummers = new Map();
    muzikanten.forEach(m => {
      (m.musician_songs || []).forEach(s => {
        const titel = (s.song_title || '').trim();
        const artiest = (s.song_artist || '').trim();
        if (!titel) return;
        // Zelfde vergelijking als runSetlistSearch(): titel en artiest exact,
        // hoofdletters maken niet uit.
        const sleutel = `${titel.toLowerCase()}|||${artiest.toLowerCase()}`;
        if (!nummers.has(sleutel)) nummers.set(sleutel, { sleutel, titel, artiest, spelers: {} });
        nummers.get(sleutel).spelers[m.id] = LEVEL_LABELS[s.mastery_level] ? s.mastery_level : '';
      });
    });
    gedeeldResultaat = sortGedeeldList(
      [...nummers.values()].filter(n => Object.keys(n.spelers).length >= GEDEELD_MIN)
    );
    const nog = new Set(gedeeldResultaat.map(n => n.sleutel));
    gedeeldOpen = new Set([...gedeeldOpen].filter(k => nog.has(k)));
    renderGedeeldResults();
  } catch (e) {
    logCaught('runGedeeldSearch', e);
    if (seq !== gedeeldSearchSeq) return;
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">${friendlyErrorMessage(e, 'zoeken')}</div>`;
  }
}

function gedeeldAantal(n) { return Object.keys(n.spelers).length; }

// Meeste spelers: aantal, dan artiest, dan titel.
// Artiest, meeste spelers: artiesten op hun best gedeelde nummer, daarbinnen
//   het aantal. Zo staan de nummers van één artiest bij elkaar.
// Artiest A–Z: artiest, dan titel.
function sortGedeeldList(lijst) {
  const vgl = (a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' });
  const opTitel = (a, b) => vgl(a.artiest, b.artiest) || vgl(a.titel, b.titel);
  if (gedeeldSortMode === 'az') return lijst.sort(opTitel);
  if (gedeeldSortMode === 'artiest') {
    const best = {};
    lijst.forEach(n => {
      const k = n.artiest.toLowerCase();
      best[k] = Math.max(best[k] || 0, gedeeldAantal(n));
    });
    return lijst.sort((a, b) =>
      (best[b.artiest.toLowerCase()] - best[a.artiest.toLowerCase()])
      || vgl(a.artiest, b.artiest)
      || (gedeeldAantal(b) - gedeeldAantal(a))
      || vgl(a.titel, b.titel));
  }
  return lijst.sort((a, b) => (gedeeldAantal(b) - gedeeldAantal(a)) || opTitel(a, b));
}

function renderGedeeldResults() {
  const el = document.getElementById('gedeeldResults');
  if (!el) return;
  if (gedeeldGekozen.length < GEDEELD_MIN) { el.innerHTML = ''; return; }
  const totaal = gedeeldResultaat.length;
  if (!totaal) {
    el.innerHTML = `
      <div class="no-results">
        <p style="font-size:16px;font-weight:600;margin-bottom:8px;">Geen gedeelde nummers</p>
        <p style="font-size:13px;">Geen van deze nummers staat bij minstens 2 van deze muzikanten in het repertoire.</p>
      </div>`;
    return;
  }
  const getoond = gedeeldResultaat.slice(0, SEARCH_RESULT_LIMIT);
  const cappedNotice = totaal > getoond.length
    ? `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Toont de eerste ${getoond.length} van ${totaal} nummers.</p>`
    : '';
  el.innerHTML = `
    <div class="results-header">
      <span class="results-count">${totaal} ${totaal === 1 ? 'nummer' : 'nummers'} die minstens 2 van hen spelen</span>
    </div>
    ${cappedNotice}
    <div class="results-list">
      ${getoond.map((n, i) => gedeeldRijHTML(n, i)).join('')}
    </div>`;
}

function gedeeldRijHTML(n, i) {
  const open = gedeeldOpen.has(n.sleutel);
  const paneelId = `gedeeldPaneel${i}`;
  const spelers = gedeeldGekozen.map(g => {
    const speelt = Object.prototype.hasOwnProperty.call(n.spelers, g.id);
    const lvl = speelt ? n.spelers[g.id] : '';
    return `
      <div class="gedeeld-speler${speelt ? '' : ' niet'}">
        <button type="button" class="gedeeld-speler-naam" onclick="openProfielScherm('${jsAttr(g.id)}')">${escHtml(g.naam)}</button>
        ${speelt
          ? (lvl ? `<span class="level-pill">${escHtml(LEVEL_LABELS[lvl])}</span>` : '')
          : '<span class="gedeeld-speler-niet">Speelt dit niet</span>'}
      </div>`;
  }).join('');
  return `
    <div class="gedeeld-rij${open ? ' open' : ''}">
      <button type="button" class="gedeeld-rij-kop" aria-expanded="${open}" aria-controls="${paneelId}"
        onclick="toggleGedeeldRij('${jsAttr(n.sleutel)}')">
        <span class="gedeeld-rij-tekst">
          <span class="gedeeld-rij-titel">${escHtml(n.titel)}</span>
          <span class="gedeeld-rij-artiest">${escHtml(n.artiest)}</span>
        </span>
        <span class="gedeeld-rij-telling">${gedeeldAantal(n)} van ${gedeeldGekozen.length}</span>
      </button>
      ${open ? `<div class="gedeeld-paneel" id="${paneelId}">${spelers}</div>` : ''}
    </div>`;
}

function toggleGedeeldRij(sleutel) {
  if (gedeeldOpen.has(sleutel)) gedeeldOpen.delete(sleutel);
  else gedeeldOpen.add(sleutel);
  renderGedeeldResults();
}

/* ─────────────────────────────────────────────────────────────────────────
   TT-295 (26-09-2026) — de bewaarde zoekopdracht.

   Besluiten Ronald, 26-09-2026: één bewaarde zoekopdracht per muzikant; hij
   bewaart alle filters behalve de naam; alleen het tabblad Muzikant. De
   nachtelijke digest (Edge Function send-digest) leest hem via
   tt_digest_new_musicians en mailt wie er sindsdien bij kwam. Dit vervangt
   musician_wanted, dat sinds TT-232 niemand meer kon vullen.

   Het blok staat onder het zoekresultaat, ook onder een leeg resultaat: daar
   zie je dat de juiste er nog niet bij zit (TT-62 deel 2). Alleen met een
   eigen profiel (anders is er niemand om te mailen) en niet als er een naam
   in het zoekveld staat (je zoekt dan één persoon, TT-257).
   ───────────────────────────────────────────────────────────────────────── */
let bewaardeZoek = undefined; // undefined = nog niet geladen, null = geen

async function laadBewaardeZoek() {
  const mid = await getMyMusicianId();
  if (!mid) { bewaardeZoek = null; return null; }
  const { data, error } = await db.from('musician_saved_search')
    .select('*').eq('musician_id', mid).maybeSingle();
  if (error) throw error;
  bewaardeZoek = data || null;
  return bewaardeZoek;
}
// Bij uitloggen: niets van de vorige gebruiker laten staan.
function wisBewaardeZoek() { bewaardeZoek = undefined; laatsteZoekVertrek = null; }

// De zoekopdracht zoals hij nu op het scherm staat, in de vorm van de tabel.
function huidigeZoek() {
  const v = laatsteZoekVertrek;
  const getal = (id) => { const x = document.getElementById(id).value; return x ? parseInt(x) : null; };
  return {
    instruments: filterInstruments.slice(),
    genres: filterGenres.slice(),
    age_min: getal('filterAgeMin'), age_max: getal('filterAgeMax'),
    niveau_min: getal('filterNiveauMin'), niveau_max: getal('filterNiveauMax'),
    radius_km: v.straal,
    plaats: v.plaats, plaats_tekst: v.plaatsTekst,
    origin_lat: v.lat, origin_lng: v.lng,
  };
}

// "Drums, Bas · Rock · 18 t/m 30 jaar · niveau 2 t/m 4 · binnen 10 km van Delft"
function zoekTekst(z) {
  const delen = [z.instruments && z.instruments.length ? z.instruments.join(', ') : 'Alle instrumenten'];
  if (z.genres && z.genres.length) delen.push(z.genres.join(', '));
  if (z.age_min != null || z.age_max != null) {
    delen.push(z.age_max == null ? `vanaf ${z.age_min} jaar`
      : z.age_min == null ? `tot en met ${z.age_max} jaar`
      : `${z.age_min} t/m ${z.age_max} jaar`);
  }
  if (z.niveau_min != null || z.niveau_max != null) {
    delen.push(z.niveau_max == null ? `niveau ${z.niveau_min} en hoger`
      : z.niveau_min == null ? `niveau tot en met ${z.niveau_max}`
      : z.niveau_min === z.niveau_max ? `niveau ${z.niveau_min}`
      : `niveau ${z.niveau_min} t/m ${z.niveau_max}`);
  }
  delen.push(`binnen ${Number(z.radius_km)} km van ${z.plaats_tekst || 'je woonplaats'}`);
  return delen.join(' · ');
}

function zelfdeZoek(a, b) {
  const lijst = (x) => (x || []).slice().sort().join('|');
  return lijst(a.instruments) === lijst(b.instruments) && lijst(a.genres) === lijst(b.genres)
    && a.age_min == b.age_min && a.age_max == b.age_max
    && a.niveau_min == b.niveau_min && a.niveau_max == b.niveau_max
    && Number(a.radius_km) === Number(b.radius_km)
    && (a.plaats || '').toLowerCase() === (b.plaats || '').toLowerCase();
}

async function vulSeintjeBlok() {
  const plek = document.getElementById('seintjePlek');
  if (!plek) return;
  plek.innerHTML = '';
  if (!hasOwnProfile || !laatsteZoekVertrek) return;
  if (naamZoekTerm(document.getElementById('filterName').value)) return;
  try {
    if (bewaardeZoek === undefined) await laadBewaardeZoek();
  } catch (e) {
    logCaught('vulSeintjeBlok', e);
    return; // geen blok is beter dan een kapot blok
  }
  if (!plek.isConnected) return; // intussen opnieuw getekend
  const nu = huidigeZoek();
  const bewaard = bewaardeZoek;
  const dezelfde = !!bewaard && zelfdeZoek(bewaard, nu);
  plek.innerHTML = `
    <div class="seintje-blok">
      <p class="seintje-kop">${dezelfde ? 'Je krijgt een mail als er iemand bijkomt' : 'Mail me als er iemand bijkomt'}</p>
      <p class="seintje-zoek">${escHtml(zoekTekst(nu))}</p>
      ${bewaard && !dezelfde
        ? `<p class="seintje-klein">Je bewaarde zoekopdracht is nu: ${escHtml(zoekTekst(bewaard))}. Je kunt er één bewaren.</p>` : ''}
      ${dezelfde
        ? `<p class="seintje-klein">Je hoeft niet zelf terug te komen kijken. Stoppen kan hier of in Instellingen.</p>
           <button type="button" class="btn btn-ghost seintje-knop" onclick="stopBewaardeZoek()">Stoppen</button>`
        : `<button type="button" class="btn btn-ghost seintje-knop" onclick="bewaarZoek()">${bewaard ? 'Vervangen door deze' : 'Bewaar deze zoekopdracht'}</button>`}
    </div>`;
}

let bewaarBezig = false;
function bewaarZoek() {
  if (bewaarBezig || !laatsteZoekVertrek) return;
  const nu = huidigeZoek();
  if (bewaardeZoek) {
    // Controlevraag (huisstijl §19): noem wat er verdwijnt en wat ervoor terugkomt.
    showConfirm(`Je krijgt dan geen mail meer over ${zoekTekst(bewaardeZoek)}, maar over ${zoekTekst(nu)}. Is dat wat je wilt?`,
      () => bewaarZoekUitvoeren(nu), 'Ja, vervangen');
    return;
  }
  bewaarZoekUitvoeren(nu);
}

async function bewaarZoekUitvoeren(nu) {
  if (bewaarBezig) return;
  bewaarBezig = true; // TT-252: een dubbele tik schrijft niet twee keer
  try {
    const mid = await getMyMusicianId();
    if (!mid) return;
    const rij = Object.assign({ musician_id: mid }, nu);
    const { error } = await db.from('musician_saved_search').upsert(rij, { onConflict: 'musician_id' });
    if (error) throw error;
    bewaardeZoek = rij;
    // Wie de mail had uitgezet, zet hem met deze tik weer aan.
    const { data: m, error: mErr } = await db.from('musicians')
      .select('email_digest_frequency').eq('id', mid).single();
    if (mErr) throw mErr;
    if (m && m.email_digest_frequency === 'off') {
      const { error: uErr } = await db.from('musicians')
        .update({ email_digest_frequency: 'daily' }).eq('id', mid);
      if (uErr) throw uErr;
      showToast('Bewaard. Je mail stond uit en staat nu op dagelijks.');
    } else {
      showToast('Bewaard. Je krijgt een mail als er iemand bijkomt.');
    }
    vulSeintjeBlok();
  } catch (e) {
    logCaught('bewaarZoek', e);
    showToast(friendlyErrorMessage(e, 'de zoekopdracht bewaren'));
  } finally {
    bewaarBezig = false;
  }
}

async function stopBewaardeZoek(vanuitInstellingen) {
  try {
    const mid = await getMyMusicianId();
    if (!mid) return;
    const { error } = await db.from('musician_saved_search').delete().eq('musician_id', mid);
    if (error) throw error;
    bewaardeZoek = null;
    showToast('Gestopt. Je krijgt hier geen mail meer over.');
    vulSeintjeBlok();
    if (vanuitInstellingen) vulBewaardeZoekInInstellingen();
  } catch (e) {
    logCaught('stopBewaardeZoek', e);
    showToast(friendlyErrorMessage(e, 'de bewaarde zoekopdracht stoppen'));
  }
}

// Instellingen → E-mailvoorkeuren: de enige andere plek waar je hem ziet.
async function vulBewaardeZoekInInstellingen() {
  const plek = document.getElementById('bewaardeZoekInstellingen');
  if (!plek) return;
  try {
    await laadBewaardeZoek();
  } catch (e) {
    logCaught('vulBewaardeZoekInInstellingen', e);
    plek.innerHTML = '';
    return;
  }
  plek.innerHTML = bewaardeZoek
    ? `<p class="seintje-zoek">${escHtml(zoekTekst(bewaardeZoek))}</p>
       <button type="button" class="btn btn-ghost seintje-knop" onclick="stopBewaardeZoek(true)">Stoppen</button>`
    : `<p class="field-hint">Nog geen. Zoek een muzikant en tik onder de resultaten op "Bewaar deze zoekopdracht".</p>`;
}
