export class RateLimiter {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;
  private delayBetweenRequests = 2000; // 2 segundos entre cada envio (30/min)

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        // Aguardar antes do próximo envio
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests));
        }
      }
    }

    this.isProcessing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  isQueueProcessing(): boolean {
    return this.isProcessing;
  }
}
