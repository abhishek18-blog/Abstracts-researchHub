import Groq from 'groq-sdk';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Upload } from '../models/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Extracts text from a PDF file
 */
const extractTextFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};

/**
 * Summarize a PDF
 */
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

/**
 * Suggest research papers based on a topic or text
 */
export const suggestPapers = async (req, res) => {
  try {
    const { topic, context } = req.body;
    if (!topic && !context) {
      return res.status(400).json({ success: false, error: 'Topic or context is required for suggestions' });
    }

    const prompt = context
      ? `Based on the following research context, suggest 5 relevant research papers or areas of study: \n\n${context}`
      : `Suggest 5 modern and highly relevant research papers for the topic: "${topic}". For each paper, provide a title, a brief explanation of why it is relevant, and potential keywords.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic advisor and researcher with deep knowledge across many fields. Provide suggestions in a clear, formatted list.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
    });

    res.json({
      success: true,
      data: {
        suggestions: chatCompletion.choices[0].message.content
      }
    });
  } catch (error) {
    console.error('Groq Suggestion Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get research suggestions' });
  }
};
