package server

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type BlackboxStats struct {
	Name    string
	MinTime time.Time
	MaxTime time.Time
}

// 스키마 기준: blackbox3 metadata 우선 (있으면), _blackbox3_meta는 fallback
func (ds *DataService) metadata(ctx context.Context, tag string) (map[string]interface{}, error) {
	safe := escapeSQLLiteral(tag)

	queries := []string{
		fmt.Sprintf("select name, prefix, fps from blackbox3 metadata where name = '%s'", safe),
		fmt.Sprintf("select name, prefix, fps from _blackbox3_meta where name = '%s'", safe), // optional fallback
	}

	for _, q := range queries {
		_, rows, err := ds.http.Select(ctx, q, nil)
		if err != nil || len(rows) == 0 {
			continue
		}
		row := rows[0]
		out := map[string]interface{}{}

		// shape: name, prefix, fps
		if len(row) >= 3 {
			if s, ok := row[1].(string); ok && s != "" {
				out["prefix"] = s
			}
			out["fps"] = row[2]
			return out, nil
		}
		// defensive
		if len(row) >= 1 {
			if s, ok := row[0].(string); ok && s != "" {
				out["prefix"] = s
			}
		}
		if len(row) >= 2 {
			out["fps"] = row[1]
		}
		return out, nil
	}
	return map[string]interface{}{}, nil
}

func (ds *DataService) blackboxStats(ctx context.Context, tag string) (*BlackboxStats, bool) {
	safe := escapeSQLLiteral(tag)
	sql := fmt.Sprintf("select name, min_time, max_time from v$blackbox3_stat where name = '%s'", safe)

	_, rows, err := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if err != nil || len(rows) == 0 {
		return nil, false
	}
	row := rows[0]
	if len(row) < 3 {
		return nil, false
	}

	minT, ok1 := parseStatDatetime(row[1])
	maxT, ok2 := parseStatDatetime(row[2])
	if !ok1 || !ok2 {
		return nil, false
	}

	name := tag
	if s, ok := row[0].(string); ok && strings.TrimSpace(s) != "" {
		name = strings.TrimSpace(s)
	}

	return &BlackboxStats{Name: name, MinTime: minT, MaxTime: maxT}, true
}

func (ds *DataService) blackboxTimeBounds(ctx context.Context, tag string) (time.Time, time.Time, bool) {
	safe := escapeSQLLiteral(tag)
	sql := fmt.Sprintf("select min(time) as min_time, max(time) as max_time from blackbox3 where name = '%s'", safe)

	_, rows, err := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if err != nil || len(rows) == 0 {
		return time.Time{}, time.Time{}, false
	}
	row := rows[0]
	if len(row) < 2 {
		return time.Time{}, time.Time{}, false
	}

	minT, ok1 := parseDatetimeAny(row[0])
	maxT, ok2 := parseDatetimeAny(row[1])
	if !ok1 || !ok2 {
		return time.Time{}, time.Time{}, false
	}
	return minT, maxT, true
}

func (ds *DataService) blackboxChunkInterval(ctx context.Context, tag string) (float64, bool) {
	safe := escapeSQLLiteral(tag)
	sql := fmt.Sprintf("select time from blackbox3 where name = '%s' order by time limit 2", safe)

	_, rows, err := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if err != nil {
		return 0, false
	}

	var ts []time.Time
	for _, r := range rows {
		if len(r) < 1 {
			continue
		}
		if t, ok := parseDatetimeAny(r[0]); ok {
			ts = append(ts, t)
		}
		if len(ts) == 2 {
			break
		}
	}
	if len(ts) < 2 {
		return 0, false
	}
	d := ts[1].Sub(ts[0]).Seconds()
	if d <= 0 {
		return 0, false
	}
	return d, true
}

func (ds *DataService) cameraMetadata(ctx context.Context) ([]map[string]interface{}, error) {
	// 스키마 기준: blackbox3 metadata가 정식
	sql := "select name, prefix, fps from blackbox3 metadata"
	_, rows, err := ds.http.Select(ctx, sql, nil)
	if err != nil {
		// optional fallback
		sql = "select name, prefix, fps from _blackbox3_meta"
		_, rows, err = ds.http.Select(ctx, sql, nil)
		if err != nil {
			return nil, err
		}
	}

	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		if len(r) == 0 {
			continue
		}
		entry := map[string]interface{}{}
		if s, ok := r[0].(string); ok {
			entry["name"] = s
		}
		if len(r) > 1 {
			entry["prefix"] = r[1]
		}
		if len(r) > 2 {
			entry["fps"] = r[2]
		}
		out = append(out, entry)
	}
	return out, nil
}

func (ds *DataService) listTags(ctx context.Context) ([]string, error) {
	_, rows, err := ds.http.Select(ctx, "select distinct name from blackbox3", nil)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, r := range rows {
		if len(r) == 0 {
			continue
		}
		if s, ok := r[0].(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out, nil
}

func (ds *DataService) listCameras(ctx context.Context) ([]map[string]string, error) {
	if ds.http == nil || !ds.http.enabled {
		return nil, newApiError(503, "Machbase HTTP client disabled")
	}

	var cameras []string

	meta, err := ds.cameraMetadata(ctx)
	if err == nil && len(meta) > 0 {
		for _, row := range meta {
			if name, ok := row["name"].(string); ok && name != "" {
				cameras = append(cameras, name)
			}
		}
	}

	if len(cameras) == 0 {
		tags, err := ds.listTags(ctx)
		if err != nil {
			return nil, err
		}
		for _, tag := range tags {
			if _, ok := ds.blackboxStats(ctx, tag); ok {
				cameras = append(cameras, tag)
			}
		}
	}

	if len(cameras) == 0 {
		return nil, newApiError(404, "No cameras available")
	}

	uniq := map[string]struct{}{}
	for _, c := range cameras {
		uniq[c] = struct{}{}
	}
	cameras = cameras[:0]
	for c := range uniq {
		cameras = append(cameras, c)
	}
	sort.Strings(cameras)

	out := make([]map[string]string, 0, len(cameras))
	for _, c := range cameras {
		out = append(out, map[string]string{"id": c, "label": c})
	}
	return out, nil
}

func firstNonZero(v, def float64) float64 {
	if v == 0 {
		return def
	}
	return v
}

func (ds *DataService) timeRange(ctx context.Context, camera string) (map[string]interface{}, error) {
	if ds.http == nil || !ds.http.enabled {
		return nil, newApiError(503, "Machbase HTTP client disabled")
	}

	var start, end time.Time
	var haveStart, haveEnd bool

	if st, ok := ds.blackboxStats(ctx, camera); ok && st != nil {
		start, haveStart = st.MinTime, !st.MinTime.IsZero()
		end, haveEnd = st.MaxTime, !st.MaxTime.IsZero()
	}

	if !haveStart || !haveEnd {
		minT, maxT, ok := ds.blackboxTimeBounds(ctx, camera)
		if ok {
			if !haveStart {
				start, haveStart = minT, !minT.IsZero()
			}
			if !haveEnd {
				end, haveEnd = maxT, !maxT.IsZero()
			}
		}
	}

	if !haveStart || !haveEnd {
		return nil, newApiError(404, fmt.Sprintf("No timeline entries for camera '%s'", camera))
	}

	chunkDuration := 0.0
	if interval, ok := ds.blackboxChunkInterval(ctx, camera); ok && interval > 0 {
		chunkDuration = interval
	}

	fpsPtr, _ := ds.cameraFPS(ctx, camera)
	if chunkDuration == 0 && fpsPtr != nil && *fpsPtr > 0 {
		chunkDuration = 1.0 / float64(*fpsPtr)
	}

	return map[string]interface{}{
		"camera":                 camera,
		"start":                  formatLocalTime(start),
		"end":                    formatLocalTime(end),
		"chunk_duration_seconds": firstNonZero(chunkDuration, 5.0),
		"fps":                    fpsPtr,
	}, nil
}

func (ds *DataService) chunkRecordForTime(ctx context.Context, camera string, ts time.Time, rawTime string) (chunkValue int64, entryTime time.Time, lengthVal interface{}, ok bool, err error) {
	if ds.http == nil || !ds.http.enabled {
		return 0, time.Time{}, nil, false, newApiError(503, "Machbase HTTP client disabled")
	}

	safe := escapeSQLLiteral(camera)
	upperNS := datetimeToUTCNanoseconds(ts)

	sql := fmt.Sprintf(
		"select /*+ SCAN_BACKWARD(blackbox3) */ time, length, value from blackbox3 "+
			"where name = '%s' and time > %d - 7000000000 and time <= %d "+
			"order by time desc limit 1",
		safe, upperNS, upperNS,
	)

	log.Printf("[CHUNK_QUERY] camera=%s, requested_time=%s, upper_ns=%d", camera, rawTime, upperNS)
	log.Printf("[CHUNK_QUERY_SQL] %s", sql)

	_, rows, e := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if e != nil {
		return 0, time.Time{}, nil, false, e
	}
	if len(rows) == 0 {
		return 0, time.Time{}, nil, false, nil
	}
	row := rows[0]
	if len(row) < 3 {
		return 0, time.Time{}, nil, false, nil
	}

	t, okT := parseDatetimeAny(row[0])
	if !okT {
		return 0, time.Time{}, nil, false, nil
	}

	cv, okCV := toInt64(row[2])
	if !okCV {
		// 스키마상 value long이므로 정상 케이스에서는 항상 파싱 가능해야 함
		return 0, time.Time{}, nil, false, nil
	}

	return cv, t, row[1], true, nil
}

func (ds *DataService) initPath(camera string) string {
	return filepath.Join(ds.dataDir, camera, fmt.Sprintf("init-stream%d.m4s", videoStreamIndex))
}

func (ds *DataService) chunkPath(ctx context.Context, camera string, chunkNumber int64) (string, error) {
	prefix, err := ds.resolvePrefix(ctx, camera)
	if err != nil {
		return "", err
	}
	return filepath.Join(ds.dataDir, camera, fmt.Sprintf("%s%d-%05d.m4s", prefix, videoStreamIndex, chunkNumber)), nil
}

func (ds *DataService) frameBytes(ctx context.Context, camera, timeToken string) ([]byte, error) {
	var target string

	if timeToken == "0" || strings.EqualFold(timeToken, "init") {
		target = ds.initPath(camera)
	} else {
		ts, err := parseTimeToken(timeToken)
		if err != nil {
			return nil, newApiError(400, err.Error())
		}
		chunk, _, _, ok, err := ds.chunkRecordForTime(ctx, camera, ts, timeToken)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, newApiError(404, fmt.Sprintf("Chunk not found for camera '%s' at time '%s'", camera, timeToken))
		}
		p, err := ds.chunkPath(ctx, camera, chunk)
		if err != nil {
			return nil, err
		}
		target = p
	}

	b, err := os.ReadFile(target)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, newApiError(404, fmt.Sprintf("Segment not found for camera '%s'", camera))
		}
		return nil, err
	}
	return b, nil
}

func (ds *DataService) cameraRollup(ctx context.Context, camera string, minutes int, startNS, endNS int64) (map[string]interface{}, error) {
	if minutes <= 0 {
		return nil, newApiError(400, "Parameter 'minutes' must be a positive integer")
	}
	if ds.http == nil || !ds.http.enabled {
		return nil, newApiError(503, "Machbase HTTP client disabled")
	}
	if startNS < 0 || endNS < 0 {
		return nil, newApiError(400, "Start and end time must be non-negative")
	}
	if startNS >= endNS {
		return nil, newApiError(400, "Parameter 'start_time' must be earlier than 'end_time'")
	}

	safe := escapeSQLLiteral(camera)
	sql := fmt.Sprintf(
		"select rollup('min', %d, time) as time, sum(length) as total_length "+
			"from blackbox3 where name = '%s' and time between %d and %d "+
			"group by time order by time",
		minutes, safe, startNS, endNS,
	)

	_, rows, err := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if err != nil {
		return nil, err
	}

	type rollupRow struct {
		Time      string      `json:"time"`
		SumLength interface{} `json:"sum_length,omitempty"`
	}

	outRows := make([]rollupRow, 0, len(rows))
	for _, r := range rows {
		if len(r) == 0 {
			continue
		}
		bt, ok := parseDatetimeAny(r[0])
		if !ok {
			continue
		}
		row := rollupRow{Time: formatLocalTime(bt)}
		if len(r) > 1 && r[1] != nil {
			if f, ok := toFloat64(r[1]); ok {
				row.SumLength = f
			} else {
				row.SumLength = r[1]
			}
		}
		outRows = append(outRows, row)
	}

	startT := utcNanosecondsToTime(startNS)
	endT := utcNanosecondsToTime(endNS)

	return map[string]interface{}{
		"camera":        camera,
		"minutes":       minutes,
		"start_time_ns": startNS,
		"end_time_ns":   endNS,
		"start":         formatLocalTime(startT),
		"end":           formatLocalTime(endT),
		"rows":          outRows,
	}, nil
}
