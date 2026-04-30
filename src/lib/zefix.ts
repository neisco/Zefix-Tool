import { ZefixMatch } from '../types';
import { calculateConfidence } from './matching';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchZefixData(name: string, ort: string): Promise<ZefixMatch[]> {
  try {
    const response = await fetch('/api/zefix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, ort })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler beim Abrufen der Zefix-Daten');
    }

    const data = await response.json();
    const mappedResults = data.results || [];

    // Verarbeite und bewerte die Ergebnisse
    const matches: ZefixMatch[] = mappedResults.map((firm: any) => {
      const firmCity = firm.municipality || firm.canton || '';
      const confidence = calculateConfidence(name, ort, firm.name, firmCity);

      return {
        uid: firm.uid,
        name: firm.name,
        address: firm.address,
        legalForm: firm.legalForm,
        status: firm.status,
        canton: firm.canton,
        municipality: firm.municipality,
        confidenceScore: confidence
      };
    });

    return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
  } catch (error) {
    console.error('fetchZefixData Error:', error);
    throw error;
  }
}

// Warteschlange für Anfragen, um Rate Limits zu vermeiden
export class ZefixQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private delayMs = 500; // 500ms zwischen Requests

  add(task: () => Promise<void>) {
    this.queue.push(task);
    if (!this.isProcessing) {
      this.process();
    }
  }

  private async process() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        await delay(this.delayMs);
      }
    }
    this.isProcessing = false;
  }
}

export const zefixQueue = new ZefixQueue();
