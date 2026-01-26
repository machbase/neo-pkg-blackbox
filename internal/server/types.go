package server

import (
	"fmt"
	"regexp"
	"strings"
)

const (
	videoStreamIndex = 0
	defaultPort      = 8000
)

var (
	tagRe = regexp.MustCompile(`^[A-Za-z0-9_.:-]+$`)

	defaultSensorNames = func() []string {
		out := make([]string, 0, 10)
		for i := 1; i <= 10; i++ {
			out = append(out, fmt.Sprintf("sensor-%d", i))
		}
		return out
	}()

	defaultSensorLabels = func() map[string]string {
		m := map[string]string{}
		for _, n := range defaultSensorNames {
			m[n] = strings.ReplaceAll(n, "sensor-", "Sensor ")
		}
		return m
	}()
)

type ApiError struct {
	Status  int    `json:"-"`
	Message string `json:"error"`
}

func (e *ApiError) Error() string { return e.Message }

func newApiError(status int, msg string) *ApiError {
	return &ApiError{Status: status, Message: msg}
}
