package ai

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"neo-blackbox/internal/config"
	"neo-blackbox/internal/logger"
)

// Manager는 AI manager 프로세스를 관리한다.
type Manager struct {
	cfg    config.AIConfig
	logDir string
	cmd    *exec.Cmd
	mu     sync.Mutex
}

// New는 AIConfig와 로그 디렉토리로 Manager를 생성한다.
func New(cfg config.AIConfig, logDir string) *Manager {
	return &Manager{
		cfg:    cfg,
		logDir: logDir,
	}
}

// Run은 AI manager를 시작하고 ctx가 취소될 때까지 대기한 후 종료한다.
// binary가 설정되지 않으면 즉시 반환한다 (비활성화).
// main.go의 errgroup에서 g.Go(aiMgr.Run) 형태로 사용한다.
func (m *Manager) Run(ctx context.Context) error {
	if m.cfg.Binary == "" {
		logger.GetLogger().Info("[ai] manager binary not configured, skipping")
		return nil
	}

	if err := m.start(); err != nil {
		logger.GetLogger().Warnf("[ai] failed to start manager: %v", err)
		return nil // manager 실패가 백엔드 전체를 중단시키지 않음
	}

	<-ctx.Done()
	return m.Stop()
}

// start는 manager 프로세스를 실행한다.
func (m *Manager) start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd != nil && m.cmd.Process != nil {
		return fmt.Errorf("manager already running (PID: %d)", m.cmd.Process.Pid)
	}

	args := []string{"--config", m.cfg.ConfigFile}
	cmd := exec.Command(m.cfg.Binary, args...)

	// 로그 파일 설정
	if err := os.MkdirAll(m.logDir, 0o755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}
	logPath := filepath.Join(m.logDir, "ai_manager.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	setPdeathsig(cmd) // 부모 프로세스 종료 시 SIGTERM 전달 (Linux)

	if err := cmd.Start(); err != nil {
		logFile.Close()
		return fmt.Errorf("start process: %w", err)
	}

	m.cmd = cmd
	logger.GetLogger().Infof("[ai] manager started (PID: %d, log: %s)", cmd.Process.Pid, logPath)

	// 백그라운드에서 프로세스 종료 대기
	go func() {
		defer logFile.Close()
		err := cmd.Wait()
		m.mu.Lock()
		m.cmd = nil
		m.mu.Unlock()
		if err != nil {
			logger.GetLogger().Warnf("[ai] manager exited: %v", err)
		} else {
			logger.GetLogger().Info("[ai] manager stopped")
		}
	}()

	return nil
}

// Stop은 manager 프로세스를 SIGTERM으로 종료한다.
// 5초 내에 종료되지 않으면 SIGKILL로 강제 종료한다.
func (m *Manager) Stop() error {
	m.mu.Lock()

	if m.cmd == nil || m.cmd.Process == nil {
		m.mu.Unlock()
		return nil
	}

	pid := m.cmd.Process.Pid
	proc := m.cmd.Process
	m.mu.Unlock()

	logger.GetLogger().Infof("[ai] stopping manager (PID: %d)", pid)

	if err := proc.Signal(sigterm()); err != nil {
		// 이미 종료된 경우 무시
		return nil
	}

	done := make(chan struct{})
	go func() {
		// cmd.Wait()는 start() 내 goroutine에서 이미 처리 중
		// Process가 nil이 될 때까지 폴링
		for {
			m.mu.Lock()
			stopped := (m.cmd == nil)
			m.mu.Unlock()
			if stopped {
				close(done)
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
	}()

	select {
	case <-time.After(5 * time.Second):
		logger.GetLogger().Warnf("[ai] manager did not stop in 5s, killing (PID: %d)", pid)
		proc.Kill()
	case <-done:
	}

	logger.GetLogger().Infof("[ai] manager stopped (PID: %d)", pid)
	return nil
}

// IsRunning은 manager 프로세스가 실행 중인지 반환한다.
func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cmd != nil && m.cmd.Process != nil
}
