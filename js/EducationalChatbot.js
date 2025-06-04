// js/EducationalChatbot.js - Chatbot interface with LLM integration
class EducationalChatbot {
    constructor(game, agenticAgent) {
        this.game = game;
        this.agent = agenticAgent;
        this.isOpen = false;
        this.apiEndpoint = '/.netlify/functions/chatbot'; // Netlify function endpoint
        this.initializeChatbot();
    }

    initializeChatbot() {
        this.createChatbotUI();
        this.setupEventListeners();
        this.addGameIntegration();
    }

    createChatbotUI() {
        // Create chatbot container
        const chatbotHTML = `
            <div id="chatbot-container" class="chatbot-container">
                <div id="chatbot-header" class="chatbot-header">
                    <div class="chatbot-title">
                        <span class="bot-icon">🎓</span>
                        <span>Hanoi Tutor</span>
                    </div>
                    <button id="chatbot-toggle" class="chatbot-toggle">💬</button>
                </div>
                <div id="chatbot-content" class="chatbot-content">
                    <div id="chat-messages" class="chat-messages">
                        <div class="message bot-message">
                            <div class="message-content">
                                <p>Hi! I'm your Tower of Hanoi tutor. I'm here to help you learn problem-solving strategies.</p>
                                <p>Try making a few moves, then ask me questions like:</p>
                                <ul>
                                    <li>"What should I do next?"</li>
                                    <li>"Why can't I move this disk?"</li>
                                    <li>"What's the best strategy?"</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="chat-input-container">
                        <input type="text" id="chat-input" placeholder="Ask me about your next move..." maxlength="200">
                        <button id="send-message" class="send-button">Send</button>
                    </div>
                    <div class="quick-questions">
                        <button class="quick-question" data-question="I'm stuck, what should I do?">I'm stuck</button>
                        <button class="quick-question" data-question="What's the best strategy for this puzzle?">Best strategy?</button>
                        <button class="quick-question" data-question="Why is this move not allowed?">Invalid move?</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('chatbot-toggle');
        const sendBtn = document.getElementById('send-message');
        const chatInput = document.getElementById('chat-input');
        const quickQuestions = document.querySelectorAll('.quick-question');

        // Toggle chatbot visibility
        toggleBtn.addEventListener('click', () => {
            this.toggleChatbot();
        });

        // Send message
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key to send message
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Quick question buttons
        quickQuestions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.target.dataset.question;
                this.sendMessage(question);
            });
        });

        // Auto-open chatbot when user seems stuck (after 30 seconds of no moves)
        this.setupStuckDetection();
    }

    addGameIntegration() {
        // Override the game's moveDisk method to track moves for the agent
        const originalMoveDisk = this.game.moveDisk.bind(this.game);
        this.game.moveDisk = (from, to) => {
            const result = originalMoveDisk(from, to);
            if (result) {
                // Update agent with move information
                this.agent.updateGameContext({
                    from: from,
                    to: to,
                    diskSize: this.game.towers[to].getTopDiskSize(),
                    moveNumber: this.game.moveCount
                });
                this.agent.updateGameState(this.game);
            }
            return result;
        };

        // Track game resets
        const originalResetGame = this.game.resetGame.bind(this.game);
        this.game.resetGame = () => {
            originalResetGame();
            this.agent.updateGameState(this.game);
            this.addBotMessage("Game reset! Ready to try a new approach? I'm here to help!");
        };
    }

    setupStuckDetection() {
        let lastMoveTime = Date.now();
        let stuckMessageSent = false;

        // Update last move time when moves are made
        const originalMoveDisk = this.game.moveDisk.bind(this.game);
        this.game.moveDisk = (from, to) => {
            const result = originalMoveDisk(from, to);
            if (result) {
                lastMoveTime = Date.now();
                stuckMessageSent = false;
            }
            return result;
        };

        // Check for stuck condition every 10 seconds
        setInterval(() => {
            const timeSinceLastMove = Date.now() - lastMoveTime;
            if (timeSinceLastMove > 30000 && !stuckMessageSent && this.game.moveCount > 0) {
                this.suggestHelp();
                stuckMessageSent = true;
            }
        }, 10000);
    }

    toggleChatbot() {
        const container = document.getElementById('chatbot-container');
        const content = document.getElementById('chatbot-content');
        
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            container.classList.add('open');
            content.style.display = 'flex';
        } else {
            container.classList.remove('open');
            content.style.display = 'none';
        }
    }

    async sendMessage(message = null) {
        const chatInput = document.getElementById('chat-input');
        const userMessage = message || chatInput.value.trim();
        
        if (!userMessage) return;

        // Clear input
        chatInput.value = '';

        // Add user message to chat
        this.addUserMessage(userMessage);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get response from the agentic RAG system
            const agentResponse = await this.agent.generateTutorResponse(userMessage, this.game);
            
            // Send to external LLM for natural language generation (if needed)
            const enhancedResponse = await this.enhanceResponseWithLLM(userMessage, agentResponse);
            
            // Remove typing indicator and show response
            this.hideTypingIndicator();
            this.addBotMessage(enhancedResponse);

        } catch (error) {
            console.error('Error getting chatbot response:', error);
            this.hideTypingIndicator();
            this.addBotMessage("I'm having trouble right now, but I can still help! Try asking about specific moves or strategies.");
        }
    }

    async enhanceResponseWithLLM(userMessage, agentResponse) {
        try {
            const payload = {
                userMessage: userMessage,
                agentResponse: agentResponse,
                gameState: this.agent.currentGameState,
                conversationHistory: this.agent.conversationHistory.slice(-3) // Last 3 interactions
            };

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                return data.message || this.formatAgentResponse(agentResponse);
            } else {
                console.warn('LLM API unavailable, using agent response');
                return this.formatAgentResponse(agentResponse);
            }
        } catch (error) {
            console.warn('Failed to enhance response with LLM:', error);
            return this.formatAgentResponse(agentResponse);
        }
    }

    formatAgentResponse(agentResponse) {
        let formattedResponse = agentResponse.message || '';
        
        if (agentResponse.hints && agentResponse.hints.length > 0) {
            formattedResponse += '\n\n💡 ' + agentResponse.hints[0];
        }
        
        if (agentResponse.questions && agentResponse.questions.length > 0) {
            formattedResponse += '\n\n🤔 ' + agentResponse.questions[0];
        }
        
        if (agentResponse.encouragement) {
            formattedResponse += '\n\n⭐ ' + agentResponse.encouragement;
        }

        return formattedResponse;
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(message)}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        
        // Convert newlines to HTML breaks and format special characters
        const formattedMessage = message
            .replace(/\n/g, '<br>')
            .replace(/💡/g, '<span class="hint-icon">💡</span>')
            .replace(/🤔/g, '<span class="question-icon">🤔</span>')
            .replace(/⭐/g, '<span class="encouragement-icon">⭐</span>');
        
        messageDiv.innerHTML = `<div class="message-content">${formattedMessage}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    suggestHelp() {
        if (!this.isOpen) {
            this.toggleChatbot();
        }
        this.addBotMessage("I notice you haven't made a move in a while. Would you like a hint to get unstuck? 🤔");
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EducationalChatbot;
}