# 📁 Bestanden voor TransIP Upload

## 🚀 **Verplichte Bestanden (Upload deze naar je server):**

### **Hoofdbestanden:**
- `server.js` - Backend server
- `package.json` - Dependencies configuratie
- `ecosystem.config.js` - PM2 configuratie
- `deploy.sh` - Deployment script

### **Frontend Bestanden:**
- `index.html` - Hoofdpagina
- `styles.css` - Styling
- `js/game.js` - Game engine
- `js/api.js` - API client
- `js/main.js` - Hoofdapplicatie

### **Documentatie:**
- `README.md` - Game documentatie
- `DEPLOYMENT.md` - Deployment gids
- `FILES_TO_UPLOAD.md` - Deze lijst

### **Configuratie:**
- `.gitignore` - Git configuratie

## 🎵 **Optionele Bestanden:**

### **Audio (als je geluidsbestanden hebt):**
- `audio/background.mp3` - Achtergrondmuziek
- `audio/pop.mp3` - Pop geluid
- `audio/fizz.mp3` - Fizz geluid
- `audio/buzzer.mp3` - Buzzer geluid
- `audio/powerup.mp3` - Power-up geluid
- `audio/README.md` - Audio documentatie

## 📋 **Upload Instructies:**

### **Methode 1: SCP (Secure Copy)**
```bash
# Upload alle bestanden in één keer
scp -r ./* root@jouw-server-ip:/var/www/lab-panic/
```

### **Methode 2: Git (Aanbevolen)**
```bash
# Op je lokale machine
git add .
git commit -m "Lab Panic v1.0.0"
git push origin main

# Op je server
cd /var/www
git clone https://github.com/jouw-username/lab-panic.git
cd lab-panic
```

### **Methode 3: FTP/SFTP**
Upload alle bestanden naar `/var/www/lab-panic/` op je server.

## ⚠️ **Belangrijke Notities:**

1. **Zorg dat alle bestanden de juiste permissies hebben:**
   ```bash
   chmod +x deploy.sh
   chmod 644 *.js *.html *.css *.json *.md
   ```

2. **De `node_modules/` map wordt automatisch aangemaakt door `npm install`**

3. **De `logs/` map wordt automatisch aangemaakt door het deployment script**

4. **Zorg dat je server Node.js 14+ heeft geïnstalleerd**

## 🔧 **Na Upload:**

1. **SSH naar je server:**
   ```bash
   ssh root@jouw-server-ip
   ```

2. **Ga naar de game directory:**
   ```bash
   cd /var/www/lab-panic
   ```

3. **Run het deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Configureer Nginx (zie DEPLOYMENT.md)**

5. **Installeer SSL certificaat (zie DEPLOYMENT.md)**

## 🎮 **Je game is dan live op:**
`https://jouw-domein.nl`



