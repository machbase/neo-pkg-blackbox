//go:build !linux

package mediamtx

import (
	"os/exec"
	"syscall"
)

func setPdeathsig(_ *exec.Cmd) {}

func sigterm() syscall.Signal {
	return syscall.SIGTERM
}
