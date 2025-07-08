// Script principal du calculateur d'horaires de travail

// Récupération des éléments du DOM
const form = document.getElementById('horaire-form');
const tableBody = document.querySelector('#table-jours tbody');
const heuresJourInput = document.getElementById('heures-jour');
const heuresJourHHMM = document.getElementById('heures-jour-hhmm');
const pauseOfferteInput = document.getElementById('pause-offerte-min');
// Ajout : sélecteur mois/année jours saisis
const selectMoisJoursSaisis = document.getElementById('mois-jours-saisis');
const anneeJoursSaisis = document.getElementById('annee-jours-saisis');

// Récupération ou initialisation des données
let jours = JSON.parse(localStorage.getItem('jours')) || [];
let joursVacances = JSON.parse(localStorage.getItem('joursVacances')) || [];
let joursRTT = JSON.parse(localStorage.getItem('joursRTT')) || [];
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
    prevYearBtn.onclick = () => { currentYear--; renderCalendrier(currentMonth, currentYear); };
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
    nextYearBtn.onclick = () => { currentYear++; renderCalendrier(currentMonth, currentYear); };
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
    prevMonthBtn.onclick = () => { currentMonth--; if(currentMonth < 0){ currentMonth=11; currentYear--; } renderCalendrier(currentMonth, currentYear); };
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
    nextMonthBtn.onclick = () => { currentMonth++; if(currentMonth > 11){ currentMonth=0; currentYear++; } renderCalendrier(currentMonth, currentYear); };
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
        if(jours.some(j => j.date === dateStr)) td.classList.add('jour-rempli');
        // Mise en évidence si sélectionné
        if(selectedDate === dateStr) td.classList.add('jour-selectionne');
        // Mise en évidence vacances/RTT uniquement pour les jours (pas pour la colonne semaine)
        if (td.textContent && !isNaN(td.textContent)) {
            if(isJourVacances(dateStr)) td.classList.add('jour-vacances');
            if(isJourRTT(dateStr)) td.classList.add('jour-rtt');
        }
        
        // Gestion des jours non travaillés (grisés)
        if (!estJourTravaille) {
            td.classList.add('jour-non-travaille');
            td.onclick = null; // Désactiver le clic
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
    // Ne pas relire les données depuis le localStorage si elles sont déjà en mémoire
    // Cela évite les problèmes de synchronisation lors des modifications en temps réel
    renderCalendrier(currentMonth, currentYear);
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
    // On crée un Set de tous les jours du mois affiché (jours RTT inclus même sans saisie d'horaire)
    const joursRTTSet = new Set(joursRTT);
    // On affiche les jours saisis
    jours.forEach((jour, idx) => {
        const isVac = isJourVacances(jour.date);
        const isRtt = isJourRTT(jour.date);
        const isJourTravailleJour = isJourTravaille(jour.date);
        const tr = document.createElement('tr');
        // Calcul dynamique des heures travaillées et de l'écart
        let heuresTravDyn = (isVac || isRtt) ? 0 : parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pausesAvant, jour.pausesApres));
        let ecartDyn = (isVac || isRtt) ? 0 : heuresTravDyn - heuresJour;
        let ecartAfficheDyn = (isVac || isRtt) ? (isRtt ? '-' : '') + heuresJour.toFixed(2) : (ecartDyn >= 0 ? '+' : '') + ecartDyn.toFixed(2);
        const ecartClassDyn = ecartDyn >= 0 ? 'ecart-positif' : 'ecart-negatif';
        totalEcart += ecartDyn;
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
        let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
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
        // Conversion de l'écart en HH:MM
        const ecartMinutes = Math.round(ecartDyn * 60);
        const signe = ecartMinutes >= 0 ? '+' : '-';
        const absMinutes = Math.abs(ecartMinutes);
        const hh = String(Math.floor(absMinutes / 60)).padStart(2, '0');
        const mm = String(absMinutes % 60).padStart(2, '0');
        const ecartHHMM = `${signe}${hh}:${mm}`;
        // Couleur plus claire selon le signe
        let ecartHHMMColor = '#8bc34a'; // vert clair par défaut
        if (ecartDyn < 0) ecartHHMMColor = '#ff8a80'; // rouge clair
        else if (ecartDyn === 0) ecartHHMMColor = '#bdbdbd'; // gris clair
        else ecartHHMMColor = '#8bc34a'; // vert clair
        tr.innerHTML = `
            <td>${formaterDate(jour.date)}</td>
            <td>${jour.arrivee}</td>
            <td>${midiCell}</td>
            <td class="pause-cell">${pauseCell}</td>
            <td>${jour.depart}</td>
            <td>${(isVac || isRtt) ? '0.00' : heuresTravDyn.toFixed(2)}<br><span style="font-size:0.95em;color:#555;">${heuresTravHHMM}</span></td>
            <td class="${ecartClassDyn}">${ecartAfficheDyn}<br><span style="font-size:0.95em; color:${ecartHHMMColor}; font-weight:normal;">${ecartHHMM}</span></td>
            <td><button class="btn-supprimer" data-idx="${idx}">Supprimer</button></td>
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
    
    // Ajouter les heures supplémentaires au total
    totalEcart += heuresSupplementaires;
    
    // Affichage du total d'heures supplémentaires
    const totalEcartDiv = document.getElementById('total-ecart');
    const totalClass = totalEcart >= 0 ? 'ecart-positif' : 'ecart-negatif';
    totalEcartDiv.innerHTML = `Total d'heures supplémentaires : <span class="${totalClass}">${totalEcart >= 0 ? '+' : ''}${totalEcart.toFixed(2)}</span>`;
    // Ajout des listeners pour les boutons supprimer
    document.querySelectorAll('.btn-supprimer').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-idx'));
            jours.splice(idx, 1);
            localStorage.setItem('jours', JSON.stringify(jours));
            afficherJours();
        });
    });
    majCalendrier();
}

// Gestion du formulaire (adaptée pour la pause)
form.addEventListener('submit', function(e) {
    e.preventDefault();
    const date = form.date.value;
    const arrivee = form['arrivee'].value;
    const pauseDejDebut = form['pause-debut'].value;
    const pauseDejFin = form['pause-fin'].value;
    const depart = form['depart'].value;
    // On ne gère plus pauseSupActive, pause2Debut, pause2Fin
    // On sauvegarde les pauses dynamiques
    const jourData = {
        date,
        arrivee,
        pauseDejDebut,
        pauseDejFin,
        depart,
        pausesAvant: JSON.parse(JSON.stringify(pausesAvant)),
        pausesApres: JSON.parse(JSON.stringify(pausesApres)),
        heuresTravaillees: parseFloat(calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApres)),
        ecart: calculerEcart(parseFloat(calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pausesAvant, pausesApres)), heuresJour)
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
document.getElementById('export-excel').addEventListener('click', function() {
    // Préparation des données détaillées pour Excel
    const maxPausesAvant = Math.max(0, ...jours.map(j => Array.isArray(j.pausesAvant) ? j.pausesAvant.length : 0));
    const maxPausesApres = Math.max(0, ...jours.map(j => Array.isArray(j.pausesApres) ? j.pausesApres.length : 0));
    const headers = [
        'Date', 'Arrivée', 'Départ',
        'Pause midi début', 'Pause midi fin',
        ...Array.from({length: maxPausesAvant}, (_, i) => `Pause avant midi ${i+1} début`),
        ...Array.from({length: maxPausesAvant}, (_, i) => `Pause avant midi ${i+1} fin`),
        ...Array.from({length: maxPausesApres}, (_, i) => `Pause après midi ${i+1} début`),
        ...Array.from({length: maxPausesApres}, (_, i) => `Pause après midi ${i+1} fin`),
        'Heures travaillées', 'Écart'
    ];
    const wsData = [headers];
    jours.forEach(jour => {
        const row = [
            jour.date,
            jour.arrivee,
            jour.depart,
            jour.pauseDejDebut,
            jour.pauseDejFin
        ];
        // Pauses avant midi
        for (let i = 0; i < maxPausesAvant; i++) {
            row.push(jour.pausesAvant && jour.pausesAvant[i] ? jour.pausesAvant[i].debut : '');
        }
        for (let i = 0; i < maxPausesAvant; i++) {
            row.push(jour.pausesAvant && jour.pausesAvant[i] ? jour.pausesAvant[i].fin : '');
        }
        // Pauses après midi
        for (let i = 0; i < maxPausesApres; i++) {
            row.push(jour.pausesApres && jour.pausesApres[i] ? jour.pausesApres[i].debut : '');
        }
        for (let i = 0; i < maxPausesApres; i++) {
            row.push(jour.pausesApres && jour.pausesApres[i] ? jour.pausesApres[i].fin : '');
        }
        row.push(jour.heuresTravaillees);
        row.push(jour.ecart);
        wsData.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horaires');
    // Génère le fichier dans le dossier du projet (pour Node.js ou Electron)
    if (typeof require !== 'undefined' && typeof window === 'undefined') {
        // Node.js : écrire le fichier dans le dossier du projet
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, 'export_horaires.xlsx');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        fs.writeFileSync(filePath, wbout);
        alert('Fichier export_horaires.xlsx créé dans le dossier du projet.');
    } else {
        // Navigateur : téléchargement classique
        XLSX.writeFile(wb, 'export_horaires.xlsx');
    }
});

// --- Import Excel ---
const importInput = document.getElementById('import-excel');
document.getElementById('import-excel-btn').addEventListener('click', function() {
    importInput.click();
});
importInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) return;
        const headers = rows[0];
        const idxDate = headers.indexOf('Date');
        const idxArrivee = headers.indexOf('Arrivée');
        const idxDepart = headers.indexOf('Départ');
        const idxPauseMidiDebut = headers.indexOf('Pause midi début');
        const idxPauseMidiFin = headers.indexOf('Pause midi fin');
        // Pauses dynamiques
        const idxsPauseAvantDebut = [];
        const idxsPauseAvantFin = [];
        const idxsPauseApresDebut = [];
        const idxsPauseApresFin = [];
        headers.forEach((h, i) => {
            if (/^Pause avant midi \d+ début$/.test(h)) idxsPauseAvantDebut.push(i);
            if (/^Pause avant midi \d+ fin$/.test(h)) idxsPauseAvantFin.push(i);
            if (/^Pause après midi \d+ début$/.test(h)) idxsPauseApresDebut.push(i);
            if (/^Pause après midi \d+ fin$/.test(h)) idxsPauseApresFin.push(i);
        });
        const idxHeuresTrav = headers.indexOf('Heures travaillées');
        const idxEcart = headers.indexOf('Écart');
        // On écrase les jours existants
        jours = rows.slice(1).filter(row => row[idxDate]).map(row => {
            // Pauses dynamiques avant midi
            const pausesAvant = [];
            for (let i = 0; i < idxsPauseAvantDebut.length; i++) {
                const debut = row[idxsPauseAvantDebut[i]] || '';
                const fin = row[idxsPauseAvantFin[i]] || '';
                if (debut || fin) pausesAvant.push({debut, fin});
            }
            // Pauses dynamiques après midi
            const pausesApres = [];
            for (let i = 0; i < idxsPauseApresDebut.length; i++) {
                const debut = row[idxsPauseApresDebut[i]] || '';
                const fin = row[idxsPauseApresFin[i]] || '';
                if (debut || fin) pausesApres.push({debut, fin});
            }
            return {
                date: row[idxDate] || '',
                arrivee: row[idxArrivee] || '',
                depart: row[idxDepart] || '',
                pauseDejDebut: row[idxPauseMidiDebut] || '',
                pauseDejFin: row[idxPauseMidiFin] || '',
                pausesAvant,
                pausesApres,
                heuresTravaillees: row[idxHeuresTrav] || '',
                ecart: row[idxEcart] || ''
            };
        });
        localStorage.setItem('jours', JSON.stringify(jours));
        afficherJours();
    };
    reader.readAsArrayBuffer(file);
});

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
        updatePause3Total();
    });
}
['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause2-debut','calc-pause2-fin','calc-pause1-debut','calc-pause1-fin','arrivee','depart','pause-debut','pause-fin','pause2-debut','pause2-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) formatHeureInput(el);
});

// Suppression de toutes les valeurs du mois affiché avec confirmation
const btnSupprimerMois = document.getElementById('supprimer-mois');
const confirmModalBg = document.getElementById('confirm-modal-bg');
const confirmOui = document.getElementById('confirm-oui');
const confirmNon = document.getElementById('confirm-non');

btnSupprimerMois.addEventListener('click', function() {
    confirmModalBg.style.display = 'flex';
});
confirmNon.addEventListener('click', function() {
    confirmModalBg.style.display = 'none';
});
confirmOui.addEventListener('click', function() {
    // Supprime tous les jours du mois affiché
    const moisStr = String(currentMonth + 1).padStart(2, '0');
    const anneeStr = String(currentYear);
    jours = jours.filter(jour => {
        const [y, m] = jour.date.split('-');
        return !(y === anneeStr && m === moisStr);
    });
    localStorage.setItem('jours', JSON.stringify(jours));
    afficherJours();
    confirmModalBg.style.display = 'none';
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

btnModeConge.addEventListener('click', function() {
    modeVac = 'conge';
    btnModeConge.classList.add('selected');
    btnModeRTT.classList.remove('selected');
});
btnModeRTT.addEventListener('click', function() {
    modeVac = 'rtt';
    btnModeRTT.classList.add('selected');
    btnModeConge.classList.remove('selected');
});

vacancesModalValider.addEventListener('click', function() {
    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
    vacancesModalBg.style.display = 'none';
});

function renderCalendrierVacances(annee) {
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
                td.onclick = () => {
                    if(joursVacances.includes(dateStr)) {
                        joursVacances = joursVacances.filter(d => d !== dateStr);
                        td.classList.remove('jour-vacances');
                    } else if(joursRTT.includes(dateStr)) {
                        joursRTT = joursRTT.filter(d => d !== dateStr);
                        td.classList.remove('jour-rtt');
                    } else {
                        if(modeVac === 'conge') {
                            joursVacances.push(dateStr);
                            td.classList.add('jour-vacances');
                        } else {
                            joursRTT.push(dateStr);
                            td.classList.add('jour-rtt');
                        }
                    }
                    
                    // Sauvegarder les données dans le localStorage
                    localStorage.setItem('joursVacances', JSON.stringify(joursVacances));
                    localStorage.setItem('joursRTT', JSON.stringify(joursRTT));
                    
                    // Mettre à jour le total d'heures supplémentaires en temps réel
                    afficherJours();
                };
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
    return joursVacances.includes(dateStr);
}
function isJourRTT(dateStr) {
    return joursRTT.includes(dateStr);
}
// On modifie renderCalendrier pour désactiver le clic sur les jours de vacances/RTT
const oldRenderCalendrier = renderCalendrier;
renderCalendrier = function(month, year) {
    oldRenderCalendrier(month, year);
    // Ajout de la classe jour-vacances/jour-rtt sur le calendrier principal
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let dayOfWeek = (firstDay.getDay() + 6) % 7;
    let tds = calendrierDiv.querySelectorAll('td');
    let day = 1;
    for(let i=0; i<tds.length; i++) {
        const td = tds[i];
        // On ne touche pas à la première colonne (numéro de semaine)
        if(td.cellIndex === 0) continue;
        if(td.textContent && !isNaN(td.textContent)) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            if(isJourVacances(dateStr)) {
                td.classList.add('jour-vacances');
                td.onclick = null;
            } else if(isJourRTT(dateStr)) {
                td.classList.add('jour-rtt');
                td.onclick = null;
            }
            day++;
        }
    }
};

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
// ... existing code ...

// ... existing code ...
// Appliquer la mise en forme automatique et la sauvegarde/restauration aux champs durée du module 1
['calc-pause1-duree', 'calc-pause-midi-duree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        formatHeureInputPause3(el);
        el.addEventListener('input', function() {
            localStorage.setItem('calculette_' + id, el.value);
            if (
                (id === 'calc-pause1-duree' && document.getElementById('calc-pause1-mode-duree')?.checked) ||
                (id === 'calc-pause-midi-duree' && document.getElementById('calc-pause-midi-mode-duree')?.checked)
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
}
['calc-pause1-debut','calc-pause1-fin','calc-pause-debut','calc-pause-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalcPauseDurees);
});
// Adapter le calcul du module 1 pour prendre en compte le mode durée
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
    // Paramètres globaux
    let heuresJourMin = getHeuresJourMinutes ? getHeuresJourMinutes() : 450; // fallback 7h30
    let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
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
    // Pause midi (toujours déduite, au moins le minimum)
    let pauseMidi = pauseMidiDureeMin;
    if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
    dureeTravail -= pauseMidi;
    // Pause matin : seul l'excédent > pause offerte est déduit
    let pauseMatin = pause1DureeMin;
    if (pauseMatin > pauseOfferteVal) {
        dureeTravail -= (pauseMatin - pauseOfferteVal);
    }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    calcHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h';
    calcHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
}
// ... existing code ...

// ... existing code ...
// 1. Appliquer la mise en forme automatique à tous les champs horaires (y compris dynamiques)
function applyFormatHeureInputToAll() {
    // Module 1
    ['calc-arrivee','calc-depart','calc-pause1-debut','calc-pause1-fin','calc-pause1-duree','calc-pause-debut','calc-pause-fin','calc-pause-midi-duree'].forEach(id => {
        const el = document.getElementById(id);
        if (el) formatHeureInputPause3(el);
    });
    // Module 2
    ['zero-arrivee','zero-depart','zero-pause1-debut','zero-pause1-fin','zero-pause1-duree','zero-pause-debut','zero-pause-fin','zero-pause-midi-duree'].forEach(id => {
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
document.getElementById('pause3-reset')?.addEventListener('click', function() {
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
        formatHeureInputPause3(convHHMM);
        convHHMM.addEventListener('input', function() {
            // Conversion HH:MM -> décimal
            let v = convHHMM.value;
            if (/^\d{2}:\d{2}$/.test(v)) {
                const [h, m] = v.split(':').map(Number);
                let dec = h + m/60;
                convDecimal.value = dec.toFixed(2).replace('.', ',');
                localStorage.setItem('convertisseur_decimal', convDecimal.value);
            }
            localStorage.setItem('convertisseur_hhmm', convHHMM.value);
        });
    }
    if (convDecimal) {
        convDecimal.addEventListener('input', function() {
            // Conversion décimal -> HH:MM
            let v = convDecimal.value.replace(',', '.');
            let dec = parseFloat(v);
            if (!isNaN(dec)) {
                let h = Math.floor(dec);
                let m = Math.round((dec - h) * 60);
                convHHMM.value = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
                localStorage.setItem('convertisseur_hhmm', convHHMM.value);
            }
            localStorage.setItem('convertisseur_decimal', convDecimal.value);
        });
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

// ... existing code ...
// --- Gestion du filtre mois/année pour les jours saisis avec boutons ---
const moisJoursBar = document.getElementById('mois-jours-bar');
let moisJoursSelectionne = currentMonth;
function majFiltreMoisJoursSaisis() {
    // Met à jour le style des boutons
    if (moisJoursBar) {
        moisJoursBar.querySelectorAll('[data-mois]').forEach(btn => {
            if (parseInt(btn.dataset.mois) === moisJoursSelectionne) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }
    if (anneeJoursSaisis) anneeJoursSaisis.textContent = currentYear;
}
if (moisJoursBar) {
    moisJoursBar.querySelectorAll('[data-mois]').forEach(btn => {
        btn.addEventListener('click', function() {
            moisJoursSelectionne = parseInt(this.dataset.mois);
            afficherJoursFiltre();
        });
    });
}
// --- Surcharge afficherJoursFiltre pour utiliser moisJoursSelectionne ---
function afficherJoursFiltre() {
    // Filtrage par mois/année
    let moisFiltre = moisJoursSelectionne;
    let anneeFiltre = currentYear;
    // On ne garde que les jours du mois/année sélectionnés
    const joursAffiches = jours.filter(jour => {
        if (!jour.date) return false;
        const [annee, mois] = jour.date.split('-');
        return parseInt(mois, 10) - 1 === moisFiltre && parseInt(annee, 10) === anneeFiltre;
    });
    // On remplace temporairement jours par joursAffiches pour l'affichage
    const joursOriginaux = jours;
    jours = joursAffiches;
    afficherJours();
    jours = joursOriginaux;
    majFiltreMoisJoursSaisis();
}
// Synchronise le filtre lors du changement de mois/année dans le calendrier
function syncFiltreMoisAvecCalendrier() {
    moisJoursSelectionne = currentMonth;
    majFiltreMoisJoursSaisis();
    afficherJoursFiltre();
}
// SUPPRESSION DE LA REDEFINITION RECURSIVE DE renderCalendrier
// Initialisation
majFiltreMoisJoursSaisis();
afficherJoursFiltre();
// ... existing code ...

// ... existing code ...
// Ajoute la fonction utilitaire pour formater les champs HH:MM (doit être placée avant tout appel)
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
    });
}
// ... existing code ...

// ... existing code ...
// Ajoute la fonction addPause3Ligne avant toute utilisation
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
    div.querySelector('.pause3-add').addEventListener('click', function() {
        addPause3Ligne();
        updatePause3Total();
    });
    div.querySelector('.pause3-del').addEventListener('click', function() {
        div.remove();
        updatePause3Total();
    });
}
// ... existing code ...