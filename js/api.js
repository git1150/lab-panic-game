// API module voor Lab Panic Leaderboard
class LabPanicAPI {
    constructor() {
        this.baseUrl = 'https://labpanic.com'; // Production server
        this.sessionId = null;
        this.startToken = null;
        this.platform = this.detectPlatform();
    }

    detectPlatform() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            ? 'mobile' 
            : 'desktop';
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            console.log('Making API request to:', url, config);
            const response = await fetch(url, config);
            
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error response:', errorData);
                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API response data:', data);
            return data;
        } catch (error) {
            console.error('API Error details:', {
                endpoint,
                url,
                config,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // Start een nieuwe gamesessie
    async startSession() {
        try {
            const response = await this.makeRequest('/api/sessions/start', {
                method: 'POST',
                body: JSON.stringify({
                    platform: this.platform
                })
            });

            this.sessionId = response.session_id;
            this.startToken = response.start_token;
            
            return response;
        } catch (error) {
            console.error('Failed to start session:', error);
            throw error;
        }
    }

    // Dien een score in
    async submitScore(playerName, score) {
        // Als er geen actieve sessie is, start er dan een
        if (!this.sessionId || !this.startToken) {
            console.log('Geen actieve sessie, start nieuwe sessie...');
            await this.startSession();
        }

        try {
            const response = await this.makeRequest('/api/scores', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: this.sessionId,
                    start_token: this.startToken,
                    player_name: playerName,
                    score: score,
                    platform: this.platform
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to submit score:', error);
            throw error;
        }
    }

    // Haal leaderboard op
    async getLeaderboard(scope = 'weekly', limit = 25, week = null) {
        let url = `/api/leaderboard?scope=${scope}&limit=${limit}`;
        
        if (scope === 'weekly' && week) {
            url += `&week=${week}`;
        }

        try {
            const response = await this.makeRequest(url);
            return response;
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            throw error;
        }
    }

    // Haal beschikbare weken op
    async getAvailableWeeks() {
        try {
            const response = await this.makeRequest('/api/leaderboard/weeks');
            return response.weeks || [];
        } catch (error) {
            console.error('Failed to get available weeks:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            const response = await this.makeRequest('/api/health');
            return response;
        } catch (error) {
            console.error('Health check failed:', error);
            throw error;
        }
    }

    // Versie check
    async getVersion() {
        try {
            const response = await this.makeRequest('/api/version');
            return response;
        } catch (error) {
            console.error('Version check failed:', error);
            throw error;
        }
    }

    // Genereer share URL
    generateShareUrl(shareSlug) {
        return `${window.location.origin}/share/${shareSlug}`;
    }

    // Reset sessie
    resetSession() {
        this.sessionId = null;
        this.startToken = null;
    }

    // Check sessie status
    hasActiveSession() {
        return !!(this.sessionId && this.startToken);
    }

    // Get sessie info voor debugging
    getSessionInfo() {
        return {
            hasSession: this.hasActiveSession(),
            sessionId: this.sessionId,
            hasStartToken: !!this.startToken,
            platform: this.platform
        };
    }
}

// Export voor gebruik in andere modules
window.LabPanicAPI = LabPanicAPI;
