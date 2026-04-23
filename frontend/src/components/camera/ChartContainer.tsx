import { useEffect, useRef } from 'react';
import { loadScriptsSequentially, prefixUrl } from '../../utils/scriptLoader';
import type { TqlChartResponse } from '../../services/tqlApi';

declare const echarts: any;

interface ChartContainerProps {
  data: TqlChartResponse;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  baseUrl?: string;
}

export default function ChartContainer({ data, parentRef, baseUrl }: ChartContainerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;

    let cancelled = false;

    const render = async () => {
      // 1. Load common scripts (echarts etc)
      const jsAssets = data.jsAssets ?? [];
      await loadScriptsSequentially(jsAssets, [], baseUrl);

      if (cancelled || !wrapRef.current) return;

      // 2. Recreate DOM element (dispose any previous echarts instance on the old node
      //    so the TQL init script below can init cleanly — echarts.init silently fails
      //    when an instance already exists on the DOM).
      const chartId = data.chartID ?? '';
      const oldDom = document.getElementById(chartId);
      if (oldDom && typeof echarts !== 'undefined') {
        echarts.getInstanceByDom(oldDom)?.dispose();
        oldDom.remove();
      }

      const dom = document.createElement('div');
      dom.id = chartId;
      const w = parentRef?.current?.clientWidth ?? parseInt(data.style?.width || '600');
      const h = parentRef?.current?.clientHeight ?? parseInt(data.style?.height || '300');
      dom.style.width = `${w}px`;
      dom.style.height = `${h}px`;
      dom.style.backgroundColor = '#252525';
      wrapRef.current.innerHTML = '';
      wrapRef.current.appendChild(dom);

      // 3. Load code scripts — TQL-generated jsCodeAssets handle echarts.init + setOption.
      const jsCodeAssets = data.jsCodeAssets ?? [];
      await loadScriptsSequentially([], jsCodeAssets, baseUrl);
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
      {data?.cssAssets?.map((href, i) => <link key={i} rel="stylesheet" href={prefixUrl(href, baseUrl)} />)}
      <div ref={wrapRef} />
    </>
  );
}
