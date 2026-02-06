package db

import "context"

// InsertChunk inserts a video chunk record into the specified table.
// - table: table name (e.g., "blackbox3")
// - name: camera ID
// - utcTimeNs: UTC timestamp in nanoseconds (actual observation time)
// - lengthSeconds: chunk duration in seconds (double)
// - chunkPath: file path to the video chunk
func (m *Machbase) InsertChunk(ctx context.Context, table string, name string, utcTimeNs int64, lengthSeconds float64, chunkPath string) error {
	columns := []string{"name", "time", "value", "chunk_path"}

	rows := [][]any{{name, utcTimeNs, lengthSeconds, chunkPath}}
	if err := m.WriteRows(ctx, table, columns, rows); err != nil {
		return err
	}

	return nil
}
