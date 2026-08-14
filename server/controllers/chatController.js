import { Conversation, Message } from '../models/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import xss from 'xss'; // [SECURITY - N-L3]: sanitize user messages before storing
// [SECURITY - N-L2]: dotenv is already loaded once in server/index.js — don't reload here

// Initialize AI SDKs
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

async function getAIResponse(messages, userMessage) {
  const systemPrompt = 'Act as an expert academic research assistant across all scientific disciplines. Provide helpful, accurate plain text responses matching the user topic. NO markdown bolding or asterisks.';

  // Try Groq First if available
  if (groq) {
    const formattedHistory = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    formattedHistory.push({ role: 'user', content: userMessage });

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedHistory
        ],
        model: 'llama-3.3-70b-versatile',
      });

      return chatCompletion.choices[0].message.content.replace(/\*\*/g, '');
    } catch (error) {
      console.warn('Groq 70b failed, trying fallback model llama-3.1-8b-instant:', error.message);
      try {
        const fallbackCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            ...formattedHistory
          ],
          model: 'llama-3.1-8b-instant',
        });
        return fallbackCompletion.choices[0].message.content.replace(/\*\*/g, '');
      } catch (err2) {
        console.warn('Groq secondary model failed, checking Gemini fallback:', err2.message);
      }
    }
  }

  // Fallback to Gemini
  if (genAI && process.env.GEMINI_API_KEY?.startsWith('AIza')) {
    try {
      const modelNames = ["gemini-1.5-flash", "gemini-1.5-pro"];
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const formattedHistory = [];
          let expectedRole = 'user';

          for (const m of messages) {
            const currentRole = m.role === 'assistant' ? 'model' : 'user';
            if (currentRole === expectedRole) {
              formattedHistory.push({
                role: currentRole,
                parts: [{ text: m.content }],
              });
              expectedRole = expectedRole === 'user' ? 'model' : 'user';
            }
          }

          if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
            formattedHistory.pop();
          }

          const chat = model.startChat({
            history: formattedHistory,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
          });

          const result = await chat.sendMessage(userMessage);
          const response = await result.response;
          return response.text().replace(/\*\*/g, '');
        } catch (err) {
          console.warn(`Gemini ${modelName} fallback failed:`, err.message);
          continue;
        }
      }
    } catch (error) {
      console.error('Gemini Fallback Error:', error);
    }
  }

  if (!groq && (!genAI || !process.env.GEMINI_API_KEY?.startsWith('AIza'))) {
    return "I'm sorry, I'm not configured with a valid API key yet. Please add your Groq or Google Gemini API key to the .env file.";
  }

  return "I encountered a technical glitch while processing your request. Please try again shortly.";
}

export const getConversations = async (req, res) => {
  try {
    const rawConversations = await Conversation.find({ user_id: req.userId }).sort({ updated_at: -1 });

    // ─────────────────────────────────────────────────────────
    // BEFORE (slow - N+1 problem):
    //   for (const conv of rawConversations) {
    //     const messages = await Message.find({ conversation_id: conv._id }); // 1 DB trip PER conversation
    //   }
    //   If you have 10 conversations → 10 separate DB trips, one after another.
    //   The sidebar took longer as you chatted more.
    //
    // AFTER (fast - single bulk query):
    //   We get ALL messages for ALL conversations in ONE single DB trip.
    //   Then we group them in memory (which is instant, no waiting).
    //   10 conversations or 100 conversations → still just 1 DB trip.
    // ─────────────────────────────────────────────────────────
    const convIds = rawConversations.map(c => c._id);
    const allMessages = await Message.find({ conversation_id: { $in: convIds } }).sort({ created_at: 1 }).lean();

    // Group messages by conversation ID using a Map for instant lookup
    const messagesByConv = new Map();
    for (const msg of allMessages) {
      const key = String(msg.conversation_id);
      if (!messagesByConv.has(key)) messagesByConv.set(key, []);
      messagesByConv.get(key).push(msg);
    }

    // Now build the result — no DB queries inside this loop, just reading from memory
    const result = rawConversations.map(conv => {
      const msgs = messagesByConv.get(String(conv._id)) || [];
      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1].content : null;
      return {
        ...conv.toJSON(),
        message_count: msgs.length,
        last_message: lastMessage
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user_id: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = await Message.find({ conversation_id: conversation._id }).sort({ created_at: 1 });

    res.json({ success: true, data: { conversation: conversation.toJSON(), messages: messages.map(m => m.toJSON()) } });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { title } = req.body;

    const conversation = new Conversation({
      user_id: req.userId,
      title: title || 'New Conversation'
    });

    await conversation.save();

    const welcomeMsg = new Message({
      conversation_id: conversation._id,
      role: 'assistant',
      content: "Hi! I'm your AI research assistant. I can help you understand papers, explain formulas, summarize content, and answer questions about your research. What would you like to know?",
    });

    // \u2705 BUG FIX: Previously this line was missing — the welcome message was created in memory
    // but NEVER saved to MongoDB, so it disappeared every time the user refreshed the page.
    await welcomeMsg.save();

    res.status(201).json({ success: true, data: { conversation: conversation.toJSON(), messages: [welcomeMsg.toJSON()] } });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }
    // [SECURITY - N-H2]: Limit message length to prevent Groq API token abuse.
    // An attacker could send 100k-character messages to burn your entire token budget.
    const MAX_CHAT_LENGTH = 4000;
    if (content.trim().length > MAX_CHAT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Message too long. Maximum ${MAX_CHAT_LENGTH} characters allowed.`
      });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, user_id: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Get previous messages for context
    const previousMessages = await Message.find({ conversation_id: conversation._id }).sort({ created_at: 1 });

    // [SECURITY - N-L3]: Sanitize message content with XSS library before storing.
    // Prevents malicious script tags from being stored and potentially rendered.
    const sanitizedContent = xss(content.trim());

    const userMessage = new Message({
      conversation_id: conversation._id,
      role: 'user',
      content: sanitizedContent
    });
    await userMessage.save();

    const aiContent = await getAIResponse(previousMessages, sanitizedContent);
    const aiMessage = new Message({
      conversation_id: conversation._id,
      role: 'assistant',
      content: aiContent
    });
    await aiMessage.save();

    // Update conversation timestamp
    conversation.updated_at = new Date();
    await conversation.save();

    res.status(201).json({
      success: true,
      data: { userMessage: userMessage.toJSON(), aiMessage: aiMessage.toJSON() },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const existing = await Conversation.findOne({ _id: req.params.id, user_id: req.userId });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    await Message.deleteMany({ conversation_id: existing._id });
    await Conversation.deleteOne({ _id: existing._id });

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
};
