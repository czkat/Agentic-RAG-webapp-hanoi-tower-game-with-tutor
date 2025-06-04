// js/AgenticRAGAgent.js - Educational Tutor Agent with RAG workflow
class AgenticRAGAgent {
    constructor() {
        this.gameContext = [];
        this.knowledgeBase = this.initializeKnowledgeBase();
        this.conversationHistory = [];
        this.currentGameState = null;
        this.playerProfile = {
            skillLevel: 'beginner',
            commonMistakes: [],
            learningProgress: []
        };
    }

    // Initialize domain-specific knowledge base for Tower of Hanoi
    initializeKnowledgeBase() {
        return {
            rules: [
                "Only move one disk at a time",
                "Only move the top disk from any tower",
                "Cannot place a larger disk on a smaller disk"
            ],
            strategies: [
                {
                    name: "recursive_pattern",
                    description: "To move n disks: move n-1 to auxiliary, move largest to destination, move n-1 from auxiliary to destination",
                    difficulty: "advanced"
                },
                {
                    name: "smallest_disk_cycle",
                    description: "Move smallest disk in consistent cycle: A→B→C→A for odd number of disks",
                    difficulty: "intermediate"
                },
                {
                    name: "alternating_moves",
                    description: "Alternate between moving smallest disk and making the only other legal move",
                    difficulty: "beginner"
                }
            ],
            commonMistakes: [
                {
                    pattern: "trying_to_move_buried_disk",
                    hint: "You can only move the top disk from each tower"
                },
                {
                    pattern: "placing_large_on_small",
                    hint: "Remember: larger disks cannot go on top of smaller ones"
                },
                {
                    pattern: "random_moves",
                    hint: "Try to develop a systematic approach rather than moving randomly"
                }
            ],
            pedagogicalTips: [
                "Start with understanding the base case (moving 1 disk)",
                "Practice with 3 disks before attempting more",
                "Visualize the recursive structure",
                "Focus on pattern recognition rather than memorization"
            ]
        };
    }

    // Function: Retrieve relevant context using RAG workflow
    async retrieveContext(query, gameState) {
        const retrievedInfo = {
            gameHistory: this.retrieveGameHistory(gameState),
            relevantStrategies: this.retrieveRelevantStrategies(query, gameState),
            mistakePatterns: this.identifyMistakePatterns(gameState),
            pedagogicalContext: this.getPedagogicalContext(query)
        };

        return this.rankAndFilterContext(retrievedInfo, query);
    }

    // Function: Retrieve game history context
    retrieveGameHistory(gameState) {
        const recentMoves = this.gameContext.slice(-5); // Last 5 moves
        const currentState = {
            towers: gameState.towers.map(tower => tower.disks.length),
            moveCount: gameState.moveCount,
            totalDisks: gameState.totalDisks
        };

        return {
            recentMoves,
            currentState,
            progress: this.calculateProgress(gameState)
        };
    }

    // Function: Retrieve relevant strategies based on current situation
    retrieveRelevantStrategies(query, gameState) {
        const relevantStrategies = [];
        const queryLower = query.toLowerCase();
        
        // Context-aware strategy retrieval
        if (queryLower.includes('stuck') || queryLower.includes('help')) {
            relevantStrategies.push(this.knowledgeBase.strategies.find(s => s.name === 'alternating_moves'));
        }
        
        if (gameState.moveCount === 0) {
            relevantStrategies.push(this.knowledgeBase.strategies.find(s => s.name === 'smallest_disk_cycle'));
        }
        
        if (gameState.totalDisks >= 4) {
            relevantStrategies.push(this.knowledgeBase.strategies.find(s => s.name === 'recursive_pattern'));
        }

        return relevantStrategies;
    }

    // Function: Identify mistake patterns from game history
    identifyMistakePatterns(gameState) {
        const identifiedMistakes = [];
        const recentMoves = this.gameContext.slice(-3);

        // Analyze for random movement pattern
        if (recentMoves.length >= 3) {
            const moveVariance = this.calculateMoveVariance(recentMoves);
            if (moveVariance > 0.8) {
                identifiedMistakes.push(this.knowledgeBase.commonMistakes.find(m => m.pattern === 'random_moves'));
            }
        }

        // Check for excessive moves compared to optimal
        const optimalMoves = Math.pow(2, gameState.totalDisks) - 1;
        if (gameState.moveCount > optimalMoves * 1.5) {
            identifiedMistakes.push({
                pattern: 'inefficient_solving',
                hint: 'Try to think more systematically about each move'
            });
        }

        return identifiedMistakes;
    }

    // Function: Get pedagogical context for educational guidance
    getPedagogicalContext(query) {
        const context = {
            learningObjectives: [],
            suggestedExercises: [],
            conceptsToReinforce: []
        };

        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('why') || queryLower.includes('understand')) {
            context.learningObjectives.push('Understanding the recursive nature of the problem');
            context.conceptsToReinforce.push('Pattern recognition in recursive algorithms');
        }
        
        if (queryLower.includes('faster') || queryLower.includes('efficient')) {
            context.learningObjectives.push('Learning optimal solution strategies');
            context.suggestedExercises.push('Practice with systematic move patterns');
        }

        return context;
    }

    // Function: Rank and filter retrieved context
    rankAndFilterContext(retrievedInfo, query) {
        // Simple relevance scoring based on query keywords and game state
        const rankedContext = {
            priority: 'high',
            gameHistory: retrievedInfo.gameHistory,
            topStrategies: retrievedInfo.relevantStrategies.slice(0, 2),
            keyMistakes: retrievedInfo.mistakePatterns.slice(0, 2),
            pedagogicalFocus: retrievedInfo.pedagogicalContext
        };

        return rankedContext;
    }

    // Function: Generate educational response using retrieved context
    async generateTutorResponse(query, gameState) {
        try {
            // Step 1: Retrieve context using RAG workflow
            const context = await this.retrieveContext(query, gameState);
            
            // Step 2: Analyze student's current situation
            const studentAnalysis = this.analyzeStudentSituation(context);
            
            // Step 3: Generate pedagogical response
            const response = await this.generatePedagogicalResponse(query, context, studentAnalysis);
            
            // Step 4: Update conversation history
            this.updateConversationHistory(query, response, context);
            
            return response;
        } catch (error) {
            console.error('Error generating tutor response:', error);
            return this.getFallbackResponse();
        }
    }

    // Function: Analyze student's current learning situation
    analyzeStudentSituation(context) {
        const analysis = {
            strugglingAreas: [],
            strengths: [],
            nextSteps: [],
            cognitiveLoad: 'appropriate'
        };

        // Analyze based on move efficiency
        const efficiency = this.calculateEfficiency(context.gameHistory);
        if (efficiency < 0.5) {
            analysis.strugglingAreas.push('systematic_planning');
            analysis.nextSteps.push('focus_on_pattern_recognition');
        }

        // Analyze mistake patterns
        if (context.keyMistakes.length > 0) {
            analysis.strugglingAreas.push('rule_application');
            analysis.nextSteps.push('reinforce_basic_rules');
        }

        // Check for signs of cognitive overload
        if (context.gameHistory.currentState.moveCount > 50) {
            analysis.cognitiveLoad = 'high';
            analysis.nextSteps.push('suggest_reset_with_fewer_disks');
        }

        return analysis;
    }

    // Function: Generate pedagogical response with Socratic method
    async generatePedagogicalResponse(query, context, analysis) {
        const response = {
            type: 'educational_guidance',
            message: '',
            hints: [],
            questions: [],
            encouragement: ''
        };

        // Construct educational response based on context and analysis
        if (analysis.strugglingAreas.includes('systematic_planning')) {
            response.message = "I notice you might benefit from a more systematic approach. ";
            response.questions.push("What pattern do you see in how the smallest disk should move?");
            response.hints.push("Try moving the smallest disk in a consistent cycle between towers");
        }

        // Add context-specific guidance
        if (context.topStrategies.length > 0) {
            const strategy = context.topStrategies[0];
            response.hints.push(`Strategy tip: ${strategy.description}`);
        }

        // Add mistake-specific guidance
        if (context.keyMistakes.length > 0) {
            const mistake = context.keyMistakes[0];
            response.message += `Hint: ${mistake.hint}`;
        }

        // Add Socratic questioning
        response.questions.push(this.generateSocraticQuestion(context, analysis));

        // Add encouragement based on progress
        response.encouragement = this.generateEncouragement(context.gameHistory);

        return response;
    }

    // Function: Generate Socratic questions to guide learning
    generateSocraticQuestion(context, analysis) {
        const questions = [
            "What do you think would happen if you move the smallest disk to each tower in sequence?",
            "Can you identify which disk needs to be moved to make progress toward your goal?",
            "What similarities do you see between solving this puzzle and the steps you'd take with fewer disks?",
            "If you had to explain your strategy to someone else, what would you say?"
        ];

        // Select question based on context
        if (context.gameHistory.currentState.moveCount === 0) {
            return "What's your plan for the first few moves?";
        }
        
        if (analysis.strugglingAreas.includes('systematic_planning')) {
            return questions[0];
        }

        return questions[Math.floor(Math.random() * questions.length)];
    }

    // Function: Generate contextual encouragement
    generateEncouragement(gameHistory) {
        const progress = gameHistory.progress;
        
        if (progress < 0.2) {
            return "Great start! Remember, every expert was once a beginner.";
        } else if (progress < 0.5) {
            return "You're making good progress! Keep thinking about the patterns.";
        } else if (progress < 0.8) {
            return "Excellent work! You're getting close to mastering this puzzle.";
        } else {
            return "Outstanding! You're showing real problem-solving skills.";
        }
    }

    // Function: Update conversation history for context
    updateConversationHistory(query, response, context) {
        this.conversationHistory.push({
            timestamp: Date.now(),
            userQuery: query,
            agentResponse: response,
            context: context,
            gameState: this.currentGameState
        });

        // Keep only recent conversation history (last 10 interactions)
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    // Function: Update game context when moves are made
    updateGameContext(moveInfo) {
        this.gameContext.push({
            timestamp: Date.now(),
            from: moveInfo.from,
            to: moveInfo.to,
            diskSize: moveInfo.diskSize,
            moveNumber: moveInfo.moveNumber
        });

        // Keep context manageable
        if (this.gameContext.length > 20) {
            this.gameContext = this.gameContext.slice(-20);
        }
    }

    // Function: Update current game state
    updateGameState(gameState) {
        this.currentGameState = {
            towers: gameState.towers.map(tower => ({
                disks: tower.disks.map(disk => disk.size)
            })),
            moveCount: gameState.moveCount,
            totalDisks: gameState.totalDisks,
            timestamp: Date.now()
        };
    }

    // Helper Functions
    calculateProgress(gameState) {
        const disksInDestination = gameState.towers[2].disks.length;
        return disksInDestination / gameState.totalDisks;
    }

    calculateMoveVariance(moves) {
        if (moves.length < 2) return 0;
        
        const fromTowers = moves.map(m => m.from);
        const toTowers = moves.map(m => m.to);
        
        // Simple variance calculation for move patterns
        const fromVariance = this.calculateArrayVariance(fromTowers);
        const toVariance = this.calculateArrayVariance(toTowers);
        
        return (fromVariance + toVariance) / 2;
    }

    calculateArrayVariance(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
        return variance;
    }

    calculateEfficiency(gameHistory) {
        const current = gameHistory.currentState;
        const optimal = Math.pow(2, current.totalDisks) - 1;
        return Math.max(0, Math.min(1, optimal / Math.max(current.moveCount, 1)));
    }

    getFallbackResponse() {
        return {
            type: 'fallback',
            message: "I'm here to help you learn! Can you tell me what specific aspect of the Tower of Hanoi you'd like to understand better?",
            hints: ["Try focusing on moving the smallest disk in a pattern"],
            questions: ["What's your current strategy?"],
            encouragement: "Keep exploring - problem-solving is a skill that improves with practice!"
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticRAGAgent;
}