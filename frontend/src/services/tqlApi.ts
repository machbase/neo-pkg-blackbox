export interface TqlChartResponse {
  chartID?: string;
  jsAssets?: string[];
  jsCodeAssets?: string[];
  cssAssets?: string[];
  style?: { width: string; height: string };
  theme?: string;
}

export async function postTql(baseUrl: string, tql: string): Promise<{ data: any; chartType: string | null }> {
  const res = await fetch(`${baseUrl}/db/tql`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: tql,
  });
  const chartType = res.headers.get('x-chart-type');
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { data, chartType };
}

export function isChartResponse(chartType: string | null): boolean {
  return chartType === 'echarts';
}

export function extractChartData(data: any): TqlChartResponse | null {
  if (!data) return null;
  if (!data.chartID && !data.jsAssets && !data.jsCodeAssets) return null;
  return data as TqlChartResponse;
}
