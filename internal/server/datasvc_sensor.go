package server

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

func (ds *DataService) sensorNames(ctx context.Context) ([]string, error) {
	// 스키마 기준: sensor3에는 metadata가 없으므로 distinct name에서 목록 구성
	_, rows, err := ds.http.Select(ctx, "select distinct name from sensor3 order by name", nil)
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

func sensorKeyFromTag(camera, tag string) string {
	if tag == "" {
		return ""
	}
	if strings.HasPrefix(tag, camera+":") {
		return tag[len(camera)+1:]
	}
	if strings.HasPrefix(tag, camera+".") {
		return tag[len(camera)+1:]
	}
	return tag
}

func sensorSortKey(id string) string {
	re := regexp.MustCompile(`^sensor-(\d+)$`)
	if m := re.FindStringSubmatch(id); len(m) == 2 {
		n, _ := strconv.Atoi(m[1])
		return fmt.Sprintf("0-%08d", n)
	}
	return "1-" + id
}

func (ds *DataService) listSensorTags(ctx context.Context, camera string) ([]map[string]string, error) {
	var sensorIDs []string

	if ds.http != nil && ds.http.enabled {
		if raw, err := ds.sensorNames(ctx); err == nil {
			for _, tag := range raw {
				if id := sensorKeyFromTag(camera, tag); id != "" {
					sensorIDs = append(sensorIDs, id)
				}
			}
		}
	}

	if len(sensorIDs) == 0 {
		sensorIDs = append(sensorIDs, defaultSensorNames...)
	}

	uniq := map[string]struct{}{}
	for _, s := range sensorIDs {
		uniq[s] = struct{}{}
	}
	sensorIDs = sensorIDs[:0]
	for s := range uniq {
		sensorIDs = append(sensorIDs, s)
	}
	sort.Slice(sensorIDs, func(i, j int) bool { return sensorSortKey(sensorIDs[i]) < sensorSortKey(sensorIDs[j]) })

	out := make([]map[string]string, 0, len(sensorIDs))
	for _, id := range sensorIDs {
		label := defaultSensorLabels[id]
		if label == "" {
			// 간단한 title-case
			s := strings.ReplaceAll(id, "_", " ")
			if len(s) > 0 {
				s = strings.ToUpper(s[:1]) + s[1:]
			}
			label = s
		}
		out = append(out, map[string]string{"id": id, "label": label})
	}
	return out, nil
}

type sensorRow struct {
	Name  string
	Time  time.Time
	Value float64
}

func matchSensorID(tagName string, sensorIDs []string) string {
	for _, id := range sensorIDs {
		if tagName == id {
			return id
		}
		if strings.HasSuffix(tagName, ":"+id) || strings.HasSuffix(tagName, "."+id) {
			return id
		}
	}
	return ""
}

func (ds *DataService) sensorRows(ctx context.Context, sensorIDs []string, start, end time.Time) ([]sensorRow, error) {
	if len(sensorIDs) == 0 {
		return nil, nil
	}

	uniq := map[string]struct{}{}
	for _, id := range sensorIDs {
		s, err := sanitizeTag(id)
		if err != nil {
			continue
		}
		uniq[s] = struct{}{}
	}
	if len(uniq) == 0 {
		return nil, nil
	}

	ids := make([]string, 0, len(uniq))
	for k := range uniq {
		ids = append(ids, k)
	}
	sort.Strings(ids)

	// 중요: sensor3.name이 "sensor-1" 또는 "camera-0:sensor-1" 등으로 저장될 수 있음.
	// client는 sensorID만 보내므로, suffix 매칭까지 SQL에서 커버.
	var orParts []string
	for _, id := range ids {
		safe := escapeSQLLiteral(id)
		orParts = append(orParts,
			fmt.Sprintf("(name = '%s' OR name like '%%:%s' OR name like '%%.%s')", safe, safe, safe),
		)
	}
	nameCond := strings.Join(orParts, " OR ")

	startNS := datetimeToUTCNanoseconds(start)
	endNS := datetimeToUTCNanoseconds(end)

	sql := fmt.Sprintf(
		"select name, time, value from sensor3 "+
			"where (%s) and time between %d and %d order by time",
		nameCond, startNS, endNS,
	)

	_, rows, err := ds.http.Select(ctx, sql, map[string]string{"timeformat": "us"})
	if err != nil {
		return nil, err
	}

	out := make([]sensorRow, 0, len(rows))
	for _, r := range rows {
		if len(r) < 3 {
			continue
		}
		name, _ := r[0].(string)
		t, ok := parseDatetimeAny(r[1])
		if !ok {
			continue
		}
		val, ok := toFloat64(r[2])
		if !ok {
			continue
		}
		out = append(out, sensorRow{Name: name, Time: t, Value: val})
	}
	return out, nil
}

func (ds *DataService) sensorData(ctx context.Context, sensorIDs []string, start, end time.Time) ([]map[string]interface{}, error) {
	if len(sensorIDs) == 0 {
		return []map[string]interface{}{}, nil
	}
	if start.After(end) {
		return nil, newApiError(400, "Start time must be earlier than end time")
	}
	if ds.http == nil || !ds.http.enabled {
		return nil, newApiError(503, "Sensor data requires Machbase HTTP client")
	}

	rows, err := ds.sensorRows(ctx, sensorIDs, start, end)
	if err != nil {
		return nil, err
	}

	grouped := map[int64]map[string]float64{} // key: UnixNano
	order := map[int64]time.Time{}

	for _, r := range rows {
		matched := matchSensorID(r.Name, sensorIDs)
		if matched == "" {
			continue
		}
		if r.Time.Before(start) || r.Time.After(end) {
			continue
		}
		k := r.Time.UnixNano()
		if _, ok := grouped[k]; !ok {
			grouped[k] = map[string]float64{}
			order[k] = r.Time
		}
		grouped[k][matched] = r.Value
	}

	keys := make([]int64, 0, len(grouped))
	for k := range grouped {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	out := make([]map[string]interface{}, 0, len(keys))
	for _, k := range keys {
		t := order[k]
		out = append(out, map[string]interface{}{
			"time":   formatLocalTime(t),
			"values": grouped[k],
		})
	}
	return out, nil
}
