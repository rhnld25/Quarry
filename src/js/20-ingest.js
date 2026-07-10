class QIngest extends QLicense {
  // ---------- data ingestion (SQLite / CSV / TSV / JSON / Excel / SQL) ----------

  sanitizeTableName(name) {
    let n = String(name || 'data').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n || /^[0-9]/.test(n)) n = 't_' + n;
    return n.toLowerCase().slice(0, 40) || 'data';
  }

  inferColumnType(values) {
    let sawValue = false, allInt = true, allNum = true;
    for (const v of values) {
      if (v === null || v === undefined || v === '') continue;
      sawValue = true;
      const s = String(v).trim();
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) { allNum = false; allInt = false; break; }
      if (!/^-?\d+$/.test(s)) allInt = false;
    }
    if (!sawValue) return 'TEXT';
    return allInt ? 'INTEGER' : (allNum ? 'REAL' : 'TEXT');
  }

  loadTablesInto(sheets) {
    this.db = new this.SQL.Database();
    let created = 0;
    for (const sh of sheets) {
      if (!sh.columns || !sh.columns.length) continue;
      const table = this.sanitizeTableName(sh.name);
      const types = sh.columns.map((_, ci) => this.inferColumnType(sh.rows.map(r => r[ci])));
      const colDefs = sh.columns.map((c, ci) => `"${String(c || ('col' + ci)).replace(/"/g, '""')}" ${types[ci]}`).join(', ');
      this.db.run(`CREATE TABLE "${table}" (${colDefs})`);
      const stmt = this.db.prepare(`INSERT INTO "${table}" VALUES (${sh.columns.map(() => '?').join(', ')})`);
      for (const r of sh.rows) {
        stmt.run(sh.columns.map((_, ci) => {
          let v = r[ci];
          if (v === undefined || v === '') return null;
          if (types[ci] !== 'TEXT' && v !== null) { const num = Number(v); if (!isNaN(num)) return num; }
          return v;
        }));
      }
      stmt.free();
      created++;
    }
    if (!created) throw new Error('No usable columns found in the file.');
    return created;
  }

  parseDelimited(text, delim) {
    const rows = [];
    let field = '', row = [], inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    const clean = rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
    if (!clean.length) throw new Error('Empty file.');
    return { columns: clean[0], rows: clean.slice(1) };
  }

  parseJsonRows(text) {
    let data = JSON.parse(text);
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object') { const arr = Object.values(data).find(v => Array.isArray(v)); data = arr || [data]; }
      else throw new Error('JSON must be an array of records.');
    }
    if (!data.length) throw new Error('JSON array is empty.');
    const columns = [];
    for (const rec of data) if (rec && typeof rec === 'object') for (const k of Object.keys(rec)) if (!columns.includes(k)) columns.push(k);
    if (!columns.length) throw new Error('JSON records have no fields.');
    const rows = data.map(rec => columns.map(c => {
      const v = rec ? rec[c] : null;
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    }));
    return { columns, rows };
  }

  parseXlsxSheets(buf) {
    if (!window.XLSX) throw new Error('Excel support is still loading — try again in a moment.');
    const wb = window.XLSX.read(new Uint8Array(buf), { type: 'array' });
    const sheets = [];
    for (const name of wb.SheetNames) {
      const aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: null });
      if (!aoa.length) continue;
      sheets.push({ name, columns: aoa[0].map((h, i) => (h == null || h === '') ? 'col' + i : h), rows: aoa.slice(1) });
    }
    if (!sheets.length) throw new Error('Workbook has no data.');
    return sheets;
  }

  async ingestFile(file) {
    const name = file.name || 'data';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['db', 'sqlite', 'sqlite3'].includes(ext)) {
      this.db = new this.SQL.Database(new Uint8Array(await file.arrayBuffer()));
    } else if (ext === 'sql') {
      this.db = new this.SQL.Database(); this.db.run(await file.text());
    } else if (ext === 'csv') {
      this.loadTablesInto([{ name, ...this.parseDelimited(await file.text(), ',') }]);
    } else if (ext === 'tsv') {
      this.loadTablesInto([{ name, ...this.parseDelimited(await file.text(), '\t') }]);
    } else if (ext === 'json') {
      this.loadTablesInto([{ name, ...this.parseJsonRows(await file.text()) }]);
    } else if (['xlsx', 'xls'].includes(ext)) {
      this.loadTablesInto(this.parseXlsxSheets(await file.arrayBuffer()));
    } else {
      throw new Error('Unsupported file type: .' + ext);
    }
  }
}
