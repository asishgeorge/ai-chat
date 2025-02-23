import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function* chatCompletion(
  message: string, 
  modelId: string,
  signal?: AbortSignal
) {
  try {
    const stream = await openai.chat.completions.create({
      messages: [{ role: 'user', content: message }],
      model: modelId,
      stream: true,
    }, { signal }); 

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }
    throw error;
  }
} 