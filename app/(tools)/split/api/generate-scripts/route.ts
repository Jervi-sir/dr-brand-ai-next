// api/generate-scripts/route.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { hookTypePrompts } from '../../variables/hook-type-prompts';
import { PromptGenerator } from '../../prompts/generator';
import { API_CONFIG, CONTENT_IDEAS, HOOK_TYPES } from '../../config';
import { GenerateScriptsRequest, GenerateScriptsResponse } from '../../type';
import { db } from '@/lib/db/queries';
import { scriptHistory } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { content_idea, hook_type, topicPrompt, userPrompt }: GenerateScriptsRequest = await request.json();
    if (!userPrompt || !content_idea || !hook_type) {
      return new Response('User prompt, content idea, and hook type are required', { status: 400 });
    }

    // Validate content_idea and hook_type
    const validContentIdeas = CONTENT_IDEAS.map((idea) => idea.name);
    const validHookTypes = HOOK_TYPES.map((type) => type.name);
    if (!validContentIdeas.includes(content_idea)) {
      return new Response('Invalid content idea', { status: 400 });
    }
    if (!validHookTypes.includes(hook_type)) {
      return new Response('Invalid hook type', { status: 400 });
    }

    // Map hook_type to its index for hookTypePrompts (since hookTypePrompts uses numeric keys)
    const hookTypeIndex = HOOK_TYPES.findIndex((type) => type.name === hook_type) + 1;
    const selectedHooks = hookTypePrompts[hookTypeIndex.toString()] || hookTypePrompts['1'];
    const hookPrompts = selectedHooks.slice(0, 3);

    const prompt = new PromptGenerator({
      userPrompt,
      topicPrompt,
      contentIdea: content_idea,
      hookType: hook_type,
      hookPrompts: hookPrompts.join('\n'),
    }).generate();

    const { text, usage, response } = await generateText({
      model: openai(API_CONFIG.MODEL),
      prompt,
      temperature: API_CONFIG.TEMPERATURE,
      // maxTokens: API_CONFIG.MAX_TOKENS,
    });

    let cleanedText = text.trim().replace(/^```json\s*|\s*```$/g, '').trim();
    let responseOfGeneratedText: Omit<GenerateScriptsResponse, 'tokenUsage' | 'usedModelId'>;
    try {
      responseOfGeneratedText = JSON.parse(cleanedText);
      if (!responseOfGeneratedText.scripts || !Array.isArray(responseOfGeneratedText.scripts)) {
        throw new Error('Response does not contain a valid scripts array');
      }
      for (const script of responseOfGeneratedText.scripts) {
        if (!script.subtitle || typeof script.subtitle !== 'string' || !script.content || typeof script.content !== 'string') {
          throw new Error('Invalid script structure: missing or invalid subtitle or content');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError, 'Cleaned text:', cleanedText);
      return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
    }

    for (const script of responseOfGeneratedText.scripts) {
      if (!script.content.trim()) {
        return NextResponse.json({ error: 'Invalid script content: empty content' }, { status: 500 });
      }
    }

    try {
      // Save to scriptHistory table
      await db.insert(scriptHistory).values({
        userId: session.user.id,
        contentId: null, // Set to a Content ID if linked, otherwise null
        userPrompt,
        topicPrompt,
        contentIdea: content_idea,
        hookType: hook_type,
        generatedScripts: responseOfGeneratedText.scripts,
        usedModelId: response.modelId,
        tokenUsage: {
          prompt_tokens: usage?.promptTokens || 0,
          completion_tokens: usage?.completionTokens || 0,
          total_tokens: usage?.totalTokens || 0,
        },
      });
    } catch (error) {
      console.error('could not save the history script')
    }

    return NextResponse.json({
      ...responseOfGeneratedText,
      usedModelId: response.modelId,
      tokenUsage: {
        prompt_tokens: usage?.promptTokens || 0,
        completion_tokens: usage?.completionTokens || 0,
        total_tokens: usage?.totalTokens || 0,
      },
    });
  } catch (error) {
    console.error('Error generating scripts:', error);
    return NextResponse.json({ error: 'Failed to generate scripts' }, { status: 500 });
  }
}