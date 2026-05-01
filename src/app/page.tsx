'use client';

import { useState, useRef } from 'react';
import { Upload, Download, Search, CheckCircle2, AlertCircle, HelpCircle, Loader2, Play, Sparkles } from 'lucide-react';
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
      case 'Gefunden': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'Mehrere Treffer': return <HelpCircle className="w-5 h-5 text-amber-500" />;
      case 'Nicht gefunden': return <AlertCircle className="w-5 h-5 text-slate-400" />;
      case 'Fehler': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'Suche läuft': return <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />;
      default: return <Search className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="relative min-h-screen text-slate-800">
      <main className="relative z-10 p-6 sm:p-12 max-w-7xl mx-auto space-y-10">
        
        <header className="glass-panel p-8 sm:p-10 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1 mb-4 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium shadow-sm">
              <Sparkles className="w-4 h-4" />
              <span>Smarte Datenanreicherung</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
              Zefix Tool
            </h1>
            <p className="text-slate-500 text-lg max-w-xl">
              Laden Sie Ihre Excel-Listen hoch und vervollständigen Sie diese automatisch mit offiziellen Daten des Schweizer Handelsregisters.
            </p>
          </div>
        </header>

        {error && (
          <div className="bg-rose-50 text-rose-700 p-5 rounded-2xl border border-rose-100 flex items-center gap-4 shadow-sm">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="col-span-1 glass-panel glass-panel-hover p-8 rounded-[2rem] flex flex-col items-center text-center space-y-6 group">
            <div className="p-5 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <div className="w-full">
              <h3 className="font-bold text-xl text-slate-800 mb-2">1. Datei hochladen</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">Wählen Sie Ihre `.xlsx` Datei aus. Erwartete Spalten: <strong className="text-slate-700 font-medium">Name, Ort</strong>.</p>
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
                className="btn-secondary w-full"
              >
                {isUploading ? 'Wird geladen...' : 'Excel auswählen'}
              </button>
            </div>
          </div>

          <div className="col-span-1 glass-panel glass-panel-hover p-8 rounded-[2rem] flex flex-col items-center text-center space-y-6 group">
            <div className="p-5 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Search className="w-8 h-8" />
            </div>
            <div className="w-full">
              <h3 className="font-bold text-xl text-slate-800 mb-2">2. Zefix Suche</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">Abgleich der Daten mit dem offiziellen Schweizer Firmenregister.</p>
              <button 
                onClick={startZefixSearch}
                disabled={rows.length === 0 || isProcessing}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Suche läuft</> : <><Play className="w-5 h-5 fill-current" /> Suche starten</>}
              </button>
            </div>
          </div>

          <div className="col-span-1 glass-panel glass-panel-hover p-8 rounded-[2rem] flex flex-col items-center text-center space-y-6 group">
            <div className="p-5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Download className="w-8 h-8" />
            </div>
            <div className="w-full">
              <h3 className="font-bold text-xl text-slate-800 mb-2">3. Exportieren</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">Laden Sie die gefundenen Treffer als neues Dokument herunter.</p>
              <button 
                onClick={handleExport}
                disabled={rows.filter(r => r.selectedForExport).length === 0}
                className="btn-success w-full"
              >
                Ergebnisse exportieren ({rows.filter(r => r.selectedForExport).length})
              </button>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="glass-panel rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
              <h2 className="font-bold text-xl text-slate-800">Datenübersicht ({rows.length})</h2>
              <div className="flex gap-6 text-sm font-medium">
                <span className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Gefunden ({rows.filter(r => r.status === 'Gefunden').length})</span>
                <span className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full"><HelpCircle className="w-4 h-4 text-amber-500"/> Mehrere ({rows.filter(r => r.status === 'Mehrere Treffer').length})</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-sm">
                    <th className="p-5 font-semibold border-b border-slate-100 w-16 text-center">Export</th>
                    <th className="p-5 font-semibold border-b border-slate-100 w-20 text-center">Status</th>
                    <th className="p-5 font-semibold border-b border-slate-100 w-1/3">Original (Name & Ort)</th>
                    <th className="p-5 font-semibold border-b border-slate-100">Zefix Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.input.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 text-center align-top">
                        <input 
                          type="checkbox" 
                          checked={row.selectedForExport} 
                          onChange={() => toggleExportSelection(row.input.id)}
                          className="w-5 h-5 text-emerald-500 rounded border-slate-300 bg-white focus:ring-emerald-500 mt-1 cursor-pointer transition-all"
                        />
                      </td>
                      <td className="p-5 text-center align-top">
                        <div className="flex justify-center mt-0.5" title={row.status}>
                          {getStatusIcon(row.status)}
                        </div>
                      </td>
                      <td className="p-5 align-top">
                        <div className="font-semibold text-slate-800 text-lg mb-1">{row.input.Name}</div>
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                          <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-600">{row.input.Ort}</span>
                        </div>
                      </td>
                      <td className="p-5 align-top">
                        {row.status === 'Gefunden' && row.selectedMatch && (
                          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                            <div className="font-semibold text-emerald-800 flex justify-between items-start gap-4">
                              <span>{row.selectedMatch.name}</span>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full whitespace-nowrap border border-emerald-200">
                                {row.selectedMatch.confidenceScore}% Match
                              </span>
                            </div>
                            <div className="text-sm text-emerald-700 mt-2">{row.selectedMatch.address}, {row.selectedMatch.municipality}</div>
                            <div className="text-xs text-emerald-600 mt-3 flex items-center gap-3">
                              <span className="bg-white border border-emerald-100 px-2 py-1 rounded shadow-sm">UID: {row.selectedMatch.uid}</span>
                              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>{row.selectedMatch.status}</span>
                            </div>
                          </div>
                        )}

                        {row.status === 'Mehrere Treffer' && row.possibleMatches.length > 0 && (
                          <div className="space-y-3">
                            <select 
                              className="w-full text-sm p-3 border border-amber-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer shadow-sm"
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
                               <div className="text-xs text-slate-500 px-2">
                                 Ausgewählt: UID {row.selectedMatch.uid}
                               </div>
                            )}
                          </div>
                        )}

                        {row.status === 'Nicht gefunden' && (
                          <div className="text-sm text-slate-500 italic py-2 px-3 bg-slate-50 rounded-lg inline-block border border-slate-100">
                            Keine passende Firma auf Zefix gefunden.
                          </div>
                        )}

                        {row.status === 'Fehler' && (
                          <div className="text-sm text-rose-600 py-2 px-3 bg-rose-50 rounded-lg inline-block border border-rose-100">
                            {row.errorMessage || 'Ein Fehler ist aufgetreten.'}
                          </div>
                        )}
                        
                        {row.status === 'Nicht gesucht' && (
                          <div className="text-sm text-slate-400 py-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
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
      </main>
    </div>
  );
}
