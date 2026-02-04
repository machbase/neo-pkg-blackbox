package db

import (
	"context"
	"time"
)

type CameraRow struct {
	Table      string
	Name       string
	Desc       string
	RtspURL    string
	WebRTCURL  string
	FFmpegJSON string // 혹은 []byte
	CreatedAt  time.Time
}

func (m *Machbase) InsertCamera(ctx context.Context, row CameraRow) error {
	columns := []string{"table_name", "camera_name", "camera_desc", "rtsp_url", "webrtc_url", "ffmpeg_option"}
	rows := [][]any{{row.Table, row.Name, row.Desc, row.RtspURL, row.WebRTCURL, row.FFmpegJSON}}

	if err := m.WriteRows(ctx, "stream_config", columns, rows); err != nil {
		return err
	}

	return nil
}
