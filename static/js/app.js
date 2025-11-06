// Moca Reviews Scraper - Frontend Logic Complete v5 (con Auto-Update)

let apiToken = '';
let brandName = '';
let maxPlaces = 20;
let maxReviews = 100;
let foundPlaces = [];
let selectedPlaces = [];
let scrapingResults = null;
let currentTab = 'overview';
let enableAI = false;
let openaiKey = '';
let inputMode = 'brand';

// Update variables
let updateInfo = null;

// Elements
const btnSearch = document.getElementById('btn-search');
const btnSelectAll = document.getElementById('btn-select-all');
const btnDeselectAll = document.getElementById('btn-deselect-all');
const btnScrape = document.getElementById('btn-scrape');
const btnHistory = document.getElementById('btn-history');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnClearHistory = document.getElementById('btn-clear-history');

const stepConfig = document.getElementById('step-config');
const stepSelection = document.getElementById('step-selection');
const stepProgress = document.getElementById('step-progress');
const stepResults = document.getElementById('step-results');

const placesList = document.getElementById('places-list');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');

// Update elements
const updateBanner = document.getElementById('update-banner');
const btnUpdate = document.getElementById('btn-update');
const btnDismissUpdate = document.getElementById('btn-dismiss-update');
const updateVersionSpan = document.getElementById('update-version');

// Mode tabs
const modeTabs = document.querySelectorAll('.mode-tab');
const modeBrand = document.getElementById('mode-brand');
const modeUrls = document.getElementById('mode-urls');

// Check for updates on load
window.addEventListener('DOMContentLoaded', checkForUpdates);

if (btnUpdate) {
    btnUpdate.addEventListener('click', () => {
        if (updateInfo && updateInfo.download_url) {
            window.open(updateInfo.download_url, '_blank');
        }
    });
}

if (btnDismissUpdate) {
    btnDismissUpdate.addEventListener('click', () => {
        updateBanner.classList.add('hidden');
        document.querySelector('.container').classList.remove('with-banner');
    });
}

async function checkForUpdates() {
    try {
        const response = await fetch('/api/check-update');
        const data = await response.json();
        
        if (data.available) {
            updateInfo = data;
            updateVersionSpan.textContent = `v${data.current_version} → v${data.version}`;
            updateBanner.classList.remove('hidden');
            document.querySelector('.container').classList.add('with-banner');
        }
    } catch (e) {
        console.log('Update check failed:', e);
    }
}

// Event Listeners
btnSearch.addEventListener('click', handleSearch);
btnSelectAll.addEventListener('click', selectAll);
btnDeselectAll.addEventListener('click', deselectAll);
btnScrape.addEventListener('click', handleScrape);
btnHistory.addEventListener('click', openHistoryModal);
btnCloseModal.addEventListener('click', closeHistoryModal);
btnClearHistory.addEventListener('click', clearHistory);

// Close modal on background click
historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        closeHistoryModal();
    }
});

// Mode switching
modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        modeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        inputMode = this.dataset.mode;
        
        if (inputMode === 'brand') {
            modeBrand.classList.remove('hidden');
            modeUrls.classList.add('hidden');
            btnSearch.textContent = '🔍 Cerca Schede';
        } else {
            modeBrand.classList.add('hidden');
            modeUrls.classList.remove('hidden');
            btnSearch.textContent = '✅ Valida URL';
        }
    });
});

// AI Checkbox
document.getElementById('enable-ai').addEventListener('change', function(e) {
    const aiConfig = document.getElementById('ai-config');
    if (e.target.checked) {
        aiConfig.classList.remove('hidden');
    } else {
        aiConfig.classList.add('hidden');
    }
});

// ===== HISTORY MANAGEMENT =====

function saveToHistory(data) {
    try {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
        
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            brandName: brandName,
            inputMode: inputMode,
            placesCount: Object.keys(data.results).length,
            totalReviews: Object.values(data.results).reduce((sum, r) => sum + r.stats.total, 0),
            enabledAI: !!data.aggregated_ai,
            results: data.results,
            aggregated_ai: data.aggregated_ai
        };
        
        history.unshift(historyItem);
        
        // Mantieni solo gli ultimi MAX_HISTORY_ITEMS
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS);
        }
        
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
        console.error('Errore salvataggio storico:', e);
    }
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    } catch (e) {
        console.error('Errore caricamento storico:', e);
        return [];
    }
}

function deleteHistoryItem(id) {
    try {
        let history = loadHistory();
        history = history.filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        renderHistory();
    } catch (e) {
        console.error('Errore eliminazione item:', e);
    }
}

function clearHistory() {
    if (confirm('Sei sicuro di voler cancellare tutto lo storico?')) {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        renderHistory();
    }
}

function loadHistoryItem(id) {
    try {
        const history = loadHistory();
        const item = history.find(h => h.id === id);
        
        if (!item) {
            alert('Ricerca non trovata');
            return;
        }
        
        // Carica i risultati
        scrapingResults = item.results;
        window.aggregatedAiData = item.aggregated_ai || null;
        brandName = item.brandName;
        
        // Mostra risultati
        renderResults();
        stepResults.classList.remove('hidden');
        
        // Chiudi modal
        closeHistoryModal();
        
        // Scroll ai risultati
        stepResults.scrollIntoView({ behavior: 'smooth' });
        
    } catch (e) {
        console.error('Errore caricamento ricerca:', e);
        alert('Errore nel caricamento della ricerca');
    }
}

function openHistoryModal() {
    renderHistory();
    historyModal.classList.remove('hidden');
}

function closeHistoryModal() {
    historyModal.classList.add('hidden');
}

function renderHistory() {
    const history = loadHistory();
    
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📚</div>
                <p>Nessuna ricerca salvata</p>
                <small>Le tue ricerche verranno salvate automaticamente qui</small>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">
                        ${item.inputMode === 'brand' ? '🔍' : '🔗'} ${item.brandName}
                    </div>
                    <div class="history-item-date">${dateStr}</div>
                </div>
                <div class="history-item-stats">
                    <span>📍 ${item.placesCount} schede</span>
                    <span>📊 ${item.totalReviews} recensioni</span>
                    ${item.enabledAI ? '<span>🤖 Con AI</span>' : ''}
                </div>
                <div class="history-item-actions">
                    <button class="btn-load" onclick="loadHistoryItem(${item.id})">
                        📂 Carica Risultati
                    </button>
                    <button class="btn-delete" onclick="deleteHistoryItem(${item.id})">
                        🗑️ Elimina
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Step 1: Search Places or Parse URLs
async function handleSearch() {
    apiToken = document.getElementById('api-token').value.trim();
    
    if (!apiToken) {
        alert('Inserisci Apify API Token');
        return;
    }
    
    if (inputMode === 'brand') {
        await searchByBrand();
    } else {
        await parseManualUrls();
    }
}

// Search by Brand
async function searchByBrand() {
    brandName = document.getElementById('brand-name').value.trim();
    maxPlaces = parseInt(document.getElementById('max-places').value);
    maxReviews = parseInt(document.getElementById('max-reviews').value);
    
    if (!brandName) {
        alert('Inserisci Nome Brand');
        return;
    }
    
    btnSearch.disabled = true;
    btnSearch.textContent = '🔍 Ricerca in corso...';
    
    try {
        const response = await fetch('/api/search-places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_token: apiToken,
                brand_name: brandName,
                max_places: maxPlaces
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Errore ricerca');
        }
        
        foundPlaces = data.places;
        renderPlaces();
        
        stepSelection.classList.remove('hidden');
        
    } catch (error) {
        alert(`Errore: ${error.message}`);
    } finally {
        btnSearch.disabled = false;
        btnSearch.textContent = '🔍 Cerca Schede';
    }
}

// Parse Manual URLs
async function parseManualUrls() {
    const urlsText = document.getElementById('manual-urls').value.trim();
    maxReviews = parseInt(document.getElementById('max-reviews-manual').value);
    brandName = 'URL Manuali'; // Nome default per export
    
    if (!urlsText) {
        alert('Inserisci almeno un URL');
        return;
    }
    
    const urls = urlsText.split('\n').filter(u => u.trim());
    
    if (urls.length === 0) {
        alert('Nessun URL valido trovato');
        return;
    }
    
    btnSearch.disabled = true;
    btnSearch.textContent = '⏳ Validazione URL...';
    
    try {
        const response = await fetch('/api/parse-manual-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urls: urls
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Errore validazione URL');
        }
        
        foundPlaces = data.places;
        renderPlaces();
        
        stepSelection.classList.remove('hidden');
        
        // Mostra warning se ci sono URL non validi
        const invalidUrls = foundPlaces.filter(p => p.error);
        if (invalidUrls.length > 0) {
            alert(`Attenzione: ${invalidUrls.length} URL non validi saranno ignorati`);
        }
        
    } catch (error) {
        alert(`Errore: ${error.message}`);
    } finally {
        btnSearch.disabled = false;
        btnSearch.textContent = '✅ Valida URL';
    }
}

// Render Places
function renderPlaces() {
    placesList.innerHTML = '';
    
    foundPlaces.forEach((place, index) => {
        const div = document.createElement('div');
        
        // Gestisci URL non validi
        if (place.error) {
            div.className = 'place-item error';
            div.innerHTML = `
                <input type="checkbox" class="place-checkbox" disabled data-index="${index}">
                <div class="place-info">
                    <h3>❌ ${place.name}</h3>
                    <p style="color: var(--moca-red);">URL non valido: ${place.address}</p>
                </div>
            `;
        } else {
            div.className = 'place-item selected';
            div.dataset.index = index;
            
            div.innerHTML = `
                <input type="checkbox" class="place-checkbox" checked data-index="${index}">
                <div class="place-info">
                    <h3>${place.name}</h3>
                    <p>📍 ${place.address}</p>
                    ${place.rating ? `<p>⭐ ${place.rating} (${place.reviews_count || 0} recensioni)</p>` : ''}
                    ${place.original_url ? `<p style="font-size: 12px; color: var(--moca-grey);">🔗 ${place.original_url}</p>` : ''}
                </div>
            `;
            
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = div.querySelector('.place-checkbox');
                    checkbox.checked = !checkbox.checked;
                    div.classList.toggle('selected');
                } else {
                    div.classList.toggle('selected');
                }
            });
        }
        
        placesList.appendChild(div);
    });
    
    selectedPlaces = foundPlaces.filter(p => !p.error);
}

// Select All
function selectAll() {
    document.querySelectorAll('.place-checkbox:not(:disabled)').forEach(cb => {
        cb.checked = true;
        cb.closest('.place-item').classList.add('selected');
    });
}

// Deselect All
function deselectAll() {
    document.querySelectorAll('.place-checkbox:not(:disabled)').forEach(cb => {
        cb.checked = false;
        cb.closest('.place-item').classList.remove('selected');
    });
}

// Step 2: Scrape Reviews
// Step 2: Scrape Reviews
async function handleScrape() {
    const checkedBoxes = document.querySelectorAll('.place-checkbox:checked:not(:disabled)');
    selectedPlaces = Array.from(checkedBoxes).map(cb => 
        foundPlaces[parseInt(cb.dataset.index)]
    ).filter(p => !p.error);
    
    if (selectedPlaces.length === 0) {
        alert('Seleziona almeno una scheda valida');
        return;
    }
    
    // Check AI
    enableAI = document.getElementById('enable-ai').checked;
    if (enableAI) {
        openaiKey = document.getElementById('openai-key').value.trim();
        if (!openaiKey) {
            alert('Inserisci OpenAI API Key per abilitare analisi AI');
            return;
        }
    }
    
    stepProgress.classList.remove('hidden');
    btnScrape.disabled = true;
    
    progressText.textContent = `Scraping ${selectedPlaces.length} schede${enableAI ? ' + Analisi AI' : ''}...`;
    progressFill.style.width = '50%';
    
    try {
        const response = await fetch('/api/scrape-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_token: apiToken,
                openai_api_key: openaiKey,
                places: selectedPlaces,
                max_reviews: maxReviews,
                enable_ai: enableAI
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Errore scraping');
        }
        
        scrapingResults = data.results;
        
        // Salva AI aggregata globalmente
        window.aggregatedAiData = data.aggregated_ai || null;
        
        // ✅ SALVA NELLO STORICO
        saveToHistory(data);
        
        progressFill.style.width = '100%';
        progressText.textContent = '✅ Completato!';
        
        setTimeout(() => {
            renderResults();
            stepResults.classList.remove('hidden');
        }, 500);
        
    } catch (error) {
        alert(`Errore: ${error.message}`);
        progressText.textContent = `❌ Errore: ${error.message}`;
    } finally {
        btnScrape.disabled = false;
    }
}

// Render Results
function renderResults() {
    const container = document.getElementById('results-container');
    
    // Calcola statistiche aggregate
    const aggregated = calculateAggregatedStats();
    
    // Render tabs
    container.innerHTML = `
        <div class="results-tabs">
            <button class="tab-btn active" data-tab="overview">📊 Panoramica</button>
            ${Object.keys(scrapingResults).map((placeId, index) => {
                const placeName = scrapingResults[placeId].place_info.name;
                return `<button class="tab-btn" data-tab="place-${placeId}">${index + 1}. ${placeName}</button>`;
            }).join('')}
        </div>
        
        <div class="results-content">
            <div id="tab-content"></div>
        </div>
        
        <div class="export-actions">
    		<button class="btn btn-secondary" onclick="exportJSON()">💾 Esporta JSON</button>
    		<button class="btn btn-secondary" onclick="exportCSV()">📄 Esporta CSV</button>
    		<button class="btn btn-primary" onclick="exportPDF()">📄 Esporta PDF</button>
		</div>
    `;
    
    // Attach tab listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            if (tab === 'overview') {
                renderOverviewTab(aggregated);
            } else {
                const placeId = tab.replace('place-', '');
                renderPlaceTab(placeId);
            }
        });
    });
    
    // Show overview by default
    renderOverviewTab(aggregated);
}

// Calculate Aggregated Stats
function calculateAggregatedStats() {
    let totalReviews = 0;
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;
    let totalWithText = 0;
    let totalWithResponse = 0;
    let totalRatingSum = 0;
    const starsDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    
    Object.values(scrapingResults).forEach(result => {
        const stats = result.stats;
        totalReviews += stats.total;
        totalPositive += stats.positive;
        totalNegative += stats.negative;
        totalNeutral += stats.neutral;
        totalWithText += stats.with_text;
        totalWithResponse += stats.with_response;
        totalRatingSum += stats.avg_rating * stats.total;
        
        Object.keys(stats.stars_distribution).forEach(star => {
            starsDistribution[star] += stats.stars_distribution[star];
        });
    });
    
    const avgRating = totalReviews > 0 ? totalRatingSum / totalReviews : 0;
    
    // Aggiungi AI aggregata se disponibile
    let aiAnalysis = null;
    if (window.aggregatedAiData) {
        aiAnalysis = window.aggregatedAiData;
    }
    
    return {
        total_places: Object.keys(scrapingResults).length,
        total_reviews: totalReviews,
        avg_rating: avgRating.toFixed(2),
        positive: totalPositive,
        negative: totalNegative,
        neutral: totalNeutral,
        with_text: totalWithText,
        with_response: totalWithResponse,
        stars_distribution: starsDistribution,
        ai_analysis: aiAnalysis
    };
}

// Render Overview Tab
function renderOverviewTab(aggregated) {
    const content = document.getElementById('tab-content');
    
    const positivePercent = (aggregated.positive / aggregated.total_reviews * 100).toFixed(1);
    const negativePercent = (aggregated.negative / aggregated.total_reviews * 100).toFixed(1);
    const neutralPercent = (aggregated.neutral / aggregated.total_reviews * 100).toFixed(1);
    const withTextPercent = (aggregated.with_text / aggregated.total_reviews * 100).toFixed(1);
    const withResponsePercent = (aggregated.with_response / aggregated.total_reviews * 100).toFixed(1);
    
    // Prepara sezione AI aggregata (se disponibile)
    let aggregatedAiSection = '';
    if (aggregated.ai_analysis) {
        const gpt = aggregated.ai_analysis.gpt_analysis;
        const keywords = aggregated.ai_analysis.keywords;
        
        aggregatedAiSection = `
            <div class="ai-section" style="margin-top: 30px;">
                <h3>🤖 Analisi AI Strategica - Vista Brand</h3>
                <p style="color: rgba(255,255,255,0.9); margin-bottom: 20px; font-size: 14px;">
                    Analisi aggregata di ${aggregated.total_reviews} recensioni da ${aggregated.total_places} schede
                </p>
                
                <h4 style="color: white; margin-top: 20px; margin-bottom: 10px;">☁️ Wordcloud Globale - Parole più Frequenti</h4>
                <div class="wordcloud">
                    ${keywords.slice(0, 40).map(([word, count]) => {
                        const size = Math.min(12 + Math.log(count) * 3, 28);
                        return `<span class="word-tag" style="font-size: ${size}px">${word} (${count})</span>`;
                    }).join('')}
                </div>
                
                ${gpt.priorita && gpt.priorita.length > 0 ? `
                    <div class="priority-box">
                        <h4>🎯 Top 3 Priorità Strategiche</h4>
                        <ol>
                            ${gpt.priorita.map(p => `<li><strong>${p}</strong></li>`).join('')}
                        </ol>
                    </div>
                ` : ''}
                
                <div class="strengths-weaknesses">
                    <div class="strength-list">
                        <h4>💪 Punti di Forza del Brand</h4>
                        <ul>
                            ${gpt.punti_forza.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                        
                        ${gpt.temi_positivi && gpt.temi_positivi.length > 0 ? `
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                                <strong style="color: #4CAF50;">✨ Macro-temi Positivi:</strong>
                                <ul style="margin-top: 10px;">
                                    ${gpt.temi_positivi.map(t => `<li>${t}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="weakness-list">
                        <h4>⚠️ Aree di Miglioramento</h4>
                        <ul>
                            ${gpt.punti_debolezza.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                        
                        ${gpt.temi_negativi && gpt.temi_negativi.length > 0 ? `
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                                <strong style="color: var(--moca-red);">⚡ Macro-temi Critici:</strong>
                                <ul style="margin-top: 10px;">
                                    ${gpt.temi_negativi.map(t => `<li>${t}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="suggestions-box">
                    <h4>💡 Raccomandazioni Strategiche per il Brand</h4>
                    <ol>
                        ${gpt.suggerimenti_strategici.map(s => `<li>${s}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = `
        <div class="overview-grid">
            <div class="stat-card">
                <div class="stat-icon">📍</div>
                <div class="stat-value">${aggregated.total_places}</div>
                <div class="stat-label">Schede Analizzate</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${aggregated.total_reviews}</div>
                <div class="stat-label">Recensioni Totali</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">${aggregated.avg_rating}/5</div>
                <div class="stat-label">Rating Medio</div>
            </div>
            
            <div class="stat-card positive">
                <div class="stat-icon">👍</div>
                <div class="stat-value">${aggregated.positive}</div>
                <div class="stat-label">Positive (${positivePercent}%)</div>
            </div>
            
            <div class="stat-card negative">
                <div class="stat-icon">👎</div>
                <div class="stat-value">${aggregated.negative}</div>
                <div class="stat-label">Negative (${negativePercent}%)</div>
            </div>
            
            <div class="stat-card neutral">
                <div class="stat-icon">➖</div>
                <div class="stat-value">${aggregated.neutral}</div>
                <div class="stat-label">Neutre (${neutralPercent}%)</div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-card">
                <h3>📊 Distribuzione Recensioni</h3>
                <div class="pie-legend">
                    <div class="legend-item">
                        <span class="legend-color positive"></span>
                        <span>Positive: ${positivePercent}%</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color negative"></span>
                        <span>Negative: ${negativePercent}%</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color neutral"></span>
                        <span>Neutre: ${neutralPercent}%</span>
                    </div>
                </div>
            </div>
            
            <div class="chart-card">
                <h3>⭐ Distribuzione Stelle</h3>
                <div class="bar-chart">
                    ${[5, 4, 3, 2, 1].map(star => {
                        const count = aggregated.stars_distribution[star];
                        const percent = (count / aggregated.total_reviews * 100).toFixed(1);
                        return `
                            <div class="bar-row">
                                <span class="bar-label">${star} ⭐</span>
                                <div class="bar-container">
                                    <div class="bar-fill" style="width: ${percent}%"></div>
                                </div>
                                <span class="bar-value">${count}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        
        <div class="detail-cards">
            <div class="detail-card">
                <h3>📝 Recensioni con Testo</h3>
                <div class="detail-value">${aggregated.with_text} / ${aggregated.total_reviews}</div>
                <div class="detail-percent">${withTextPercent}%</div>
            </div>
            
            <div class="detail-card">
                <h3>💬 Con Risposta Owner</h3>
                <div class="detail-value">${aggregated.with_response} / ${aggregated.total_reviews}</div>
                <div class="detail-percent">${withResponsePercent}%</div>
            </div>
        </div>
        
        ${aggregatedAiSection}
    `;
}

// Render Place Tab
function renderPlaceTab(placeId) {
    const content = document.getElementById('tab-content');
    const result = scrapingResults[placeId];
    const info = result.place_info;
    const stats = result.stats;
    const aiAnalysis = result.ai_analysis;
    
    const positivePercent = (stats.positive / stats.total * 100).toFixed(1);
    const negativePercent = (stats.negative / stats.total * 100).toFixed(1);
    const neutralPercent = (stats.neutral / stats.total * 100).toFixed(1);
    
    let aiSection = '';
    if (aiAnalysis) {
        const gpt = aiAnalysis.gpt_analysis;
        const keywords = aiAnalysis.keywords;
        
        aiSection = `
            <div class="ai-section">
                <h3>🤖 Analisi AI</h3>
                
                <h4 style="color: white; margin-top: 20px; margin-bottom: 10px;">☁️ Wordcloud - Parole più Frequenti</h4>
                <div class="wordcloud">
                    ${keywords.map(([word, count]) => {
                        const size = Math.min(10 + count, 24);
                        return `<span class="word-tag" style="font-size: ${size}px">${word} (${count})</span>`;
                    }).join('')}
                </div>
                
                <div class="strengths-weaknesses">
                    <div class="strength-list">
                        <h4>💪 Punti di Forza</h4>
                        <ul>
                            ${gpt.punti_forza.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="weakness-list">
                        <h4>⚠️ Punti di Debolezza</h4>
                        <ul>
                            ${gpt.punti_debolezza.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                ${gpt.esempi_positivi && gpt.esempi_positivi.length > 0 ? `
                    <h4 style="color: white; margin-top: 20px; margin-bottom: 10px;">✅ Esempi Positivi</h4>
                    <div class="examples-grid">
                        ${gpt.esempi_positivi.map(ex => `
                            <div class="example-card">
                                <h5>💡 ${ex.punto}</h5>
                                <p>"${ex.testo}"</p>
                                ${ex.reviewUrl ? `<a href="${ex.reviewUrl}" target="_blank">🔗 Vedi recensione</a>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${gpt.esempi_negativi && gpt.esempi_negativi.length > 0 ? `
                    <h4 style="color: white; margin-top: 20px; margin-bottom: 10px;">❌ Esempi Negativi</h4>
                    <div class="examples-grid">
                        ${gpt.esempi_negativi.map(ex => `
                            <div class="example-card">
                                <h5>⚠️ ${ex.punto}</h5>
                                <p>"${ex.testo}"</p>
                                ${ex.reviewUrl ? `<a href="${ex.reviewUrl}" target="_blank">🔗 Vedi recensione</a>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="suggestions-box">
                    <h4>💡 Suggerimenti per Migliorare</h4>
                    <ol>
                        ${gpt.suggerimenti.map(s => `<li>${s}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = `
        <div class="place-header">
            <h3>${info.name}</h3>
            <p>📍 ${info.address}</p>
            <p>⭐ Rating Google: ${info.rating || 'N/A'} (${info.reviews_count || 0} recensioni totali)</p>
        </div>
        
        <div class="overview-grid">
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Recensioni Estratte</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">${stats.avg_rating}/5</div>
                <div class="stat-label">Rating Medio</div>
            </div>
            
            <div class="stat-card positive">
                <div class="stat-icon">👍</div>
                <div class="stat-value">${stats.positive}</div>
                <div class="stat-label">Positive</div>
            </div>
            
            <div class="stat-card negative">
                <div class="stat-icon">👎</div>
                <div class="stat-value">${stats.negative}</div>
                <div class="stat-label">Negative</div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-card">
                <h3>⭐ Distribuzione Stelle</h3>
                <div class="bar-chart">
                    ${[5, 4, 3, 2, 1].map(star => {
                        const count = stats.stars_distribution[star];
                        const percent = (count / stats.total * 100).toFixed(1);
                        return `
                            <div class="bar-row">
                                <span class="bar-label">${star} ⭐</span>
                                <div class="bar-container">
                                    <div class="bar-fill" style="width: ${percent}%"></div>
                                </div>
                                <span class="bar-value">${count}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        
        ${aiSection}
        
        <div class="reviews-sample">
            <h3>📋 Ultime Recensioni (prime 10)</h3>
            ${result.reviews.slice(0, 10).map(review => `
                <div class="review-card">
                    <div class="review-header">
                        <div>
                            <strong>${review.name || 'Anonimo'}</strong>
                            <span class="review-stars">${'⭐'.repeat(review.stars || 0)}</span>
                        </div>
                        <span class="review-date">${review.publishAt || 'N/A'}</span>
                    </div>
                    <div class="review-text">${review.text || '<em>Nessun testo</em>'}</div>
                    ${review.responseFromOwnerText ? `
                        <div class="review-response">
                            <strong>💬 Risposta:</strong> ${review.responseFromOwnerText}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

// Export Functions
function exportJSON() {
    const dataStr = JSON.stringify(scrapingResults, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reviews_${brandName}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportCSV() {
    // CSV Header
    let csv = 'Scheda,Indirizzo,Place ID,Autore,Data Pubblicazione,Stelle,Testo Recensione,Risposta Owner,URL Recensione,Numero Recensioni Autore,Local Guide,Immagini\n';
    
    // Itera su tutte le schede
    Object.values(scrapingResults).forEach(result => {
        const info = result.place_info;
        const reviews = result.reviews;
        
        // Itera su tutte le recensioni
        reviews.forEach(review => {
            const fields = [
                info.name || '',
                info.address || '',
                info.place_id || '',
                review.name || 'Anonimo',
                review.publishAt || review.publishedAtDate || '',
                review.stars || '',
                (review.text || '').replace(/"/g, '""'), // Escape quotes
                (review.responseFromOwnerText || '').replace(/"/g, '""'),
                review.reviewUrl || '',
                review.reviewerNumberOfReviews || '',
                review.isLocalGuide ? 'Sì' : 'No',
                review.reviewImageUrls ? review.reviewImageUrls.length : 0
            ];
            
            // Wrap each field in quotes and join
            csv += fields.map(f => `"${f}"`).join(',') + '\n';
        });
    });
    
    // Download
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reviews_detailed_${brandName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
