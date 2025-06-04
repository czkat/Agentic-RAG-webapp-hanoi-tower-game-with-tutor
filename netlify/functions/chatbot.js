// netlify/functions/chatbot.js - Netlify Function for LLM Integration
const https = require('https');

// Using OpenAI API (can be replaced with other providers like Anthropic, Groq, etc.)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Alternative: Using Hugging Face Inference API (free tier available)
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HF_API_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { userMessage, agentResponse, gameState, conversationHistory } = JSON.parse(event.body);

        // Choose API based on available environment variables
        let enhancedResponse;
        if (OPENAI_API_KEY) {
            enhancedResponse = await callOpenAI(userMessage, agentResponse, gameState, conversationHistory);
        } else if (HF_API_KEY) {
            enhancedResponse = await callHuggingFace(userMessage, agentResponse, gameState);
        } else {
            // Fallback to local processing if no API keys available
            enhancedResponse = enhanceResponseLocally(userMessage, agentResponse, gameState);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: enhancedResponse,
                source: OPENAI_API_KEY ? 'openai' : HF_API_KEY ? 'huggingface' : 'local'
            })
        };

    } catch (error) {
        console.error('Chatbot function error:', error);
        
        // Fallback response
        const fallbackResponse = generateFallbackResponse(event.body);
        
        return {
            statusCode: 200, // Return 200 to avoid breaking the chat
            headers,
            body: JSON.stringify({ 
                message: fallbackResponse,
                source: 'fallback'
            })
        };
    }
};

// OpenAI API integration
async function callOpenAI(userMessage, agentResponse, gameState, conversationHistory) {
    const systemPrompt = `You are an educational tutor for the Tower of Hanoi puzzle. Your role is to:
1. Help students learn problem-solving strategies through Socratic questioning
2. Provide hints without giving direct answers
3. Encourage critical thinking and pattern recognition
4. Use a friendly, supportive tone appropriate for learning

Game Context:
- Current moves: ${gameState?.moveCount || 0}
- Total disks: ${gameState?.totalDisks || 3}
- Progress: ${calculateProgress(gameState)}%

Student's question: "${userMessage}"

Agent's analysis: ${JSON.stringify(agentResponse)}

Please provide a natural, conversational response that incorporates the agent's insights while maintaining an educational, Socratic teaching style. Keep responses concise (2-3 sentences) and end with a thought-provoking question when appropriate.`;

    const payload = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        max_tokens: 150,
        temperature: 0.7
    };

    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(responseData);
                    if (response.choices && response.choices[0]) {
                        resolve(response.choices[0].message.content);
                    } else {
                        reject(new Error('Invalid OpenAI response'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Hugging Face API integration (free alternative)
async function callHuggingFace(userMessage, agentResponse, gameState) {
    const prompt = `Student question: ${userMessage}\nTutor response: `;
    
    const payload = {
        inputs: prompt,
        parameters: {
            max_length: 100,
            temperature: 0.7,
            do_sample: true
        }
    };

    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: 'api-inference.huggingface.co',
            port: 443,
            path: '/models/microsoft/DialoGPT-medium',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(responseData);
                    if (response[0] && response[0].generated_text) {
                        const generatedText = response[0].generated_text.replace(prompt, '').trim();
                        resolve(generatedText || generateFallbackResponse(userMessage));
                    } else {
                        resolve(generateFallbackResponse(userMessage));
                    }
                } catch (error) {
                    resolve(generateFallbackResponse(userMessage));
                }
            });
        });

        req.on('error', (error) => {
            resolve(generateFallbackResponse(userMessage));
        });

        req.write(data);
        req.end();
    });
}

// Local response enhancement (fallback when no API available)
function enhanceResponseLocally(userMessage, agentResponse, gameState) {
    const templates = {
        stuck: [
            "I can see you're feeling stuck! Let's think about this step by step. {hint} What do you think would happen if you tried that approach?",
            "Getting stuck is part of learning! {hint} Can you see why this might be the next logical step?",
            "Don't worry about being stuck - it means you're thinking! {hint} What pattern do you notice?"
        ],
        strategy: [
            "Great question about strategy! {hint} How do you think this connects to what you've learned about problem-solving?",
            "Strategy is key to solving puzzles efficiently. {hint} What similarities do you see with other problems you've solved?",
            "Let's explore different approaches together. {hint} Why do you think this strategy might work?"
        ],
        rules: [
            "Understanding the rules is important! {hint} Can you explain why this rule exists?",
            "Rules help us solve problems systematically. {hint} What would happen if we didn't follow this rule?",
            "Good question about the rules! {hint} How does this rule help us reach our goal?"
        ],
        general: [
            "That's a thoughtful question! {hint} What connections can you make to help solve this?",
            "I like how you're thinking about this! {hint} What would you try next?",
            "Excellent observation! {hint} How might this help you move forward?"
        ]
    };

    // Determine response category
    let category = 'general';
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('stuck') || messageLower.includes('help')) {
        category = 'stuck';
    } else if (messageLower.includes('strategy') || messageLower.includes('best') || messageLower.includes('approach')) {
        category = 'strategy';
    } else if (messageLower.includes('rule') || messageLower.includes('why') || messageLower.includes('not allowed')) {
        category = 'rules';
    }

    // Select template and insert hint
    const templateOptions = templates[category];
    const selectedTemplate = templateOptions[Math.floor(Math.random() * templateOptions.length)];
    
    const hint = agentResponse.hints && agentResponse.hints[0] ? agentResponse.hints[0] : "Try thinking about the patterns in the puzzle.";
    
    return selectedTemplate.replace('{hint}', hint);
}

// Generate fallback response when all else fails
function generateFallbackResponse(requestBody) {
    const fallbackResponses = [
        "I'm here to help you learn! Can you tell me more about what you're trying to do?",
        "Let's work through this together. What specific part of the puzzle is challenging you?",
        "Great question! Think about the goal of the puzzle and what moves might get you closer to it.",
        "I can see you're thinking hard about this! What patterns do you notice in the puzzle?",
        "Learning happens through exploration. What have you tried so far, and what happened?"
    ];
    
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

// Helper function to calculate progress
function calculateProgress(gameState) {
    if (!gameState || !gameState.towers) return 0;
    
    // Simple progress calculation based on disks in destination tower
    const destinationTower = gameState.towers[2];
    if (!destinationTower) return 0;
    
    const disksInDestination = destinationTower.disks ? destinationTower.disks.length : 0;
    const totalDisks = gameState.totalDisks || 3;
    
    return Math.round((disksInDestination / totalDisks) * 100);
}