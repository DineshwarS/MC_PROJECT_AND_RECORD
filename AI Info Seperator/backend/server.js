import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AdmZip from 'adm-zip';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const upload = multer({ 
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = file.originalname.split('.').pop();
            cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext);
        }
    })
});

// Function to convert file to base64 for Gemini
function fileToGenerativePart(path, mimeType) {
    if (!fs.existsSync(path)) {
        console.error(`File not found at path: ${path}`);
        return null;
    }
    return {
        inlineData: {
            data: fs.readFileSync(path).toString("base64"),
            mimeType
        },
    };
}

app.post('/api/process-documents', upload.array('documents'), async (req, res) => {
    try {
        const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'Gemini API key is required.' });
        }

        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No documents uploaded.' });
        }

        console.log(`Processing ${files.length} uploads...`);
        
        const allProcessedFiles = [];

        for (const file of files) {
            if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
                console.log(`Extracting ZIP: ${file.originalname}`);
                try {
                    const zip = new AdmZip(file.path);
                    const zipEntries = zip.getEntries();
                    
                    for (const entry of zipEntries) {
                        if (entry.isDirectory) continue;
                        
                        const ext = path.extname(entry.entryName).toLowerCase();
                        const validExts = ['.jpg', '.jpeg', '.png', '.pdf'];
                        
                        if (validExts.includes(ext)) {
                            const tempName = `extracted-${Date.now()}-${entry.name}`;
                            const tempPath = path.join('uploads', tempName);
                            
                            fs.writeFileSync(tempPath, entry.getData());
                            
                            // Determine mimetype
                            let mimeType = 'application/pdf';
                            if (ext !== '.pdf') mimeType = `image/${ext.replace('.', '')}`;
                            if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

                            allProcessedFiles.push({
                                path: tempPath,
                                originalname: entry.name,
                                mimetype: mimeType,
                                isExtracted: true
                            });
                            console.log(`  Extracted: ${entry.name}`);
                        }
                    }
                } catch (zipErr) {
                    console.error(`Error processing ZIP ${file.originalname}:`, zipErr);
                }
            } else {
                allProcessedFiles.push({
                    path: file.path,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    isExtracted: false
                });
            }
        }

        if (allProcessedFiles.length === 0) {
            return res.status(400).json({ error: 'No valid documents found in the uploaded files or zip.' });
        }

        console.log(`Preparing ${allProcessedFiles.length} documents for Gemini...`);
        
        const generativeParts = [];
        let fileListManifest = "The following files are uploaded:\n";
        
        allProcessedFiles.forEach((file, index) => {
            fileListManifest += `${index + 1}. ${file.originalname}\n`;
            generativeParts.push(fileToGenerativePart(file.path, file.mimetype));
        });

        // Send to Gemini for structuring
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: { temperature: 0.1 }
        });

        const prompt = `
I have uploaded a batch of documents belonging to one or more people.
${fileListManifest}

Your task is to analyze these documents, identify the document type for each, extract key information, and group all documents belonging to the same person together.

The documents include ID cards (PAN, Aadhar), birth certificates, resumes, etc.
IMPORTANT: Some documents are in Tamil. Read and extract information from Tamil documents accurately.

Structure your extraction as follows:
- For Aadhar: Name, Aadhar Number, DOB, Gender, Address.
- For Resume: Name, Skills, Education, Projects, Experience.
- For PAN: Name, Father's Name, DOB, PAN Number.

IMPORTANT: 
1. If there are multiple images for the SAME document (e.g., front and back of Aadhar), MERGE the information into ONE document entry for that person.
2. In the "filenames" array, you MUST use the EXACT, original filenames from the list provided above.

Return ONLY a JSON array with this exact structure:
[
  {
    "personName": "Full Name of the Person",
    "documents": [
      {
        "type": "PAN / Aadhar / Birth Certificate / Resume / etc.",
        "filenames": ["EXACT_FILENAME_1", "EXACT_FILENAME_2"],
        "extractedInfo": {
           "DOB": "...",
           "IDNumber": "...",
           "OtherRelevantFields": { ... }
        }
      }
    ]
  }
]

CRITICAL: Do not invent filenames like "image1.jpg". Use the real filenames from the list: ${allProcessedFiles.map(f => f.originalname).join(', ')}.

Do not include markdown wrappers like \`\`\`json. Return strictly the raw JSON array.
        `;
        
        const manifest = {
            timestamp: new Date().toISOString(),
            filesUploaded: allProcessedFiles.map(f => f.originalname),
            prompt: prompt
        };
        fs.writeFileSync(path.join('ai_logs', 'inputs', `request_${Date.now()}.json`), JSON.stringify(manifest, null, 2));

        console.log("Calling Gemini API with model: gemini-2.5-flash (Multimodal)");
        const result = await model.generateContent([
            prompt,
            ...generativeParts
        ]);
        
        const response = await result.response;
        let responseText = response.text().trim();
        
        // Log AI Output
        fs.writeFileSync(path.join('ai_logs', 'outputs', `response_${Date.now()}.json`), responseText);

        // Cleanup disabled to allow image viewing
        /*
        // Clean up all processed files
        for (const file of allProcessedFiles) {
            try {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) {
                console.error("Cleanup error:", e);
            }
        }

        // Also clean up the original ZIP files from multer if they exist
        for (const file of files) {
           try {
               if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
           } catch (e) {}
        }
        */

        console.log("=== RAW GEMINI RESPONSE ===");
        console.log(responseText);
        console.log("===========================");
        fs.writeFileSync('response.log', responseText);

        // Remove markdown formatting if the model still includes it
        if (responseText.startsWith('\`\`\`json')) {
            responseText = responseText.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
        } else if (responseText.startsWith('\`\`\`')) {
            responseText = responseText.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
        }

        let structuredData;
        try {
            structuredData = JSON.parse(responseText);
            
            // Map the server file URLs to the documents (handles both direct uploads and ZIP extractions)
            console.log("Mapping files to structured data...");
            structuredData.forEach(person => {
                person.documents.forEach(doc => {
                    doc.fileUrls = []; 
                    
                    const filenamesToMatch = doc.filenames || [doc.filename];
                    console.log(`Document type ${doc.type} for ${person.personName} needs files:`, filenamesToMatch);
                    
                    filenamesToMatch.forEach(fname => {
                        if (!fname) return;
                        const cleanFname = fname.trim().toLowerCase();
                        const matchedFile = allProcessedFiles.find(f => 
                            f.originalname.trim().toLowerCase() === cleanFname
                        );
                        
                        if (matchedFile) {
                            const filenameOnServer = path.basename(matchedFile.path);
                            const url = `http://localhost:${PORT}/uploads/${filenameOnServer}`;
                            doc.fileUrls.push(url);
                            console.log(`  MATCHED: ${fname} -> ${url}`);
                        } else {
                            console.log(`  FAILED TO MATCH: ${fname}`);
                        }
                    });
                });
            });
        } catch (e) {
            console.error('Failed to parse Gemini response as JSON:', responseText);
            return res.status(500).json({ error: 'AI returned invalid JSON format.' });
        }

        res.json({ success: true, data: structuredData });

    } catch (error) {
        console.error('Error processing documents:', error);
        fs.writeFileSync('error.log', JSON.stringify({ message: error.message, status: error.status, fullInfo: String(error) }, null, 2));
        res.status(500).json({ 
            error: 'Internal server error processing documents.',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
