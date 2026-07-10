const QUARRY_LICENSE_PUBKEY = 'BC+d0NOpZv3ZRBR+sl+IV1c3fptXuZJXEYC6uWVmiuKbVBs8Md58z45uY13SY6up7sWbSYrsoaloyfkKTWkuypM=';
const QUARRY_LICENSE_REQUIRED = false; // true = block analyses without a valid license (production); false = trial/dev

class QBase extends DCLogic {
  state = {
    ready: false,
    dbName: 'Loading…',
    tables: [],
    expanded: {},
    messages: [], // {role, text, sqlBlocks:[{query, meta, error}], thinking}
    sqlOpen: {},
    pending: false,
    input: '',
    tab: 'data',
    tableView: null, // {title, columns, rows, meta}
    charts: [], // {id, title, config}
    model: null, // null -> use prop default
    customModels: [], // {id, label, provider, baseUrl, model, apiKey}
    modalOpen: false,
    mProvider: 'openai', mBaseUrl: 'https://api.openai.com/v1', mModel: '', mApiKey: '', mError: null,
    transforms: [], // {id, title, desc, op, highlightCols, source:{columns,rows,total}, result:{columns,rows,total}}
    license: { status: 'checking', clientId: '', plan: '', quota: 0, period: '', used: 0, expiresAt: '', features: [], reason: '', unlimited: false },
  };

  chartRegistry = {};
  nextChartId = 1;

  componentDidMount() {
    this.fileInputRef = null;
    this.msgsEl = null;
    try {
      const saved = JSON.parse(localStorage.getItem('quarry_custom_models') || '[]');
      if (Array.isArray(saved)) this.setState({ customModels: saved });
    } catch (e) {}
    this.loadLicense();
    const wait = () => {
      if (window.initSqlJs && window.Chart && window.PptxGenJS) this.initDb();
      else setTimeout(wait, 120);
    };
    wait();
  }

  componentDidUpdate() {
    if (this.msgsEl) this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
  }
}
