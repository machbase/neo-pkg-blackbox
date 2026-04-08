package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// SensorNames fetches sensor names.
func (m *Machbase) SensorNames(ctx context.Context) ([]string, error) {
	sql := "select name from _sensor3_meta order by name"
	resp, err := m.Query(ctx, sql)
	if err != nil {
		return nil, err
	}

	var rows []struct {
		Name string `json:"NAME"`
	}
	if err := json.Unmarshal(resp.Data.Rows, &rows); err != nil {
		return nil, err
	}

	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.Name
	}
	return names, nil
}

// SensorRow represents a sensor data row.
type SensorRow struct {
	Name  string
	Time  time.Time
	Value float64
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

	resp, err := m.Query(ctx, sql, WithTimeformat("ns"))
	if err != nil {
		return nil, err
	}

	var rows []struct {
		Name  string  `json:"NAME"`
		Time  int64   `json:"TIME"`
		Value float64 `json:"VALUE"`
	}
	if err := json.Unmarshal(resp.Data.Rows, &rows); err != nil {
		return nil, err
	}

	result := make([]SensorRow, len(rows))
	for i, r := range rows {
		result[i] = SensorRow{
			Name:  r.Name,
			Time:  time.Unix(0, r.Time),
			Value: r.Value,
		}
	}
	return result, nil
}
