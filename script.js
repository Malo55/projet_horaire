// Script principal du calculateur d'horaires de travail

// Fonction utilitaire pour sécuriser les addEventListener
function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

// Récupération des éléments du DOM
const form = document.getElementById('horaire-form');
const tableBody = document.querySelector('#table-jours tbody');
const heuresJourInput = document.getElementById('heures-jour');
const heuresJourHHMM = document.getElementById('heures-jour-hhmm');
const pauseOfferteInput = document.getElementById('pause-offerte-min');

// Récupération ou initialisation des données
let jours = JSON.parse(localStorage.getItem('jours')) || [];
let joursVacances = JSON.parse(localStorage.getItem('joursVacances')) || [];
let joursRTT = JSON.parse(localStorage.getItem('joursRTT')) || [];
let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
let joursFeries = JSON.parse(localStorage.getItem('joursFeries')) || [];
let joursRattrapes = JSON.parse(localStorage.getItem('joursRattrapes')) || [];
let heuresJour = parseFloat(localStorage.getItem('heuresJour')) || 7.5;
let pauseOfferte = parseInt(localStorage.getItem('pauseOfferte')) || 15;

// Gestion des jours de travail
let joursTravail = JSON.parse(localStorage.getItem('joursTravail')) || {
    lundi: true,
    mardi: true,
    mercredi: true,
    jeudi: true,
    vendredi: true,
    samedi: false,
    dimanche: false
};

// Gestion des heures supplémentaires
let heuresSupplementaires = parseFloat(localStorage.getItem('heuresSupplementaires')) || 0;
let graphiqueHeuresChart = null;
let graphiqueHeuresMode = 'heures';
let graphiquePeriodeMode = 'annee';

const nomsMoisCourts = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const nomsMoisLongs = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// --- Utilitaires format décimal <-> affichage français ---
function toNumberFromInput(val) {
    if (typeof val !== 'string') return Number(val) || 0;
    const cleaned = val.replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function formatDecimalFr(val) {
    if (!Number.isFinite(val)) return '0,00';
    return val.toFixed(2).replace('.', ',');
}

if (pauseOfferteInput) {
    pauseOfferteInput.value = pauseOfferte;
    pauseOfferteInput.addEventListener('input', function() {
        pauseOfferte = parseInt(pauseOfferteInput.value) || 0;
        localStorage.setItem('pauseOfferte', pauseOfferte);
        // Recalculer tous les écarts
        jours = jours.map(jour => {
            return {
                ...jour,
                heuresTravaillees: parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pausesAvant, jour.pausesApres)),
                ecart: calculerEcart(parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pausesAvant, jour.pausesApres)), heuresJour)
            };
        });
        localStorage.setItem('jours', JSON.stringify(jours));
        afficherJours();
        updateCalculateur();
    });
} else {
    // Si le champ n'est pas encore dans le DOM, on s'assure que la valeur est bien prise en compte
    pauseOfferte = parseInt(localStorage.getItem('pauseOfferte')) || 15;
}

// Gestion des heures supplémentaires
const heuresSupplementairesInput = document.getElementById('heures-supplementaires');
if (heuresSupplementairesInput) {
    heuresSupplementairesInput.value = heuresSupplementaires;
    heuresSupplementairesInput.addEventListener('input', function() {
        heuresSupplementaires = parseFloat(heuresSupplementairesInput.value) || 0;
        localStorage.setItem('heuresSupplementaires', heuresSupplementaires);
        afficherJours();
    });
} else {
    // Si le champ n'est pas encore dans le DOM, on s'assure que la valeur est bien prise en compte
    heuresSupplementaires = parseFloat(localStorage.getItem('heuresSupplementaires')) || 0;
}

// --- Calendrier interactif ---
const calendrierDiv = document.getElementById('calendrier');
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;

// --- Gestion du modal de saisie ---
const modalBg = document.getElementById('modal-bg');
const modalClose = document.getElementById('modal-close');

function getWeekNumber(date) {
    // Calcule le numéro de semaine ISO (lundi comme premier jour)
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// Fonctions pour gérer les jours de travail
function getJourSemaine(dateStr) {
    const date = new Date(dateStr);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return jours[date.getDay()];
}

function isJourTravaille(dateStr) {
    const jourSemaine = getJourSemaine(dateStr);
    return joursTravail[jourSemaine];
}

function initialiserJoursTravail() {
    // Initialiser les cases à cocher avec les valeurs sauvegardées
    Object.keys(joursTravail).forEach(jour => {
        const checkbox = document.getElementById(`jour-${jour}`);
        if (checkbox) {
            checkbox.checked = joursTravail[jour];
            checkbox.addEventListener('change', function() {
                joursTravail[jour] = this.checked;
                localStorage.setItem('joursTravail', JSON.stringify(joursTravail));
                afficherJours(); // Mettre à jour le tableau et le total
                majCalendrier(); // Mettre à jour le calendrier
            });
        }
    });
}

function renderCalendrier(month, year) {
    calendrierDiv.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'calendrier-header';
    header.style.flexDirection = 'column';
    header.style.alignItems = 'center';
    // Ligne année
    const anneeDiv = document.createElement('div');
    anneeDiv.style.display = 'flex';
    anneeDiv.style.alignItems = 'center';
    const prevYearBtn = document.createElement('button');
    prevYearBtn.textContent = '<';
    prevYearBtn.title = 'Année précédente';
    prevYearBtn.style.width = '32px';
    prevYearBtn.style.minWidth = '32px';
    prevYearBtn.style.marginRight = '8px';
    prevYearBtn.onclick = () => { currentYear--; majCalendrier(); };
    const anneeSpan = document.createElement('span');
    anneeSpan.textContent = year;
    anneeSpan.style.margin = '0 22px';
    anneeSpan.style.display = 'inline-block';
    anneeSpan.style.minWidth = '80px';
    anneeSpan.style.textAlign = 'center';
    const nextYearBtn = document.createElement('button');
    nextYearBtn.textContent = '>';
    nextYearBtn.title = 'Année suivante';
    nextYearBtn.style.width = '32px';
    nextYearBtn.style.minWidth = '32px';
    nextYearBtn.style.marginLeft = '8px';
    nextYearBtn.onclick = () => { currentYear++; majCalendrier(); };
    anneeDiv.appendChild(prevYearBtn);
    anneeDiv.appendChild(anneeSpan);
    anneeDiv.appendChild(nextYearBtn);
    // Ligne mois
    const moisDiv = document.createElement('div');
    moisDiv.style.display = 'flex';
    moisDiv.style.alignItems = 'center';
    const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const prevMonthBtn = document.createElement('button');
    prevMonthBtn.textContent = '<';
    prevMonthBtn.title = 'Mois précédent';
    prevMonthBtn.style.width = '32px';
    prevMonthBtn.style.minWidth = '32px';
    prevMonthBtn.style.marginRight = '8px';
    prevMonthBtn.onclick = () => { currentMonth--; if(currentMonth < 0){ currentMonth=11; currentYear--; } majCalendrier(); };
    const moisSpan = document.createElement('span');
    moisSpan.textContent = mois[month];
    moisSpan.style.margin = '0 22px';
    moisSpan.style.display = 'inline-block';
    moisSpan.style.minWidth = '80px';
    moisSpan.style.textAlign = 'center';
    const nextMonthBtn = document.createElement('button');
    nextMonthBtn.textContent = '>';
    nextMonthBtn.title = 'Mois suivant';
    nextMonthBtn.style.width = '32px';
    nextMonthBtn.style.minWidth = '32px';
    nextMonthBtn.style.marginLeft = '8px';
    nextMonthBtn.onclick = () => { currentMonth++; if(currentMonth > 11){ currentMonth=0; currentYear++; } majCalendrier(); };
    moisDiv.appendChild(prevMonthBtn);
    moisDiv.appendChild(moisSpan);
    moisDiv.appendChild(nextMonthBtn);
    // Ajout au header
    header.appendChild(anneeDiv);
    header.appendChild(moisDiv);
    calendrierDiv.appendChild(header);

    const table = document.createElement('table');
    table.className = 'calendrier-table';
    table.style.width = '420px';
    table.style.borderSpacing = '1px';
    table.style.borderCollapse = 'separate';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="width:36px; border:none; background:none; padding:0;"></th><th>Lu</th><th>Ma</th><th>Me</th><th>Je</th><th>Ve</th><th>Sa</th><th>Di</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let row = document.createElement('tr');
    let dayOfWeek = (firstDay.getDay() + 6) % 7; // Lundi=0, Dimanche=6
    let weekDate = new Date(year, month, 1 - dayOfWeek); // Date du lundi de la première semaine affichée
    for(let i=0; i<dayOfWeek; i++) row.appendChild(document.createElement('td'));
    for(let day=1; day<=lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const td = document.createElement('td');
        td.textContent = day;
        
        // Vérifier si c'est un jour de travail
        const estJourTravaille = isJourTravaille(dateStr);
        
        // Mise en évidence si rempli
        const estRempli = jours.some(j => j.date === dateStr);
        if(estRempli) td.classList.add('jour-rempli');
        
        // Mise en évidence si sélectionné
        if(selectedDate === dateStr) {
            if(estRempli) {
                // Jour sélectionné ET rempli : classe spéciale
                td.classList.add('jour-selectionne-rempli');
            } else {
                // Jour sélectionné mais pas rempli
                td.classList.add('jour-selectionne');
            }
        }
        // Mise en évidence vacances/RTT/RHT/fériés/rattrapés uniquement pour les jours (pas pour la colonne semaine)
        if (td.textContent && !isNaN(td.textContent)) {
            if(isJourVacances(dateStr)) td.classList.add('jour-vacances');
            if(isJourRTT(dateStr)) td.classList.add('jour-rtt');
            if(isJourRHT(dateStr)) td.classList.add('jour-rht');
            if(isJourFerie(dateStr)) td.classList.add('jour-ferie');
            if(isJourRattrape(dateStr)) td.classList.add('jour-rattrape');
        }
        
        // Gestion des jours non travaillés et des jours spéciaux (grisés et clic désactivé)
        if (!estJourTravaille) {
            td.classList.add('jour-non-travaille');
            td.onclick = null; // Désactiver le clic
        } else if (isJourVacances(dateStr) || isJourRTT(dateStr) || isJourRHT(dateStr) || isJourFerie(dateStr) || isJourRattrape(dateStr)) {
            // Désactiver le clic sur tous les jours spéciaux
            td.onclick = null;
        } else {
            td.onclick = () => {
                ouvrirModal(dateStr);
            };
        }
        
        row.appendChild(td);
        if(((dayOfWeek + day) % 7) === 0) {
            // Ajout du numéro de semaine au début de la ligne
            const weekNum = getWeekNumber(new Date(year, month, day - 6 > 1 ? day - 6 : 1));
            const weekTd = document.createElement('td');
            weekTd.textContent = weekNum;
            weekTd.style.border = 'none';
            weekTd.style.background = 'none';
            weekTd.style.padding = '0';
            weekTd.style.textAlign = 'center';
            weekTd.style.fontWeight = 'bold';
            // Pas de classe jour-vacances ou jour-rtt sur la colonne semaine
            row.insertBefore(weekTd, row.firstChild);
            tbody.appendChild(row);
            row = document.createElement('tr');
        }
    }
    if(row.children.length > 0) {
        // Ajout du numéro de semaine pour la dernière ligne
        const lastDayInRow = lastDay.getDate();
        const weekNum = getWeekNumber(new Date(year, month, lastDayInRow));
        const weekTd = document.createElement('td');
        weekTd.textContent = weekNum;
        weekTd.style.border = 'none';
        weekTd.style.background = 'none';
        weekTd.style.padding = '0';
        weekTd.style.textAlign = 'center';
        weekTd.style.fontWeight = 'bold';
        row.insertBefore(weekTd, row.firstChild);
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    calendrierDiv.appendChild(table);
}

// Quand on change de mois/année ou de jours saisis, on met à jour le calendrier
function majCalendrier() {
    renderCalendrier(currentMonth, currentYear);
    afficherJours(); // Ajouté pour mettre à jour l'affichage des jours saisis lors du changement de mois/année
}

// Quand on change la date dans le formulaire, on sélectionne le jour dans le calendrier
form.date.addEventListener('change', function() {
    selectedDate = form.date.value;
    majCalendrier();
});

// Initialisation calendrier
majCalendrier();

// --- Correction de la prise en compte du temps minimal de pause midi dans tous les calculs ---

// Fonction pour calculer les heures travaillées (nouvelle version avec pauses dynamiques)
function calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApres) {
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return 0;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    let totalMinutes = departMin - arriveeMin;
    // Pause midi (toujours déduite, au moins le minimum paramétré)
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    let pauseMidi = 0;
    if (pauseDejDebut && pauseDejFin) {
        pauseMidi = toMinutes(pauseDejFin) - toMinutes(pauseDejDebut);
        if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
        totalMinutes -= pauseMidi;
    } else {
        totalMinutes -= pauseMidiMin;
    }
    // Pauses dynamiques (avant et après midi)
    let totalPauseDyn = 0;
    if (Array.isArray(pausesAvant)) {
        pausesAvant.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                totalPauseDyn += (fin - debut);
            }
        });
    }
    if (Array.isArray(pausesApres)) {
        pausesApres.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                totalPauseDyn += (fin - debut);
            }
        });
    }
    // Seul l'excédent > pause offerte est déduit
    let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    if (totalPauseDyn > pauseOfferteVal) {
        totalMinutes -= (totalPauseDyn - pauseOfferteVal);
    }
    return (totalMinutes / 60).toFixed(2);
}

// Variante qui permet de forcer une valeur de pause offerte (utile pour le mode RHT)
function calculerHeuresAvecPause(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApres, pauseOfferteMinutes, ignoreMidiMin = false) {
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return 0;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    let totalMinutes = departMin - arriveeMin;
    // Pause midi (toujours déduite, au moins le minimum paramétré)
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    let pauseMidi = 0;
    if (pauseDejDebut && pauseDejFin) {
        pauseMidi = toMinutes(pauseDejFin) - toMinutes(pauseDejDebut);
        if (!ignoreMidiMin && pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
        totalMinutes -= pauseMidi;
    } else {
        if (!ignoreMidiMin) {
            totalMinutes -= pauseMidiMin;
        }
    }
    // Pauses dynamiques (avant et après midi)
    let totalPauseDyn = 0;
    if (Array.isArray(pausesAvant)) {
        pausesAvant.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                totalPauseDyn += (fin - debut);
            }
        });
    }
    if (Array.isArray(pausesApres)) {
        pausesApres.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                totalPauseDyn += (fin - debut);
            }
        });
    }
    // Seul l'excédent > pause offerte est déduit (pause offerte surchargée si fournie)
    const pauseOff = (typeof pauseOfferteMinutes === 'number' && !isNaN(pauseOfferteMinutes))
        ? pauseOfferteMinutes
        : (typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15);
    if (totalPauseDyn > pauseOff) {
        totalMinutes -= (totalPauseDyn - pauseOff);
    }
    return (totalMinutes / 60).toFixed(2);
}

function getHeuresTravailleesPourGraph(dateStr) {
    const jour = jours.find(j => j.date === dateStr);
    if (!jour || !jour.arrivee || !jour.depart) return 0;

    const isVac = typeof isJourVacances === 'function' ? isJourVacances(dateStr) : false;
    const isRtt = typeof isJourRTT === 'function' ? isJourRTT(dateStr) : false;
    if (isVac || isRtt) return 0;

    const isRhtPhase2 = typeof isDateInRHT === 'function' ? isDateInRHT(dateStr) : false;
    const isRhtPhase1 = typeof isDateInRHTPhase1 === 'function' ? isDateInRHTPhase1(dateStr) : false;
    const isJourRhtCustom = typeof isJourRHT === 'function' ? isJourRHT(dateStr) : false;
    const isRht = isJourRhtCustom || isRhtPhase1 || isRhtPhase2;

    const pausesAvant = Array.isArray(jour.pausesAvant) ? jour.pausesAvant : [];
    const pausesApres = Array.isArray(jour.pausesApres) ? jour.pausesApres : [];

    try {
        if (isRht) {
            const pauseOffEff = typeof getPauseOfferteEffective === 'function' ? getPauseOfferteEffective(dateStr) : pauseOfferte;
            return parseFloat(calculerHeuresAvecPause(
                jour.arrivee,
                jour.pauseDejDebut,
                jour.pauseDejFin,
                jour.depart,
                pausesAvant,
                pausesApres,
                pauseOffEff,
                true
            )) || 0;
        }
        return parseFloat(calculerHeures(
            jour.arrivee,
            jour.pauseDejDebut,
            jour.pauseDejFin,
            jour.depart,
            pausesAvant,
            pausesApres
        )) || 0;
    } catch (error) {
        console.warn('Erreur lors du calcul du graphique pour', dateStr, error);
        return 0;
    }
}

function getHeuresCibleQuotidiennes() {
    const valeur = parseFloat(heuresJour);
    return Number.isFinite(valeur) ? valeur : 0;
}

function filtrerJoursPourGraph(annee) {
    const anneeStr = String(annee);
    let selection = (jours || [])
        .filter(j => j.date && j.date.startsWith(anneeStr + '-'))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (graphiquePeriodeMode === 'mois') {
        const moisStr = String(currentMonth + 1).padStart(2, '0');
        selection = selection.filter(j => j.date.slice(0, 7) === `${anneeStr}-${moisStr}`);
    }

    return selection;
}

function getLibellePeriode(annee) {
    if (graphiquePeriodeMode === 'mois') {
        const moisNom = nomsMoisLongs[currentMonth] || '';
        return `${moisNom} ${annee}`.trim();
    }
    return `Année ${annee}`;
}

function preparerDonneesGraphique(annee) {
    const labels = [];
    const data = [];
    const cible = [];
    const tickLabels = [];
    const heuresCible = getHeuresCibleQuotidiennes();

    const joursSelectionnes = filtrerJoursPourGraph(annee);
    let dernierMois = null;

    joursSelectionnes.forEach(jour => {
        const [y, m, d] = jour.date.split('-');
        const moisNum = parseInt(m, 10);
        const label = `${d}/${m}`;
        labels.push(label);
        data.push(getHeuresTravailleesPourGraph(jour.date));
        cible.push(heuresCible);

        if (graphiquePeriodeMode === 'annee') {
            if (moisNum !== dernierMois) {
                tickLabels.push(nomsMoisCourts[moisNum - 1]);
                dernierMois = moisNum;
            } else {
                tickLabels.push('');
            }
        } else {
            tickLabels.push(String(parseInt(d, 10)));
        }
    });

    return { labels, data, cible, heuresCible, tickLabels };
}

function heureHHMMToDecimal(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [hh, mm] = hhmm.split(':').map(Number);
    return hh + (mm / 60);
}

function decimalHourToHHMM(decimal) {
    if (!Number.isFinite(decimal)) return '--:--';
    const totalMinutes = Math.round(decimal * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.abs(totalMinutes % 60)).padStart(2, '0');
    return `${hh}:${mm}`;
}

function preparerDonneesArrivees(annee) {
    const labels = [];
    const data = [];
    const tickLabels = [];
    let total = 0;
    let count = 0;

    const joursSelectionnes = filtrerJoursPourGraph(annee);
    let dernierMois = null;

    joursSelectionnes.forEach(jourData => {
        const dateStr = jourData.date;
        const [y, m, d] = dateStr.split('-');
        const moisNum = parseInt(m, 10);
        const label = `${d}/${m}`;

        const estTravaille = isJourTravaille(dateStr);
        const estJourSpecial = isJourVacances(dateStr) || isJourRTT(dateStr) || isJourFerie(dateStr);

        if (jourData.arrivee && estTravaille && !estJourSpecial) {
            const decimal = heureHHMMToDecimal(jourData.arrivee);
            labels.push(label);
            data.push(decimal);

            if (graphiquePeriodeMode === 'annee') {
                if (moisNum !== dernierMois) {
                    tickLabels.push(nomsMoisCourts[moisNum - 1]);
                    dernierMois = moisNum;
                } else {
                    tickLabels.push('');
                }
            } else {
                tickLabels.push(String(parseInt(d, 10)));
            }

            if (decimal !== null) {
                total += decimal;
                count++;
            }
        }
        // Si pas d'arrivée valide, on n'ajoute rien pour cette date afin de n'afficher
        // que les jours où il y a réellement une donnée d'arrivée.
    });

    return {
        labels,
        data,
        moyenne: count > 0 ? total / count : null,
        tickLabels
    };
}

function preparerDonneesDeparts(annee) {
    const labels = [];
    const data = [];
    const tickLabels = [];
    let total = 0;
    let count = 0;

    const joursSelectionnes = filtrerJoursPourGraph(annee);
    let dernierMois = null;

    joursSelectionnes.forEach(jourData => {
        const dateStr = jourData.date;
        const [y, m, d] = dateStr.split('-');
        const moisNum = parseInt(m, 10);
        const label = `${d}/${m}`;

        const estTravaille = isJourTravaille(dateStr);
        const estJourSpecial = isJourVacances(dateStr) || isJourRTT(dateStr) || isJourFerie(dateStr);

        if (jourData.depart && estTravaille && !estJourSpecial) {
            const decimal = heureHHMMToDecimal(jourData.depart);
            labels.push(label);
            data.push(decimal);

            if (graphiquePeriodeMode === 'annee') {
                if (moisNum !== dernierMois) {
                    tickLabels.push(nomsMoisCourts[moisNum - 1]);
                    dernierMois = moisNum;
                } else {
                    tickLabels.push('');
                }
            } else {
                tickLabels.push(String(parseInt(d, 10)));
            }

            if (decimal !== null) {
                total += decimal;
                count++;
            }
        }
        // Si pas de départ valide, on n'ajoute rien pour cette date afin de n'afficher
        // que les jours où il y a réellement une donnée de départ.
    });

    return {
        labels,
        data,
        moyenne: count > 0 ? total / count : null,
        tickLabels
    };
}

function mettreAJourTitreGraphique(mode) {
    const titre = document.getElementById('graphique-heures-titre');
    if (!titre) return;
    if (mode === 'arrivees') {
        titre.textContent = "Heures d'arrivée";
    } else if (mode === 'departs') {
        titre.textContent = "Heures de départ";
    } else {
        titre.textContent = 'Heures travaillées';
    }
}

function activerOngletGraphique(mode) {
    document.querySelectorAll('#graphique-heures-onglets .graphique-onglet').forEach(btn => {
        const btnMode = btn.getAttribute('data-mode');
        btn.classList.toggle('active', btnMode === mode);
    });
}

function activerOngletPeriode(mode) {
    document.querySelectorAll('#graphique-periode-onglets .graphique-onglet-periode').forEach(btn => {
        const btnMode = btn.getAttribute('data-periode');
        btn.classList.toggle('active', btnMode === mode);
    });
}

function construireConfigGraphique(mode, annee) {
    const periodeLabel = getLibellePeriode(annee);

    if (mode === 'arrivees') {
        const { labels, data, moyenne, tickLabels } = preparerDonneesArrivees(annee);
        return {
            labels,
            datasets: [
                {
                    label: "Heure d'arrivée",
                    data,
                    borderColor: '#7b1fa2',
                    backgroundColor: 'rgba(123,31,162,0.12)',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: true,
                    spanGaps: false,
                    pointRadius: 0
                }
            ],
            chartTitle: `Arrivées - ${periodeLabel}`,
            tickLabels,
            yScale: {
                beginAtZero: false,
                suggestedMin: 5.5,
                suggestedMax: 11,
                ticks: {
                    callback(value) {
                        return decimalHourToHHMM(value);
                    }
                },
                title: {
                    display: true,
                    text: 'Heure'
                }
            },
            tooltipFormatter(value) {
                return decimalHourToHHMM(value);
            }
        };
    }

    if (mode === 'departs') {
        const { labels, data, moyenne, tickLabels } = preparerDonneesDeparts(annee);
        return {
            labels,
            datasets: [
                {
                    label: "Heure de départ",
                    data,
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46,125,50,0.12)',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: true,
                    spanGaps: false,
                    pointRadius: 0
                }
            ],
            chartTitle: `Départs - ${periodeLabel}`,
            tickLabels,
            yScale: {
                beginAtZero: false,
                suggestedMin: 15,
                suggestedMax: 20,
                ticks: {
                    callback(value) {
                        return decimalHourToHHMM(value);
                    }
                },
                title: {
                    display: true,
                    text: 'Heure'
                }
            },
            tooltipFormatter(value) {
                return decimalHourToHHMM(value);
            }
        };
    }

    const { labels, data, cible, heuresCible, tickLabels } = preparerDonneesGraphique(annee);
    return {
        labels,
        datasets: [
            {
                label: 'Heures travaillées',
                data,
                borderColor: '#1976d2',
                backgroundColor: 'rgba(25,118,210,0.15)',
                borderWidth: 2,
                tension: 0.25,
                fill: true,
                pointRadius: 0
            },
            {
                label: 'Objectif quotidien',
                data: cible,
                borderColor: '#ff7043',
                borderWidth: 2,
                borderDash: [6, 4],
                fill: false,
                pointRadius: 0
            }
        ],
        chartTitle: periodeLabel,
        tickLabels,
        yScale: {
            beginAtZero: true,
            title: {
                display: true,
                text: 'Heures'
            }
        },
        tooltipFormatter(value) {
            return `${Number(value || 0).toFixed(2)} h`;
        }
    };
}

function initialiserGraphiqueHeures() {
    const canvas = document.getElementById('graphique-heures-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    canvas.height = 260;
    canvas.style.height = '260px';
    canvas.style.maxHeight = '260px';
    const config = construireConfigGraphique(graphiqueHeuresMode, currentYear);

    graphiqueHeuresChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: config.labels,
            datasets: config.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${config.tooltipFormatter(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0,
                        autoSkip: false,
                        callback: function(value, index) {
                            if (config.tickLabels && config.tickLabels[index]) {
                                return config.tickLabels[index];
                            }
                            return '';
                        }
                    }
                },
                y: config.yScale
            }
        }
    });
}

function mettreAJourGraphiqueHeures() {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('graphique-heures-canvas');
    if (!canvas) return;

    if (!graphiqueHeuresChart) {
        initialiserGraphiqueHeures();
        return;
    }

    const config = construireConfigGraphique(graphiqueHeuresMode, currentYear);
    graphiqueHeuresChart.data.labels = config.labels;
    graphiqueHeuresChart.data.datasets = config.datasets;
    if (!graphiqueHeuresChart.options.plugins.tooltip) {
        graphiqueHeuresChart.options.plugins.tooltip = {};
    }
    graphiqueHeuresChart.options.plugins.tooltip.callbacks = {
        label(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${config.tooltipFormatter(value)}`;
        }
    };
    // Mettre à jour le callback de l'axe X pour afficher les libellés de période
    if (graphiqueHeuresChart.options.scales.x && graphiqueHeuresChart.options.scales.x.ticks) {
        graphiqueHeuresChart.options.scales.x.ticks.callback = function(value, index) {
            if (config.tickLabels && config.tickLabels[index]) {
                return config.tickLabels[index];
            }
            return '';
        };
    }
    graphiqueHeuresChart.options.scales.y = config.yScale;
    graphiqueHeuresChart.update('none');
}

(function initialiserOngletsGraphique() {
    const onglets = document.querySelectorAll('#graphique-heures-onglets .graphique-onglet');
    if (!onglets.length) return;
    onglets.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            if (mode && mode !== graphiqueHeuresMode) {
                graphiqueHeuresMode = mode;
                activerOngletGraphique(mode);
                mettreAJourTitreGraphique(mode);
                mettreAJourGraphiqueHeures();
            }
        });
    });
    activerOngletGraphique(graphiqueHeuresMode);
    mettreAJourTitreGraphique(graphiqueHeuresMode);
})();

(function initialiserOngletsPeriode() {
    const onglets = document.querySelectorAll('#graphique-periode-onglets .graphique-onglet-periode');
    if (!onglets.length) return;
    onglets.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-periode');
            if (mode && mode !== graphiquePeriodeMode) {
                graphiquePeriodeMode = mode;
                activerOngletPeriode(mode);
                mettreAJourGraphiqueHeures();
            }
        });
    });
    activerOngletPeriode(graphiquePeriodeMode);
})();

// --- Paramètres : onglet Salaire ---
function initialiserParametresSalaire() {
    const nbJoursInput = document.getElementById('param-salaire-nb-jours');
    const nbMoisInput = document.getElementById('param-salaire-nb-mois');
    const salaireMensuelInput = document.getElementById('param-salaire-mensuel-brut');
    const lamalMoisInput = document.getElementById('param-salaire-lamal-mois');

    const heuresJourSpan = document.getElementById('param-salaire-heures-jour');
    const salaireAnnuelSpan = document.getElementById('param-salaire-annuel-brut');
    const lamalAnneeSpan = document.getElementById('param-salaire-lamal-annee');
    const salaireTotalSpan = document.getElementById('param-salaire-annuel-total');
    const heuresAnnuellesSpan = document.getElementById('param-salaire-heures-annuelles');
    const tauxRhtSpan = document.getElementById('param-salaire-taux-rht-brut');

    if (!nbJoursInput || !nbMoisInput || !salaireMensuelInput || !lamalMoisInput) return;

    // Charger les valeurs depuis le localStorage
    nbJoursInput.value = localStorage.getItem('salaireNbJours') || '';
    nbMoisInput.value = localStorage.getItem('salaireNbMois') || '';
    salaireMensuelInput.value = localStorage.getItem('salaireMensuelBrut') || '';
    lamalMoisInput.value = localStorage.getItem('salaireLamalMois') || '';

    function sauver() {
        localStorage.setItem('salaireNbJours', nbJoursInput.value || '');
        localStorage.setItem('salaireNbMois', nbMoisInput.value || '');
        localStorage.setItem('salaireMensuelBrut', salaireMensuelInput.value || '');
        localStorage.setItem('salaireLamalMois', lamalMoisInput.value || '');
    }

    function recalculer() {
        // Heures/jour depuis la config globale
        const hJour = Number.isFinite(heuresJour) ? heuresJour : parseFloat(localStorage.getItem('heuresJour')) || 0;
        if (heuresJourSpan) heuresJourSpan.textContent = formatDecimalFr(hJour);

        const nbJours = toNumberFromInput(nbJoursInput.value);
        const nbMois = toNumberFromInput(nbMoisInput.value);
        const salaireMensuel = toNumberFromInput(salaireMensuelInput.value);
        const lamalMois = toNumberFromInput(lamalMoisInput.value);

        const salaireAnnuel = salaireMensuel * nbMois;
        const lamalAnnee = lamalMois * 12;
        const salaireTotal = salaireAnnuel + lamalAnnee;
        const heuresAnnuelles = nbJours * hJour;
        const tauxRht = heuresAnnuelles > 0 ? (salaireTotal / heuresAnnuelles) : 0;

        if (salaireAnnuelSpan) salaireAnnuelSpan.textContent = formatDecimalFr(salaireAnnuel);
        if (lamalAnneeSpan) lamalAnneeSpan.textContent = formatDecimalFr(lamalAnnee);
        if (salaireTotalSpan) salaireTotalSpan.textContent = formatDecimalFr(salaireTotal);
        if (heuresAnnuellesSpan) heuresAnnuellesSpan.textContent = formatDecimalFr(heuresAnnuelles);
        if (tauxRhtSpan) tauxRhtSpan.textContent = formatDecimalFr(tauxRht);
    }

    ['input', 'change'].forEach(evt => {
        nbJoursInput.addEventListener(evt, () => { sauver(); recalculer(); });
        nbMoisInput.addEventListener(evt, () => { sauver(); recalculer(); });
        salaireMensuelInput.addEventListener(evt, () => { sauver(); recalculer(); });
        lamalMoisInput.addEventListener(evt, () => { sauver(); recalculer(); });
    });

    // Premier calcul à l'ouverture
    recalculer();
}

// Fonction pour calculer l'écart
function calculerEcart(heuresTravaillees, heuresJour) {
    const ecart = heuresTravaillees - heuresJour;
    return (ecart >= 0 ? '+' : '') + ecart.toFixed(2);
}

// Fonction pour formater la date au format JJ.MM.YYYY
function formaterDate(dateStr) {
    const [annee, mois, jour] = dateStr.split('-');
    return `${jour}.${mois}.${annee.slice(2)}`;
}

// Fonction pour afficher les jours dans le tableau (avec suppression, couleur, et total)
function afficherJours() {
    tableBody.innerHTML = '';
    let totalEcart = 0;
    // Trier les jours par date décroissante (du plus récent au plus ancien)
    jours.sort((a, b) => b.date.localeCompare(a.date));
    // Filtrer les jours du mois affiché
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    const joursAffiches = jours.filter(jour => {
        const [y, m] = jour.date.split('-');
        return y === anneeStr && m === moisStr;
    });
    // On crée un Set de tous les jours RTT du mois affiché (jours RTT inclus même sans saisie d'horaire)
    const joursRTTSet = new Set((joursRTT || []).filter(dateStr => {
        const [y, m] = dateStr.split('-');
        return y === anneeStr && m === moisStr;
    }));
    // On affiche les jours saisis du mois affiché
    joursAffiches.forEach((jour, idx) => {
        const isVac = isJourVacances(jour.date);
        const isRtt = isJourRTT(jour.date);
        const isRht = (typeof isJourRHT === 'function' && isJourRHT(jour.date)) || isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
        const isJourTravailleJour = isJourTravaille(jour.date);
        const tr = document.createElement('tr');
        
        // Calcul dynamique des heures travaillées et de l'écart
        // Heures travaillées: si RHT, recalcul avec pause offerte RHT, sinon calcul standard
        let heuresTravDyn = 0;
        if (!(isVac || isRtt)) {
            if (isRht) {
                const pauseOffEff = getPauseOfferteEffective(jour.date);
                // En mode RHT, on n'impose pas de minimum de pause midi
                heuresTravDyn = parseFloat(calculerHeuresAvecPause(
                    jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                    jour.pausesAvant, jour.pausesApres,
                    pauseOffEff,
                    true
                ));
            } else {
                heuresTravDyn = parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pausesAvant, jour.pausesApres));
            }
        }
        
        // Heures à faire selon le mode (RHT ou standard)
        let heuresJourEff = isRht ? getHeuresJourMinutesEffective(jour.date) / 60 : heuresJour;
        let ecartDyn = (isVac || isRtt) ? 0 : heuresTravDyn - heuresJourEff;
        
        // Affichage de l'écart selon le mode
        let ecartAfficheDyn, ecartClassDyn;
        if (isVac || isRtt) {
            ecartAfficheDyn = (isRtt ? '-' : '') + heuresJourEff.toFixed(2);
            ecartClassDyn = 'ecart-negatif';
        } else if (isDateInRHTPhase1(jour.date)) {
            // Mode RHT phase 1 : heures sup écrêtées, heures inf dans compteurs RHT
            if (ecartDyn > 0) {
                ecartAfficheDyn = `+${ecartDyn.toFixed(2)}`;
                ecartClassDyn = 'ecart-positif'; // Vert pour positif
            } else if (ecartDyn < 0) {
                ecartAfficheDyn = `${ecartDyn.toFixed(2)}`;
                ecartClassDyn = 'ecart-negatif'; // Rouge pour négatif
            } else {
                ecartAfficheDyn = '0.00';
                ecartClassDyn = 'ecart-zero'; // Jaune pour zéro
            }
        } else if (isRht) {
            // Mode RHT phase 2 : comportement normal
            if (ecartDyn > 0) {
                ecartAfficheDyn = `+${ecartDyn.toFixed(2)}`;
                ecartClassDyn = 'ecart-positif'; // Vert pour positif
            } else if (ecartDyn < 0) {
                ecartAfficheDyn = `${ecartDyn.toFixed(2)}`;
                ecartClassDyn = 'ecart-negatif'; // Rouge pour négatif
            } else {
                ecartAfficheDyn = '0.00';
                ecartClassDyn = 'ecart-zero'; // Jaune pour zéro
            }
        } else {
            // Mode standard : affecte le total global
            ecartAfficheDyn = (ecartDyn >= 0 ? '+' : '') + ecartDyn.toFixed(2);
            ecartClassDyn = ecartDyn >= 0 ? 'ecart-positif' : 'ecart-negatif';
            totalEcart += ecartDyn;
        }
        // Pause midi fusionnée
        let midiCell = '';
        if (jour.pauseDejDebut && jour.pauseDejFin) {
            const toMinutes = (h) => {
                if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
                const [hh, mm] = h.split(':').map(Number);
                return hh * 60 + mm;
            };
            const debutMin = toMinutes(jour.pauseDejDebut);
            const finMin = toMinutes(jour.pauseDejFin);
            let diff = (debutMin !== null && finMin !== null && finMin > debutMin) ? (finMin - debutMin) : null;
            let diffDec = diff !== null ? (diff/60).toFixed(2) : '';
            let diffHHMM = diff !== null ? `${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}` : '';
            midiCell = `${jour.pauseDejDebut} à ${jour.pauseDejFin}` + (diff !== null ? `<br><span style=\"font-size:0.95em;color:#555;\">(${diffDec} / ${diffHHMM})</span>` : '');
        } else {
            midiCell = '';
        }
        // Heures travaillées aussi en HH:MM
        const heuresTravHHMM = fractionToHHMM(heuresTravDyn);
        // Ajouter une classe pour griser les jours non travaillés
        const rowClass = !isJourTravailleJour && !isVac && !isRtt ? 'jour-non-travaille-row' : '';
        // Calcul du total des pauses prises (hors pause midi)
        let totalPause = totalPausesDyn(jour);
        let totalPauseHHMM = `${String(Math.floor(totalPause/60)).padStart(2,'0')}:${String(totalPause%60).padStart(2,'0')}`;
        // Temps supplémentaire par rapport au paramètre pause offerte
        // Utiliser la pause offerte effective (RHT si applicable) pour l'affichage des pauses
        let pauseOfferteVal = getPauseOfferteEffective(jour.date);
        let suppPause = totalPause - pauseOfferteVal;
        let suppPauseAff = '';
        if (suppPause > 0) {
            let suppHHMM = `${String(Math.floor(suppPause/60)).padStart(2,'0')}:${String(suppPause%60).padStart(2,'0')}`;
            let suppDec = (suppPause/60).toFixed(2);
            suppPauseAff = `<br><span style=\"font-size:0.95em;color:#555;\">(+${suppDec} / ${suppHHMM})</span>`;
        } else if (suppPause < 0) {
            let suppHHMM = `${String(Math.floor(Math.abs(suppPause)/60)).padStart(2,'0')}:${String(Math.abs(suppPause)%60).padStart(2,'0')}`;
            let suppDec = (suppPause/60).toFixed(2);
            suppPauseAff = `<br><span style=\"font-size:0.95em;color:#555;\">(${suppDec} / -${suppHHMM})</span>`;
        }
        let pauseCell = totalPause > 0 ? totalPauseHHMM + suppPauseAff : '-';
        // Conversion de l'écart en HH:MM (affiche par rapport aux heures à faire effectives)
        const ecartMinutes = Math.round(ecartDyn * 60);
        const signe = ecartMinutes >= 0 ? '+' : '-';
        const absMinutes = Math.abs(ecartMinutes);
        const hh = String(Math.floor(absMinutes / 60)).padStart(2, '0');
        const mm = String(absMinutes % 60).padStart(2, '0');
        const ecartHHMM = `${signe}${hh}:${mm}`;
        // Couleur plus claire selon le signe
        let ecartHHMMColor = '#8bc34a'; // vert clair par défaut
        if (ecartDyn < 0) ecartHHMMColor = '#ff8a80'; // rouge clair
        else if (ecartDyn === 0) ecartHHMMColor = '#ffb74d'; // jaune clair
        else ecartHHMMColor = '#8bc34a'; // vert clair
        tr.innerHTML = `
            <td>${formaterDate(jour.date)}</td>
            <td>${jour.arrivee}</td>
            <td>${midiCell}</td>
            <td class="pause-cell">${pauseCell}</td>
            <td>${jour.depart}</td>
            <td>${(isVac || isRtt) ? '0.00' : heuresTravDyn.toFixed(2)}<br><span style="font-size:0.95em;color:#555;">${heuresTravHHMM}</span></td>
            <td class="${ecartClassDyn}">${ecartAfficheDyn}<br><span style="font-size:0.95em; color:${ecartHHMMColor}; font-weight:normal;">${ecartHHMM}</span></td>
            <td><button class="btn-supprimer" data-idx="${jours.indexOf(jour)}">Supprimer</button></td>
        `;
        // Appliquer la classe CSS pour griser la ligne
        if (rowClass) {
            tr.className = rowClass;
        }
        tableBody.appendChild(tr);
    });
    // On ajoute la déduction RTT pour les jours RTT sans saisie d'horaire
    joursRTTSet.forEach(dateStr => {
        totalEcart -= heuresJour;
    });
    
    // Affichage du total d'heures supplémentaires du mois
    const totalEcartDiv = document.getElementById('total-ecart');
    const totalClass = totalEcart >= 0 ? 'ecart-positif' : 'ecart-negatif';
    
    totalEcartDiv.innerHTML = `Total d'heure supplémentaire du mois : <span class="${totalClass}">${totalEcart >= 0 ? '+' : ''}${totalEcart.toFixed(2)}</span>`;

    // Calcul et affichage du total d'heure supplémentaire de l'année (avec heuresSupplementaires)
    const anneeStrAnnee = String(currentYear);
    const joursAnnee = jours.filter(jour => jour.date.startsWith(anneeStrAnnee + '-'));
    let totalEcartAnnee = 0;
    // On prend en compte les RTT de l'année
    const joursRTTAnnee = joursRTT.filter(dateStr => dateStr.startsWith(anneeStrAnnee + '-'));
    joursAnnee.forEach(jour => {
        const isVac = isJourVacances(jour.date);
        const isRtt = isJourRTT(jour.date);
        const isRht = isDateInRHT(jour.date);
        let heuresTravDyn = (isVac || isRtt) ? 0 : parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pausesAvant, jour.pausesApres));
        
        if (isVac || isRtt) {
            // Vacances et RTT : pas d'écart
        } else if (isDateInRHTPhase1(jour.date)) {
            // Jours RHT phase 1: heures sup écrêtées, heures inf dans compteurs RHT
            // Les heures écrêtées ne sont pas ajoutées au total annuel général
            // (elles sont gérées dans les compteurs RHT dédiés)
            let ecartDyn = heuresTravDyn - heuresJour;
            // Heures inf : ne pas ajouter au total annuel (déjà dans compteurs RHT)
        } else if (isRht) {
            // Jours RHT phase 2: n'affectent ni le total annuel ni les compteurs ici
        } else {
            // Mode standard : affecte le total annuel
            let ecartDyn = heuresTravDyn - heuresJour;
            totalEcartAnnee += ecartDyn;
        }
    });
    // Déduction RTT sans saisie d'horaire
    totalEcartAnnee -= joursRTTAnnee.length * heuresJour;
    // Ajout du paramètre heuresSupplementaires
    totalEcartAnnee += heuresSupplementaires;
    const totalClassAnnee = totalEcartAnnee >= 0 ? 'ecart-positif' : 'ecart-negatif';
    totalEcartDiv.innerHTML += `<br/>Total d'heure supplémentaire : <span class="${totalClassAnnee}">${totalEcartAnnee >= 0 ? '+' : ''}${totalEcartAnnee.toFixed(2)}</span>`;
    // Ajout des listeners pour les boutons supprimer
    document.querySelectorAll('.btn-supprimer').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-idx'));
            jours.splice(idx, 1);
            localStorage.setItem('jours', JSON.stringify(jours));
            afficherJours();
        });
    });
    // majCalendrier(); // SUPPRIMÉ pour éviter la boucle infinie
    
    // Mise à jour des compteurs et du graphique après affichage
    mettreAJourGraphiqueHeures();
    updateCompteursAbsences();
}

// Gestion du formulaire (adaptée pour la pause)
form.addEventListener('submit', function(e) {
    e.preventDefault();
    const date = form.date.value;
    const arrivee = form['arrivee'].value;
    const depart = form['depart'].value;
    
    // Vérifier si c'est un jour RHT (phase 1 ou 2)
    const isRhtPhase2 = isDateInRHT(date);
    const isRhtPhase1 = isDateInRHTPhase1(date);
    
    // Pour les jours RHT phase 2, on ne prend pas en compte pause midi et pauses après midi
    // Pour les jours RHT phase 1, on garde les pauses normales (pas de modification des horaires)
    let pauseDejDebut, pauseDejFin, pausesApresData;
    if (isRhtPhase2) {
        // Phase 2 RHT : pas de pause midi
        pauseDejDebut = '';
        pauseDejFin = '';
        pausesApresData = [];
    } else {
        // Phase 1 RHT ou jour normal : garder les pauses
        pauseDejDebut = form['pause-debut'].value;
        pauseDejFin = form['pause-fin'].value;
        pausesApresData = JSON.parse(JSON.stringify(pausesApres));
    }
    
    // On ne gère plus pauseSupActive, pause2Debut, pause2Fin
    // On sauvegarde les pauses dynamiques
    const jourData = {
        date,
        arrivee,
        pauseDejDebut,
        pauseDejFin,
        depart,
        pausesAvant: JSON.parse(JSON.stringify(pausesAvant)),
        pausesApres: pausesApresData,
        heuresTravaillees: parseFloat(calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApresData)),
        ecart: calculerEcart(parseFloat(calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApresData)), heuresJour)
    };
    const index = jours.findIndex(j => j.date === date);
    if (index !== -1) {
        jours[index] = jourData;
    } else {
        jours.push(jourData);
    }
    localStorage.setItem('jours', JSON.stringify(jours));
    afficherJours();
    form.reset();
    fermerModal();
});

// --- Gestion des heures à faire par jour (deux champs synchronisés) ---
function fractionToHHMM(fraction) {
    const h = Math.floor(fraction);
    const m = Math.round((fraction - h) * 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function hhmmToFraction(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h + (m/60);
}
// Mise à jour initiale des deux champs
if (heuresJourInput) heuresJourInput.value = heuresJour.toFixed(2);
if (heuresJourHHMM) heuresJourHHMM.value = fractionToHHMM(heuresJour);

// Synchronisation live des deux champs
if (heuresJourInput) {
    heuresJourInput.addEventListener('input', function() {
        heuresJour = parseFloat(heuresJourInput.value) || 0;
        heuresJourInput.value = heuresJour.toFixed(2); // Limite à 2 décimales
        if (heuresJourHHMM) heuresJourHHMM.value = fractionToHHMM(heuresJour);
        localStorage.setItem('heuresJour', heuresJour);
        // Recalculer tous les écarts
        jours = jours.map(jour => {
            return {
                ...jour,
                ecart: calculerEcart(parseFloat(jour.heuresTravaillees), heuresJour)
            };
        });
        localStorage.setItem('jours', JSON.stringify(jours));
        afficherJours();
    });
}

if (heuresJourHHMM) {
    heuresJourHHMM.addEventListener('input', function() {
        heuresJour = hhmmToFraction(heuresJourHHMM.value);
        if (heuresJourInput) heuresJourInput.value = heuresJour.toFixed(2); // Limite à 2 décimales
        localStorage.setItem('heuresJour', heuresJour);
        // Recalculer tous les écarts
        jours = jours.map(jour => {
            return {
                ...jour,
                ecart: calculerEcart(parseFloat(jour.heuresTravaillees), heuresJour)
            };
        });
        localStorage.setItem('jours', JSON.stringify(jours));
        afficherJours();
    });
}

// --- Export Excel ---
safeAddEventListener('export-excel', 'click', function() {
    // Année affichée
    const anneeStr = String(currentYear);
    // Filtrer les jours de l'année affichée
    const joursAnnee = jours.filter(jour => jour.date.startsWith(anneeStr + '-'));
    // Regrouper par mois
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const moisData = {};
    for (let m = 1; m <= 12; m++) {
        const moisStr = String(m).padStart(2, '0');
        moisData[moisStr] = joursAnnee.filter(jour => jour.date.split('-')[1] === moisStr);
    }
    // Chercher le nombre max de pauses avant/après midi sur l'année (pour colonnes dynamiques)
    let maxAvant = 0, maxApres = 0;
    joursAnnee.forEach(jour => {
        if (Array.isArray(jour.pausesAvant)) maxAvant = Math.max(maxAvant, jour.pausesAvant.length);
        if (Array.isArray(jour.pausesApres)) maxApres = Math.max(maxApres, jour.pausesApres.length);
    });
    // Colonnes d'en-tête dynamiques
    let header = [
        'Date',
        'Arrivée',
        ...Array.from({length: maxAvant}, (_,i) => [`Pause avant ${i+1} début`, `Pause avant ${i+1} fin`]).flat(),
        'Début pause midi',
        'Fin pause midi',
        ...Array.from({length: maxApres}, (_,i) => [`Pause après ${i+1} début`, `Pause après ${i+1} fin`]).flat(),
        'Départ',
        'Heures travaillées',
        'Écart'
    ];
    
    // Ajouter les colonnes RHT si nécessaire (sera vérifié mois par mois)
    const headerWithRHT = [...header, 'Heures écrêtées', 'RHT supplémentaire'];
    
    // Création du classeur
    const wb = XLSX.utils.book_new();
    for (let m = 1; m <= 12; m++) {
        const moisStr = String(m).padStart(2, '0');
        const data = [];
        
        // Vérifier si une phase RHT est active dans ce mois
        let hasRHTInMonth = false;
        if (moisData[moisStr].length > 0) {
            hasRHTInMonth = moisData[moisStr].some(jour => {
                return isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
            });
        }
        
        // En-tête : utiliser l'en-tête avec RHT si nécessaire
        const currentHeader = hasRHTInMonth ? headerWithRHT : header;
        data.push(currentHeader);
        
        // Lignes de jours
        moisData[moisStr].forEach(jour => {
            // Date JJ.MM.AA
            const [y, mo, d] = jour.date.split('-');
            const dateFmt = `${d}.${mo}.${y.slice(2)}`;
            
            // Vérifier si c'est un jour RHT pour recalculer les heures et l'écart
            const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
            const isVac = isJourVacances(jour.date);
            const isRtt = isJourRTT(jour.date);
            
            // Pauses avant
            let pausesAvant = Array.isArray(jour.pausesAvant) ? jour.pausesAvant : [];
            let avantCells = [];
            for (let i = 0; i < maxAvant; i++) {
                if (pausesAvant[i]) {
                    avantCells.push(pausesAvant[i].debut || '', pausesAvant[i].fin || '');
                } else {
                    avantCells.push('', '');
                }
            }
            // Pauses après
            let pausesApres = Array.isArray(jour.pausesApres) ? jour.pausesApres : [];
            let apresCells = [];
            for (let i = 0; i < maxApres; i++) {
                if (pausesApres[i]) {
                    apresCells.push(pausesApres[i].debut || '', pausesApres[i].fin || '');
                } else {
                    apresCells.push('', '');
                }
            }
            
            // Recalcul des heures travaillées et écart si RHT actif
            let heuresTrav, ecart;
            if (isRhtDay && !(isVac || isRtt)) {
                // Mode RHT : recalcul avec pause offerte RHT et heures à faire RHT
                const pauseOffEff = getPauseOfferteEffective(jour.date);
                heuresTrav = parseFloat(calculerHeuresAvecPause(
                    jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                    jour.pausesAvant, jour.pausesApres,
                    pauseOffEff,
                    true
                ));
                const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
                ecart = heuresTrav - heuresJourEff;
            } else {
                // Mode standard : utiliser les valeurs stockées
                heuresTrav = typeof jour.heuresTravaillees === 'number' ? jour.heuresTravaillees : parseFloat(jour.heuresTravaillees || 0);
                ecart = typeof jour.ecart === 'number' ? jour.ecart : parseFloat(jour.ecart || 0);
            }
            
            // Formatage pour l'export (x,xx)
            let heuresTravFormatted = heuresTrav.toFixed(2).replace('.', ',');
            let ecartFormatted = ecart.toFixed(2).replace('.', ',');
            
            // Préparer les données de base
            let rowData = [
                dateFmt,
                jour.arrivee || '',
                ...avantCells,
                jour.pauseDejDebut || '',
                jour.pauseDejFin || '',
                ...apresCells,
                jour.depart || '',
                heuresTravFormatted,
                ecartFormatted
            ];
            
            // Ajouter les colonnes RHT si nécessaire
            if (hasRHTInMonth) {
                if (isRhtDay && !(isVac || isRtt)) {
                    // Mode RHT : calculer les heures écrêtées et RHT supplémentaire
                    if (ecart > 0) {
                        rowData.push(ecart.toFixed(2).replace('.', ','), ''); // Heures écrêtées
                    } else if (ecart < 0) {
                        rowData.push('', Math.abs(ecart).toFixed(2).replace('.', ',')); // RHT supplémentaire
                    } else {
                        rowData.push('', ''); // Pas d'écart
                    }
                } else {
                    // Mode standard : pas de colonnes RHT
                    rowData.push('', '');
                }
            }
            
            data.push(rowData);
        });
        
        // Ligne de totaux
        if (moisData[moisStr].length > 0) {
            // Recalculer les totaux avec les nouvelles valeurs RHT si nécessaire
            let totalHeures = 0, totalEcart = 0;
            
            moisData[moisStr].forEach(jour => {
                const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
                const isVac = isJourVacances(jour.date);
                const isRtt = isJourRTT(jour.date);
                
                if (isRhtDay && !(isVac || isRtt)) {
                    // Mode RHT : recalcul
                    const pauseOffEff = getPauseOfferteEffective(jour.date);
                    const heuresTrav = parseFloat(calculerHeuresAvecPause(
                        jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                        jour.pausesAvant, jour.pausesApres,
                        pauseOffEff,
                        true
                    ));
                    const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
                    const ecart = heuresTrav - heuresJourEff;
                    
                    totalHeures += heuresTrav;
                    totalEcart += ecart;
                } else {
                    // Mode standard : utiliser les valeurs stockées
                    totalHeures += typeof jour.heuresTravaillees === 'number' ? jour.heuresTravaillees : parseFloat(jour.heuresTravaillees || 0);
                    totalEcart += typeof jour.ecart === 'number' ? jour.ecart : parseFloat(jour.ecart || 0);
                }
            });
            
            let totalRow = Array(currentHeader.length).fill('');
            totalRow[currentHeader.indexOf('Départ')] = 'TOTAL'; // Libellé "TOTAL" dans la colonne Départ
            totalRow[currentHeader.indexOf('Heures travaillées')] = totalHeures.toFixed(2).replace('.', ',');
            totalRow[currentHeader.indexOf('Écart')] = totalEcart.toFixed(2).replace('.', ',');
            
            // Ajouter les totaux RHT si nécessaire
            if (hasRHTInMonth) {
                let totalHeuresEcretees = 0, totalRHTSupp = 0;
                
                moisData[moisStr].forEach(jour => {
                    const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
                    const isVac = isJourVacances(jour.date);
                    const isRtt = isJourRTT(jour.date);
                    
                    if (isRhtDay && !(isVac || isRtt)) {
                        // Mode RHT : recalcul
                        const pauseOffEff = getPauseOfferteEffective(jour.date);
                        const heuresTrav = parseFloat(calculerHeuresAvecPause(
                            jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                            jour.pausesAvant, jour.pausesApres,
                            pauseOffEff,
                            true
                        ));
                        const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
                        const ecart = heuresTrav - heuresJourEff;
                        
                        if (ecart > 0) {
                            totalHeuresEcretees += ecart; // Heures écrêtées
                        } else if (ecart < 0) {
                            totalRHTSupp += Math.abs(ecart); // RHT supplémentaire
                        }
                    }
                });
                
                totalRow[currentHeader.indexOf('Heures écrêtées')] = totalHeuresEcretees.toFixed(2).replace('.', ',');
                totalRow[currentHeader.indexOf('RHT supplémentaire')] = totalRHTSupp.toFixed(2).replace('.', ',');
            }
            
            data.push(totalRow);
        }
        
        // Création de la feuille
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Ajustement automatique de la largeur des colonnes
        const colWidths = [];
        for (let col = 0; col < header.length; col++) {
            let maxWidth = header[col].length;
            for (let row = 1; row < data.length; row++) {
                const cellValue = data[row][col];
                if (cellValue && cellValue.toString().length > maxWidth) {
                    maxWidth = cellValue.toString().length;
                }
            }
            colWidths.push({ wch: Math.min(Math.max(maxWidth + 2, 8), 50) }); // Min 8, Max 50
        }
        ws['!cols'] = colWidths;
        
        // Nom de feuille : MM.YY-RHT si RHT actif, sinon MM.YY
        const sheetName = hasRHTInMonth ? `${moisStr}.${anneeStr.slice(2)}-RHT` : `${moisStr}.${anneeStr.slice(2)}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    
    // Ajout de la feuille de backup des jours posés
    const backupData = [];
    backupData.push(['Date', 'Type', 'Description']);
    
    // Récupérer tous les jours posés de l'année
    const joursVacancesAnnee = joursVacances.filter(dateStr => dateStr.startsWith(anneeStr + '-'));
    const joursRTTAnnee = joursRTT.filter(dateStr => dateStr.startsWith(anneeStr + '-'));
    const joursRHTAnnee = joursRHT.filter(dateStr => dateStr.startsWith(anneeStr + '-'));
    const joursFeriesAnnee = joursFeries.filter(dateStr => dateStr.startsWith(anneeStr + '-'));
    const joursRattrapesAnnee = joursRattrapes.filter(dateStr => dateStr.startsWith(anneeStr + '-'));
    
    // Ajouter les congés payés
    joursVacancesAnnee.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Congé payé', 'CP']);
    });
    
    // Ajouter les RTT
    joursRTTAnnee.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'RTT', 'RTT']);
    });
    
    // Ajouter les RHT
    joursRHTAnnee.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'RHT', 'RHT']);
    });
    
    // Ajouter les jours fériés
    joursFeriesAnnee.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Férié', 'Férié']);
    });
    
    // Ajouter les jours rattrapés
    joursRattrapesAnnee.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Jour rattrapé', 'Rattrapé']);
    });
    
    // Créer la feuille de backup
    const wsBackup = XLSX.utils.aoa_to_sheet(backupData);
    XLSX.utils.book_append_sheet(wb, wsBackup, 'Backup_Jours_Posés');
    
    // Export du fichier (nom inchangé, seules les feuilles sont renommées)
    XLSX.writeFile(wb, `horaires_${anneeStr}.xlsx`);
});

// --- Import Excel ---
const importInput = document.getElementById('import-excel');
const importExcelBtn = document.getElementById('import-excel-btn');
if (importInput && importExcelBtn) {
    importExcelBtn.addEventListener('click', function() {
        importInput.click();
    });
    importInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let nouveauxJours = [];
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                if (rows.length < 2) return; // pas de données
                const header = rows[0];
                
                // Traitement spécial pour la feuille de backup des jours posés
                if (sheetName === 'Backup_Jours_Posés') {
                    // Traiter la feuille de backup des jours posés
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row[0] || !row[1]) continue; // Date et Type requis
                        
                        const dateExcel = row[0];
                        const typeJour = row[1];
                        
                        // Convertir la date JJ.MM.AA => AAAA-MM-JJ
                        if (typeof dateExcel === 'string' && dateExcel.includes('.')) {
                            let [jj, mm, aa] = dateExcel.split('.');
                            let yyyy = (aa.length === 2 ? '20' + aa : aa);
                            let dateStr = `${yyyy}-${mm}-${jj}`;
                            
                            // Ajouter le jour selon son type
                            if (typeJour === 'Congé payé' || typeJour === 'CP') {
                                if (!joursVacances.includes(dateStr)) {
                                    joursVacances.push(dateStr);
                                }
                            } else if (typeJour === 'RTT') {
                                if (!joursRTT.includes(dateStr)) {
                                    joursRTT.push(dateStr);
                                }
                            } else if (typeJour === 'RHT') {
                                if (!joursRHT.includes(dateStr)) {
                                    joursRHT.push(dateStr);
                                }
                            } else if (typeJour === 'Férié') {
                                if (!joursFeries.includes(dateStr)) {
                                    joursFeries.push(dateStr);
                                }
                            } else if (typeJour === 'Jour rattrapé' || typeJour === 'Rattrapé') {
                                if (!joursRattrapes.includes(dateStr)) {
                                    joursRattrapes.push(dateStr);
                                }
                            }
                        }
                    }
                    
                    // Sauvegarder les jours posés récupérés
                    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
                    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
                    localStorage.setItem('joursRHT', JSON.stringify(joursRHT));
                    localStorage.setItem('joursFeries', JSON.stringify(joursFeries));
                    localStorage.setItem('joursRattrapes', JSON.stringify(joursRattrapes));
                    
                    return; // Passer à la feuille suivante
                }
                
                // Traitement normal pour les feuilles d'horaires
                // Indices des colonnes dynamiques
                const idxDate = header.indexOf('Date');
                const idxArrivee = header.indexOf('Arrivée');
                const idxPauseMidiDebut = header.indexOf('Début pause midi');
                const idxPauseMidiFin = header.indexOf('Fin pause midi');
                const idxDepart = header.indexOf('Départ');
                const idxHeuresTrav = header.indexOf('Heures travaillées');
                const idxEcart = header.indexOf('Écart');
                
                // Vérifier que c'est bien une feuille d'horaires (doit avoir au moins Date et Arrivée)
                if (idxDate === -1 || idxArrivee === -1) return;
                
                // Pauses avant
                let idxAvantDebuts = [], idxAvantFins = [];
                for (let i = 0; i < header.length; i++) {
                    if (/^Pause avant (\d+) début$/.test(header[i])) idxAvantDebuts.push(i);
                    if (/^Pause avant (\d+) fin$/.test(header[i])) idxAvantFins.push(i);
                }
                // Pauses après
                let idxApresDebuts = [], idxApresFins = [];
                for (let i = 0; i < header.length; i++) {
                    if (/^Pause après (\d+) début$/.test(header[i])) idxApresDebuts.push(i);
                    if (/^Pause après (\d+) fin$/.test(header[i])) idxApresFins.push(i);
                }
                
                // Pour chaque ligne de jour
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    // Sauter la ligne de totaux (si toutes les colonnes sauf heures/écart sont vides)
                    if (
                        (!row[idxDate] || String(row[idxDate]).trim() === '') &&
                        (!row[idxArrivee] || String(row[idxArrivee]).trim() === '') &&
                        (!row[idxDepart] || String(row[idxDepart]).trim() === '')
                    ) continue;
                    
                    // Date au format JJ.MM.AA => AAAA-MM-JJ
                    let dateExcel = row[idxDate];
                    if (!dateExcel || typeof dateExcel !== 'string') continue;
                    let [jj, mm, aa] = dateExcel.split('.');
                    let yyyy = (aa.length === 2 ? '20' + aa : aa);
                    let dateStr = `${yyyy}-${mm}-${jj}`;
                    
                    // Pauses avant
                    let pausesAvant = [];
                    for (let k = 0; k < idxAvantDebuts.length; k++) {
                        let debut = row[idxAvantDebuts[k]] || '';
                        let fin = row[idxAvantFins[k]] || '';
                        if (debut || fin) pausesAvant.push({debut, fin});
                    }
                    // Pauses après
                    let pausesApres = [];
                    for (let k = 0; k < idxApresDebuts.length; k++) {
                        let debut = row[idxApresDebuts[k]] || '';
                        let fin = row[idxApresFins[k]] || '';
                        if (debut || fin) pausesApres.push({debut, fin});
                    }
                    
                    // Heures travaillées et écart (x,xx)
                    let heuresTrav = row[idxHeuresTrav] ? parseFloat(String(row[idxHeuresTrav]).replace(',', '.')) : 0;
                    let ecart = row[idxEcart] ? parseFloat(String(row[idxEcart]).replace(',', '.')) : 0;
                    
                    // Création de l'objet jour
                    let jour = {
                        date: dateStr,
                        arrivee: row[idxArrivee] || '',
                        pauseDejDebut: row[idxPauseMidiDebut] || '',
                        pauseDejFin: row[idxPauseMidiFin] || '',
                        depart: row[idxDepart] || '',
                        pausesAvant,
                        pausesApres,
                        heuresTravaillees: heuresTrav,
                        ecart: ecart
                    };
                    
                    // Remplacer ou ajouter ce jour (par date)
                    const idxExist = nouveauxJours.findIndex(j => j.date === dateStr);
                    if (idxExist !== -1) {
                        nouveauxJours[idxExist] = jour;
                    } else {
                        nouveauxJours.push(jour);
                    }
                }
            });
            // Fusionner avec les jours existants (remplacer ceux de même date)
            nouveauxJours.forEach(jour => {
                const idx = jours.findIndex(j => j.date === jour.date);
                if (idx !== -1) {
                    jours[idx] = jour;
                } else {
                    jours.push(jour);
                }
            });
            localStorage.setItem('jours', JSON.stringify(jours));
            
            // Rafraîchir l'affichage et mettre à jour les compteurs
            afficherJours();
            updateCompteursAbsences();
            majCalendrier();
        };
        reader.readAsArrayBuffer(file);
    });
}

// Initialisation
afficherJours();

function ouvrirModal(dateStr = null) {
    // Vérifier si c'est un jour de travail
    if (dateStr && !isJourTravaille(dateStr)) {
        return; // Ne pas ouvrir le modal pour les jours non travaillés
    }
    modalBg.style.display = 'flex';
    if (dateStr) {
        form.date.value = dateStr;
        selectedDate = dateStr;
        // Pré-remplir si déjà renseigné
        const jour = jours.find(j => j.date === dateStr);
        if (jour) {
            form['arrivee'].value = jour.arrivee || '';
            form['pause-debut'].value = jour.pauseDejDebut || '';
            form['pause-fin'].value = jour.pauseDejFin || '';
            form['depart'].value = jour.depart || '';
            // Pré-remplir les pauses dynamiques
            pausesAvant = Array.isArray(jour.pausesAvant) && jour.pausesAvant.length > 0 ? JSON.parse(JSON.stringify(jour.pausesAvant)) : [{debut:'',fin:''}];
            pausesApres = Array.isArray(jour.pausesApres) && jour.pausesApres.length > 0 ? JSON.parse(JSON.stringify(jour.pausesApres)) : [{debut:'',fin:''}];
        } else {
            form.reset();
            form.date.value = dateStr;
            pausesAvant = [{debut:'',fin:''}];
            pausesApres = [{debut:'',fin:''}];
        }
        renderPausesList(pausesAvant, 'pauses-avant-list', 'avant');
        renderPausesList(pausesApres, 'pauses-apres-list', 'apres');
        majCalendrier();
    }
}
function fermerModal() {
    modalBg.style.display = 'none';
}
modalClose.addEventListener('click', fermerModal);
modalBg.addEventListener('click', function(e) {
    if (e.target === modalBg) fermerModal();
});

// Ouvre le modal si on clique sur le champ date
form.date.addEventListener('focus', function() {
    ouvrirModal(form.date.value);
});

// Auto-formatage des champs horaires texte en HH:MM
function formatHeureInput(input) {
    input.addEventListener('input', function(e) {
        let v = input.value.replace(/[^0-9]/g, '');
        if (v.length > 4) v = v.slice(0,4);
        if (v.length >= 3) {
            input.value = v.slice(0,2) + ':' + v.slice(2,4);
        } else if (v.length >= 1) {
            input.value = v;
        }
    });
    input.addEventListener('blur', function() {
        let v = input.value.replace(/[^0-9]/g, '');
        if (v.length === 1) v = '0' + v; // 6 => 06
        if (v.length === 3) v = '0' + v; // 900 => 09:00
        if (v.length === 4) {
            let h = v.slice(0,2);
            let m = v.slice(2,4);
            let hNum = parseInt(h, 10);
            let mNum = parseInt(m, 10);
            if (isNaN(hNum) || isNaN(mNum) || hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) {
                input.value = '';
            } else {
                input.value = h.padStart(2, '0') + ':' + m.padStart(2, '0');
            }
        } else if (v.length === 2) {
            let hNum = parseInt(v, 10);
            if (isNaN(hNum) || hNum < 0 || hNum > 23) {
                input.value = '';
            } else {
                input.value = v.padStart(2, '0') + ':00';
            }
        } else {
            input.value = '';
        }
        // Ne pas appeler updatePause3Total pour les champs RHT
        if (typeof updatePause3Total === 'function' && !input.id.includes('rht-')) {
            updatePause3Total();
        }
    });
}
['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause2-debut','calc-pause2-fin','calc-pause1-debut','calc-pause1-fin','arrivee','depart','pause-debut','pause-fin','pause2-debut','pause2-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) formatHeureInput(el);
});

// Suppression de toutes les valeurs du mois affiché avec confirmation
safeAddEventListener('supprimer-mois', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    if (confirmModalBg) confirmModalBg.style.display = 'flex';
});
safeAddEventListener('confirm-non', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    if (confirmModalBg) confirmModalBg.style.display = 'none';
});
safeAddEventListener('confirm-oui', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    jours = jours.filter(jour => {
        const [y, m] = jour.date.split('-');
        return !(y === anneeStr && m === moisStr);
    });
    localStorage.setItem('jours', JSON.stringify(jours));
    afficherJours();
    if (confirmModalBg) confirmModalBg.style.display = 'none';
});

// --- Gestion des vacances ---
const btnVacances = document.getElementById('btn-vacances');
const vacancesModalBg = document.getElementById('vacances-modal-bg');
const vacancesModalClose = document.getElementById('vacances-modal-close');
const vacancesModalValider = document.getElementById('vacances-modal-valider');
const calendrierVacancesDiv = document.getElementById('calendrier-vacances');
const vacPrevYear = document.getElementById('vac-prev-year');
const vacNextYear = document.getElementById('vac-next-year');
const vacAnneeSpan = document.getElementById('vac-annee');
let vacAnnee = new Date().getFullYear();

btnVacances.addEventListener('click', function() {
    vacAnnee = new Date().getFullYear();
    renderCalendrierVacances(vacAnnee);
    if (vacAnneeSpan) vacAnneeSpan.textContent = vacAnnee;
    vacancesModalBg.style.display = 'flex';
});
if (vacancesModalClose) {
    vacancesModalClose.addEventListener('click', function() {
        vacancesModalBg.style.display = 'none';
    });
}
if (vacPrevYear && vacNextYear && vacAnneeSpan) {
    vacPrevYear.onclick = function() {
        vacAnnee--;
        renderCalendrierVacances(vacAnnee);
        vacAnneeSpan.textContent = vacAnnee;
    };
    vacNextYear.onclick = function() {
        vacAnnee++;
        renderCalendrierVacances(vacAnnee);
        vacAnneeSpan.textContent = vacAnnee;
    };
}

// --- Gestion RTT/congés dans le calendrier vacances ---
let modeVac = 'conge';
const btnModeConge = document.getElementById('mode-conge');
const btnModeRTT = document.getElementById('mode-rtt');
const btnModeRHT = document.getElementById('mode-rht');
const btnModeFerie = document.getElementById('mode-ferie');
const btnModeRattrape = document.getElementById('mode-rattrape');
let modeVacances = 'conge'; // 'conge', 'rtt', 'rht', 'ferie', 'rattrape'
let compteurRHT = 0;
if (localStorage.getItem('compteurRHT')) compteurRHT = parseInt(localStorage.getItem('compteurRHT'));

function updateVacModeButtons() {
    if (btnModeConge) btnModeConge.classList.toggle('selected', modeVacances === 'conge');
    if (btnModeRTT) btnModeRTT.classList.toggle('selected', modeVacances === 'rtt');
    if (btnModeRHT) btnModeRHT.classList.toggle('selected', modeVacances === 'rht');
    if (btnModeFerie) btnModeFerie.classList.toggle('selected', modeVacances === 'ferie');
    if (btnModeRattrape) btnModeRattrape.classList.toggle('selected', modeVacances === 'rattrape');
}
if (btnModeConge) btnModeConge.onclick = function() { modeVacances = 'conge'; updateVacModeButtons(); };
if (btnModeRTT) btnModeRTT.onclick = function() { modeVacances = 'rtt'; updateVacModeButtons(); };
if (btnModeRHT) btnModeRHT.onclick = function() { modeVacances = 'rht'; updateVacModeButtons(); };
if (btnModeFerie) btnModeFerie.onclick = function() { modeVacances = 'ferie'; updateVacModeButtons(); };
if (btnModeRattrape) btnModeRattrape.onclick = function() { modeVacances = 'rattrape'; updateVacModeButtons(); };

// Gestion du compteur RHT lors de la validation
// Le compteur RHT est géré dans le gestionnaire principal du bouton valider

vacancesModalValider.addEventListener('click', function() {
    // Gestion du compteur RHT lors de la validation
        if (modeVacances === 'rht') {
            compteurRHT++;
            localStorage.setItem('compteurRHT', compteurRHT);
        }
    
    // Sauvegarde de tous les types de jours
    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
    localStorage.setItem('joursFeries', JSON.stringify(joursFeries));
    localStorage.setItem('joursRattrapes', JSON.stringify(joursRattrapes));
    
    // Fermeture du modal
    vacancesModalBg.style.display = 'none';
    
    // Rafraîchit le calendrier principal et les compteurs après validation
    afficherJours();
    updateCompteursAbsences();
    majCalendrier();
});

function renderCalendrierVacances(annee) {
    // Utiliser les variables globales au lieu de créer des variables locales
    // qui masquent la sauvegarde
    calendrierVacancesDiv.innerHTML = '';
    for (let month = 0; month < 12; month++) {
        const moisDiv = document.createElement('div');
        moisDiv.className = 'calendrier-mois-vacances';
        const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const titre = document.createElement('div');
        titre.textContent = mois[month];
        titre.style.textAlign = 'center';
        titre.style.fontWeight = 'bold';
        titre.style.marginBottom = '4px';
        moisDiv.appendChild(titre);
        const table = document.createElement('table');
        table.className = 'table-vacances';
        table.style.borderSpacing = '0.5px';
        table.style.borderCollapse = 'separate';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th></th><th>Lu</th><th>Ma</th><th>Me</th><th>Je</th><th>Ve</th><th>Sa</th><th>Di</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const firstDay = new Date(annee, month, 1);
        const lastDay = new Date(annee, month + 1, 0);
        let row = document.createElement('tr');
        let dayOfWeek = (firstDay.getDay() + 6) % 7; // Lundi=0
        let weekDate = new Date(annee, month, 1);
        if (dayOfWeek > 0) {
            const weekNum = getWeekNumber(weekDate);
            const tdSemaine = document.createElement('td');
            tdSemaine.textContent = weekNum;
            tdSemaine.style.fontWeight = 'bold';
            tdSemaine.style.background = 'none';
            tdSemaine.style.border = 'none';
            row.appendChild(tdSemaine);
        }
        for(let i=0; i<dayOfWeek; i++) row.appendChild(document.createElement('td'));
        for(let day=1; day<=lastDay.getDate(); day++) {
            const dateStr = `${annee}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const td = document.createElement('td');
            td.textContent = day;
            td.className = 'cell-vacances';
            const dow = (dayOfWeek + day - 1) % 7;
            if (dow === 0) {
                const weekNum = getWeekNumber(new Date(annee, month, day));
                if (row.children.length > 0) tbody.appendChild(row);
                row = document.createElement('tr');
                const tdSemaine = document.createElement('td');
                tdSemaine.textContent = weekNum;
                tdSemaine.style.fontWeight = 'bold';
                tdSemaine.style.background = 'none';
                tdSemaine.style.border = 'none';
                row.appendChild(tdSemaine);
            }
            if (dow === 5 || dow === 6) {
                td.style.background = '#eee';
                td.style.color = '#bbb';
                td.style.cursor = 'not-allowed';
            } else {
                if(joursVacances.includes(dateStr)) td.classList.add('jour-vacances');
                if(joursRTT.includes(dateStr)) td.classList.add('jour-rtt');
                if(joursRHT.includes(dateStr)) td.classList.add('jour-rht');
                if(joursFeries.includes(dateStr)) td.classList.add('jour-ferie');
                if(joursRattrapes.includes(dateStr)) td.classList.add('jour-rattrape');
                // Marque les jours avec heures (comme calendrier principal)
                const jourAvecHeures = jours && Array.isArray(jours) && jours.some(j => j.date === dateStr);
                if (jourAvecHeures) {
                    td.classList.add('jour-rempli');
                    // Désactiver le clic sur les jours avec heures
                    td.style.cursor = 'not-allowed';
                    td.style.opacity = '0.7';
                    td.title = 'Jour avec horaires saisis - Impossible de modifier le statut';
                }
                
                td.onclick = () => {
                    // Empêcher le clic sur les jours avec heures
                    if (jourAvecHeures) {
                        return;
                    }
                    if(joursVacances.includes(dateStr)) {
                        joursVacances = joursVacances.filter(d => d !== dateStr);
                        td.classList.remove('jour-vacances');
                    } else if(joursRTT.includes(dateStr)) {
                        joursRTT = joursRTT.filter(d => d !== dateStr);
                        td.classList.remove('jour-rtt');
                    } else if(joursRHT.includes(dateStr)) {
                        joursRHT = joursRHT.filter(d => d !== dateStr);
                        td.classList.remove('jour-rht');
                        localStorage.setItem('joursRHT', JSON.stringify(joursRHT));
                        updateCompteursAbsences();
                        afficherJours();
                        return;
                    } else if(joursFeries.includes(dateStr)) {
                        joursFeries = joursFeries.filter(d => d !== dateStr);
                        td.classList.remove('jour-ferie');
                    } else if(joursRattrapes.includes(dateStr)) {
                        joursRattrapes = joursRattrapes.filter(d => d !== dateStr);
                        td.classList.remove('jour-rattrape');
                    } else {
                        if(modeVacances === 'conge') {
                            joursVacances.push(dateStr);
                            td.classList.add('jour-vacances');
                        } else if (modeVacances === 'rtt') {
                            joursRTT.push(dateStr);
                            td.classList.add('jour-rtt');
                        } else if (modeVacances === 'rht') {
                            let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
                            if (!joursRHT.includes(dateStr)) {
                                joursRHT.push(dateStr);
                                td.classList.add('jour-rht');
                            } else {
                                joursRHT = joursRHT.filter(d => d !== dateStr);
                                td.classList.remove('jour-rht');
                            }
                            localStorage.setItem('joursRHT', JSON.stringify(joursRHT));
                        } else if (modeVacances === 'ferie') {
                            joursFeries.push(dateStr);
                            td.classList.add('jour-ferie');
                        } else if (modeVacances === 'rattrape') {
                            joursRattrapes.push(dateStr);
                            td.classList.add('jour-rattrape');
                        }
                    }
                    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
                    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
                    localStorage.setItem('joursFeries', JSON.stringify(joursFeries));
                    localStorage.setItem('joursRattrapes', JSON.stringify(joursRattrapes));
                    afficherJours();
                    updateCompteursAbsences();
                    majCalendrier();
                    return;
                }
            }
            row.appendChild(td);
        }
        if(row.children.length > 0) tbody.appendChild(row);
        table.appendChild(tbody);
        moisDiv.appendChild(table);
        calendrierVacancesDiv.appendChild(moisDiv);
    }
}

function isJourVacances(dateStr) {
    // Lire directement depuis le localStorage pour être sûr d'avoir les données à jour
    let joursVacances = JSON.parse(localStorage.getItem('joursVacances')) || [];
    return joursVacances.includes(dateStr);
}
function isJourRTT(dateStr) {
    // Lire directement depuis le localStorage pour être sûr d'avoir les données à jour
    let joursRTT = JSON.parse(localStorage.getItem('joursRTT')) || [];
    return joursRTT.includes(dateStr);
}
function isJourFerie(dateStr) {
    // Lire directement depuis le localStorage pour être sûr d'avoir les données à jour
    let joursFeries = JSON.parse(localStorage.getItem('joursFeries')) || [];
    return joursFeries.includes(dateStr);
}
function isJourRattrape(dateStr) {
    // Lire directement depuis le localStorage pour être sûr d'avoir les données à jour
    let joursRattrapes = JSON.parse(localStorage.getItem('joursRattrapes')) || [];
    return joursRattrapes.includes(dateStr);
}
function isJourRHT(dateStr) {
    // Lire directement depuis le localStorage pour être sûr d'avoir les données à jour
    let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
    return joursRHT.includes(dateStr);
}
// Désactiver le clic sur les jours de vacances/RTT/RHT/fériés/rattrapés
function desactiverClicJoursSpeciaux() {
    let tds = calendrierDiv.querySelectorAll('td');
    
    for(let i=0; i<tds.length; i++) {
        const td = tds[i];
        // On ne touche pas à la première colonne (numéro de semaine)
        if(td.cellIndex === 0) continue;
        
        // Vérifier si c'est une cellule contenant un jour
        if(td.textContent && !isNaN(td.textContent) && td.textContent.trim() !== '') {
            const day = parseInt(td.textContent);
            if(day >= 1 && day <= 31) { // Validation que c'est bien un jour valide
                const currentMonth = parseInt(document.querySelector('.calendrier-header span').textContent.match(/\d+/)[0]) - 1;
                const currentYear = parseInt(document.querySelector('.calendrier-header span').textContent);
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                
                if(isJourVacances(dateStr) || isJourRTT(dateStr) || isJourRHT(dateStr) || isJourFerie(dateStr) || isJourRattrape(dateStr)) {
                    td.onclick = null; // Désactiver le clic
                }
            }
        }
    }
}

// --- Calculateur d'heure d'arrivée/départ ---
const calcPauseDebut = document.getElementById('calc-pause-debut');
const calcPauseFin = document.getElementById('calc-pause-fin');
const calcArrivee = document.getElementById('calc-arrivee');
const calcDepart = document.getElementById('calc-depart');
const calcInfo = document.getElementById('calc-info');
const calcPauseSupFields = document.getElementById('calc-pause-sup-fields');
const calcPause2Debut = document.getElementById('calc-pause2-debut');
const calcPause2Fin = document.getElementById('calc-pause2-fin');
const calcPause1Debut = document.getElementById('calc-pause1-debut');
const calcPause1Fin = document.getElementById('calc-pause1-fin');
const departIndication = document.getElementById('depart-indication');

let lastInput = null;
[calcArrivee, calcDepart].forEach(el => {
    el.addEventListener('focus', function() { lastInput = el.id; });
});

function toMinutes(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function toHHMM(mins) {
    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);
    if (m === 60) { h++; m = 0; }
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function getPauseMinutesAvecMin() {
    const debut = toMinutes(calcPauseDebut.value);
    const fin = toMinutes(calcPauseFin.value);
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    if (debut !== null && fin !== null && fin > debut) {
        let val = fin - debut;
        return val < pauseMidiMin ? pauseMidiMin : val;
    }
    return pauseMidiMin;
}
function getHeuresJourMinutes() {
    // On lit la valeur actuelle du champ fraction d'heure
    const input = document.getElementById('heures-jour');
    let val = input ? parseFloat(input.value) : heuresJour;
    if (isNaN(val)) val = 7.5;
    return Math.round(val * 60);
}
function getPauseApresCalculetteMinutes() {
    const modeDuree = document.getElementById('calc-pause-apres-mode-duree');
    const dureeInput = document.getElementById('calc-pause-apres-duree');
    const debutInput = document.getElementById('calc-pause-apres-debut');
    const finInput = document.getElementById('calc-pause-apres-fin');
    
    if (modeDuree && modeDuree.checked) {
        const duree = dureeInput ? dureeInput.value : '';
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            return hh * 60 + mm;
        }
        return 0;
    }
    
    const debut = debutInput ? toMinutes(debutInput.value) : null;
    const fin = finInput ? toMinutes(finInput.value) : null;
    if (debut !== null && fin !== null && fin > debut) {
        return fin - debut;
    }
    return 0;
}

function getPauseSupMinutes() {
    let total = 0;
    if (calcPause2Debut && calcPause2Fin) {
        const debut = toMinutes(calcPause2Debut.value);
        const fin = toMinutes(calcPause2Fin.value);
        if (debut !== null && fin !== null && fin > debut) {
            total += (fin - debut);
        }
    }
    total += getPauseApresCalculetteMinutes();
    return total;
}
function getPause1Minutes() {
    const debut = toMinutes(calcPause1Debut.value);
    const fin = toMinutes(calcPause1Fin.value);
    if (debut !== null && fin !== null && fin > debut) {
        return fin - debut;
    }
    return 0;
}
function getPauseOfferte() {
    return parseInt(pauseOfferteInput ? pauseOfferteInput.value : pauseOfferte) || 0;
}
let plageArriveeMin = 480; // 08:00 en minutes
let plageArriveeMax = 600; // 10:00 en minutes
let plageMidiMin = 720; // 12:00 en minutes
let plageMidiMax = 840; // 14:00 en minutes
let plageDepartMin = 945; // 15:45 en minutes
let plageDepartMax = 1080; // 18:00 en minutes
// Plages RHT (arrivée/départ)
// Variables pour compatibilité avec l'ancien code - seront mises à jour dynamiquement
let rhtPlageArriveeMin = 480;
let rhtPlageArriveeMax = 600;
let rhtPlageDepartMin = 945;
let rhtPlageDepartMax = 1080;

// Fonction pour mettre à jour les variables globales RHT selon la date du jour
function mettreAJourPlagesRHTGlobales() {
    const plages = obtenirPlagesHorairesRHTAujourdhui();
    rhtPlageArriveeMin = plages.arriveeMin;
    rhtPlageArriveeMax = plages.arriveeMax;
    rhtPlageDepartMin = plages.departMin;
    rhtPlageDepartMax = plages.departMax;
}

// Mettre à jour les plages globales au chargement et quand nécessaire
mettreAJourPlagesRHTGlobales();
const plageArriveeMinInput = document.getElementById('plage-arrivee-min');
const plageArriveeMaxInput = document.getElementById('plage-arrivee-max');
const plageMidiMinInput = document.getElementById('plage-midi-min');
const plageMidiMaxInput = document.getElementById('plage-midi-max');
const plageDepartMinInput = document.getElementById('plage-depart-min');
const plageDepartMaxInput = document.getElementById('plage-depart-max');
// Inputs RHT
const rhtPlageArriveeMinInput = document.getElementById('rht-plage-arrivee-min');
const rhtPlageArriveeMaxInput = document.getElementById('rht-plage-arrivee-max');
const rhtPlageDepartMinInput = document.getElementById('rht-plage-depart-min');
const rhtPlageDepartMaxInput = document.getElementById('rht-plage-depart-max');
// Restauration depuis le localStorage
if (localStorage.getItem('plageArriveeMin')) {
    plageArriveeMin = parseInt(localStorage.getItem('plageArriveeMin'));
    if (plageArriveeMinInput) plageArriveeMinInput.value = toHHMM(plageArriveeMin);
}
if (localStorage.getItem('plageArriveeMax')) {
    plageArriveeMax = parseInt(localStorage.getItem('plageArriveeMax'));
    if (plageArriveeMaxInput) plageArriveeMaxInput.value = toHHMM(plageArriveeMax);
}
if (localStorage.getItem('plageMidiMin')) {
    plageMidiMin = parseInt(localStorage.getItem('plageMidiMin'));
    if (plageMidiMinInput) plageMidiMinInput.value = toHHMM(plageMidiMin);
}
if (localStorage.getItem('plageMidiMax')) {
    plageMidiMax = parseInt(localStorage.getItem('plageMidiMax'));
    if (plageMidiMaxInput) plageMidiMaxInput.value = toHHMM(plageMidiMax);
}
if (localStorage.getItem('plageDepartMin')) {
    plageDepartMin = parseInt(localStorage.getItem('plageDepartMin'));
    if (plageDepartMinInput) plageDepartMinInput.value = toHHMM(plageDepartMin);
}
if (localStorage.getItem('plageDepartMax')) {
    plageDepartMax = parseInt(localStorage.getItem('plageDepartMax'));
    if (plageDepartMaxInput) plageDepartMaxInput.value = toHHMM(plageDepartMax);
}
if (plageArriveeMinInput && plageArriveeMaxInput) {
    plageArriveeMin = toMinutes(plageArriveeMinInput.value);
    plageArriveeMax = toMinutes(plageArriveeMaxInput.value);
    plageArriveeMinInput.addEventListener('input', function() {
        plageArriveeMin = toMinutes(this.value);
        localStorage.setItem('plageArriveeMin', plageArriveeMin);
    });
    plageArriveeMaxInput.addEventListener('input', function() {
        plageArriveeMax = toMinutes(this.value);
        localStorage.setItem('plageArriveeMax', plageArriveeMax);
    });
}
if (plageMidiMinInput && plageMidiMaxInput) {
    plageMidiMin = toMinutes(plageMidiMinInput.value);
    plageMidiMax = toMinutes(plageMidiMaxInput.value);
    plageMidiMinInput.addEventListener('input', function() {
        plageMidiMin = toMinutes(this.value);
        localStorage.setItem('plageMidiMin', plageMidiMin);
    });
    plageMidiMaxInput.addEventListener('input', function() {
        plageMidiMax = toMinutes(this.value);
        localStorage.setItem('plageMidiMax', plageMidiMax);
    });
}
if (plageDepartMinInput && plageDepartMaxInput) {
    plageDepartMin = toMinutes(plageDepartMinInput.value);
    plageDepartMax = toMinutes(plageDepartMaxInput.value);
    plageDepartMinInput.addEventListener('input', function() {
        plageDepartMin = toMinutes(this.value);
        localStorage.setItem('plageDepartMin', plageDepartMin);
    });
    plageDepartMaxInput.addEventListener('input', function() {
        plageDepartMax = toMinutes(this.value);
        localStorage.setItem('plageDepartMax', plageDepartMax);
    });
}
// Restauration/écouteurs RHT avec formatage automatique
if (rhtPlageArriveeMinInput && rhtPlageArriveeMaxInput) {
    rhtPlageArriveeMinInput.value = toHHMM(rhtPlageArriveeMin);
    rhtPlageArriveeMaxInput.value = toHHMM(rhtPlageArriveeMax);
    rhtPlageArriveeMin = toMinutes(rhtPlageArriveeMinInput.value);
    rhtPlageArriveeMax = toMinutes(rhtPlageArriveeMaxInput.value);
    
    // Appliquer le formatage automatique
    formatHeureInput(rhtPlageArriveeMinInput);
    formatHeureInput(rhtPlageArriveeMaxInput);
    
    // Event listeners pour sauvegarder les valeurs
    rhtPlageArriveeMinInput.addEventListener('blur', function() {
        rhtPlageArriveeMin = toMinutes(this.value);
        localStorage.setItem('rhtPlageArriveeMin', rhtPlageArriveeMin);
    });
    rhtPlageArriveeMaxInput.addEventListener('blur', function() {
        rhtPlageArriveeMax = toMinutes(this.value);
        localStorage.setItem('rhtPlageArriveeMax', rhtPlageArriveeMax);
    });
}
if (rhtPlageDepartMinInput && rhtPlageDepartMaxInput) {
    rhtPlageDepartMinInput.value = toHHMM(rhtPlageDepartMin);
    rhtPlageDepartMaxInput.value = toHHMM(rhtPlageDepartMax);
    rhtPlageDepartMin = toMinutes(rhtPlageDepartMinInput.value);
    rhtPlageDepartMax = toMinutes(rhtPlageDepartMaxInput.value);
    
    // Appliquer le formatage automatique
    formatHeureInput(rhtPlageDepartMinInput);
    formatHeureInput(rhtPlageDepartMaxInput);
    
    // Event listeners pour sauvegarder les valeurs
    rhtPlageDepartMinInput.addEventListener('blur', function() {
        rhtPlageDepartMin = toMinutes(this.value);
        localStorage.setItem('rhtPlageDepartMin', rhtPlageDepartMin);
    });
    rhtPlageDepartMaxInput.addEventListener('blur', function() {
        rhtPlageDepartMax = toMinutes(this.value);
        localStorage.setItem('rhtPlageDepartMax', rhtPlageDepartMax);
    });
}
function clampDepartMins(mins) {
    if (mins < plageDepartMin) return plageDepartMin;
    if (mins > plageDepartMax) return plageDepartMax;
    return mins;
}
function clampArriveeMins(mins) {
    if (mins < plageArriveeMin) return plageArriveeMin;
    if (mins > plageArriveeMax) return plageArriveeMax;
    return mins;
}
function clampMidiMins(mins) {
    if (mins < plageMidiMin) return plageMidiMin;
    if (mins > plageMidiMax) return plageMidiMax;
    return mins;
}
function updateCalculateur() {
    const departIndication = document.getElementById('depart-indication');
    if (departIndication) {
        departIndication.textContent = '';
        departIndication.style.color = '';
    }
    // Pause matin : mode durée ou début/fin
    let pause1Mins = 0;
    if (document.getElementById('calc-pause1-mode-duree')?.checked) {
        const duree = document.getElementById('calc-pause1-duree')?.value;
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            pause1Mins = hh * 60 + mm;
        }
    } else {
        pause1Mins = getPause1Minutes();
    }
    // Pause midi : mode durée ou début/fin (seulement si pas en mode RHT)
    let pauseMins = 0;
    // Note: calcRhtChecked sera défini juste après, on vérifie le DOM directement ici
    const isRhtMode = !!document.getElementById('calc-rht-mode')?.checked;
    if (!isRhtMode) {
        if (document.getElementById('calc-pause-midi-mode-duree')?.checked) {
            const duree = document.getElementById('calc-pause-midi-mode-duree')?.value;
            if (/^\d{2}:\d{2}$/.test(duree)) {
                const [hh, mm] = duree.split(':').map(Number);
                pauseMins = hh * 60 + mm;
            }
        } else {
            pauseMins = getPauseMinutesAvecMin();
        }
    }
    // Paramètres selon le mode RHT ou normal
    const calcRhtChecked = !!document.getElementById('calc-rht-mode')?.checked;
    let travailMins, pauseOfferteVal;
    
    if (calcRhtChecked) {
        // Mode RHT : utiliser les paramètres RHT
        const rhtDecStr = localStorage.getItem('rht_heures_dec');
        const rhtHeures = rhtDecStr ? parseFloat(rhtDecStr.replace(',', '.')) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
        travailMins = Math.round((isNaN(rhtHeures) ? 7.5 : rhtHeures) * 60);
        const rhtPause = parseInt(localStorage.getItem('rht_pause_offerte'));
        pauseOfferteVal = !isNaN(rhtPause) ? rhtPause : (typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15);
    } else {
        // Mode normal : utiliser les paramètres généraux
        travailMins = getHeuresJourMinutes();
        pauseOfferteVal = getPauseOfferte();
    }
    
    let pauseSup = getPauseSupMinutes();
    let arriveeMins = null, departMins = null, departMinsAvantClamp = null;
    // Calcul du delta d'heure à chaque modification
    let delta = null;
    // Gestion visuelle des plages
    function checkPlage(input, mins, min, max) {
        if (mins === null || isNaN(mins)) {
            input.style.background = '';
            return;
        }
        if (mins < min || mins > max) {
            input.style.background = '#ffcccc';
        } else {
            input.style.background = '';
        }
    }
    const arriveeMinClamp = (mins) => calcRhtChecked ? Math.min(Math.max(mins, rhtPlageArriveeMin), rhtPlageArriveeMax) : Math.min(Math.max(mins, plageArriveeMin), plageArriveeMax);
    const departMinClamp = (mins) => calcRhtChecked ? Math.min(Math.max(mins, rhtPlageDepartMin), rhtPlageDepartMax) : Math.min(Math.max(mins, plageDepartMin), plageDepartMax);
    if (lastInput === 'calc-arrivee' && calcArrivee.value && /^\d{2}:\d{2}$/.test(calcArrivee.value)) {
        arriveeMins = toMinutes(calcArrivee.value);
        checkPlage(calcArrivee, arriveeMins, calcRhtChecked ? rhtPlageArriveeMin : plageArriveeMin, calcRhtChecked ? rhtPlageArriveeMax : plageArriveeMax);
        departMins = arriveeMins + travailMins + pauseMins;
        // Total des pauses (matin + pauses supplémentaires incluant après-midi)
        const totalPauses = pause1Mins + pauseSup;
        if (totalPauses > pauseOfferteVal) {
            departMins += (totalPauses - pauseOfferteVal);
        }
        departMinsAvantClamp = departMins;
        // On ne corrige plus la valeur, on affiche juste le calcul
        calcDepart.value = toHHMM(departMins);
        checkPlage(calcDepart, departMins, calcRhtChecked ? rhtPlageDepartMin : plageDepartMin, calcRhtChecked ? rhtPlageDepartMax : plageDepartMax);
    } else if (lastInput === 'calc-depart' && calcDepart.value && /^\d{2}:\d{2}$/.test(calcDepart.value)) {
        departMins = toMinutes(calcDepart.value);
        checkPlage(calcDepart, departMins, calcRhtChecked ? rhtPlageDepartMin : plageDepartMin, calcRhtChecked ? rhtPlageDepartMax : plageDepartMax);
        // Total des pauses (matin + pauses supplémentaires incluant après-midi)
        const totalPauses = pause1Mins + pauseSup;
        if (totalPauses > pauseOfferteVal) {
            departMins -= (totalPauses - pauseOfferteVal);
        }
        arriveeMins = departMins - travailMins - pauseMins;
        calcArrivee.value = toHHMM(arriveeMins);
        checkPlage(calcArrivee, arriveeMins, calcRhtChecked ? rhtPlageArriveeMin : plageArriveeMin, calcRhtChecked ? rhtPlageArriveeMax : plageArriveeMax);
    } else if (
        lastInput === 'calc-pause1-debut' || lastInput === 'calc-pause1-fin' ||
        lastInput === 'calc-pause2-debut' || lastInput === 'calc-pause2-fin' ||
        lastInput === 'calc-pause-debut' || lastInput === 'calc-pause-fin' ||
        lastInput === 'calc-pause-apres-debut' || lastInput === 'calc-pause-apres-fin' ||
        lastInput === 'calc-pause1-duree' || lastInput === 'calc-pause-midi-duree' ||
        lastInput === 'calc-pause-apres-duree' ||
        lastInput === 'heures-jour' || lastInput === 'heures-jour-hhmm'
    ) {
        // Si l'arrivée est remplie, on recalcule le départ
        if (calcArrivee.value && /^\d{2}:\d{2}$/.test(calcArrivee.value)) {
            arriveeMins = toMinutes(calcArrivee.value);
            checkPlage(calcArrivee, arriveeMins, calcRhtChecked ? rhtPlageArriveeMin : plageArriveeMin, calcRhtChecked ? rhtPlageArriveeMax : plageArriveeMax);
            departMins = arriveeMins + travailMins + pauseMins;
            // Total des pauses (matin + pauses supplémentaires incluant après-midi)
            const totalPauses = pause1Mins + pauseSup;
            if (totalPauses > pauseOfferteVal) {
                departMins += (totalPauses - pauseOfferteVal);
            }
            departMinsAvantClamp = departMins;
            calcDepart.value = toHHMM(departMins);
            checkPlage(calcDepart, departMins, calcRhtChecked ? rhtPlageDepartMin : plageDepartMin, calcRhtChecked ? rhtPlageDepartMax : plageDepartMax);
        } else if (calcDepart.value && /^\d{2}:\d{2}$/.test(calcDepart.value)) {
            departMins = toMinutes(calcDepart.value);
            checkPlage(calcDepart, departMins, calcRhtChecked ? rhtPlageDepartMin : plageDepartMin, calcRhtChecked ? rhtPlageDepartMax : plageDepartMax);
            // Total des pauses (matin + pauses supplémentaires incluant après-midi)
            const totalPauses = pause1Mins + pauseSup;
            if (totalPauses > pauseOfferteVal) {
                departMins -= (totalPauses - pauseOfferteVal);
            }
            arriveeMins = departMins - travailMins - pauseMins;
            calcArrivee.value = toHHMM(arriveeMins);
            checkPlage(calcArrivee, arriveeMins, calcRhtChecked ? rhtPlageArriveeMin : plageArriveeMin, calcRhtChecked ? rhtPlageArriveeMax : plageArriveeMax);
        }
    }
    let infoPause1 = pause1Mins > 0 ? `pause matin de ${pause1Mins} min` : 'pas de pause matin';
    let infoPauseSup = pauseSup > 0 ? `pause supp. de ${pauseSup} min` : 'pas de pause supp.';
    calcInfo.textContent = '';
}
['calcPauseDebut', 'calcPauseFin', 'calcArrivee', 'calcDepart', 'calcPause2Debut', 'calcPause2Fin', 'calcPause1Debut', 'calcPause1Fin', 'calcPauseApresDebut', 'calcPauseApresFin', 'calcPauseApresDuree'].forEach(id => {
    const el = document.getElementById(id.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (el) {
        el.addEventListener('input', function() { 
            lastInput = el.id; 
            updateCalculateur(); 
            // Mettre à jour le delta des heures supplémentaires
            if (typeof calculerHeuresSupCalculette === 'function') {
                setTimeout(calculerHeuresSupCalculette, 0);
            }
        });
        el.addEventListener('change', function() { 
            lastInput = el.id; 
            updateCalculateur(); 
            // Mettre à jour le delta des heures supplémentaires
            if (typeof calculerHeuresSupCalculette === 'function') {
                setTimeout(calculerHeuresSupCalculette, 0);
            }
        });
    }
});

// Affichage initial correct de la pause supplémentaire si la case est cochée
if (typeof calcPauseSupFields !== 'undefined' && calcPauseSupFields) calcPauseSupFields.style.display = pauseCheckbox.checked ? '' : 'none';

if (heuresJourInput) {
    heuresJourInput.addEventListener('input', function() {
        updateCalculateur();
        // Mettre à jour le delta des heures supplémentaires
        if (typeof calculerHeuresSupCalculette === 'function') {
            setTimeout(calculerHeuresSupCalculette, 0);
        }
    });
    heuresJourInput.addEventListener('change', function() {
        updateCalculateur();
        // Mettre à jour le delta des heures supplémentaires
        if (typeof calculerHeuresSupCalculette === 'function') {
            setTimeout(calculerHeuresSupCalculette, 0);
        }
    });
}

// Initialisation des jours de travail
initialiserJoursTravail();

// Attendre que le DOM soit chargé pour initialiser le menu
document.addEventListener('DOMContentLoaded', function() {
    // --- Gestion du modal de menu ---
    safeAddEventListener('btn-menu', 'click', function() {
        fermerTousLesModals();
        const menuModalBg = document.getElementById('menu-modal-bg');
        if (menuModalBg) menuModalBg.style.display = 'flex';
    });
    safeAddEventListener('menu-modal-close', 'click', function() {
        const menuModalBg = document.getElementById('menu-modal-bg');
        if (menuModalBg) menuModalBg.style.display = 'none';
    });

    // --- Gestion du module Paramètres ---
    const menuParametres = document.getElementById('menu-parametres');
    const parametresModalBg = document.getElementById('parametres-modal-bg');
    const parametresModalClose = document.getElementById('parametres-modal-close');
    const parametresAnnuler = document.getElementById('parametres-annuler');

    if (menuParametres && parametresModalBg && parametresModalClose && parametresAnnuler) {
        // Ouvrir le modal des paramètres
        safeAddEventListener('menu-parametres', 'click', function() {
            fermerTousLesModals();
            // Pré-remplir les champs avec les valeurs actuelles
            const paramHeuresJour = document.getElementById('param-heures-jour');
            const paramPauseOfferte = document.getElementById('param-pause-offerte');
            const paramHeuresSupplementaires = document.getElementById('param-heures-supplementaires');
            
            if (paramHeuresJour) paramHeuresJour.value = heuresJour;
            if (paramPauseOfferte) paramPauseOfferte.value = pauseOfferte;
            if (paramHeuresSupplementaires) paramHeuresSupplementaires.value = heuresSupplementaires;
            
            // Pré-remplir les jours de travail
            Object.keys(joursTravail).forEach(jour => {
                const checkbox = document.getElementById(`param-jour-${jour}`);
                if (checkbox) {
                    checkbox.checked = joursTravail[jour];
                }
            });
            
            // Charger les périodes RHT
            if (typeof afficherPeriodesRHT === 'function') {
                afficherPeriodesRHT('phase1');
                afficherPeriodesRHT('phase2');
                afficherMessageChevauchement();
            }
            
            if (parametresModalBg) parametresModalBg.style.display = 'flex';
        });

        // Fermer le modal des paramètres
        safeAddEventListener('parametres-modal-close', 'click', function() {
            if (parametresModalBg) parametresModalBg.style.display = 'none';
        });

        safeAddEventListener('parametres-annuler', 'click', function() {
            if (parametresModalBg) parametresModalBg.style.display = 'none';
        });

        // Fermer le modal en cliquant à l'extérieur
        safeAddEventListener('parametres-modal-bg', 'click', function(e) {
            if (e.target === parametresModalBg) {
                parametresModalBg.style.display = 'none';
            }
        });

        // Synchronisation live des deux champs dans les paramètres
        const paramHeuresJour = document.getElementById('param-heures-jour');
        const paramHeuresJourHHMM = document.getElementById('param-heures-jour-hhmm');
        if (paramHeuresJour && paramHeuresJourHHMM) {
            // Initialisation
            paramHeuresJour.value = heuresJour.toFixed(2);
            paramHeuresJourHHMM.value = fractionToHHMM(heuresJour);
            // Décimal -> HH:MM
            safeAddEventListener('param-heures-jour', 'input', function() {
                const val = parseFloat(this.value) || 0;
                paramHeuresJourHHMM.value = fractionToHHMM(val);
                heuresJour = val;
                localStorage.setItem('heuresJour', heuresJour);
                if (heuresJourInput) heuresJourInput.value = heuresJour.toFixed(2);
                if (heuresJourHHMM) heuresJourHHMM.value = fractionToHHMM(heuresJour);
                // Recalculer tous les écarts
                jours = jours.map(jour => {
                    return {
                        ...jour,
                        ecart: calculerEcart(parseFloat(jour.heuresTravaillees), heuresJour)
                    };
                });
                localStorage.setItem('jours', JSON.stringify(jours));
                afficherJours();
            });
            // HH:MM -> Décimal
            safeAddEventListener('param-heures-jour-hhmm', 'input', function() {
                const val = hhmmToFraction(this.value);
                paramHeuresJour.value = val.toFixed(2);
                heuresJour = val;
                localStorage.setItem('heuresJour', heuresJour);
                if (heuresJourInput) heuresJourInput.value = heuresJour.toFixed(2);
                if (heuresJourHHMM) heuresJourHHMM.value = fractionToHHMM(heuresJour);
                // Recalculer tous les écarts
                jours = jours.map(jour => {
                    return {
                        ...jour,
                        ecart: calculerEcart(parseFloat(jour.heuresTravaillees), heuresJour)
                    };
                });
                localStorage.setItem('jours', JSON.stringify(jours));
                afficherJours();
            });
        }

        // Appliquer les changements en temps réel pour la pause offerte
        const paramPauseOfferte = document.getElementById('param-pause-offerte');
        if (paramPauseOfferte) {
            safeAddEventListener('param-pause-offerte', 'input', function() {
                const nouvelleValeur = parseInt(this.value) || 15;
                pauseOfferte = nouvelleValeur;
                localStorage.setItem('pauseOfferte', pauseOfferte);
                
                // Mettre à jour l'interface
                if (pauseOfferteInput) pauseOfferteInput.value = pauseOfferte;
                
                // Recalculer tous les écarts
                jours = jours.map(jour => {
                    return {
                        ...jour,
                        heuresTravaillees: parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pauseSupActive, jour.pause2Debut, jour.pause2Fin, jour.pause1Debut, jour.pause1Fin)),
                        ecart: calculerEcart(parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pauseSupActive, jour.pause2Debut, jour.pause2Fin, jour.pause1Debut, jour.pause1Fin)), heuresJour)
                    };
                });
                localStorage.setItem('jours', JSON.stringify(jours));
                
                // Mettre à jour l'affichage
                afficherJours();
                updateCalculateur();
            });
        }

        // Appliquer les changements en temps réel pour les heures supplémentaires
        const paramHeuresSupplementaires = document.getElementById('param-heures-supplementaires');
        if (paramHeuresSupplementaires) {
            safeAddEventListener('param-heures-supplementaires', 'input', function() {
                const nouvelleValeur = parseFloat(this.value) || 0;
                heuresSupplementaires = nouvelleValeur;
                localStorage.setItem('heuresSupplementaires', heuresSupplementaires);
                
                // Mettre à jour l'interface
                if (heuresSupplementairesInput) heuresSupplementairesInput.value = heuresSupplementaires;
                
                // Mettre à jour l'affichage
                afficherJours();
            });
        }

        // Appliquer les changements en temps réel pour les jours de travail
        Object.keys(joursTravail).forEach(jour => {
            const checkbox = document.getElementById(`param-jour-${jour}`);
            if (checkbox) {
                safeAddEventListener(`param-jour-${jour}`, 'change', function() {
                    joursTravail[jour] = this.checked;
                    localStorage.setItem('joursTravail', JSON.stringify(joursTravail));
                    
                    // Mettre à jour l'affichage
                    afficherJours();
                    majCalendrier();
                });
            }
        });
    }

    // --- Gestion du paramètre temps minimal pause midi ---
    let pauseMidiMin = parseInt(localStorage.getItem('pauseMidiMin')) || 30;
    const paramPauseMidiMin = document.getElementById('param-pause-midi-min');
    if (paramPauseMidiMin) {
        paramPauseMidiMin.value = pauseMidiMin;
        safeAddEventListener('param-pause-midi-min', 'input', function() {
            pauseMidiMin = parseInt(this.value) || 0;
            localStorage.setItem('pauseMidiMin', pauseMidiMin);
        });
    }
    window.getPauseMidiMin = function() { return pauseMidiMin; };

    // Ajout listeners modal suppression année (après chargement DOM)
    const confirmModalAnneeBg = document.getElementById('confirm-modal-annee-bg');
    const confirmAnneeOui = document.getElementById('confirm-annee-oui');
    const confirmAnneeNon = document.getElementById('confirm-annee-non');
    const btnSupprimerAnnee = document.getElementById('supprimer-annee');
    if (btnSupprimerAnnee && confirmModalAnneeBg && confirmAnneeOui && confirmAnneeNon) {
        btnSupprimerAnnee.addEventListener('click', function() {
            confirmModalAnneeBg.style.display = 'flex';
        });
        confirmAnneeNon.addEventListener('click', function() {
            confirmModalAnneeBg.style.display = 'none';
        });
        confirmAnneeOui.addEventListener('click', function() {
            // Supprime tous les jours de l'année affichée
            const anneeStr = String(currentYear);
            jours = jours.filter(jour => {
                const [y] = jour.date.split('-');
                return y !== anneeStr;
            });
            localStorage.setItem('jours', JSON.stringify(jours));
            
            // Supprime également tous les jours posés de l'année affichée
            joursVacances = joursVacances.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
            joursRTT = joursRTT.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
            joursRHT = joursRHT.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
            joursFeries = joursFeries.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
            joursRattrapes = joursRattrapes.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
            
            // Sauvegarde des jours posés mis à jour
            localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
            localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
            localStorage.setItem('joursRHT', JSON.stringify(joursRHT));
            localStorage.setItem('joursFeries', JSON.stringify(joursFeries));
            localStorage.setItem('joursRattrapes', JSON.stringify(joursRattrapes));
            
            // Rafraîchir l'affichage et mettre à jour les compteurs
            afficherJours();
            updateCompteursAbsences();
            majCalendrier();
            confirmModalAnneeBg.style.display = 'none';
        });
    }
});

// Sélecteur du pictogramme à côté de la pause midi dans la calculette
const midiIndication = document.getElementById('midi-indication');
function updateMidiIndication() {
    if (!midiIndication) return;
    const min = plageMidiMin;
    const max = plageMidiMax;
    let show = false;
    // Vérifie la saisie réelle dans la calculette
    const pauseDebut = calcPauseDebut && calcPauseDebut.value ? toMinutes(calcPauseDebut.value) : null;
    const pauseFin = calcPauseFin && calcPauseFin.value ? toMinutes(calcPauseFin.value) : null;
    if (pauseDebut !== null && (pauseDebut < min || pauseDebut > max)) show = true;
    if (pauseFin !== null && (pauseFin < min || pauseFin > max)) show = true;
    midiIndication.textContent = show ? '⚠️' : '';
}
safeAddEventListener('calc-pause-debut', 'input', updateMidiIndication);
safeAddEventListener('calc-pause-fin', 'input', updateMidiIndication);
updateMidiIndication(); 

['zero-arrivee','zero-depart','zero-pause-debut','zero-pause-fin','zero-pause1-debut','zero-pause1-fin','zero-pause-apres-debut','zero-pause-apres-fin','zero-pause-apres-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) formatHeureInput(el);
});

// Sauvegarde et restauration des valeurs du module 'zero'
const zeroPause1Debut = document.getElementById('zero-pause1-debut');
const zeroPause1Fin = document.getElementById('zero-pause1-fin');
const zeroPauseMidiDebut = document.getElementById('zero-pause-debut');
const zeroPauseMidiFin = document.getElementById('zero-pause-fin');
const zeroPauseApresDebutInput = document.getElementById('zero-pause-apres-debut');
const zeroPauseApresFinInput = document.getElementById('zero-pause-apres-fin');
const zeroPauseApresDureeInput = document.getElementById('zero-pause-apres-duree');

// Restauration à l'ouverture de la page
if (zeroPause1Debut && localStorage.getItem('zeroPause1Debut')) zeroPause1Debut.value = localStorage.getItem('zeroPause1Debut');
if (zeroPause1Fin && localStorage.getItem('zeroPause1Fin')) zeroPause1Fin.value = localStorage.getItem('zeroPause1Fin');
if (zeroPauseMidiDebut && localStorage.getItem('zeroPauseMidiDebut')) zeroPauseMidiDebut.value = localStorage.getItem('zeroPauseMidiDebut');
if (zeroPauseMidiFin && localStorage.getItem('zeroPauseMidiFin')) zeroPauseMidiFin.value = localStorage.getItem('zeroPauseMidiFin');
if (zeroPauseApresDebutInput && localStorage.getItem('zeroPauseApresDebut')) zeroPauseApresDebutInput.value = localStorage.getItem('zeroPauseApresDebut');
if (zeroPauseApresFinInput && localStorage.getItem('zeroPauseApresFin')) zeroPauseApresFinInput.value = localStorage.getItem('zeroPauseApresFin');
if (zeroPauseApresDureeInput && localStorage.getItem('zeroPauseApresDuree')) zeroPauseApresDureeInput.value = localStorage.getItem('zeroPauseApresDuree');

// Sauvegarde à chaque modification
if (zeroPause1Debut) safeAddEventListener('zero-pause1-debut', 'input', function() { localStorage.setItem('zeroPause1Debut', zeroPause1Debut.value); });
if (zeroPause1Fin) safeAddEventListener('zero-pause1-fin', 'input', function() { localStorage.setItem('zeroPause1Fin', zeroPause1Fin.value); });
if (zeroPauseMidiDebut) safeAddEventListener('zero-pause-debut', 'input', function() { localStorage.setItem('zeroPauseMidiDebut', zeroPauseMidiDebut.value); });
if (zeroPauseMidiFin) safeAddEventListener('zero-pause-fin', 'input', function() { localStorage.setItem('zeroPauseMidiFin', zeroPauseMidiFin.value); });
if (zeroPauseApresDebutInput) safeAddEventListener('zero-pause-apres-debut', 'input', function() { localStorage.setItem('zeroPauseApresDebut', zeroPauseApresDebutInput.value); });
if (zeroPauseApresFinInput) safeAddEventListener('zero-pause-apres-fin', 'input', function() { localStorage.setItem('zeroPauseApresFin', zeroPauseApresFinInput.value); });
if (zeroPauseApresDureeInput) safeAddEventListener('zero-pause-apres-duree', 'input', function() { localStorage.setItem('zeroPauseApresDuree', zeroPauseApresDureeInput.value); });

// --- Calcul dynamique des heures sup du module zero ---
function getZeroPauseApresMinutes() {
    const modeDuree = document.getElementById('zero-pause-apres-mode-duree');
    const dureeInput = document.getElementById('zero-pause-apres-duree');
    const debutInput = document.getElementById('zero-pause-apres-debut');
    const finInput = document.getElementById('zero-pause-apres-fin');
    
    if (modeDuree && modeDuree.checked) {
        const duree = dureeInput ? dureeInput.value : '';
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            return hh * 60 + mm;
        }
        return 0;
    }
    
    const debut = debutInput ? toMinutes(debutInput.value) : null;
    const fin = finInput ? toMinutes(finInput.value) : null;
    if (debut !== null && fin !== null && fin > debut) {
        return fin - debut;
    }
    return 0;
}

const zeroArrivee = document.getElementById('zero-arrivee');
const zeroDepart = document.getElementById('zero-depart');
const zeroHeuresSup = document.getElementById('zero-heures-sup');

function calculerHeuresSupZero() {
    // Récupération des valeurs
    const arrivee = zeroArrivee ? zeroArrivee.value : '';
    const depart = zeroDepart ? zeroDepart.value : '';
    // Pause matin
    let pause1DureeMin = null;
    if (document.getElementById('zero-pause1-mode-duree')?.checked) {
        const duree = document.getElementById('zero-pause1-duree')?.value;
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            pause1DureeMin = hh * 60 + mm;
        }
    } else {
        const pause1Debut = zeroPause1Debut ? zeroPause1Debut.value : '';
        const pause1Fin = zeroPause1Fin ? zeroPause1Fin.value : '';
        const toMinutes = (h) => {
            if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
            const [hh, mm] = h.split(':').map(Number);
            return hh * 60 + mm;
        };
        const debutMin = toMinutes(pause1Debut);
        const finMin = toMinutes(pause1Fin);
        if (debutMin !== null && finMin !== null && finMin >= debutMin) {
            pause1DureeMin = finMin - debutMin;
        }
    }
    // Pause midi
    let pauseMidiDureeMin = null;
    if (document.getElementById('zero-pause-midi-mode-duree')?.checked) {
        const duree = document.getElementById('zero-pause-midi-duree')?.value;
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            pauseMidiDureeMin = hh * 60 + mm;
        }
    } else {
        const pauseMidiDebut = zeroPauseMidiDebut ? zeroPauseMidiDebut.value : '';
        const pauseMidiFin = zeroPauseMidiFin ? zeroPauseMidiFin.value : '';
        const toMinutes = (h) => {
            if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
            const [hh, mm] = h.split(':').map(Number);
            return hh * 60 + mm;
        };
        const debutMin = toMinutes(pauseMidiDebut);
        const finMin = toMinutes(pauseMidiFin);
        if (debutMin !== null && finMin !== null && finMin >= debutMin) {
            pauseMidiDureeMin = finMin - debutMin;
        }
    }
    // Pause après-midi
    const pauseApresDureeMin = getZeroPauseApresMinutes();
    
    // Fonctions utilitaires
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    // Conversion
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    // Paramètres globaux / mode RHT
    const zeroRhtChecked = !!document.getElementById('zero-rht-mode')?.checked;
    let heuresJourMin;
    let pauseOfferteVal;
    let isRhtPhase1 = false;
    
    if (zeroRhtChecked) {
        // Vérifier si on est en RHT phase 1 (date actuelle)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        isRhtPhase1 = isDateInRHTPhase1(todayStr);
        
        if (isRhtPhase1) {
            // RHT phase 1 : utiliser les heures standard (pas de modification des horaires)
            const heuresJourInput = document.getElementById('heures-jour');
            const heuresJourVal = heuresJourInput ? parseFloat(heuresJourInput.value) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
            heuresJourMin = Math.round((isNaN(heuresJourVal) ? 7.5 : heuresJourVal) * 60);
            pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
        } else {
            // RHT phase 2 : utiliser les paramètres RHT
            const rhtDecStr = localStorage.getItem('rht_heures_dec');
            const rhtHeures = rhtDecStr ? parseFloat(rhtDecStr.replace(',', '.')) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
            heuresJourMin = Math.round((isNaN(rhtHeures) ? 7.5 : rhtHeures) * 60);
            const rhtPause = parseInt(localStorage.getItem('rht_pause_offerte'));
            pauseOfferteVal = !isNaN(rhtPause) ? rhtPause : (typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15);
        }
    } else {
        // Mode normal : utiliser les paramètres généraux
        const heuresJourInput = document.getElementById('heures-jour');
        const heuresJourVal = heuresJourInput ? parseFloat(heuresJourInput.value) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
        heuresJourMin = Math.round((isNaN(heuresJourVal) ? 7.5 : heuresJourVal) * 60);
        pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    }
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    // Calcul
    if (
        arriveeMin === null || departMin === null ||
        pauseMidiDureeMin === null || pause1DureeMin === null
    ) {
        zeroHeuresSup.textContent = '';
        return;
    }
    let dureeTravail = departMin - arriveeMin;
    // Pause midi : déduite seulement si pas en mode RHT
    if (!zeroRhtChecked) {
        let pauseMidi = pauseMidiDureeMin;
        if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
        dureeTravail -= pauseMidi;
    }
    // Total des pauses (matin + après-midi)
    const totalPauses = pause1DureeMin + pauseApresDureeMin;
    if (totalPauses > pauseOfferteVal) {
        dureeTravail -= (totalPauses - pauseOfferteVal);
    }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    

    
    // Conversion en HH:MM
    let totalMinutes = Math.round(heuresSup * 60);
    let signe = totalMinutes >= 0 ? '+' : '-';
    let absMinutes = Math.abs(totalMinutes);
    let hh = Math.floor(absMinutes / 60).toString().padStart(2, '0');
    let mm = (absMinutes % 60).toString().padStart(2, '0');
    let hhmm = `(${signe}${hh}:${mm})`;
    // Affichage des heures sup
    zeroHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h ' + hhmm;
    zeroHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
}

['zero-arrivee','zero-depart','zero-pause-debut','zero-pause-fin','zero-pause1-debut','zero-pause1-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) safeAddEventListener(id, 'input', calculerHeuresSupZero);
});
// Recalcul sur bascule RHT module 2
if (document.getElementById('zero-rht-mode')) {
    safeAddEventListener('zero-rht-mode', 'change', function() {
        calculerHeuresSupZero();
        updateZeroPlages(); // Mettre à jour la mise en forme des plages
    });
}
// Calcul initial au chargement
calculerHeuresSupZero();

// Ajout de l'affichage des heures sup dans le module calculette
const calcHeuresSup = document.createElement('span');
calcHeuresSup.id = 'calc-heures-sup';
calcHeuresSup.style.marginLeft = '8px';
calcHeuresSup.style.fontWeight = 'bold';
calcHeuresSup.style.color = '#1976d2';
const calcDepartInput = document.getElementById('calc-depart');
if (calcDepartInput && calcDepartInput.parentNode) {
    calcDepartInput.parentNode.appendChild(calcHeuresSup);
}

function calculerHeuresSupCalculette() {
    // Récupération des valeurs
    const arrivee = calcArrivee ? calcArrivee.value : '';
    const depart = calcDepart ? calcDepart.value : '';
    // Pause matin
    let pause1DureeMin = null;
    if (document.getElementById('calc-pause1-mode-duree')?.checked) {
        const duree = document.getElementById('calc-pause1-duree')?.value;
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            pause1DureeMin = hh * 60 + mm;
        }
    } else {
        const pause1Debut = calcPause1Debut ? calcPause1Debut.value : '';
        const pause1Fin = calcPause1Fin ? calcPause1Fin.value : '';
        const toMinutes = (h) => {
            if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
            const [hh, mm] = h.split(':').map(Number);
            return hh * 60 + mm;
        };
        const debutMin = toMinutes(pause1Debut);
        const finMin = toMinutes(pause1Fin);
        if (debutMin !== null && finMin !== null && finMin >= debutMin) {
            pause1DureeMin = finMin - debutMin;
        }
    }
    // Pause midi
    let pauseMidiDureeMin = null;
    if (document.getElementById('calc-pause-midi-mode-duree')?.checked) {
        const duree = document.getElementById('calc-pause-midi-duree')?.value;
        if (/^\d{2}:\d{2}$/.test(duree)) {
            const [hh, mm] = duree.split(':').map(Number);
            pauseMidiDureeMin = hh * 60 + mm;
        }
    } else {
        const pauseMidiDebut = calcPauseDebut ? calcPauseDebut.value : '';
        const pauseMidiFin = calcPauseFin ? calcPauseFin.value : '';
        const toMinutes = (h) => {
            if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
            const [hh, mm] = h.split(':').map(Number);
            return hh * 60 + mm;
        };
        const debutMin = toMinutes(pauseMidiDebut);
        const finMin = toMinutes(pauseMidiFin);
        if (debutMin !== null && finMin !== null && finMin >= debutMin) {
            pauseMidiDureeMin = finMin - debutMin;
        }
    }
    // Fonctions utilitaires
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    // Conversion
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    // Paramètres globaux / mode RHT
    const calcRhtChecked = !!document.getElementById('calc-rht-mode')?.checked;
    let heuresJourMin;
    let pauseOfferteVal;
    let isRhtPhase1 = false;
    
    if (calcRhtChecked) {
        // Vérifier si on est en RHT phase 1 (date actuelle)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        isRhtPhase1 = isDateInRHTPhase1(todayStr);
        
        if (isRhtPhase1) {
            // RHT phase 1 : utiliser les heures standard (pas de modification des horaires)
            const heuresJourInput = document.getElementById('heures-jour');
            const heuresJourVal = heuresJourInput ? parseFloat(heuresJourInput.value) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
            heuresJourMin = Math.round((isNaN(heuresJourVal) ? 7.5 : heuresJourVal) * 60);
            pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
        } else {
            // RHT phase 2 : utiliser les paramètres RHT
            const rhtDecStr = localStorage.getItem('rht_heures_dec');
            const rhtHeures = rhtDecStr ? parseFloat(rhtDecStr.replace(',', '.')) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
            heuresJourMin = Math.round((isNaN(rhtHeures) ? 7.5 : rhtHeures) * 60);
            const rhtPause = parseInt(localStorage.getItem('rht_pause_offerte'));
            pauseOfferteVal = !isNaN(rhtPause) ? rhtPause : (typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15);
        }
    } else {
        // Mode normal : utiliser les paramètres généraux
        const heuresJourInput = document.getElementById('heures-jour');
        const heuresJourVal = heuresJourInput ? parseFloat(heuresJourInput.value) : (parseFloat(localStorage.getItem('heuresJour')) || 7.5);
        heuresJourMin = Math.round((isNaN(heuresJourVal) ? 7.5 : heuresJourVal) * 60);
        pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    }
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    // Calcul
    if (
        arriveeMin === null || departMin === null ||
        pauseMidiDureeMin === null || pause1DureeMin === null
    ) {
        calcHeuresSup.textContent = '';
        return;
    }
    let dureeTravail = departMin - arriveeMin;
    // Pause midi : déduite seulement si pas en mode RHT
    if (!calcRhtChecked) {
        let pauseMidi = pauseMidiDureeMin;
        if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
        dureeTravail -= pauseMidi;
    }
    // Total des pauses (matin + pauses supplémentaires incluant après-midi)
    // Note: pauseSup inclut déjà pause2 + pause après-midi via getPauseSupMinutes()
    const pauseSup = getPauseSupMinutes();
    const totalPauses = pause1DureeMin + pauseSup;
    if (totalPauses > pauseOfferteVal) {
        dureeTravail -= (totalPauses - pauseOfferteVal);
    }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    
    // Debug: afficher les valeurs pour comprendre le calcul
    console.log('=== DEBUG Module 1 Delta ===');
    console.log('Mode RHT activé:', calcRhtChecked);
    console.log('Arrivée:', arrivee, '(', arriveeMin, 'min)');
    console.log('Départ:', depart, '(', departMin, 'min)');
    console.log('Durée brute:', departMin - arriveeMin, 'min');
    console.log('Pause midi saisie:', pauseMidiDureeMin, 'min');
    console.log('Pause midi appliquée:', calcRhtChecked ? '0 (mode RHT)' : pauseMidiDureeMin, 'min');
    console.log('Pause matin:', pause1DureeMin, 'min');
    console.log('Pause sup (pause2 + après-midi):', pauseSup, 'min');
    console.log('Total pauses (matin + sup):', totalPauses, 'min');
    console.log('Pause offerte:', pauseOfferteVal, 'min');
    console.log('Durée travail après pauses:', dureeTravail, 'min');
    console.log('Heures à faire (RHT:', calcRhtChecked, '):', heuresJourMin/60, 'h (', heuresJourMin, 'min)');
    console.log('Heures sup calculées:', heuresSup, 'h');
    console.log('localStorage rht_heures_dec:', localStorage.getItem('rht_heures_dec'));
    console.log('localStorage rht_pause_offerte:', localStorage.getItem('rht_pause_offerte'));
    console.log('======================');
    
    // Affichage des heures sup
    calcHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h';
    calcHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
}

['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause1-debut','calc-pause1-fin','calc-pause-apres-debut','calc-pause-apres-fin','calc-pause-apres-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) safeAddEventListener(id, 'input', calculerHeuresSupCalculette);
});
// Recalcul sur bascule RHT module 1
if (document.getElementById('calc-rht-mode')) {
    safeAddEventListener('calc-rht-mode', 'change', calculerHeuresSupCalculette);
}
// Calcul initial au chargement
calculerHeuresSupCalculette(); 

// --- Sauvegarde/restauration automatique des champs de la calculette ---
const calcFields = [
    'calc-arrivee', 'calc-depart',
    'calc-pause-debut', 'calc-pause-fin',
    'calc-pause1-debut', 'calc-pause1-fin',
    'calc-pause2-debut', 'calc-pause2-fin',
    'calc-pause-apres-debut', 'calc-pause-apres-fin',
    'calc-pause-apres-duree'
];
calcFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // Restauration
        const val = localStorage.getItem('calculette_' + id);
        if (val) el.value = val;
        // Sauvegarde à chaque modification et à la perte de focus (pour avoir la valeur formatée)
        el.addEventListener('input', function() {
            localStorage.setItem('calculette_' + id, el.value);
        });
        el.addEventListener('blur', function() {
            localStorage.setItem('calculette_' + id, el.value);
        });
    }
});
// --- Sauvegarde/restauration automatique des champs du module zero ---
const zeroFields = [
    'zero-arrivee', 'zero-depart',
    'zero-pause-debut', 'zero-pause-fin',
    'zero-pause1-debut', 'zero-pause1-fin',
    'zero-pause-apres-debut', 'zero-pause-apres-fin',
    'zero-pause-apres-duree'
];
zeroFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // Restauration
        const val = localStorage.getItem('zero_' + id);
        if (val) el.value = val;
        // Sauvegarde à chaque modification et à la perte de focus (pour avoir la valeur formatée)
        el.addEventListener('input', function() {
            localStorage.setItem('zero_' + id, el.value);
        });
        el.addEventListener('blur', function() {
            localStorage.setItem('zero_' + id, el.value);
        });
    }
});

// Patch updateCalculateur pour sauvegarder la valeur calculée de calc-depart et calc-arrivee
const oldUpdateCalculateur = updateCalculateur;
updateCalculateur = function() {
    oldUpdateCalculateur();
    // Sauvegarde automatique des valeurs calculées
    if (calcArrivee) {
        localStorage.setItem('calculette_calc-arrivee', calcArrivee.value);
    }
    if (calcDepart) {
        localStorage.setItem('calculette_calc-depart', calcDepart.value);
    }
};

['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause2-debut','calc-pause2-fin','calc-pause1-debut','calc-pause1-fin','calc-pause-apres-debut','calc-pause-apres-fin','calc-pause-apres-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        safeAddEventListener(id, 'blur', function() {
            lastInput = el.id;
            updateCalculateur();
        });
    }
});

function checkPlageZero(input, mins, min, max) {
    if (mins === null || isNaN(mins)) {
        input.style.background = '';
        return;
    }
    if (mins < min || mins > max) {
        input.style.background = '#ffcccc';
    } else {
        input.style.background = '';
    }
}
function updateZeroPlages() {
    const zeroArrivee = document.getElementById('zero-arrivee');
    const zeroDepart = document.getElementById('zero-depart');
    if (!zeroArrivee || !zeroDepart) return;
    
    // Vérifier si le mode RHT est activé
    const zeroRhtChecked = !!document.getElementById('zero-rht-mode')?.checked;
    
    // Utiliser les plages RHT ou générales selon le mode
    const arriveeMin = zeroRhtChecked ? rhtPlageArriveeMin : plageArriveeMin;
    const arriveeMax = zeroRhtChecked ? rhtPlageArriveeMax : plageArriveeMax;
    const departMin = zeroRhtChecked ? rhtPlageDepartMin : plageDepartMin;
    const departMax = zeroRhtChecked ? rhtPlageDepartMax : plageDepartMax;
    
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    const arriveeMins = toMinutes(zeroArrivee.value);
    const departMins = toMinutes(zeroDepart.value);
    checkPlageZero(zeroArrivee, arriveeMins, arriveeMin, arriveeMax);
    checkPlageZero(zeroDepart, departMins, departMin, departMax);
}
['zero-arrivee','zero-depart'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        safeAddEventListener(id, 'input', updateZeroPlages);
        safeAddEventListener(id, 'blur', updateZeroPlages);
    }
});
// Appel initial
updateZeroPlages();

// --- Module 3 : calculette pause ---
function formatHeureInputPause3(input) {
    input.addEventListener('input', function(e) {
        let v = input.value.replace(/[^0-9]/g, '');
        if (v.length > 4) v = v.slice(0,4);
        if (v.length >= 3) {
            input.value = v.slice(0,2) + ':' + v.slice(2,4);
        } else if (v.length >= 1) {
            input.value = v;
        }
    });
    input.addEventListener('blur', function() {
        let v = input.value.replace(/[^0-9]/g, '');
        if (v.length === 1) v = '0' + v;
        if (v.length === 3) v = '0' + v;
        if (v.length === 4) {
            let h = v.slice(0,2);
            let m = v.slice(2,4);
            let hNum = parseInt(h, 10);
            let mNum = parseInt(m, 10);
            if (isNaN(hNum) || isNaN(mNum) || hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) {
                input.value = '';
                input.style.background = '#ffcccc';
            } else {
                input.value = h.padStart(2, '0') + ':' + m.padStart(2, '0');
                input.style.background = '';
            }
        } else if (v.length === 2) {
            let hNum = parseInt(v, 10);
            if (isNaN(hNum) || hNum < 0 || hNum > 23) {
                input.value = '';
                input.style.background = '#ffcccc';
            } else {
                input.value = v.padStart(2, '0') + ':00';
                input.style.background = '';
            }
        } else {
            input.value = '';
            input.style.background = '#ffcccc';
        }
        updatePause3Total();
    });
}
function toMinutesPause3(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function updatePause3Total() {
    const lignes = document.querySelectorAll('#pause3-lignes .pause3-ligne');
    let total = 0;
    lignes.forEach(ligne => {
        const debut = ligne.querySelector('.pause3-debut').value;
        const fin = ligne.querySelector('.pause3-fin').value;
        const debutMin = toMinutesPause3(debut);
        const finMin = toMinutesPause3(fin);
        if (debutMin !== null && finMin !== null && finMin > debutMin) {
            total += (finMin - debutMin);
        }
    });
    
    // Affichage total minutes + heures
    const totalHeures = (total / 60).toFixed(2);
    
    // Vérifier si le mode RHT est activé
    const pause3RhtChecked = !!document.getElementById('pause3-rht-mode')?.checked;
    
    // Déterminer la pause offerte selon le mode
    let pauseOfferteVal;
    if (pause3RhtChecked) {
        // Mode RHT : utiliser les paramètres RHT du modal
        const rhtEnabled = localStorage.getItem('rht_enabled') === 'true';
        if (rhtEnabled) {
            const rhtPauseOfferte = parseInt(localStorage.getItem('rht_pause_offerte'));
            pauseOfferteVal = !isNaN(rhtPauseOfferte) ? rhtPauseOfferte : 0;
        } else {
            pauseOfferteVal = 0; // Par défaut 0 en mode RHT si pas configuré
        }
    } else {
        // Mode normal : utiliser la pause offerte standard
        pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    }
    
    let supp = total - pauseOfferteVal;
    let suppAff = '';
    if (supp !== 0) {
        suppAff = ` | <span id='pause3-supp-aff'>${supp > 0 ? '+' : ''}${supp} min (${(supp/60).toFixed(2)} h)</span>`;
    } else {
        suppAff = ` | <span id='pause3-supp-aff'>0 min (0.00 h)</span>`;
    }
    
    document.getElementById('pause3-total').innerHTML = `${total} min (${totalHeures} h)${suppAff}`;
    
    // Coloration dynamique
    const suppSpan = document.getElementById('pause3-supp-aff');
    if (suppSpan) {
        if (supp < 0) {
            suppSpan.style.color = 'green';
        } else if (supp > 0) {
            suppSpan.style.color = 'red';
        } else {
            suppSpan.style.color = 'black';
        }
    }
    
    // Renumérote les labels
    document.querySelectorAll('#pause3-lignes .pause3-ligne').forEach((l, i) => {
        l.querySelector('span').textContent = (i+1).toString();
    });
}
function addPause3Ligne(nom) {
    const lignesDiv = document.getElementById('pause3-lignes');
    const idx = lignesDiv.querySelectorAll('.pause3-ligne').length + 1;
    const div = document.createElement('div');
    div.className = 'pause3-ligne';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '10px';
    div.style.marginBottom = '6px';
    div.innerHTML = `<span>pause${idx}</span>
        <input type="text" class="pause3-debut" placeholder="Début" style="width:60px;" inputmode="numeric" autocomplete="off">
        <span>à</span>
        <input type="text" class="pause3-fin" placeholder="Fin" style="width:60px;" inputmode="numeric" autocomplete="off">
        <button type="button" class="pause3-add" style="margin-left:8px; font-size:1.2em;">+</button>
        <button type="button" class="pause3-del" style="margin-left:4px; font-size:1.2em;">🗑️</button>`;
    lignesDiv.appendChild(div);
    const debut = div.querySelector('.pause3-debut');
    const fin = div.querySelector('.pause3-fin');
    formatHeureInputPause3(debut);
    formatHeureInputPause3(fin);
    debut.addEventListener('input', updatePause3Total);
    fin.addEventListener('input', updatePause3Total);
    debut.addEventListener('blur', updatePause3Total);
    fin.addEventListener('blur', updatePause3Total);
    // Ajout direct des listeners sur les boutons dynamiques
    div.querySelector('.pause3-add').addEventListener('click', function() {
        addPause3Ligne();
        updatePause3Total();
    });
    div.querySelector('.pause3-del').addEventListener('click', function() {
        div.remove();
        updatePause3Total();
    });
}
// Correction de l'initialisation du module 3 (première ligne)
(function() {
    const debut = document.querySelector('#pause3-lignes .pause3-debut');
    const fin = document.querySelector('#pause3-lignes .pause3-fin');
    formatHeureInputPause3(debut);
    formatHeureInputPause3(fin);
    debut.addEventListener('input', updatePause3Total);
    fin.addEventListener('input', updatePause3Total);
    debut.addEventListener('blur', updatePause3Total);
    fin.addEventListener('blur', updatePause3Total);
    // Ajout direct du listener sur le bouton + de la première ligne
    document.querySelector('#pause3-lignes .pause3-add').addEventListener('click', function() {
        addPause3Ligne();
        updatePause3Total();
    });
    document.getElementById('pause3-reset').addEventListener('click', function() {
        const lignesDiv = document.getElementById('pause3-lignes');
        lignesDiv.innerHTML = '';
        // Ajoute la première ligne
        const div = document.createElement('div');
        div.className = 'pause3-ligne';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.style.marginBottom = '6px';
        div.innerHTML = `<span>pause1</span>
            <input type="text" class="pause3-debut" placeholder="Début" style="width:60px;" inputmode="numeric" autocomplete="off">
            <span>à</span>
            <input type="text" class="pause3-fin" placeholder="Fin" style="width:60px;" inputmode="numeric" autocomplete="off">
            <button type="button" class="pause3-add" style="margin-left:8px; font-size:1.2em;">+</button>`;
        lignesDiv.appendChild(div);
        const debut = div.querySelector('.pause3-debut');
        const fin = div.querySelector('.pause3-fin');
        formatHeureInputPause3(debut);
        formatHeureInputPause3(fin);
        debut.addEventListener('input', updatePause3Total);
        fin.addEventListener('input', updatePause3Total);
        debut.addEventListener('blur', updatePause3Total);
        fin.addEventListener('blur', updatePause3Total);
        div.querySelector('.pause3-add').addEventListener('click', function() {
            addPause3Ligne();
            updatePause3Total();
        });
        updatePause3Total();
    });
    updatePause3Total();
})();

// Suppression du gestionnaire en double - le gestionnaire principal est dans DOMContentLoaded

// Ajout de la synchronisation automatique des champs durée pour les pauses matin et midi du module 2
function updateZeroPauseDurees() {
    // Pause matin
    const debut1 = document.getElementById('zero-pause1-debut');
    const fin1 = document.getElementById('zero-pause1-fin');
    const duree1 = document.getElementById('zero-pause1-duree');
    if (debut1 && fin1 && duree1) {
        if (/^\d{2}:\d{2}$/.test(debut1.value) && /^\d{2}:\d{2}$/.test(fin1.value)) {
            const [h1, m1] = debut1.value.split(':').map(Number);
            const [h2, m2] = fin1.value.split(':').map(Number);
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            let diff = min2 - min1;
            if (diff >= 0) {
                let hh = Math.floor(diff / 60).toString().padStart(2, '0');
                let mm = (diff % 60).toString().padStart(2, '0');
                duree1.value = hh + ':' + mm;
            } else {
                duree1.value = '';
            }
        } else {
            duree1.value = '';
        }
    }
    // Pause midi
    const debutMidi = document.getElementById('zero-pause-debut');
    const finMidi = document.getElementById('zero-pause-fin');
    const dureeMidi = document.getElementById('zero-pause-midi-duree');
    if (debutMidi && finMidi && dureeMidi) {
        if (/^\d{2}:\d{2}$/.test(debutMidi.value) && /^\d{2}:\d{2}$/.test(finMidi.value)) {
            const [h1, m1] = debutMidi.value.split(':').map(Number);
            const [h2, m2] = finMidi.value.split(':').map(Number);
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            let diff = min2 - min1;
            if (diff >= 0) {
                let hh = Math.floor(diff / 60).toString().padStart(2, '0');
                let mm = (diff % 60).toString().padStart(2, '0');
                dureeMidi.value = hh + ':' + mm;
            } else {
                dureeMidi.value = '';
            }
        } else {
            dureeMidi.value = '';
        }
    }
}
['zero-pause1-debut','zero-pause1-fin','zero-pause-debut','zero-pause-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) safeAddEventListener(id, 'input', updateZeroPauseDurees);
});
// Appliquer la mise en forme automatique aux champs de durée du module 2
['zero-pause1-duree', 'zero-pause-midi-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        formatHeureInputPause3(el);
        safeAddEventListener(id, 'input', function() {
            // Sauvegarde en localStorage
            localStorage.setItem('zero_' + id, el.value);
            // Calcul seulement si le mode durée est actif
            if (
                (id === 'zero-pause1-duree' && document.getElementById('zero-pause1-mode-duree')?.checked) ||
                (id === 'zero-pause-midi-duree' && document.getElementById('zero-pause-midi-mode-duree')?.checked)
            ) {
                calculerHeuresSupZero();
            }
        });
        // Restauration
        const val = localStorage.getItem('zero_' + id);
        if (val) el.value = val;
    }
});

// Gestion de l'affichage des modes de saisie pause matin (début/fin ou durée)
const zeroPause1ModeDebutFin = document.getElementById('zero-pause1-mode-debutfin');
const zeroPause1ModeDuree = document.getElementById('zero-pause1-mode-duree');
const zeroPause1DebutFinFields = document.getElementById('zero-pause1-debutfin-fields');
const zeroPause1DureeField = document.getElementById('zero-pause1-duree-field');
if (zeroPause1ModeDebutFin && zeroPause1ModeDuree && zeroPause1DebutFinFields && zeroPause1DureeField) {
    zeroPause1ModeDebutFin.addEventListener('change', function() {
        if (zeroPause1ModeDebutFin.checked) {
            zeroPause1DebutFinFields.style.display = 'flex';
            zeroPause1DureeField.style.display = 'none';
        }
    });
    zeroPause1ModeDuree.addEventListener('change', function() {
        if (zeroPause1ModeDuree.checked) {
            zeroPause1DebutFinFields.style.display = 'none';
            zeroPause1DureeField.style.display = 'flex';
        }
    });
}
// Gestion de l'affichage des modes de saisie pause midi (début/fin ou durée)
const zeroPauseMidiModeDebutFin = document.getElementById('zero-pause-midi-mode-debutfin');
const zeroPauseMidiModeDuree = document.getElementById('zero-pause-midi-mode-duree');
const zeroPauseMidiDebutFinFields = document.getElementById('zero-pause-midi-debutfin-fields');
const zeroPauseMidiDureeField = document.getElementById('zero-pause-midi-duree-field');
if (zeroPauseMidiModeDebutFin && zeroPauseMidiModeDuree && zeroPauseMidiDebutFinFields && zeroPauseMidiDureeField) {
    zeroPauseMidiModeDebutFin.addEventListener('change', function() {
        if (zeroPauseMidiModeDebutFin.checked) {
            zeroPauseMidiDebutFinFields.style.display = 'flex';
            zeroPauseMidiDureeField.style.display = 'none';
        }
    });
    zeroPauseMidiModeDuree.addEventListener('change', function() {
        if (zeroPauseMidiModeDuree.checked) {
            zeroPauseMidiDebutFinFields.style.display = 'none';
            zeroPauseMidiDureeField.style.display = 'flex';
        }
    });
}

// Gestion de l'affichage des modes de saisie pause après-midi (début/fin ou durée) pour le module 2
const zeroPauseApresModeDebutFin = document.getElementById('zero-pause-apres-mode-debutfin');
const zeroPauseApresModeDuree = document.getElementById('zero-pause-apres-mode-duree');
const zeroPauseApresDebutFinFields = document.getElementById('zero-pause-apres-debutfin-fields');
const zeroPauseApresDureeField = document.getElementById('zero-pause-apres-duree-field');
if (zeroPauseApresModeDebutFin && zeroPauseApresModeDuree && zeroPauseApresDebutFinFields && zeroPauseApresDureeField) {
    zeroPauseApresModeDebutFin.addEventListener('change', function() {
        if (zeroPauseApresModeDebutFin.checked) {
            zeroPauseApresDebutFinFields.style.display = 'flex';
            zeroPauseApresDureeField.style.display = 'none';
        }
    });
    zeroPauseApresModeDuree.addEventListener('change', function() {
        if (zeroPauseApresModeDuree.checked) {
            zeroPauseApresDebutFinFields.style.display = 'none';
            zeroPauseApresDureeField.style.display = 'flex';
        }
    });
}

// ... existing code ...
// Gestion de l'affichage des modes de saisie pause matin (début/fin ou durée) pour le module 1
const calcPause1ModeDebutFin = document.getElementById('calc-pause1-mode-debutfin');
const calcPause1ModeDuree = document.getElementById('calc-pause1-mode-duree');
const calcPause1DebutFinFields = document.getElementById('calc-pause1-debutfin-fields');
const calcPause1DureeField = document.getElementById('calc-pause1-duree-field');
if (calcPause1ModeDebutFin && calcPause1ModeDuree && calcPause1DebutFinFields && calcPause1DureeField) {
    calcPause1ModeDebutFin.addEventListener('change', function() {
        if (calcPause1ModeDebutFin.checked) {
            calcPause1DebutFinFields.style.display = 'flex';
            calcPause1DureeField.style.display = 'none';
        }
    });
    calcPause1ModeDuree.addEventListener('change', function() {
        if (calcPause1ModeDuree.checked) {
            calcPause1DebutFinFields.style.display = 'none';
            calcPause1DureeField.style.display = 'flex';
        }
    });
}
// Gestion de l'affichage des modes de saisie pause midi (début/fin ou durée) pour le module 1
const calcPauseMidiModeDebutFin = document.getElementById('calc-pause-midi-mode-debutfin');
const calcPauseMidiModeDuree = document.getElementById('calc-pause-midi-mode-duree');
const calcPauseMidiDebutFinFields = document.getElementById('calc-pause-midi-debutfin-fields');
const calcPauseMidiDureeField = document.getElementById('calc-pause-midi-duree-field');
if (calcPauseMidiModeDebutFin && calcPauseMidiModeDuree && calcPauseMidiDebutFinFields && calcPauseMidiDureeField) {
    calcPauseMidiModeDebutFin.addEventListener('change', function() {
        if (calcPauseMidiModeDebutFin.checked) {
            calcPauseMidiDebutFinFields.style.display = 'flex';
            calcPauseMidiDureeField.style.display = 'none';
        }
    });
    calcPauseMidiModeDuree.addEventListener('change', function() {
        if (calcPauseMidiModeDuree.checked) {
            calcPauseMidiDebutFinFields.style.display = 'none';
            calcPauseMidiDureeField.style.display = 'flex';
        }
    });
}

// Gestion de l'affichage des modes de saisie pause après-midi (début/fin ou durée) pour le module 1
const calcPauseApresModeDebutFin = document.getElementById('calc-pause-apres-mode-debutfin');
const calcPauseApresModeDuree = document.getElementById('calc-pause-apres-mode-duree');
const calcPauseApresDebutFinFields = document.getElementById('calc-pause-apres-debutfin-fields');
const calcPauseApresDureeField = document.getElementById('calc-pause-apres-duree-field');
if (calcPauseApresModeDebutFin && calcPauseApresModeDuree && calcPauseApresDebutFinFields && calcPauseApresDureeField) {
    calcPauseApresModeDebutFin.addEventListener('change', function() {
        if (calcPauseApresModeDebutFin.checked) {
            calcPauseApresDebutFinFields.style.display = 'flex';
            calcPauseApresDureeField.style.display = 'none';
        }
    });
    calcPauseApresModeDuree.addEventListener('change', function() {
        if (calcPauseApresModeDuree.checked) {
            calcPauseApresDebutFinFields.style.display = 'none';
            calcPauseApresDureeField.style.display = 'flex';
        }
    });
}
// ... existing code ...

// ... existing code ...
// Appliquer la mise en forme automatique et la sauvegarde/restauration aux champs durée du module 1
['calc-pause1-duree', 'calc-pause-midi-duree', 'calc-pause-apres-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        formatHeureInputPause3(el);
        safeAddEventListener(id, 'input', function() {
            localStorage.setItem('calculette_' + id, el.value);
            if (
                (id === 'calc-pause1-duree' && document.getElementById('calc-pause1-mode-duree')?.checked) ||
                (id === 'calc-pause-midi-duree' && document.getElementById('calc-pause-midi-mode-duree')?.checked) ||
                (id === 'calc-pause-apres-duree' && document.getElementById('calc-pause-apres-mode-duree')?.checked)
            ) {
                calculerHeuresSupCalculette();
                updateCalculateur();
            }
        });
        // Restauration
        const val = localStorage.getItem('calculette_' + id);
        if (val) el.value = val;
    }
});
// Synchronisation automatique du champ durée si début/fin sont renseignés (module 1)
function updateCalcPauseDurees() {
    // Pause matin
    const debut1 = document.getElementById('calc-pause1-debut');
    const fin1 = document.getElementById('calc-pause1-fin');
    const duree1 = document.getElementById('calc-pause1-duree');
    if (debut1 && fin1 && duree1) {
        if (/^\d{2}:\d{2}$/.test(debut1.value) && /^\d{2}:\d{2}$/.test(fin1.value)) {
            const [h1, m1] = debut1.value.split(':').map(Number);
            const [h2, m2] = fin1.value.split(':').map(Number);
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            let diff = min2 - min1;
            if (diff >= 0) {
                let hh = Math.floor(diff / 60).toString().padStart(2, '0');
                let mm = (diff % 60).toString().padStart(2, '0');
                duree1.value = hh + ':' + mm;
            } else {
                duree1.value = '';
            }
        } else {
            duree1.value = '';
        }
    }
    // Pause midi
    const debutMidi = document.getElementById('calc-pause-debut');
    const finMidi = document.getElementById('calc-pause-fin');
    const dureeMidi = document.getElementById('calc-pause-midi-duree');
    if (debutMidi && finMidi && dureeMidi) {
        if (/^\d{2}:\d{2}$/.test(debutMidi.value) && /^\d{2}:\d{2}$/.test(finMidi.value)) {
            const [h1, m1] = debutMidi.value.split(':').map(Number);
            const [h2, m2] = finMidi.value.split(':').map(Number);
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            let diff = min2 - min1;
            if (diff >= 0) {
                let hh = Math.floor(diff / 60).toString().padStart(2, '0');
                let mm = (diff % 60).toString().padStart(2, '0');
                dureeMidi.value = hh + ':' + mm;
            } else {
                dureeMidi.value = '';
            }
        } else {
            dureeMidi.value = '';
        }
    }
    // Pause après-midi
    const debutApres = document.getElementById('calc-pause-apres-debut');
    const finApres = document.getElementById('calc-pause-apres-fin');
    const dureeApres = document.getElementById('calc-pause-apres-duree');
    if (debutApres && finApres && dureeApres) {
        if (/^\d{2}:\d{2}$/.test(debutApres.value) && /^\d{2}:\d{2}$/.test(finApres.value)) {
            const [h1, m1] = debutApres.value.split(':').map(Number);
            const [h2, m2] = finApres.value.split(':').map(Number);
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            let diff = min2 - min1;
            if (diff >= 0) {
                let hh = Math.floor(diff / 60).toString().padStart(2, '0');
                let mm = (diff % 60).toString().padStart(2, '0');
                dureeApres.value = hh + ':' + mm;
            } else {
                dureeApres.value = '';
            }
        } else {
            dureeApres.value = '';
        }
    }
}
['calc-pause1-debut','calc-pause1-fin','calc-pause-debut','calc-pause-fin','calc-pause-apres-debut','calc-pause-apres-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) safeAddEventListener(id, 'input', updateCalcPauseDurees);
});
// FONCTION SUPPRIMÉE - Dupliquée et incorrecte, utilise la première définition plus haut
// function calculerHeuresSupCalculette() {
    // Récupération des valeurs
    // const arrivee = calcArrivee ? calcArrivee.value : '';
    // const depart = calcDepart ? calcDepart.value : '';
    // Pause matin
    // let pause1DureeMin = null;
    // if (document.getElementById('calc-pause1-mode-duree')?.checked) {
    //     const duree = document.getElementById('calc-pause1-duree')?.value;
    //     if (/^\d{2}:\d{2}$/.test(duree)) {
    //         const [hh, mm] = duree.split(':').map(Number);
    //         pause1DureeMin = hh * 60 + mm;
    //     }
    // } else {
    //     const pause1Debut = calcPause1Debut ? calcPause1Debut.value : '';
    //     const pause1Fin = calcPause1Fin ? calcPause1Fin.value : '';
    //     const toMinutes = (h) => {
    //         if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
    //         const [hh, mm] = h.split(':').map(Number);
    //         return hh * 60 + mm;
    //     };
    //     const debutMin = toMinutes(pause1Debut);
    //     const finMin = toMinutes(pause1Fin);
    //     if (debutMin !== null && finMin !== null && finMin >= debutMin) {
    //         pause1DureeMin = finMin - debutMin;
    //     }
    // }
    // Pause midi
    // let pauseMidiDureeMin = null;
    // if (document.getElementById('calc-pause-midi-mode-duree')?.checked) {
    //     const duree = document.getElementById('calc-pause-midi-duree')?.value;
    //     if (/^\d{2}:\d{2}$/.test(duree)) {
    //         const [hh, mm] = duree.split(':').map(Number);
    //         pauseMidiDureeMin = hh * 60 + mm;
    //     }
    // } else {
    //     const pauseMidiDebut = calcPauseDebut ? calcPauseDebut.value : '';
    //     const pauseMidiFin = calcPauseFin ? calcPauseFin.value : '';
    //     const toMinutes = (h) => {
    //         if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
    //         const [hh, mm] = h.split(':').map(Number);
    //         return hh * 60 + mm;
    //     };
    //     const debutMin = toMinutes(pauseMidiDebut);
    //     const finMin = toMinutes(pauseMidiFin);
    //     if (debutMin !== null && finMin !== null && finMin >= debutMin) {
    //         pauseMidiDureeMin = finMin - debutMin;
    //     }
    // }
    // Fonctions utilitaires
    // const toMinutes = (h) => {
    //     if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
    //     const [hh, mm] = h.split(':').map(Number);
    //     return hh * 60 + mm;
    // };
    // Conversion
    // const arriveeMin = toMinutes(arrivee);
    // const departMin = toMinutes(depart);
    // Paramètres globaux
    // let heuresJourMin = getHeuresJourMinutes ? getHeuresJourMinutes() : 450; // fallback 7h30
    // let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    // let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    // Calcul
    // if (
    //     arriveeMin === null || departMin === null ||
    //     pauseMidiDureeMin === null || pause1DureeMin === null
    // ) {
    //     calcHeuresSup.textContent = '';
    //     return;
    // }
    // let dureeTravail = departMin - arriveeMin;
    // Pause midi (toujours déduite, au moins le minimum)
    // let pauseMidi = pauseMidiDureeMin;
    // if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
    // dureeTravail -= pauseMidi;
    // Pause matin : seul l'excédent > pause offerte est déduit
    // let pauseMatin = pause1DureeMin;
    // if (pauseMatin > pauseOfferteVal) {
    //     dureeTravail -= (pauseMatin - pauseOfferteVal);
    // }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    // let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    // calcHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h';
    // calcHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
// }
// ... existing code ...

// ... existing code ...
// 1. Appliquer la mise en forme automatique à tous les champs horaires (y compris dynamiques)
function applyFormatHeureInputToAll() {
    // Module 1
    ['calc-arrivee','calc-depart','calc-pause1-debut','calc-pause1-fin','calc-pause1-duree','calc-pause-debut','calc-pause-fin','calc-pause-midi-duree','calc-pause-apres-debut','calc-pause-apres-fin','calc-pause-apres-duree'].forEach(id => {
        const el = document.getElementById(id);
        if (el) formatHeureInputPause3(el);
    });
    // Module 2
    ['zero-arrivee','zero-depart','zero-pause1-debut','zero-pause1-fin','zero-pause1-duree','zero-pause-debut','zero-pause-fin','zero-pause-midi-duree','zero-pause-apres-debut','zero-pause-apres-fin','zero-pause-apres-duree'].forEach(id => {
        const el = document.getElementById(id);
        if (el) formatHeureInputPause3(el);
    });
    // Module 3 (tous les champs dynamiques)
    document.querySelectorAll('#pause3-lignes .pause3-debut, #pause3-lignes .pause3-fin').forEach(el => {
        formatHeureInputPause3(el);
    });
}
// Appel initial après chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFormatHeureInputToAll);
} else {
    applyFormatHeureInputToAll();
}
// Appel après chaque ajout de ligne dans le module 3
const oldAddPause3Ligne = addPause3Ligne;
addPause3Ligne = function(nom) {
    oldAddPause3Ligne(nom);
    applyFormatHeureInputToAll();
};
// Appel après reset du module 3
const oldPause3Reset = document.getElementById('pause3-reset')?.onclick;
safeAddEventListener('pause3-reset', 'click', function() {
    setTimeout(applyFormatHeureInputToAll, 10);
    if (oldPause3Reset) oldPause3Reset();
});
// ... existing code ...
// 2. Corriger la logique de calcul pour chaque module (voir calculerHeuresSupCalculette et calculerHeuresSupZero)
// (Le code existant est déjà correct si on applique bien la logique de mode durée/début-fin et la mise en forme)
// ... existing code ...

// ... existing code ...
// Module 4 : convertisseur HH:MM <-> x,xx h
(function() {
    const convHHMM = document.getElementById('conv-hhmm');
    const convDecimal = document.getElementById('conv-decimal');
    // Restauration locale
    if (convHHMM && localStorage.getItem('convertisseur_hhmm')) convHHMM.value = localStorage.getItem('convertisseur_hhmm');
    if (convDecimal && localStorage.getItem('convertisseur_decimal')) convDecimal.value = localStorage.getItem('convertisseur_decimal');
    // Formatage HH:MM
    if (convHHMM) {
        // Ne pas appliquer le formateur strict HH:MM ici; on accepte HH:MM et HH:MM:SS,ss
        safeAddEventListener('conv-hhmm', 'input', function() {
            localStorage.setItem('convertisseur_hhmm', convHHMM.value);
        });
        safeAddEventListener('conv-hhmm', 'blur', function() {
            const v = convHHMM.value.trim();
            // Motifs acceptés: HH:MM ou HH:MM:SS,ss (ss = 2 décimales)
            let dec = null;
            if (/^\d{2}:\d{2}$/.test(v)) {
                const [h, m] = v.split(':').map(Number);
                dec = h + m/60;
                convDecimal.value = dec.toFixed(2).replace('.', ',');
                convHHMM.style.background = '';
                convHHMM.style.width = '90px';
            } else if (/^\d{2}:\d{2}:\d{2},\d{2}$/.test(v)) {
                const [hh, mm, rest] = v.split(':');
                const [ss, sfrac] = rest.split(',');
                const h = parseInt(hh, 10) || 0;
                const m = parseInt(mm, 10) || 0;
                const s = parseInt(ss, 10) || 0;
                const cs = parseInt(sfrac, 10) || 0; // centièmes de seconde
                const totalSeconds = h*3600 + m*60 + s + cs/100;
                dec = totalSeconds / 3600;
                // Conserver plus de précision côté décimal
                convDecimal.value = dec.toFixed(6).replace('.', ',');
                convHHMM.style.background = '';
                convHHMM.style.width = '160px';
            } else {
                // Format libre: ne rien effacer ni colorer en rouge ici
                convHHMM.style.background = '';
            }
            if (dec !== null) localStorage.setItem('convertisseur_decimal', convDecimal.value);
            localStorage.setItem('convertisseur_hhmm', convHHMM.value);
        });
    }
    if (convDecimal) {
        safeAddEventListener('conv-decimal', 'input', function() {
            // Conversion décimal -> HH:MM (ne rien faire ici)
            localStorage.setItem('convertisseur_decimal', convDecimal.value);
        });
        safeAddEventListener('conv-decimal', 'blur', function() {
            let raw = convDecimal.value.trim();
            if (!raw) return;
            // Accepte ',' ou '.' et jusqu'à 6 décimales
            const parts = raw.replace(',', '.').split('.');
            const fracLen = parts[1] ? Math.min(6, parts[1].length) : 0;
            const dec = parseFloat(parts.join('.') || '0');
            if (isNaN(dec)) {
                return;
            }
            const totalSecondsFloat = dec * 3600;
            let hours = Math.floor(totalSecondsFloat / 3600);
            let minutes = Math.floor((totalSecondsFloat % 3600) / 60);
            let secondsFloat = totalSecondsFloat - hours * 3600 - minutes * 60;

            // Ajuste l'affichage: par défaut HH:MM; si >2 décimales saisies, affiche HH:MM:SS,ss
            if (fracLen > 2) {
                // 2 décimales sur les secondes pour l'affichage (exigence 0.0008 -> 00:00:02,88)
                let secondsFixed = Number(secondsFloat.toFixed(2));
                // Gestion du report si 60.00
                if (secondsFixed >= 60) {
                    secondsFixed = 0;
                    minutes += 1;
                    if (minutes >= 60) {
                        minutes = 0;
                        hours += 1;
                    }
                }
                const secInt = Math.floor(secondsFixed);
                const secFrac = Math.round((secondsFixed - secInt) * 100);
                const hh = String(hours).padStart(2, '0');
                const mm = String(minutes).padStart(2, '0');
                const ss = String(secInt).padStart(2, '0');
                const sfrac = String(secFrac).padStart(2, '0');
                convHHMM.value = `${hh}:${mm}:${ss},${sfrac}`;
                // Élargir le champ pour l'affichage étendu
                convHHMM.style.width = '160px';
                localStorage.setItem('convertisseur_hhmm', convHHMM.value);
            } else {
                const hh = String(hours).padStart(2, '0');
                const mm = String(minutes).padStart(2, '0');
                convHHMM.value = `${hh}:${mm}`;
                convHHMM.style.width = '90px';
                localStorage.setItem('convertisseur_hhmm', convHHMM.value);
            }
            // Laisse la valeur décimale telle que saisie (jusqu'à 6 décimales)
            localStorage.setItem('convertisseur_decimal', convDecimal.value);
        });
    }

    // --- Addition/Soustraction d'horaires ---
    const section = document.getElementById('horaire-calc-section');
    if (section) {
        const lignesDiv = document.getElementById('horaire-calc-lignes');
        const totalHHMM = document.getElementById('horaire-calc-total-hhmm');
        const totalDecimal = document.getElementById('horaire-calc-total-decimal');
        let lignes = [];

        function toMinutes(hhmm) {
            if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return 0;
            const [h, m] = hhmm.split(':').map(Number);
            return h * 60 + m;
        }
        function toHHMM(mins) {
            const sign = mins < 0 ? '-' : '';
            mins = Math.abs(mins);
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return sign + h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
        }
        function toDecimal(mins) {
            const sign = mins < 0 ? '-' : '';
            mins = Math.abs(mins);
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            const dec = h + m/60;
            return sign + dec.toFixed(2).replace('.', ',');
        }
        function renderLignes() {
            lignesDiv.innerHTML = '';
            if (lignes.length === 0) lignes.push({op: '+', val: ''});
            lignes.forEach((ligne, idx) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.gap = '8px';
                div.style.marginBottom = '4px';
                // Boutons + et - pour l'opération
                const btnPlus = document.createElement('button');
                btnPlus.type = 'button';
                btnPlus.textContent = '+';
                btnPlus.style.fontWeight = 'bold';
                btnPlus.style.width = '28px';
                btnPlus.style.height = '28px';
                btnPlus.style.borderRadius = '50%';
                btnPlus.style.border = '1px solid #1976d2';
                btnPlus.style.background = ligne.op === '+' ? '#1976d2' : '#fff';
                btnPlus.style.color = ligne.op === '+' ? '#fff' : '#1976d2';
                btnPlus.style.transition = 'background 0.2s, color 0.2s';
                btnPlus.onclick = () => { ligne.op = '+'; renderLignes(); updateTotal(); };
                div.appendChild(btnPlus);
                const btnMoins = document.createElement('button');
                btnMoins.type = 'button';
                btnMoins.textContent = '-';
                btnMoins.style.fontWeight = 'bold';
                btnMoins.style.width = '28px';
                btnMoins.style.height = '28px';
                btnMoins.style.borderRadius = '50%';
                btnMoins.style.border = '1px solid #d32f2f';
                btnMoins.style.background = ligne.op === '-' ? '#d32f2f' : '#fff';
                btnMoins.style.color = ligne.op === '-' ? '#fff' : '#d32f2f';
                btnMoins.style.transition = 'background 0.2s, color 0.2s';
                btnMoins.onclick = () => { ligne.op = '-'; renderLignes(); updateTotal(); };
                div.appendChild(btnMoins);
                // Champ HH:MM
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'HH:MM';
                input.value = ligne.val;
                input.style.width = '70px';
                input.style.textAlign = 'center';
                input.autocomplete = 'off';
                input.inputMode = 'numeric';
                formatHeureInputPause3(input);
                input.oninput = () => { ligne.val = input.value; };
                input.onblur = () => { ligne.val = input.value; updateTotal(); };
                div.appendChild(input);
                // Bouton + pour ajouter une ligne sous la ligne courante
                const btnAdd = document.createElement('button');
                btnAdd.type = 'button';
                btnAdd.textContent = '+';
                btnAdd.title = 'Ajouter une ligne';
                btnAdd.style.marginLeft = '4px';
                btnAdd.style.fontSize = '1.2em';
                btnAdd.style.width = '28px';
                btnAdd.style.height = '28px';
                btnAdd.style.borderRadius = '50%';
                btnAdd.style.border = '1px solid #888';
                btnAdd.style.background = '#f5f5f5';
                btnAdd.onclick = () => { lignes.splice(idx+1, 0, {op: '+', val: ''}); renderLignes(); updateTotal(); };
                div.appendChild(btnAdd);
                // Bouton supprimer
                if (lignes.length > 1) {
                    const btnDel = document.createElement('button');
                    btnDel.type = 'button';
                    btnDel.textContent = '🗑️';
                    btnDel.style.marginLeft = '4px';
                    btnDel.style.fontSize = '1.1em';
                    btnDel.onclick = () => { lignes.splice(idx, 1); renderLignes(); updateTotal(); };
                    div.appendChild(btnDel);
                }
                lignesDiv.appendChild(div);
            });
        }
        function updateTotal() {
            let total = 0;
            lignes.forEach(ligne => {
                const mins = toMinutes(ligne.val);
                if (ligne.op === '+') total += mins;
                else total -= mins;
            });
            totalHHMM.textContent = toHHMM(total);
            totalDecimal.textContent = toDecimal(total);
        }
        // Initialisation
        renderLignes();
        updateTotal();
    }
})();
// ... existing code ...

// ... existing code ...
// --- Gestion des pauses dynamiques dans le modal d'ajout ---
let pausesAvant = [];
let pausesApres = [];

function renderPausesList(list, containerId, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    // Toujours afficher au moins une ligne
    if (list.length === 0) list.push({debut:'',fin:''});
    list.forEach((pause, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.style.marginBottom = '4px';
        div.innerHTML = `
            <input type="text" class="pause-dyn-debut" placeholder="Début" value="${pause.debut || ''}" style="width:60px;" inputmode="numeric" autocomplete="off">
            <span>à</span>
            <input type="text" class="pause-dyn-fin" placeholder="Fin" value="${pause.fin || ''}" style="width:60px;" inputmode="numeric" autocomplete="off">
        `;
        // Première ligne : bouton + à droite
        if (idx === 0) {
            const btnAdd = document.createElement('button');
            btnAdd.type = 'button';
            btnAdd.textContent = '+';
            btnAdd.style.marginLeft = '8px';
            btnAdd.style.fontSize = '1.2em';
            btnAdd.style.padding = '2px 10px';
            btnAdd.onclick = () => {
                list.push({debut:'',fin:''});
                renderPausesList(list, containerId, type);
            };
            div.appendChild(btnAdd);
        } else {
            // Lignes suivantes : bouton + puis poubelle
            const btnAdd = document.createElement('button');
            btnAdd.type = 'button';
            btnAdd.textContent = '+';
            btnAdd.style.marginLeft = '8px';
            btnAdd.style.fontSize = '1.2em';
            btnAdd.style.padding = '2px 10px';
            btnAdd.onclick = () => {
                list.splice(idx+1, 0, {debut:'',fin:''});
                renderPausesList(list, containerId, type);
            };
            div.appendChild(btnAdd);
            const btnDel = document.createElement('button');
            btnDel.type = 'button';
            btnDel.textContent = '🗑️';
            btnDel.style.marginLeft = '4px';
            btnDel.style.fontSize = '1.2em';
            btnDel.onclick = () => {
                list.splice(idx, 1);
                renderPausesList(list, containerId, type);
            };
            div.appendChild(btnDel);
        }
        // Format auto HH:MM
        div.querySelectorAll('input').forEach(input => {
            formatHeureInputPause3(input);
            input.addEventListener('input', () => {
                pause.debut = div.querySelector('.pause-dyn-debut').value;
                pause.fin = div.querySelector('.pause-dyn-fin').value;
            });
        });
        container.appendChild(div);
    });
}
// Les deux lignes suivantes sont supprimées car les boutons n'existent plus :
// document.getElementById('add-pause-avant').onclick = ...
// document.getElementById('add-pause-apres').onclick = ...
// ... existing code ...

// ... existing code ...
// --- Affichage des jours saisis : colonne pause = somme de toutes les pauses dynamiques hors midi ---
function totalPausesDyn(jour) {
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return 0;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    let total = 0;
    if (Array.isArray(jour.pausesAvant)) {
        jour.pausesAvant.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                total += (fin - debut);
            }
        });
    }
    if (Array.isArray(jour.pausesApres)) {
        jour.pausesApres.forEach(p => {
            const debut = toMinutes(p.debut);
            const fin = toMinutes(p.fin);
            if (debut !== null && fin !== null && fin > debut) {
                total += (fin - debut);
            }
        });
    }
    return total;
}
// ... existing code ...

// --- Export Excel mois ---
safeAddEventListener('export-excel-mois', 'click', function() {
    // Mois et année affichés
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    // Filtrer les jours du mois affiché
    const joursMois = jours.filter(jour => {
        const [y, m] = jour.date.split('-');
        return y === anneeStr && m === moisStr;
    });
    
    // Vérifier si une phase RHT est active dans ce mois
    let hasRHTInMonth = false;
    if (joursMois.length > 0) {
        hasRHTInMonth = joursMois.some(jour => {
            return isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
        });
    }
    
    // Chercher le nombre max de pauses avant/après midi sur le mois (pour colonnes dynamiques)
    let maxAvant = 0, maxApres = 0;
    joursMois.forEach(jour => {
        if (Array.isArray(jour.pausesAvant)) maxAvant = Math.max(maxAvant, jour.pausesAvant.length);
        if (Array.isArray(jour.pausesApres)) maxApres = Math.max(maxApres, jour.pausesApres.length);
    });
    // Colonnes d'en-tête dynamiques
    let header = [
        'Date',
        'Arrivée',
        ...Array.from({length: maxAvant}, (_,i) => [`Pause avant ${i+1} début`, `Pause avant ${i+1} fin`]).flat(),
        'Début pause midi',
        'Fin pause midi',
        ...Array.from({length: maxApres}, (_,i) => [`Pause après ${i+1} début`, `Pause après ${i+1} fin`]).flat(),
        'Départ',
        'Heures travaillées',
        'Écart'
    ];
    
    // Ajouter les colonnes RHT si nécessaire
    if (hasRHTInMonth) {
        header.push('Heures écrêtées', 'RHT supplémentaire');
    }
    // Préparation des données
    const data = [];
    data.push(header);
    joursMois.forEach(jour => {
        // Date JJ.MM.AA
        const [y, mo, d] = jour.date.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        
        // Vérifier si c'est un jour RHT pour recalculer les heures et l'écart
        const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
        const isVac = isJourVacances(jour.date);
        const isRtt = isJourRTT(jour.date);
        
        // Pauses avant
        let pausesAvant = Array.isArray(jour.pausesAvant) ? jour.pausesAvant : [];
        let avantCells = [];
        for (let i = 0; i < maxAvant; i++) {
            if (pausesAvant[i]) {
                avantCells.push(pausesAvant[i].debut || '', pausesAvant[i].fin || '');
            } else {
                avantCells.push('', '');
            }
        }
        // Pauses après
        let pausesApres = Array.isArray(jour.pausesApres) ? jour.pausesApres : [];
        let apresCells = [];
        for (let i = 0; i < maxApres; i++) {
            if (pausesApres[i]) {
                apresCells.push(pausesApres[i].debut || '', pausesApres[i].fin || '');
            } else {
                apresCells.push('', '');
            }
        }
        
        // Recalcul des heures travaillées et écart si RHT actif
        let heuresTrav, ecart;
        if (isRhtDay && !(isVac || isRtt)) {
            // Mode RHT : recalcul avec pause offerte RHT et heures à faire RHT
            const pauseOffEff = getPauseOfferteEffective(jour.date);
            heuresTrav = parseFloat(calculerHeuresAvecPause(
                jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                jour.pausesAvant, jour.pausesApres,
                pauseOffEff,
                true
            ));
            const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
            ecart = heuresTrav - heuresJourEff;
        } else {
            // Mode standard : utiliser les valeurs stockées
            heuresTrav = typeof jour.heuresTravaillees === 'number' ? jour.heuresTravaillees : parseFloat(jour.heuresTravaillees || 0);
            ecart = typeof jour.ecart === 'number' ? jour.ecart : parseFloat(jour.ecart || 0);
        }
        
        // Formatage pour l'export (x,xx)
        let heuresTravFormatted = heuresTrav.toFixed(2).replace('.', ',');
        let ecartFormatted = ecart.toFixed(2).replace('.', ',');
        
        // Préparer les données de base
        let rowData = [
            dateFmt,
            jour.arrivee || '',
            ...avantCells,
            jour.pauseDejDebut || '',
            jour.pauseDejFin || '',
            ...apresCells,
            jour.depart || '',
            heuresTravFormatted,
            ecartFormatted
        ];
        
        // Ajouter les colonnes RHT si nécessaire
        if (hasRHTInMonth) {
            if (isRhtDay && !(isVac || isRtt)) {
                // Mode RHT : calculer les heures écrêtées et RHT supplémentaire
                if (ecart > 0) {
                    rowData.push(ecart.toFixed(2).replace('.', ','), ''); // Heures écrêtées
                } else if (ecart < 0) {
                    rowData.push('', Math.abs(ecart).toFixed(2).replace('.', ',')); // RHT supplémentaire
                } else {
                    rowData.push('', ''); // Pas d'écart
                }
            } else {
                // Mode standard : pas de colonnes RHT
                rowData.push('', '');
            }
        }
        
        data.push(rowData);
    });
    
    // Ligne de totaux
    if (joursMois.length > 0) {
        // Recalculer les totaux avec les nouvelles valeurs RHT si nécessaire
        let totalHeures = 0, totalEcart = 0;
        
        joursMois.forEach(jour => {
            const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
            const isVac = isJourVacances(jour.date);
            const isRtt = isJourRTT(jour.date);
            
            if (isRhtDay && !(isVac || isRtt)) {
                // Mode RHT : recalcul
                const pauseOffEff = getPauseOfferteEffective(jour.date);
                const heuresTrav = parseFloat(calculerHeuresAvecPause(
                    jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                    jour.pausesAvant, jour.pausesApres,
                    pauseOffEff,
                    true
                ));
                const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
                const ecart = heuresTrav - heuresJourEff;
                
                totalHeures += heuresTrav;
                totalEcart += ecart;
            } else {
                // Mode standard : utiliser les valeurs stockées
                totalHeures += typeof jour.heuresTravaillees === 'number' ? jour.heuresTravaillees : parseFloat(jour.heuresTravaillees || 0);
                totalEcart += typeof jour.ecart === 'number' ? jour.ecart : parseFloat(jour.ecart || 0);
            }
        });
        
        let totalRow = Array(header.length).fill('');
        totalRow[header.indexOf('Départ')] = 'TOTAL'; // Libellé "TOTAL" dans la colonne Départ
        totalRow[header.indexOf('Heures travaillées')] = totalHeures.toFixed(2).replace('.', ',');
        totalRow[header.indexOf('Écart')] = totalEcart.toFixed(2).replace('.', ',');
        
        // Ajouter les totaux RHT si nécessaire
        if (hasRHTInMonth) {
            let totalHeuresEcretees = 0, totalRHTSupp = 0;
            
            joursMois.forEach(jour => {
                const isRhtDay = isDateInRHT(jour.date) || isDateInRHTPhase1(jour.date);
                const isVac = isJourVacances(jour.date);
                const isRtt = isJourRTT(jour.date);
                
                if (isRhtDay && !(isVac || isRtt)) {
                    // Mode RHT : recalcul
                    const pauseOffEff = getPauseOfferteEffective(jour.date);
                    const heuresTrav = parseFloat(calculerHeuresAvecPause(
                        jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                        jour.pausesAvant, jour.pausesApres,
                        pauseOffEff,
                        true
                    ));
                    const heuresJourEff = getHeuresJourMinutesEffective(jour.date) / 60;
                    const ecart = heuresTrav - heuresJourEff;
                    
                    if (ecart > 0) {
                        totalHeuresEcretees += ecart; // Heures écrêtées
                    } else if (ecart < 0) {
                        totalRHTSupp += Math.abs(ecart); // RHT supplémentaire
                    }
                }
            });
            
            totalRow[header.indexOf('Heures écrêtées')] = totalHeuresEcretees.toFixed(2).replace('.', ',');
            totalRow[header.indexOf('RHT supplémentaire')] = totalRHTSupp.toFixed(2).replace('.', ',');
        }
        
        data.push(totalRow);
    }
    
    // Création de la feuille et du fichier
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Ajustement automatique de la largeur des colonnes
    const colWidths = [];
    for (let col = 0; col < header.length; col++) {
        let maxWidth = header[col].length;
        for (let row = 1; row < data.length; row++) {
            const cellValue = data[row][col];
            if (cellValue && cellValue.toString().length > maxWidth) {
                maxWidth = cellValue.toString().length;
            }
        }
        colWidths.push({ wch: Math.min(Math.max(maxWidth + 2, 8), 50) }); // Min 8, Max 50
    }
    ws['!cols'] = colWidths;
    
    // Nom de feuille : MM.YY-RHT si RHT actif, sinon MM.YY
    const moisYY = hasRHTInMonth ? `${moisStr}.${anneeStr.slice(2)}-RHT` : `${moisStr}.${anneeStr.slice(2)}`;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, moisYY);
    
    // Ajout de la feuille de backup des jours posés du mois
    const backupData = [];
    backupData.push(['Date', 'Type', 'Description']);
    
    // Récupérer tous les jours posés du mois
    const joursVacancesMois = joursVacances.filter(jour => {
        const [y, m] = jour.split('-');
        return y === anneeStr && m === moisStr;
    });
    const joursRTTMois = joursRTT.filter(jour => {
        const [y, m] = jour.split('-');
        return y === anneeStr && m === moisStr;
    });
    const joursRHTMois = joursRHT.filter(jour => {
        const [y, m] = jour.split('-');
        return y === anneeStr && m === moisStr;
    });
    const joursFeriesMois = joursFeries.filter(jour => {
        const [y, m] = jour.split('-');
        return y === anneeStr && m === moisStr;
    });
    const joursRattrapesMois = joursRattrapes.filter(jour => {
        const [y, m] = jour.split('-');
        return y === anneeStr && m === moisStr;
    });
    
    // Ajouter les congés payés
    joursVacancesMois.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Congé payé', 'CP']);
    });
    
    // Ajouter les RTT
    joursRTTMois.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'RTT', 'RTT']);
    });
    
    // Ajouter les RHT
    joursRHTMois.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'RHT', 'RHT']);
    });
    
    // Ajouter les jours fériés
    joursFeriesMois.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Férié', 'Férié']);
    });
    
    // Ajouter les jours rattrapés
    joursRattrapesMois.forEach(dateStr => {
        const [y, mo, d] = dateStr.split('-');
        const dateFmt = `${d}.${mo}.${y.slice(2)}`;
        backupData.push([dateFmt, 'Jour rattrapé', 'Rattrapé']);
    });
    
    // Créer la feuille de backup
    const wsBackup = XLSX.utils.aoa_to_sheet(backupData);
    XLSX.utils.book_append_sheet(wb, wsBackup, 'Backup_Jours_Posés');
    
    // Export du fichier (nom inchangé, seules les feuilles sont renommées)
    XLSX.writeFile(wb, `horaires_${moisStr}.${anneeStr.slice(2)}.xlsx`);
});

// --- Suppression de toutes les valeurs de l'année affichée avec confirmation ---
safeAddEventListener('supprimer-annee', 'click', function() {
    const confirmModalAnneeBg = document.getElementById('confirm-modal-annee-bg');
    if (confirmModalAnneeBg) confirmModalAnneeBg.style.display = 'flex';
});
safeAddEventListener('confirm-annee-non', 'click', function() {
    const confirmModalAnneeBg = document.getElementById('confirm-modal-annee-bg');
    if (confirmModalAnneeBg) confirmModalAnneeBg.style.display = 'none';
});
safeAddEventListener('confirm-annee-oui', 'click', function() {
    const confirmModalAnneeBg = document.getElementById('confirm-modal-annee-bg');
    const anneeStr = String(currentYear);
    jours = jours.filter(jour => {
        const [y] = jour.date.split('-');
        return y !== anneeStr;
    });
    localStorage.setItem('jours', JSON.stringify(jours));
    
    // Supprime également tous les jours posés de l'année affichée
    joursVacances = joursVacances.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
    joursRTT = joursRTT.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
    joursRHT = joursRHT.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
    joursFeries = joursFeries.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
    joursRattrapes = joursRattrapes.filter(dateStr => !dateStr.startsWith(anneeStr + '-'));
    
    // Sauvegarde des jours posés mis à jour
    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
    localStorage.setItem('joursRHT', JSON.stringify(joursRHT));
    localStorage.setItem('joursFeries', JSON.stringify(joursFeries));
    localStorage.setItem('joursRattrapes', JSON.stringify(joursRattrapes));
    
    // Rafraîchir l'affichage et mettre à jour les compteurs
    afficherJours();
    updateCompteursAbsences();
    majCalendrier();
    if (confirmModalAnneeBg) confirmModalAnneeBg.style.display = 'none';
});

// --- Suppression de toutes les valeurs du mois affiché avec confirmation ---
safeAddEventListener('supprimer-mois', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    if (confirmModalBg) confirmModalBg.style.display = 'flex';
});
safeAddEventListener('confirm-non', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    if (confirmModalBg) confirmModalBg.style.display = 'none';
});
safeAddEventListener('confirm-oui', 'click', function() {
    const confirmModalBg = document.getElementById('confirm-modal-bg');
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    jours = jours.filter(jour => {
        const [y, m] = jour.date.split('-');
        return !(y === anneeStr && m === moisStr);
    });
    localStorage.setItem('jours', JSON.stringify(jours));
    afficherJours();
    if (confirmModalBg) confirmModalBg.style.display = 'none';
});

// --- Gestion des modals et autres boutons ---
safeAddEventListener('btn-menu', 'click', function() {
    const menuModalBg = document.getElementById('menu-modal-bg');
    if (menuModalBg) menuModalBg.style.display = 'flex';
});
safeAddEventListener('menu-modal-close', 'click', function() {
    const menuModalBg = document.getElementById('menu-modal-bg');
    if (menuModalBg) menuModalBg.style.display = 'none';
});
// ... Répéter pour tous les autres boutons et modals du projet ...

// Fonction utilitaire pour fermer tous les modals
function fermerTousLesModals() {
    document.querySelectorAll('.modal-bg').forEach(el => {
        el.style.display = 'none';
    });
}

// ... existing code ...
// --- Gestion du format horaire global (HH:MM ou HH:MM:SS) ---
let formatHoraireSecondes = false;
const formatSwitch = document.getElementById('param-format-horaire');
const formatLabel = document.getElementById('param-format-horaire-label');
if (formatSwitch) {
    // Restauration depuis le localStorage
    if (localStorage.getItem('formatHoraireSecondes')) {
        formatHoraireSecondes = localStorage.getItem('formatHoraireSecondes') === 'true';
        formatSwitch.checked = formatHoraireSecondes;
        formatLabel.textContent = formatHoraireSecondes ? 'HH:MM:SS' : 'HH:MM';
    }
    formatSwitch.addEventListener('change', function() {
        formatHoraireSecondes = formatSwitch.checked;
        formatLabel.textContent = formatHoraireSecondes ? 'HH:MM:SS' : 'HH:MM';
        localStorage.setItem('formatHoraireSecondes', formatHoraireSecondes);
        appliquerFormatHoraireGlobal();
    });
}

function appliquerFormatHoraireGlobal() {
    // Sélecteurs pour tous les champs horaires (input type text avec placeholder HH:MM ou HH:MM:SS)
    const inputs = document.querySelectorAll('input[type="text"][placeholder^="HH:MM"]');
    inputs.forEach(input => {
        // Ne pas altérer le champ du convertisseur HH:MM
        if (input.id === 'conv-hhmm') return;
        if (formatHoraireSecondes) {
            input.placeholder = 'HH:MM:SS';
            input.style.width = '66px';
            // Si la valeur est au format HH:MM, on ajoute :00
            if (/^\d{2}:\d{2}$/.test(input.value)) input.value = input.value + ':00';
        } else {
            input.placeholder = 'HH:MM';
            input.style.width = '54px';
            // Si la valeur est au format HH:MM:SS, on retire les secondes
            if (/^\d{2}:\d{2}:\d{2}$/.test(input.value)) input.value = input.value.slice(0,5);
        }
    });
}
// Appliquer au chargement
appliquerFormatHoraireGlobal();

// Adapter les fonctions de formatage et de conversion HH:MM/HH:MM:SS partout où nécessaire
function toMinutesFlexible(horaire) {
    if (!horaire) return 0;
    if (/^\d{2}:\d{2}$/.test(horaire)) {
        const [h, m] = horaire.split(':').map(Number);
        return h * 60 + m;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(horaire)) {
        const [h, m, s] = horaire.split(':').map(Number);
        return h * 60 + m + Math.floor(s/60);
    }
    return 0;
}
function toFlexibleFormat(mins) {
    const sign = mins < 0 ? '-' : '';
    mins = Math.abs(mins);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (formatHoraireSecondes) {
        return sign + h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0') + ':00';
    } else {
        return sign + h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
    }
}
// Remplacer les appels à toMinutes et toHHMM dans les modules concernés par toMinutesFlexible et toFlexibleFormat
// ... (à faire dans les modules 4 et 5, et autres champs horaires si besoin) ...
// ... existing code ...

// ... existing code ...
function isJourRHT(dateStr) {
    // On considère qu'un jour RHT est un jour où le modeVacances était 'rht' lors de la pose
    let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
    return joursRHT.includes(dateStr);
}

// On modifie ouvrirModal pour gérer l'affichage conditionnel selon le mode RHT
const oldOuvrirModal = ouvrirModal;
ouvrirModal = function(dateStr = null) {
    if (dateStr && (isJourVacances(dateStr) || isJourRTT(dateStr) || isJourFerie(dateStr) || isJourRattrape(dateStr))) {
        return; // Ne pas ouvrir le modal pour les jours vacances, RTT, fériés ou rattrapés
    }
    
    // Appeler la fonction originale
    oldOuvrirModal(dateStr);
    
    // Gérer l'affichage conditionnel selon le mode RHT
    if (dateStr) {
        gererAffichageChampsRHT(dateStr);
    }
}

// Fonction pour gérer l'affichage conditionnel des champs selon le mode RHT
function gererAffichageChampsRHT(dateStr) {
    const isRHTPhase1 = isDateInRHTPhase1(dateStr);
    const isRHTPhase2 = isDateInRHT(dateStr);
    
    // Éléments du modal principal
    const pauseMidiContainer = document.querySelector('#pause-midi-row').parentElement;
    const pausesApresContainer = document.getElementById('pauses-apres-container');
    
    // Éléments du module 1 (calculette)
    const calcMidiGroup = document.getElementById('calc-midi-group');
    
    // Éléments du module 2 (simulateur)
    const zeroMidiGroup = document.getElementById('zero-midi-group');
    
    if (isRHTPhase2) {
        // Mode RHT phase 2 activé : masquer pause midi et pauses après-midi
        if (pauseMidiContainer) pauseMidiContainer.style.display = 'none';
        if (pausesApresContainer) pausesApresContainer.style.display = 'none';
        if (calcMidiGroup) calcMidiGroup.style.display = 'none';
        if (zeroMidiGroup) zeroMidiGroup.style.display = 'none';
    } else if (isRHTPhase1) {
        // Mode RHT phase 1 activé : EXCEPTION - garder tous les champs visibles
        if (pauseMidiContainer) pauseMidiContainer.style.display = 'flex';
        if (pausesApresContainer) pausesApresContainer.style.display = 'block';
        if (calcMidiGroup) calcMidiGroup.style.display = 'flex';
        if (zeroMidiGroup) zeroMidiGroup.style.display = 'flex';
    } else {
        // Mode RHT désactivé : afficher tous les champs
        if (pauseMidiContainer) pauseMidiContainer.style.display = 'flex';
        if (pausesApresContainer) pausesApresContainer.style.display = 'block';
        if (calcMidiGroup) calcMidiGroup.style.display = 'flex';
        if (zeroMidiGroup) zeroMidiGroup.style.display = 'flex';
    }
}

// Fonction pour gérer l'affichage conditionnel des champs dans les modules selon le mode RHT
function gererAffichageModuleRHT(moduleType, rhtEnabled) {
    if (moduleType === 'calc') {
        // Module 1 : calculette
        const calcMidiGroup = document.getElementById('calc-midi-group');
        const calcApresMidiGroup = document.getElementById('calc-apres-midi-group');
        
        if (calcMidiGroup && calcApresMidiGroup) {
            if (!rhtEnabled) {
                // Mode RHT désactivé : affichage complet
                calcMidiGroup.style.display = 'flex';
                calcApresMidiGroup.style.display = 'flex';
            } else {
                // Mode RHT activé : vérifier la phase
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
                const isRHTPhase1 = isDateInRHTPhase1(todayStr);
                
                if (isRHTPhase1) {
                    // Exception phase 1 : garder tous les champs visibles même en mode RHT
                    calcMidiGroup.style.display = 'flex';
                    calcApresMidiGroup.style.display = 'flex';
                } else {
                    // Mode RHT phase 2 : masquer pause midi et pause après-midi
                    calcMidiGroup.style.display = 'none';
                    calcApresMidiGroup.style.display = 'none';
                }
            }
        }
    } else if (moduleType === 'zero') {
        // Module 2 : simulateur
        const zeroMidiGroup = document.getElementById('zero-midi-group');
        const zeroApresMidiGroup = document.getElementById('zero-apres-midi-group');
        
        if (zeroMidiGroup && zeroApresMidiGroup) {
            if (!rhtEnabled) {
                // Mode RHT désactivé : affichage complet
                zeroMidiGroup.style.display = 'flex';
                zeroApresMidiGroup.style.display = 'flex';
            } else {
                // Mode RHT activé : vérifier la phase
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
                const isRHTPhase1 = isDateInRHTPhase1(todayStr);
                
                if (isRHTPhase1) {
                    // Exception phase 1 : garder tous les champs visibles même en mode RHT
                    zeroMidiGroup.style.display = 'flex';
                    zeroApresMidiGroup.style.display = 'flex';
                } else {
                    // Mode RHT phase 2 : masquer pause midi et pause après-midi
                    zeroMidiGroup.style.display = 'none';
                    zeroApresMidiGroup.style.display = 'none';
                }
            }
        }
    }
}

// ============================================
// GESTION DES PÉRIODES RHT (Phase 1 et Phase 2)
// ============================================

// Fonction pour générer un ID unique
function genererIdUnique() {
    return 'rht-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Fonction de conversion de date JJ.MM.AA vers ISO (YYYY-MM-DD)
function toISO(jjmmaaaa) {
    if (!jjmmaaaa || !/^\d{2}\.\d{2}\.\d{2}$/.test(jjmmaaaa)) return null;
    const [jj, mm, aa] = jjmmaaaa.split('.');
    const yyyy = parseInt(aa, 10) + 2000;
    return `${yyyy}-${mm}-${jj}`;
}

// Fonction de conversion ISO vers JJ.MM.AA
function toJJMMAA(isoDate) {
    if (!isoDate) return '';
    const [yyyy, mm, jj] = isoDate.split('-');
    const aa = parseInt(yyyy, 10) - 2000;
    return `${jj}.${mm}.${String(aa).padStart(2, '0')}`;
}

// Migration des données RHT de l'ancien format vers le nouveau
function migrerDonneesRHT() {
    // Vérifier si la migration a déjà été faite
    if (localStorage.getItem('rht_migration_done') === 'true') {
        return;
    }

    const periodesPhase1 = [];
    const periodesPhase2 = [];

    // Migration Phase 1
    const phase1Enabled = localStorage.getItem('param-rht-phase1-enabled') === 'true';
    const phase1Debut = localStorage.getItem('param-rht-phase1-debut') || '';
    const phase1Fin = localStorage.getItem('param-rht-phase1-fin') || '';

    if (phase1Enabled && phase1Debut && phase1Fin && /^\d{2}\.\d{2}\.\d{2}$/.test(phase1Debut) && /^\d{2}\.\d{2}\.\d{2}$/.test(phase1Fin)) {
        periodesPhase1.push({
            id: genererIdUnique(),
            enabled: true,
            debut: phase1Debut,
            fin: phase1Fin
        });
    }

    // Migration Phase 2
    const phase2Enabled = localStorage.getItem('rht_enabled') === 'true';
    const phase2Debut = localStorage.getItem('rht_debut') || '';
    const phase2Fin = localStorage.getItem('rht_fin') || '';
    const phase2HeuresDec = localStorage.getItem('rht_heures_dec') || '';
    const phase2HeuresHHMM = localStorage.getItem('rht_heures_hhmm') || '';
    const phase2PauseOfferte = localStorage.getItem('rht_pause_offerte') || '';
    const phase2ArriveeMin = localStorage.getItem('rhtPlageArriveeMin') || '';
    const phase2ArriveeMax = localStorage.getItem('rhtPlageArriveeMax') || '';
    const phase2DepartMin = localStorage.getItem('rhtPlageDepartMin') || '';
    const phase2DepartMax = localStorage.getItem('rhtPlageDepartMax') || '';

    if (phase2Enabled && phase2Debut && phase2Fin && /^\d{2}\.\d{2}\.\d{2}$/.test(phase2Debut) && /^\d{2}\.\d{2}\.\d{2}$/.test(phase2Fin)) {
        // Convertir les minutes en HH:MM pour les plages horaires
        function minutesToHHMM(minutes) {
            if (!minutes || isNaN(parseInt(minutes))) return '';
            const mins = parseInt(minutes);
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }

        periodesPhase2.push({
            id: genererIdUnique(),
            enabled: true,
            debut: phase2Debut,
            fin: phase2Fin,
            heuresJour: phase2HeuresDec ? parseFloat(phase2HeuresDec.replace(',', '.')) : null,
            heuresJourHHMM: phase2HeuresHHMM || '',
            pauseOfferte: phase2PauseOfferte ? parseInt(phase2PauseOfferte) : null,
            plageArriveeMin: minutesToHHMM(phase2ArriveeMin),
            plageArriveeMax: minutesToHHMM(phase2ArriveeMax),
            plageDepartMin: minutesToHHMM(phase2DepartMin),
            plageDepartMax: minutesToHHMM(phase2DepartMax)
        });
    }

    // Sauvegarder les périodes migrées
    if (periodesPhase1.length > 0) {
        localStorage.setItem('rht_periodes_phase1', JSON.stringify(periodesPhase1));
    }
    if (periodesPhase2.length > 0) {
        localStorage.setItem('rht_periodes_phase2', JSON.stringify(periodesPhase2));
    }

    // Marquer la migration comme effectuée
    localStorage.setItem('rht_migration_done', 'true');
}

// Charger les périodes RHT d'une phase
function chargerPeriodesRHT(phase) {
    const key = phase === 'phase1' ? 'rht_periodes_phase1' : 'rht_periodes_phase2';
    const periodesStr = localStorage.getItem(key);
    if (!periodesStr) return [];
    try {
        return JSON.parse(periodesStr);
    } catch (e) {
        console.error('Erreur lors du chargement des périodes RHT:', e);
        return [];
    }
}

// Sauvegarder les périodes RHT d'une phase
function sauvegarderPeriodesRHT(phase, periodes) {
    const key = phase === 'phase1' ? 'rht_periodes_phase1' : 'rht_periodes_phase2';
    localStorage.setItem(key, JSON.stringify(periodes));
}

// Obtenir toutes les périodes RHT d'une phase
function obtenirPeriodesRHT(phase) {
    return chargerPeriodesRHT(phase);
}

// Obtenir une période RHT par son ID
function obtenirPeriodeRHT(phase, periodeId) {
    const periodes = chargerPeriodesRHT(phase);
    return periodes.find(p => p.id === periodeId) || null;
}

// Ajouter une période RHT
function ajouterPeriodeRHT(phase, periodeData = {}) {
    const periodes = chargerPeriodesRHT(phase);
    
    // Valeurs par défaut selon la phase
    let nouvellePeriode;
    if (phase === 'phase1') {
        nouvellePeriode = {
            id: genererIdUnique(),
            enabled: periodeData.enabled !== undefined ? periodeData.enabled : true,
            debut: periodeData.debut || '',
            fin: periodeData.fin || ''
        };
    } else { // phase2
        nouvellePeriode = {
            id: genererIdUnique(),
            enabled: periodeData.enabled !== undefined ? periodeData.enabled : true,
            debut: periodeData.debut || '',
            fin: periodeData.fin || '',
            heuresJour: periodeData.heuresJour || null,
            heuresJourHHMM: periodeData.heuresJourHHMM || '',
            pauseOfferte: periodeData.pauseOfferte || null,
            plageArriveeMin: periodeData.plageArriveeMin || '',
            plageArriveeMax: periodeData.plageArriveeMax || '',
            plageDepartMin: periodeData.plageDepartMin || '',
            plageDepartMax: periodeData.plageDepartMax || ''
        };
    }

    periodes.push(nouvellePeriode);
    sauvegarderPeriodesRHT(phase, periodes);
    return nouvellePeriode;
}

// Supprimer une période RHT
function supprimerPeriodeRHT(phase, periodeId) {
    const periodes = chargerPeriodesRHT(phase);
    const nouvellesPeriodes = periodes.filter(p => p.id !== periodeId);
    sauvegarderPeriodesRHT(phase, nouvellesPeriodes);
    return nouvellesPeriodes;
}

// Modifier une période RHT
function modifierPeriodeRHT(phase, periodeId, updates) {
    const periodes = chargerPeriodesRHT(phase);
    const index = periodes.findIndex(p => p.id === periodeId);
    if (index === -1) return null;
    
    periodes[index] = { ...periodes[index], ...updates };
    sauvegarderPeriodesRHT(phase, periodes);
    return periodes[index];
}

// Générer le HTML d'une période RHT Phase 1
function genererHTMLPhase1(periode) {
    const enabledClass = periode.enabled ? '' : 'opacity:0.6;';
    return `
        <div class="rht-period-block" data-period-id="${periode.id}" data-phase="phase1" style="background:#fff; border-radius:8px; box-shadow:0 2px 8px #0001; padding:16px; margin-bottom:12px; position:relative; ${enabledClass}">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <label style="min-width:90px; font-size:13px;">Période :</label>
                <input type="text" class="input-period-debut" data-period-id="${periode.id}" data-phase="phase1" value="${periode.debut || ''}" placeholder="JJ.MM.AA" style="width:90px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;" inputmode="numeric" autocomplete="off">
                <span style="font-size:13px;">à</span>
                <input type="text" class="input-period-fin" data-period-id="${periode.id}" data-phase="phase1" value="${periode.fin || ''}" placeholder="JJ.MM.AA" style="width:90px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;" inputmode="numeric" autocomplete="off">
                <button type="button" class="btn-add-period-after" data-period-id="${periode.id}" data-phase="phase1" style="margin-left:8px; font-size:1.2em;" title="Ajouter une période après">+</button>
                <button type="button" class="btn-toggle-period" data-period-id="${periode.id}" data-phase="phase1" style="margin-left:4px; font-size:1.2em; cursor:pointer;" title="${periode.enabled ? 'Désactiver' : 'Activer'}">${periode.enabled ? '✓' : '○'}</button>
                <button type="button" class="btn-delete-period" data-period-id="${periode.id}" data-phase="phase1" style="margin-left:4px; font-size:1.2em;" title="Supprimer">🗑️</button>
            </div>
        </div>
    `;
}

// Générer le HTML d'une période RHT Phase 2
function genererHTMLPhase2(periode) {
    const enabledClass = periode.enabled ? '' : 'opacity:0.6;';
    
    // Fonction de conversion minutes vers HH:MM
    function minutesToHHMM(minutes) {
        if (!minutes || isNaN(parseInt(minutes))) return '';
        const mins = parseInt(minutes);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    
    // Convertir les minutes en HH:MM si nécessaire
    const plageArriveeMin = periode.plageArriveeMin || '';
    const plageArriveeMax = periode.plageArriveeMax || '';
    const plageDepartMin = periode.plageDepartMin || '';
    const plageDepartMax = periode.plageDepartMax || '';
    
    return `
        <div class="rht-period-block" data-period-id="${periode.id}" data-phase="phase2" style="background:#fff; border-radius:8px; box-shadow:0 2px 8px #0001; padding:16px; margin-bottom:12px; position:relative; ${enabledClass}">
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <label style="min-width:90px; font-size:13px;">Période :</label>
                    <input type="text" class="input-period-debut" data-period-id="${periode.id}" data-phase="phase2" value="${periode.debut || ''}" placeholder="JJ.MM.AA" style="width:90px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;" inputmode="numeric" autocomplete="off">
                    <span style="font-size:13px;">à</span>
                    <input type="text" class="input-period-fin" data-period-id="${periode.id}" data-phase="phase2" value="${periode.fin || ''}" placeholder="JJ.MM.AA" style="width:90px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;" inputmode="numeric" autocomplete="off">
                    <button type="button" class="btn-add-period-after" data-period-id="${periode.id}" data-phase="phase2" style="margin-left:8px; font-size:1.2em;" title="Ajouter une période après">+</button>
                    <button type="button" class="btn-toggle-period" data-period-id="${periode.id}" data-phase="phase2" style="margin-left:4px; font-size:1.2em; cursor:pointer;" title="${periode.enabled ? 'Désactiver' : 'Activer'}">${periode.enabled ? '✓' : '○'}</button>
                    <button type="button" class="btn-delete-period" data-period-id="${periode.id}" data-phase="phase2" style="margin-left:4px; font-size:1.2em;" title="Supprimer">🗑️</button>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <label style="min-width:90px; font-size:13px;">Heures/jour :</label>
                    <input type="number" class="input-period-heures-dec" data-period-id="${periode.id}" data-phase="phase2" value="${periode.heuresJour !== null && periode.heuresJour !== undefined ? periode.heuresJour : ''}" step="0.01" style="width:90px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;">
                    <span style="font-weight:bold; font-size:13px;">=</span>
                    <input type="text" class="input-period-heures-hhmm" data-period-id="${periode.id}" data-phase="phase2" value="${periode.heuresJourHHMM || ''}" placeholder="HH:MM" style="width:80px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;" inputmode="numeric" autocomplete="off">
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <label style="min-width:90px; font-size:13px;">Pause offerte :</label>
                    <input type="number" class="input-period-pause" data-period-id="${periode.id}" data-phase="phase2" value="${periode.pauseOfferte !== null && periode.pauseOfferte !== undefined ? periode.pauseOfferte : ''}" min="0" step="1" style="width:100px; text-align:center; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;">
                    <span style="font-size:13px;">min</span>
                </div>
                <div style="background:#f8f9fa; border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                        <label style="min-width:90px; font-size:12px;">Plage d'arrivée :</label>
                        <input type="text" class="input-period-arrivee-min" data-period-id="${periode.id}" data-phase="phase2" value="${plageArriveeMin}" placeholder="HH:MM" style="width:80px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; text-align:center;" inputmode="numeric" autocomplete="off">
                        <span style="font-size:12px;">à</span>
                        <input type="text" class="input-period-arrivee-max" data-period-id="${periode.id}" data-phase="phase2" value="${plageArriveeMax}" placeholder="HH:MM" style="width:80px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; text-align:center;" inputmode="numeric" autocomplete="off">
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                        <label style="min-width:90px; font-size:12px;">Plage de départ :</label>
                        <input type="text" class="input-period-depart-min" data-period-id="${periode.id}" data-phase="phase2" value="${plageDepartMin}" placeholder="HH:MM" style="width:80px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; text-align:center;" inputmode="numeric" autocomplete="off">
                        <span style="font-size:12px;">à</span>
                        <input type="text" class="input-period-depart-max" data-period-id="${periode.id}" data-phase="phase2" value="${plageDepartMax}" placeholder="HH:MM" style="width:80px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; text-align:center;" inputmode="numeric" autocomplete="off">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Afficher toutes les périodes RHT d'une phase
function afficherPeriodesRHT(phase) {
    const container = document.getElementById(`rht-${phase}-container`);
    if (!container) return;
    
    const periodes = chargerPeriodesRHT(phase);
    
    // Trier les périodes par date de début
    const periodesTriees = [...periodes].sort((a, b) => {
        const dateA = toISO(a.debut);
        const dateB = toISO(b.debut);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
    });
    
    container.innerHTML = '';
    
    if (periodesTriees.length === 0) {
        // Afficher un bouton + pour créer la première période
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.textContent = '+';
        addButton.style.fontSize = '1.2em';
        addButton.style.padding = '8px 16px';
        addButton.style.cursor = 'pointer';
        addButton.addEventListener('click', function() {
            ajouterPeriodeRHT(phase);
            afficherPeriodesRHT(phase);
            actualiserAffichageRHT();
        });
        container.appendChild(addButton);
        return;
    }
    
    periodesTriees.forEach(periode => {
        const html = phase === 'phase1' ? genererHTMLPhase1(periode) : genererHTMLPhase2(periode);
        const div = document.createElement('div');
        div.innerHTML = html;
        container.appendChild(div.firstElementChild);
    });
    
    // Initialiser les formatages et event listeners après l'insertion
    initialiserPeriodesRHT(phase);
}

// Initialiser les formatages et event listeners pour une phase
function initialiserPeriodesRHT(phase) {
    const container = document.getElementById(`rht-${phase}-container`);
    if (!container) return;
    
    // Formatage automatique des champs JJ.MM.AA
    container.querySelectorAll('.input-period-debut, .input-period-fin').forEach(input => {
        formatJJMMAAInput(input);
        
        // Sauvegarde et validation au blur
        input.addEventListener('blur', function() {
            const periodeId = this.dataset.periodId;
            const field = this.classList.contains('input-period-debut') ? 'debut' : 'fin';
            modifierPeriodeRHT(phase, periodeId, { [field]: this.value });
            actualiserAffichageRHT();
        });
    });
    
    // Phase 2 : gestion des champs supplémentaires
    if (phase === 'phase2') {
        // Synchronisation heures décimal <-> HH:MM
        container.querySelectorAll('.input-period-heures-dec').forEach(input => {
            const periodeId = input.dataset.periodId;
            const hhmmInput = container.querySelector(`.input-period-heures-hhmm[data-period-id="${periodeId}"]`);
            
            if (hhmmInput) {
                input.addEventListener('input', function() {
                    const dec = parseFloat(this.value.replace(',', '.'));
                    if (!isNaN(dec)) {
                        const h = Math.floor(dec);
                        const m = Math.round((dec - h) * 60);
                        hhmmInput.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                        modifierPeriodeRHT(phase, periodeId, {
                            heuresJour: dec,
                            heuresJourHHMM: hhmmInput.value
                        });
                        actualiserAffichageRHT();
                    }
                });
            }
        });
        
        container.querySelectorAll('.input-period-heures-hhmm').forEach(input => {
            const periodeId = input.dataset.periodId;
            const decInput = container.querySelector(`.input-period-heures-dec[data-period-id="${periodeId}"]`);
            
            if (decInput) {
                input.addEventListener('input', function() {
                    if (/^\d{2}:\d{2}$/.test(this.value)) {
                        const [h, m] = this.value.split(':').map(Number);
                        const dec = h + m / 60;
                        decInput.value = dec.toFixed(2).replace('.', ',');
                        modifierPeriodeRHT(phase, periodeId, {
                            heuresJour: dec,
                            heuresJourHHMM: this.value
                        });
                        actualiserAffichageRHT();
                    }
                });
            }
        });
        
        // Pause offerte
        container.querySelectorAll('.input-period-pause').forEach(input => {
            input.addEventListener('blur', function() {
                const periodeId = this.dataset.periodId;
                const pause = parseInt(this.value) || null;
                modifierPeriodeRHT(phase, periodeId, { pauseOfferte: pause });
                actualiserAffichageRHT();
            });
        });
        
        // Plages horaires - Appliquer le formatage automatique
        container.querySelectorAll('.input-period-arrivee-min, .input-period-arrivee-max, .input-period-depart-min, .input-period-depart-max').forEach(input => {
            // Appliquer le formatage automatique HH:MM
            formatHeureInput(input);
            
            // Sauvegarde au blur (après le formatage)
            input.addEventListener('blur', function() {
                const periodeId = this.dataset.periodId;
                const field = this.classList.contains('input-period-arrivee-min') ? 'plageArriveeMin' :
                              this.classList.contains('input-period-arrivee-max') ? 'plageArriveeMax' :
                              this.classList.contains('input-period-depart-min') ? 'plageDepartMin' :
                              'plageDepartMax';
                
                modifierPeriodeRHT(phase, periodeId, { [field]: this.value });
                actualiserAffichageRHT();
            });
        });
        
        // Formatage pour le champ heures/jour HH:MM aussi
        container.querySelectorAll('.input-period-heures-hhmm').forEach(input => {
            // Appliquer le formatage automatique HH:MM
            formatHeureInput(input);
        });
    }
}

// Fonction utilitaire pour formater les inputs JJ.MM.AA
function formatJJMMAAInput(input) {
    if (!input) return;
    input.addEventListener('input', function() {
        let v = input.value.replace(/[^0-9]/g, '').slice(0, 6);
        if (v.length >= 5) input.value = v.slice(0, 2) + '.' + v.slice(2, 4) + '.' + v.slice(4, 6);
        else if (v.length >= 3) input.value = v.slice(0, 2) + '.' + v.slice(2, 4);
        else input.value = v;
    });
}

// Actualiser l'affichage et les calculs RHT
function actualiserAffichageRHT() {
    // Mettre à jour les plages horaires globales
    mettreAJourPlagesRHTGlobales();
    
    // Vérifier les chevauchements
    afficherMessageChevauchement();
    
    // Mettre à jour le tableau des jours si la fonction existe
    if (typeof afficherJours === 'function') {
        afficherJours();
    }
    
    // Mettre à jour l'affichage des modules RHT
    if (typeof initialiserAffichageModulesRHT === 'function') {
        initialiserAffichageModulesRHT();
    }
}

// Gestion des événements pour les boutons des périodes (délégation d'événements)
function initialiserGestionPeriodesRHT() {
    // Conteneur principal de la section RHT
    const sectionRHT = document.getElementById('parametres-rht-section');
    if (!sectionRHT) return;
    
    // Délégation d'événements pour les boutons
    sectionRHT.addEventListener('click', function(e) {
        // Bouton supprimer
        if (e.target.classList.contains('btn-delete-period') || e.target.closest('.btn-delete-period')) {
            const btn = e.target.classList.contains('btn-delete-period') ? e.target : e.target.closest('.btn-delete-period');
            const periodeId = btn.dataset.periodId;
            const phase = btn.dataset.phase;
            
            if (confirm('Êtes-vous sûr de vouloir supprimer cette période ?')) {
                supprimerPeriodeRHT(phase, periodeId);
                afficherPeriodesRHT(phase);
                actualiserAffichageRHT();
            }
            e.stopPropagation();
            return;
        }
        
        // Bouton ajouter après
        if (e.target.classList.contains('btn-add-period-after') || e.target.closest('.btn-add-period-after')) {
            const btn = e.target.classList.contains('btn-add-period-after') ? e.target : e.target.closest('.btn-add-period-after');
            const periodeId = btn.dataset.periodId;
            const phase = btn.dataset.phase;
            
            ajouterPeriodeRHT(phase);
            afficherPeriodesRHT(phase);
            actualiserAffichageRHT();
            e.stopPropagation();
            return;
        }
        
        // Bouton toggle activation
        if (e.target.classList.contains('btn-toggle-period') || e.target.closest('.btn-toggle-period')) {
            const btn = e.target.classList.contains('btn-toggle-period') ? e.target : e.target.closest('.btn-toggle-period');
            const periodeId = btn.dataset.periodId;
            const phase = btn.dataset.phase;
            
            const periode = obtenirPeriodeRHT(phase, periodeId);
            if (periode) {
                modifierPeriodeRHT(phase, periodeId, { enabled: !periode.enabled });
                afficherPeriodesRHT(phase);
                actualiserAffichageRHT();
            }
            e.stopPropagation();
            return;
        }
    });
    
    // Les boutons "Ajouter une période" sont maintenant dans chaque période (bouton +)
}

// Vérifier si deux périodes se chevauchent
function periodesSeChevauchent(periode1, periode2) {
    if (!periode1.enabled || !periode2.enabled) return false;
    if (!periode1.debut || !periode1.fin || !periode2.debut || !periode2.fin) return false;
    
    const start1 = toISO(periode1.debut);
    const end1 = toISO(periode1.fin);
    const start2 = toISO(periode2.debut);
    const end2 = toISO(periode2.fin);
    
    if (!start1 || !end1 || !start2 || !end2) return false;
    
    // Vérifier le chevauchement
    return !(end1 < start2 || end2 < start1);
}

// Fonction pour vérifier le chevauchement des plages RHT
function verifierChevauchementsRHT(periodeExclue = null) {
    const periodesPhase1 = chargerPeriodesRHT('phase1').filter(p => p.enabled);
    const periodesPhase2 = chargerPeriodesRHT('phase2').filter(p => p.enabled);
    
    const overlaps = [];
    
    // Vérifier les chevauchements entre Phase 1 et Phase 2
    for (const p1 of periodesPhase1) {
        if (periodeExclue && periodeExclue.id === p1.id && periodeExclue.phase === 'phase1') continue;
        
        for (const p2 of periodesPhase2) {
            if (periodeExclue && periodeExclue.id === p2.id && periodeExclue.phase === 'phase2') continue;
            
            if (periodesSeChevauchent(p1, p2)) {
                overlaps.push({
                    type: 'cross-phase',
                    periode1: p1,
                    periode2: p2,
                    message: `⚠️ Chevauchement : Une période Phase 1 (${p1.debut} - ${p1.fin}) et une période Phase 2 (${p2.debut} - ${p2.fin}) se chevauchent.`
                });
            }
        }
    }
    
    // Vérifier les chevauchements entre périodes de la même Phase 1
    for (let i = 0; i < periodesPhase1.length; i++) {
        for (let j = i + 1; j < periodesPhase1.length; j++) {
            const p1 = periodesPhase1[i];
            const p2 = periodesPhase1[j];
            
            if (periodeExclue && (periodeExclue.id === p1.id || periodeExclue.id === p2.id) && periodeExclue.phase === 'phase1') continue;
            
            if (periodesSeChevauchent(p1, p2)) {
                overlaps.push({
                    type: 'same-phase',
                    phase: 'phase1',
                    periode1: p1,
                    periode2: p2,
                    message: `⚠️ Chevauchement : Deux périodes Phase 1 se chevauchent (${p1.debut} - ${p1.fin} et ${p2.debut} - ${p2.fin}).`
                });
            }
        }
    }
    
    // Vérifier les chevauchements entre périodes de la même Phase 2
    for (let i = 0; i < periodesPhase2.length; i++) {
        for (let j = i + 1; j < periodesPhase2.length; j++) {
            const p1 = periodesPhase2[i];
            const p2 = periodesPhase2[j];
            
            if (periodeExclue && (periodeExclue.id === p1.id || periodeExclue.id === p2.id) && periodeExclue.phase === 'phase2') continue;
            
            if (periodesSeChevauchent(p1, p2)) {
                overlaps.push({
                    type: 'same-phase',
                    phase: 'phase2',
                    periode1: p1,
                    periode2: p2,
                    message: `⚠️ Chevauchement : Deux périodes Phase 2 se chevauchent (${p1.debut} - ${p1.fin} et ${p2.debut} - ${p2.fin}).`
                });
            }
        }
    }
    
    return {
        hasOverlap: overlaps.length > 0,
        overlaps: overlaps,
        message: overlaps.length > 0 ? overlaps.map(o => o.message).join(' ') : ''
    };
}

// Fonction pour vérifier le chevauchement (rétrocompatibilité)
function verifierChevauchementRHT() {
    const result = verifierChevauchementsRHT();
    return {
        hasOverlap: result.hasOverlap,
        message: result.message
    };
}

// Fonction pour afficher/masquer le message d'erreur de chevauchement
function afficherMessageChevauchement() {
    const messageContainer = document.getElementById('rht-overlap-message');
    if (!messageContainer) return;
    
    const { hasOverlap, message } = verifierChevauchementsRHT();
    
    if (hasOverlap) {
        messageContainer.textContent = message;
        messageContainer.style.display = 'block';
        messageContainer.style.color = '#d32f2f';
        messageContainer.style.backgroundColor = '#ffebee';
        messageContainer.style.padding = '8px 12px';
        messageContainer.style.borderRadius = '4px';
        messageContainer.style.marginTop = '8px';
        messageContainer.style.fontSize = '14px';
    } else {
        messageContainer.style.display = 'none';
    }
}

// Fonction d'initialisation de l'affichage des modules RHT au chargement de la page
function initialiserAffichageModulesRHT() {
    // Module 1 : calculette
    const calcRhtMode = document.getElementById('calc-rht-mode');
    if (calcRhtMode) {
        const calcRhtEnabled = calcRhtMode.checked;
        gererAffichageModuleRHT('calc', calcRhtEnabled);
    }
    
    // Module 2 : simulateur
    const zeroRhtMode = document.getElementById('zero-rht-mode');
    if (zeroRhtMode) {
        const zeroRhtEnabled = zeroRhtMode.checked;
        gererAffichageModuleRHT('zero', zeroRhtEnabled);
    }
}

// Lors de la pose d'un jour RHT dans le calendrier vacances, on l'ajoute à joursRHT
// (à placer dans la logique de sélection du calendrier vacances)
// ... existing code ...

// ... existing code ...
function updateCompteursAbsences() {
    const compteurVac = document.getElementById('compteur-vacances');
    const compteurRTT = document.getElementById('compteur-rtt');
    const compteurRHT = document.getElementById('compteur-rht');
    const compteurRattrapes = document.getElementById('compteur-rattrapes');
    const compteurFeries = document.getElementById('compteur-feries');
    const compteurRTTHeures = document.getElementById('compteur-rtt-heures');
    const compteurRHTHeures = document.getElementById('compteur-rht-heures');
    let joursVacances = JSON.parse(localStorage.getItem('joursVacances')) || [];
    let joursRTT = JSON.parse(localStorage.getItem('joursRTT')) || [];
    let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
    let joursFeries = JSON.parse(localStorage.getItem('joursFeries')) || [];
    let joursRattrapes = JSON.parse(localStorage.getItem('joursRattrapes')) || [];
    // Heures à faire par jour (en minutes)
    let minutesJour = (typeof getHeuresJourMinutes === 'function') ? getHeuresJourMinutes() : (parseFloat(localStorage.getItem('heuresJour')) || 7.5) * 60;
    let heuresJour = minutesJour / 60;
    if (compteurVac) compteurVac.textContent = joursVacances.length;
    if (compteurRTT) compteurRTT.textContent = joursRTT.length;
    if (compteurRHT) compteurRHT.textContent = joursRHT.length;
    if (compteurRattrapes) compteurRattrapes.textContent = joursRattrapes.length;
    if (compteurFeries) compteurFeries.textContent = joursFeries.length;
    if (compteurRTTHeures) compteurRTTHeures.textContent = (joursRTT.length * heuresJour).toFixed(2).replace('.', ',');
    if (compteurRHTHeures) compteurRHTHeures.textContent = (joursRHT.length * heuresJour).toFixed(2).replace('.', ',');
}
// Appel initial des compteurs d'absences au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        updateCompteursAbsences();
        initialiserAffichageModulesRHT();
        // Vérifier le chevauchement des plages RHT au chargement
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
} else {
    updateCompteursAbsences();
    initialiserAffichageModulesRHT();
    // Vérifier le chevauchement des plages RHT au chargement
    if (typeof afficherMessageChevauchement === 'function') {
        afficherMessageChevauchement();
    }
}
// ... existing code ...

// ... existing code ...
// --- Paramètres: gestion de l'onglet RHT et des champs ---
(function() {
    // Migration des données au chargement
    migrerDonneesRHT();
    
    const tabGeneral = document.getElementById('param-tab-general');
    const tabRHT = document.getElementById('param-tab-rht');
    const tabSalaire = document.getElementById('param-tab-salaire');
    const sectionRHT = document.getElementById('parametres-rht-section');
    const sectionGeneral = document.getElementById('parametres-general-section');
    const sectionSalaire = document.getElementById('parametres-salaire-section');

    function resetTabs() {
        [tabGeneral, tabRHT, tabSalaire].forEach(btn => {
            if (!btn) return;
            btn.style.background = '#fff';
            btn.style.color = '#1976d2';
        });
        if (sectionGeneral) sectionGeneral.style.display = 'none';
        if (sectionRHT) sectionRHT.style.display = 'none';
        if (sectionSalaire) sectionSalaire.style.display = 'none';
    }

    function showGeneral() {
        resetTabs();
        if (sectionGeneral) sectionGeneral.style.display = 'flex';
        if (tabGeneral) { tabGeneral.style.background = '#1976d2'; tabGeneral.style.color = '#fff'; }
    }
    function showRHT() {
        resetTabs();
        if (sectionRHT) sectionRHT.style.display = 'flex';
        if (tabRHT) { tabRHT.style.background = '#1976d2'; tabRHT.style.color = '#fff'; }
        
        // Charger l'affichage des périodes quand on ouvre l'onglet RHT
        afficherPeriodesRHT('phase1');
        afficherPeriodesRHT('phase2');
        afficherMessageChevauchement();
    }
    function showSalaire() {
        resetTabs();
        if (sectionSalaire) sectionSalaire.style.display = 'flex';
        if (tabSalaire) { tabSalaire.style.background = '#1976d2'; tabSalaire.style.color = '#fff'; }
        if (typeof initialiserParametresSalaire === 'function') {
            initialiserParametresSalaire();
        }
    }

    if (tabGeneral) tabGeneral.addEventListener('click', showGeneral);
    if (tabRHT) tabRHT.addEventListener('click', showRHT);
    if (tabSalaire) tabSalaire.addEventListener('click', showSalaire);
    
    // Initialiser la gestion des périodes
    initialiserGestionPeriodesRHT();
    
    // Initialiser l'affichage au chargement si l'onglet RHT est visible
    if (sectionRHT && sectionRHT.style.display !== 'none') {
        afficherPeriodesRHT('phase1');
        afficherPeriodesRHT('phase2');
    }

    // Champs RHT phase 1
    const rhtPhase1Enabled = document.getElementById('param-rht-phase1-enabled');
    const rhtPhase1Debut = document.getElementById('param-rht-phase1-debut');
    const rhtPhase1Fin = document.getElementById('param-rht-phase1-fin');
    
    // Champs RHT phase 2
    const rhtEnabled = document.getElementById('param-rht-enabled');
    const rhtDebut = document.getElementById('param-rht-debut');
    const rhtFin = document.getElementById('param-rht-fin');
    const rhtHeuresDec = document.getElementById('param-rht-heures-jour-dec');
    const rhtHeuresHHMM = document.getElementById('param-rht-heures-jour-hhmm');
    const rhtPauseOfferte = document.getElementById('param-rht-pause-offerte');

    function formatJJMMAAInput(input) {
        if (!input) return;
        input.addEventListener('input', function() {
            let v = input.value.replace(/[^0-9]/g, '').slice(0,6);
            if (v.length >= 5) input.value = v.slice(0,2) + '.' + v.slice(2,4) + '.' + v.slice(4,6);
            else if (v.length >= 3) input.value = v.slice(0,2) + '.' + v.slice(2,4);
            else input.value = v;
        });
    }
    formatJJMMAAInput(rhtPhase1Debut);
    formatJJMMAAInput(rhtPhase1Fin);
    formatJJMMAAInput(rhtDebut);
    formatJJMMAAInput(rhtFin);

    function hhmmToDec(val) {
        if (!/^\d{2}:\d{2}$/.test(val)) return null;
        const [h,m] = val.split(':').map(Number);
        return h + m/60;
    }
    function decToHHMM(dec) {
        if (dec == null || isNaN(dec)) return '';
        const h = Math.floor(dec);
        const m = Math.round((dec - h)*60);
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    }

    // Restauration phase 1
    if (rhtPhase1Enabled) rhtPhase1Enabled.checked = localStorage.getItem('param-rht-phase1-enabled') === 'true';
    if (rhtPhase1Debut) rhtPhase1Debut.value = localStorage.getItem('param-rht-phase1-debut') || '';
    if (rhtPhase1Fin) rhtPhase1Fin.value = localStorage.getItem('param-rht-phase1-fin') || '';
    
    // Restauration phase 2
    if (rhtEnabled) rhtEnabled.checked = localStorage.getItem('rht_enabled') === 'true';
    if (rhtDebut) rhtDebut.value = localStorage.getItem('rht_debut') || '';
    if (rhtFin) rhtFin.value = localStorage.getItem('rht_fin') || '';
    if (rhtHeuresDec) rhtHeuresDec.value = localStorage.getItem('rht_heures_dec') || '';
    if (rhtHeuresHHMM) rhtHeuresHHMM.value = localStorage.getItem('rht_heures_hhmm') || '';
    if (rhtPauseOfferte) rhtPauseOfferte.value = localStorage.getItem('rht_pause_offerte') || '';

    // Synchronisation heures décimal <-> HH:MM
    if (rhtHeuresDec && rhtHeuresHHMM) {
        rhtHeuresDec.addEventListener('input', function() {
            const dec = parseFloat(this.value.replace(',', '.'));
            if (!isNaN(dec)) rhtHeuresHHMM.value = decToHHMM(dec);
            localStorage.setItem('rht_heures_dec', this.value);
            localStorage.setItem('rht_heures_hhmm', rhtHeuresHHMM.value);
        });
        rhtHeuresHHMM.addEventListener('input', function() {
            const dec = hhmmToDec(this.value);
            if (dec != null) rhtHeuresDec.value = dec.toFixed(2).replace('.', ',');
            localStorage.setItem('rht_heures_hhmm', this.value);
            localStorage.setItem('rht_heures_dec', rhtHeuresDec.value);
        });
    }

    // Sauvegardes phase 1
    if (rhtPhase1Enabled) rhtPhase1Enabled.addEventListener('change', function() {
        localStorage.setItem('param-rht-phase1-enabled', String(this.checked));
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    if (rhtPhase1Debut) rhtPhase1Debut.addEventListener('blur', function() {
        localStorage.setItem('param-rht-phase1-debut', rhtPhase1Debut.value);
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    if (rhtPhase1Fin) rhtPhase1Fin.addEventListener('blur', function() {
        localStorage.setItem('param-rht-phase1-fin', rhtPhase1Fin.value);
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    
    // Sauvegardes phase 2
    if (rhtEnabled) rhtEnabled.addEventListener('change', function() {
        localStorage.setItem('rht_enabled', String(this.checked));
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    if (rhtDebut) rhtDebut.addEventListener('blur', function() {
        localStorage.setItem('rht_debut', rhtDebut.value);
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    if (rhtFin) rhtFin.addEventListener('blur', function() {
        localStorage.setItem('rht_fin', rhtFin.value);
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });
    if (rhtPauseOfferte) rhtPauseOfferte.addEventListener('input', function() {
        localStorage.setItem('rht_pause_offerte', rhtPauseOfferte.value);
        // Mettre à jour le tableau immédiatement
        if (typeof afficherJours === 'function') {
            afficherJours();
        }
        // Mettre à jour l'affichage des modules selon le nouveau paramètre
        if (typeof initialiserAffichageModulesRHT === 'function') {
            initialiserAffichageModulesRHT();
        }
        // Vérifier le chevauchement des plages
        if (typeof afficherMessageChevauchement === 'function') {
            afficherMessageChevauchement();
        }
    });

    // Par défaut on montre l'onglet Général au chargement
    showGeneral();
})();
// ... existing code ...

// ... existing code ...
// Module 2: RHT toggle - affichage conditionnel des champs
(function() {
    const rhtToggle = document.getElementById('zero-rht-mode');
    const midiGroup = document.getElementById('zero-midi-group');
    if (!rhtToggle || !midiGroup) return;
    
    // Restauration
    const saved = localStorage.getItem('zero_rht_mode') === 'true';
    rhtToggle.checked = saved;
    
    // Appliquer l'affichage initial selon l'état sauvegardé
    gererAffichageModuleRHT('zero', saved);
    
    // S'assurer que la mise en forme couleur des plages est correcte au chargement
    if (typeof updateZeroPlages === 'function') {
        // Appel après restauration de l'état du toggle
        setTimeout(() => {
            updateZeroPlages();
            if (typeof calculerHeuresSupZero === 'function') calculerHeuresSupZero();
        }, 0);
    }
    
    rhtToggle.addEventListener('change', function() {
        const enabled = rhtToggle.checked;
        localStorage.setItem('zero_rht_mode', String(enabled));
        
        // Appliquer l'affichage conditionnel
        gererAffichageModuleRHT('zero', enabled);
    });
})();
// ... existing code ...

// ... existing code ...
// Module 1: RHT toggle - affichage conditionnel des champs
(function() {
    const rhtToggle = document.getElementById('calc-rht-mode');
    const midiGroup = document.getElementById('calc-midi-group');
    if (!rhtToggle || !midiGroup) return;
    
    const saved = localStorage.getItem('calc_rht_mode') === 'true';
    rhtToggle.checked = saved;
    
    // Appliquer l'affichage initial selon l'état sauvegardé
    gererAffichageModuleRHT('calc', saved);
    
    rhtToggle.addEventListener('change', function() {
        const enabled = rhtToggle.checked;
        localStorage.setItem('calc_rht_mode', String(enabled));
        
        // Appliquer l'affichage conditionnel
        gererAffichageModuleRHT('calc', enabled);
        
        // Recalculer si besoin
        if (typeof updateCalculateur === 'function') {
            lastInput = 'calc-arrivee';
            updateCalculateur();
        }
    });
})();
// ... existing code ...

// Obtenir la période RHT active pour une date donnée
function obtenirPeriodeRHTPourDate(dateStr, phase) {
    const periodes = chargerPeriodesRHT(phase).filter(p => p.enabled);
    const dateISO = dateStr;
    
    for (const periode of periodes) {
        if (!periode.debut || !periode.fin) continue;
        
        const start = toISO(periode.debut);
        const end = toISO(periode.fin);
        
        if (!start || !end) continue;
        
        if (dateISO >= start && dateISO <= end) {
            return periode;
        }
    }
    
    return null;
}

// Vérifier si une date est dans une période RHT Phase 2
function isDateInRHT(dateStr) {
    const periode = obtenirPeriodeRHTPourDate(dateStr, 'phase2');
    return periode !== null;
}

// Vérifier si une date est dans une période RHT Phase 1
function isDateInRHTPhase1(dateStr) {
    const periode = obtenirPeriodeRHTPourDate(dateStr, 'phase1');
    return periode !== null;
}

// Obtenir toutes les périodes RHT actives pour une date
function obtenirPeriodesRHTPourDate(dateStr) {
    return {
        phase1: obtenirPeriodeRHTPourDate(dateStr, 'phase1'),
        phase2: obtenirPeriodeRHTPourDate(dateStr, 'phase2')
    };
}

function getHeuresJourMinutesEffective(dateStr) {
    // Si RHT Phase 2 actif et date dans plage: utiliser param RHT; sinon valeur standard
    const periodeRHT = obtenirPeriodeRHTPourDate(dateStr, 'phase2');
    if (periodeRHT && periodeRHT.heuresJour !== null && !isNaN(periodeRHT.heuresJour)) {
        return Math.round(periodeRHT.heuresJour * 60);
    }
    return (typeof getHeuresJourMinutes === 'function') ? getHeuresJourMinutes() : Math.round(((parseFloat(localStorage.getItem('heuresJour')) || 7.5) * 60));
}
function getPauseOfferteEffective(dateStr) {
    const periodeRHT = obtenirPeriodeRHTPourDate(dateStr, 'phase2');
    if (periodeRHT && periodeRHT.pauseOfferte !== null && !isNaN(periodeRHT.pauseOfferte)) {
        return parseInt(periodeRHT.pauseOfferte);
    }
    return parseInt(localStorage.getItem('pauseOfferte')) || 15;
}

// Convertir HH:MM en minutes
function hhmmToMinutes(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

// Obtenir les plages horaires RHT pour une date donnée (Phase 2)
function obtenirPlagesHorairesRHT(dateStr) {
    const periodeRHT = obtenirPeriodeRHTPourDate(dateStr, 'phase2');
    if (!periodeRHT) {
        // Retourner les valeurs par défaut si aucune période n'est trouvée
        return {
            arriveeMin: 480, // 08:00
            arriveeMax: 600, // 10:00
            departMin: 945,  // 15:45
            departMax: 1080  // 18:00
        };
    }
    
    return {
        arriveeMin: hhmmToMinutes(periodeRHT.plageArriveeMin) || 480,
        arriveeMax: hhmmToMinutes(periodeRHT.plageArriveeMax) || 600,
        departMin: hhmmToMinutes(periodeRHT.plageDepartMin) || 945,
        departMax: hhmmToMinutes(periodeRHT.plageDepartMax) || 1080
    };
}

// Obtenir les plages horaires RHT pour aujourd'hui (pour les calculatrices)
function obtenirPlagesHorairesRHTAujourdhui() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return obtenirPlagesHorairesRHT(todayStr);
}

// Accumulateurs RHT
function resetRHTAccumulators() {
    // Réinitialise uniquement les accumulateurs volatils de la vue (pas persistant cumulatif)
    sessionStorage.setItem('rht_heures_perdues_view', '0');
    sessionStorage.setItem('rht_heures_supp_view', '0');
}
function addRHTPerdues(hours) {
    // Accumule pour l'affichage courant (mois affiché) pour éviter l'incrément au refresh
    let curView = parseFloat(sessionStorage.getItem('rht_heures_perdues_view')) || 0;
    curView += hours;
    sessionStorage.setItem('rht_heures_perdues_view', curView.toString());
}
function addRHTSupp(hours) {
    let curView = parseFloat(sessionStorage.getItem('rht_heures_supp_view')) || 0;
    curView += hours;
    sessionStorage.setItem('rht_heures_supp_view', curView.toString());
}

// Adapter afficherJours pour RHT
const _afficherJours = afficherJours;
afficherJours = function() {
    // Reset des accumulateurs avant recalcul
    resetRHTAccumulators();
    
    // Appel original pour préparer DOM et afficher le total standard
    _afficherJours();
    
    // Maintenant on recalcule seulement les accumulateurs RHT pour le mois affiché
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    console.log('Recalcul RHT pour mois:', moisStr, 'année:', anneeStr, 'currentMonth:', currentMonth, 'currentYear:', currentYear);
    
    const joursAffiches = jours.filter(j => {
        const [y, m] = j.date.split('-');
        return y === anneeStr && m === moisStr;
    });
    console.log('Jours filtrés pour ce mois:', joursAffiches.length, 'sur', jours.length, 'total');
    
    // Recalcul des accumulateurs RHT seulement
    joursAffiches.forEach(jour => {
        const inRHT = isDateInRHT(jour.date);
        const inRHTPhase1 = isDateInRHTPhase1(jour.date);
        
        if (inRHT || inRHTPhase1) {
            // heures à faire du jour en minutes
            const heuresJourMinEff = getHeuresJourMinutesEffective(jour.date);
            // pause offerte effective
            const pauseOffEff = getPauseOfferteEffective(jour.date);
            // Recalcul des heures travaillées (utilise la pause offerte RHT et ignore le minimum midi en RHT)
            let heuresTrav = parseFloat(calculerHeuresAvecPause(
                jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                jour.pausesAvant, jour.pausesApres,
                pauseOffEff,
                true
            ));
            const ecartHeures = heuresTrav - (heuresJourMinEff/60);
            
            if (inRHTPhase1) {
                // Phase 1 RHT : toutes les heures vont dans les compteurs RHT du dashboard
                if (ecartHeures > 0) addRHTPerdues(ecartHeures);
                else if (ecartHeures < 0) addRHTSupp(Math.abs(ecartHeures));
            } else if (inRHT) {
                // Phase 2 RHT : comportement normal
                if (ecartHeures > 0) addRHTPerdues(ecartHeures);
                else if (ecartHeures < 0) addRHTSupp(Math.abs(ecartHeures));
            }
        }
    });
    
    // Mettre à jour les compteurs RHT
    updateCompteursAbsences();
};

// Met à jour aussi les compteurs RHT perdus/supplémentaire
function updateCompteursAbsences() {
    const compteurVac = document.getElementById('compteur-vacances');
    const compteurRTT = document.getElementById('compteur-rtt');
    const compteurRHT = document.getElementById('compteur-rht');
    const compteurRattrapes = document.getElementById('compteur-rattrapes');
    const compteurFeries = document.getElementById('compteur-feries');
    const compteurRTTHeures = document.getElementById('compteur-rtt-heures');
    const compteurRHTHeures = document.getElementById('compteur-rht-heures');
    let joursVacances = JSON.parse(localStorage.getItem('joursVacances')) || [];
    let joursRTT = JSON.parse(localStorage.getItem('joursRTT')) || [];
    let joursRHT = JSON.parse(localStorage.getItem('joursRHT')) || [];
    let joursFeries = JSON.parse(localStorage.getItem('joursFeries')) || [];
    let joursRattrapes = JSON.parse(localStorage.getItem('joursRattrapes')) || [];
    // Heures à faire par jour (en minutes)
    let minutesJour = (typeof getHeuresJourMinutes === 'function') ? getHeuresJourMinutes() : (parseFloat(localStorage.getItem('heuresJour')) || 7.5) * 60;
    let heuresJour = minutesJour / 60;
    if (compteurVac) compteurVac.textContent = joursVacances.length;
    if (compteurRTT) compteurRTT.textContent = joursRTT.length;
    if (compteurRHT) compteurRHT.textContent = joursRHT.length;
    if (compteurRattrapes) compteurRattrapes.textContent = joursRattrapes.length;
    if (compteurFeries) compteurFeries.textContent = joursFeries.length;
    if (compteurRTTHeures) compteurRTTHeures.textContent = (joursRTT.length * heuresJour).toFixed(2).replace('.', ',');
    if (compteurRHTHeures) compteurRHTHeures.textContent = (joursRHT.length * heuresJour).toFixed(2).replace('.', ',');
    // RHT perdus/supplémentaire mensuels
    const perduesEl = document.getElementById('compteur-rht-perdues');
    const suppEl = document.getElementById('compteur-rht-supp');
    if (perduesEl) perduesEl.textContent = (parseFloat(sessionStorage.getItem('rht_heures_perdues_view')) || 0).toFixed(2).replace('.', ',');
    if (suppEl) suppEl.textContent = (parseFloat(sessionStorage.getItem('rht_heures_supp_view')) || 0).toFixed(2).replace('.', ',');
    
    // RHT perdus/supplémentaire annuels
    const perduesAnneeEl = document.getElementById('compteur-rht-perdues-annee');
    const suppAnneeEl = document.getElementById('compteur-rht-supp-annee');
    
    if (perduesAnneeEl || suppAnneeEl) {
        let totalPerduesAnnee = 0;
        let totalSuppAnnee = 0;
        
        // Parcourir tous les jours pour calculer les totaux annuels
        jours.forEach(jour => {
            const inRHT = isDateInRHT(jour.date);
            const inRHTPhase1 = isDateInRHTPhase1(jour.date);
            
            if (inRHT || inRHTPhase1) {
                // heures à faire du jour en minutes
                const heuresJourMinEff = getHeuresJourMinutesEffective(jour.date);
                // pause offerte effective
                const pauseOffEff = getPauseOfferteEffective(jour.date);
                // Calcul des heures travaillées
                let heuresTrav = parseFloat(calculerHeuresAvecPause(
                    jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart,
                    jour.pausesAvant, jour.pausesApres,
                    pauseOffEff,
                    true
                ));
                const ecartHeures = heuresTrav - (heuresJourMinEff/60);
                
                if (ecartHeures > 0) {
                    totalPerduesAnnee += ecartHeures;
                } else if (ecartHeures < 0) {
                    totalSuppAnnee += Math.abs(ecartHeures);
                }
            }
        });
        
        // Afficher les totaux annuels
        if (perduesAnneeEl) perduesAnneeEl.textContent = totalPerduesAnnee.toFixed(2).replace('.', ',');
        if (suppAnneeEl) suppAnneeEl.textContent = totalSuppAnnee.toFixed(2).replace('.', ',');
    }
}

// Module 3: RHT toggle pour le mode RHT
(function() {
    const rhtToggle = document.getElementById('pause3-rht-mode');
    if (!rhtToggle) return;
    
    // Restauration de l'état sauvegardé
    const saved = localStorage.getItem('pause3_rht_mode') === 'true';
    rhtToggle.checked = saved;
    
    // Mettre à jour l'affichage initial
    if (typeof updatePause3Total === 'function') {
        setTimeout(() => {
            updatePause3Total();
        }, 0);
    }
    
    // Gestion du changement d'état
    rhtToggle.addEventListener('change', function() {
        const enabled = this.checked;
        localStorage.setItem('pause3_rht_mode', String(enabled));
        
        // Mettre à jour l'affichage
        if (typeof updatePause3Total === 'function') {
            updatePause3Total();
        }
    });
})();