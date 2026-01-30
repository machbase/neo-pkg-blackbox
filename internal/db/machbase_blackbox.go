package db

import (
	"context"
	"fmt"
	"log"
	"time"
)

// Row types for JSON decoding

type metaRow struct {
	Name   string `json:"NAME"`
	Prefix string `json:"PREFIX"`
	FPS    *int   `json:"FPS"`
}

type metaRow2 struct {
	Prefix string `json:"PREFIX"`
	FPS    *int   `json:"FPS"`
}

type statsRow struct {
	Name    string `json:"NAME"`
	MinTime int64  `json:"MIN_TIME"`
	MaxTime int64  `json:"MAX_TIME"`
}

type timeBoundsRow struct {
	MinTime int64 `json:"MIN_TIME"`
	MaxTime int64 `json:"MAX_TIME"`
}

type timeRow struct {
	Time int64 `json:"TIME"`
}

type nameRow struct {
	Name string `json:"NAME"`
}

type chunkRow struct {
	Time   int64 `json:"TIME"`
	Length int64 `json:"LENGTH"`
	Value  int64 `json:"VALUE"`
}

type rollupRowDB struct {
	Time        int64   `json:"TIME"`
	TotalLength float64 `json:"TOTAL_LENGTH"`
}

// Result types

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

// RollupRow represents a rollup row.
type RollupRow struct {
	Time      time.Time
	SumLength float64
}

// Metadata fetches metadata for a given tag.
func (m *Machbase) Metadata(ctx context.Context, tag string) (*CameraMetadataRow, error) {
	safeTag := escapeSQLLiteral(tag)

	// Try first query
	sql := fmt.Sprintf("select name, prefix, fps from _blackbox3_meta where name = '%s'", safeTag)
	rows, err := QueryRows[metaRow](ctx, m, sql)
	if err == nil && len(rows) > 0 {
		return &CameraMetadataRow{
			Name:   rows[0].Name,
			Prefix: rows[0].Prefix,
			FPS:    rows[0].FPS,
		}, nil
	}

	// Try second query
	sql = fmt.Sprintf("select prefix, fps from blackbox3 metadata where name = '%s'", safeTag)
	rows2, err := QueryRows[metaRow2](ctx, m, sql)
	if err == nil && len(rows2) > 0 {
		return &CameraMetadataRow{
			Name:   tag,
			Prefix: rows2[0].Prefix,
			FPS:    rows2[0].FPS,
		}, nil
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

	rows, err := QueryRows[statsRow](ctx, m, sql, WithTimeformat("ns"))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	return &BlackboxStats{
		Name:    row.Name,
		MinTime: time.Unix(0, row.MinTime),
		MaxTime: time.Unix(0, row.MaxTime),
	}, nil
}

// BlackboxTimeBounds fetches time bounds for a tag.
func (m *Machbase) BlackboxTimeBounds(ctx context.Context, tag string) (*BlackboxStats, error) {
	safeTag := escapeSQLLiteral(tag)
	sql := fmt.Sprintf(
		"select min(time) as min_time, max(time) as max_time from blackbox3 where name = '%s'",
		safeTag,
	)

	rows, err := QueryRows[timeBoundsRow](ctx, m, sql, WithTimeformat("ns"))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	if row.MinTime == 0 && row.MaxTime == 0 {
		return nil, nil
	}

	return &BlackboxStats{
		Name:    tag,
		MinTime: time.Unix(0, row.MinTime),
		MaxTime: time.Unix(0, row.MaxTime),
	}, nil
}

// BlackboxChunkInterval calculates the chunk interval for a tag.
func (m *Machbase) BlackboxChunkInterval(ctx context.Context, tag string) (float64, error) {
	safeTag := escapeSQLLiteral(tag)
	sql := fmt.Sprintf(
		"select time from blackbox3 where name = '%s' order by time limit 2",
		safeTag,
	)

	rows, err := QueryRows[timeRow](ctx, m, sql, WithTimeformat("ns"))
	if err != nil {
		return 0, err
	}
	if len(rows) < 2 {
		return 0, nil
	}

	t1 := time.Unix(0, rows[0].Time)
	t2 := time.Unix(0, rows[1].Time)

	delta := t2.Sub(t1).Seconds()
	if delta <= 0 {
		return 0, nil
	}
	return delta, nil
}

// CameraMetadata fetches all camera metadata.
func (m *Machbase) CameraMetadata(ctx context.Context) ([]CameraMetadataRow, error) {
	// Try first query
	sql := "select name, prefix, fps from _blackbox3_meta"
	rows, err := QueryRows[metaRow](ctx, m, sql)
	if err == nil && len(rows) > 0 {
		results := make([]CameraMetadataRow, len(rows))
		for i, r := range rows {
			results[i] = CameraMetadataRow{
				Name:   r.Name,
				Prefix: r.Prefix,
				FPS:    r.FPS,
			}
		}
		return results, nil
	}

	// Try second query
	sql = "select name, prefix, fps from blackbox3 metadata"
	rows, err = QueryRows[metaRow](ctx, m, sql)
	if err == nil && len(rows) > 0 {
		results := make([]CameraMetadataRow, len(rows))
		for i, r := range rows {
			results[i] = CameraMetadataRow{
				Name:   r.Name,
				Prefix: r.Prefix,
				FPS:    r.FPS,
			}
		}
		return results, nil
	}

	return nil, nil
}

// ListTags fetches all distinct tags from blackbox3.
func (m *Machbase) ListTags(ctx context.Context) ([]string, error) {
	sql := "select distinct name from blackbox3"
	rows, err := QueryRows[nameRow](ctx, m, sql)
	if err != nil {
		return nil, err
	}

	tags := make([]string, len(rows))
	for i, r := range rows {
		tags[i] = r.Name
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

	rows, err := QueryRows[chunkRow](ctx, m, sql, WithTimeformat("ns"))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	return &ChunkRecord{
		Value:     row.Value,
		EntryTime: time.Unix(0, row.Time),
		Length:    row.Length,
	}, nil
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

	rows, err := QueryRows[rollupRowDB](ctx, m, sql, WithTimeformat("ns"))
	if err != nil {
		return nil, err
	}

	result := make([]RollupRow, len(rows))
	for i, r := range rows {
		result[i] = RollupRow{
			Time:      time.Unix(0, r.Time),
			SumLength: r.TotalLength,
		}
	}
	return result, nil
}
