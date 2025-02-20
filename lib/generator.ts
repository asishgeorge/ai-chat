type StreamingOptions = {
    delayMs?: number; // Delay between chunks (default: 100ms)
    chunkSize?: number; // Number of characters per chunk (default: 10)
    stop?: boolean; // Flag to stop streaming
  };
  
  /**
   * Simulates an LLM streaming response as an asynchronous generator.
   *
   * @param fullText - The full text to simulate streaming for.
   * @param options - Streaming options including delay and chunk size.
   * @returns An async generator yielding chunks of text.
   */
  export async function* simulateLLMStreaming(
    fullText: string,
    options: StreamingOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const { delayMs = 100, chunkSize = 10 } = options;
  
    let currentIndex = 0;
  
    while (currentIndex < fullText.length) {
      // Check if stop flag is set
      if (options.stop) {
        return;
      }
  
      // Get the next chunk
      const chunk = fullText.slice(currentIndex, currentIndex + chunkSize);
      currentIndex += chunkSize;
  
      // Yield the chunk
      yield chunk;
  
      // Simulate delay
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }