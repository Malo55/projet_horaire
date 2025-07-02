// Script principal du calculateur d'horaires de travail

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
                heuresTravaillees: parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pauseSupActive, jour.pause2Debut, jour.pause2Fin, jour.pause1Debut, jour.pause1Fin)),
                ecart: calculerEcart(parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pauseSupActive, jour.pause2Debut, jour.pause2Fin, jour.pause1Debut, jour.pause1Fin)), heuresJour)
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

// Gestion de l'affichage dynamique des champs de pause
const pauseCheckbox = document.getElementById('pause-checkbox');
const pauseFields = document.getElementById('pause-fields');
const pause2Debut = document.getElementById('pause2-debut');
const pause2Fin = document.getElementById('pause2-fin');

pauseCheckbox.addEventListener('change', function() {
    pauseFields.style.display = this.checked ? '' : 'none';
});

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

// Fonction pour calculer les heures travaillées (ancienne version, sera patchée ensuite)
function calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pauseSupActive, pause2Debut, pause2Fin, pause1Debut, pause1Fin) {
    const toMinutes = (h) => {
        if (!h) return 0;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    let totalMinutes = departMin - arriveeMin;
    // Pause déjeuner (toujours déduite)
    if (pauseDejDebut && pauseDejFin) {
        totalMinutes -= (toMinutes(pauseDejFin) - toMinutes(pauseDejDebut));
    }
    // Pause matin : seul l'excédent > pause offerte est déduit
    if (pause1Debut && pause1Fin) {
        let pause1Minutes = toMinutes(pause1Fin) - toMinutes(pause1Debut);
        if (pause1Minutes > pauseOfferte) {
            totalMinutes -= (pause1Minutes - pauseOfferte);
        }
    }
    // Pause supplémentaire : seul l'excédent > pause offerte est déduit
    if (pauseSupActive && pause2Debut && pause2Fin) {
        let pauseSupMinutes = toMinutes(pause2Fin) - toMinutes(pause2Debut);
        if (pauseSupMinutes > pauseOfferte) {
            totalMinutes -= (pauseSupMinutes - pauseOfferte);
        }
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
    // On crée un Set de tous les jours du mois affiché (jours RTT inclus même sans saisie d'horaire)
    const joursRTTSet = new Set(joursRTT);
    // On affiche les jours saisis
    jours.forEach((jour, idx) => {
        const isVac = isJourVacances(jour.date);
        const isRtt = isJourRTT(jour.date);
        const isJourTravailleJour = isJourTravaille(jour.date);
        const tr = document.createElement('tr');
        // Calcul dynamique des heures travaillées et de l'écart
        let heuresTravDyn = (isVac || isRtt) ? 0 : parseFloat(calculerHeures(jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.pauseSupActive, jour.pause2Debut, jour.pause2Fin, jour.pause1Debut, jour.pause1Fin));
        let ecartDyn = (isVac || isRtt) ? 0 : heuresTravDyn - heuresJour;
        let ecartAfficheDyn = (isVac || isRtt) ? (isRtt ? '-' : '') + heuresJour.toFixed(2) : (ecartDyn >= 0 ? '+' : '') + ecartDyn.toFixed(2);
        const ecartClassDyn = ecartDyn >= 0 ? 'ecart-positif' : 'ecart-negatif';
        totalEcart += ecartDyn;
        
        // Ajouter une classe pour griser les jours non travaillés
        const rowClass = !isJourTravailleJour && !isVac && !isRtt ? 'jour-non-travaille-row' : '';
        
        tr.innerHTML = `
            <td>${formaterDate(jour.date)}</td>
            <td>${jour.arrivee}</td>
            <td>${jour.pauseDejDebut}</td>
            <td>${jour.pauseDejFin}</td>
            <td>${jour.depart}</td>
            <td>${(isVac || isRtt) ? '0.00' : heuresTravDyn.toFixed(2)}</td>
            <td class="${ecartClassDyn}">${ecartAfficheDyn}</td>
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
    const pauseSupActive = pauseCheckbox.checked;
    const pause2DebutVal = form['pause2-debut'].value;
    const pause2FinVal = form['pause2-fin'].value;
    const heuresTravaillees = parseFloat(calculerHeures(arrivee, pauseDejDebut, pauseDejFin, depart, pauseSupActive, pause2DebutVal, pause2FinVal, undefined, undefined));
    const ecart = calculerEcart(heuresTravaillees, heuresJour);
    // Mise à jour ou ajout du jour
    const index = jours.findIndex(j => j.date === date);
    const jourData = { date, arrivee, pauseDejDebut, pauseDejFin, depart, pauseSupActive, pause2Debut: pause2DebutVal, pause2Fin: pause2FinVal, heuresTravaillees, ecart };
    if (index !== -1) {
        jours[index] = jourData;
    } else {
        jours.push(jourData);
    }
    localStorage.setItem('jours', JSON.stringify(jours));
    afficherJours();
    form.reset();
    pauseFields.style.display = 'none';
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
    // Préparation des données pour Excel
    const wsData = [
        ['Date', 'Arrivée', 'Début pause', 'Fin pause', 'Départ', 'Heures travaillées', 'Écart'],
        ...jours.map(jour => [
            formaterDate(jour.date), jour.arrivee, jour.pauseDejDebut, jour.pauseDejFin, jour.depart, jour.heuresTravaillees, jour.ecart
        ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horaires');
    XLSX.writeFile(wb, 'horaires_travail.xlsx');
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
        // On saute la première ligne (en-têtes)
        jours = rows.slice(1).filter(row => row.length >= 5).map(row => {
            const [date, arrivee, pauseDejDebut, pauseDejFin, depart, heuresTravaillees, ecart] = row;
            return { date, arrivee, pauseDejDebut, pauseDejFin, depart, heuresTravaillees, ecart };
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
            pauseCheckbox.checked = !!jour.pauseSupActive;
            pauseFields.style.display = jour.pauseSupActive ? '' : 'none';
            form['pause2-debut'].value = jour.pause2Debut || '';
            form['pause2-fin'].value = jour.pause2Fin || '';
            form['pause1-debut'].value = jour.pause1Debut || '';
            form['pause1-fin'].value = jour.pause1Fin || '';
        } else {
            form.reset();
            form.date.value = dateStr;
            pauseCheckbox.checked = false;
            pauseFields.style.display = 'none';
        }
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
        if (v.length === 3) v = '0' + v; // 900 => 09:00
        if (v.length === 4) {
            let h = v.slice(0,2);
            let m = v.slice(2,4);
            input.value = h + ':' + m;
        }
    });
}
['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause2-debut','calc-pause2-fin','arrivee','depart','pause-debut','pause-fin','pause2-debut','pause2-fin'].forEach(id => {
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
function getPauseSupMinutes() {
    const debut = toMinutes(calcPause2Debut.value);
    const fin = toMinutes(calcPause2Fin.value);
    if (debut !== null && fin !== null && fin > debut) {
        return fin - debut;
    }
    return 0;
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
const plageArriveeMinInput = document.getElementById('plage-arrivee-min');
const plageArriveeMaxInput = document.getElementById('plage-arrivee-max');
const plageMidiMinInput = document.getElementById('plage-midi-min');
const plageMidiMaxInput = document.getElementById('plage-midi-max');
const plageDepartMinInput = document.getElementById('plage-depart-min');
const plageDepartMaxInput = document.getElementById('plage-depart-max');
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
    let pauseMins = getPauseMinutesAvecMin();
    let pause1Mins = getPause1Minutes();
    let travailMins = getHeuresJourMinutes();
    let pauseSup = getPauseSupMinutes();
    let pauseOfferteVal = getPauseOfferte();
    let arriveeMins = null, departMins = null, departMinsAvantClamp = null;
    // Calcul du delta d'heure à chaque modification
    let delta = null;
    if (lastInput === 'calc-arrivee' && calcArrivee.value && /^\d{2}:\d{2}$/.test(calcArrivee.value)) {
        arriveeMins = toMinutes(calcArrivee.value);
        arriveeMins = clampArriveeMins(arriveeMins);
        calcArrivee.value = toHHMM(arriveeMins);
        departMins = arriveeMins + travailMins + pauseMins;
        if (pause1Mins > pauseOfferteVal) {
            departMins += (pause1Mins - pauseOfferteVal);
        }
        if (pauseSup > pauseOfferteVal) {
            departMins += (pauseSup - pauseOfferteVal);
        }
        departMinsAvantClamp = departMins;
        departMins = clampDepartMins(departMins);
        delta = ((departMinsAvantClamp - departMins) / 60).toFixed(2);
        calcDepart.value = toHHMM(departMins);
    } else if (lastInput === 'calc-depart' && calcDepart.value && /^\d{2}:\d{2}$/.test(calcDepart.value)) {
        departMins = toMinutes(calcDepart.value);
        departMinsAvantClamp = departMins;
        departMins = clampDepartMins(departMins);
        delta = ((departMinsAvantClamp - departMins) / 60).toFixed(2);
        calcDepart.value = toHHMM(departMins);
        if (pause1Mins > pauseOfferteVal) {
            departMins -= (pause1Mins - pauseOfferteVal);
        }
        if (pauseSup > pauseOfferteVal) {
            departMins -= (pauseSup - pauseOfferteVal);
        }
        arriveeMins = departMins - travailMins - pauseMins;
        arriveeMins = clampArriveeMins(arriveeMins);
        calcArrivee.value = toHHMM(arriveeMins);
    } else if (
        lastInput === 'calc-pause1-debut' || lastInput === 'calc-pause1-fin' ||
        lastInput === 'calc-pause2-debut' || lastInput === 'calc-pause2-fin' ||
        lastInput === 'calc-pause-debut' || lastInput === 'calc-pause-fin' ||
        lastInput === 'heures-jour' || lastInput === 'heures-jour-hhmm'
    ) {
        // Si l'arrivée est remplie, on recalcule le départ
        if (calcArrivee.value && /^\d{2}:\d{2}$/.test(calcArrivee.value)) {
            arriveeMins = toMinutes(calcArrivee.value);
            arriveeMins = clampArriveeMins(arriveeMins);
            calcArrivee.value = toHHMM(arriveeMins);
            departMins = arriveeMins + travailMins + pauseMins;
            if (pause1Mins > pauseOfferteVal) {
                departMins += (pause1Mins - pauseOfferteVal);
            }
            if (pauseSup > pauseOfferteVal) {
                departMins += (pauseSup - pauseOfferteVal);
            }
            departMinsAvantClamp = departMins;
            departMins = clampDepartMins(departMins);
            delta = ((departMinsAvantClamp - departMins) / 60).toFixed(2);
            calcDepart.value = toHHMM(departMins);
        } else if (calcDepart.value && /^\d{2}:\d{2}$/.test(calcDepart.value)) {
            departMins = toMinutes(calcDepart.value);
            departMinsAvantClamp = departMins;
            departMins = clampDepartMins(departMins);
            delta = ((departMinsAvantClamp - departMins) / 60).toFixed(2);
            calcDepart.value = toHHMM(departMins);
            if (pause1Mins > pauseOfferteVal) {
                departMins -= (pause1Mins - pauseOfferteVal);
            }
            if (pauseSup > pauseOfferteVal) {
                departMins -= (pauseSup - pauseOfferteVal);
            }
            arriveeMins = departMins - travailMins - pauseMins;
            arriveeMins = clampArriveeMins(arriveeMins);
            calcArrivee.value = toHHMM(arriveeMins);
        }
    }
    if (departIndication && delta !== null && delta != 0) {
        departIndication.textContent = '';
        departIndication.style.color = '';
    } else if (departIndication) {
        departIndication.textContent = '';
        departIndication.style.color = '';
    }
    let infoPause1 = pause1Mins > 0 ? `pause matin de ${pause1Mins} min` : 'pas de pause matin';
    let infoPauseSup = pauseSup > 0 ? `pause supp. de ${pauseSup} min` : 'pas de pause supp.';
    calcInfo.textContent = '';
}
['calcPauseDebut', 'calcPauseFin', 'calcArrivee', 'calcDepart', 'calcPause2Debut', 'calcPause2Fin', 'calcPause1Debut', 'calcPause1Fin'].forEach(id => {
    const el = document.getElementById(id.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (el) {
        el.addEventListener('input', function() { lastInput = el.id; updateCalculateur(); });
        el.addEventListener('change', function() { lastInput = el.id; updateCalculateur(); });
    }
});

// Affichage initial correct de la pause supplémentaire si la case est cochée
calcPauseSupFields.style.display = pauseCheckbox.checked ? '' : 'none';

if (heuresJourInput) {
    heuresJourInput.addEventListener('input', updateCalculateur);
    heuresJourInput.addEventListener('change', updateCalculateur);
}

// Initialisation des jours de travail
initialiserJoursTravail();

// Attendre que le DOM soit chargé pour initialiser le menu
document.addEventListener('DOMContentLoaded', function() {
    // --- Gestion du modal de menu ---
    const btnMenu = document.getElementById('btn-menu');
    const menuModalBg = document.getElementById('menu-modal-bg');
    const menuModalClose = document.getElementById('menu-modal-close');

    if (btnMenu && menuModalBg && menuModalClose) {
        // Ouvrir le modal de menu
        btnMenu.addEventListener('click', function() {
            menuModalBg.style.display = 'flex';
        });

        // Fermer le modal de menu
        menuModalClose.addEventListener('click', function() {
            menuModalBg.style.display = 'none';
        });

        // Fermer le modal en cliquant à l'extérieur
        menuModalBg.addEventListener('click', function(e) {
            if (e.target === menuModalBg) {
                menuModalBg.style.display = 'none';
            }
        });
    }

    // --- Gestion du module Paramètres ---
    const menuParametres = document.getElementById('menu-parametres');
    const parametresModalBg = document.getElementById('parametres-modal-bg');
    const parametresModalClose = document.getElementById('parametres-modal-close');
    const parametresAnnuler = document.getElementById('parametres-annuler');

    if (menuParametres && parametresModalBg && parametresModalClose && parametresAnnuler) {
        // Ouvrir le modal des paramètres
        menuParametres.addEventListener('click', function() {
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
            
            menuModalBg.style.display = 'none';
            parametresModalBg.style.display = 'flex';
        });

        // Fermer le modal des paramètres
        parametresModalClose.addEventListener('click', function() {
            parametresModalBg.style.display = 'none';
        });

        parametresAnnuler.addEventListener('click', function() {
            parametresModalBg.style.display = 'none';
        });

        // Fermer le modal en cliquant à l'extérieur
        parametresModalBg.addEventListener('click', function(e) {
            if (e.target === parametresModalBg) {
                parametresModalBg.style.display = 'none';
            }
        });

        // Appliquer les changements en temps réel pour les heures par jour
        const paramHeuresJour = document.getElementById('param-heures-jour');
        if (paramHeuresJour) {
            paramHeuresJour.addEventListener('input', function() {
                const nouvelleValeur = parseFloat(this.value) || 7.5;
                heuresJour = nouvelleValeur;
                localStorage.setItem('heuresJour', heuresJour);
                
                // Mettre à jour l'interface
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
                
                // Mettre à jour l'affichage
                afficherJours();
            });
        }

        // Appliquer les changements en temps réel pour la pause offerte
        const paramPauseOfferte = document.getElementById('param-pause-offerte');
        if (paramPauseOfferte) {
            paramPauseOfferte.addEventListener('input', function() {
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
            paramHeuresSupplementaires.addEventListener('input', function() {
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
                checkbox.addEventListener('change', function() {
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
        paramPauseMidiMin.addEventListener('input', function() {
            pauseMidiMin = parseInt(this.value) || 0;
            localStorage.setItem('pauseMidiMin', pauseMidiMin);
        });
    }
    window.getPauseMidiMin = function() { return pauseMidiMin; };
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
if (calcPauseDebut) calcPauseDebut.addEventListener('input', updateMidiIndication);
if (calcPauseFin) calcPauseFin.addEventListener('input', updateMidiIndication);
updateMidiIndication();

['zero-arrivee','zero-depart','zero-pause-debut','zero-pause-fin','zero-pause1-debut','zero-pause1-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) formatHeureInput(el);
});

// Sauvegarde et restauration des valeurs du module 'zero'
const zeroPause1Debut = document.getElementById('zero-pause1-debut');
const zeroPause1Fin = document.getElementById('zero-pause1-fin');
const zeroPauseMidiDebut = document.getElementById('zero-pause-debut');
const zeroPauseMidiFin = document.getElementById('zero-pause-fin');

// Restauration à l'ouverture de la page
if (zeroPause1Debut && localStorage.getItem('zeroPause1Debut')) zeroPause1Debut.value = localStorage.getItem('zeroPause1Debut');
if (zeroPause1Fin && localStorage.getItem('zeroPause1Fin')) zeroPause1Fin.value = localStorage.getItem('zeroPause1Fin');
if (zeroPauseMidiDebut && localStorage.getItem('zeroPauseMidiDebut')) zeroPauseMidiDebut.value = localStorage.getItem('zeroPauseMidiDebut');
if (zeroPauseMidiFin && localStorage.getItem('zeroPauseMidiFin')) zeroPauseMidiFin.value = localStorage.getItem('zeroPauseMidiFin');

// Sauvegarde à chaque modification
if (zeroPause1Debut) zeroPause1Debut.addEventListener('input', function() { localStorage.setItem('zeroPause1Debut', zeroPause1Debut.value); });
if (zeroPause1Fin) zeroPause1Fin.addEventListener('input', function() { localStorage.setItem('zeroPause1Fin', zeroPause1Fin.value); });
if (zeroPauseMidiDebut) zeroPauseMidiDebut.addEventListener('input', function() { localStorage.setItem('zeroPauseMidiDebut', zeroPauseMidiDebut.value); });
if (zeroPauseMidiFin) zeroPauseMidiFin.addEventListener('input', function() { localStorage.setItem('zeroPauseMidiFin', zeroPauseMidiFin.value); });

// --- Calcul dynamique des heures sup du module zero ---
const zeroArrivee = document.getElementById('zero-arrivee');
const zeroDepart = document.getElementById('zero-depart');
const zeroHeuresSup = document.getElementById('zero-heures-sup');

function calculerHeuresSupZero() {
    // Récupération des valeurs
    const arrivee = zeroArrivee ? zeroArrivee.value : '';
    const depart = zeroDepart ? zeroDepart.value : '';
    const pause1Debut = zeroPause1Debut ? zeroPause1Debut.value : '';
    const pause1Fin = zeroPause1Fin ? zeroPause1Fin.value : '';
    const pauseMidiDebut = zeroPauseMidiDebut ? zeroPauseMidiDebut.value : '';
    const pauseMidiFin = zeroPauseMidiFin ? zeroPauseMidiFin.value : '';
    // Fonctions utilitaires
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    // Conversion
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    const pause1DebutMin = toMinutes(pause1Debut);
    const pause1FinMin = toMinutes(pause1Fin);
    const pauseMidiDebutMin = toMinutes(pauseMidiDebut);
    const pauseMidiFinMin = toMinutes(pauseMidiFin);
    // Paramètres globaux
    let heuresJourMin = getHeuresJourMinutes ? getHeuresJourMinutes() : 450; // fallback 7h30
    let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    // Calcul
    if (
        arriveeMin === null || departMin === null ||
        pauseMidiDebutMin === null || pauseMidiFinMin === null ||
        pause1DebutMin === null || pause1FinMin === null
    ) {
        zeroHeuresSup.textContent = '';
        return;
    }
    let dureeTravail = departMin - arriveeMin;
    // Pause midi (toujours déduite, au moins le minimum)
    let pauseMidi = pauseMidiFinMin - pauseMidiDebutMin;
    if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
    dureeTravail -= pauseMidi;
    // Pause matin : seul l'excédent > pause offerte est déduit
    let pauseMatin = pause1FinMin - pause1DebutMin;
    if (pauseMatin > pauseOfferteVal) {
        dureeTravail -= (pauseMatin - pauseOfferteVal);
    }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    zeroHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h';
    zeroHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
}

['zero-arrivee','zero-depart','zero-pause-debut','zero-pause-fin','zero-pause1-debut','zero-pause1-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculerHeuresSupZero);
});
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
    const pause1Debut = calcPause1Debut ? calcPause1Debut.value : '';
    const pause1Fin = calcPause1Fin ? calcPause1Fin.value : '';
    const pauseMidiDebut = calcPauseDebut ? calcPauseDebut.value : '';
    const pauseMidiFin = calcPauseFin ? calcPauseFin.value : '';
    // Fonctions utilitaires
    const toMinutes = (h) => {
        if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };
    // Conversion
    const arriveeMin = toMinutes(arrivee);
    const departMin = toMinutes(depart);
    const pause1DebutMin = toMinutes(pause1Debut);
    const pause1FinMin = toMinutes(pause1Fin);
    const pauseMidiDebutMin = toMinutes(pauseMidiDebut);
    const pauseMidiFinMin = toMinutes(pauseMidiFin);
    // Paramètres globaux
    let heuresJourMin = getHeuresJourMinutes ? getHeuresJourMinutes() : 450; // fallback 7h30
    let pauseOfferteVal = typeof pauseOfferte !== 'undefined' ? pauseOfferte : 15;
    let pauseMidiMin = (typeof getPauseMidiMin === 'function') ? getPauseMidiMin() : 30;
    // Calcul
    if (
        arriveeMin === null || departMin === null ||
        pauseMidiDebutMin === null || pauseMidiFinMin === null ||
        pause1DebutMin === null || pause1FinMin === null
    ) {
        calcHeuresSup.textContent = '';
        return;
    }
    let dureeTravail = departMin - arriveeMin;
    // Pause midi (toujours déduite, au moins le minimum)
    let pauseMidi = pauseMidiFinMin - pauseMidiDebutMin;
    if (pauseMidi < pauseMidiMin) pauseMidi = pauseMidiMin;
    dureeTravail -= pauseMidi;
    // Pause matin : seul l'excédent > pause offerte est déduit
    let pauseMatin = pause1FinMin - pause1DebutMin;
    if (pauseMatin > pauseOfferteVal) {
        dureeTravail -= (pauseMatin - pauseOfferteVal);
    }
    // Heures sup = durée de travail (en heures) - heures à faire par jour
    let heuresSup = (dureeTravail / 60) - (heuresJourMin / 60);
    calcHeuresSup.textContent = (heuresSup >= 0 ? '+' : '') + heuresSup.toFixed(2) + ' h';
    calcHeuresSup.style.color = heuresSup >= 0 ? '#1976d2' : '#d32f2f';
}

['calc-arrivee','calc-depart','calc-pause-debut','calc-pause-fin','calc-pause1-debut','calc-pause1-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculerHeuresSupCalculette);
});
// Calcul initial au chargement
calculerHeuresSupCalculette(); 