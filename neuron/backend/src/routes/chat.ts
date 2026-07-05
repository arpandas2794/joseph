import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const router = Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getCardTitle(card: any): string {
  if (!card || !card.data) return 'Untitled Source';
  return card.data.title || card.data.customTitle || card.data.metadata?.title || card.data.name || 'Untitled Source';
}

function getCardText(card: any): string {
  if (!card || !card.data) return '';
  let content = card.data.content || '';

  // If it's a document and has html, strip html tags for cleaner context
  if (card.type === 'document' && content) {
    try {
      const $ = cheerio.load(content);
      content = $.text();
    } catch (_) {
      content = content.replace(/<[^>]*>/g, ' ');
    }
  }

  return content.trim();
}

router.post('/chat', async (req: Request, res: Response) => {
  const { conversationId, chatCardId, message, model } = req.body;

  if (!conversationId || !chatCardId || !message) {
    return res.status(400).json({ error: 'conversationId, chatCardId, and message are required' });
  }

  console.log(`\n--- CHAT REQUEST RECEIVED ---`);
  console.log(`Conversation ID: ${conversationId}`);
  console.log(`Chat Box Card ID: ${chatCardId}`);
  console.log(`User Message: "${message}"`);
  console.log(`Selected Model: ${model}`);

  try {
    // 1. Fetch active connections connected to this chat box
    const { data: connections, error: connError } = await supabase
      .from('connections')
      .select('*')
      .eq('target_chat_id', chatCardId);

    if (connError) {
      console.error('Error fetching connections:', connError);
      return res.status(500).json({ error: 'Failed to fetch connected context sources' });
    }

    console.log(`LOG: Fetched ${connections?.length || 0} connections connected to Chat Box ${chatCardId}.`);
    if (connections) {
      console.log('LOG: Connections array:', JSON.stringify(connections, null, 2));
    }

    // 2. Resolve content for all connected sources (handling groups and individual cards)
    const contextTexts: string[] = [];

    for (const conn of connections || []) {
      if (conn.source_type === 'group') {
        console.log(`LOG: Resolving group source. Group ID: ${conn.source_id}`);
        // Fetch all cards in the workspace to filter members of this group
        const { data: workspaceCards, error: cardsErr } = await supabase
          .from('cards')
          .select('*')
          .eq('workspace_id', conn.workspace_id);

        if (cardsErr) {
          console.error('Error fetching group member cards:', cardsErr);
          continue;
        }

        // Verify group card itself exists
        const groupCard = (workspaceCards || []).find(c => c.id === conn.source_id && c.type === 'group');
        if (!groupCard) {
          console.log(`LOG: Group card ${conn.source_id} not found in workspace. Deleting orphan connection ${conn.id}.`);
          await supabase.from('connections').delete().eq('id', conn.id);
          continue;
        }

        const groupMembers = (workspaceCards || []).filter(c => c.data?.parentId === conn.source_id);
        console.log(`LOG: Found ${groupMembers.length} member cards inside group.`);
        
        for (const card of groupMembers) {
          const text = getCardText(card);
          const title = getCardTitle(card);
          console.log(`  -> Group Member Card: [${card.type}] "${title}" (Content length: ${text.length} chars)`);
          if (text) {
            contextTexts.push(`Source [Group Member] (Type: ${card.type}, Title: "${title}"):\n${text}`);
          }
        }
      } else {
        console.log(`LOG: Resolving individual card source. Card ID: ${conn.source_id}`);
        // Fetch individual card content
        const { data: card, error: cardErr } = await supabase
          .from('cards')
          .select('*')
          .eq('id', conn.source_id)
          .single();

        if (cardErr) {
          console.error(`Error fetching card ${conn.source_id}:`, cardErr);
          console.log(`LOG: Deleting orphan individual connection ${conn.id}.`);
          await supabase.from('connections').delete().eq('id', conn.id);
          continue;
        }

        if (card) {
          const text = getCardText(card);
          const title = getCardTitle(card);
          console.log(`  -> Individual Card: [${card.type}] "${title}" (Content length: ${text.length} chars)`);
          if (text) {
            contextTexts.push(`Source (Type: ${card.type}, Title: "${title}"):\n${text}`);
          }
        } else {
          console.log(`  -> Individual Card: NOT FOUND in DB.`);
        }
      }
    }

    // 3. Construct System Prompt with knowledge context
    let systemPrompt = `You are a helpful and premium AI assistant. 
You have direct access to the files, transcripts, OCR, texts, or groups linked to this Chat Box on the canvas. These connected context sources are listed below under "Connected Context Sources".
You can "see" and read their contents completely. If the user asks whether you can see anything, can read the context, or if you have access to sources, confirm enthusiastically and refer to the specific information from the connected sources below!

IMPORTANT: The set of connected assets on the canvas can change dynamically. You MUST ONLY answer based on the context sources explicitly listed below under the "Connected Context Sources" section of the current prompt. If an asset or context was mentioned in previous history messages but is NOT listed in the "Connected Context Sources" block below, it has been disconnected by the user. Do not use, mention, or count any disconnected sources when answering the current question. Your answers must align strictly and exclusively to the active sources listed below.

Always prioritize the connected context and mention the source type and title when referencing it in your answers.

Connected Context Sources:\n`;

    if (contextTexts.length > 0) {
      systemPrompt += contextTexts.join('\n\n=================================\n\n');
    } else {
      systemPrompt += '[No assets or groups are currently connected as context sources. Inform the user they can link cards or groups on the canvas to provide you with context.]';
    }

    // 4. Retrieve conversation history
    const { data: history, error: historyErr } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (historyErr) {
      console.error('Error fetching chat history:', historyErr);
      return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }

    // Determine active path (for flat chats, it's just the history array)
    const activePathMessages = history || [];

    // 5. Save the user message to database first
    const { data: userMsgData, error: userMsgErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      })
      .select()
      .single();

    if (userMsgErr || !userMsgData) {
      console.error('Failed to save user message:', userMsgErr);
      return res.status(500).json({ error: 'Failed to save message to database' });
    }

    // 6. Call the LLM provider based on user model selection
    const selectedModel = (model || '').toLowerCase();
    let assistantResponse = '';

    if (selectedModel.includes('openai') || selectedModel.includes('gpt')) {
      // --- OpenAI ---
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured in the backend .env file.');
      }
      const openai = new OpenAI({ apiKey });
      const openAiMessages = [
        { role: 'system', content: systemPrompt },
        ...activePathMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: selectedModel.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o',
        messages: openAiMessages as any
      });
      assistantResponse = completion.choices[0]?.message?.content || '';

    } else if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
      // --- Anthropic ---
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured in the backend .env file.');
      }
      const anthropic = new Anthropic({ apiKey });
      const anthropicMessages = [
        ...activePathMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : ('user' as const),
          content: m.content
        })),
        { role: 'user' as const, content: message }
      ];

      const completion = await anthropic.messages.create({
        model: selectedModel.includes('haiku') ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022',
        system: systemPrompt,
        messages: anthropicMessages as any,
        max_tokens: 4096
      });
      assistantResponse = completion.content[0]?.type === 'text' ? completion.content[0].text : '';

    } else {
      // --- Gemini (Default) ---
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the backend .env file.');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: selectedModel.includes('pro') ? 'gemini-1.5-pro' : 'gemini-2.5-flash',
        systemInstruction: systemPrompt
      });

      const geminiHistory = activePathMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const chat = geminiModel.startChat({
        history: geminiHistory
      });

      const result = await chat.sendMessage(message);
      assistantResponse = result.response.text();
    }

    // 7. Save the assistant response to database
    const { data: assistantMsgData, error: assistantMsgErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse
      })
      .select()
      .single();

    if (assistantMsgErr) {
      console.error('Failed to save assistant message:', assistantMsgErr);
      return res.status(500).json({ error: 'Message generated but failed to save response to database' });
    }

    // 8. Return response
    return res.json({ response: assistantResponse });

  } catch (err: any) {
    console.error('Chat generation error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Chat generation failed' });
  }
});
// --- Branching API ---

router.post('/branch/create', async (req: Request, res: Response) => {
  const { conversationId, parentMessageId, name } = req.body;
  if (!conversationId || !parentMessageId) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { data: branch, error } = await supabase
      .from('ai_branches')
      .insert({
        conversation_id: conversationId,
        parent_message_id: parentMessageId,
        name: name || 'New Branch'
      })
      .select()
      .single();

    if (error) throw error;
    
    // Auto-switch to the new branch
    await supabase.from('ai_conversations').update({ active_branch_id: branch.id }).eq('id', conversationId);

    return res.json({ branch });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/branch/switch', async (req: Request, res: Response) => {
  const { conversationId, branchId } = req.body;
  if (!conversationId || !branchId) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ active_branch_id: branchId })
      .eq('id', conversationId);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

// Rename Conversation endpoint
router.put('/chat/:id/title', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'Conversation ID and title are required' });
  }

  try {
    const { data, error } = await supabase
      .from('ai_conversations')
      .update({ title })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to rename conversation:', error);
      return res.status(500).json({ error: 'Failed to rename conversation' });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Rename error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});
router.post('/chat/branch', async (req: Request, res: Response) => {
  const { conversationId, targetMessageId, targetChatCardId, originalTitle } = req.body;

  if (!conversationId || !targetMessageId || !targetChatCardId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Fetch source conversation
    const { data: originalConv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convErr || !originalConv) {
      return res.status(404).json({ error: 'Original conversation not found' });
    }

    // 2. Fetch history up to and including targetMessageId
    const { data: history, error: historyErr } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (historyErr || !history) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // If using the older flat structure, just find the target index and slice
    const targetIndex = history.findIndex(m => m.id === targetMessageId);
    if (targetIndex === -1) {
      return res.status(404).json({ error: 'Target message not found in conversation' });
    }

    const messagesToClone = history.slice(0, targetIndex + 1);

    // 3. Create new conversation
    const { data: newConv, error: newConvErr } = await supabase
      .from('ai_conversations')
      .insert({
        chat_card_id: originalConv.chat_card_id
      })
      .select()
      .single();

    if (newConvErr || !newConv) {
      return res.status(500).json({ error: 'Failed to create new branched conversation' });
    }

    // 4. Duplicate messages
      const inserts = messagesToClone.map((m, idx) => {
        const isBranchPoint = idx === messagesToClone.length - 1;
        const isFirstMessage = idx === 0;
        
        // Preserve any existing metadata, but add our branch flags
        let newMetadata = m.metadata || {};
        if (isBranchPoint) {
          newMetadata = { ...newMetadata, is_branch_point: true, branched_from_title: originalTitle, branched_from_conversation_id: conversationId };
        }
        if (isFirstMessage) {
          newMetadata = { ...newMetadata, is_branched_conversation: true };
        }

        return {
          conversation_id: newConv.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
          metadata: newMetadata
        };
      });

      const { error: insertErr } = await supabase
        .from('ai_messages')
        .insert(inserts);

      if (insertErr) {
        // Cleanup if fail
        await supabase.from('ai_conversations').delete().eq('id', newConv.id);
        return res.status(500).json({ error: 'Failed to duplicate messages into branch' });
      }

    return res.json(newConv);

  } catch (err: any) {
    console.error('Branching error:', err);
    return res.status(500).json({ error: err.message || 'Server error during branch creation' });
  }
});
