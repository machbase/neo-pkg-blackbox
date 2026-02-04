package db

import (
	"context"
	"time"
)

type CameraRow struct {
	Table         string
	Name          string
	Desc          string
	RtspURL       string
	WebRTCURL     string
	MediaURL      string
	EventRule     string
	DetectObjects string // JSON array string
	FFmpegJSON    string // 혹은 []byte
	CreatedAt     time.Time
}

func (m *Machbase) InsertCamera(ctx context.Context, row CameraRow) error {
	columns := []string{
		"table_name", "camera_name", "camera_desc",
		"rtsp_url", "webrtc_url", "media_url",
		"event_rule", "detect_objects", "ffmpeg_option",
	}
	rows := [][]any{{
		row.Table, row.Name, row.Desc,
		row.RtspURL, row.WebRTCURL, row.MediaURL,
		row.EventRule, row.DetectObjects, row.FFmpegJSON,
	}}

	if err := m.WriteRows(ctx, "stream_config", columns, rows); err != nil {
		return err
	}

	return nil
}

// CameraLogRow represents a detection log entry for {camera}_log table.
type CameraLogRow struct {
	Name     string  // camera_id.ident (ex: camera1.person)
	Time     int64   // nanoseconds
	Value    float64 // detection count
	ModelID  string
	CameraID string // metadata
	Ident    string // metadata
}

func (m *Machbase) InsertCameraLogs(ctx context.Context, table string, logs []CameraLogRow) error {
	columns := []string{"name", "time", "value", "model_id", "camera_id", "ident"}
	rows := make([][]any, len(logs))
	for i, l := range logs {
		rows[i] = []any{l.Name, l.Time, l.Value, l.ModelID, l.CameraID, l.Ident}
	}

	if err := m.WriteRows(ctx, table, columns, rows); err != nil {
		return err
	}

	return nil
}

