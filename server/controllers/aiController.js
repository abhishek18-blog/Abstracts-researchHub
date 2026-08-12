import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Suggest research papers based on a topic or text
 */
export const suggestPapers = async (req, res) => {
  try {
    const { topic, context, count } = req.body;
    if (!topic && !context) {
      return res.status(400).json({ success: false, error: 'Topic or context is required for suggestions' });
    }

    const numSuggestions = count ? parseInt(count, 10) : null;

    const prompt = context
      ? `Based on the following research context, suggest ${numSuggestions ? `exactly ${numSuggestions}` : 'some'} relevant research papers. \n\n${context}`
      : `Suggest ${numSuggestions ? `exactly ${numSuggestions}` : 'some'} modern and highly relevant research papers for the topic: "${topic}". For each paper, provide a title, a brief explanation of why it is relevant, and potential keywords.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert academic advisor. You must respond in valid JSON format with exactly two properties: "markdown" (containing your conversational response with the formatted list) and "queries" (a JSON array of strings containing exactly the titles of the papers you suggested). If the user asks for a specific number of papers, provide exactly that many. If no number is specified, provide exactly 5. CRITICAL: Do NOT use markdown bolding or asterisks (**) anywhere in your output. Provide plain text only.`,
        },
        {
          role: 'user',
          content: prompt,
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
