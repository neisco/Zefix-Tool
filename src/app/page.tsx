'use client';

import { useState, useRef } from 'react';
import { Upload, Download, Search, CheckCircle2, AlertCircle, HelpCircle, Loader2, Play } from 'lucide-react';
import { InputRow, EnrichedRow, ZefixMatch, RowStatus } from '@/types';
import { parseExcelFile, exportToExcel } from '@/lib/excel';
import { fetchZefixData, zefixQueue } from '@/lib/zefix';

export default function Home() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const parsedData = await parseExcelFile(file);
      const initialRows: EnrichedRow[] = parsedData.map(input => ({
        input,
        status: 'Nicht gesucht',
        selectedMatch: null,
        possibleMatches: [],
        selectedForExport: false
      }));
      setRows(initialRows);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Lesen der Excel-Datei');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startZefixSearch = () => {
    setIsProcessing(true);
    
    let pendingCount = rows.filter(r => r.status === 'Nicht gesucht' || r.status === 'Fehler').length;
    
    if (pendingCount === 0) {
      setIsProcessing(false);
      return;
    }

    setRows(currentRows => currentRows.map(row => {
      if (row.status === 'Nicht gesucht' || row.status === 'Fehler') {
        return { ...row, status: 'Suche läuft' };
      }
      return row;
    }));

    rows.forEach(row => {
      if (row.status !== 'Nicht gesucht' && row.status !== 'Fehler') return;

      zefixQueue.add(async () => {
        try {
          const matches = await fetchZefixData(row.input.Name, row.input.Ort);
          
          setRows(current => current.map(r => {
            if (r.input.id !== row.input.id) return r;

            if (matches.length === 0) {
              return { ...r, status: 'Nicht gefunden', possibleMatches: [] };
            } else if (matches[0].confidenceScore >= 80) {
              // Bester Match hat 80% oder mehr -> automatisch auswählen
              return { 
                ...r, 
                status: 'Gefunden', 
                selectedMatch: matches[0], 
                possibleMatches: matches,
                selectedForExport: true
              };
            } else {
              // Alle Matches sind unter 80% -> Manuelle Auswahl nötig
              return { 
                ...r, 
                status: 'Mehrere Treffer', 
                possibleMatches: matches,
                selectedMatch: null,
                selectedForExport: false
              };
            }
          }));
        } catch (err: any) {
          setRows(current => current.map(r => {
            if (r.input.id !== row.input.id) return r;
            return { ...r, status: 'Fehler', errorMessage: err.message };
          }));
        } finally {
          pendingCount--;
          if (pendingCount <= 0) {
            setIsProcessing(false);
          }
        }
      });
    });
  };

  const toggleExportSelection = (id: string) => {
    setRows(current => current.map(row => 
      row.input.id === id ? { ...row, selectedForExport: !row.selectedForExport } : row
    ));
  };

  const selectMatch = (rowId: string, matchUid: string) => {
    setRows(current => current.map(row => {
      if (row.input.id !== rowId) return row;
      const match = row.possibleMatches.find(m => m.uid === matchUid) || null;
      return {
        ...row,
        selectedMatch: match,
        status: match ? 'Gefunden' : row.status,
        selectedForExport: !!match
      };
    }));
  };

  const handleExport = () => {
    const rowsToExport = rows.filter(r => r.selectedForExport);
    if (rowsToExport.length === 0) {
      alert("Bitte wählen Sie mindestens eine Zeile für den Export aus.");
      return;
    }
    exportToExcel(rowsToExport);
  };

  const getStatusIcon = (status: RowStatus) => {
    switch (status) {
      case 'Gefunden': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'Mehrere Treffer': return <HelpCircle className="w-5 h-5 text-yellow-500" />;
      case 'Nicht gefunden': return <AlertCircle className="w-5 h-5 text-gray-500" />;
      case 'Fehler': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'Suche läuft': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Search className="w-5 h-5 text-gray-300" />;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Zefix Excel Enrichment Tool
            </h1>
            <p className="text-gray-500 mt-2">Reichern Sie Ihre Excel-Daten automatisch mit offiziellen Schweizer Firmeninformationen an.</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">1. Excel hochladen</h3>
              <p className="text-sm text-gray-500 mb-4">Pflichtspalten: Name, Ort</p>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload} 
                ref={fileInputRef}
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {isUploading ? 'Wird geladen...' : 'Datei auswählen'}
              </button>
            </div>
          </div>

          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
              <Search className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">2. Zefix Suche</h3>
              <p className="text-sm text-gray-500 mb-4">Daten mit dem Handelsregister abgleichen</p>
              <button 
                onClick={startZefixSearch}
                disabled={rows.length === 0 || isProcessing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Suche läuft</> : <><Play className="w-4 h-4" /> Suche starten</>}
              </button>
            </div>
          </div>

          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-full">
              <Download className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">3. Exportieren</h3>
              <p className="text-sm text-gray-500 mb-4">Angereicherte Datei herunterladen</p>
              <button 
                onClick={handleExport}
                disabled={rows.filter(r => r.selectedForExport).length === 0}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                Auswahl exportieren ({rows.filter(r => r.selectedForExport).length})
              </button>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-semibold text-lg">Daten ({rows.length} Einträge)</h2>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4"/> Gefunden ({rows.filter(r => r.status === 'Gefunden').length})</span>
                <span className="flex items-center gap-1 text-yellow-600"><HelpCircle className="w-4 h-4"/> Mehrere ({rows.filter(r => r.status === 'Mehrere Treffer').length})</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm">
                    <th className="p-4 font-medium border-b border-gray-100 w-12 text-center">Export</th>
                    <th className="p-4 font-medium border-b border-gray-100 w-16 text-center">Status</th>
                    <th className="p-4 font-medium border-b border-gray-100">Original Name & Ort</th>
                    <th className="p-4 font-medium border-b border-gray-100">Zefix Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => (
                    <tr key={row.input.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-center align-top">
                        <input 
                          type="checkbox" 
                          checked={row.selectedForExport} 
                          onChange={() => toggleExportSelection(row.input.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-1"
                        />
                      </td>
                      <td className="p-4 text-center align-top">
                        <div className="flex justify-center mt-0.5" title={row.status}>
                          {getStatusIcon(row.status)}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-medium text-gray-900">{row.input.Name}</div>
                        <div className="text-sm text-gray-500">{row.input.Ort}</div>
                      </td>
                      <td className="p-4 align-top">
                        {row.status === 'Gefunden' && row.selectedMatch && (
                          <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                            <div className="font-medium text-green-900 flex justify-between">
                              {row.selectedMatch.name}
                              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">{row.selectedMatch.confidenceScore}%</span>
                            </div>
                            <div className="text-sm text-green-700 mt-1">{row.selectedMatch.address}, {row.selectedMatch.municipality}</div>
                            <div className="text-xs text-green-600 mt-1 flex gap-2">
                              <span>UID: {row.selectedMatch.uid}</span>
                              <span>•</span>
                              <span>{row.selectedMatch.status}</span>
                            </div>
                          </div>
                        )}

                        {row.status === 'Mehrere Treffer' && row.possibleMatches.length > 0 && (
                          <div className="space-y-2">
                            <select 
                              className="w-full text-sm p-2 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-900 focus:ring-2 focus:ring-yellow-500 outline-none"
                              value={row.selectedMatch?.uid || ''}
                              onChange={(e) => selectMatch(row.input.id, e.target.value)}
                            >
                              <option value="">-- Bitte wählen Sie den richtigen Treffer --</option>
                              {row.possibleMatches.map(match => (
                                <option key={match.uid} value={match.uid}>
                                  {match.name} ({match.municipality}) - {match.confidenceScore}% Match
                                </option>
                              ))}
                            </select>
                            {row.selectedMatch && (
                               <div className="text-xs text-gray-500 px-1">
                                 Ausgewählt: UID {row.selectedMatch.uid}
                               </div>
                            )}
                          </div>
                        )}

                        {row.status === 'Nicht gefunden' && (
                          <div className="text-sm text-gray-500 italic py-1">
                            Keine passende Firma auf Zefix gefunden.
                          </div>
                        )}

                        {row.status === 'Fehler' && (
                          <div className="text-sm text-red-600 py-1">
                            {row.errorMessage || 'Ein Fehler ist aufgetreten.'}
                          </div>
                        )}
                        
                        {row.status === 'Nicht gesucht' && (
                          <div className="text-sm text-gray-400 py-1">
                            Wartet auf Suchstart...
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
