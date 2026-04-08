//go:build !linux

package ai

import (
	"os/exec"
	"syscall"
)

func setPdeathsig(_ *exec.Cmd) {}

func sigterm() syscall.Signal {
	return syscall.SIGTERM
}
