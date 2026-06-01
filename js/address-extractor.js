// --- SHARED ADDRESS EXTRACTOR ENGINE ---
// Attach to window object for public/admin accessibility

(function() {
  const DIRECTION_WORDS = new Set(['barat', 'timur', 'utara', 'selatan', 'tengah', 'laut', 'daya']);

  const levenshtein = (a, b) => {
    if (!a || !b) return (a || b).length;
    let m = [];
    for (let i = 0; i <= b.length; i++) {
      m[i] = [i];
      if (i === 0) continue;
      for (let j = 1; j <= a.length; j++) {
        m[0][j] = j;
        let c = a[j - 1] === b[i - 1] ? 0 : 1;
        m[i][j] = Math.min(
          m[i - 1][j - 1] + c,
          m[i][j - 1] + 1,
          m[i - 1][j] + 1,
        );
      }
    }
    return m[b.length][a.length];
  };

  const normalizeWilayah = (str) => {
    const s = String(str || "").trim();
    if (!s) return "";
    const low = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (low === "tgw" || low.startsWith("tegalwaru") || low.startsWith("tegalwalu") || low.startsWith("tegalwar") || low.startsWith("tegalwal")) {
      return "Tegal Waru";
    }
    if (low === "pwk" || low === "purwakarta") {
      return "Purwakarta";
    }
    if (low === "karawang") {
      return "Karawang";
    }
    if (low === "jabar" || low === "jawabarat") {
      return "Jawa Barat";
    }
    if (low === "bandungbarat") {
      return "Bandung Barat";
    }
    if (low === "bekasi") {
      return "Bekasi";
    }
    return str;
  };

  const normalizeWilayahName = (name) => {
    if (!name) return "";
    const stripped = name
        .trim()
        .replace(/^(KABUPATEN|KOTA|KAB\.|KAB|KEC\.|KEC|KECAMATAN|DESA|KEL\.|KELURAHAN)\s+/i, "")
        .trim();
    return normalizeWilayah(stripped);
  };

  const norm = (s) => (s || '').toLowerCase()
    .replace(/\bd\.k\.i\./gi, 'dki')
    .replace(/\bd\.i\./gi, 'di')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bprovinsi\b|\bprov\b/gi, '')
    .replace(/\bkabupaten\b|\bkab\b/gi, '')
    .replace(/\bkota\b/gi, '')
    .replace(/\bkecamatan\b|\bkec\b/gi, '')
    .replace(/\bkelurahan\b|\bkel\b/gi, '')
    .replace(/\bdesa\b|\bdes\b|\bds\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normAddr = (s) => norm(s)
    .replace(/\bperumahan\b/gi, '')
    .replace(/\bblok\b/gi, '')
    .replace(/\bjalan\b|\bjl\b/gi, '')
    .replace(/\bno\b|\bnomor\b/gi, '')
    .replace(/\brt\b|\brw\b/gi, '')
    .replace(/\bkp\b|\bkampung\b/gi, '')
    .replace(/\bgang\b|\bgg\b/gi, '')
    .replace(/\bpermai\b|\bindah\b|\bsejahtera\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const scoreMatch = (candidateName, addr, isProvince = false, level = '', addressStr = '', isPrioritized = false) => {
    const c = norm(candidateName);
    if (!c) return 0;

    // For non-prioritized counties matched broad-scale (without locked province), require explicit county prefix
    if (level === 'regency' && !isPrioritized) {
      const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const namePattern = parts.join('[\\s-]*');
      const prefixPattern = '\\b(kabupaten|kab|kota)\\b[\\s.]*' + namePattern + '\\b';
      const prefixRegex = new RegExp(prefixPattern, 'i');
      if (!prefixRegex.test(addressStr)) {
        return 0; // Reject!
      }
    }

    // REJECT match if name is preceded by wrong level prefix in original addressStr
    if (level && addressStr) {
      let correctPrefixes = [];
      if (level === 'province') correctPrefixes = ['provinsi', 'prov'];
      else if (level === 'regency') correctPrefixes = ['kabupaten', 'kab', 'kota'];
      else if (level === 'district') correctPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc'];
      else if (level === 'village') correctPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kampung', 'kp', 'dusun', 'dsn', 'blok', 'dukuh', 'dkh'];

      let hasCorrectPrefix = false;
      if (correctPrefixes.length > 0) {
        const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const namePattern = parts.join('[\\s-]*');
        const correctPattern = '\\b(' + correctPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
        const correctRegex = new RegExp(correctPattern, 'i');
        if (correctRegex.test(addressStr)) {
          hasCorrectPrefix = true;
        }
      }

      let wrongPrefixes = [];
      if (level === 'province') {
        wrongPrefixes = ['kabupaten', 'kab', 'kota', 'kecamatan', 'kec', 'kes', 'keca', 'kc', 'desa', 'des', 'ds', 'kelurahan', 'kel', 'jalan', 'jl'];
      } else if (level === 'regency') {
        wrongPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc', 'desa', 'des', 'ds', 'kelurahan', 'kel', 'jalan', 'jl', 'kp', 'kampung'];
      } else if (level === 'district') {
        wrongPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kabupaten', 'kab', 'kota', 'provinsi', 'prov', 'jalan', 'jl'];
      } else if (level === 'village') {
        wrongPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc', 'kabupaten', 'kab', 'kota', 'provinsi', 'prov'];
      }
      
      if (wrongPrefixes.length > 0 && !hasCorrectPrefix) {
        const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const namePattern = parts.join('[\\s-]*');
        const wrongPattern = '\\b(' + wrongPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
        const wrongRegex = new RegExp(wrongPattern, 'i');
        if (wrongRegex.test(addressStr)) {
          return 0; // Reject!
        }
      }
    }

    let score = 0;
    
    const cClean = c.replace(/\s+/g, '');
    const addrCleanedSpaces = addr.replace(/\s+/g, '');

    const exactRegex = new RegExp('\\b' + c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
    if (exactRegex.test(addr)) {
      score = 100 + c.length;
    } else if (addrCleanedSpaces.includes(cClean)) {
      score = 95 + cClean.length;
    } else {
      const words = c.split(' ').filter(w => w.length > 2);
      const significantWords = words.filter(w => !DIRECTION_WORDS.has(w));
      const directionWords = words.filter(w => DIRECTION_WORDS.has(w));
      const addrWords = new Set(addr.split(' '));

      if (isProvince) {
        const sigHits = significantWords.filter(w => addrWords.has(w)).length;
        if (sigHits > 0) {
          const dirHits = directionWords.filter(w => addrWords.has(w)).length;
          const ratio = sigHits / Math.max(significantWords.length, 1);
          score = Math.round(ratio * 80) + (dirHits > 0 ? 10 : 0);
        }
      } else {
        const sigHits = significantWords.filter(w => addrWords.has(w)).length;
        if (significantWords.length === 0 || sigHits > 0) {
          const allHits = words.filter(w => addrWords.has(w)).length;
          if (allHits > 0) {
            score = Math.round((allHits / words.length) * 70);
          }
        }
      }

      if (score === 0 && words.length > 0) {
        const addrWordsList = addr.split(' ');
        let fuzzyHits = 0;
        let totalFuzzyScore = 0;

        for (const cw of words) {
          if (cw.length < 5 || DIRECTION_WORDS.has(cw)) continue;
          
          let bestLev = Infinity;
          for (const aw of addrWordsList) {
            if (aw.length < 5 || DIRECTION_WORDS.has(aw)) continue;
            const d = levenshtein(aw, cw);
            if (d < bestLev) bestLev = d;
          }

          if (bestLev <= 1) {
            fuzzyHits++;
            totalFuzzyScore += 50;
          } else if (bestLev === 2 && cw.length >= 8) {
            fuzzyHits++;
            totalFuzzyScore += 30;
          }
        }

        if (fuzzyHits > 0) {
          score = Math.round((fuzzyHits / words.length) * (totalFuzzyScore / fuzzyHits));
        }
      }
    }

    if (score === 0) return 0;

    let hasCorrectPrefix = false;
    let correctPrefixes = [];
    if (level === 'province') correctPrefixes = ['provinsi', 'prov'];
    else if (level === 'regency') correctPrefixes = ['kabupaten', 'kab', 'kota'];
    else if (level === 'district') correctPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc'];
    else if (level === 'village') correctPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kampung', 'kp', 'dusun', 'dsn', 'blok', 'dukuh', 'dkh'];

    if (correctPrefixes.length > 0) {
      const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const namePattern = parts.join('[\\s-]*');
      const prefixPattern = '\\b(' + correctPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
      const prefixRegex = new RegExp(prefixPattern, 'i');
      if (prefixRegex.test(addressStr)) {
        hasCorrectPrefix = true;
      }
    }

    if (hasCorrectPrefix) {
      score += 50;
    }

    return score;
  };

  const bestMatch = (list, addr, isProvince = false, level = '', addressStr = '', isPrioritized = false) => {
    let best = null, bestScore = 0;
    for (const item of list) {
      const score = scoreMatch(item.name, addr, isProvince, level, addressStr, isPrioritized);
      if (score > bestScore) { bestScore = score; best = item; }
    }
    const threshold = isProvince ? 40 : 20;
    return bestScore >= threshold ? { item: best, score: bestScore } : null;
  };

  const extractAddressOnline = async (addressStr) => {
    if (!addressStr || !addressStr.trim()) return null;

    const API = 'https://www.emsifa.com/api-wilayah-indonesia/api';
    const addrClean = normAddr(addressStr);

    const fetchWilayah = async (localPath, remoteUrl) => {
      try {
        const res = await fetch(localPath);
        if (res.ok) return await res.json();
      } catch (e) {}
      try {
        return await fetch(remoteUrl).then(r => r.json());
      } catch (e) {
        console.error(`[Wilayah] Failed to fetch remote: ${remoteUrl}`, e);
        return [];
      }
    };

    if (!window.STATE) window.STATE = {};
    if (!window.STATE.wilayahCache) window.STATE.wilayahCache = { regencies: {}, districts: {}, villages: {} };
    const cache = window.STATE.wilayahCache;

    if (!cache.provinces) {
      cache.provinces = await fetchWilayah('./api-wilayah/provinces.json', `${API}/provinces.json`);
    }
    const provinces = cache.provinces;

    const jabarProv = provinces.find(p => p.name.toLowerCase() === 'jawa barat');
    const jabarId = jabarProv ? jabarProv.id : '32';
    const jakartaProv = provinces.find(p => p.name.toLowerCase() === 'dki jakarta');
    const jakartaId = jakartaProv ? jakartaProv.id : '31';
    const sumatraProvIds = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "21"];

    const provResult = bestMatch(provinces, addrClean, true, 'province', addressStr);
    let finalProv = provResult ? provResult.item : null;
    let finalReg = null;
    let finalDist = null;
    let finalVil = null;

    if (!finalProv || provResult.score < 50) {
      if (!cache.regencies[jabarId]) {
        cache.regencies[jabarId] = await fetchWilayah(`./api-wilayah/regencies/${jabarId}.json`, `${API}/regencies/${jabarId}.json`);
      }
      if (!cache.regencies[jakartaId]) {
        cache.regencies[jakartaId] = await fetchWilayah(`./api-wilayah/regencies/${jakartaId}.json`, `${API}/regencies/${jakartaId}.json`);
      }
      
      const jabarRegs = cache.regencies[jabarId];
      const jakartaRegs = cache.regencies[jakartaId].map(r => ({ ...r, _provinceId: jakartaId, _provinceName: 'DKI JAKARTA' }));

      const tier1Regs = jabarRegs.filter(r => 
        r.id === '3215' || r.id === '3214' || r.id === '3216' || r.id === '3275' ||
        r.name.toLowerCase().includes('karawang') || 
        r.name.toLowerCase().includes('purwakarta') || 
        r.name.toLowerCase().includes('bekasi')
      ).map(r => ({ ...r, _provinceId: jabarId, _provinceName: 'JAWA BARAT' }));

      const otherJabarRegs = jabarRegs
        .filter(r => !tier1Regs.find(t1 => t1.id === r.id))
        .map(r => ({ ...r, _provinceId: jabarId, _provinceName: 'JAWA BARAT' }));

      const tier2Regs = [...jakartaRegs, ...otherJabarRegs];

      const sumatraProvinces = provinces.filter(p => sumatraProvIds.includes(p.id));
      const sumatraRegencyPromises = sumatraProvinces.map(async (p) => {
        if (!cache.regencies[p.id]) {
          cache.regencies[p.id] = await fetchWilayah(`./api-wilayah/regencies/${p.id}.json`, `${API}/regencies/${p.id}.json`);
        }
        return cache.regencies[p.id].map(reg => ({ ...reg, _provinceId: p.id, _provinceName: p.name }));
      });
      const sumatraRegenciesLists = await Promise.all(sumatraRegencyPromises);
      const sumatraRegencies = sumatraRegenciesLists.flat();

      const otherProvincesPromises = provinces.map(async (p) => {
        if (p.id === jabarId || p.id === jakartaId || sumatraProvIds.includes(p.id)) return [];
        if (!cache.regencies[p.id]) {
          cache.regencies[p.id] = await fetchWilayah(`./api-wilayah/regencies/${p.id}.json`, `${API}/regencies/${p.id}.json`);
        }
        return cache.regencies[p.id].map(reg => ({ ...reg, _provinceId: p.id, _provinceName: p.name }));
      });
      const otherRegenciesLists = await Promise.all(otherProvincesPromises);
      const otherRegencies = otherRegenciesLists.flat();

      const t1RegMatch = bestMatch(tier1Regs, addrClean, false, 'regency', addressStr, true);
      if (t1RegMatch && t1RegMatch.score >= 30) {
        finalReg = t1RegMatch.item;
        finalProv = jabarProv || provinces.find(p => p.id === jabarId);
      } else {
        const t2RegMatch = bestMatch(tier2Regs, addrClean, false, 'regency', addressStr, true);
        if (t2RegMatch && t2RegMatch.score >= 30) {
          finalReg = t2RegMatch.item;
          finalProv = provinces.find(p => p.id === finalReg._provinceId);
        } else {
          const t3RegMatch = bestMatch(sumatraRegencies, addrClean, false, 'regency', addressStr, false);
          if (t3RegMatch && t3RegMatch.score >= 30) {
            finalReg = t3RegMatch.item;
            finalProv = provinces.find(p => p.id === finalReg._provinceId);
          } else {
            const regResult = bestMatch(otherRegencies, addrClean, false, 'regency', addressStr, false);
            if (regResult && regResult.score >= 30) {
              finalReg = regResult.item;
              finalProv = provinces.find(p => p.id === finalReg._provinceId);
            }
          }
        }
      }

      if (!finalReg) {
        const districtPromises = tier1Regs.map(async (reg) => {
          if (!cache.districts[reg.id]) {
            cache.districts[reg.id] = await fetchWilayah(`./api-wilayah/districts/${reg.id}.json`, `${API}/districts/${reg.id}.json`);
          }
          return cache.districts[reg.id].map(dist => ({ 
            ...dist, 
            _regencyId: reg.id, 
            _regencyName: reg.name,
            _provinceId: jabarId,
            _provinceName: 'JAWA BARAT'
          }));
        });
        const t1DistrictsLists = await Promise.all(districtPromises);
        const t1Districts = t1DistrictsLists.flat();

        const t1DistMatch = bestMatch(t1Districts, addrClean, false, 'district', addressStr);
        if (t1DistMatch && t1DistMatch.score >= 40) {
          finalDist = t1DistMatch.item;
          let targetRegId = finalDist._regencyId;
          let targetRegName = finalDist._regencyName;

          const distNorm = finalDist.name.toLowerCase().replace(/\s+/g, '');
          if (distNorm === 'tegalwaru' && !addrClean.includes('karawang')) {
            targetRegId = '3214';
            targetRegName = 'KABUPATEN PURWAKARTA';
            const purwakartaDistricts = t1Districts.filter(d => d._regencyId === '3214');
            const pDist = purwakartaDistricts.find(d => d.name.toLowerCase().replace(/\s+/g, '') === 'tegalwaru');
            if (pDist) {
              finalDist = pDist;
            }
          }

          finalReg = { id: targetRegId, name: targetRegName };
          finalProv = jabarProv || provinces.find(p => p.id === jabarId);
        }
      }
    }

    if (finalReg) {
      if (!cache.regencies[finalProv.id]) {
        cache.regencies[finalProv.id] = await fetchWilayah(`./api-wilayah/regencies/${finalProv.id}.json`, `${API}/regencies/${finalProv.id}.json`);
      }
      const regencies = cache.regencies[finalProv.id];

      if (!finalReg.name) {
        const rr = bestMatch(regencies, addrClean, false, 'regency', addressStr, true);
        if (rr) finalReg = rr.item;
      }

      if (finalReg) {
        if (!cache.districts[finalReg.id]) {
          cache.districts[finalReg.id] = await fetchWilayah(`./api-wilayah/districts/${finalReg.id}.json`, `${API}/districts/${finalReg.id}.json`);
        }
        const districts = cache.districts[finalReg.id];

        if (!finalDist) {
          const dr = bestMatch(districts, addrClean, false, 'district', addressStr);
          if (dr) finalDist = dr.item;
        }

        if (finalDist) {
          if (!cache.villages[finalDist.id]) {
            cache.villages[finalDist.id] = await fetchWilayah(`./api-wilayah/villages/${finalDist.id}.json`, `${API}/villages/${finalDist.id}.json`);
          }
          const villages = cache.villages[finalDist.id];

          const vr = bestMatch(villages, addrClean, false, 'village', addressStr);
          if (vr) {
            finalVil = vr.item;
          }
        }
      }
    }

    return {
      provinsi: finalProv ? finalProv.name : null,
      kabupaten: finalReg ? finalReg.name : null,
      kecamatan: finalDist ? finalDist.name : null,
      desa: finalVil ? finalVil.name : null
    };
  };

  // Export to window
  window.levenshtein = levenshtein;
  window.normalizeWilayah = normalizeWilayah;
  window.normalizeWilayahName = normalizeWilayahName;
  window.extractAddressOnline = extractAddressOnline;
})();
