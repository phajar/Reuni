const DIRECTION_WORDS = new Set(['barat', 'timur', 'utara', 'selatan', 'tengah', 'laut', 'daya']);

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

const scoreMatch = (candidateName, addr, isProvince = false, level = '', originalAddr = '') => {
  const c = norm(candidateName);
  if (!c) return 0;

  let score = 0;

  // Cek kecocokan frasa utuh dengan batas kata (word boundaries)
  const exactRegex = new RegExp('\\b' + c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
  if (exactRegex.test(addr)) {
    score = 100 - c.length;
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
      const allHits = words.filter(w => addrWords.has(w)).length;
      if (allHits > 0) {
        score = Math.round((allHits / words.length) * 70);
      }
    }
  }

  // Jika tidak ada kecocokan dasar, tidak perlu prefix boost
  if (score === 0) return 0;

  // Terapkan prefix boost jika ada originalAddr dan level
  if (originalAddr && level) {
    let prefixes = [];
    if (level === 'province') prefixes = ['provinsi', 'prov'];
    else if (level === 'regency') prefixes = ['kabupaten', 'kab', 'kota'];
    else if (level === 'district') prefixes = ['kecamatan', 'kec'];
    else if (level === 'village') prefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel'];

    if (prefixes.length > 0) {
      const prefixPattern = '\\b(' + prefixes.join('|') + ')\\b[\\s.]*' + c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b';
      const prefixRegex = new RegExp(prefixPattern, 'i');
      if (prefixRegex.test(originalAddr)) {
        score += 50; // Massif boost jika dicocokkan langsung setelah kata kunci prefix!
      }
    }
  }

  return score;
};

const address = 'Kp. Cireundeu RT 03 RW 01 Des. Sukamaju kec. Sukatani kab. Purwakarta 4116';
const addrClean = normAddr(address);

console.log('Address clean:', addrClean);
console.log('Score of Sukamaju (village):', scoreMatch('Sukamaju', addrClean, false, 'village', address));
console.log('Score of Sukatani (village):', scoreMatch('Sukatani', addrClean, false, 'village', address));
console.log('Score of Sukatani (district):', scoreMatch('Sukatani', addrClean, false, 'district', address));
