import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import type {
  ChatMessage,
  FineTunedModelArtifact,
  ChatCompletionResponse,
  GeneratedImage,
  ImageGenerationParams,
  ChartSpec,
  PresentationSpec,
} from '@local-ai/shared';
import { PersonaResolver, PersonaPromptAdapter } from '@local-ai/inference';
import { ModelCapabilityRegistry } from '@local-ai/capabilities';
import type {
  GenerationSettings,
  UnifiedModelOption,
  InferenceGenerationStats,
  CompareRunResult,
} from './types';
import { PlaygroundToolbar } from './components/PlaygroundToolbar';
import { ConversationArea } from './components/ConversationArea';
import { ChatBackground } from './components/ChatBackground';
import { chatDrafts, hasUserPrompt, mayRecallMemory, maySaveMemory, type ChatPrivacy } from './hooks/chatSession';
import { MessageComposer } from './components/MessageComposer';
import { PerformancePanel } from './components/PerformancePanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HistoryDrawer } from './components/HistoryDrawer';
import { CompareView } from './components/CompareView';
import { RagSelectorModal } from './components/RagSelectorModal';
import { ImagePlaygroundArea } from './components/ImagePlaygroundArea';
import { ImagePromptComposer } from './components/ImagePromptComposer';
import { ImageLightboxModal } from './components/ImageLightboxModal';
import { ChartPromptModal } from '../visualizations/ChartPromptModal';
import { PresentationPromptModal } from '../presentations/PresentationPromptModal';
import {
  synthesizeChartFromPrompt,
  synthesizePresentationFromPrompt,
} from './utils/specSynthesizer';

const DEFAULT_SETTINGS: GenerationSettings = {
  systemPrompt: 'You are a helpful, fast, and accurate local AI assistant.',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: [],
};

const STORAGE_KEY = 'zaylo_playground_conversations_v3';
const SETTINGS_KEY = 'zaylo_playground_settings_v3';

export const PlaygroundView: React.FC<{ onBranchPrompt?: (conversationId: string, index: number, text: string) => void; voiceControl?: React.ReactNode; recordingContent?: React.ReactNode }> = ({ onBranchPrompt, voiceControl, recordingContent }) => {
  const {
    availableModels,
    installedModels,
    serverState,
    serverInstance,
    serverConfig,
    currentMetric,
    ragEnabled,
    ragDocuments,
    startServer,
    setRagEnabled,
    fetchRagDocuments,
    addRagDocument,
    deleteRagDocument,
    imageHistory,
    isGeneratingImage,
    activeImageJob,
    imageProgress,
    generateImage,
    cancelImageGeneration,
    deleteGeneratedImage,
    saveImageAs,
    openImageFolder,
    fetchImageHistory,
    selectedModel,
    setSelectedModel,
    personas,
    activePersonaId,
    defaultPersonaId,
    setActivePersonaId,
    setActiveTab,
    conversations,
    activeConvId,
    setConversations,
    selectChat,
    createNewChat,
    deleteChat,
    renameChat,
    memoryEnabled,
    memories,
    loftyDbStatus,
    setMemoryEnabled,
    saveMemory,
    fetchMemories,
    persistConversationToLoftyDb,
  } = useAppStore();

  const [, refreshAttachments] = useState(0);
  const stopRequestedRef = useRef(false);
  const streamRequestIdRef = useRef<string | null>(null);
  const [externalInput, setExternalInput] = useState<{ conversationId: string; text: string }>();

  // Fine-Tuned Models from Forge
  const [forgeArtifacts, setForgeArtifacts] = useState<FineTunedModelArtifact[]>([]);

  // Image Lightbox & Inspiration State
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [selectedInspirationPrompt, setSelectedInspirationPrompt] = useState<string>('');
  const [canvasSessionTime, setCanvasSessionTime] = useState<number>(() => Date.now());
  const [composerResetTrigger, setComposerResetTrigger] = useState<number>(0);

  // Generation Settings State
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // Ignored
    }
    return DEFAULT_SETTINGS;
  });

  // Selected Model ID
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);

  // Streaming & Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [, setActiveRequestId] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<{
    tokensPerSec: number;
    tokenCount: number;
    latencyMs: number;
    timeToFirstTokenMs?: number;
    promptTokens?: number;
  }>({ tokensPerSec: 0, tokenCount: 0, latencyMs: 0 });

  // RAG Document Selection
  const [selectedRagDocIds, setSelectedRagDocIds] = useState<string[]>([]);
  const [isRagModalOpen, setIsRagModalOpen] = useState<boolean>(false);

  // Drawers Visibility
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);

  // Creative Studio Modals
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);
  const [isPresentationModalOpen, setIsPresentationModalOpen] = useState<boolean>(false);

  // Compare Mode History
  const [compareHistory, setCompareHistory] = useState<CompareRunResult[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Refs for streaming token accumulation
  const activeStreamContentRef = useRef<string>('');
  const streamTokenCountRef = useRef<number>(0);
  const streamStartTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number | null>(null);

  // Load Forge Artifacts & Documents
  const loadForgeArtifacts = useCallback(async () => {
    try {
      const artifacts = await api.invoke('forge:list-fine-tuned-models', undefined);
      setForgeArtifacts(artifacts || []);
    } catch (err) {
      console.error('Failed to load forge artifacts:', err);
    }
  }, []);

  useEffect(() => {
    fetchRagDocuments();
    loadForgeArtifacts();
    fetchImageHistory();
  }, [fetchRagDocuments, loadForgeArtifacts, fetchImageHistory]);

  // Persist conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.filter(c => !(c as ChatPrivacy).temporary)));
    } catch {
      // Ignored
    }
  }, [conversations]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignored
    }
  }, [settings]);

  // Build Unified Model List (Installed Models + Image Models + Forge LoRA Adapters)
  const unifiedModels: UnifiedModelOption[] = React.useMemo(() => {
    const list: UnifiedModelOption[] = [];

    // 1. Installed models (Text, Vision, and Image)
    for (const inst of installedModels) {
      const taskType = inst.taskType || ModelCapabilityRegistry.resolveTaskType(inst);
      const isImage = taskType === 'image-generation';
      list.push({
        id: inst.id,
        name: inst.name,
        type: 'base',
        taskType,
        isImageModel: isImage,
        imageProfile: isImage ? ModelCapabilityRegistry.getProfile(inst.modelId || inst.id) : undefined,
        format: inst.format,
        quantization: inst.quantization,
        localPath: inst.localPath,
        isLoaded: Boolean(inst.isLoaded || serverInstance?.modelName === inst.name),
        isVisionSupported: Boolean(inst.mmprojPath || taskType === 'vision'),
        rawInstallation: inst,
      });
    }

    // 2. Curated Image Generation Models from catalog
    for (const avail of availableModels) {
      if (ModelCapabilityRegistry.isImageGenerationModel(avail)) {
        if (!list.some((item) => item.id === avail.id || item.rawInstallation?.modelId === avail.id)) {
          const profile = ModelCapabilityRegistry.getProfile(avail.id);
          list.push({
            id: avail.id,
            name: avail.name,
            type: 'base',
            taskType: 'image-generation',
            isImageModel: true,
            imageProfile: profile,
            format: avail.variants[0]?.format || 'safetensors',
            quantization: avail.variants[0]?.quantization || 'F16',
            isLoaded: false,
            isVisionSupported: false,
          });
        }
      }
    }

    // 3. Fine-tuned models & adapters from Forge
    for (const art of forgeArtifacts) {
      list.push({
        id: art.id,
        name: art.name,
        type: art.type === 'lora' ? 'adapter' : 'standalone',
        taskType: 'text-generation',
        isImageModel: false,
        baseModelId: art.baseModelId,
        baseModelName: art.baseModelName,
        adapterPath: art.artifactPath,
        localPath: art.artifactPath,
        format: art.format,
        isLoaded: false,
        isVisionSupported: false,
        rawArtifact: art,
      });
    }

    return list;
  }, [installedModels, availableModels, forgeArtifacts, serverInstance]);

  // Sync selected model with global store (e.g. from Models view "Open in Playground") or server
  useEffect(() => {
    if (unifiedModels.length === 0) return;

    if (selectedModel) {
      // Find matching model from store
      const match = unifiedModels.find(
        (m) =>
          m.id === selectedModel ||
          m.rawInstallation?.modelId === selectedModel ||
          m.rawInstallation?.id === selectedModel ||
          m.name.toLowerCase() === selectedModel.toLowerCase() ||
          m.rawInstallation?.name?.toLowerCase() === selectedModel.toLowerCase()
      );
      if (match) {
        if (selectedModelId !== match.id) {
          setSelectedModelId(match.id);
        }
        return;
      }
    }

    const initial = unifiedModels.find(model => model.isLoaded && !model.isImageModel)
      || unifiedModels.find(model => !model.isImageModel);
    setSelectedModelId(initial?.id || '');
    if (initial) setSelectedModel(initial.name);
  }, [selectedModel, unifiedModels, selectedModelId, setSelectedModel]);

  // Current active conversation
  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];
  const privacy = activeConv as ChatPrivacy | undefined;
  const pendingImage = chatDrafts.get(activeConvId)?.image;
  const setPendingImage = (image?: { dataUrl: string; name: string }) => {
    const draft = chatDrafts.get(activeConvId);
    chatDrafts.set(activeConvId, { text: draft?.text || '', image });
    refreshAttachments(n => n + 1);
  };
  const persistPrivateConversation = (conversation: Parameters<typeof persistConversationToLoftyDb>[0]) => {
    if (maySaveMemory(conversation as ChatPrivacy)) return persistConversationToLoftyDb(conversation);
  };
  const activeModel = unifiedModels.find((m) => m.id === selectedModelId);

  useEffect(() => {
    const ids = new Set(conversations.map(c => c.id));
    for (const id of chatDrafts.keys()) if (!ids.has(id)) chatDrafts.delete(id);
  }, [conversations]);

  // Resolve persona for active conversation
  const activeConvPersona = useMemo(() => {
    const targetId = activeConv?.personaId || activePersonaId;
    return PersonaResolver.resolve(targetId, personas, activePersonaId || defaultPersonaId);
  }, [activeConv?.personaId, activePersonaId, personas, defaultPersonaId]);

  // Restore a chat's selection before applying later changes from the Personas section.
  const selectionConversationRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectionConversationRef.current !== activeConvId) {
      selectionConversationRef.current = activeConvId;
      if (activeConv?.modelId && unifiedModels.some(model => model.id === activeConv.modelId)) {
        setSelectedModelId(activeConv.modelId);
      }
      if (activeConv?.personaId) {
        setActivePersonaId(activeConv.personaId);
        return;
      }
    }
    if (!activePersonaId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId && c.personaId !== activePersonaId
          ? { ...c, personaId: activePersonaId, updatedAt: Date.now() }
          : c
      )
    );
  }, [activePersonaId, activeConvId]);

  const handleSelectPersona = (personaId: string) => {
    setActivePersonaId(personaId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, personaId, updatedAt: Date.now() }
          : c
      )
    );
  };

  // Handle Model Switching
  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    const target = unifiedModels.find((m) => m.id === modelId);
    if (!target) return;

    // Keep global store in sync so Header and other views immediately reflect active model
    setSelectedModel(target.name);

    if (target.isImageModel) {
      // Image model selected: do not disrupt active text server
      return;
    }

    // Update active conversation's model metadata
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              modelId: target.id,
              modelName: target.name,
              isAdapter: target.type === 'adapter',
              adapterPath: target.adapterPath,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    // If it's a base GGUF model and server is running, switch it
    if (target.type === 'base' && target.rawInstallation) {
      setIsLoadingModel(true);
      try {
        if (serverState === 'RUNNING') {
          await api.invoke('server:load-model', { modelId: target.rawInstallation.id });
        } else {
          await startServer(target.rawInstallation.modelId, target.rawInstallation.variantId);
        }
      } catch (err: any) {
        console.error('Failed to switch model:', err);
      } finally {
        setIsLoadingModel(false);
      }
    }
  };

  // Handle Image Generation
  const handleGenerateImage = async (params: ImageGenerationParams) => {
    if (!activeModel) return;
    try {
      await generateImage({
        modelId: activeModel.rawInstallation?.modelId || activeModel.id,
        modelName: activeModel.name,
        modelPath: activeModel.localPath || activeModel.rawInstallation?.localPath,
        params,
      });
    } catch (err: any) {
      alert(`Image generation failed: ${err.message}`);
    }
  };

  const handleCancelImage = async () => {
    await cancelImageGeneration(activeImageJob?.id || '');
  };

  // Start Server handler
  const handleStartServer = async () => {
    setIsStartingServer(true);
    try {
      const target = activeModel?.rawInstallation || installedModels[0];
      if (target) {
        await startServer(target.modelId, target.variantId);
      }
    } catch (err: any) {
      alert(`Failed to start server: ${err.message}`);
    } finally {
      setIsStartingServer(false);
    }
  };

  // Conversation & Canvas Management Handlers
  const handleNewChat = () => {
    if (activeModel?.isImageModel) {
      setCanvasSessionTime(Date.now());
      setSelectedInspirationPrompt('');
      setComposerResetTrigger((prev) => prev + 1);
      setIsHistoryOpen(false);
      return;
    }

    createNewChat();
    setIsHistoryOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      selectChat(id);
      if (conv.personaId) {
        setActivePersonaId(conv.personaId);
      }
    }
    setIsHistoryOpen(false);
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    renameChat(id, newTitle);
  };

  const handleDeleteConversation = (id: string) => {
    deleteChat(id);
  };

  const handleClearConversation = () => {
    if (!confirm('Clear all messages in this conversation?')) return;
    let clearedConv: any = null;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          clearedConv = { ...c, messages: [], updatedAt: Date.now() };
          return clearedConv;
        }
        return c;
      })
    );
    if (clearedConv) {
      void persistPrivateConversation(clearedConv);
    }
  };

  const handleSaveMessageToMemory = async (text: string) => {
    if (!text.trim() || !loftyDbStatus?.connected || !maySaveMemory(privacy)) throw new Error('Memory saving is unavailable for this chat.');
    const saved = await saveMemory({
      content: text.trim().slice(0, 600), category: 'context', scope: 'global',
      conversationId: activeConvId, personaId: activeConvPersona?.id, importance: 4,
      pinned: false, tags: ['chat-saved'], source: 'chat',
    });
    if (!saved?.id) throw new Error('The memory service did not confirm this save. Please try again.');
  };

  // Chat Submission & Streaming Execution
  const handleSendMessage = async (userText: string) => {
    if (isGenerating || (!userText.trim() && !pendingImage)) return;

    const attachedImage = pendingImage;
    const userMsg: ChatMessage = attachedImage
      ? {
          role: 'user',
          content: [
            { type: 'text', text: userText.trim() || 'Analyze this image.' },
            { type: 'image_url', image_url: { url: attachedImage.dataUrl } },
          ],
        }
      : { role: 'user', content: userText.trim() };

    chatDrafts.set(activeConvId, { text: '' });
    setPendingImage(undefined);

    // Build message payload
    const existingMsgs = activeConv?.messages || [];
    const targetPersonaId = activeConv?.personaId || activePersonaId;
    const resolvedPersona = PersonaResolver.resolve(targetPersonaId, personas, activePersonaId || defaultPersonaId);
    const rawMsgs = [...existingMsgs, userMsg];
    const payloadMessages = PersonaPromptAdapter.augmentMessages(
      rawMsgs,
      resolvedPersona,
      settings.systemPrompt.trim() || undefined
    );

    // Append user message + blank assistant message to conversation
    const updatedMessages: ChatMessage[] = [
      ...existingMsgs,
      userMsg,
      { role: 'assistant', content: '' },
    ];

    // Generate auto-title for conversation from first message if titled 'New Chat'
    const newTitle =
      activeConv.title === 'New Chat' && userText.trim()
        ? userText.trim().slice(0, 32) + (userText.trim().length > 32 ? '...' : '')
        : activeConv.title;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              title: newTitle,
              personaId: resolvedPersona?.id,
              messages: updatedMessages,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    setIsGenerating(true);
    stopRequestedRef.current = false;
    const clientRequestId = crypto.randomUUID();
    streamRequestIdRef.current = clientRequestId;
    activeStreamContentRef.current = '';
    streamTokenCountRef.current = 0;
    streamStartTimeRef.current = performance.now();
    firstTokenTimeRef.current = null;

    const reqId = `chatcmpl-${Date.now()}`;
    setActiveRequestId(reqId);

    let retrievedSources: ChatMessage['sources'];
    // Listen to real streamed token chunks
    const unsubChunk = api.on('inference:chunk', (data: { requestId: string; chunk: ChatCompletionResponse }) => {
      if (data.requestId !== clientRequestId) return;
      if (stopRequestedRef.current) { void api.invoke('inference:abort', { requestId: data.requestId }); return; }
      if (data.chunk.sources) retrievedSources = data.chunk.sources;
      const delta = data.chunk.choices[0]?.delta?.content;
      if (delta) {
        if (!firstTokenTimeRef.current) {
          firstTokenTimeRef.current = performance.now();
        }

        activeStreamContentRef.current += delta;
        streamTokenCountRef.current += 1;

        const now = performance.now();
        const durationSec = (now - (firstTokenTimeRef.current || streamStartTimeRef.current)) / 1000;
        const liveTokPerSec = durationSec > 0 ? streamTokenCountRef.current / durationSec : 0;
        const liveLatency = Math.round(now - streamStartTimeRef.current);
        const ttft = firstTokenTimeRef.current
          ? Math.round(firstTokenTimeRef.current - streamStartTimeRef.current)
          : undefined;

        setLiveStats({
          tokensPerSec: parseFloat(liveTokPerSec.toFixed(1)),
          tokenCount: streamTokenCountRef.current,
          latencyMs: liveLatency,
          timeToFirstTokenMs: ttft,
          promptTokens: Math.max(1, Math.ceil(userText.length / 4)),
        });

        // Update active assistant bubble in state
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConvId) return c;
            const msgs = [...c.messages];
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = {
                role: 'assistant',
                content: activeStreamContentRef.current,
                sources: retrievedSources,
              };
            }
            return { ...c, messages: msgs };
          })
        );
      }
    });

    try {
      const response = await api.invoke('inference:chat', {
        clientRequestId,
        model: activeModel?.name || 'default',
        messages: payloadMessages,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens,
        frequency_penalty: settings.frequencyPenalty,
        presence_penalty: settings.presencePenalty,
        stop: settings.stopSequences.length > 0 ? settings.stopSequences : undefined,
        stream: true,
        rag: ragEnabled,
        ragDocumentIds: selectedRagDocIds.length > 0 ? selectedRagDocIds : undefined,
        // Recall and saving follow independent per-chat privacy choices.
        memory: memoryEnabled && mayRecallMemory(privacy) && Boolean(loftyDbStatus?.connected),
        memorySave: maySaveMemory(privacy) && Boolean(loftyDbStatus?.connected),
        conversationId: activeConvId,
        personaId: resolvedPersona?.id,
      });

      const endTime = performance.now();
      const totalLatencyMs = Math.round(endTime - streamStartTimeRef.current);
      const ttftMs = firstTokenTimeRef.current
        ? Math.round(firstTokenTimeRef.current - streamStartTimeRef.current)
        : undefined;

      // Final response text
      const rawFinal = response?.choices[0]?.message?.content || activeStreamContentRef.current;
      const finalContent =
        typeof rawFinal === 'string'
          ? rawFinal
          : Array.isArray(rawFinal)
          ? rawFinal.map((p: any) => (p.type === 'text' ? p.text : '')).join('')
          : '';

      const completionTokens =
        response?.usage?.completion_tokens || Math.max(1, streamTokenCountRef.current || Math.ceil(finalContent.length / 4));
      const promptTokens =
        response?.usage?.prompt_tokens || Math.max(1, Math.ceil(userText.length / 4));

      const durationSec = (endTime - (firstTokenTimeRef.current || streamStartTimeRef.current)) / 1000;
      const finalTokensPerSec = durationSec > 0 ? parseFloat((completionTokens / durationSec).toFixed(1)) : 0;

      const finalStats: InferenceGenerationStats = {
        latencyMs: totalLatencyMs,
        tokensPerSec: finalTokensPerSec,
        tokenCount: completionTokens,
        timeToFirstTokenMs: ttftMs,
        promptTokens,
        totalDurationMs: totalLatencyMs,
      };

      let finalizedConv: any = null;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0) {
            let resolvedContent = finalContent || activeStreamContentRef.current;
            const lp = userText.toLowerCase();

            // Detect chart request
            if (
              (lp.includes('chart') || lp.includes('visualiz') || lp.includes('plot') || lp.includes('graph')) &&
              !resolvedContent.includes('json:chart-spec') &&
              !resolvedContent.includes('```chart')
            ) {
              const fallbackChart = synthesizeChartFromPrompt(userText);
              resolvedContent += `\n\n\`\`\`json:chart-spec\n${JSON.stringify(fallbackChart, null, 2)}\n\`\`\``;
            }
            // Detect presentation request
            else if (
              (lp.includes('presentation') || lp.includes('pitch deck') || lp.includes('powerpoint') || lp.includes('pptx') || lp.includes('slides')) &&
              !resolvedContent.includes('json:presentation-spec') &&
              !resolvedContent.includes('```presentation')
            ) {
              const fallbackPres = synthesizePresentationFromPrompt(userText);
              resolvedContent += `\n\n\`\`\`json:presentation-spec\n${JSON.stringify(fallbackPres, null, 2)}\n\`\`\``;
            }

            msgs[msgs.length - 1] = {
              role: 'assistant',
              content: resolvedContent,
              sources: response?.sources || retrievedSources,
            };
          }
          finalizedConv = {
            ...c,
            messages: msgs,
            lastStats: finalStats,
            updatedAt: Date.now(),
          };
          return finalizedConv;
        })
      );
      if (finalizedConv) {
        void persistPrivateConversation(finalizedConv);
      }
      if (loftyDbStatus?.connected) {
        void fetchMemories();
      }
    } catch (err: any) {
      if (stopRequestedRef.current) return;
      const rawError = err?.message || 'Inference request failed';
      let errorMsg = `[Error: ${rawError}]`;

      if (rawError.includes('image input is not supported') || rawError.includes('mmproj')) {
        errorMsg = `⚠️ **Vision Projector Required**\n\n**${activeModel?.name}** is running in text-only mode and does not have a multimodal projector loaded.\n\nTo chat with images, select a vision model in the model dropdown.`;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = { role: 'assistant', content: errorMsg };
          }
          return { ...c, messages: msgs };
        })
      );
    } finally {
      unsubChunk?.();
      setIsGenerating(false);
      setActiveRequestId(null);
    }
  };

  // Stop active generation
  const handleStopGeneration = () => {
    stopRequestedRef.current = true;
    if (streamRequestIdRef.current) {
      void api.invoke('inference:abort', { requestId: streamRequestIdRef.current });
    }
    // Keep generation locked until the request settles, including cancellation before first token.
  };

  const appendTurnToActiveConversation = (
    userMsg: ChatMessage,
    assistantMsg: ChatMessage,
    fallbackTitle: string
  ) => {
    const targetPersonaId = activeConv?.personaId || activePersonaId;
    let updatedConv: any = null;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConvId) return c;
        updatedConv = {
          ...c,
          title: c.title === 'New Chat' ? fallbackTitle.slice(0, 32) : c.title,
          personaId: targetPersonaId,
          messages: [...c.messages, userMsg, assistantMsg],
          updatedAt: Date.now(),
        };
        return updatedConv;
      })
    );
    if (updatedConv) {
      void persistPrivateConversation(updatedConv);
    }
  };

  // Create Chart Direct from Studio / Modal
  const handleCreateChart = (chartSpec: ChartSpec, promptText: string) => {
    appendTurnToActiveConversation(
      { role: 'user', content: promptText },
      {
        role: 'assistant',
        content: `I've generated the **${chartSpec.title}** visualization using the **${chartSpec.theme}** theme preset.\n\n\`\`\`json:chart-spec\n${JSON.stringify(chartSpec, null, 2)}\n\`\`\``,
      },
      chartSpec.title
    );
  };

  // Create Presentation Direct from Studio / Modal
  const handleCreatePresentation = (presSpec: PresentationSpec, promptText: string) => {
    appendTurnToActiveConversation(
      { role: 'user', content: promptText },
      {
        role: 'assistant',
        content: `I've generated the **${presSpec.title}** presentation deck featuring **${presSpec.slides.length} slides** with the **${presSpec.theme}** preset.\n\n\`\`\`json:presentation-spec\n${JSON.stringify(presSpec, null, 2)}\n\`\`\``,
      },
      presSpec.title
    );
  };

  // Regenerate last response
  const handleRegenerate = () => {
    const msgs = activeConv?.messages || [];
    if (msgs.length < 2) return;
    const lastUserIndex = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const realIndex = msgs.length - 1 - lastUserIndex;
    const lastUserMsg = msgs[realIndex];

    const promptText =
      typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg.content)
        ? (lastUserMsg.content.find((p) => p.type === 'text') as any)?.text || ''
        : '';

    // Retain the original response and retry as a new turn; parent may branch edited prompts.
    handleSendMessage(promptText);
  };

  // Run Comparison Mode Execution
  const handleRunComparison = async (prompt: string) => {
    setIsComparing(true);
    try {
      const baseInst = installedModels[0];
      const ftArtifact = forgeArtifacts[0];

      if (!baseInst) {
        throw new Error('No base model installed to compare against.');
      }

      const res = await api.invoke('forge:compare-models', {
        baseModelPath: baseInst.localPath,
        adapterPath: ftArtifact?.artifactPath,
        prompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      setCompareHistory((prev) => [
        {
          prompt,
          baseResponse: res.baseResponse,
          baseLatencyMs: res.baseDurationMs,
          ftResponse: res.fineTunedResponse,
          ftLatencyMs: res.fineTunedDurationMs,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(`Comparison error: ${err.message}`);
    } finally {
      setIsComparing(false);
    }
  };

  const isVisionSupported = Boolean(activeModel?.isVisionSupported);

  const composer = (
            <MessageComposer
              key={activeConvId}
              conversationId={activeConvId}
              voiceControl={voiceControl}
              recordingContent={recordingContent}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isGenerating={isGenerating}
              serverState={serverState}
              isVisionSupported={isVisionSupported}
              pendingImage={pendingImage}
              onSetPendingImage={setPendingImage}
              ragEnabled={ragEnabled}
              ragDocsCount={ragDocuments.length}
              onOpenRagModal={() => setIsRagModalOpen(true)}
              onToggleRag={() => setRagEnabled(!ragEnabled)}
              memoryEnabled={memoryEnabled && mayRecallMemory(privacy) && maySaveMemory(privacy)}
              memoryCount={memories.length}
              loftyDbConnected={Boolean(loftyDbStatus?.connected)}
              onToggleMemory={privacy?.temporary ? undefined : () => setMemoryEnabled(!memoryEnabled)}
              onOpenMemorySection={() => setActiveTab('loftydb')}
              onStartServer={handleStartServer}
              isStartingServer={isStartingServer}
              externalInput={externalInput?.conversationId === activeConvId ? externalInput.text : ''}
              onClearExternalInput={() => setExternalInput(undefined)}
              onOpenChartModal={() => setIsChartModalOpen(true)}
              onOpenPresentationModal={() => setIsPresentationModalOpen(true)}
            />
  );

  return (
    <div className="flex h-full w-full bg-[var(--background)] text-[var(--foreground)] overflow-hidden relative font-sans">
      {/* Main Workspace Column */}
      <div className="relative isolate flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--background)]">
        <ChatBackground conversationId={activeConvId} active={!activeModel?.isImageModel && !isCompareMode && !hasUserPrompt(activeConv?.messages)} />
        {/* Top Toolbar */}
        <PlaygroundToolbar
          models={unifiedModels}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          serverState={serverState}
          isLoadingModel={isLoadingModel}
          isGeneratingImage={isGeneratingImage}
          onNewChat={handleNewChat}
          activePersona={activeConvPersona}
          personas={personas}
          onSelectPersona={handleSelectPersona}
          onOpenPersonaManagement={() => setActiveTab('personas')}
          onCreatePersona={() => setActiveTab('personas')}
          onClearConversation={handleClearConversation}
          onToggleHistory={() => {
            setIsHistoryOpen(!isHistoryOpen);
            setIsPerformanceOpen(false);
            setIsSettingsOpen(false);
          }}
          onTogglePerformance={() => {
            setIsPerformanceOpen(!isPerformanceOpen);
            setIsHistoryOpen(false);
            setIsSettingsOpen(false);
          }}
          onToggleSettings={() => {
            setIsSettingsOpen(!isSettingsOpen);
            setIsHistoryOpen(false);
            setIsPerformanceOpen(false);
          }}
          onToggleCompare={() => setIsCompareMode(!isCompareMode)}
          isHistoryOpen={isHistoryOpen}
          isPerformanceOpen={isPerformanceOpen}
          isSettingsOpen={isSettingsOpen}
          isCompareMode={isCompareMode}
          conversationCount={conversations.length}
        />

        {/* Workspace Canvas: Normal Conversation Area, Comparative View, or Image Generation Canvas */}
        {activeModel?.isImageModel ? (
          <>
            <ImagePlaygroundArea
              images={imageHistory}
              sessionStartTime={canvasSessionTime}
              isGenerating={isGeneratingImage}
              progress={imageProgress}
              selectedModel={activeModel}
              onSelectSuggestion={(prompt) => setSelectedInspirationPrompt(prompt)}
              onCancelGeneration={handleCancelImage}
              onSaveImageAs={saveImageAs}
              onOpenFolder={openImageFolder}
              onDeleteImage={deleteGeneratedImage}
              onOpenLightbox={(img) => setLightboxImage(img)}
              onRegenerate={(img) => setSelectedInspirationPrompt(img.prompt)}
              onResetCanvas={handleNewChat}
            />

            <ImagePromptComposer
              selectedModel={activeModel}
              isGenerating={isGeneratingImage}
              onGenerate={handleGenerateImage}
              onCancel={handleCancelImage}
              externalPrompt={selectedInspirationPrompt}
              onClearExternalPrompt={() => setSelectedInspirationPrompt('')}
              resetTrigger={composerResetTrigger}
            />

            {lightboxImage && (
              <ImageLightboxModal
                image={lightboxImage}
                onClose={() => setLightboxImage(null)}
                onSaveAs={saveImageAs}
                onOpenFolder={openImageFolder}
                onRegenerate={(img) => setSelectedInspirationPrompt(img.prompt)}
              />
            )}
          </>
        ) : isCompareMode ? (
          <CompareView
            baseModel={unifiedModels.find((m) => m.type === 'base')}
            fineTunedModel={unifiedModels.find((m) => m.type === 'adapter') || unifiedModels[0]}
            onRunComparison={handleRunComparison}
            isComparing={isComparing}
            history={compareHistory}
          />
        ) : (
          <>
            <ConversationArea
              composer={composer}
              onEditPrompt={(index, text) => {
                if (onBranchPrompt) { onBranchPrompt(activeConvId, index, text); return; }
                const branchId = useAppStore.getState().branchConversation(activeConvId, index - 1);
                chatDrafts.set(branchId, { text });
                setExternalInput({ conversationId: branchId, text });
              }}
              messages={activeConv?.messages || []}
              isGenerating={isGenerating}
              selectedModel={activeModel}
              generationStats={activeConv?.lastStats}
              onSelectSuggestion={(prompt) => setExternalInput({ conversationId: activeConvId, text: prompt })}
              onRegenerate={handleRegenerate}
              onRetry={handleRegenerate}
              onClearConversation={handleClearConversation}
              onSaveToMemory={loftyDbStatus?.connected && maySaveMemory(privacy) ? handleSaveMessageToMemory : undefined}
            />

            {/* Bottom Message Composer */}
            {hasUserPrompt(activeConv?.messages) && composer}
          </>
        )}
      </div>

      {/* Right Drawer: Performance Panel */}
      {isPerformanceOpen && (
        <PerformancePanel
          stats={activeConv?.lastStats}
          liveStats={liveStats}
          systemMetric={currentMetric}
          contextLimit={serverConfig?.contextLimit || 4096}
          isGenerating={activeModel?.isImageModel ? isGeneratingImage : isGenerating}
          isImageModel={activeModel?.isImageModel}
          lastGeneratedImage={imageHistory[0]}
          onClose={() => setIsPerformanceOpen(false)}
        />
      )}

      {/* Right Drawer: Generation Settings */}
      {isSettingsOpen && (
        <SettingsDrawer
          settings={settings}
          onChange={(up) => setSettings((s) => ({ ...s, ...up }))}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
          onClose={() => setIsSettingsOpen(false)}
          contextLimit={serverConfig?.contextLimit || 4096}
        />
      )}

      {/* Right Drawer: History */}
      {isHistoryOpen && (
        <HistoryDrawer
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* RAG Knowledge Selector Modal */}
      <RagSelectorModal
        isOpen={isRagModalOpen}
        onClose={() => setIsRagModalOpen(false)}
        ragEnabled={ragEnabled}
        onToggleRag={setRagEnabled}
        documents={ragDocuments}
        selectedDocIds={selectedRagDocIds}
        onToggleDocSelect={(id) => {
          setSelectedRagDocIds((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
          );
        }}
        onSelectAllDocs={() => {
          if (selectedRagDocIds.length === ragDocuments.length) {
            setSelectedRagDocIds([]);
          } else {
            setSelectedRagDocIds(ragDocuments.map((d) => d.id));
          }
        }}
        onAddDocument={addRagDocument}
        onDeleteDocument={deleteRagDocument}
      />

      {/* AI Chart Generation Prompt Modal */}
      <ChartPromptModal
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        onGenerate={handleCreateChart}
      />

      {/* AI Presentation Generation Prompt Modal */}
      <PresentationPromptModal
        isOpen={isPresentationModalOpen}
        onClose={() => setIsPresentationModalOpen(false)}
        onGenerate={handleCreatePresentation}
      />
    </div>
  );
};
