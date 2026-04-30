import { NextResponse } from 'next/server';

// Einfaches In-Memory Cache für die aktuelle Session (funktioniert auf Vercel pro Serverless-Instanz temporär)
const cache = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, ort } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const cacheKey = `${name}_${ort || ''}`.toLowerCase();
    
    if (cache.has(cacheKey)) {
      return NextResponse.json({ results: cache.get(cacheKey) });
    }

    // 1. Suche nach der Firma über die öffentliche Zefix API
    const zefixResponse = await fetch('https://www.zefix.ch/ZefixREST/api/v1/firm/search.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        name: name,
        languageKey: 'de',
        deletedFirms: false,
        exactMatch: false
      })
    });

    if (!zefixResponse.ok) {
      if (zefixResponse.status === 429) {
        return NextResponse.json({ error: 'Rate Limit überschritten. Bitte warten.' }, { status: 429 });
      }
      throw new Error(`Zefix API Fehler: ${zefixResponse.statusText}`);
    }

    const data = await zefixResponse.json();
    const results = Array.isArray(data) ? data : (data.list || []);
    
    // Hole detaillierte Adressen für die Top 5 Treffer (um Rate Limits zu schonen)
    const topResults = results.slice(0, 5);
    
    const mappedResults = await Promise.all(topResults.map(async (firm: any) => {
      let fullAddress = '';
      
      try {
        if (firm.ehraid) {
          const detailRes = await fetch(`https://www.zefix.ch/ZefixREST/api/v1/firm/${firm.ehraid}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.address) {
              const { street, houseNumber, swissZipCode, town, careOf } = detailData.address;
              const streetStr = [street, houseNumber].filter(Boolean).join(' ');
              const townStr = [swissZipCode, town].filter(Boolean).join(' ');
              const careOfStr = careOf ? `c/o ${careOf}, ` : '';
              fullAddress = `${careOfStr}${streetStr}, ${townStr}`;
            }
          }
        }
      } catch (e) {
        console.error('Fehler beim Abrufen der Adresse für', firm.ehraid);
      }

      return {
        uid: firm.uidFormatted || firm.uid || firm.ehraId || '',
        name: firm.name || '',
        address: fullAddress || firm.legalSeat || '',
        legalForm: firm.legalSeat || firm.legalForm?.name?.de || '',
        status: firm.status || 'Aktiv',
        canton: firm.canton || '',
        municipality: firm.legalSeat || ''
      };
    }));

    // Speichere in Cache
    cache.set(cacheKey, mappedResults);

    return NextResponse.json({ results: mappedResults });
  } catch (error: any) {
    console.error('Zefix API Route Error:', error);
    return NextResponse.json({ error: error.message || 'Interner Serverfehler' }, { status: 500 });
  }
}
