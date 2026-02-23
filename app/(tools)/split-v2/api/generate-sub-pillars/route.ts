import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export const dynamic = 'force-dynamic';

const API_CONFIG = {
  MODEL: 'gpt-5-mini-2025-08-07',
  MAX_RETRIES: 3,
};

const SYSTEM_PROMPT = `
You are Dr. Brand, a high-level Algerian content strategist. Your task is to generate a response in valid JSON format as specified below. Under no circumstances should you return plain text, incomplete JSON, or invalid JSON (e.g., missing commas, unclosed brackets, trailing commas, or non-JSON content like "weli ghdwa nchlh").

Given a user prompt describing a business/creator context, niche, target audience, product (optional), and best-performing content (optional), your task is to:
1. Identify the main content pillar (a single, overarching theme in Algerian Darja, 3-5 words).
2. Generate 25 sub-pillars (specific content ideas in Algerian Darja, each 5-10 words).
3. Derive a client persona (a concise description of the ideal audience, 10-20 words).

Return the response in JSON format:
{
  "contentPillar": string,
  "subPillars": string[],
  "clientPersona": string
}
Ensure:
- The JSON is valid and parseable.
- No trailing commas in arrays or objects.
- All strings are properly quoted.
- No extra newlines or comments in the output.
- Use Algerian Darja in Arabic letters for contentPillar and subPillars, avoid Moroccan words, and keep language simple and relatable.
- The clientPersona is in English for clarity.
`;

function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { userPrompt } = await request.json();
    if (!userPrompt) {
      return new Response('User prompt is required', { status: 400 });
    }

    let prompt = `${SYSTEM_PROMPT}\n\nUser Prompt: ${userPrompt}`;
    let responseData;
    let attempts = 0;

    while (attempts < API_CONFIG.MAX_RETRIES) {
      attempts++;
      const { text } = await generateText({
        model: openai(API_CONFIG.MODEL),
        prompt,
        temperature: 1,
      });

      let cleanedText = text
        .trim()
        .replace(/^```json\s*|\s*```$/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!isValidJson(cleanedText)) {
        console.warn(`Attempt ${attempts} invalid JSON:`, cleanedText.slice(0, 100), '...');
        if (attempts === API_CONFIG.MAX_RETRIES) {
          console.error('Max retries reached. Returning fallback response.');
          return NextResponse.json({
            contentPillar: 'غير متوفر',
            subPillars: [],
            clientPersona: 'Unable to generate persona due to processing error',
          }, { status: 200 });
        }
        prompt = `${SYSTEM_PROMPT}\n\nUser Prompt: ${userPrompt}\n\nPrevious attempt produced invalid JSON. Ensure valid JSON with proper commas, brackets, and no trailing characters.`;
        continue;
      }

      try {
        responseData = JSON.parse(cleanedText);
        if (
          !responseData.contentPillar ||
          !Array.isArray(responseData.subPillars) ||
          responseData.subPillars.length < 1 ||
          !responseData.clientPersona
        ) {
          throw new Error('Invalid response structure');
        }
        break;
      } catch (parseError: any) {
        console.warn(`Attempt ${attempts} failed to parse AI response:`, parseError);
        console.warn('Cleaned Text:', cleanedText);
        if (attempts === API_CONFIG.MAX_RETRIES) {
          console.error('Max retries reached. Returning fallback response.');
          return NextResponse.json({
            contentPillar: 'غير متوفر',
            subPillars: [],
            clientPersona: 'Unable to generate persona due to processing error',
          }, { status: 200 });
        }
        prompt = `${SYSTEM_PROMPT}\n\nUser Prompt: ${userPrompt}\n\nPrevious attempt failed. Ensure valid JSON with proper commas, brackets, and no trailing characters.`;
      }
    }

    return NextResponse.json({
      contentPillar: responseData.contentPillar,
      subPillars: responseData.subPillars.map((sp: string, index: number) => ({
        value: sp,
        label: sp,
      })),
      clientPersona: responseData.clientPersona,
    });
  } catch (error: any) {
    console.error('Error generating sub-pillars:', error);
    return NextResponse.json({ error: 'Failed to generate sub-pillars', details: error.message }, { status: 500 });
  }
}