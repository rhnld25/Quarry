class QViz extends QData {
  addChart(spec) {
    const palette = ['#2f6bff', '#22c3a6', '#f2b84b', '#e5636f', '#9a7bff', '#4fc3e8', '#7fd66b', '#e58bd0'];
    const type = ['line', 'bar', 'pie', 'doughnut', 'scatter'].includes(spec.chart_type) ? spec.chart_type : 'bar';
    const isPie = type === 'pie' || type === 'doughnut';
    const datasets = (spec.datasets || []).map((d, i) => ({
      label: d.label || `Series ${i + 1}`,
      data: d.data || [],
      backgroundColor: isPie ? palette.slice(0, (spec.labels || []).length).map(c => c + 'D9') : palette[i % palette.length] + (type === 'bar' ? 'CC' : '33'),
      borderColor: palette[i % palette.length],
      borderWidth: 2,
      tension: 0.35,
      fill: type === 'line' ? false : undefined,
      pointRadius: type === 'scatter' ? 4 : 3,
    }));
    const config = {
      type,
      data: { labels: spec.labels || [], datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#c6cdd9', font: { family: "'IBM Plex Sans'", size: 11 } } } },
        scales: isPie ? {} : {
          x: { ticks: { color: '#8b93a3', font: { size: 10.5 } }, grid: { color: '#1e2431' } },
          y: { ticks: { color: '#8b93a3', font: { size: 10.5 } }, grid: { color: '#1e2431' } }
        }
      }
    };
    const id = this.nextChartId++;
    this.setState(s => ({ charts: [...s.charts, { id, title: spec.title || 'Chart', config }], tab: 'viz' }));
    return id;
  }

  chartDataUrl(ch) {
    // fresh offscreen render at 1280x720 (720p minimum), independent of on-screen canvas size
    try {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 360;
      const cfg = JSON.parse(JSON.stringify(ch.config));
      cfg.options = { ...cfg.options, responsive: false, animation: false, devicePixelRatio: 2 };
      const chart = new window.Chart(c.getContext('2d'), cfg);
      const out = document.createElement('canvas');
      out.width = 1280; out.height = 720;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#12151c';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.drawImage(chart.canvas, 0, 0, 1280, 720);
      const url = out.toDataURL('image/png');
      chart.destroy();
      return url;
    } catch (e) { return null; }
  }

  addNativeChart(pptx, slide, ch) {
    const d = ch.config.data;
    const type = ch.config.type;
    const palette = ['2F6BFF', '22C3A6', 'F2B84B', 'E5636F', '9A7BFF', '4FC3E8', '7FD66B', 'E58BD0'];
    const pos = { x: 0.5, y: 1.05, w: 9.0, h: 4.2 };
    if (type === 'pie' || type === 'doughnut') {
      const ds = d.datasets[0] || { data: [] };
      slide.addChart(type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.doughnut,
        [{ name: ch.title, labels: d.labels, values: ds.data }],
        { ...pos, chartColors: palette, showLegend: true, legendPos: 'r', legendColor: 'C6CDD9', legendFontSize: 12, showValue: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: 10 });
    } else {
      const data = d.datasets.map(ds => ({ name: ds.label, labels: d.labels, values: ds.data }));
      const ct = type === 'line' || type === 'scatter' ? pptx.ChartType.line : pptx.ChartType.bar;
      slide.addChart(ct, data, {
        ...pos,
        chartColors: palette.slice(0, Math.max(1, d.datasets.length)),
        barDir: 'col',
        lineSmooth: type === 'line',
        lineSize: 2.5,
        showLegend: d.datasets.length > 1, legendPos: 'b', legendColor: 'C6CDD9', legendFontSize: 12,
        catAxisLabelColor: 'C6CDD9', catAxisLabelFontSize: 10, catAxisLineColor: '3A4356',
        valAxisLabelColor: 'C6CDD9', valAxisLabelFontSize: 10, valAxisLineColor: '3A4356',
        valGridLine: { color: '2A3140', style: 'solid', size: 0.5 },
        catGridLine: { style: 'none' },
        plotArea: { fill: { color: '12151C' } },
      });
    }
  }

  download(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  slug(t) { return (t || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chart'; }

  exportPng(ch) {
    const url = this.chartDataUrl(ch);
    if (url) this.download(url, this.slug(ch.title) + '.png');
  }

  exportDoc(ch) {
    const url = this.chartDataUrl(ch);
    if (!url) return;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${ch.title}</title></head><body><h1 style="font-family:Calibri,sans-serif">${ch.title}</h1><p style="font-family:Calibri,sans-serif;color:#555">Exported from Quarry · ${new Date().toLocaleDateString()}</p><img src="${url}" width="640"></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    this.download(URL.createObjectURL(blob), this.slug(ch.title) + '.doc');
  }

  exportPpt(ch) { this.exportDeckOf([ch], this.slug(ch.title)); }

  exportDeck() { this.exportDeckOf(this.state.charts); }

  exportDeckOf(charts, name) {
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    charts.forEach(ch => {
      const slide = pptx.addSlide();
      slide.background = { color: '0E1117' };
      slide.addText(ch.title, { x: 0.4, y: 0.25, w: 9.2, h: 0.6, fontSize: 22, bold: true, color: 'E2E6EE', fontFace: 'Calibri' });
      try {
        this.addNativeChart(pptx, slide, ch); // real editable PowerPoint chart
      } catch (e) {
        const url = this.chartDataUrl(ch); // fallback: 720p image
        if (url) slide.addImage({ data: url, x: 0.6, y: 1.0, w: 8.8, h: 4.95 });
      }
    });
    pptx.writeFile({ fileName: (name || 'quarry-analysis') + '.pptx' });
  }

  // ---------- chat ----------
}
