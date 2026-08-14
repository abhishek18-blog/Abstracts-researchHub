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
    const targetTopic = topic ? topic.trim() : '';

    // Combine topic and conversation context effectively
    let prompt = '';
    if (targetTopic && context) {
      prompt = `The user specifically requested research paper suggestions for the topic: "${targetTopic}".\n\nUser's conversation history context for additional background:\n${context}\n\nCRITICAL REQUIREMENT: You MUST suggest exactly ${numSuggestions} research papers specifically about "${targetTopic}". Do NOT default to general computer science or AI papers unless "${targetTopic}" itself is about AI/CS.`;
    } else if (context) {
      prompt = `Analyze the user's conversation history below, determine their primary research domain, and suggest exactly ${numSuggestions} highly relevant research papers tailored to their specific topic of interest:\n\n${context}`;
    } else {
      prompt = `Suggest exactly ${numSuggestions} modern and highly relevant research papers specifically for the topic: "${targetTopic}". For each paper, provide a title, authors/year if known, and a brief summary of why it is relevant.`;
    }

    const systemPrompt = `You are an expert academic research advisor covering all scientific fields (biology, paleontology, physics, medicine, computer science, humanities, etc.).
Your task is to suggest relevant research papers matching the user's requested topic.
You MUST respond in valid JSON format with exactly two properties:
1. "markdown": A clear conversational response presenting the suggested papers with titles, authors/year, and brief summaries.
2. "queries": A JSON array of strings containing ONLY the exact titles of the suggested papers.

CRITICAL INSTRUCTIONS:
- STRICT TOPIC MATCHING: Your suggestions MUST directly match the user's requested topic${targetTopic ? ` ("${targetTopic}")` : ''}. If the topic is "dinosaur", suggest paleontology/biology papers about dinosaurs. Never replace a non-CS topic with generic computer science or AI papers.
- Plain Text Formatting: Do NOT use markdown bolding or asterisks (**) anywhere in your output. Provide clean plain text.`;

    let responseContent = null;

    // 1. Try Groq (using valid LLaMA 3 models)
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
        console.warn('Groq primary model failed, trying fallback llama-3.1-8b-instant:', groqErr.message);
        try {
          const fallbackCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            model: 'llama-3.1-8b-instant',
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
      const geminiModels = ["gemini-1.5-flash", "gemini-1.5-pro"];
      for (const modelName of geminiModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await model.generateContent(`${systemPrompt}\n\nUser Request: ${prompt}`);
          responseContent = result.response.text();
          if (responseContent) break;
        } catch (geminiErr) {
          console.error(`Gemini ${modelName} Fallback Error:`, geminiErr.message);
        }
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
