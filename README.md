# Lab Panic 🧪

Een kleurrijk, reflex-gebaseerd 2D spel waar je vallende flesjes moet tikken in een laboratorium setting. Speelbaar op zowel mobiel (touch) als desktop (muis)!

## 🎮 Gameplay

- **Doel**: Tik op vallende flesjes voordat ze de grond raken
- **Flesjes**:
  - 🟢 **Groene/blauwe flesjes**: +10 punten
  - 🔴 **Rode flesjes (gevaarlijk)**: +5 punten, maar -1 leven als ze de grond raken
  - ⭐ **Power-up flesjes**: Speciale effecten (5% kans)
- **Levens**: Start met 3 levens
- **Moeilijkheid**: Neemt elke 30 seconden toe
- **Power-ups**:
  - ⏰ **Tijdsrem**: Alles valt 5 seconden lang trager
  - 💥 **Explosie**: Alle flesjes verdwijnen
  - ⭐ **Multiplier**: Punten x2 voor 10 seconden

## 🏆 Leaderboard

- **Weekelijkse Top 25**: Reset elke maandag
- **All-Time Top 25**: Permanente lijst
- **Score delen**: Genereer een deelbare link na het spelen

## 🚀 Installatie & Starten

### Vereisten
- Node.js 14.0.0 of hoger
- npm of yarn

### Stappen

1. **Clone of download het project**
   ```bash
   git clone <repository-url>
   cd lab-panic
   ```

2. **Installeer dependencies**
   ```bash
   npm install
   ```

3. **Start de server**
   ```bash
   npm start
   ```

4. **Open de game**
   - Ga naar `http://localhost:8787` in je browser
   - De game werkt het beste in fullscreen modus

### Development modus
```bash
npm run dev
```
Dit start de server met auto-reload bij code wijzigingen.

## 🎯 Hoe te spelen

### Desktop
- Gebruik je muis om op flesjes te klikken
- Het spel pauzeert automatisch als je het venster verlaat

### Mobiel
- Tik op flesjes om ze te activeren
- De game is geoptimaliseerd voor touch-schermen
- Werkt het beste in landscape modus

### Controls
- **Start**: Klik op "START SPEL"
- **Pauze**: Verlaat het venster of gebruik Alt+Tab
- **Leaderboard**: Bekijk scores op het startscherm
- **Score delen**: Na Game Over kun je je score delen

## 🏗️ Technische Details

### Frontend
- **HTML5 Canvas** voor rendering
- **Vanilla JavaScript** (geen frameworks)
- **Responsive design** voor alle schermformaten
- **Touch & mouse support**

### Backend
- **Node.js + Express** server
- **RESTful API** volgens OpenAPI 3.0.3 specificatie
- **In-memory storage** (kan uitgebreid worden naar database)
- **Session management** voor anti-cheat

### API Endpoints
- `GET /api/health` - Health check
- `GET /api/version` - API versie
- `POST /api/sessions/start` - Start game sessie
- `POST /api/scores` - Dien score in
- `GET /api/leaderboard` - Haal leaderboard op
- `GET /api/leaderboard/weeks` - Beschikbare weken
- `GET /share/{slug}` - Deelbare score pagina

## 🎨 Visuele Features

- **Kleurrijk cartoon design** met neon effecten
- **Laboratorium thema** met bubbelende vaten
- **Particle effects** bij flesje explosies
- **Smooth animaties** en transities
- **Responsive UI** voor alle apparaten

## 🔊 Audio

De game ondersteunt audio voor een betere ervaring:
- Achtergrondmuziek
- Geluideffecten voor verschillende acties
- Automatische pauze bij venster verlies

## 🔧 Configuratie

### Server configuratie
- **Poort**: 8787 (configureerbaar via `PORT` environment variable)
- **CORS**: Ingeschakeld voor cross-origin requests
- **Static files**: Automatisch geserveerd

### Game configuratie
- **Spawn rate**: Aanpasbaar in `js/game.js`
- **Difficulty scaling**: Elke 30 seconden
- **Power-up kans**: 5% per flesje
- **Max flesjes**: 3-6 afhankelijk van moeilijkheid

## 🐛 Troubleshooting

### Veelvoorkomende problemen

1. **Server start niet**
   - Controleer of Node.js geïnstalleerd is
   - Controleer of poort 8787 beschikbaar is
   - Probeer `npm install` opnieuw

2. **Game laadt niet**
   - Controleer browser console voor errors
   - Zorg dat JavaScript ingeschakeld is
   - Probeer een andere browser

3. **Audio werkt niet**
   - Moderne browsers vereisen user interaction voor audio
   - Klik eerst ergens op de pagina
   - Controleer browser audio instellingen

4. **Touch werkt niet op mobiel**
   - Zorg dat de pagina in fullscreen is
   - Controleer of touch events niet geblokkeerd worden
   - Probeer landscape modus

## 📱 Browser Ondersteuning

- **Chrome**: 60+
- **Firefox**: 55+
- **Safari**: 12+
- **Edge**: 79+
- **Mobile browsers**: iOS Safari, Chrome Mobile

## 🔮 Toekomstige Features

- [ ] Database integratie (PostgreSQL)
- [ ] Meer power-up types
- [ ] Achievements systeem
- [ ] Daily challenges
- [ ] Social media integratie
- [ ] Sound settings
- [ ] High DPI support
- [ ] PWA support

## 📄 Licentie

MIT License - zie LICENSE bestand voor details.

## 🤝 Bijdragen

Bijdragen zijn welkom! Open een issue of pull request.

## 📞 Support

Voor vragen of problemen:
- Open een GitHub issue
- Controleer de troubleshooting sectie
- Bekijk de browser console voor errors

---

**Veel speelplezier! 🎮**

