//go:build !linux

package watcher

import (
	"blackbox-backend/internal/config"
	"blackbox-backend/internal/db"
	"blackbox-backend/internal/ffmpeg"
	"blackbox-backend/internal/logger"
	"context"
	"fmt"
)

type Watcher struct {
	cfg     config.WatcherConfig
	neo     *db.Machbase
	ffRuner *ffmpeg.FFmpegRunner

	RamDisk string
	DataDir string
}

func New(cfg config.WatcherConfig, neo *db.Machbase, ffRunner *ffmpeg.FFmpegRunner) *Watcher {
	return &Watcher{
		cfg:     cfg,
		neo:     neo,
		ffRuner: ffRunner,
	}
}

func (w *Watcher) Run(ctx context.Context) error {
	log := logger.GetLogger()
	log.Warn("Watcher is not supported on this platform (non-Linux)")
	log.Warn("Watcher will run in stub mode - file watching is disabled")

	// Just wait for context cancellation
	<-ctx.Done()
	log.Info("Stop Watcher (stub mode)")
	return nil
}

func (w *Watcher) AddWatch(ctx context.Context, rule config.WatcherRule) error {
	log := logger.GetLogger()
	log.Warnf("[watcher stub] AddWatch called for camera_id=%s (no-op on non-Linux)", rule.CameraID)
	return nil
}

func (w *Watcher) RemoveWatch(ctx context.Context, cameraID string) error {
	log := logger.GetLogger()
	log.Warnf("[watcher stub] RemoveWatch called for camera_id=%s (no-op on non-Linux)", cameraID)
	return nil
}

// Note: This is a stub implementation for non-Linux platforms (macOS, Windows, etc.)
// The actual file watching functionality using inotify is only available on Linux.
// For development on macOS, the watcher will be in stub mode and won't actually watch files.
func init() {
	fmt.Println("⚠️  WARNING: Running on non-Linux platform - file watcher is in stub mode")
	fmt.Println("   File watching will not work. Deploy to Linux for full functionality.")
}
