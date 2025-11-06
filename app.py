"""
Moca Google Maps Reviews Scraper - Flask Backend v4
Con analisi AI OpenAI, URL manuali e auto-update
"""
from flask import Flask, render_template, request, jsonify
from apify_client import ApifyClient
from openai import OpenAI
import re
from datetime import datetime
from collections import Counter
import json
import sys
import os

# Import version e updater
from version import __version__
from updater import AppUpdater

app = Flask(__name__)
updater = AppUpdater()


# Colori brand Moca
MOCA_COLORS = {
    'red': '#E52217',
    'red_light': '#FFE7E6',
    'black': '#191919',
    'grey': '#8A8A8A'
}

# Stopwords italiane comuni
ITALIAN_STOPWORDS = {
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'di', 'da', 'a', 'in', 'su', 'per',
    'con', 'tra', 'fra', 'come', 'al', 'dello', 'della', 'dei', 'degli', 'delle', 'alla',
    'alle', 'allo', 'agli', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'nel', 'nello',
    'nella', 'nei', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
    'e', 'ed', 'o', 'od', 'ma', 'però', 'anche', 'se', 'non', 'più', 'che', 'chi', 'cui',
    'molto', 'molto', 'poco', 'tanto', 'quanto', 'così', 'dove', 'quando', 'come', 'perché',
    'mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'ne', 'sono', 'è', 'sei', 'siamo',
    'siete', 'ho', 'hai', 'ha', 'hanno', 'abbiamo', 'avete', 'stato', 'stata', 'stati', 'state',
    'essere', 'avere', 'fare', 'dire', 'andare', 'venire', 'questo', 'questa', 'questi', 'queste',
    'quello', 'quella', 'quelli', 'quelle', 'mio', 'tuo', 'suo', 'nostro', 'vostro', 'loro',
    'ho', 'un', 'una', 'dei', 'del', 'delle', 'degli'
}

@app.route('/api/check-update')
def check_update():
    """API: Controlla aggiornamenti disponibili"""
    update_info = updater.check_update()
    update_info['current_version'] = __version__
    return jsonify(update_info)

class ReviewsScraper:
    """Gestisce le operazioni di scraping"""
    
    def __init__(self, api_token):
        self.client = ApifyClient(api_token) if api_token else None
    
    @staticmethod
    def extract_place_id(url):
        """Estrae place_id da URL - Versione Migliorata"""
        if not url:
            return None
        
        # Caso 1: place_id esplicito nel query parameter
        match = re.search(r'query_place_id=([^&]+)', url)
        if match:
            return match.group(1)
        
        # Caso 2: place_id nel parametro
        match = re.search(r'place_id[=:]([^&\s]+)', url)
        if match:
            return match.group(1)
        
        # Caso 3: place_id nel data parameter
        match = re.search(r'/place/[^/]+/data=.*?!1s([^!]+)', url)
        if match:
            return match.group(1)
        
        # Caso 4: URL è già un place_id (inizia con ChIJ)
        if url.startswith('ChIJ'):
            return url
        
        # Caso 5: Estrai dal nome nella URL tipo /place/Nome+Luogo
        # In questo caso, ritorniamo l'URL stesso che verrà gestito diversamente
        match = re.search(r'/place/([^/\?#]+)', url)
        if match:
            # Ritorna un marker speciale per indicare che è un URL da nome
            return f"SEARCH:{match.group(1)}"
        
        return None
    
    @staticmethod
    def convert_to_place_url(url_or_place_id):
        """Converte in URL /place/ standard"""
        if not url_or_place_id:
            return None
            
        # Se inizia con ChIJ è già un place_id
        if url_or_place_id.startswith('ChIJ'):
            return f"https://www.google.com/maps/place/?q=place_id:{url_or_place_id}"
        
        # Se inizia con SEARCH: è un nome da cercare
        if url_or_place_id.startswith('SEARCH:'):
            search_name = url_or_place_id.replace('SEARCH:', '')
            # Ritorna l'URL originale per la ricerca
            return f"https://www.google.com/maps/place/{search_name}"
        
        # Altrimenti prova ad estrarre place_id
        place_id = ReviewsScraper.extract_place_id(url_or_place_id)
        if place_id and place_id.startswith('ChIJ'):
            return f"https://www.google.com/maps/place/?q=place_id:{place_id}"
        
        # Se non troviamo niente, ritorna l'URL originale
        return url_or_place_id
    
    def search_brand_places(self, brand_name, max_places=50):
        """Cerca schede Google Maps per brand"""
        run_input = {
            "searchStringsArray": [brand_name],
            "maxCrawledPlacesPerSearch": max_places,
            "language": "it",
            "countryCode": "it",
            "includeWebsiteUrl": True,
            "includeReviews": False
        }
        
        run = self.client.actor("nwua9Gu5YrADL7ZDj").call(run_input=run_input)
        
        places = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            place_id = self.extract_place_id(item.get('url', ''))
            if place_id:
                item['place_id'] = place_id
                item['scraper_url'] = self.convert_to_place_url(place_id)
            places.append(item)
        
        return places
    
    def scrape_reviews(self, place_url, max_reviews=100):
        """Estrae recensioni da una scheda"""
        run_input = {
            "startUrls": [{"url": place_url}],
            "maxReviews": max_reviews,
            "reviewsSort": "newest",
            "language": "it"
        }
        
        run = self.client.actor("compass/Google-Maps-Reviews-Scraper").call(
            run_input=run_input
        )
        
        reviews = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            reviews.append(item)
        
        return reviews
    
    def analyze_reviews(self, reviews):
        """Analizza recensioni e ritorna statistiche"""
        if not reviews:
            return None
        
        with_text = sum(1 for r in reviews if r.get('text'))
        with_response = sum(1 for r in reviews if r.get('responseFromOwnerText'))
        
        stars_count = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for r in reviews:
            stars = r.get('stars', 0)
            if stars in stars_count:
                stars_count[stars] += 1
        
        positive = stars_count[4] + stars_count[5]
        negative = stars_count[1] + stars_count[2]
        neutral = stars_count[3]
        
        avg_rating = sum(r.get('stars', 0) for r in reviews) / len(reviews)
        
        return {
            'total': len(reviews),
            'with_text': with_text,
            'without_text': len(reviews) - with_text,
            'with_response': with_response,
            'without_response': len(reviews) - with_response,
            'avg_rating': round(avg_rating, 2),
            'positive': positive,
            'negative': negative,
            'neutral': neutral,
            'stars_distribution': stars_count
        }

class AIAnalyzer:
    """Gestisce analisi AI con OpenAI"""
    
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)
    
    def extract_keywords(self, reviews, top_n=30):
        """Estrae le parole più comuni dalle recensioni (per wordcloud)"""
        all_text = ' '.join([
            r.get('text', '').lower() 
            for r in reviews 
            if r.get('text')
        ])
        
        # Tokenizza e rimuovi stopwords
        words = re.findall(r'\b[a-zàèéìòù]{3,}\b', all_text)
        filtered_words = [w for w in words if w not in ITALIAN_STOPWORDS]
        
        # Conta frequenze
        word_counts = Counter(filtered_words)
        
        return word_counts.most_common(top_n)
    
    def analyze_with_gpt(self, reviews, place_name):
        """Analisi completa con GPT-4"""
        
        # Separa positive e negative
        positive_reviews = [r for r in reviews if r.get('stars', 0) >= 4 and r.get('text')]
        negative_reviews = [r for r in reviews if r.get('stars', 0) <= 2 and r.get('text')]
        
        # Prendi sample
        positive_sample = positive_reviews[:20]
        negative_sample = negative_reviews[:20]
        
        # Prepara testi
        positive_texts = '\n'.join([f"- {r['text'][:200]}" for r in positive_sample])
        negative_texts = '\n'.join([f"- {r['text'][:200]}" for r in negative_sample])
        
        prompt = f"""Analizza le seguenti recensioni di Google Maps per "{place_name}".

RECENSIONI POSITIVE (estratti):
{positive_texts}

RECENSIONI NEGATIVE (estratti):
{negative_texts}

Fornisci un'analisi strutturata in formato JSON con:
1. "punti_forza": array di 5-10 punti di forza principali emersi dalle recensioni positive
2. "punti_debolezza": array di 5-10 punti di debolezza principali emersi dalle recensioni negative
3. "esempi_positivi": array di max 3 oggetti con "punto" (punto di forza), "testo" (estratto recensione breve)
4. "esempi_negativi": array di max 3 oggetti con "punto" (punto di debolezza), "testo" (estratto recensione breve)
5. "suggerimenti": array di 5-7 suggerimenti concreti e actionable per migliorare il servizio

Rispondi SOLO con JSON valido, senza testo aggiuntivo."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Sei un esperto analista di customer feedback e sentiment analysis. Rispondi sempre in italiano e sempre in formato JSON valido."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Rimuovi eventuali markdown code blocks
            if content.startswith('```'):
                content = re.sub(r'^```json\n|^```\n|```$', '', content, flags=re.MULTILINE).strip()
            
            analysis = json.loads(content)
            
            # Aggiungi URL alle recensioni negli esempi
            for esempio in analysis.get('esempi_positivi', []):
                # Cerca la recensione corrispondente
                for r in positive_sample:
                    if esempio.get('testo', '') and esempio['testo'][:50] in r.get('text', '')[:100]:
                        esempio['reviewUrl'] = r.get('reviewUrl', '#')
                        break
            
            for esempio in analysis.get('esempi_negativi', []):
                for r in negative_sample:
                    if esempio.get('testo', '') and esempio['testo'][:50] in r.get('text', '')[:100]:
                        esempio['reviewUrl'] = r.get('reviewUrl', '#')
                        break
            
            return analysis
            
        except Exception as e:
            print(f"Errore GPT: {e}")
            import traceback
            traceback.print_exc()
            return {
                'punti_forza': ['Analisi non disponibile - errore API'],
                'punti_debolezza': ['Analisi non disponibile - errore API'],
                'esempi_positivi': [],
                'esempi_negativi': [],
                'suggerimenti': ['Analisi non disponibile - errore API'],
                'error': str(e)
            }
    
    def analyze_aggregated(self, all_reviews, brand_name, places_count):
        """Analisi aggregata di tutte le recensioni di tutte le schede"""
        
        # Separa positive e negative da TUTTE le schede
        positive_reviews = [r for r in all_reviews if r.get('stars', 0) >= 4 and r.get('text')]
        negative_reviews = [r for r in all_reviews if r.get('stars', 0) <= 2 and r.get('text')]
        
        # Prendi sample bilanciato
        import random
        positive_sample = random.sample(positive_reviews, min(30, len(positive_reviews)))
        negative_sample = random.sample(negative_reviews, min(30, len(negative_reviews)))
        
        # Prepara testi
        positive_texts = '\n'.join([f"- {r['text'][:200]}" for r in positive_sample])
        negative_texts = '\n'.join([f"- {r['text'][:200]}" for r in negative_sample])
        
        prompt = f"""Analizza le seguenti recensioni aggregate di Google Maps per il brand "{brand_name}" ({places_count} schede analizzate).

RECENSIONI POSITIVE (sample da {len(positive_reviews)} totali):
{positive_texts}

RECENSIONI NEGATIVE (sample da {len(negative_reviews)} totali):
{negative_texts}

Fornisci un'analisi STRATEGICA aggregata in formato JSON con:
1. "punti_forza": array di 7-12 punti di forza COMUNI a livello di brand (non specifici di una singola location)
2. "punti_debolezza": array di 7-12 punti di debolezza RICORRENTI a livello di brand
3. "temi_positivi": array di 5 macro-temi positivi emersi (es. "Qualità Prodotti", "Servizio Clienti")
4. "temi_negativi": array di 5 macro-temi negativi emersi
5. "suggerimenti_strategici": array di 8-10 suggerimenti STRATEGICI per il brand a livello corporate (non operativi per singola sede)
6. "priorita": array di 3 priorità TOP su cui il brand dovrebbe concentrarsi

Rispondi SOLO con JSON valido, senza testo aggiuntivo."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Sei un consulente strategico esperto in brand reputation e customer experience analysis. Fornisci insights strategici ad alto livello per decisioni corporate."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Rimuovi eventuali markdown code blocks
            if content.startswith('```'):
                content = re.sub(r'^```json\n|^```\n|```$', '', content, flags=re.MULTILINE).strip()
            
            analysis = json.loads(content)
            
            return analysis
            
        except Exception as e:
            print(f"Errore GPT aggregato: {e}")
            import traceback
            traceback.print_exc()
            return {
                'punti_forza': ['Analisi aggregata non disponibile'],
                'punti_debolezza': ['Analisi aggregata non disponibile'],
                'temi_positivi': [],
                'temi_negativi': [],
                'suggerimenti_strategici': ['Analisi aggregata non disponibile'],
                'priorita': [],
                'error': str(e)
            }

# Routes
@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

@app.route('/api/search-places', methods=['POST'])
def search_places():
    """API: Cerca schede per brand"""
    try:
        data = request.get_json()
        api_token = data.get('api_token')
        brand_name = data.get('brand_name')
        max_places = data.get('max_places', 20)
        
        if not api_token or not brand_name:
            return jsonify({'error': 'Parametri mancanti'}), 400
        
        scraper = ReviewsScraper(api_token)
        places = scraper.search_brand_places(brand_name, max_places)
        
        places_data = []
        for place in places:
            places_data.append({
                'place_id': place.get('place_id'),
                'name': place.get('title'),
                'address': place.get('address'),
                'rating': place.get('totalScore'),
                'reviews_count': place.get('reviewsCount'),
                'scraper_url': place.get('scraper_url')
            })
        
        return jsonify({
            'success': True,
            'places': places_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/parse-manual-urls', methods=['POST'])
def parse_manual_urls():
    """API: Parse e valida URL inseriti manualmente"""
    try:
        data = request.get_json()
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'error': 'Nessun URL fornito'}), 400
        
        scraper = ReviewsScraper(None)  # Non serve client per parsing
        places_data = []
        
        for url in urls:
            url = url.strip()
            if not url:
                continue
            
            # Estrai place_id o search term
            place_id = scraper.extract_place_id(url)
            
            if not place_id:
                # Prova a vedere se è un URL diretto con place_id
                if 'place_id:' in url:
                    place_id = url.split('place_id:')[1].split('&')[0]
                elif url.startswith('ChIJ'):
                    place_id = url
            
            if place_id:
                scraper_url = scraper.convert_to_place_url(place_id)
                
                # Determina il nome da mostrare
                display_name = f'Scheda {len(places_data) + 1}'
                if place_id.startswith('SEARCH:'):
                    # Estrai nome leggibile dall'URL
                    search_term = place_id.replace('SEARCH:', '').replace('+', ' ')
                    display_name = search_term
                
                places_data.append({
                    'place_id': place_id,
                    'name': display_name,
                    'address': 'Da determinare',
                    'rating': None,
                    'reviews_count': None,
                    'scraper_url': scraper_url,
                    'original_url': url
                })
            else:
                # URL non valido
                places_data.append({
                    'place_id': None,
                    'name': f'URL non valido',
                    'address': url,
                    'rating': None,
                    'reviews_count': None,
                    'scraper_url': None,
                    'original_url': url,
                    'error': True
                })
        
        return jsonify({
            'success': True,
            'places': places_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scrape-reviews', methods=['POST'])
def scrape_reviews():
    """API: Estrae recensioni da schede selezionate"""
    try:
        data = request.get_json()
        api_token = data.get('api_token')
        openai_api_key = data.get('openai_api_key')
        selected_places = data.get('places', [])
        max_reviews = data.get('max_reviews', 100)
        enable_ai = data.get('enable_ai', False)
        
        if not api_token or not selected_places:
            return jsonify({'error': 'Parametri mancanti'}), 400
        
        scraper = ReviewsScraper(api_token)
        results = {}
        
        # Inizializza AI se richiesto
        ai_analyzer = None
        if enable_ai and openai_api_key:
            try:
                ai_analyzer = AIAnalyzer(openai_api_key)
            except Exception as e:
                print(f"Errore inizializzazione AI: {e}")
        
        # Raccogli TUTTE le recensioni per analisi aggregata
        all_reviews = []
        
        for place in selected_places:
            place_id = place['place_id']
            place_url = place['scraper_url']
            
            # Scraping
            reviews = scraper.scrape_reviews(place_url, max_reviews)
            stats = scraper.analyze_reviews(reviews)
            
            result = {
                'place_info': place,
                'stats': stats,
                'reviews': reviews
            }
            
            # Aggiungi a lista totale
            all_reviews.extend(reviews)
            
            # Analisi AI per singola scheda
            if ai_analyzer and reviews:
                try:
                    keywords = ai_analyzer.extract_keywords(reviews)
                    gpt_analysis = ai_analyzer.analyze_with_gpt(reviews, place['name'])
                    
                    result['ai_analysis'] = {
                        'keywords': keywords,
                        'gpt_analysis': gpt_analysis
                    }
                except Exception as e:
                    print(f"Errore analisi AI per {place['name']}: {e}")
            
            results[place_id] = result
        
        # Analisi AI aggregata (su TUTTE le recensioni)
        aggregated_ai = None
        if ai_analyzer and all_reviews:
            try:
                # Estrai brand name dal primo place
                brand_name = selected_places[0]['name'].split('-')[0].strip() if selected_places else 'Brand'
                
                aggregated_keywords = ai_analyzer.extract_keywords(all_reviews, top_n=50)
                aggregated_gpt = ai_analyzer.analyze_aggregated(
                    all_reviews, 
                    brand_name,
                    len(selected_places)
                )
                
                aggregated_ai = {
                    'keywords': aggregated_keywords,
                    'gpt_analysis': aggregated_gpt
                }
            except Exception as e:
                print(f"Errore analisi AI aggregata: {e}")
        
        return jsonify({
            'success': True,
            'results': results,
            'aggregated_ai': aggregated_ai,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)