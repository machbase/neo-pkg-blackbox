package server

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func sanitizeTag(v string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", fmt.Errorf("empty tag value")
	}
	if !tagRe.MatchString(v) {
		return "", fmt.Errorf("illegal characters in tag '%s'", v)
	}
	return v, nil
}

func localLocation() *time.Location {
	loc := time.Now().Location()
	if loc == nil {
		return time.UTC
	}
	return loc
}

func parseTimeToken(raw string) (time.Time, error) {
	c := strings.TrimSpace(raw)
	if strings.EqualFold(c, "now") {
		return time.Now().In(localLocation()), nil
	}

	normalized := strings.ReplaceAll(c, "T", " ")
	normalized = strings.TrimSuffix(normalized, "Z")

	layouts := []string{
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	// timezone offset/RFC3339
	if strings.Contains(c, "T") && (strings.Contains(c, "Z") || strings.ContainsAny(c, "+-")) {
		for _, l := range []string{time.RFC3339Nano, time.RFC3339} {
			if t, err := time.Parse(l, c); err == nil {
				return t.In(localLocation()), nil
			}
		}
	}

	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, normalized, localLocation()); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("invalid time token: %s", raw)
}

func formatLocalTime(t time.Time) string {
	lt := t.In(localLocation())
	s := lt.Format("2006-01-02T15:04:05.000000")
	if strings.Contains(s, ".") {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

func datetimeToUTCNanoseconds(t time.Time) int64 {
	return t.UTC().UnixNano()
}

func utcNanosecondsToTime(ns int64) time.Time {
	return time.Unix(0, ns).In(localLocation())
}

func escapeSQLLiteral(v string) string {
	return strings.ReplaceAll(v, "'", "''")
}

// ---------- parsing Machbase time outputs ----------

func secondsFromEpoch(v interface{}) (float64, bool) {
	var f float64
	switch x := v.(type) {
	case float64:
		f = x
	case float32:
		f = float64(x)
	case int:
		f = float64(x)
	case int64:
		f = float64(x)
	case json.Number:
		ff, err := x.Float64()
		if err != nil {
			return 0, false
		}
		f = ff
	case string:
		s := strings.TrimSpace(x)
		if s == "" {
			return 0, false
		}
		ff, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, false
		}
		f = ff
	default:
		return 0, false
	}

	abs := math.Abs(f)
	digits := 1
	if abs >= 1 {
		ii := int64(abs)
		if ii > 0 {
			digits = len(strconv.FormatInt(ii, 10))
		}
	}

	div := 1.0
	switch {
	case digits >= 18:
		div = 1_000_000_000 // ns
	case digits >= 16:
		div = 1_000_000 // us
	case digits >= 13:
		div = 1_000 // ms
	default:
		div = 1 // s
	}
	return f / div, true
}

func timeFromEpoch(v interface{}) (time.Time, bool) {
	sec, ok := secondsFromEpoch(v)
	if !ok {
		return time.Time{}, false
	}
	s := int64(sec)
	nsec := int64((sec - float64(s)) * 1e9)
	return time.Unix(s, nsec).In(localLocation()), true
}

func parseDatetimeAny(v interface{}) (time.Time, bool) {
	if v == nil {
		return time.Time{}, false
	}

	switch x := v.(type) {
	case float64, float32, int, int64, json.Number:
		return timeFromEpoch(v)
	case string:
		candidate := strings.ReplaceAll(x, "T", " ")
		candidate = strings.TrimSuffix(candidate, "Z")
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			return time.Time{}, false
		}
		if t, err := parseTimeToken(candidate); err == nil {
			return t, true
		}
		if regexp.MustCompile(`^-?\d+(\.\d+)?$`).MatchString(candidate) {
			return timeFromEpoch(candidate)
		}
	}

	return time.Time{}, false
}

func parseStatDatetime(v interface{}) (time.Time, bool) {
	if t, ok := parseDatetimeAny(v); ok {
		return t, true
	}

	var candidate string
	switch x := v.(type) {
	case string:
		candidate = strings.TrimSpace(x)
	case float64, float32, int, int64, json.Number:
		candidate = fmt.Sprintf("%v", x)
	default:
		return time.Time{}, false
	}
	if candidate == "" {
		return time.Time{}, false
	}

	// yyyymmddhhmmssffffff
	if len(candidate) >= 20 {
		head := candidate[:14]
		us := candidate[14:20]
		s := head + "." + us
		if t, err := time.ParseInLocation("20060102150405.000000", s, localLocation()); err == nil {
			return t, true
		}
	}

	// yyyymmddhhmmss
	if len(candidate) >= 14 {
		part := candidate[:14]
		if t, err := time.ParseInLocation("20060102150405", part, localLocation()); err == nil {
			return t, true
		}
	}

	return timeFromEpoch(candidate)
}

func toFloat64(v interface{}) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case float32:
		return float64(x), true
	case int:
		return float64(x), true
	case int64:
		return float64(x), true
	case json.Number:
		f, err := x.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(x), 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func toInt64(v interface{}) (int64, bool) {
	switch x := v.(type) {
	case int64:
		return x, true
	case int:
		return int64(x), true
	case float64:
		return int64(x), true
	case json.Number:
		i, err := x.Int64()
		return i, err == nil
	case string:
		i, err := strconv.ParseInt(strings.TrimSpace(x), 10, 64)
		return i, err == nil
	default:
		return 0, false
	}
}
