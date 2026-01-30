package db

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"blackbox-backend/internal/config"
)

// Machbase is a client for Machbase HTTP API.
type Machbase struct {
	baseURL *url.URL
	client  *http.Client
}

// NewMachbase creates a new Machbase client.
func NewMachbase(cfg config.MachbaseConfig) (*Machbase, error) {
	cfg.ApplyDefaults()

	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	u, err := url.Parse(fmt.Sprintf("%s://%s:%d", cfg.Scheme, cfg.Host, cfg.Port))
	if err != nil {
		return nil, fmt.Errorf("invalid machbase config: %w", err)
	}

	return &Machbase{
		baseURL: u,
		client:  &http.Client{Timeout: timeout},
	}, nil
}

// Start initializes the Machbase client.
func (m *Machbase) Start() {}

// QueryResponse is the response from Machbase query API.
type QueryResponse struct {
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
	Data    struct {
		Columns []string        `json:"columns"`
		Types   []string        `json:"types"`
		Rows    json.RawMessage `json:"rows"`
	} `json:"data"`
}

func (m *Machbase) Query(ctx context.Context, sql string) (*QueryResponse, error) {
	u := m.baseURL.JoinPath("db", "query")

	q := u.Query()
	q.Set("q", sql)
	q.Set("rowsArray", "true")
	u.RawQuery = q.Encode()

	log.Printf("Machbase SQL: %s", sql)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	return m.do(req)
}

type writeRequest struct {
	Data struct {
		Columns []string `json:"columns"`
		Rows    [][]any  `json:"rows"`
	} `json:"data"`
}

// WriteOption configures write behavior.
type WriteOption func(*writeConfig)

type writeConfig struct {
	timeformat string
	tz         string
	method     string
}

// WriteRows writes rows to a table.
func (m *Machbase) WriteRows(ctx context.Context, table string, columns []string, rows [][]any, opts ...WriteOption) error {
	cfg := &writeConfig{
		timeformat: "ns",
		tz:         "UTC",
		method:     "insert",
	}
	for _, opt := range opts {
		opt(cfg)
	}

	if table == "" {
		return fmt.Errorf("table is empty")
	}
	if len(columns) == 0 {
		return fmt.Errorf("columns is empty")
	}
	if len(rows) == 0 {
		return fmt.Errorf("rows is empty")
	}

	u := m.baseURL.JoinPath("db", "write", table)

	q := u.Query()
	q.Set("timeformat", cfg.timeformat)
	q.Set("tz", cfg.tz)
	q.Set("method", cfg.method)
	u.RawQuery = q.Encode()

	var payload writeRequest
	payload.Data.Columns = columns
	payload.Data.Rows = rows

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	_, err = m.do(req)
	return err
}

const maxResponseBytes int64 = 8 << 20 // 8 MiB

func (m *Machbase) do(req *http.Request) (*QueryResponse, error) {
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("http %d: %s", resp.StatusCode, body)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if int64(len(body)) > maxResponseBytes {
		return nil, fmt.Errorf("response too large: limit %d bytes", maxResponseBytes)
	}

	var out QueryResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	if !out.Success {
		return nil, fmt.Errorf("query failed: %s", out.Reason)
	}

	return &out, nil
}

// Helper functions

func escapeSQLLiteral(v string) string {
	return strings.ReplaceAll(v, "'", "''")
}

func formatTime(t time.Time) string {
	s := t.Local().Format("2006-01-02T15:04:05.000000")
	if idx := strings.Index(s, "."); idx != -1 {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

// parseDateTime parses a date time value from Machbase.
func parseDateTime(val any) (time.Time, bool) {
	if val == nil {
		return time.Time{}, false
	}
	switch v := val.(type) {
	case float64:
		return time.Unix(0, int64(v)*1000), true
	case string:
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			return t, true
		}
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return time.Unix(0, n), true
		}
	}
	return time.Time{}, false
}

// toFloat64 converts a value to float64.
func toFloat64(val any) (float64, bool) {
	if val == nil {
		return 0, false
	}
	switch v := val.(type) {
	case float64:
		return v, true
	case int64:
		return float64(v), true
	case string:
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return f, true
		}
	}
	return 0, false
}

// toString converts a value to string.
func toString(val any) (string, bool) {
	if val == nil {
		return "", false
	}
	switch v := val.(type) {
	case string:
		return v, true
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64), true
	case int64:
		return strconv.FormatInt(v, 10), true
	}
	return "", false
}

// toInt64 converts a value to int64.
func toInt64(val any) (int64, bool) {
	if val == nil {
		return 0, false
	}
	switch v := val.(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	case string:
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			return n, true
		}
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return int64(f), true
		}
	}
	return 0, false
}

// ============================================================
// Blackbox & Sensor DB Functions
// ============================================================

// CameraMetadataRow represents a camera metadata row.
type CameraMetadataRow struct {
	Name   string
	Prefix string
	FPS    *int
}

// BlackboxStats represents blackbox statistics.
type BlackboxStats struct {
	Name    string
	MinTime time.Time
	MaxTime time.Time
}

// ChunkRecord represents a chunk record.
type ChunkRecord struct {
	Value     int64
	EntryTime time.Time
	Length    int64
}

// SensorRow represents a sensor data row.
type SensorRow struct {
	Name  string
	Time  time.Time
	Value float64
}

// RollupRow represents a rollup row.
type RollupRow struct {
	Time      time.Time
	SumLength float64
}

// Metadata fetches metadata for a given tag.
func (m *Machbase) Metadata(ctx context.Context, tag string) (*CameraMetadataRow, error) {
	safeTag := escapeSQLLiteral(tag)
	queries := []string{
		fmt.Sprintf("select name, prefix, fps from _blackbox3_meta where name = '%s'", safeTag),
		fmt.Sprintf("select prefix, fps from blackbox3 metadata where name = '%s'", safeTag),
	}

	for _, sql := range queries {
		resp, err := m.Query(ctx, sql)
		if err != nil {
			continue
		}
		rows, err := parseRows(resp)
		if err != nil || len(rows) == 0 {
			continue
		}
		row := rows[0]
		result := &CameraMetadataRow{Name: tag}

		if len(row) >= 3 {
			if s, ok := toString(row[1]); ok {
				result.Prefix = s
			}
			if f, ok := toFloat64(row[2]); ok {
				fps := int(f)
				result.FPS = &fps
			}
		} else if len(row) >= 1 {
			if s, ok := toString(row[0]); ok {
				result.Prefix = s
			}
			if len(row) > 1 {
				if f, ok := toFloat64(row[1]); ok {
					fps := int(f)
					result.FPS = &fps
				}
			}
		}
		return result, nil
	}
	return nil, nil
}

// BlackboxStatsByTag fetches blackbox statistics for a tag.
func (m *Machbase) BlackboxStatsByTag(ctx context.Context, tag string) (*BlackboxStats, error) {
	safeTag := escapeSQLLiteral(tag)
	sql := fmt.Sprintf(
		"select name, min_time, max_time from v$blackbox3_stat where name = '%s'",
		safeTag,
	)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil || len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	if len(row) < 3 {
		return nil, nil
	}

	minDt, ok1 := parseDateTime(row[1])
	maxDt, ok2 := parseDateTime(row[2])
	if !ok1 || !ok2 {
		return nil, nil
	}

	name := tag
	if s, ok := toString(row[0]); ok {
		name = s
	}

	return &BlackboxStats{
		Name:    name,
		MinTime: minDt,
		MaxTime: maxDt,
	}, nil
}

// BlackboxTimeBounds fetches time bounds for a tag.
func (m *Machbase) BlackboxTimeBounds(ctx context.Context, tag string) (*BlackboxStats, error) {
	safeTag := escapeSQLLiteral(tag)
	sql := fmt.Sprintf(
		"select min(time) as min_time, max(time) as max_time from blackbox3 where name = '%s'",
		safeTag,
	)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil || len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	if len(row) < 2 {
		return nil, nil
	}

	minDt, ok1 := parseDateTime(row[0])
	maxDt, ok2 := parseDateTime(row[1])
	if !ok1 || !ok2 {
		return nil, nil
	}

	return &BlackboxStats{
		Name:    tag,
		MinTime: minDt,
		MaxTime: maxDt,
	}, nil
}

// BlackboxChunkInterval calculates the chunk interval for a tag.
func (m *Machbase) BlackboxChunkInterval(ctx context.Context, tag string) (float64, error) {
	safeTag := escapeSQLLiteral(tag)
	sql := fmt.Sprintf(
		"select time from blackbox3 where name = '%s' order by time limit 2",
		safeTag,
	)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return 0, err
	}
	rows, err := parseRows(resp)
	if err != nil || len(rows) < 2 {
		return 0, nil
	}

	t1, ok1 := parseDateTime(rows[0][0])
	t2, ok2 := parseDateTime(rows[1][0])
	if !ok1 || !ok2 {
		return 0, nil
	}

	delta := t2.Sub(t1).Seconds()
	if delta <= 0 {
		return 0, nil
	}
	return delta, nil
}

// CameraMetadata fetches all camera metadata.
func (m *Machbase) CameraMetadata(ctx context.Context) ([]CameraMetadataRow, error) {
	queries := []string{
		"select name, prefix, fps from _blackbox3_meta",
		"select name, prefix, fps from blackbox3 metadata",
	}

	for _, sql := range queries {
		resp, err := m.Query(ctx, sql)
		if err != nil {
			continue
		}
		rows, err := parseRows(resp)
		if err != nil || len(rows) == 0 {
			continue
		}

		var results []CameraMetadataRow
		for _, row := range rows {
			if len(row) == 0 {
				continue
			}
			r := CameraMetadataRow{}
			if s, ok := toString(row[0]); ok {
				r.Name = s
			}
			if len(row) > 1 {
				if s, ok := toString(row[1]); ok {
					r.Prefix = s
				}
			}
			if len(row) > 2 {
				if f, ok := toFloat64(row[2]); ok {
					fps := int(f)
					r.FPS = &fps
				}
			}
			results = append(results, r)
		}
		return results, nil
	}
	return nil, nil
}

// ListTags fetches all distinct tags from blackbox3.
func (m *Machbase) ListTags(ctx context.Context) ([]string, error) {
	sql := "select distinct name from blackbox3"
	resp, err := m.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil {
		return nil, err
	}

	var tags []string
	for _, row := range rows {
		if len(row) > 0 {
			if s, ok := toString(row[0]); ok {
				tags = append(tags, s)
			}
		}
	}
	return tags, nil
}

// ChunkRecordForTime fetches chunk record for a specific time.
func (m *Machbase) ChunkRecordForTime(ctx context.Context, tag string, ts time.Time) (*ChunkRecord, error) {
	safeTag := escapeSQLLiteral(tag)
	upperNs := ts.UnixNano()
	endNs := upperNs + 6*1_000_000_000 // +6 seconds

	sql := fmt.Sprintf(
		"select /*+ SCAN_FORWARD(blackbox3) */ time, length, value from blackbox3 "+
			"where name = '%s' and time >= %d and time <= %d order by time limit 1",
		safeTag, upperNs, endNs,
	)

	log.Printf("[CHUNK_QUERY] camera=%s, start_ns=%d, end_ns=%d", tag, upperNs, endNs)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil || len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	if len(row) < 3 {
		return nil, nil
	}

	entryTime, ok := parseDateTime(row[0])
	if !ok {
		return nil, nil
	}

	length, _ := toInt64(row[1])
	value, _ := toInt64(row[2])

	return &ChunkRecord{
		Value:     value,
		EntryTime: entryTime,
		Length:    length,
	}, nil
}

// SensorNames fetches sensor names.
func (m *Machbase) SensorNames(ctx context.Context) ([]string, error) {
	sql := "select name from _sensor3_meta order by name"
	resp, err := m.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil {
		return nil, err
	}

	var names []string
	for _, row := range rows {
		if len(row) > 0 {
			if s, ok := toString(row[0]); ok {
				names = append(names, s)
			}
		}
	}
	return names, nil
}

// SensorRows fetches sensor data rows.
func (m *Machbase) SensorRows(ctx context.Context, sensorIDs []string, start, end time.Time) ([]SensorRow, error) {
	if len(sensorIDs) == 0 {
		return nil, nil
	}

	placeholders := make([]string, len(sensorIDs))
	for i, id := range sensorIDs {
		placeholders[i] = fmt.Sprintf("'%s'", escapeSQLLiteral(id))
	}

	startNs := start.UnixNano()
	endNs := end.UnixNano()

	sql := fmt.Sprintf(
		"select name, time, value from sensor3 where name in (%s) and time between %d and %d order by time",
		strings.Join(placeholders, ", "), startNs, endNs,
	)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil {
		return nil, err
	}

	var result []SensorRow
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}
		name, ok1 := toString(row[0])
		dt, ok2 := parseDateTime(row[1])
		value, ok3 := toFloat64(row[2])
		if !ok1 || !ok2 || !ok3 {
			continue
		}
		result = append(result, SensorRow{
			Name:  name,
			Time:  dt,
			Value: value,
		})
	}
	return result, nil
}

// CameraRollup fetches rollup data for a camera.
func (m *Machbase) CameraRollup(ctx context.Context, camera string, minutes int, startNs, endNs int64) ([]RollupRow, error) {
	safeTag := escapeSQLLiteral(camera)
	sql := fmt.Sprintf(
		"select rollup('min', %d, time) as time, sum(length) as total_length "+
			"from blackbox3 where name = '%s' and time between %d and %d group by time order by time",
		minutes, safeTag, startNs, endNs,
	)

	log.Printf("Machbase SQL (rollup): %s | minutes=%d | camera=%s | start_ns=%d | end_ns=%d",
		sql, minutes, camera, startNs, endNs)

	resp, err := m.QueryWithTimeformat(ctx, sql, "us")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(resp)
	if err != nil {
		return nil, err
	}

	var result []RollupRow
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		bucketDt, ok := parseDateTime(row[0])
		if !ok {
			continue
		}
		entry := RollupRow{Time: bucketDt}
		if len(row) > 1 {
			if total, ok := toFloat64(row[1]); ok {
				entry.SumLength = total
			}
		}
		result = append(result, entry)
	}
	return result, nil
}

// QueryWithTimeformat executes a query with timeformat parameter.
func (m *Machbase) QueryWithTimeformat(ctx context.Context, sql, timeformat string) (*QueryResponse, error) {
	u := m.baseURL.JoinPath("db", "query")

	q := u.Query()
	q.Set("q", sql)
	q.Set("rowsArray", "true")
	q.Set("timeformat", timeformat)
	u.RawQuery = q.Encode()

	log.Printf("Machbase SQL: %s", sql)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	return m.do(req)
}

// parseRows parses rows from QueryResponse.
func parseRows(resp *QueryResponse) ([][]any, error) {
	if resp == nil || resp.Data.Rows == nil {
		return nil, nil
	}

	var rows [][]any
	if err := json.Unmarshal(resp.Data.Rows, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal rows: %w", err)
	}
	return rows, nil
}
