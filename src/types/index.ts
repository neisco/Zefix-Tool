export interface InputRow {
  id: string; // Generierte UUID für interne Referenz
  Name: string;
  Ort: string;
  Vermögensverwalter?: string;
  Trustee?: string;
  Aufsichtsorganisation?: string;
  [key: string]: any; // Falls noch weitere Spalten vorhanden sind
}

export interface ZefixMatch {
  uid: string;
  name: string;
  address: string;
  legalForm: string;
  status: string;
  canton: string;
  municipality: string;
  confidenceScore: number;
}

export type RowStatus = 
  | 'Nicht gesucht' 
  | 'Suche läuft' 
  | 'Gefunden' 
  | 'Mehrere Treffer' 
  | 'Nicht gefunden' 
  | 'Fehler';

export interface EnrichedRow {
  input: InputRow;
  status: RowStatus;
  selectedMatch: ZefixMatch | null;
  possibleMatches: ZefixMatch[];
  selectedForExport: boolean;
  errorMessage?: string;
}
