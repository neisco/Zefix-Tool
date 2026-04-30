import * as xlsx from 'xlsx';
import { InputRow, EnrichedRow } from '../types';

export function parseExcelFile(file: File): Promise<InputRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary', cellDates: true });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawData: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (rawData.length === 0) {
          return reject(new Error('Die Excel-Datei ist leer.'));
        }

        // Normalize keys
        const normalizedData = rawData.map(row => {
          const newRow: any = {};
          for (const key of Object.keys(row)) {
            newRow[key.trim().toLowerCase()] = row[key];
            newRow[key] = row[key]; // keep original
          }
          return newRow;
        });

        const firstRow = normalizedData[0];
        const hasName = 'name' in firstRow || 'firma' in firstRow || 'firmenname' in firstRow;
        const hasOrt = 'ort' in firstRow || 'sitz' in firstRow || 'gemeinde' in firstRow;
        
        if (!hasName || !hasOrt) {
          return reject(new Error(`Fehlende Pflichtspalten. Bitte stellen Sie sicher, dass Spalten für "Name" (oder Firma) und "Ort" (oder Sitz) existieren.`));
        }

        const parsedData: InputRow[] = normalizedData.map((row) => ({
          id: crypto.randomUUID(),
          Name: String(row.name || row.firma || row.firmenname || row.Name || '').trim(),
          Ort: String(row.ort || row.sitz || row.gemeinde || row.Ort || '').trim(),
          Vermögensverwalter: row['vermögensverwalter'] ? String(row['vermögensverwalter']) : undefined,
          Trustee: row['trustee'] ? String(row['trustee']) : undefined,
          Aufsichtsorganisation: row['aufsichtsorganisation'] ? String(row['aufsichtsorganisation']) : undefined,
          ...row
        }));

        const filteredData = parsedData.filter(row => row.Name !== '' || row.Ort !== '');

        resolve(filteredData);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(enrichedRows: EnrichedRow[], filename: string = 'Zefix_Export.xlsx') {
  const exportData = enrichedRows.map(row => {
    // Originaldaten
    const data: any = { ...row.input };
    delete data.id; // Interne ID nicht exportieren

    // Zefix Anreicherung
    if (row.selectedMatch) {
      data['Zefix Name'] = row.selectedMatch.name;
      data['Adresse'] = row.selectedMatch.address;
      data['UID'] = row.selectedMatch.uid;
      data['Rechtsform'] = row.selectedMatch.legalForm;
      data['Status'] = row.selectedMatch.status;
      data['Match Status'] = row.status;
      data['Match Confidence'] = `${row.selectedMatch.confidenceScore}%`;
      data['Quelle'] = `https://www.zefix.ch/de/search/entity/list/firm/${row.selectedMatch.uid.replace(/-/g, '')}`;
    } else {
      data['Zefix Name'] = '';
      data['Adresse'] = '';
      data['UID'] = '';
      data['Rechtsform'] = '';
      data['Status'] = '';
      data['Match Status'] = row.status;
      data['Match Confidence'] = '';
      data['Quelle'] = '';
    }

    if (row.errorMessage) {
      data['Fehler'] = row.errorMessage;
    }

    return data;
  });

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Export');
  
  xlsx.writeFile(workbook, filename);
}
