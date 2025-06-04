// netlify/functions/logMove.js
exports.handler = async (event) => {
    try {
        const data = JSON.parse(event.body);
        console.log("Move count:", data.moves);
  
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ message: "Move logged successfully" })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to log move" })
        };
    }
  };