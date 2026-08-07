const fs = require('fs');

const userText = `Refresh Rate: How many times per second a display updates its image, measured in Hertz (Hz).

Frame Rate: The frequency at which consecutive images (frames) are displayed, measured in FPS.

Bottleneck: A performance limitation caused by one component dragging down the speed of the entire system.

Binary: A base-2 numbering system consisting entirely of 0s and 1s used by computers.

Bit: The smallest unit of data in a computer, representing a 0 or a 1.

Byte: A group of 8 bits, typically representing a single character of text.

KB (Kilobyte): A unit of data equal to 1,024 bytes.

MB (Megabyte): A unit of data equal to 1,024 kilobytes.

GB (Gigabyte): A unit of data equal to 1,024 megabytes.

TB (Terabyte): A unit of data equal to 1,024 gigabytes.

PB (Petabyte): A unit of data equal to 1,024 terabytes.

Network: A collection of computers and devices connected together to share data.

LAN (Local Area Network): A network confined to a small geographic area, like a home or office.

WLAN (Wireless Local Area Network): A local network that relies on wireless communication (Wi-Fi).

PAN (Personal Area Network): A short-range network centered around an individual (e.g., Bluetooth).

Cloud: Internet-based computing resources, storage, and servers accessed remotely.

Malware: Malicious software designed to disrupt, damage, or gain unauthorized access to a computer.

Virus: Malicious code that attaches to legitimate files and requires human action to spread.

Worm: Standalone malware that replicates itself automatically across networks.

Trojan Horse: Malicious software disguised as a legitimate, safe program.

Ransomware: Malware that encrypts a user's files and demands payment for the decryption key.`;

const parseTermsFromText = (text) => {
  if (!text || !text.trim()) return [];

  const cleanTerm = (t) => t
    .replace(/^[●○•\*\-\#\s]+/, '')
    .replace(/^(?:\d{1,3}[\.\)]\s+)+/, '')
    .replace(/[:\-–—\s]+$/, '')
    .trim();

  const isJunkTerm = (t) => {
    if (!t || t.length < 1 || t.length > 90) return true;
    if (/\b(and|or|the|a|an|of|in|to|for|with|on|at|by|from|as|into|like|through|after|over|between|out|against|during|without|before|under|around|among)\s*$/i.test(t)) return true;
    if (/^(and|or|but|so|because|although|which|that|who|where|when)\s+/i.test(t)) return true;
    if (/^(page|table|figure|chapter|section|module|lesson|unit|note|reference|source|http|www|copyright|©)/i.test(t)) return true;
    if (/^\d+$/.test(t)) return true;
    return false;
  };

  const isNewItemStart = (line) => {
    if (!line) return true;
    const l = line.trim();
    return /^[●○•\*\-\#]/.test(l) ||
           /^\d+[\.\)]/.test(l) ||
           /^(?:Q|Question)\s*[:\.\-]/i.test(l) ||
           /^(?:[●○•\*\-\#\s]|\d+[\.\)]\s*)*[A-Za-z0-9\.\"\'][A-Za-z0-9\s\(\)\-\/\,\'\"\.]{0,75}\s*[:–—\-]\s*/.test(l) ||
           /^[A-Za-z0-9\s\+\-\(\)]{2,40}\s{2,}/.test(l);
  };

  const unwrapText = (input) => {
    const lines = input.split('\n');
    const result = [];
    let buffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (buffer) { result.push(buffer); buffer = ''; }
        continue;
      }

      if (!buffer) {
        buffer = line;
      } else {
        const danglingEnd = /\b(and|or|the|a|an|of|in|to|for|with|on|at|by|from|as|into|like|through|after|over|between|out|against|during|without|before|under|around|among|that|which|who|is|are|was|were)\s*$/i.test(buffer);
        const endsPunct = /[.:;?!—–\-]\s*$/.test(buffer);
        const startsLower = /^[a-z0-9,]/.test(line);

        if (!isNewItemStart(line) && (danglingEnd || (!endsPunct && (startsLower || buffer.length > 50)))) {
          buffer += ' ' + line;
        } else {
          result.push(buffer);
          buffer = line;
        }
      }
    }
    if (buffer) result.push(buffer);
    return result;
  };

  const rawLines = unwrapText(text);

  const formatDefinition = (d) => {
    let formatted = d
      .replace(/\s+/g, ' ')
      .replace(/^[\-–—:\s]+/, '')
      .trim();
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return formatted;
  };

  const parseTermAndAliases = (raw) => {
    const aliasSeparators = /\s+\/\s+|\s+(?:or|aka|also known as)\s+/i;
    if (aliasSeparators.test(raw)) {
      const parts = raw.split(aliasSeparators).map(s => s.trim()).filter(Boolean);
      return { primaryTerm: parts[0], aliases: parts.slice(1) };
    }
    return { primaryTerm: raw, aliases: [] };
  };

  const sanitizeItem = (term, def) => {
    let finalTerm = cleanTerm(term);
    let finalDef = formatDefinition(def);

    const isDescriptiveTerm = /\b(that|which|used to|designed to|refers to|is defined as|responsible for|manages|handles|provides|converts|acts as|serves as)\b/i.test(finalTerm);
    
    if ((isDescriptiveTerm || finalTerm.length > 45) && finalDef.length < 35 && !/\b(that|which|manages|handles)\b/i.test(finalDef)) {
      const temp = finalTerm;
      finalTerm = finalDef;
      finalDef = temp;
    }

    return { term: finalTerm, def: finalDef };
  };

  const items = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    const inlineMatch = line.match(/^(?:[●○•\*\-\#\s]|\d+[\.\)]\s*)*([A-Za-z0-9\.\"\'][A-Za-z0-9\s\(\)\-\/\,\'\"\.]{0,75})\s*[:–—\-]\s+(.+)$/);
    const qaMatch = line.match(/^(?:Q|Question)\s*[:\.\-]\s*(.+?)\s*(?:A|Answer)\s*[:\.\-]\s*(.+)$/i);
    const tableMatch = line.match(/^([A-Za-z0-9\s\+\-\(\)]{2,40})\s{2,}(.+)$/);
    const headingMatch = line.match(/^(?:\d+[\.\)]\s*|#{1,6}\s+|[●○•\*\-]\s+)?([A-Z0-9][A-Za-z0-9\s\(\)\-\/\,]{2,70})$/);

    if (qaMatch && qaMatch[1] && qaMatch[2]) {
      const qText = qaMatch[1].replace(/^(what|who|which|how|why|is|are|define|explain)\s+(is|are|the|a|an)?\s*/i, '').replace(/\?$/, '').trim();
      let rawDef = qaMatch[2].trim();

      while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
        i++;
        rawDef += ' ' + rawLines[i].trim();
      }

      const { term, def } = sanitizeItem(qText, rawDef);
      if (!isJunkTerm(term) && def.length >= 4) {
        const { primaryTerm, aliases } = parseTermAndAliases(term);
        items.push({ term: primaryTerm, def, alias: aliases.length ? aliases : undefined });
      }
    } else if (inlineMatch && inlineMatch[1] && inlineMatch[2]) {
      const rawTerm = inlineMatch[1].trim();
      let rawDef = inlineMatch[2].trim();

      while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
        i++;
        rawDef += ' ' + rawLines[i].trim();
      }

      const { term, def } = sanitizeItem(rawTerm, rawDef);

      if (!isJunkTerm(term) && def.length >= 4) {
        const { primaryTerm, aliases } = parseTermAndAliases(term);
        items.push({
          term: primaryTerm,
          def,
          alias: aliases.length > 0 ? Array.from(new Set(aliases)) : undefined
        });
      }
    } else if (tableMatch && tableMatch[1] && tableMatch[2]) {
      const { term, def } = sanitizeItem(tableMatch[1], tableMatch[2]);
      if (!isJunkTerm(term) && def.length >= 3) {
        const { primaryTerm, aliases } = parseTermAndAliases(term);
        items.push({
          term: primaryTerm,
          def,
          alias: aliases.length > 0 ? Array.from(new Set(aliases)) : undefined
        });
      }
    } else if (headingMatch && i + 1 < rawLines.length) {
      const headingCandidate = cleanTerm(headingMatch[1]);
      const nextLine = rawLines[i + 1];

      if (!isJunkTerm(headingCandidate) && !isNewItemStart(nextLine)) {
        currentHeading = headingCandidate;
        let rawDef = nextLine.trim();
        i++;

        while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
          i++;
          rawDef += ' ' + rawLines[i].trim();
        }

        if (rawDef.length >= 8 && !isJunkTerm(rawDef)) {
          const { term, def } = sanitizeItem(headingCandidate, rawDef);
          if (!isJunkTerm(term)) {
            const { primaryTerm, aliases } = parseTermAndAliases(term);
            items.push({
              term: primaryTerm,
              def,
              alias: aliases.length > 0 ? aliases : undefined
            });
          }
        }
      }
    }
  }

  // Deduplicate items by term name
  const uniqueItems = [];
  const seenTerms = new Set();
  for (const item of items) {
    const key = item.term.toLowerCase();
    if (!seenTerms.has(key)) {
      seenTerms.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
};

const terms = parseTermsFromText(userText);
console.log("Extracted terms count:", terms.length);
console.log("All extracted terms:\n", terms.map((t, idx) => `${idx + 1}. [${t.term}] => ${t.def}`).join('\n'));
