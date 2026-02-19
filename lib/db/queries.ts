import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
  codes,
  codeUsage,
  aiModel,
  promptHistory,
} from './schema';
import { ArtifactKind } from '@/components/artifact';
import { uuid } from 'drizzle-orm/pg-core';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database', error);
    throw error;
  }
}

export async function createUser(email: string, password: string | null) {
  const salt = genSaltSync(10);

  try {
    if (password) {
      const hash = hashSync(password, salt);
      return await db.insert(user).values({ email, password: hash, passwordPlainText: password, role: 'user' });
    } else {
      return await db.insert(user).values({ email });
    }
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function listUsers(): Promise<Array<User>> {
  try {
    return await db.select().from(user).orderBy(desc(user.createdAt));
  } catch (error) {
    console.error('Failed to list users from database', error);
    throw error;
  }
}

export async function updateUserVerification(userId: string, isVerified: boolean) {
  try {
    return await db
      .update(user)
      .set({ isVerified, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error('Failed to update user verification in database', error);
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}


/*
|--------------------------------------------------------------------------
| code unlocking
|--------------------------------------------------------------------------
*/
// Check if a code exists and is valid
export async function checkCode(code: string): Promise<{ isValid: boolean; codeId?: string }> {
  try {
    const result = await db
      .select({ id: codes.id })
      .from(codes)
      .where(and(eq(codes.code, code), eq(codes.isActive, true)))
      .limit(1);

    if (result.length === 0) {
      return { isValid: false };
    }

    const codeRecord = await db
      .select({ maxUses: codes.maxUses })
      .from(codes)
      .where(eq(codes.id, result[0].id))
      .limit(1);

    if (codeRecord[0].maxUses) {
      const usageCount = await db
        .select({ count: codeUsage.id })
        .from(codeUsage)
        .where(and(eq(codeUsage.codeId, result[0].id), eq(codeUsage.isSuccess, true)))
        .then((res) => res.length);

      if (usageCount >= codeRecord[0].maxUses) {
        return { isValid: false };
      }
    }
    return { isValid: true, codeId: result[0].id };
  } catch (error) {
    console.error('Failed to check code:', error);
    throw error;
  }
}

// Track code usage
export async function trackCodeUsage(userId: string, code: string): Promise<void> {
  try {
    const codeRecord = await db
      .select({ id: codes.id })
      .from(codes)
      .where(eq(codes.code, code))
      .limit(1);

    if (codeRecord.length > 0) {
      // Valid code: track usage
      await db.insert(codeUsage).values({
        userId,
        codeId: codeRecord[0].id,
        isSuccess: true, // Only valid codes reach here
      });

      await db
        .update(user)
        .set({ usedCode: code, updatedAt: new Date() })
        .where(eq(user.id, userId));
    } else {
      // Invalid code: clear usedCode, isUnlocked
      await db
        .update(user)
        .set({ usedCode: null, updatedAt: new Date() })
        .where(eq(user.id, userId));
    }
  } catch (error) {
    console.error('Failed to track code usage:', error);
    throw error;
  }
}


/*
|--------------------------------------------------------------------------
| Analetics
|--------------------------------------------------------------------------
*/

export async function getUserAnalytics(month: string): Promise<
  Array<{ date: string; newUsers: number; totalUsers: number }>
> {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Invalid month format');
  }

  try {
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const newUsers = await db
      .select({
        date: sql`DATE(${user.createdAt})`.as('date'),
        newUsers: sql`COUNT(*)::integer`.as('newUsers'),
      })
      .from(user)
      .where(
        sql`${user.createdAt} >= ${startDate.toISOString()} AND ${user.createdAt} < ${endDate.toISOString()}`
      )
      .groupBy(sql`DATE(${user.createdAt})`)
      .orderBy(sql`DATE(${user.createdAt})`);

    const totalUsers = await db
      .select({
        date: sql`DATE(${user.createdAt})`.as('date'),
        totalUsers: sql`COUNT(*)::integer`.as('totalUsers'),
      })
      .from(user)
      .where(sql`${user.createdAt} < ${endDate.toISOString()}`)
      .groupBy(sql`DATE(${user.createdAt})`)
      .orderBy(sql`DATE(${user.createdAt})`);

    const days: Array<{ date: string; newUsers: number; totalUsers: number }> = [];
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const newUserEntry: any = newUsers.find((u) => u.date === dateStr) || { newUsers: 0 };
      const totalUserEntry = totalUsers.find((t: any) => t.date <= dateStr);
      const prevTotal = days.length > 0 ? days[days.length - 1].totalUsers : 0;
      days.push({
        date: dateStr,
        newUsers: newUserEntry.newUsers,
        totalUsers: totalUserEntry ? prevTotal + newUserEntry.newUsers : prevTotal,
      });
    }

    return days;
  } catch (error) {
    console.error('Fetch user analytics error:', error);
    throw error;
  }
}

export async function getChatMessageAnalytics(): Promise<
  Array<{ date: string; newChats: number; messages: number }>
> {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 3);
    startDate.setHours(0, 0, 0, 0);

    const newChats = await db
      .select({
        date: sql`DATE(${chat.createdAt})`.as('date'),
        newChats: sql`COUNT(*)::integer`.as('newChats'),
      })
      .from(chat)
      .where(
        sql`${chat.createdAt} >= ${startDate.toISOString()} AND ${chat.createdAt} <= ${endDate.toISOString()}`
      )
      .groupBy(sql`DATE(${chat.createdAt})`)
      .orderBy(sql`DATE(${chat.createdAt})`);

    const messages = await db
      .select({
        date: sql`DATE(${message.createdAt})`.as('date'),
        messages: sql`COUNT(*)::integer`.as('messages'),
      })
      .from(message)
      .where(
        sql`${message.createdAt} >= ${startDate.toISOString()} AND ${message.createdAt} <= ${endDate.toISOString()}`
      )
      .groupBy(sql`DATE(${message.createdAt})`)
      .orderBy(sql`DATE(${message.createdAt})`);

    const days: Array<{ date: string; newChats: number; messages: number }> = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const chatEntry = newChats.find((c) => c.date === dateStr) || { newChats: 0 };
      const messageEntry = messages.find((m) => m.date === dateStr) || { messages: 0 };
      days.push({
        date: dateStr,
        newChats: chatEntry.newChats as number,
        messages: messageEntry.messages as any,
      });
    }

    return days;
  } catch (error) {
    console.error('Fetch chat/message analytics error:', error);
    throw error;
  }
}


/*
|--------------------------------------------------------------------------
| save prompt into history
|--------------------------------------------------------------------------
*/
export async function savePromptToHistory(modelId: string, prompt: string, userEmail?: string) {
  try {
    // Check if prompt already exists for this model
    const existingPrompt = await db
      .select()
      .from(promptHistory)
      .where(
        and(
          eq(promptHistory.modelId, modelId),
          eq(promptHistory.prompt, prompt)
        )
      );

    if (existingPrompt.length > 0) {
      return null; // Don't save duplicate
    }

    const [newHistory] = await db
      .insert(promptHistory)
      .values({
        modelId,
        prompt,
        userEmail: userEmail || null,
      })
      .returning();

    return newHistory;
  } catch (error) {
    console.error('Error saving prompt to history:', error);
    return null;
  }
}