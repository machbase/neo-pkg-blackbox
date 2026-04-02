import { useEffect, useRef, useState } from 'react';
import { postTql, isChartResponse, extractChartData, type TqlChartResponse } from '../../services/tqlApi';
import ChartContainer from './ChartContainer';
import type { CameraInfo, CameraEvent } from '../../types/server';

const SERIES_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

interface EventSyncChartProps {
  cameraId: string;
  event: CameraEvent;
  eventTimestamp: Date;
  currentTime?: Date | null;
  isPlaying?: boolean;
  cameraDetail: CameraInfo | null;
  rangeStart: Date;
  rangeEnd: Date;
  baseUrl: string;
}

function parseUsedCounts(snapshot?: string): Record<string, number> {
  if (!snapshot) return {};
  try {
    const parsed = JSON.parse(snapshot);
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<Record<string, number>>((acc, [k, v]) => {
        if (typeof v === 'number') acc[k] = v;
        return acc;
      }, {});
    }
  } catch { /* ignore */ }
  return {};
}

export default function EventSyncChart({
  cameraId,
  event,
  eventTimestamp,
  currentTime,
  isPlaying,
  cameraDetail,
  rangeStart,
  rangeEnd,
  baseUrl,
}: EventSyncChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartIdRef = useRef(`event-sync-${cameraId}-${Date.now()}`);
  const chartInstanceRef = useRef<any>(null);
  const markerInitRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<TqlChartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setChartData(null);

      try {
        if (!cameraDetail?.table || !event?.used_counts_snapshot) {
          setLoading(false);
          return;
        }

        const table = cameraDetail.table + '_LOG';
        const counts = parseUsedCounts(event.used_counts_snapshot);
        const detectObjects = Object.keys(counts);
        if (detectObjects.length === 0) { setLoading(false); return; }

        const startNs = (BigInt(rangeStart.getTime()) * 1000000n).toString();
        const endNs = (BigInt(rangeEnd.getTime()) * 1000000n).toString();

        const series = detectObjects.map((obj, idx) => ({
          name: obj,
          type: 'line',
          showSymbol: false,
          lineStyle: { width: 1.5 },
          itemStyle: { color: SERIES_COLORS[idx % SERIES_COLORS.length] },
          data: [] as number[][],
          ...(idx === 0 ? {
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
              data: [{ xAxis: eventTimestamp.getTime() }],
              label: { formatter: 'Event', fontSize: 10, color: '#ef4444' },
            },
          } : {}),
        }));

        const chartOption = {
          title: { text: 'Detection Count', textStyle: { color: '#fff', fontSize: 14 }, left: 'left', top: 0 },
          animation: false,
          backgroundColor: '#252525',
          grid: { left: 50, right: 20, top: 50, bottom: 50 },
          xAxis: {
            type: 'time',
            min: rangeStart.getTime(),
            max: rangeEnd.getTime(),
            axisTick: { alignWithLabel: true },
            axisLabel: { hideOverlap: true },
            axisLine: { onZero: false },
          },
          yAxis: {
            type: 'value',
            min: 0,
            axisLine: { onZero: false },
            boundaryGap: ['0%', '20%'],
          },
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(30,30,30,0.9)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#fff', fontSize: 11 },
          },
          legend: { show: true, textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 10 }, bottom: 0 },
          series,
        };

        const queryList = detectObjects.map((obj, idx) => ({
          query: `SQL("SELECT TO_TIMESTAMP(time)/1000000 as TIME, value FROM ${table} WHERE IDENT = '${obj.replace(/'/g, "''")}' AND CAMERA_ID='${cameraId}' AND time BETWEEN ${startNs} AND ${endNs}")\nJSON()`,
          idx,
          alias: obj,
        }));

        const chartJsCode = `{
    let sQuery = ${JSON.stringify(queryList)};
    let sCount = 0;
    function getData(aTql, aIdx) {
        fetch("/db/tql", {
            method: "POST",
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "text/plain"
            },
            body: aTql
        })
        .then(function(rsp) { return rsp.json(); })
        .then(function(obj) {
            if (!obj.success) return;
            _chartOption.series[aIdx].data = obj?.data?.rows ?? [];
            sCount++;
            if (sCount >= sQuery.length) _chart.setOption(_chartOption);
        })
        .catch(function(err) { console.warn("EventSyncChart fetch error", err); });
    }
    sQuery.forEach(function(aData, idx) {
        getData(aData.query, idx);
    });
}`;

        const width = containerRef.current?.clientWidth || 600;
        const height = containerRef.current?.clientHeight || 300;

        const tql = `FAKE(linspace(0,0,0))
CHART(
    chartID('${chartIdRef.current}'),
    theme('dark'),
    size('${width}px','${height}px'),
    chartOption(${JSON.stringify(chartOption)}),
    chartJSCode(${chartJsCode})
)`;

        const { data, chartType } = await postTql('', tql);
        if (cancelled) return;

        if (isChartResponse(chartType)) {
          const parsed = extractChartData(data);
          if (parsed) {
            setChartData(parsed);
          } else {
            setError('Invalid chart response');
          }
        } else {
          setError('Server did not return chart data');
        }
      } catch {
        if (!cancelled) setError('Failed to load detection data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [cameraId, eventTimestamp.getTime(), rangeStart.getTime(), rangeEnd.getTime(), cameraDetail, baseUrl]);

  // Find echarts instance after ChartContainer renders
  useEffect(() => {
    if (!chartData) { chartInstanceRef.current = null; return; }
    const find = () => {
      if (typeof echarts === 'undefined') return false;
      const dom = document.getElementById(chartIdRef.current);
      if (!dom) return false;
      const inst = echarts.getInstanceByDom(dom);
      if (!inst) return false;
      chartInstanceRef.current = inst;
      markerInitRef.current = false;
      return true;
    };
    if (find()) return;
    const iv = setInterval(() => { if (find()) clearInterval(iv); }, 200);
    return () => clearInterval(iv);
  }, [chartData]);

  // Update current time marker (orange dashed line)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !currentTime || !chartData) return;

    const update = () => {
      try {
        const grid = chart.getModel().getComponent('grid');
        if (!grid?.coordinateSystem) return;
        const rect = grid.coordinateSystem.getRect();
        const xPx = chart.convertToPixel({ gridIndex: 0 }, [currentTime.getTime(), 0])[0];
        if (isNaN(xPx)) return;
        const shape = { x1: xPx, y1: rect.y, x2: xPx, y2: rect.y + rect.height };
        if (!markerInitRef.current) {
          chart.setOption({ graphic: [{ id: 'current-time-marker', type: 'line', z: 100, shape, style: { stroke: '#f97316', lineWidth: 1, lineDash: [5] } }] });
          markerInitRef.current = true;
        } else {
          chart.setOption({ graphic: [{ id: 'current-time-marker', shape }] }, { replaceMerge: [] });
        }
      } catch {}
    };

    if (!isPlaying) { update(); return; }
    const tid = setTimeout(update, 200);
    return () => clearTimeout(tid);
  }, [currentTime, chartData, isPlaying]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Loading detection data...</span>
        </div>
      )}
      {!loading && !chartData && !error && (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No detection data available</span>
        </div>
      )}
      {error && (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>
        </div>
      )}
      {chartData && <ChartContainer data={chartData} parentRef={containerRef} />}
    </div>
  );
}
