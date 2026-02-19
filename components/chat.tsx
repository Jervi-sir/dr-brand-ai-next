'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import { fetcher, generateUUID, Message } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { useLockStore } from '@/zustand/use-lock-store';
import { Textarea } from './ui/textarea';
import { cx } from 'class-variance-authority';
import { Button } from './ui/button';
import { Unlock } from 'lucide-react';

export function Chat({
  id,
  initialMessages,
  selectedChatModelID,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModelID: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const usedCode = useLockStore((state: any) => state.usedCode);
  const [selectedModelID, setSelectedModelID] = useState(selectedChatModelID); // Manage local state

  const { data: activeModels, error: modelsError } = useSWR<
    Array<{ id: string; name: string; description: string }>
  >('/api/ai-active-models', fetcher, {
    revalidateOnFocus: false,
    fallbackData: [],
  });

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  }: any = useChat({
    id,
    body: { id, selectedChatModelID: selectedModelID, usedCode: usedCode },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: ({ id, annotations }, { usage }) => {
      // Update the specific message with usage data
      setMessages((prevMessages: any[]) =>
        prevMessages.map((msg) =>
          msg.id === id
            ? {
              ...msg,
              promptTokens: usage?.promptTokens || null,
              completionTokens: usage?.completionTokens || null,
              totalTokens: usage?.totalTokens || null,
              duration: (annotations as any)?.[0]?.duration || null
            }
            : msg
        )
      );
      mutate('/api/history');
    },
    onError: () => {
      toast.error('An error occured, please try again!');
    },
  });

  // const { data: votes } = useSWR<Array<Vote>>(
  //   `/api/vote?chatId=${id}`,
  //   fetcher,
  // );

  // const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const isUnlocked = useLockStore((state: any) => state.isUnlocked);
  // Check if selectedModelID is valid (exists in active models)
  const isValidModel = activeModels?.some((model) => model.id === selectedModelID);

  const handleModelChange = (modelId: string) => {
    setSelectedModelID(modelId);
  };

  useEffect(() => {
    // If no valid model is selected and active models are available, select the first one
    if (activeModels) {
      if (!selectedModelID && activeModels?.length > 0) {
        setSelectedModelID(activeModels[0].id);
      }
    }
  }, [activeModels, selectedModelID]);


  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelID={selectedChatModelID}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          onModelChange={handleModelChange} // Pass callback to ChatHeader
        />

        <Messages
          chatId={id}
          status={status}
          // votes={votes}
          messages={messages as any}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {isUnlocked ? (
            !isReadonly ? (
              isValidModel ? (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  status={status}
                  stop={stop}
                  messages={messages}
                  setMessages={setMessages}
                  append={append}
                />
              ) : (
                <div className="relative w-full flex flex-col gap-4">
                  <div className='h-20 rounded-2xl dark:bg-zinc-950 pb-2 pt-4 border border-1 dark:border-neutral-900'>
                    <p className="text-red-500 text-sm pl-4 pt-1">
                      {activeModels && activeModels?.length > 0
                        ? 'Please select a model to continue.'
                        : 'No active models available.'}
                    </p>
                  </div>
                </div>
              )
            ) : null
          ) : (
            <UnlockInput />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        // attachments={attachments}
        // setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        // votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}


const UnlockInput = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const isUnlocked = useLockStore((state: any) => state.isUnlocked);
  const error = useLockStore((state: any) => state.error);
  const reset = useLockStore((state: any) => state.reset);
  const unlock = useLockStore((state: any) => state.unlock);
  const loadFromSession = useLockStore((state: any) => state.loadFromSession);

  const handleUnlock = async () => {
    if (!input.trim()) return;
    setIsLoading(true); // Set loading state
    try {
      await unlock(input);
      if (isUnlocked) {
        setInput(''); // Clear input on success
      }
    } finally {
      setIsLoading(false); // Clear loading state
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent newline
      handleUnlock(); // Trigger unlock on Enter
    }
  };

  useEffect(() => {
    loadFromSession();
    const timer = setTimeout(() => {
      if (!isUnlocked) {
        reset();
      }
    }, 3000);
    return () => clearTimeout(timer); // Cleanup timer
  }, [isUnlocked, loadFromSession, reset]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <div className="relative">
        <Textarea
          data-testid="multimodal-input"
          placeholder={isUnlocked ? 'Unlocked! Send a message...' : 'Enter unlock code...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={cx(
            'max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base dark:bg-zinc-950 pb-2 pt-4 dark:border-zinc-700',
            isUnlocked ? 'bg-green-50 dark:bg-green-900/20' : ''
          )}
          rows={2}
          autoFocus
          disabled={isUnlocked} // Disable input after unlocking
          onKeyDown={handleKeyDown}
        />
        <div className="absolute top-0 right-0 p-2 pt-4 w-fit flex flex-row justify-end">
          <Button
            type="button"
            data-testid="send-button"
            className="rounded-lg p-1.5 h-8 px-2 border dark:border-zinc-900 flex items-center gap-1"
            onClick={handleUnlock}
            disabled={isUnlocked || !input.trim() || isLoading} // Disable during loading
          >
            {isLoading ? (
              <svg
                className="animate-spin size-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <Unlock size={16} />
            )}
            <span>{isUnlocked ? 'Unlocked' : isLoading ? 'Unlocking...' : 'Unlock'}</span>
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 pb-4 pl-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    </div>

  )
}