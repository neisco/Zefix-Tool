export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[m][n];
}

export function calculateConfidence(inputName: string, inputCity: string, zefixName: string, zefixCity: string): number {
  const cleanInputName = inputName.trim().toLowerCase();
  const cleanZefixName = zefixName.trim().toLowerCase();
  const cleanInputCity = inputCity.trim().toLowerCase();
  const cleanZefixCity = zefixCity.trim().toLowerCase();

  let nameScore = 0;
  let cityScore = 0;

  // City match check
  if (cleanInputCity === cleanZefixCity || cleanZefixCity.includes(cleanInputCity) || cleanInputCity.includes(cleanZefixCity)) {
    cityScore = 100;
  } else {
    // Falls der Ort komplett falsch ist, starke Abwertung
    cityScore = 0;
  }

  // Name match check
  if (cleanInputName === cleanZefixName) {
    nameScore = 100;
  } else {
    // Entferne gängige Rechtsformen für besseren Vergleich
    const removeLegalForms = (name: string) => {
      return name.replace(/\b(ag|gmbh|sa|sarl|sagl|inc|ltd)\b/gi, '').trim();
    };

    const inputNoLegal = removeLegalForms(cleanInputName);
    const zefixNoLegal = removeLegalForms(cleanZefixName);

    if (inputNoLegal === zefixNoLegal && inputNoLegal.length > 0) {
      nameScore = 95; // Sehr sicher, nur Rechtsform fehlt/ist anders
    } else {
      const distance = levenshteinDistance(inputNoLegal, zefixNoLegal);
      const maxLength = Math.max(inputNoLegal.length, zefixNoLegal.length);
      const similarity = maxLength === 0 ? 0 : ((maxLength - distance) / maxLength) * 100;
      
      nameScore = Math.max(0, similarity);
    }
  }

  // Gewichtung: 70% Name, 30% Ort
  if (cityScore === 0) {
    // Wenn der Ort nicht übereinstimmt, ist es ein riskanter Match.
    // Maximal 50% Confidence
    return Math.round(nameScore * 0.5);
  }

  return Math.round((nameScore * 0.7) + (cityScore * 0.3));
}
