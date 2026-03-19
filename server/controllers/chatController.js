import { Conversation, Message } from '../models/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize AI SDKs
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

async function getAIResponse(messages, userMessage) {
  // Try Groq First if available
  if (groq) {
    try {
      const formattedHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
      formattedHistory.push({ role: 'user', content: userMessage });

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful AI research assistant for the Abstracts platform. CRITICAL: Do NOT use markdown bolding or asterisks (**) anywhere in your output. Provide plain text only.' },
          ...formattedHistory
        ],
        model: 'llama-3.3-70b-versatile',
      });

      return chatCompletion.choices[0].message.content.replace(/\*\*/g, '');
    } catch (error) {
      console.warn('Groq Chat Error, falling back to Gemini if available:', error.message);
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
    const result = [];
    
    for (const conv of rawConversations) {
      const messages = await Message.find({ conversation_id: conv._id }).sort({ created_at: 1 });
      const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : null;
      
      result.push({
        ...conv.toJSON(),
        message_count: messages.length,
        last_message: lastMessage
      });
    }

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
      content: "Hi! I'm your AI research assistant. I'm now powered by Groq (LLaMA 3.3). I can help you understand papers, explain formulas, summarize content, and answer questions about your research. What would you like to know?",
    });
    
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

    const conversation = await Conversation.findOne({ _id: req.params.id, user_id: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Get previous messages for context
    const previousMessages = await Message.find({ conversation_id: conversation._id }).sort({ created_at: 1 });

    const userMessage = new Message({
      conversation_id: conversation._id,
      role: 'user',
      content: content.trim()
    });
    await userMessage.save();

    const aiContent = await getAIResponse(previousMessages, content.trim());
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
