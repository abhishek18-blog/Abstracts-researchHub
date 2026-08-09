import Groq from 'groq-sdk';
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// const pdf = require('pdf-parse');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// import { Upload } from '../models/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/*
/**
 * Extracts text from a PDF file
 * /
const extractTextFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};

/**
 * Summarize a PDF
 * /
export const summarizePDF = async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ success: false, error: 'Upload ID is required' });
    }

    const upload = await Upload.findOne({ _id: uploadId, user_id: req.userId });
    if (!upload) {
      return res.status(404).json({ success: false, error: 'PDF upload not found' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', upload.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Physical file not found' });
    }

    const text = await extractTextFromPDF(filePath);

    // Limit text length to avoid token limits (Groq has decent limits but let's be safe)
    const truncatedText = text.substring(0, 15000);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a professional research assistant. Summarize the following research paper text into a concise yet comprehensive summary. Include key objectives, methodology, main findings, and conclusions.',
        },
        {
          role: 'user',
          content: truncatedText,
        },
      ],
      model: 'llama-3.3-70b-versatile',
    });

    res.json({
      success: true,
      data: {
        summary: chatCompletion.choices[0].message.content,
        title: upload.original_name
      }
    });
  } catch (error) {
    console.error('Groq Summarization Error:', error);
    res.status(500).json({ success: false, error: 'Failed to summarize PDF' });
  }
};
*/

/**
 * Suggest research papers based on a topic or text
 */
export const suggestPapers = async (req, res) => {
  try {
    const { topic, context, count } = req.body;
    if (!topic && !context) {
      return res.status(400).json({ success: false, error: 'Topic or context is required for suggestions' });
    }

    const numSuggestions = count ? parseInt(count, 10) : 5;

    const systemPrompt = `You are an elite academic research advisor and literature review assistant.

Your task is to recommend highly relevant, impactful, and peer-reviewed research papers based on the user's input.

<CONSTRAINTS>
1. You MUST respond in valid JSON format matching the schema below.
2. The "markdown" property must contain a polite, professional conversational response introducing the papers, followed by a neatly formatted list of the papers (including title, brief explanation of relevance, and keywords).
3. The "queries" property must be a JSON array containing STRICTLY the exact titles of the suggested papers.
4. CRITICAL: Do NOT use markdown bolding (**) or italics (*) anywhere in your output. Use plain text formatting for structure (e.g., standard numbers or dashes).
5. You must provide exactly the requested number of papers.
</CONSTRAINTS>

<JSON_SCHEMA>
{
  "markdown": "string (conversational response and list of papers in plain text)",
  "queries": ["string", "string"]
}
</JSON_SCHEMA>`;

    const userPrompt = context
      ? `Research Context:\n"""\n${context}\n"""\n\nBased on the above context, suggest exactly ${numSuggestions} highly relevant research papers.`
      : `Topic: "${topic}"\n\nSuggest exactly ${numSuggestions} modern and highly relevant research papers for this topic.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(chatCompletion.choices[0].message.content);
    // Computationally strip any rogue asterisks just to be absolutely sure
    const cleanedMarkdown = parsed.markdown ? parsed.markdown.replace(/\*\*/g, '') : '';

    res.json({
      success: true,
      data: {
        suggestions: cleanedMarkdown,
        queries: parsed.queries
      }
    });
  } catch (error) {
    console.error('Groq Suggestion Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get research suggestions' });
  }
};
