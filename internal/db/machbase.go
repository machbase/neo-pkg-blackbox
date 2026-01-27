package db

import (
	"blackbox-backend/internal/config"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type Machbase struct {
	baseURL string
	client  *http.Client
}

func NewMachbase(cfg config.MachbaseConfig) (*Machbase, error) {
	return &Machbase{
		client: &http.Client{},
	}, nil
}

func (m *Machbase) Start() {

}

type machbaseQueryResponse struct {
	Success bool              `json:"success"`
	Reason  string            `json:"reason"`
	Data    machbaseQueryData `json:"data"`
}

type machbaseQueryData struct {
	Columns []string        `json:"columns"`
	Types   []string        `json:"types"`
	Rows    json.RawMessage `json:"rows"`
}

func (m *Machbase) queryRawJSON(ctx context.Context, q string) (*machbaseQueryResponse, error) {
	u, err := url.Parse(strings.TrimRight(m.baseURL, "/") + "/db/query")
	if err != nil {
		return nil, err
	}

	vals := url.Values{}
	vals.Set("q", q)
	vals.Set("rowsArray", "true")
	u.RawQuery = vals.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get request: %v", err)
	}

	req.Header.Set("Accept", "application/json")
	return m.do(req)
}

type machbaseWriteRequest struct {
	Data machbaseWriteData `json:"data"`
}

type machbaseWriteData struct {
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

type machbaseWriteResponse struct {
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
}

type WriteOptions struct {
	Timeformat string
	TZ         string
	Method     string
}

func (o WriteOptions) withDefaults() WriteOptions {
	if o.Timeformat == "" {
		o.Timeformat = "ns"
	}
	if o.TZ == "" {
		o.TZ = "UTC"
	}
	if o.Method == "" {
		o.Method = "insert"
	}
	return o
}

func (m *Machbase) writeRows(ctx context.Context, table string, columns []string, rows [][]any, opt WriteOptions) (*machbaseQueryResponse, error) {
	if table == "" {
		return nil, fmt.Errorf("table is empty")
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("columns is empty")
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("rows is empty")
	}
	for i := range rows {
		if len(rows[i]) != len(columns) {
			return nil, fmt.Errorf("row[%d] length mismatch got=%d want=%d", i, len(rows[i]), len(columns))
		}
	}

	opt = opt.withDefaults()

	base, err := url.Parse(strings.TrimRight(m.baseURL, "/"))
	if err != nil {
		return nil, fmt.Errorf("invalid baseURL: %v", err)
	}
	base.Path = base.Path + "/db/write/" + url.PathEscape(table)

	q := base.Query()
	q.Set("timeformat", opt.Timeformat)
	q.Set("tz", opt.TZ)
	q.Set("method", opt.Method)
	base.RawQuery = q.Encode()

	payload := machbaseWriteRequest{
		Data: machbaseWriteData{
			Columns: columns,
			Rows:    rows,
		},
	}

	bdata, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("json marshal: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base.String(), bytes.NewReader(bdata))
	if err != nil {
		return nil, fmt.Errorf("failed to post request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return m.do(req)
}

const maxBytes int64 = 8 << 20 // 8 MiB

func (m *Machbase) do(req *http.Request) (*machbaseQueryResponse, error) {
	rsp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request do: %v", err)
	}
	defer rsp.Body.Close()

	if rsp.StatusCode < 200 || rsp.StatusCode >= 300 {
		lr := io.LimitReader(rsp.Body, 2048)
		bdata, _ := io.ReadAll(lr)
		return nil, fmt.Errorf("http %d: %s", rsp.StatusCode, string(bdata))
	}

	lr := io.LimitReader(rsp.Body, maxBytes+1)
	bdata, err := io.ReadAll(lr)
	if err != nil {
		return nil, fmt.Errorf("read body: %v", err)
	}
	if int64(len(bdata)) > maxBytes {
		return nil, fmt.Errorf("response too large:  limit=%d bytes", maxBytes)
	}

	var out machbaseQueryResponse
	if err := json.Unmarshal(bdata, &out); err != nil {
		snippet := string(bdata)
		if len(snippet) > 2048 {
			snippet = snippet[:2048]
		}
		return nil, fmt.Errorf("unmarshal failed: %v; body=%q", err, snippet)
	}
	if !out.Success {
		return nil, fmt.Errorf("machbase query failed: %s", out.Reason)
	}

	return &out, nil
}
