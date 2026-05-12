import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'node:fs';
const ai = new GoogleGenAI({ apiKey: 'AIzaSyB3BF3UnekLgvmV1b7ivcYClZweuLY1xqw' });

async function test() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'Hello world'
        });
        console.log("SUCCESS");
    } catch (e) {
        writeFileSync('error.json', JSON.stringify({ message: e.message, status: e.status }, null, 2));
        console.log("Wrote error to error.json");
    }
}
test();
