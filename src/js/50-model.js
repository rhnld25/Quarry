class QModel extends QViz {
  send(text) {
    const q = (text || '').trim();
    if (!q || this.state.pending || !this.state.ready) return;
    const gate = this.licenseAllows();
    if (!gate.ok) {
      this.setState(s => ({ input: '', messages: [...s.messages, { role: 'user', text: q, sqlBlocks: [] }, { role: 'assistant', text: gate.reason, sqlBlocks: [], thinking: false }] }));
      return;
    }
    this.recordAnalysis();
    this.setState(s => ({
      input: '',
      pending: true,
      messages: [...s.messages, { role: 'user', text: q, sqlBlocks: [] }, { role: 'assistant', text: '', sqlBlocks: [], thinking: true }]
    }), () => this.runTurn());
  }

  appendSqlBlock(block) {
    this.setState(s => {
      const msgs = s.messages.slice();
      const last = { ...msgs[msgs.length - 1] };
      last.sqlBlocks = [...last.sqlBlocks, block];
      msgs[msgs.length - 1] = last;
      return { messages: msgs };
    });
  }

  async runTurn() {
    const history = this.state.messages
      .filter(m => m.text && !m.thinking)
      .map(m => ({ role: m.role, content: m.text }));

    const tools = [
      {
        name: 'run_sql',
        description: 'Run a read-only SQLite query against the database and get results back as JSON. Use for analysis. Results are truncated to 50 rows.',
        input_schema: { type: 'object', properties: { query: { type: 'string', description: 'SQLite SELECT query' } }, required: ['query'] },
        run: async (input) => {
          try {
            const r = this.runQuery(input.query);
            this.appendSqlBlock({ query: input.query, meta: `${r.rows.length} rows · ${r.ms}ms`, error: false });
            const rows = r.rows.slice(0, 50).map(row => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));
            return JSON.stringify({ row_count: r.rows.length, rows });
          } catch (e) {
            this.appendSqlBlock({ query: input.query, meta: 'error', error: true });
            throw new Error('SQL error: ' + e.message);
          }
        }
      },
      {
        name: 'show_table',
        description: 'Run a query and display its full results as a table in the user-facing data panel. Use when the user should see the rows themselves.',
        input_schema: { type: 'object', properties: { query: { type: 'string' }, title: { type: 'string', description: 'Short human title for the result set' } }, required: ['query', 'title'] },
        run: async (input) => {
          try {
            const r = this.showQueryResult(input.query, input.title);
            this.appendSqlBlock({ query: input.query, meta: `${r.rows.length} rows · shown`, error: false });
            return `Displayed ${r.rows.length} rows in the data panel.`;
          } catch (e) {
            this.appendSqlBlock({ query: input.query, meta: 'error', error: true });
            throw new Error('SQL error: ' + e.message);
          }
        }
      },
      {
        name: 'show_transformation',
        description: 'Log an auditable data transformation in the Transform panel: the relevant source rows/columns side by side with the aggregated result, so the user can verify the computation. Call this whenever your answer relies on an aggregation (SUM, COUNT, AVG, GROUP BY, joins that reduce rows).',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title, e.g. "Revenue by category"' },
            description: { type: 'string', description: 'One sentence: what was computed and how, e.g. "Summed quantity × unit_price per category over completed orders"' },
            operation: { type: 'string', description: 'Short op tag, e.g. SUM · GROUP BY category' },
            source_query: { type: 'string', description: 'Query selecting ONLY the relevant raw columns feeding the aggregation (the rows being summed/counted)' },
            result_query: { type: 'string', description: 'The aggregation query producing the final result' },
            highlight_columns: { type: 'array', items: { type: 'string' }, description: 'Source column names being aggregated (highlighted for the user)' }
          },
          required: ['title', 'description', 'operation', 'source_query', 'result_query']
        },
        run: async (input) => {
          try {
            const src = this.runQuery(input.source_query);
            const res = this.runQuery(input.result_query);
            this.appendSqlBlock({ query: input.result_query, meta: `${res.rows.length} rows · audit logged`, error: false });
            this.setState(s => ({
              tab: 'trans',
              transforms: [{
                id: Date.now() + Math.random(),
                title: input.title, desc: input.description, op: input.operation || 'TRANSFORM',
                highlightCols: input.highlight_columns || [],
                source: { columns: src.columns, rows: src.rows.slice(0, 40), total: src.rows.length },
                result: { columns: res.columns, rows: res.rows.slice(0, 60), total: res.rows.length },
              }, ...s.transforms]
            }));
            return `Transformation logged in the Transform panel (${src.rows.length} source rows → ${res.rows.length} result rows).`;
          } catch (e) {
            throw new Error('SQL error: ' + e.message);
          }
        }
      },
      {
        name: 'export_charts',
        description: 'Export existing charts from the visualizations panel as a downloaded file. format: pptx (PowerPoint, one slide per chart), png (image, single chart only), or doc (Word document, single chart only). Omit chart_titles to export all charts. Charts must already exist — create them with create_chart first.',
        input_schema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['pptx', 'png', 'doc'] },
            chart_titles: { type: 'array', items: { type: 'string' }, description: 'Titles of charts to export. Omit for all.' }
          },
          required: ['format']
        },
        run: async (input) => {
          const all = this.state.charts;
          if (!all.length) throw new Error('No charts exist yet. Create one with create_chart first.');
          let selected = all;
          if (input.chart_titles && input.chart_titles.length) {
            selected = all.filter(c => input.chart_titles.some(t => c.title.toLowerCase().includes(t.toLowerCase())));
            if (!selected.length) throw new Error('No charts matched those titles. Existing charts: ' + all.map(c => c.title).join(' | '));
          }
          this.setState({ tab: 'viz' });
          await new Promise(r => setTimeout(r, 400)); // let canvases mount if tab just switched
          if (input.format === 'pptx') {
            this.exportDeckOf(selected);
            return `Exported ${selected.length} chart(s) to PowerPoint: ` + selected.map(c => c.title).join(' | ');
          }
          if (input.format === 'png') { this.exportPng(selected[0]); return `Exported "${selected[0].title}" as PNG.`; }
          this.exportDoc(selected[0]);
          return `Exported "${selected[0].title}" as Word document.`;
        }
      },
      {
        name: 'create_chart',
        description: 'Render a chart in the visualizations panel. Provide labels and one or more datasets of numbers aligned to the labels.',
        input_schema: {
          type: 'object',
          properties: {
            chart_type: { type: 'string', enum: ['line', 'bar', 'pie', 'doughnut', 'scatter'] },
            title: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
            datasets: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, data: { type: 'array', items: { type: 'number' } } }, required: ['label', 'data'] } }
          },
          required: ['chart_type', 'title', 'labels', 'datasets']
        },
        run: async (input) => {
          this.addChart(input);
          return 'Chart created and shown in the visualizations panel.';
        }
      }
    ];

    const system = `You are Quarry, a data analyst assistant embedded in a SQL analytics tool. You have tools to query a SQLite database, display result tables to the user, and render charts.

Database schema:
${this.schemaText()}

Rules:
- Use run_sql to investigate before answering. SQLite dialect. Use strftime('%Y-%m', order_date) for monthly grouping.
- When the user asks to SEE data, call show_table so it appears in their data panel.
- When a visualization helps or is requested, call create_chart with real numbers you queried.
- When the user asks to export/download charts (to PowerPoint, image, or Word), call export_charts. If the chart doesn't exist yet, create it first, then export.
- Whenever your answer relies on an aggregation (SUM, COUNT, AVG, GROUP BY), ALSO call show_transformation so the user can audit the computation: source_query selects only the relevant raw columns (limit ~40 rows is fine), result_query is the aggregation itself.
- Final answers: concise plain text, no markdown formatting, no code blocks. Mention concrete numbers.
- If a request is ambiguous, make a reasonable assumption and state it briefly.`;

    let text;
    const sel = this.state.model ?? this.props.model ?? 'claude-sonnet-5';
    const custom = this.state.customModels.find(m => m.id === sel);
    try {
      if (custom) {
        text = await this.runCustomTurn(custom, system, history, tools);
      } else {
        text = await window.claude.complete({
          model: sel,
          max_tokens: 4000,
          system,
          messages: history,
          tools
        });
      }
    } catch (e) {
      text = 'Something went wrong talking to the model: ' + (e && e.message ? e.message : e) + '. Please try again.';
      this.refundAnalysis(); // failed analysis doesn't consume a credit
    }
    this.setState(s => {
      const msgs = s.messages.slice();
      const last = { ...msgs[msgs.length - 1] };
      last.text = (text || '').trim() || 'Done — see the panel on the right.';
      last.thinking = false;
      msgs[msgs.length - 1] = last;
      return { messages: msgs, pending: false };
    });
  }

  // ---------- external models ----------

  saveCustomModels(list) {
    this.setState({ customModels: list });
    try { localStorage.setItem('quarry_custom_models', JSON.stringify(list)); } catch (e) {}
  }

  async runCustomTurn(cm, system, messages, tools) {
    if (cm.provider === 'anthropic') return this.runAnthropicApi(cm, system, messages, tools);
    return this.runOpenAiApi(cm, system, messages, tools);
  }

  async runOpenAiApi(cm, system, messages, tools) {
    const msgs = [{ role: 'system', content: system }, ...messages];
    const fnTools = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    for (let i = 0; i < 8; i++) {
      const r = await fetch(cm.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cm.apiKey },
        body: JSON.stringify({ model: cm.model, messages: msgs, tools: fnTools, max_tokens: 4000 })
      });
      if (!r.ok) throw new Error(cm.label + ' API error ' + r.status + ': ' + (await r.text()).slice(0, 300));
      const j = await r.json();
      const m = j.choices && j.choices[0] && j.choices[0].message;
      if (!m) throw new Error('Unexpected API response shape.');
      msgs.push(m);
      if (m.tool_calls && m.tool_calls.length) {
        for (const tc of m.tool_calls) {
          const tool = tools.find(t => t.name === tc.function.name);
          let out;
          try {
            out = tool ? await tool.run(JSON.parse(tc.function.arguments || '{}')) : 'Unknown tool';
          } catch (e) { out = 'Error: ' + e.message; }
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: String(out) });
        }
      } else {
        return m.content || '';
      }
    }
    return 'Stopped after 8 tool iterations.';
  }

  async runAnthropicApi(cm, system, messages, tools) {
    const msgs = messages.map(m => ({ role: m.role, content: m.content }));
    const apiTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
    for (let i = 0; i < 8; i++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cm.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: cm.model, system, messages: msgs, tools: apiTools, max_tokens: 4000 })
      });
      if (!r.ok) throw new Error(cm.label + ' API error ' + r.status + ': ' + (await r.text()).slice(0, 300));
      const j = await r.json();
      msgs.push({ role: 'assistant', content: j.content });
      if (j.stop_reason === 'tool_use') {
        const results = [];
        for (const b of j.content.filter(b => b.type === 'tool_use')) {
          const tool = tools.find(t => t.name === b.name);
          let out, isErr = false;
          try {
            out = tool ? await tool.run(b.input) : 'Unknown tool';
          } catch (e) { out = 'Error: ' + e.message; isErr = true; }
          results.push({ type: 'tool_result', tool_use_id: b.id, content: String(out), is_error: isErr });
        }
        msgs.push({ role: 'user', content: results });
      } else {
        return j.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      }
    }
    return 'Stopped after 8 tool iterations.';
  }

  // ---------- render ----------
}
