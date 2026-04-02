import { useEffect, useRef } from 'react';
import { loadScriptsSequentially } from '../../utils/scriptLoader';
import type { TqlChartResponse } from '../../services/tqlApi';

declare const echarts: any;

interface ChartContainerProps {
  data: TqlChartResponse;
  parentRef?: React.RefObject<HTMLDivElement | null>;
}

export default function ChartContainer({ data, parentRef }: ChartContainerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;

    let cancelled = false;

    const render = async () => {
      // 1. Load common scripts (echarts etc)
      const jsAssets = data.jsAssets ?? [];
      await loadScriptsSequentially(jsAssets, []);

      if (cancelled || !wrapRef.current) return;

      // 2. Create or reuse DOM element
      const chartId = data.chartID ?? '';
      let dom = document.getElementById(chartId) as HTMLDivElement | null;

      if (!dom) {
        dom = document.createElement('div');
        dom.id = chartId;
        const w = parentRef?.current?.clientWidth ?? parseInt(data.style?.width || '600');
        const h = parentRef?.current?.clientHeight ?? parseInt(data.style?.height || '300');
        dom.style.width = `${w}px`;
        dom.style.height = `${h}px`;
        dom.style.backgroundColor = '#252525';
        wrapRef.current.innerHTML = '';
        wrapRef.current.appendChild(dom);
      }

      // 3. Init echarts + override theme
      if (typeof echarts !== 'undefined') {
        const existing = echarts.getInstanceByDom(dom);
        if (existing) existing.dispose();
        const instance = echarts.init(dom, data.theme || 'dark');
        instance.setOption({ backgroundColor: '#252525' });
      }

      // 4. Load code scripts (chart init + data fetch)
      const jsCodeAssets = data.jsCodeAssets ?? [];
      await loadScriptsSequentially([], jsCodeAssets);
    };

    render();

    return () => { cancelled = true; };
  }, [data]);

  // Resize on container change
  useEffect(() => {
    const el = parentRef?.current ?? wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (typeof echarts === 'undefined' || !data?.chartID) return;
      const dom = document.getElementById(data.chartID);
      if (!dom) return;
      const instance = echarts.getInstanceByDom(dom);
      if (instance) {
        dom.style.width = `${el.clientWidth}px`;
        dom.style.height = `${el.clientHeight}px`;
        instance.resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data?.chartID]);

  return (
    <>
      {data?.cssAssets?.map((href, i) => <link key={i} rel="stylesheet" href={href} />)}
      <div ref={wrapRef} />
    </>
  );
}
