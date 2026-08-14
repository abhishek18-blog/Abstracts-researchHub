import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize AI SDKs
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY?.startsWith('AIza') ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Suggest research papers based on a topic or chat context
 */
export const suggestPapers = async (req, res) => {
  try {
    const { topic, context, count } = req.body;
    if (!topic && !context) {
      return res.status(400).json({ success: false, error: 'Topic or context is required for suggestions' });
    }

    const numSuggestions = count ? parseInt(count, 10) : 5;

    // Combine topic and conversation context effectively
    let prompt = '';
    if (topic && context) {
      prompt = `Suggest exactly ${numSuggestions} highly relevant research papers specifically for the topic: "${topic}". Make sense of this topic in the context of the user's conversation history below:\n\n${context}`;
    } else if (context) {
      prompt = `Analyze the user's conversation history below, make sense of their research interest, and suggest exactly ${numSuggestions} highly relevant research papers tailored to what they are discussing:\n\n${context}`;
    } else {
      prompt = `Suggest exactly ${numSuggestions} modern and highly relevant research papers for the topic: "${topic}". For each paper, provide a title, a brief explanation of why it is relevant, and potential keywords.`;
    }

    const systemPrompt = `You are an expert academic research advisor. Your job is to analyze the user's chat context or topic, make sense of their research interest, and suggest relevant research papers. You MUST respond in valid JSON format with exactly two properties:
1. "markdown": A clear conversational response presenting the suggested papers with titles, authors/year if known, and brief summaries.
2. "queries": A JSON array of strings containing ONLY the exact titles of the suggested papers.

CRITICAL INSTRUCTIONS:
- Do NOT use markdown bolding or asterisks (**) anywhere in your output. Provide plain text inside markdown.
- Make sure suggestions directly match the user's topic and chat context.`;

    let responseContent = null;

    // 1. Try Groq (using valid LLaMA 3 model)
    if (groq) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' }
        });
        responseContent = chatCompletion.choices[0].message.content;
      } catch (groqErr) {
        console.warn('Groq failed, trying fallback model llama3-8b-8192:', groqErr.message);
        try {
          const fallbackCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            model: 'llama3-8b-8192',
            response_format: { type: 'json_object' }
          });
          responseContent = fallbackCompletion.choices[0].message.content;
        } catch (e2) {
          console.warn('Groq secondary model failed, checking Gemini fallback:', e2.message);
        }
      }
    }

    // 2. Fallback to Gemini if Groq fails or is unconfigured
    if (!responseContent && genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(`${systemPrompt}\n\nUser Request: ${prompt}`);
        responseContent = result.response.text();
      } catch (geminiErr) {
        console.error('Gemini Fallback Error:', geminiErr.message);
      }
    }

    if (!responseContent) {
      return res.status(503).json({
        success: false,
        error: 'AI services unavailable. Please check your GROQ_API_KEY or GEMINI_API_KEY.'
      });
    }

    const parsed = JSON.parse(responseContent);
    const cleanedMarkdown = parsed.markdown ? parsed.markdown.replace(/\*\*/g, '') : '';

    res.json({
      success: true,
      data: {
        suggestions: cleanedMarkdown,
        queries: Array.isArray(parsed.queries) ? parsed.queries : []
      }
    });
  } catch (error) {
    console.error('Groq Suggestion Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get research suggestions' });
  }
};
