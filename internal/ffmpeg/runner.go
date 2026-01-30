package ffmpeg

import (
	"blackbox-backend/internal/config"
	"context"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
)

type FFmpegRunner struct {
	cfg config.FFmpegConfig
}

func New(cfg config.FFmpegConfig) *FFmpegRunner {
	return &FFmpegRunner{
		cfg: cfg,
	}
}

type CamEvent struct {
	ID    string
	Index int
	Stage string
	Err   error
}

func (r *FFmpegRunner) Run(ctx context.Context) error {
	wg := sync.WaitGroup{}
	events := make(chan CamEvent, len(r.cfg.Cameras))

	go func() {
		for ev := range events {
			if ev.Err != nil {
				log.Printf("[cam %d:%s] %s error: %v", ev.Index, ev.ID, ev.Stage, ev.Err)
			} else {
				log.Printf("[cam %d:%s] %s", ev.Index, ev.ID, ev.Stage)
			}
		}
	}()

	for i, cam := range r.cfg.Cameras {
		wg.Add(1)
		go func(i int, cam config.CameraJob) {
			defer wg.Done()

			execArgs := r.BuildExecArgs(cam)
			log.Printf("FFmpeg command:\n%s\n", prettyCommand(r.cfg.Binary, execArgs))

			cmd := exec.CommandContext(ctx, r.cfg.Binary, execArgs...)
			cmd.Dir = cam.OutputDIR
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				if ctx.Err() != nil {
					events <- CamEvent{ID: cam.ID, Index: i, Stage: "exit", Err: err}
					return
				}

				events <- CamEvent{ID: cam.ID, Index: i, Stage: "exit", Err: err}
				return
			}

			events <- CamEvent{ID: cam.ID, Index: i, Stage: "exit", Err: nil}
		}(i, cam)
	}

	wg.Wait()
	close(events)
	return nil
}

func (r *FFmpegRunner) BuildExecArgs(camera config.CameraJob) []string {
	args := []string{}
	args = append(args, flattenExecArgs(camera.InputArgs)...)
	args = append(args, "-i", camera.RtspURL)
	args = append(args, flattenExecArgs(camera.MidArgs)...)
	args = append(args, flattenExecArgs(camera.OutputArgs)...)
	args = append(args, camera.OutputName) // manifest.mpd
	return args
}

func flattenExecArgs(kvs []config.ArgKV) []string {
	out := make([]string, 0, len(kvs)*2)
	for _, arg := range kvs {
		if arg.Flag == "" {
			continue
		}
		if !strings.HasPrefix(arg.Flag, "-") {
			out = append(out, "-"+arg.Flag)
		}
		if arg.Value != "" {
			out = append(out, arg.Value)
		}
	}
	return out
}

func prettyCommand(b string, args []string) string {
	parts := make([]string, 0, len(args)+1)
	parts = append(parts, shellQuote(b))

	for _, a := range args {
		qa := shellQuote(a)

		if strings.HasPrefix(a, "-") {
			parts = append(parts, " \\\n"+qa)
		} else {
			parts = append(parts, " "+qa)
		}
	}

	return strings.Join(parts, "")
}

func shellQuote(s string) string {
	if s == "" {
		return "''"
	}

	need := false
	for _, c := range s {
		if c == ' ' || c == '\n' || c == '\t' || c == '\'' || c == '"' || c == '\\' {
			need = true
			break
		}
	}

	if !need {
		return s
	}

	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
