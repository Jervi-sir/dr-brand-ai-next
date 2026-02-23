import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import { generatedSplitHistory, splitPromptHistory, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { z } from 'zod';
import { db } from '@/lib/db/queries';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const API_CONFIG = {
  MODEL: 'gpt-5.2-2025-12-11',
  MAX_RETRIES: 4, // Increased retries
  RETRY_DELAY_MS: 1000,
};

const SYSTEM_PROMPT = `
You are Dr. Brand, a high-level Algerian content strategist and viral Instagram Reels copywriter expert who has generated over 10 million views. Your task is to generate a response in valid JSON format with EXACTLY the structure specified below. Do NOT return plain text, incomplete JSON, or any response missing required fields. The JSON must include all fields and adhere to the specified constraints.

Given a user prompt describing a business/creator context, niche, target audience, product (optional), and best-performing content (optional), you MUST:
1. Generate a client persona (10-20 words in English, describing the ideal audience).
2. Generate a content pillar (3-5 words in Algerian Darja, using Arabic letters).
3. Generate EXACTLY 5 sub-pillars (each 5-10 words in Algerian Darja, using Arabic letters).
4. Generate AT LEAST 6 Instagram Reels scripts based on the sub-pillars, cycling through these hook types in order: Fix a Problem, Quick Wins, Reactions & Reviews, Personal Advice, Step-by-Step Guides, Curiosity & Surprises, Direct Targeting.

Each script MUST:
- Be educational, actionable, and high-value.
- Use one of the specified hook types.
- Align with the niche, target audience, client persona, content pillar, and product (if provided).
- Include a subtitle (3-5 words in Algerian Darja, Arabic letters).
- Include content as an HTML string with <p> tags for each hook or logical section, suitable for a 60-90 second Reel (3-4 sentences).
- Follow the 3 C's for hooks: Concisely outline in 1 sentence what the viewer should expect while providing clarity, context, and sparking curiosity.
- Be written ENTIRELY in Algerian Darja using Arabic letters, with no Latin letters unless no Arabic synonym exists, and NO emojis.
- Avoid Moroccan words such as: حيت، سير، دابا، زوين، كنهضر، مزيان، راسك، واش.
- Use simple, common Algerian words, avoiding complex vocabulary.
- Feel highly relatable to daily Algerian life, be shareable, and use repeatable formats that can go viral.
- Maintain an authoritative, confident tone, as if speaking directly to the camera with no scenes or fancy editing.

Return the response in this EXACT JSON format:
{
  "clientPersona": string,
  "contentPillar": string,
  "subPillars": [string, string, string, string, string],
  "scripts": [
    { "subtitle": string, "content": string },
    { "subtitle": string, "content": string },
    { "subtitle": string, "content": string },
    { "subtitle": string, "content": string },
    { "subtitle": string, "content": string },
    { "subtitle": string, "content": string },
    ...
  ]
}
Constraints:
- "clientPersona": 10-20 words, English.
- "contentPillar": 3-5 words, Algerian Darja, Arabic letters.
- "subPillars": EXACTLY 5 strings, each 5-10 words, Algerian Darja, Arabic letters.
- "scripts": AT LEAST 6 objects, each with "subtitle" (3-5 words, Algerian Darja, Arabic letters) and "content" (HTML string, 3-4 sentences, Algerian Darja, Arabic letters).
Ensure the JSON is valid, complete, and not truncated.
`;

// Input validation schema
const RequestSchema = z.object({
  userPrompt: z.string().min(10, 'userPrompt must be at least 10 characters'),
});

// Response validation schema
const ScriptSchema = z.object({
  subtitle: z.string().min(3, 'Subtitle must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});
const ResponseSchema = z.object({
  clientPersona: z.string().min(10, 'clientPersona must be at least 10 characters'),
  contentPillar: z.string().min(3, 'contentPillar must be at least 3 characters'),
  subPillars: z.array(z.string().min(5)).length(5, 'Exactly 5 subPillars are required'),
  scripts: z.array(ScriptSchema).min(6, 'At least 6 scripts are required'),
});

// Types
type RequestBody = z.infer<typeof RequestSchema>;
type ResponseData = z.infer<typeof ResponseSchema>;
type TokenUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

// Utility to delay retries
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility to construct the prompt
const buildPrompt = (systemPrompt: string, { userPrompt }: RequestBody, isRetry = false) => {
  const basePrompt = `${systemPrompt}\n\nUser Prompt: ${userPrompt}`;
  return isRetry
    ? `${basePrompt}\n\nPrevious attempt failed. Return EXACTLY 5 subPillars and AT LEAST 6 scripts in valid JSON with ALL required fields: clientPersona, contentPillar, subPillars, scripts.`
    : basePrompt;
};

// Fallback response if AI fails to generate enough scripts
const FALLBACK_RESPONSE: ResponseData = {
  clientPersona: 'Young Algerians, urban, animal lovers, interested in pet adoption',
  contentPillar: 'تبني الحيوانات الأليفة',
  subPillars: [
    'قصص نجاح تبني الحيوانات',
    'كيفاش تختار حيوان أليف',
    'واش لازم تعرف قبل تتبنى',
    'أخطاء شائعة عند التبني',
    'طريقة التعامل مع القطط الجديدة',
  ],
  scripts: [
    {
      subtitle: 'حل مشكلة التبني',
      content: '<p>عندك مشكلة في تبني حيوان؟ الحل بسيط!</p><p>تطبيقنا يربطك بالحيوانات اللي تحتاج دار.</p><p>حمّل التطبيق وابدأ اليوم!</p>',
    },
    {
      subtitle: 'نصيحة سريعة للتبني',
      content: '<p>حاب تتبنّى بسرعة؟ اختار بعناية!</p><p>تأكد من نمط حياتك يناسب الحيوان.</p><p>تطبيقنا يساعدك تلقى المناسب.</p>',
    },
    {
      subtitle: 'ردود فعل التطبيق',
      content: '<p>سمعت على تطبيق التبني؟</p><p>ناس كثير جربوه وأحبوه!</p><p>شوف تجاربهم وجرب بنفسك.</p>',
    },
    {
      subtitle: 'نصيحتي للتبني',
      content: '<p>تبنيت قط وغيّر حياتي!</p><p>اختار حيوان يناسب وقتك ومكانك.</p><p>استعمل تطبيقنا باش تبدأ.</p>',
    },
    {
      subtitle: 'خطوات تبني سهلة',
      content: '<p>تبني حيوان في 3 خطوات!</p><p>حمّل التطبيق، اختار حيوان، تواصل مع المالك.</p><p>كلش بسيط وسريع!</p>',
    },
    {
      subtitle: 'مفاجأة عن التبني',
      content: '<p>تعرف بلي التبني ينقذ حياة؟</p><p>كل حيوان يستاهل دار.</p><p>جرب تطبيقنا وغيّر حياة حيوان!</p>',
    },
  ],
};

export async function POST(request: NextRequest) {

  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.email) {
      console.error('Authentication failed: Missing user email', { session });
      return new Response('Unauthorized: Missing user email', { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('Request body:', body);
    const parsedBody = RequestSchema.safeParse(body);
    if (!parsedBody.success) {
      console.error('Invalid request body:', parsedBody.error.issues);
      return NextResponse.json(
        { error: 'Invalid input', details: parsedBody.error.issues },
        { status: 400 }
      );
    }
    const { userPrompt } = parsedBody.data;

    // Fetch userId from user table
    let userRecord;
    try {
      // console.log('Fetching userId for email:', session.user.email);
      userRecord = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, session.user.email))
        .limit(1);
      // console.log('User record:', userRecord);
    } catch (error) {
      console.error('Error fetching user:', {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && 'code' in error ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        { error: 'Failed to fetch user', details: error instanceof Error ? error.message : 'Unknown database error' },
        { status: 500 }
      );
    }

    if (!userRecord[0]) {
      console.error('No user found for email:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = userRecord[0].id;

    // Fetch current prompt from splitPromptHistory
    let currentPrompt;
    try {
      console.log('Fetching current prompt with isCurrent: true');
      currentPrompt = await db
        .select({ prompt: splitPromptHistory.prompt, modelCodeName: splitPromptHistory.modelCodeName })
        .from(splitPromptHistory)
        .where(eq(splitPromptHistory.isCurrent, true))
        .limit(1);
      // console.log('Current prompt result:', currentPrompt);
    } catch (error) {
      console.error('Error fetching current prompt:', {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && 'code' in error ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        { error: 'Failed to fetch current prompt', details: error instanceof Error ? error.message : 'Unknown database error' },
        { status: 500 }
      );
    }

    // Validate currentPrompt for generate-automatic-scripts
    const systemPrompt = currentPrompt[0]?.prompt || SYSTEM_PROMPT;
    if (currentPrompt[0] && !systemPrompt.includes('clientPersona') && !systemPrompt.includes('subPillars')) {
      console.warn('Current prompt is for generate-scripts, not generate-automatic-scripts, using default');
      // @ts-ignore
      currentPrompt[0] = null; // Force fallback to SYSTEM_PROMPT
    }
    const finalSystemPrompt = currentPrompt[0]?.prompt || SYSTEM_PROMPT;
    if (!currentPrompt[0]) {
      console.warn('No valid current prompt found with isCurrent: true, using default');
    }

    // Generate scripts with retries
    let responseData: ResponseData | null = null;
    let thisUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let attempts = 0;
    let lastError: string | null = null;
    let cleanedText = '';

    while (attempts < API_CONFIG.MAX_RETRIES) {
      attempts++;
      const prompt = buildPrompt(finalSystemPrompt, parsedBody.data, attempts > 1);
      console.log(`Attempt ${attempts}: Prompt length: ${prompt.length}`);

      try {
        const { text, usage } = await generateText({
          model: openai(currentPrompt[0]?.modelCodeName || API_CONFIG.MODEL),
          prompt,
          temperature: 1,
        });
        thisUsage = {
          promptTokens: usage?.promptTokens || 0,
          completionTokens: usage?.completionTokens || 0,
          totalTokens: usage?.totalTokens || 0,
        };
        cleanedText = text.trim().replace(/^```json\s*|\s*```$/g, '').trim();
        console.log(`Attempt ${attempts}: Raw AI response:`, cleanedText);

        const parsedResponse = JSON.parse(cleanedText);
        const validatedResponse = ResponseSchema.safeParse(parsedResponse);
        if (!validatedResponse.success) {
          throw new Error(`Invalid response structure: ${validatedResponse.error.message}`);
        }
        responseData = validatedResponse.data;
        console.log(`Attempt ${attempts}: Successfully generated ${responseData.scripts.length} scripts`);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`Attempt ${attempts} failed:`, {
          message: lastError,
          code: error instanceof Error && 'code' in error ? error.code : undefined,
          text: cleanedText || 'No text available',
        });
        if (attempts === API_CONFIG.MAX_RETRIES) {
          console.warn('Using fallback response due to repeated failures');
          responseData = FALLBACK_RESPONSE;
          break;
        }
        await delay(API_CONFIG.RETRY_DELAY_MS);
      }
    }

    if (!responseData) {
      console.error('No response data after retries');
      return NextResponse.json(
        { error: 'Failed to generate scripts', details: lastError || 'Unknown error' },
        { status: 500 }
      );
    }

    // Save to generatedSplitHistory
    let historyEntry;
    try {
      console.log('Inserting into generatedSplitHistory for userId:', userId);
      [historyEntry] = await db
        .insert(generatedSplitHistory)
        .values({
          id: crypto.randomUUID(),
          userId,
          prompt: userPrompt,
          clientPersona: responseData.clientPersona,
          contentPillar: responseData.contentPillar,
          subPillars: responseData.subPillars,
          chosenSubPillars: responseData.subPillars,
          hookType: [
            'fix-a-problem',
            'quick-wins',
            'reactions-reviews',
            'personal-advice',
            'step-by-step-guides',
            'curiosity-surprises',
            'direct-targeting',
          ],
          scripts: responseData.scripts,
          timestamp: new Date(),
          isDeleted: false,
        })
        .returning({ id: generatedSplitHistory.id });
      console.log('History entry created:', historyEntry.id);
    } catch (error) {
      console.error('Error inserting into generatedSplitHistory:', {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && 'code' in error ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        { error: 'Failed to save history', details: error instanceof Error ? error.message : 'Unknown database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientPersona: responseData.clientPersona,
      contentPillar: responseData.contentPillar,
      subPillars: responseData.subPillars.map((sp: string) => ({ value: sp, label: sp })),
      scripts: responseData.scripts,
      historyId: historyEntry.id,
      tokenUsage: {
        prompt_tokens: thisUsage.promptTokens,
        completion_tokens: thisUsage.completionTokens,
        total_tokens: thisUsage.totalTokens,
      },
    });
  } catch (error) {
    console.error('Error generating automatic scripts:', {
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && 'code' in error ? error.code : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to generate automatic scripts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {

  }
}