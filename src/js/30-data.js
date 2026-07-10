class QData extends QIngest {
  async initDb() {
    try {
      this.SQL = await window.initSqlJs({
        locateFile: f => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/' + f
      });
      this.loadSample();
    } catch (e) {
      this.setState({ dbName: 'Engine failed to load' });
    }
  }

  async loadSample() {
    try {
      const r = await fetch('data/sample_ecommerce.sql');
      if (!r.ok) throw new Error('not found');
      const sql = await r.text();
      this.db = new this.SQL.Database();
      this.db.run(sql);
      this.setState({ ready: true, dbName: 'sample_ecommerce.sql', tableView: null, charts: [], messages: [], transforms: [] });
      this.refreshSchema();
    } catch (e) {
      this.setState({ dbName: 'No database — open a .sqlite file' });
    }
  }

  refreshSchema() {
    const res = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const names = res.length ? res[0].values.map(v => v[0]) : [];
    const tables = names.map(name => {
      const info = this.db.exec(`PRAGMA table_info("${name}")`);
      const columns = info.length ? info[0].values.map(v => ({ name: v[1], type: v[2] || '?' })) : [];
      let rowCount = 0;
      try { rowCount = this.db.exec(`SELECT COUNT(*) FROM "${name}"`)[0].values[0][0]; } catch (e) {}
      return { name, columns, rowCount };
    });
    this.setState({ tables });
  }

  runQuery(q) {
    const t0 = performance.now();
    const res = this.db.exec(q);
    const ms = Math.max(1, Math.round(performance.now() - t0));
    if (!res.length) return { columns: [], rows: [], ms };
    return { columns: res[0].columns, rows: res[0].values, ms };
  }

  schemaText() {
    return this.state.tables.map(t =>
      `${t.name} (${t.rowCount} rows): ${t.columns.map(c => c.name + ' ' + c.type).join(', ')}`
    ).join('\n');
  }

  viewTable(name) {
    try {
      const r = this.runQuery(`SELECT * FROM "${name}" LIMIT 200`);
      const total = this.state.tables.find(t => t.name === name);
      this.setState({
        tab: 'data',
        tableView: {
          title: name,
          columns: r.columns,
          rows: r.rows,
          meta: `${r.rows.length}${total && total.rowCount > r.rows.length ? ' of ' + total.rowCount : ''} rows`
        }
      });
    } catch (e) {}
  }

  showQueryResult(q, title) {
    const r = this.runQuery(q);
    this.setState({
      tab: 'data',
      tableView: { title: title || 'Query result', columns: r.columns, rows: r.rows.slice(0, 500), meta: `${Math.min(r.rows.length, 500)} rows · ${r.ms}ms` }
    });
    return r;
  }
}
