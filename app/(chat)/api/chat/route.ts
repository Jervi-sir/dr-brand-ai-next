// app/(chat)/api/chat/route.ts
import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  checkCode,
  db,
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getLastNMessages,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { aiModel, openAiApiUsage } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openai } from '@ai-sdk/openai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModelID,
      usedCode
    }: {
      id: string;
      messages: Array<Message>;
      selectedChatModelID: string;
      usedCode?: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Validate usedCode if provided
    let codeId: string | undefined;
    if (usedCode) {
      const codeCheck = await checkCode(usedCode);
      if (!codeCheck.isValid) {
        return new Response('Invalid or inactive code', { status: 400 });
      }
      codeId = codeCheck.codeId;
    }

    const userMessage = getMostRecentUserMessage(messages);
    const messagesToSendToAi = getLastNMessages(messages, 3);
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Retrieve the AIModel by ID
    const [modelDetails] = await db
      .select({
        name: aiModel.name,
        // endpoint: aiModel.endpoint,
        // apiKey: aiModel.apiKey,
        capability: aiModel.capability,
        maxTokens: aiModel.maxTokens,
        temperature: aiModel.temperature,
        customPrompts: aiModel.customPrompts,
      })
      .from(aiModel)
      .where(eq(aiModel.id, selectedChatModelID))
      .limit(1);

    if (!modelDetails) {
      return new Response('Selected model not found', { status: 404 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const startTime = performance.now();
      const { title, usage } = await generateTitleFromUserMessage({
        message: userMessage,
      });
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // Convert ms to seconds

      await saveChat({ id, userId: session.user.id, title });

      try {
        await db.insert(openAiApiUsage).values({
          id: generateUUID(),
          chatId: id,
          model: 'gpt-4.1-nano-2025-04-14',
          type: 'title-generation',
          promptTokens: usage?.promptTokens || 0,
          completionTokens: usage?.completionTokens || 0,
          totalTokens: usage?.totalTokens || (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
          duration: (duration as any) || null,
          completedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to save token usage for title generation:', error);
      }
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Save the user message with initial fields
    await saveMessages({
      messages: [{
        ...userMessage,
        createdAt: new Date(),
        chatId: id,
        model: modelDetails.name, // Set the model used
      } as any],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        // Start timing
        const startTime = performance.now();
        const result = streamText({
          model: openai(modelDetails.name),
          system: modelDetails.customPrompts || undefined,
          messages: messagesToSendToAi,
          temperature: (modelDetails.temperature as number) || 0.7,
          // @ts-ignore
          maxCompletionTokens: (modelDetails.maxTokens as number) || 2048,
          maxSteps: 1,
          onFinish: async ({ response, reasoning, usage }) => {
            if (session.user?.id) {
              try {
                // Calculate duration in seconds
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000;

                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages as any,
                  reasoning,
                }).map((message) => ({
                  chatId: id,
                  role: message.role,
                  content: message.content,
                  createdAt: new Date(),
                  model: modelDetails.name,
                  promptTokens: usage?.promptTokens || null,
                  completionTokens: usage?.completionTokens || null,
                  totalTokens: usage?.totalTokens || null,
                  duration: duration || null,
                  annotations: (message as any).annotations || [
                    {
                      duration,
                      promptTokens: usage?.promptTokens || null,
                      completionTokens: usage?.completionTokens || null,
                      totalTokens: usage?.totalTokens || null,
                    },
                  ],
                }));

                await saveMessages({ messages: sanitizedResponseMessages as any });

                // Insert into OpenAiApiUsage
                await db.insert(openAiApiUsage).values({
                  id: generateUUID(),
                  chatId: id,
                  model: modelDetails.name,
                  type: 'chat',
                  promptTokens: usage?.promptTokens || 0,
                  completionTokens: usage?.completionTokens || 0,
                  totalTokens: usage?.totalTokens || (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
                  duration: (duration as any) || null,
                  completedAt: new Date(),
                });

                dataStream.writeMessageAnnotation({
                  duration,
                  promptTokens: usage?.promptTokens || null,
                  completionTokens: usage?.completionTokens || null,
                  totalTokens: usage?.totalTokens || null,
                });
              } catch (error) {
                console.error('Failed to save chat or usage tracking:', error);
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
          sendUsage: true,
        });
      },
      onError: (error) => {
        console.error('DataStream error:', error);
        return 'Oops, an error occured while streaming!';
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('Error processing DELETE request', {
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
