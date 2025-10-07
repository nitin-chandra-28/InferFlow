
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// The base URL for the OpenAI-compatible router
const API_BASE_URL = "https://router.huggingface.co/v1";
const HF_TOKEN = process.env.HUGGING_FACE_API_TOKEN;

// Create the /chat endpoint
app.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // This is the new, OpenAI-compatible payload
    const payload = {
        model: "meta-llama/Llama-3.1-8B-Instruct", // Specify the model you want to use
        messages: [
            { role: "user", content: message }
        ],
        max_tokens: 512, // Optional: limit the response length
    };

    try {
        console.log("Sending OpenAI-compatible request to HF Router...");
        
        // Note the URL now includes "/chat/completions"
        const response = await axios.post(
            `${API_BASE_URL}/chat/completions`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // The response structure is also different
        const modelResponse = response.data.choices[0]?.message?.content || "Sorry, I couldn't get a response.";
        
        console.log("Received response:", modelResponse);
        res.json({ reply: modelResponse });

    } catch (error) {
        // Log the detailed error from the API if it exists
        const errorDetails = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error('Error calling Hugging Face Router API:', errorDetails);
        res.status(500).json({ error: 'Failed to get response from AI model' });
    }
});

app.listen(PORT, () => {
    console.log(`✨ Server is running on http://localhost:${PORT}`);
});