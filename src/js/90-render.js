class Component extends QModel {
  renderVals() {
    const s = this.state;
    const defaultSqlOpen = this.props.sqlExpandedByDefault ?? false;

    const tables = s.tables.map(t => ({
      name: t.name,
      rowCount: String(t.rowCount),
      columns: t.columns,
      expanded: !!s.expanded[t.name],
      arrowRot: s.expanded[t.name] ? 'rotate(90deg)' : 'rotate(0deg)',
      onToggle: () => this.setState(st => ({ expanded: { ...st.expanded, [t.name]: !st.expanded[t.name] } })),
      onView: () => this.viewTable(t.name),
    }));

    const messages = s.messages.map((m, mi) => {
      const isUser = m.role === 'user';
      return {
        roleLabel: isUser ? 'YOU' : 'ANALYST',
        align: isUser ? 'flex-end' : 'flex-start',
        bg: isUser ? '#1d2b4a' : '#141922',
        border: isUser ? '#2a3d68' : '#232a38',
        color: '#e2e6ee',
        hasText: !!m.text,
        text: m.text,
        thinking: !!m.thinking,
        sqlBlocks: (m.sqlBlocks || []).map((b, bi) => {
          const key = mi + '-' + bi;
          const open = s.sqlOpen[key] ?? defaultSqlOpen;
          return {
            query: b.query,
            preview: b.query.replace(/\s+/g, ' ').slice(0, 60),
            meta: b.meta,
            metaColor: b.error ? '#e5636f' : '#6b7484',
            open,
            arrowRot: open ? 'rotate(90deg)' : 'rotate(0deg)',
            onToggle: () => this.setState(st => ({ sqlOpen: { ...st.sqlOpen, [key]: !open } })),
          };
        }),
      };
    });

    const compact = this.props.compactRows ?? false;
    const tv = s.tableView;
    const tableRows = tv ? tv.rows.map(r => ({
      cells: r.map(c => c === null ? 'NULL' : String(c))
    })) : [];

    const charts = s.charts.map(ch => ({
      id: ch.id,
      title: ch.title,
      refCb: (el) => {
        if (el && !this.chartRegistry[ch.id]) {
          this.chartRegistry[ch.id] = { canvas: el, chart: new window.Chart(el, ch.config) };
        }
      },
      exportPng: () => this.exportPng(ch),
      exportDoc: () => this.exportDoc(ch),
      exportPpt: () => this.exportPpt(ch),
      remove: () => {
        const e = this.chartRegistry[ch.id];
        if (e) { try { e.chart.destroy(); } catch (er) {} delete this.chartRegistry[ch.id]; }
        this.setState(st => ({ charts: st.charts.filter(c => c.id !== ch.id) }));
      },
    }));

    const transforms = s.transforms.map(t => {
      const hl = new Set((t.highlightCols || []).map(c => c.toLowerCase()));
      const isHl = (name) => hl.has(String(name).toLowerCase());
      return {
        title: t.title, desc: t.desc, op: t.op,
        sourceMeta: `${t.source.rows.length}${t.source.total > t.source.rows.length ? ' of ' + t.source.total : ''} rows`,
        resultMeta: `${t.result.rows.length}${t.result.total > t.result.rows.length ? ' of ' + t.result.total : ''} rows`,
        sourceCols: t.source.columns.map(c => ({
          name: c,
          hbg: isHl(c) ? '#1a2440' : '#161b25',
          hcolor: isHl(c) ? '#7ea0ff' : '#8ea4d6',
        })),
        sourceRows: t.source.rows.map(r => ({
          cells: r.map((v, i) => ({
            v: v === null ? 'NULL' : String(v),
            bg: isHl(t.source.columns[i]) ? 'rgba(47,107,255,0.10)' : 'transparent',
          }))
        })),
        resultCols: t.result.columns,
        resultRows: t.result.rows.map(r => ({ cells: r.map(v => v === null ? 'NULL' : String(v)) })),
      };
    });

    const modelId = this.props.model ?? 'claude-sonnet-5';

    return {
      dbName: s.dbName,
      dbDotColor: s.ready ? '#22c3a6' : '#f2b84b',
      statusLabel: s.pending ? 'analyzing…' : (s.ready ? 'ready' : 'loading engine…'),
      modelVal: s.model ?? modelId,
      modelSelWidth: (() => {
        const cur = s.model ?? modelId;
        const cm = s.customModels.find(m => m.id === cur);
        const label = cm ? cm.label : (cur.includes('haiku') ? 'haiku · fast' : 'sonnet · smart');
        return Math.min(170, Math.round(label.length * 6.7) + 20) + 'px';
      })(),
      onModelChange: (e) => {
        const v = e.target.value;
        if (v === '__add') { this.setState({ modalOpen: true, mError: null }); return; }
        this.setState({ model: v });
      },
      customModelOpts: s.customModels.map(cm => ({
        id: cm.id,
        label: cm.label,
        onRemove: () => {
          const list = s.customModels.filter(m => m.id !== cm.id);
          this.saveCustomModels(list);
          if (this.state.model === cm.id) this.setState({ model: null });
        },
      })),
      hasCustomModels: s.customModels.length > 0,
      // connect-model modal
      openModal: () => this.setState({ modalOpen: true, mError: null }),
      modalOpen: s.modalOpen,
      mProvider: s.mProvider,
      onMProvider: (e) => this.setState({ mProvider: e.target.value }),
      mShowBaseUrl: s.mProvider === 'openai',
      mBaseUrl: s.mBaseUrl,
      onMBaseUrl: (e) => this.setState({ mBaseUrl: e.target.value }),
      mModel: s.mModel,
      mModelPlaceholder: s.mProvider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o',
      onMModel: (e) => this.setState({ mModel: e.target.value }),
      mApiKey: s.mApiKey,
      onMApiKey: (e) => this.setState({ mApiKey: e.target.value }),
      mError: s.mError,
      mCancel: () => this.setState({ modalOpen: false, mError: null }),
      mSave: () => {
        const { mProvider, mBaseUrl, mModel, mApiKey } = this.state;
        if (!mModel.trim()) { this.setState({ mError: 'Model ID is required.' }); return; }
        if (!mApiKey.trim()) { this.setState({ mError: 'API key is required.' }); return; }
        if (mProvider === 'openai' && !/^https?:\/\//.test(mBaseUrl.trim())) { this.setState({ mError: 'Base URL must start with http(s)://' }); return; }
        const id = 'custom-' + Date.now();
        const cm = {
          id,
          label: mModel.trim(),
          provider: mProvider,
          baseUrl: mBaseUrl.trim(),
          model: mModel.trim(),
          apiKey: mApiKey.trim(),
        };
        this.saveCustomModels([...this.state.customModels, cm]);
        this.setState({ modalOpen: false, model: id, mModel: '', mApiKey: '', mError: null });
      },
      tables,
      messages,
      showIntro: s.messages.length === 0,
      inputVal: s.input,
      onInput: (e) => this.setState({ input: e.target.value }),
      onKeyDown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(this.state.input); }
      },
      onSend: () => this.send(this.state.input),
      sendDisabled: s.pending || !s.ready,
      sendOpacity: (s.pending || !s.ready) ? '0.45' : '1',
      sugg1: () => this.send("Give me an overview of what's in this database"),
      sugg2: () => this.send('Who are the top 10 customers by revenue?'),
      sugg3: () => this.send('Chart monthly revenue as a line chart'),
      msgsRef: (el) => { this.msgsEl = el; },
      fileInputRef: (el) => { this.fileInput = el; },
      openDbClick: () => { if (this.fileInput) this.fileInput.click(); },
      licenseLabel: this.licenseLabelText(),
      usageLabel: this.usageLabelText(),
      usageColor: this.usageColor(),
      onFileChosen: async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !this.SQL) return;
        try {
          await this.ingestFile(file);
          Object.values(this.chartRegistry).forEach(c => { try { c.chart.destroy(); } catch (er) {} });
          this.chartRegistry = {};
          this.setState({ dbName: file.name, tableView: null, charts: [], messages: [], transforms: [], expanded: {} });
          this.refreshSchema();
        } catch (err) {
          this.setState({ dbName: (err && err.message) ? ('Could not open: ' + err.message) : 'Could not open file' });
        }
        e.target.value = '';
      },

      // tabs
      tabData: () => this.setState({ tab: 'data' }),
      tabViz: () => this.setState({ tab: 'viz' }),
      showDataTab: s.tab === 'data',
      showVizTab: s.tab === 'viz',
      dataTabBorder: s.tab === 'data' ? '#2f6bff' : 'transparent',
      dataTabColor: s.tab === 'data' ? '#e2e6ee' : '#6b7484',
      vizTabBorder: s.tab === 'viz' ? '#2f6bff' : 'transparent',
      vizTabColor: s.tab === 'viz' ? '#e2e6ee' : '#6b7484',
      chartCount: String(s.charts.length),
      tabTrans: () => this.setState({ tab: 'trans' }),
      showTransTab: s.tab === 'trans',
      transTabBorder: s.tab === 'trans' ? '#2f6bff' : 'transparent',
      transTabColor: s.tab === 'trans' ? '#e2e6ee' : '#6b7484',
      transCount: String(s.transforms.length),
      transforms,
      hasTransforms: s.transforms.length > 0,
      noTransforms: s.transforms.length === 0,
      // data tab
      hasTableView: !!tv,
      noTableView: !tv,
      tableTitle: tv ? tv.title : '',
      tableMeta: tv ? tv.meta : '',
      tableCols: tv ? tv.columns : [],
      tableRows,
      // viz tab
      charts,
      hasCharts: s.charts.length > 0,
      noCharts: s.charts.length === 0,
      exportDeck: () => this.exportDeck(),
    };
  }
}
