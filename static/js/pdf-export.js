// Moca Reviews Scraper - PDF Export Module v2 (Fixed)

class PDFExporter {
    constructor(brandName, scrapingResults, aggregatedAiData) {
        this.brandName = brandName;
        this.scrapingResults = scrapingResults;
        this.aggregatedAiData = aggregatedAiData;
        
        // Moca Colors
        this.colors = {
            red: [229, 34, 23],
            redLight: [255, 231, 230],
            black: [25, 25, 25],
            grey: [138, 138, 138],
            positive: [76, 175, 80],
            negative: [229, 34, 23],
            neutral: [255, 167, 38]
        };
    }
    
    async generatePDF() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        let yPos = 20;
        
        // Header
        yPos = this.addHeader(pdf, yPos);
        
        // Statistiche Aggregate
        yPos = this.addAggregateStats(pdf, yPos);
        
        // Nuova pagina se necessario
        if (yPos > 200) {
            pdf.addPage();
            yPos = 20;
        }
        
        // Distribuzione Stelle
        yPos = this.addStarsDistribution(pdf, yPos);
        
        // Analisi AI (se disponibile)
        if (this.aggregatedAiData) {
            pdf.addPage();
            yPos = 20;
            yPos = this.addAIAnalysis(pdf, yPos);
        }
        
        // Dettaglio Schede
        pdf.addPage();
        yPos = 20;
        yPos = this.addPlacesDetail(pdf, yPos);
        
        // Footer su tutte le pagine
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            this.addFooter(pdf, i, pageCount);
        }
        
        // Download
        const fileName = `Moca_Reviews_${this.brandName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
    }
    
    addHeader(pdf, yPos) {
        // Logo Moca (cerchio rosso)
        pdf.setFillColor(...this.colors.red);
        pdf.circle(20, yPos + 5, 8, 'F');
        
        // Lettera M bianca nel cerchio
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('M', 17, yPos + 8);
        
        // Titolo
        pdf.setTextColor(...this.colors.black);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('MOCA Reviews Report', 35, yPos + 8);
        
        // Sottotitolo
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...this.colors.grey);
        pdf.text(this.brandName, 35, yPos + 15);
        
        // Linea separatore
        pdf.setDrawColor(...this.colors.red);
        pdf.setLineWidth(1);
        pdf.line(20, yPos + 20, 190, yPos + 20);
        
        return yPos + 30;
    }
    
    addAggregateStats(pdf, yPos) {
        const stats = this.calculateAggregateStats();
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.black);
        pdf.text('Panoramica Generale', 20, yPos);
        
        yPos += 12;
        
        // Box statistiche (2x2 grid)
        const boxWidth = 85;
        const boxHeight = 30;
        const gap = 10;
        const startX = 20;
        
        const boxes = [
            { 
                label: 'Schede Analizzate', 
                value: stats.total_places.toString(),
                color: this.colors.red
            },
            { 
                label: 'Recensioni Totali', 
                value: stats.total_reviews.toString(),
                color: this.colors.black
            },
            { 
                label: 'Rating Medio', 
                value: stats.avg_rating + '/5',
                color: this.colors.red
            },
            { 
                label: 'Recensioni Positive', 
                value: `${stats.positive} (${stats.positive_percent}%)`,
                color: this.colors.positive
            },
        ];
        
        boxes.forEach((box, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = startX + col * (boxWidth + gap);
            const y = yPos + row * (boxHeight + gap);
            
            // Background con bordo colorato
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...box.color);
            pdf.setLineWidth(2);
            pdf.roundedRect(x, y, boxWidth, boxHeight, 3, 3, 'FD');
            
            // Label
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...this.colors.grey);
            pdf.text(box.label, x + 5, y + 8);
            
            // Value (grande e centrato)
            pdf.setFontSize(22);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...box.color);
            const valueWidth = pdf.getTextWidth(box.value);
            pdf.text(box.value, x + (boxWidth / 2) - (valueWidth / 2), y + 22);
        });
        
        return yPos + (boxHeight * 2) + gap + 15;
    }
    
    addStarsDistribution(pdf, yPos) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.black);
        pdf.text('Distribuzione Stelle', 20, yPos);
        
        yPos += 12;
        
        const stats = this.calculateAggregateStats();
        const maxBarWidth = 120;
        
        // Header tabella
        pdf.setFillColor(245, 245, 245);
        pdf.rect(20, yPos, 170, 8, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.black);
        pdf.text('Stelle', 25, yPos + 5);
        pdf.text('Distribuzione', 70, yPos + 5);
        pdf.text('Numero', 160, yPos + 5);
        
        yPos += 10;
        
        [5, 4, 3, 2, 1].forEach((star, index) => {
            const count = stats.stars_distribution[star];
            const percent = stats.total_reviews > 0 ? (count / stats.total_reviews * 100).toFixed(1) : 0;
            const barWidth = stats.total_reviews > 0 ? (count / stats.total_reviews) * maxBarWidth : 0;
            
            const y = yPos + (index * 14);
            
            // Alternating row background
            if (index % 2 === 0) {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(20, y - 4, 170, 12, 'F');
            }
            
            // Stella
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...this.colors.black);
            pdf.text(`${star}`, 25, y + 3);
            
            // Stelle visuali (con asterischi)
            pdf.setFontSize(8);
            pdf.setTextColor(...this.colors.red);
            pdf.text('*'.repeat(star), 32, y + 3);
            
            // Bar background
            pdf.setFillColor(235, 235, 235);
            pdf.roundedRect(60, y - 2, maxBarWidth, 8, 2, 2, 'F');
            
            // Bar fill
            if (barWidth > 0) {
                pdf.setFillColor(...this.colors.red);
                pdf.roundedRect(60, y - 2, barWidth, 8, 2, 2, 'F');
            }
            
            // Percentuale nella barra
            if (barWidth > 15) {
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text(`${percent}%`, 65, y + 3);
            }
            
            // Count
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...this.colors.black);
            pdf.text(`${count}`, 165, y + 3);
        });
        
        return yPos + 75;
    }
    
    addAIAnalysis(pdf, yPos) {
        if (!this.aggregatedAiData) return yPos;
        
        const gpt = this.aggregatedAiData.gpt_analysis;
        
        // Titolo sezione
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.red);
        pdf.text('Analisi AI Strategica', 20, yPos);
        
        yPos += 12;
        
        // Priorità
        if (gpt.priorita && gpt.priorita.length > 0) {
            // Box priorità con sfondo
            pdf.setFillColor(...this.colors.redLight);
            pdf.roundedRect(20, yPos - 5, 170, 8, 2, 2, 'F');
            
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...this.colors.red);
            pdf.text('Top 3 Priorita Strategiche', 25, yPos);
            yPos += 8;
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...this.colors.black);
            
            gpt.priorita.forEach((priority, index) => {
                const lines = pdf.splitTextToSize(`${index + 1}. ${priority}`, 165);
                pdf.text(lines, 25, yPos);
                yPos += lines.length * 5 + 3;
            });
            
            yPos += 8;
        }
        
        // Check page overflow
        if (yPos > 240) {
            pdf.addPage();
            yPos = 20;
        }
        
        // Due colonne: Forza e Debolezza
        const colWidth = 80;
        const leftCol = 20;
        const rightCol = 110;
        
        // Punti di Forza (colonna sinistra)
        pdf.setFillColor(...this.colors.positive);
        pdf.rect(leftCol, yPos, colWidth, 6, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('Punti di Forza', leftCol + 3, yPos + 4);
        
        let yPosLeft = yPos + 10;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...this.colors.black);
        
        gpt.punti_forza.slice(0, 8).forEach(punto => {
            const lines = pdf.splitTextToSize(`• ${punto}`, colWidth - 6);
            pdf.text(lines, leftCol + 3, yPosLeft);
            yPosLeft += lines.length * 4 + 2;
        });
        
        // Punti di Debolezza (colonna destra)
        pdf.setFillColor(...this.colors.negative);
        pdf.rect(rightCol, yPos, colWidth, 6, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('Aree di Miglioramento', rightCol + 3, yPos + 4);
        
        let yPosRight = yPos + 10;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...this.colors.black);
        
        gpt.punti_debolezza.slice(0, 8).forEach(punto => {
            const lines = pdf.splitTextToSize(`• ${punto}`, colWidth - 6);
            pdf.text(lines, rightCol + 3, yPosRight);
            yPosRight += lines.length * 4 + 2;
        });
        
        yPos = Math.max(yPosLeft, yPosRight) + 10;
        
        // Check page overflow
        if (yPos > 220) {
            pdf.addPage();
            yPos = 20;
        }
        
        // Suggerimenti (full width)
        pdf.setFillColor(...this.colors.red);
        pdf.rect(20, yPos, 170, 6, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('Raccomandazioni Strategiche', 23, yPos + 4);
        yPos += 10;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...this.colors.black);
        
        gpt.suggerimenti_strategici.slice(0, 10).forEach((sugg, index) => {
            if (yPos > 270) {
                pdf.addPage();
                yPos = 20;
            }
            
            const lines = pdf.splitTextToSize(`${index + 1}. ${sugg}`, 165);
            pdf.text(lines, 25, yPos);
            yPos += lines.length * 4 + 3;
        });
        
        return yPos;
    }
    
    addPlacesDetail(pdf, yPos) {
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.red);
        pdf.text('Dettaglio Schede', 20, yPos);
        
        yPos += 12;
        
        Object.values(this.scrapingResults).forEach((result, index) => {
            if (yPos > 250) {
                pdf.addPage();
                yPos = 20;
            }
            
            const info = result.place_info;
            const stats = result.stats;
            
            // Box per scheda
            pdf.setDrawColor(...this.colors.grey);
            pdf.setLineWidth(0.5);
            pdf.roundedRect(20, yPos - 3, 170, 25, 2, 2, 'D');
            
            // Nome scheda
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...this.colors.red);
            pdf.text(`${index + 1}. ${info.name.substring(0, 60)}`, 23, yPos + 2);
            yPos += 7;
            
            // Indirizzo
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...this.colors.grey);
            const addressLines = pdf.splitTextToSize(info.address, 165);
            pdf.text(addressLines, 23, yPos);
            yPos += Math.min(addressLines.length * 3.5, 10);
            
            // Stats in box
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...this.colors.black);
            
            const statsText = `Recensioni: ${stats.total}  |  Rating: ${stats.avg_rating}/5  |  Positive: ${stats.positive}  |  Negative: ${stats.negative}`;
            pdf.text(statsText, 23, yPos + 3);
            
            yPos += 15;
        });
        
        return yPos;
    }
    
    addFooter(pdf, pageNum, totalPages) {
        const pageHeight = pdf.internal.pageSize.height;
        
        // Linea separatore
        pdf.setDrawColor(...this.colors.grey);
        pdf.setLineWidth(0.3);
        pdf.line(20, pageHeight - 15, 190, pageHeight - 15);
        
        pdf.setFontSize(8);
        pdf.setTextColor(...this.colors.grey);
        pdf.setFont('helvetica', 'normal');
        
        // Data
        const date = new Date().toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        pdf.text(`Generato il ${date}`, 20, pageHeight - 10);
        
        // Pagina
        pdf.text(`Pagina ${pageNum} di ${totalPages}`, 105, pageHeight - 10, { align: 'center' });
        
        // Moca
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...this.colors.red);
        pdf.text('Powered by Moca Interactive', 190, pageHeight - 10, { align: 'right' });
    }
    
    calculateAggregateStats() {
        let totalReviews = 0;
        let totalPositive = 0;
        let totalNegative = 0;
        let totalNeutral = 0;
        let totalRatingSum = 0;
        const starsDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
        
        Object.values(this.scrapingResults).forEach(result => {
            const stats = result.stats;
            totalReviews += stats.total;
            totalPositive += stats.positive;
            totalNegative += stats.negative;
            totalNeutral += stats.neutral;
            totalRatingSum += stats.avg_rating * stats.total;
            
            Object.keys(stats.stars_distribution).forEach(star => {
                starsDistribution[star] += stats.stars_distribution[star];
            });
        });
        
        const avgRating = totalReviews > 0 ? (totalRatingSum / totalReviews).toFixed(2) : 0;
        const positivePercent = totalReviews > 0 ? ((totalPositive / totalReviews) * 100).toFixed(1) : 0;
        
        return {
            total_places: Object.keys(this.scrapingResults).length,
            total_reviews: totalReviews,
            avg_rating: avgRating,
            positive: totalPositive,
            negative: totalNegative,
            neutral: totalNeutral,
            positive_percent: positivePercent,
            stars_distribution: starsDistribution
        };
    }
}

// Funzione globale per export
window.exportPDF = function() {
    if (!scrapingResults) {
        alert('Nessun risultato da esportare');
        return;
    }
    
    const exporter = new PDFExporter(brandName, scrapingResults, window.aggregatedAiData);
    exporter.generatePDF();
};
