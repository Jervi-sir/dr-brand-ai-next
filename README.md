### ai for dr brand

m taking 14% profit from this 

<a href="https://chat.vercel.ai/">
  <h1 align="center">Dr Brand AI Chatbot</h1>
</a>

<p align="center">
  forked from Vercel  <a href="https://github.com/vercel/ai-chatbot"><strong>ai chatbot template</strong></a>
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI (default), Anthropic, Cohere, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Vercel Postgres powered by Neon](https://vercel.com/storage/postgres) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [NextAuth.js](https://github.com/nextauthjs/next-auth)
  - Simple and secure authentication

## Model Providers

This template ships with OpenAI `gpt-4o` as the default. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

### install pnpm 

0. check their docs
0. in ubuntu `sudo npm i -g pnpm@latest`

## Running locally

1. install with `pnpm i`
2. Create: `.env` or `.env.local`
3. Link postgresql database url in the `.env`
4. migrate with Drizzle: `npx drizzle-kit migrate`


### run the server

1. `pnpm run build`
2. `npx next run -p 6030`
3. or use `pm2 start npm --name "dr-ai" -- start`

### update the db 
1. npx drizzle-kit generate
2. npx drizzle-kit migrate

### WYSIWYG
https://github.com/JefMari/awesome-wysiwyg-editors
https://shadcn-minimal-tiptap.vercel.app/
https://echo-editor.jzcloud.site/

### Calendar
https://github.com/Jervi-sir/big-calendar-offf-full

### project time
"dr-ai": {
  "msDuration": 44072304,
  "duration": "12h 14m"
},
  "dr-brand-ai-laravel": {
  "msDuration": 2976131,
  "duration": "49m"
},
"dr-ai-next": {
  "msDuration": 2397876,
  "duration": "39m"
},
"dr-brand-ai": {
  "msDuration": 47299467,
  "duration": "13h 8m"
},
"ai-chatbot": {
  "msDuration": 1670055,
  "duration": "27m"
},
``` 2025, May 24th
 "dr-brand-ai": {
    "msDuration": 94076990,
    "duration": "26h 7m"
  },
    "db-brand-ai-next": {
    "msDuration": 43623436,
    "duration": "12h 7m",
    "duration": "24h 50m",  2025, April 22nd
    "duration": "6h 20m"    2025, May 24th
  },

=====================================
Total = 12h 14m + 49m + 39m + 13h 8m + 27m + 26h 7m + 24h 50m + 6h 20m
      = 82h
=====================================
