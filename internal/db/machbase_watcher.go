package db

import "context"

func (m *Machbase) InsertChunk(ctx context.Context, name string, utcTime int64, length int64, epoch int64) error {
	table := "blackbox3"
	columns := []string{"name", "time", "length", "value"}

	rows := [][]any{{name, utcTime, length, epoch}}
	if err := m.WriteRows(ctx, table, columns, rows); err != nil {
		return err
	}

	return nil
}
