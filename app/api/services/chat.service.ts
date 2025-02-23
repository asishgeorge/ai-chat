import {chatCompletion} from './openai.service'
import { models, Model } from '@/helper/models'

export async function* streamChatCompletion(
  message: string, 
  modelId: string,
  signal?: AbortSignal
) {
    // Get the model from the models array
    const selectedModel:Model | undefined = models.find(m => m.id === modelId);
    if (!selectedModel) {
      throw new Error('Model not found');
    }

    // Check if the model is openai
    if (selectedModel.provider === 'openai') {
      try {
        // Pass signal to OpenAI service to handle abort at API level
        const stream = chatCompletion(message, modelId, signal);
        for await (const chunk of stream) {
          yield chunk;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        throw error;
      }
      return;
    }

    throw new Error('Model not supported');
  } 