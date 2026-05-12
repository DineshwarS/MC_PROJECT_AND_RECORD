import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyB3BF3UnekLgvmV1b7ivcYClZweuLY1xqw';
const ai = new GoogleGenAI({ apiKey: apiKey });

async function test() {
    try {
        console.log("Calling Gemini 2.5 flash...");
        const response25 = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Hello world"
        });
        console.log("Response 2.5:", response25.text());
    } catch (e) {
        console.error("ERROR calling 2.5:", e.message);
    }

    try {
        console.log("Calling Gemini 1.5 flash...");
        const response15 = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: "Hello world"
        });
        console.log("Response 1.5:", response15.text());
    } catch (e) {
        console.error("ERROR calling 1.5:", e.message);
    }
}

test();
