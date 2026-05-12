import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'node:fs';
const ai = new GoogleGenAI({ apiKey: 'AIzaSyB3BF3UnekLgvmV1b7ivcYClZweuLY1xqw' });

async function list() {
    try {
        const response = await ai.models.list({});
        const models = [];
        for await (const targetModel of response) {
            models.push(targetModel.name);
        }
        writeFileSync('models.json', JSON.stringify(models, null, 2));
        console.log("Wrote models to models.json");
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}
list();
